"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type Point = {
  x: number;
  y: number;
};

type ShapeType =
  | "pen"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle";

type Stroke = {
  id: string;
  type: ShapeType;
  points: Point[];
  color: string;
  width: number;
  userId: string;
};

type RemoteCursor = {
  userId: string;
  x: number;
  y: number;
};

export type DrawingCanvasHandle = {
  undo: () => void;
  redo: () => void;
  download: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

type DrawingCanvasProps = {
  color: string;
  brushSize: number;
  tool: string;

  onHistoryChange?: (
    canUndo: boolean,
    canRedo: boolean
  ) => void;

  onConnectionChange?: (
    connected: boolean
  ) => void;

  onPresenceChange?: (
    count: number
  ) => void;
};

type ServerMessage =
  | {
      type: "room-joined";
      roomId: string;
    }
  | {
      type: "canvas-state";
      strokes: Stroke[];
    }
  | {
      type: "draw-operation";
      stroke: Stroke;
    }
  | {
      type: "presence";
      count: number;
    }
  | {
      type: "cursor-move";
      userId: string;
      x: number;
      y: number;
    }
  | {
      type: "cursor-remove";
      userId: string;
    }
  | {
      type: "error";
      message: string;
    };

const isShapeTool = (
  tool: string
): tool is "line" | "rectangle" | "circle" => {
  return (
    tool === "line" ||
    tool === "rectangle" ||
    tool === "circle"
  );
};

const isDrawingTool = (
  tool: string
): tool is ShapeType => {
  return (
    tool === "pen" ||
    tool === "eraser" ||
    tool === "line" ||
    tool === "rectangle" ||
    tool === "circle"
  );
};

const DrawingCanvas = forwardRef<
  DrawingCanvasHandle,
  DrawingCanvasProps
>(function DrawingCanvas(
  {
    color,
    brushSize,
    tool,
    onHistoryChange,
    onConnectionChange,
    onPresenceChange,
  },
  ref
) {
  // =========================================================
  // CANVAS REFS
  // =========================================================

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const previewCanvasRef =
    useRef<HTMLCanvasElement | null>(null);

  // =========================================================
  // WEBSOCKET
  // =========================================================

  const socketRef =
    useRef<WebSocket | null>(null);

  const roomIdRef =
    useRef("default-room");

  const userIdRef = useRef(
    `user-${Math.random()
      .toString(36)
      .slice(2, 10)}`
  );

  // =========================================================
  // DRAWING HISTORY
  // =========================================================

  const strokesRef =
    useRef<Stroke[]>([]);

  const redoRef =
    useRef<Stroke[]>([]);

  // =========================================================
  // ACTIVE DRAWING
  // =========================================================

  const currentPointsRef =
    useRef<Point[]>([]);

  const isDrawingRef =
    useRef(false);

  const activePointerIdRef =
    useRef<number | null>(null);

  // =========================================================
  // CURRENT SETTINGS
  // =========================================================

  const colorRef =
    useRef(color);

  const brushSizeRef =
    useRef(brushSize);

  const toolRef =
    useRef(tool);

  useEffect(() => {
    colorRef.current =
      color;
  }, [color]);

  useEffect(() => {
    brushSizeRef.current =
      brushSize;
  }, [brushSize]);

  useEffect(() => {
    toolRef.current =
      tool;
  }, [tool]);

  // =========================================================
  // CALLBACK REFS
  // =========================================================

  const historyCallbackRef =
    useRef(onHistoryChange);

  const connectionCallbackRef =
    useRef(onConnectionChange);

  const presenceCallbackRef =
    useRef(onPresenceChange);

  useEffect(() => {
    historyCallbackRef.current =
      onHistoryChange;
  }, [onHistoryChange]);

  useEffect(() => {
    connectionCallbackRef.current =
      onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    presenceCallbackRef.current =
      onPresenceChange;
  }, [onPresenceChange]);

  // =========================================================
  // REMOTE CURSORS
  // =========================================================

  const [remoteCursors, setRemoteCursors] =
    useState<
      Record<string, RemoteCursor>
    >({});

  // =========================================================
  // RECONNECTION
  // =========================================================

  const reconnectTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const reconnectAttemptRef =
    useRef(0);

  const shouldReconnectRef =
    useRef(true);

  // =========================================================
  // ID GENERATOR
  // =========================================================

  const generateId = () => {
    if (
      typeof crypto !== "undefined" &&
      crypto.randomUUID
    ) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
  };

  // =========================================================
  // CONTEXT HELPERS
  // =========================================================

  const getMainContext =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return null;
      }

      return canvas.getContext("2d");
    }, []);

  const getPreviewContext =
    useCallback(() => {
      const canvas =
        previewCanvasRef.current;

      if (!canvas) {
        return null;
      }

      return canvas.getContext("2d");
    }, []);

  // =========================================================
  // HISTORY CALLBACK
  // =========================================================

  const notifyHistory =
    useCallback(() => {
      historyCallbackRef.current?.(
        strokesRef.current.length > 0,
        redoRef.current.length > 0
      );
    }, []);

  // =========================================================
  // POINTER COORDINATES
  // =========================================================

  const getCanvasCoordinates = (
    event: PointerEvent
  ): Point => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    const logicalWidth =
      canvas.clientWidth || 1;

    const logicalHeight =
      canvas.clientHeight || 1;

    return {
      x:
        ((event.clientX - rect.left) /
          (rect.width || 1)) *
        logicalWidth,

      y:
        ((event.clientY - rect.top) /
          (rect.height || 1)) *
        logicalHeight,
    };
  };

  // =========================================================
  // SEND CURSOR POSITION
  // =========================================================

  const sendCursorPosition = (
    point: Point
  ) => {
    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "cursor-move",
        roomId:
          roomIdRef.current,
        x: point.x,
        y: point.y,
      })
    );
  };

  // =========================================================
  // CLEAR PREVIEW
  // =========================================================

  const clearPreview =
    useCallback(() => {
      const canvas =
        previewCanvasRef.current;

      const ctx =
        getPreviewContext();

      if (!canvas || !ctx) {
        return;
      }

      ctx.clearRect(
        0,
        0,
        canvas.clientWidth,
        canvas.clientHeight
      );
    }, [getPreviewContext]);

  // =========================================================
  // DRAW FREEHAND
  // =========================================================

  const drawFreehand = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    strokeColor: string,
    width: number,
    erase: boolean
  ) => {
    if (points.length === 0) {
      return;
    }

    ctx.save();

    ctx.globalCompositeOperation =
      erase
        ? "destination-out"
        : "source-over";

    ctx.strokeStyle =
      strokeColor;

    ctx.fillStyle =
      strokeColor;

    ctx.lineWidth =
      width;

    ctx.lineCap =
      "round";

    ctx.lineJoin =
      "round";

    if (points.length === 1) {
      ctx.beginPath();

      ctx.arc(
        points[0].x,
        points[0].y,
        width / 2,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      return;
    }

    ctx.beginPath();

    ctx.moveTo(
      points[0].x,
      points[0].y
    );

    for (
      let i = 1;
      i < points.length;
      i++
    ) {
      ctx.lineTo(
        points[i].x,
        points[i].y
      );
    }

    ctx.stroke();

    ctx.restore();
  };

  // =========================================================
  // DRAW LINE
  // =========================================================

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    strokeColor: string,
    width: number
  ) => {
    ctx.save();

    ctx.strokeStyle =
      strokeColor;

    ctx.lineWidth =
      width;

    ctx.lineCap =
      "round";

    ctx.beginPath();

    ctx.moveTo(
      start.x,
      start.y
    );

    ctx.lineTo(
      end.x,
      end.y
    );

    ctx.stroke();

    ctx.restore();
  };

  // =========================================================
  // DRAW RECTANGLE
  // =========================================================

  const drawRectangle = (
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    strokeColor: string,
    width: number
  ) => {
    ctx.save();

    ctx.strokeStyle =
      strokeColor;

    ctx.lineWidth =
      width;

    const x = Math.min(
      start.x,
      end.x
    );

    const y = Math.min(
      start.y,
      end.y
    );

    const rectangleWidth =
      Math.abs(
        end.x - start.x
      );

    const rectangleHeight =
      Math.abs(
        end.y - start.y
      );

    ctx.strokeRect(
      x,
      y,
      rectangleWidth,
      rectangleHeight
    );

    ctx.restore();
  };

  // =========================================================
  // DRAW CIRCLE
  // =========================================================

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    strokeColor: string,
    width: number
  ) => {
    ctx.save();

    ctx.strokeStyle =
      strokeColor;

    ctx.lineWidth =
      width;

    const centerX =
      (start.x + end.x) / 2;

    const centerY =
      (start.y + end.y) / 2;

    const radiusX =
      Math.abs(
        end.x - start.x
      ) / 2;

    const radiusY =
      Math.abs(
        end.y - start.y
      ) / 2;

    ctx.beginPath();

    ctx.ellipse(
      centerX,
      centerY,
      radiusX,
      radiusY,
      0,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();
  };

  // =========================================================
  // RENDER STORED STROKE
  // =========================================================

  const renderStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: Stroke
  ) => {
    if (
      stroke.points.length === 0
    ) {
      return;
    }

    if (
      stroke.type === "pen"
    ) {
      drawFreehand(
        ctx,
        stroke.points,
        stroke.color,
        stroke.width,
        false
      );

      return;
    }

    if (
      stroke.type === "eraser"
    ) {
      drawFreehand(
        ctx,
        stroke.points,
        stroke.color,
        stroke.width,
        true
      );

      return;
    }

    if (
      stroke.points.length < 2
    ) {
      return;
    }

    const start =
      stroke.points[0];

    const end =
      stroke.points[
        stroke.points.length - 1
      ];

    if (
      stroke.type === "line"
    ) {
      drawLine(
        ctx,
        start,
        end,
        stroke.color,
        stroke.width
      );

      return;
    }

    if (
      stroke.type === "rectangle"
    ) {
      drawRectangle(
        ctx,
        start,
        end,
        stroke.color,
        stroke.width
      );

      return;
    }

    if (
      stroke.type === "circle"
    ) {
      drawCircle(
        ctx,
        start,
        end,
        stroke.color,
        stroke.width
      );
    }
  };

  // =========================================================
  // REDRAW PERMANENT CANVAS
  // =========================================================

  const redrawCanvas =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      const ctx =
        getMainContext();

      if (!canvas || !ctx) {
        return;
      }

      ctx.clearRect(
        0,
        0,
        canvas.clientWidth,
        canvas.clientHeight
      );

      for (
        const stroke of
          strokesRef.current
      ) {
        renderStroke(
          ctx,
          stroke
        );
      }
    }, [getMainContext]);

  // =========================================================
  // SEND STROKE
  // =========================================================

  const sendStroke = (
    stroke: Stroke
  ) => {
    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "draw-operation",
        roomId:
          roomIdRef.current,
        stroke,
      })
    );
  };

  // =========================================================
  // FINISH DRAWING
  // =========================================================

  const finishDrawing = (
    finalPoint?: Point
  ) => {
    if (!isDrawingRef.current) {
      return;
    }

    const activeTool =
      toolRef.current;

    let points =
      [...currentPointsRef.current];

    if (
      finalPoint &&
      isShapeTool(activeTool)
    ) {
      if (points.length === 0) {
        points = [
          finalPoint,
        ];
      } else if (
        points.length === 1
      ) {
        points.push(
          finalPoint
        );
      } else {
        points[
          points.length - 1
        ] = finalPoint;
      }
    }

    if (
      isShapeTool(activeTool) &&
      points.length < 2
    ) {
      currentPointsRef.current =
        [];

      isDrawingRef.current =
        false;

      activePointerIdRef.current =
        null;

      clearPreview();

      return;
    }

    if (
      points.length > 0 &&
      isDrawingTool(activeTool)
    ) {
      const stroke: Stroke = {
        id: generateId(),

        type:
          activeTool,

        points,

        color:
          colorRef.current,

        width:
          activeTool ===
          "eraser"
            ? brushSizeRef.current *
              3
            : brushSizeRef.current,

        userId:
          userIdRef.current,
      };

      strokesRef.current.push(
        stroke
      );

      redoRef.current = [];

      clearPreview();

      const ctx =
        getMainContext();

      if (ctx) {
        renderStroke(
          ctx,
          stroke
        );
      }

      sendStroke(stroke);

      notifyHistory();
    }

    currentPointsRef.current =
      [];

    isDrawingRef.current =
      false;

    activePointerIdRef.current =
      null;

    clearPreview();
  };

  // =========================================================
  // POINTER DOWN
  // =========================================================

  const handlePointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const activeTool =
      toolRef.current;

    if (
      !isDrawingTool(
        activeTool
      )
    ) {
      return;
    }

    const point =
      getCanvasCoordinates(
        event.nativeEvent
      );

    currentPointsRef.current =
      [point];

    isDrawingRef.current =
      true;

    activePointerIdRef.current =
      event.pointerId;

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Ignore pointer capture errors.
    }

    if (
      activeTool === "pen" ||
      activeTool === "eraser"
    ) {
      const ctx =
        getMainContext();

      if (!ctx) {
        return;
      }

      drawFreehand(
        ctx,
        [point],
        colorRef.current,
        activeTool ===
        "eraser"
          ? brushSizeRef.current *
            3
          : brushSizeRef.current,
        activeTool ===
          "eraser"
      );
    }
  };

  // =========================================================
  // POINTER MOVE
  // =========================================================

  const handlePointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const point =
      getCanvasCoordinates(
        event.nativeEvent
      );

    /*
     * Always send cursor position.
     */
    sendCursorPosition(point);

    if (!isDrawingRef.current) {
      return;
    }

    const activeTool =
      toolRef.current;

    // -------------------------------------------------------
    // PEN / ERASER
    // -------------------------------------------------------

    if (
      activeTool === "pen" ||
      activeTool === "eraser"
    ) {
      const points =
        currentPointsRef.current;

      const previous =
        points[
          points.length - 1
        ];

      if (previous) {
        const ctx =
          getMainContext();

        if (ctx) {
          drawFreehand(
            ctx,
            [
              previous,
              point,
            ],
            colorRef.current,
            activeTool ===
            "eraser"
              ? brushSizeRef.current *
                3
              : brushSizeRef.current,
            activeTool ===
              "eraser"
          );
        }
      }

      points.push(point);

      return;
    }

    // -------------------------------------------------------
    // SHAPES
    // -------------------------------------------------------

    if (
      isShapeTool(activeTool)
    ) {
      const start =
        currentPointsRef.current[0];

      const ctx =
        getPreviewContext();

      if (!start || !ctx) {
        return;
      }

      clearPreview();

      if (
        activeTool === "line"
      ) {
        drawLine(
          ctx,
          start,
          point,
          colorRef.current,
          brushSizeRef.current
        );
      }

      if (
        activeTool ===
        "rectangle"
      ) {
        drawRectangle(
          ctx,
          start,
          point,
          colorRef.current,
          brushSizeRef.current
        );
      }

      if (
        activeTool === "circle"
      ) {
        drawCircle(
          ctx,
          start,
          point,
          colorRef.current,
          brushSizeRef.current
        );
      }

      currentPointsRef.current =
        [start, point];
    }
  };

  // =========================================================
  // POINTER UP
  // =========================================================

  const handlePointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerIdRef.current !==
        null &&
      event.pointerId !==
        activePointerIdRef.current
    ) {
      return;
    }

    const point =
      getCanvasCoordinates(
        event.nativeEvent
      );

    finishDrawing(point);

    try {
      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        );
      }
    } catch {
      // Ignore pointer capture errors.
    }
  };

  // =========================================================
  // GLOBAL POINTER RELEASE
  // =========================================================

  useEffect(() => {
    const handleWindowPointerUp =
      (event: PointerEvent) => {
        if (
          !isDrawingRef.current
        ) {
          return;
        }

        if (
          activePointerIdRef.current !==
            null &&
          event.pointerId !==
            activePointerIdRef.current
        ) {
          return;
        }

        const canvas =
          canvasRef.current;

        if (!canvas) {
          finishDrawing();
          return;
        }

        const rect =
          canvas.getBoundingClientRect();

        const point: Point = {
          x:
            ((event.clientX -
              rect.left) /
              (rect.width || 1)) *
            canvas.clientWidth,

          y:
            ((event.clientY -
              rect.top) /
              (rect.height || 1)) *
            canvas.clientHeight,
        };

        finishDrawing(point);
      };

    window.addEventListener(
      "pointerup",
      handleWindowPointerUp
    );

    window.addEventListener(
      "pointercancel",
      handleWindowPointerUp
    );

    return () => {
      window.removeEventListener(
        "pointerup",
        handleWindowPointerUp
      );

      window.removeEventListener(
        "pointercancel",
        handleWindowPointerUp
      );
    };
  });

  // =========================================================
  // UNDO
  // =========================================================

  const undo = () => {
    const stroke =
      strokesRef.current.pop();

    if (!stroke) {
      return;
    }

    redoRef.current.push(
      stroke
    );

    clearPreview();

    redrawCanvas();

    notifyHistory();
  };

  // =========================================================
  // REDO
  // =========================================================

  const redo = () => {
    const stroke =
      redoRef.current.pop();

    if (!stroke) {
      return;
    }

    strokesRef.current.push(
      stroke
    );

    clearPreview();

    redrawCanvas();

    notifyHistory();
  };

  // =========================================================
  // DOWNLOAD
  // =========================================================

  const download = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const exportCanvas =
      document.createElement(
        "canvas"
      );

    exportCanvas.width =
      canvas.clientWidth;

    exportCanvas.height =
      canvas.clientHeight;

    const ctx =
      exportCanvas.getContext(
        "2d"
      );

    if (!ctx) {
      return;
    }

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      exportCanvas.width,
      exportCanvas.height
    );

    for (
      const stroke of
        strokesRef.current
    ) {
      renderStroke(
        ctx,
        stroke
      );
    }

    const link =
      document.createElement(
        "a"
      );

    link.download =
      "collab-canvas-drawing.png";

    link.href =
      exportCanvas.toDataURL(
        "image/png"
      );

    link.click();
  };

  // =========================================================
  // IMPERATIVE API
  // =========================================================

  useImperativeHandle(
    ref,
    () => ({
      undo,
      redo,
      download,

      canUndo: () =>
        strokesRef.current
          .length > 0,

      canRedo: () =>
        redoRef.current
          .length > 0,
    }),
    []
  );

  // =========================================================
  // WEBSOCKET CONNECTION + ROOM
  // =========================================================

  useEffect(() => {
    // =======================================================
    // ROOM ID
    // =======================================================

    const url =
      new URL(
        window.location.href
      );

    let roomId =
      url.searchParams.get(
        "room"
      );

    if (!roomId) {
      roomId =
        Math.random()
          .toString(36)
          .substring(2, 8);

      url.searchParams.set(
        "room",
        roomId
      );

      window.history.replaceState(
        {},
        "",
        url.toString()
      );
    }

    roomIdRef.current =
      roomId;

    // =======================================================
    // RECONNECTION SETTINGS
    // =======================================================

    shouldReconnectRef.current =
      true;

    reconnectAttemptRef.current =
      0;

    // =======================================================
    // CONNECT FUNCTION
    // =======================================================

    const connect = () => {
      if (
        !shouldReconnectRef.current
      ) {
        return;
      }

      const existingSocket =
        socketRef.current;

      if (
        existingSocket &&
        (
          existingSocket.readyState ===
            WebSocket.OPEN ||
          existingSocket.readyState ===
            WebSocket.CONNECTING
        )
      ) {
        return;
      }

      console.log(
        "🔄 Connecting to WebSocket..."
      );

      /*
       * IMPORTANT:
       *
       * Local development:
       * ws://localhost:8080
       *
       * Production:
       * NEXT_PUBLIC_WEBSOCKET_URL
       *
       * Example production URL:
       * wss://collab-canvas-server.onrender.com
       */
      const websocketUrl =
        process.env.NEXT_PUBLIC_WEBSOCKET_URL ||
        "ws://localhost:8080";

      const socket =
        new WebSocket(
          websocketUrl
        );

      socketRef.current =
        socket;

      // =====================================================
      // OPEN
      // =====================================================

      socket.onopen = () => {
        console.log(
          "✅ WebSocket connected"
        );

        reconnectAttemptRef.current =
          0;

        connectionCallbackRef.current?.(
          true
        );

        socket.send(
          JSON.stringify({
            type: "join-room",

            roomId:
              roomIdRef.current,

            userId:
              userIdRef.current,
          })
        );
      };

      // =====================================================
      // MESSAGE
      // =====================================================

      socket.onmessage = (
        event
      ) => {
        try {
          const data =
            JSON.parse(
              event.data
            ) as ServerMessage;

          // -------------------------------------------------
          // ROOM JOINED
          // -------------------------------------------------

          if (
            data.type ===
            "room-joined"
          ) {
            console.log(
              `✅ Joined room: ${data.roomId}`
            );

            return;
          }

          // -------------------------------------------------
          // INITIAL CANVAS STATE
          // -------------------------------------------------

          if (
            data.type ===
            "canvas-state"
          ) {
            console.log(
              `🎨 Received ${data.strokes.length} existing stroke(s)`
            );

            strokesRef.current =
              [...data.strokes];

            redoRef.current =
              [];

            redrawCanvas();

            notifyHistory();

            return;
          }

          // -------------------------------------------------
          // PRESENCE
          // -------------------------------------------------

          if (
            data.type ===
            "presence"
          ) {
            console.log(
              `👥 Users in room: ${data.count}`
            );

            presenceCallbackRef.current?.(
              data.count
            );

            return;
          }

          // -------------------------------------------------
          // CURSOR MOVE
          // -------------------------------------------------

          if (
            data.type ===
            "cursor-move"
          ) {
            setRemoteCursors(
              (current) => ({
                ...current,

                [data.userId]: {
                  userId:
                    data.userId,
                  x: data.x,
                  y: data.y,
                },
              })
            );

            return;
          }

          // -------------------------------------------------
          // CURSOR REMOVE
          // -------------------------------------------------

          if (
            data.type ===
            "cursor-remove"
          ) {
            setRemoteCursors(
              (current) => {
                const updated = {
                  ...current,
                };

                delete updated[
                  data.userId
                ];

                return updated;
              }
            );

            return;
          }

          // -------------------------------------------------
          // SERVER ERROR
          // -------------------------------------------------

          if (
            data.type ===
            "error"
          ) {
            console.error(
              data.message
            );

            return;
          }

          // -------------------------------------------------
          // REMOTE DRAWING
          // -------------------------------------------------

          if (
            data.type ===
            "draw-operation"
          ) {
            const incoming =
              data.stroke;

            const duplicate =
              strokesRef.current.some(
                (stroke) =>
                  stroke.id ===
                  incoming.id
              );

            if (duplicate) {
              return;
            }

            strokesRef.current.push(
              incoming
            );

            const ctx =
              getMainContext();

            if (ctx) {
              renderStroke(
                ctx,
                incoming
              );
            }

            notifyHistory();

            return;
          }
        } catch (error) {
          console.error(
            "Invalid WebSocket message:",
            error
          );
        }
      };

      // =====================================================
      // ERROR
      // =====================================================

      socket.onerror = () => {
        console.warn(
          "⚠️ WebSocket connection error"
        );

        connectionCallbackRef.current?.(
          false
        );
      };

      // =====================================================
      // CLOSE
      // =====================================================

      socket.onclose = () => {
        console.warn(
          "🔌 WebSocket disconnected"
        );

        connectionCallbackRef.current?.(
          false
        );

        setRemoteCursors({});

        if (
          socketRef.current ===
          socket
        ) {
          socketRef.current =
            null;
        }

        if (
          !shouldReconnectRef.current
        ) {
          return;
        }

        reconnectAttemptRef.current +=
          1;

        const attempt =
          reconnectAttemptRef.current;

        const delay =
          Math.min(
            2000 *
              Math.pow(
                2,
                attempt - 1
              ),
            10000
          );

        console.log(
          `🔄 Reconnecting in ${
            delay / 1000
          } seconds...`
        );

        if (
          reconnectTimerRef.current
        ) {
          clearTimeout(
            reconnectTimerRef.current
          );
        }

        reconnectTimerRef.current =
          setTimeout(
            () => {
              reconnectTimerRef.current =
                null;

              connect();
            },
            delay
          );
      };
    };

    // =======================================================
    // FIRST CONNECTION
    // =======================================================

    connect();

    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {
      shouldReconnectRef.current =
        false;

      if (
        reconnectTimerRef.current
      ) {
        clearTimeout(
          reconnectTimerRef.current
        );

        reconnectTimerRef.current =
          null;
      }

      const socket =
        socketRef.current;

      if (
        socket &&
        (
          socket.readyState ===
            WebSocket.OPEN ||
          socket.readyState ===
            WebSocket.CONNECTING
        )
      ) {
        socket.close();
      }

      socketRef.current =
        null;
    };
  }, [
    getMainContext,
    notifyHistory,
    redrawCanvas,
  ]);

  // =========================================================
  // RESIZE
  // =========================================================

  useEffect(() => {
    const canvas =
      canvasRef.current;

    const previewCanvas =
      previewCanvasRef.current;

    if (
      !canvas ||
      !previewCanvas
    ) {
      return;
    }

    const resizeCanvas = () => {
      const parent =
        canvas.parentElement;

      if (!parent) {
        return;
      }

      const width =
        parent.clientWidth;

      const height =
        parent.clientHeight;

      const dpr =
        window.devicePixelRatio ||
        1;

      canvas.width =
        Math.max(
          1,
          Math.round(
            width * dpr
          )
        );

      canvas.height =
        Math.max(
          1,
          Math.round(
            height * dpr
          )
        );

      canvas.style.width =
        `${width}px`;

      canvas.style.height =
        `${height}px`;

      previewCanvas.width =
        Math.max(
          1,
          Math.round(
            width * dpr
          )
        );

      previewCanvas.height =
        Math.max(
          1,
          Math.round(
            height * dpr
          )
        );

      previewCanvas.style.width =
        `${width}px`;

      previewCanvas.style.height =
        `${height}px`;

      const ctx =
        canvas.getContext(
          "2d"
        );

      const previewCtx =
        previewCanvas.getContext(
          "2d"
        );

      if (
        !ctx ||
        !previewCtx
      ) {
        return;
      }

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      previewCtx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      redrawCanvas();

      clearPreview();
    };

    resizeCanvas();

    const observer =
      new ResizeObserver(
        resizeCanvas
      );

    observer.observe(
      canvas.parentElement ??
        canvas
    );

    return () => {
      observer.disconnect();
    };
  }, [
    redrawCanvas,
    clearPreview,
  ]);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="absolute inset-0">

      {/* PERMANENT DRAWING CANVAS */}

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* INTERACTION / PREVIEW CANVAS */}

      <canvas
        ref={previewCanvasRef}
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={
          handlePointerUp
        }
        className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
      />

      {/* ================================================= */}
      {/* REMOTE CURSORS */}
      {/* ================================================= */}

      {Object.values(
        remoteCursors
      ).map(
        (cursor) => (
          <div
            key={
              cursor.userId
            }
            className="absolute pointer-events-none z-50"
            style={{
              left:
                `${cursor.x}px`,
              top:
                `${cursor.y}px`,
              transform:
                "translate(-2px, -2px)",
            }}
          >
            <div className="relative">

              {/* CURSOR */}

              <div
                className="text-blue-600 text-2xl leading-none"
                style={{
                  textShadow:
                    "0 1px 2px rgba(0,0,0,0.2)",
                }}
              >
                ➤
              </div>

              {/* USER LABEL */}

              <div className="absolute left-4 top-4 bg-blue-600 text-white text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-sm">
                User{" "}
                {cursor.userId.slice(
                  -4
                )}
              </div>

            </div>
          </div>
        )
      )}

    </div>
  );
});

DrawingCanvas.displayName =
  "DrawingCanvas";

export default DrawingCanvas;
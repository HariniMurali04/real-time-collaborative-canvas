"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import DrawingCanvas from "../components/DrawingCanvas";
import type {
  DrawingCanvasHandle,
} from "../components/DrawingCanvas";

import {
  MousePointer2,
  Pencil,
  Eraser,
  Minus,
  Square,
  Circle,
  Undo2,
  Redo2,
  Download,
  Users,
  Share2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export default function Home() {
  // =========================================================
  // APPLICATION STATE
  // =========================================================

  const [tool, setTool] =
    useState("select");

  const [color, setColor] =
    useState("#000000");

  const [brushSize, setBrushSize] =
    useState(4);

  const [canUndo, setCanUndo] =
    useState(false);

  const [canRedo, setCanRedo] =
    useState(false);

  const [zoom, setZoom] =
    useState(100);

  const [isConnected, setIsConnected] =
    useState(false);

  // =========================================================
  // ROOM STATE
  // =========================================================

  const [roomId, setRoomId] =
    useState("");

  // =========================================================
  // ONLINE USERS STATE
  // =========================================================

  const [onlineUsers, setOnlineUsers] =
    useState(1);

  // =========================================================
  // READ ROOM ID FROM URL
  // =========================================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    setRoomId(
      params.get("room") || ""
    );
  }, []);

  // =========================================================
  // CANVAS REF
  // =========================================================

  const canvasRef =
    useRef<DrawingCanvasHandle | null>(
      null
    );

  // =========================================================
  // STABLE CALLBACKS
  // =========================================================

  const handleHistoryChange =
    useCallback(
      (
        undoAvailable: boolean,
        redoAvailable: boolean
      ) => {
        setCanUndo(
          undoAvailable
        );

        setCanRedo(
          redoAvailable
        );
      },
      []
    );

  const handleConnectionChange =
    useCallback(
      (connected: boolean) => {
        setIsConnected(
          connected
        );
      },
      []
    );

  // =========================================================
  // PRESENCE CALLBACK
  // =========================================================

  const handlePresenceChange =
    useCallback(
      (count: number) => {
        setOnlineUsers(
          count
        );
      },
      []
    );

  // =========================================================
  // ZOOM
  // =========================================================

  const increaseZoom = () => {
    setZoom((current) =>
      Math.min(
        current + 10,
        200
      )
    );
  };

  const decreaseZoom = () => {
    setZoom((current) =>
      Math.max(
        current - 10,
        50
      )
    );
  };

  const resetZoom = () => {
    setZoom(100);
  };

  // =========================================================
  // SHARE
  // =========================================================

  const handleShare = async () => {
    const url =
      window.location.href;

    try {
      await navigator.clipboard.writeText(
        url
      );

      alert(
        "Canvas link copied to clipboard!"
      );
    } catch {
      alert(
        `Share this link:\n${url}`
      );
    }
  };

  // =========================================================
  // TOOLS
  // =========================================================

  const tools = [
    {
      id: "select",
      label: "Select",
      icon: MousePointer2,
    },
    {
      id: "pen",
      label: "Pen",
      icon: Pencil,
    },
    {
      id: "eraser",
      label: "Eraser",
      icon: Eraser,
    },
    {
      id: "line",
      label: "Line",
      icon: Minus,
    },
    {
      id: "rectangle",
      label: "Rectangle",
      icon: Square,
    },
    {
      id: "circle",
      label: "Circle",
      icon: Circle,
    },
  ];

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-gray-900">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className="h-16 border-b bg-white flex items-center justify-between px-6">

        {/* LOGO */}

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold">
            C
          </div>

          <div>
            <h1 className="font-semibold text-lg">
              CollabCanvas
            </h1>

            <p className="text-xs text-gray-500">
              Real-time collaborative workspace
            </p>
          </div>

        </div>

        {/* RIGHT HEADER */}

        <div className="flex items-center gap-4">

          {/* ROOM ID */}

          {roomId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border">

              <span className="text-xs text-gray-500">
                Room
              </span>

              <span className="text-sm font-mono font-medium text-gray-900">
                {roomId}
              </span>

            </div>
          )}

          {/* ONLINE USERS */}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border">

            <Users size={17} />

            {/* USER AVATARS */}

            <div className="flex -space-x-2">

              <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center border-2 border-white">
                H
              </div>

              <div className="w-7 h-7 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center border-2 border-white">
                A
              </div>

              <div className="w-7 h-7 rounded-full bg-green-500 text-white text-xs flex items-center justify-center border-2 border-white">
                R
              </div>

            </div>

            {/* REAL ONLINE COUNT */}

            <span className="text-sm text-gray-600">
              {onlineUsers}{" "}
              {onlineUsers === 1
                ? "online"
                : "online"}
            </span>

          </div>

          {/* SHARE */}

          <button
            onClick={
              handleShare
            }
            className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 transition"
          >
            <Share2 size={16} />

            Share
          </button>

        </div>

      </header>

      {/* ================================================= */}
      {/* MAIN WORKSPACE */}
      {/* ================================================= */}

      <div className="flex h-[calc(100vh-64px)]">

        {/* ================================================= */}
        {/* LEFT TOOLBAR */}
        {/* ================================================= */}

        <aside className="w-20 border-r bg-white flex flex-col items-center py-5 gap-3">

          {tools.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() =>
                    setTool(
                      item.id
                    )
                  }
                  title={
                    item.label
                  }
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                    tool ===
                    item.id
                      ? "bg-black text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={20} />
                </button>
              );
            }
          )}

          <div className="w-10 border-t my-2" />

          {/* UNDO */}

          <button
            title="Undo"
            disabled={!canUndo}
            onClick={() =>
              canvasRef.current?.undo()
            }
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              canUndo
                ? "text-gray-600 hover:bg-gray-100"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            <Undo2 size={20} />
          </button>

          {/* REDO */}

          <button
            title="Redo"
            disabled={!canRedo}
            onClick={() =>
              canvasRef.current?.redo()
            }
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              canRedo
                ? "text-gray-600 hover:bg-gray-100"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            <Redo2 size={20} />
          </button>

          {/* DOWNLOAD */}

          <button
            title="Download"
            onClick={() =>
              canvasRef.current?.download()
            }
            className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 transition"
          >
            <Download size={20} />
          </button>

        </aside>

        {/* ================================================= */}
        {/* CANVAS SECTION */}
        {/* ================================================= */}

        <section className="flex-1 flex flex-col">

          {/* ================================================= */}
          {/* TOOLBAR */}
          {/* ================================================= */}

          <div className="h-16 border-b bg-white flex items-center px-6 gap-8">

            {/* COLOR */}

            <div className="flex items-center gap-3">

              <span className="text-sm text-gray-500">
                Color
              </span>

              <input
                type="color"
                value={color}
                onChange={(e) =>
                  setColor(
                    e.target.value
                  )
                }
                className="w-10 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
              />

              <span className="text-xs font-mono text-gray-500">
                {color}
              </span>

            </div>

            {/* BRUSH SIZE */}

            <div className="flex items-center gap-3">

              <span className="text-sm text-gray-500">
                Size
              </span>

              <input
                type="range"
                min="1"
                max="30"
                value={brushSize}
                onChange={(e) =>
                  setBrushSize(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="w-32"
              />

              <span className="text-sm font-medium w-8">
                {brushSize}
              </span>

            </div>

            {/* CURRENT TOOL */}

            <div className="ml-auto text-sm text-gray-500">

              Tool:

              <span className="font-medium text-gray-900 capitalize ml-1">
                {tool}
              </span>

            </div>

          </div>

          {/* ================================================= */}
          {/* CANVAS AREA */}
          {/* ================================================= */}

          <div className="flex-1 p-6 bg-[#f1f2f4]">

            <div className="relative w-full h-full bg-white rounded-2xl border shadow-sm overflow-hidden">

              {/* CANVAS */}

              <div
                className="absolute inset-0 origin-center"
                style={{
                  transform:
                    `scale(${zoom / 100})`,
                }}
              >

                <DrawingCanvas
                  ref={canvasRef}
                  color={color}
                  brushSize={
                    brushSize
                  }
                  tool={tool}
                  onHistoryChange={
                    handleHistoryChange
                  }
                  onConnectionChange={
                    handleConnectionChange
                  }
                  onPresenceChange={
                    handlePresenceChange
                  }
                />

              </div>

              {/* ================================================= */}
              {/* CONNECTION STATUS */}
              {/* ================================================= */}

              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">

                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />

                <span className="text-xs text-gray-600">
                  {isConnected
                    ? "Connected"
                    : "Disconnected"}
                </span>

              </div>

              {/* ================================================= */}
              {/* ZOOM CONTROLS */}
              {/* ================================================= */}

              <div className="absolute bottom-4 right-4 flex items-center bg-white border rounded-lg shadow-sm overflow-hidden">

                {/* ZOOM OUT */}

                <button
                  title="Zoom out"
                  onClick={
                    decreaseZoom
                  }
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition"
                >
                  <ZoomOut size={16} />
                </button>

                {/* ZOOM VALUE */}

                <button
                  title="Reset zoom"
                  onClick={
                    resetZoom
                  }
                  className="px-3 h-10 text-sm border-x hover:bg-gray-50 transition"
                >
                  {zoom}%
                </button>

                {/* ZOOM IN */}

                <button
                  title="Zoom in"
                  onClick={
                    increaseZoom
                  }
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition"
                >
                  <ZoomIn size={16} />
                </button>

              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}
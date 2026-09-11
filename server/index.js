const { WebSocketServer } = require("ws");

const PORT =
  Number(process.env.PORT) || 8080;

const wss = new WebSocketServer({
  port: PORT,
  host: "0.0.0.0",
});

// =========================================================
// ROOM STORAGE
// =========================================================

/*
 * Each room stores:
 *
 * {
 *   clients: Set<WebSocket>,
 *   strokes: Stroke[]
 * }
 */
const rooms = new Map();

console.log(
  `WebSocket server running on ws://localhost:${PORT}`
);

// =========================================================
// BROADCAST TO ROOM
// =========================================================

function broadcastToRoom(
  roomId,
  message,
  excludeSocket = null
) {
  const room =
    rooms.get(roomId);

  if (!room) {
    return;
  }

  const data =
    JSON.stringify(message);

  for (
    const client of room.clients
  ) {
    if (
      client !== excludeSocket &&
      client.readyState === 1
    ) {
      client.send(data);
    }
  }
}

// =========================================================
// SEND PRESENCE COUNT
// =========================================================

function broadcastUserCount(
  roomId
) {
  const room =
    rooms.get(roomId);

  if (!room) {
    return;
  }

  console.log(
    `👥 Room "${roomId}" has ${room.clients.size} user(s)`
  );

  broadcastToRoom(
    roomId,
    {
      type: "presence",
      count:
        room.clients.size,
    }
  );
}

// =========================================================
// NEW CONNECTION
// =========================================================

wss.on(
  "connection",
  (socket) => {
    console.log(
      "🔌 Client connected"
    );

    let currentRoom =
      null;

    let currentUserId =
      null;

    // =======================================================
    // MESSAGE
    // =======================================================

    socket.on(
      "message",
      (message) => {
        try {
          const data =
            JSON.parse(
              message.toString()
            );

          // =================================================
          // JOIN ROOM
          // =================================================

          if (
            data.type ===
            "join-room"
          ) {
            const roomId =
              String(
                data.roomId || ""
              ).trim();

            const userId =
              String(
                data.userId || ""
              ).trim();

            if (!roomId) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  message:
                    "Room ID is required",
                })
              );

              return;
            }

            // -----------------------------------------------
            // REMOVE FROM OLD ROOM
            // -----------------------------------------------

            if (
              currentRoom &&
              rooms.has(
                currentRoom
              )
            ) {
              const oldRoom =
                rooms.get(
                  currentRoom
                );

              oldRoom.clients.delete(
                socket
              );

              if (
                oldRoom.clients
                  .size > 0
              ) {
                broadcastUserCount(
                  currentRoom
                );
              }

              if (
                oldRoom.clients
                  .size === 0
              ) {
                rooms.delete(
                  currentRoom
                );
              }
            }

            // -----------------------------------------------
            // CREATE ROOM
            // -----------------------------------------------

            if (
              !rooms.has(roomId)
            ) {
              rooms.set(
                roomId,
                {
                  clients:
                    new Set(),
                  strokes: [],
                }
              );
            }

            const room =
              rooms.get(roomId);

            // -----------------------------------------------
            // SEND EXISTING CANVAS STATE
            // -----------------------------------------------

            /*
             * IMPORTANT:
             *
             * Send the existing strokes to the
             * new user BEFORE adding them to
             * the room's active clients.
             */
            socket.send(
              JSON.stringify({
                type:
                  "canvas-state",
                strokes:
                  room.strokes,
              })
            );

            // -----------------------------------------------
            // ADD USER TO ROOM
            // -----------------------------------------------

            room.clients.add(
              socket
            );

            currentRoom =
              roomId;

            currentUserId =
              userId;

            console.log(
              `✅ User ${userId} joined room ${roomId}`
            );

            console.log(
              `📊 Current room size: ${room.clients.size}`
            );

            console.log(
              `🎨 Existing strokes sent: ${room.strokes.length}`
            );

            // -----------------------------------------------
            // TELL USER THEY JOINED
            // -----------------------------------------------

            socket.send(
              JSON.stringify({
                type:
                  "room-joined",
                roomId,
              })
            );

            // -----------------------------------------------
            // UPDATE PRESENCE
            // -----------------------------------------------

            broadcastUserCount(
              roomId
            );

            return;
          }

          // =================================================
          // DRAW OPERATION
          // =================================================

          if (
            data.type ===
              "draw-operation" &&
            currentRoom
          ) {
            const room =
              rooms.get(
                currentRoom
              );

            if (!room) {
              return;
            }

            const stroke =
              data.stroke;

            if (!stroke) {
              return;
            }

            // -----------------------------------------------
            // STORE STROKE ON SERVER
            // -----------------------------------------------

            const duplicate =
              room.strokes.some(
                (existingStroke) =>
                  existingStroke.id ===
                  stroke.id
              );

            if (!duplicate) {
              room.strokes.push(
                stroke
              );

              console.log(
                `✏️ Stored stroke ${stroke.id} in room ${currentRoom}`
              );
            }

            // -----------------------------------------------
            // SEND TO OTHER USERS
            // -----------------------------------------------

            broadcastToRoom(
              currentRoom,
              {
                type:
                  "draw-operation",
                stroke,
              },
              socket
            );

            return;
          }

          // =================================================
          // CURSOR MOVE
          // =================================================

          if (
            data.type ===
              "cursor-move" &&
            currentRoom
          ) {
            broadcastToRoom(
              currentRoom,
              {
                type:
                  "cursor-move",

                userId:
                  currentUserId,

                x:
                  Number(data.x),

                y:
                  Number(data.y),
              },
              socket
            );

            return;
          }
        } catch (error) {
          console.error(
            "❌ Invalid message:",
            error
          );
        }
      }
    );

    // =======================================================
    // DISCONNECT
    // =======================================================

    socket.on(
      "close",
      () => {
        console.log(
          `🔌 Client disconnected${
            currentUserId
              ? `: ${currentUserId}`
              : ""
          }`
        );

        if (
          currentRoom &&
          rooms.has(
            currentRoom
          )
        ) {
          const room =
            rooms.get(
              currentRoom
            );

          room.clients.delete(
            socket
          );

          console.log(
            `📊 Room ${currentRoom} now has ${room.clients.size} user(s)`
          );

          // -----------------------------------------------
          // UPDATE PRESENCE
          // -----------------------------------------------

          if (
            room.clients.size > 0
          ) {
            broadcastUserCount(
              currentRoom
            );

            // ---------------------------------------------
            // REMOVE CURSOR
            // ---------------------------------------------

            broadcastToRoom(
              currentRoom,
              {
                type:
                  "cursor-remove",
                userId:
                  currentUserId,
              }
            );
          } else {
            // ---------------------------------------------
            // REMOVE EMPTY ROOM
            // ---------------------------------------------

            rooms.delete(
              currentRoom
            );

            console.log(
              `🗑️ Room deleted: ${currentRoom}`
            );
          }
        }
      }
    );

    // =======================================================
    // ERROR
    // =======================================================

    socket.on(
      "error",
      (error) => {
        console.error(
          "❌ WebSocket error:",
          error.message
        );
      }
    );
  }
);
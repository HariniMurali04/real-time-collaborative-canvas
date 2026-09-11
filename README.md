# 🎨 Real-Time Collaborative Canvas

A real-time collaborative drawing application that allows multiple users to work together on the same canvas simultaneously.

Users can create shared rooms, draw together in real time, see other users' cursors, view online participants, and automatically synchronize the existing canvas when joining a room.

## 🚀 Live Demo

**Frontend:**
https://real-time-collaborative-canvas-six.vercel.app

**Source Code:**
https://github.com/HariniMurali04/real-time-collaborative-canvas

---

## ✨ Features

### 🎨 Drawing Tools
- Freehand pen
- Eraser
- Line tool
- Rectangle tool
- Circle / ellipse tool
- Adjustable brush size
- Color picker

### 🤝 Real-Time Collaboration
- Multiple users can draw simultaneously
- Drawing operations are synchronized using WebSockets
- Changes are visible instantly to users in the same room

### 🏠 Collaborative Rooms
- Automatically generates a unique room ID
- Room ID is stored in the URL
- Shareable room links
- Users joining the same URL enter the same collaborative session
- Users in different rooms remain isolated from each other

### 👥 Presence
- Displays the number of users currently connected to a room
- Presence updates automatically when users join or leave

### 🖱️ Live Cursors
- Other users' cursor positions are synchronized in real time
- Each remote cursor is displayed with a unique user identifier

### 🔄 Canvas State Synchronization
- Existing drawings are stored in the active room on the server
- New users joining an existing room receive the current canvas state
- The canvas is reconstructed from the stored drawing operations

### ↩️ Editing Controls
- Undo
- Redo
- Download canvas as PNG

### 🔍 Zoom
- Zoom in
- Zoom out
- Reset zoom

### 🔌 Connection Status
- Displays whether the WebSocket connection is connected or disconnected

---

## 🏗️ Architecture

```text
                         GitHub
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
          Vercel                     Render
       Next.js Frontend          WebSocket Server
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                 Real-Time Collaboration
```

### Frontend

The frontend is built using:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Lucide React

The frontend handles:

- Canvas rendering
- Drawing interactions
- Tool selection
- Room management
- Cursor rendering
- Presence display
- WebSocket communication
- Canvas state reconstruction

### Backend

The backend uses:

- Node.js
- WebSocket (`ws`)

The server is responsible for:

- Managing collaborative rooms
- Tracking connected clients
- Broadcasting drawing operations
- Broadcasting cursor movements
- Broadcasting presence information
- Maintaining the current drawing state of each active room

---

## 🧠 How It Works

### 1. User Opens the Application

When a user opens the application without a room ID, the client generates a random room identifier.

Example:

```text
https://real-time-collaborative-canvas-six.vercel.app/?room=abc123
```

### 2. Client Connects to WebSocket Server

The frontend creates a WebSocket connection to the deployed backend.

```text
Browser
   │
   │ WebSocket
   ▼
Render WebSocket Server
```

### 3. User Joins a Room

The client sends:

```json
{
  "type": "join-room",
  "roomId": "abc123",
  "userId": "user-xxxx"
}
```

The server adds the connection to the corresponding room.

### 4. Drawing Operation

When a user completes a drawing operation, the client sends a message such as:

```json
{
  "type": "draw-operation",
  "roomId": "abc123",
  "stroke": {
    "id": "unique-id",
    "type": "line",
    "points": [
      {
        "x": 100,
        "y": 120
      },
      {
        "x": 250,
        "y": 200
      }
    ],
    "color": "#000000",
    "width": 4,
    "userId": "user-xxxx"
  }
}
```

The server broadcasts the operation to other users in the same room.

### 5. Live Cursor Synchronization

Cursor positions are sent through WebSockets:

```json
{
  "type": "cursor-move",
  "roomId": "abc123",
  "x": 400,
  "y": 250
}
```

Other clients render the remote cursor at that position.

### 6. Canvas State Synchronization

When a new user joins a room, the server sends the drawing operations already stored for that room.

```json
{
  "type": "canvas-state",
  "strokes": []
}
```

The client rebuilds the canvas from these stored strokes.

---

## 📁 Project Structure

```text
real-time-collaborative-canvas/
│
├── app/
│   ├── page.tsx
│   └── ...
│
├── components/
│   └── DrawingCanvas.tsx
│
├── server/
│   └── index.js
│
├── public/
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

| Technology       | Purpose                        |
| ---------------- | ------------------------------ |
| Next.js          | Frontend framework             |
| React            | UI and application state       |
| TypeScript       | Type-safe frontend development |
| Tailwind CSS     | UI styling                     |
| HTML Canvas API  | Drawing and rendering          |
| Node.js          | Backend runtime                |
| WebSocket (`ws`) | Real-time communication        |
| Vercel           | Frontend deployment            |
| Render           | WebSocket backend deployment   |
| GitHub           | Version control                |

---

## 💻 Local Development

### Prerequisites

Make sure you have:

- Node.js installed
- npm installed
- Git installed

### Clone the repository

```bash
git clone https://github.com/HariniMurali04/real-time-collaborative-canvas.git
```

Move into the project:

```bash
cd real-time-collaborative-canvas
```

### Install dependencies

```bash
npm install
```

---

## ▶️ Run the Frontend

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

## ▶️ Run the WebSocket Server

Open another terminal and run:

```bash
node server/index.js
```

The WebSocket server will run on:

```text
ws://localhost:8080
```

---

## 🔐 Environment Variables

For production, the frontend uses:

```text
NEXT_PUBLIC_WEBSOCKET_URL
```

Example:

```text
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-server.onrender.com
```

For local development, the application falls back to:

```text
ws://localhost:8080
```

---

## 🧪 Testing Collaboration

To test real-time collaboration locally:

### Browser 1

Open:

```text
http://localhost:3000
```

A room URL will automatically be generated.

Example:

```text
http://localhost:3000/?room=abc123
```

### Browser 2

Open the exact same room URL in another browser or Incognito window:

```text
http://localhost:3000/?room=abc123
```

Both users should be able to:

- Draw on the same canvas
- See each other's cursors
- See the live user count
- Receive existing canvas content

---

## 🌐 Production Deployment

### Frontend

The Next.js frontend is deployed using **Vercel**.

Live URL:

```text
https://real-time-collaborative-canvas-six.vercel.app
```

### WebSocket Server

The WebSocket backend is deployed using **Render**.

The frontend connects through:

```text
wss://real-time-collaborative-canvas-0y70.onrender.com
```

---

## 🎯 Design Goals

The application was designed around the following principles:

- Low-latency collaboration
- Simple room-based communication
- Clear separation between drawing and collaboration logic
- Lightweight real-time messaging
- Responsive and intuitive interface
- Shareable collaboration sessions
- Canvas state reconstruction for newly joined users

---

## 🔮 Future Improvements

Potential future improvements include:

- Persistent database storage using PostgreSQL
- Prisma ORM
- Persistent room history
- Synchronized undo/redo across users
- User authentication
- Named user profiles
- Dynamic user avatars
- Drawing operation validation
- WebSocket message rate limiting
- Better reconnect and offline handling
- Redis-based distributed room state
- Automated unit and integration testing
- Docker-based deployment
- CI/CD with GitHub Actions

---

## 👩‍💻 Author

**Harini PM**

Integrated M.Tech Software Engineering
VIT Vellore

GitHub:
[https://github.com/HariniMurali04](https://github.com/HariniMurali04)

---

## 📄 License

This project is developed as a technical assignment/project for demonstrating real-time collaborative application development.

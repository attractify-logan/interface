# Interface

## Pre Release WIP

A multi-gateway chat application for OpenClaw AI agents with federated conversations and real-time collaboration.

![Interface Main View](screenshots/main-view.jpg)

## Overview

Interface is a full-stack chat application that connects to multiple OpenClaw gateway instances simultaneously, enabling seamless conversations across distributed AI agents. Built with a terminal-inspired dark UI and real-time WebSocket communication.

## Features

### Multi-Gateway Support
🌐 **Multiple Gateways** — Connect to multiple OpenClaw instances at once
🎨 **Color Coding** — Each gateway and its agents use distinct colors
🔄 **Auto-Reconnect** — Automatic reconnection with visual status indicators
📡 **Network Scanning** — Auto-discover OpenClaw gateways on your network

### Advanced Chat
💬 **Federated Chat** — Talk to agents across different gateways in one conversation
🤖 **Multi-Agent** — Spawn and manage multiple agents with visual hierarchy
🔔 **Push Notifications** — Per-agent browser notifications for responses
📊 **Model Selection** — Choose AI models (Opus, Sonnet, Haiku) per agent

### User Experience
⚡ **Command Palette** — Quick actions with `Cmd+K`
🎯 **FAB Menu** — Floating action button for spawning agents
🌳 **Subagent Nesting** — Visual tree hierarchy with connector lines
💚 **Activity Indicators** — Pulsing dots show active agent processing
🎨 **Multiple Themes** — Dark, light, and terminal green themes

### Technical
💾 **SQLite Persistence** — Messages, sessions, and gateways stored locally
🔒 **Secure Tokens** — Server-side token storage (never exposed to browser)
⚡ **WebSocket Heartbeat** — Connection stability monitoring
📦 **Complete API** — RESTful endpoints for all operations



## Quick Start

### Prerequisites
- Python 3.13+
- Node.js 18+
- Modern browser with WebSocket support

### Backend Setup

```bash
cd backend/

# First-time setup
./setup.sh

# Start server
./run.sh

# Server runs on http://localhost:8000
# API docs: http://localhost:8000/docs
```

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# App runs on http://localhost:5173
```

### Production Build

```bash
# Build frontend
npm run build

# Backend serves the built frontend automatically
cd backend/
./run.sh
```

## Architecture

```
┌─────────────────────────┐
│   React Frontend        │
│   (Vite + TypeScript)   │
└───────────┬─────────────┘
            │ WebSocket
┌───────────▼─────────────┐
│   FastAPI Backend       │
│   (Python + SQLite)     │
└───────────┬─────────────┘
            │ WebSocket (persistent)
┌───────────▼─────────────┐
│   OpenClaw Gateway(s)   │
│   Multiple Instances    │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   AI Agents + Models    │
│   (Opus, Sonnet, Haiku) │
└─────────────────────────┘
```

**Key Design Decisions:**

- **Server-Side Gateway Management:** Persistent WebSocket connections reduce handshake overhead and keep tokens secure
- **SQLite Persistence:** Instant message history loading without external database dependencies
- **Federated Architecture:** Each gateway maintains independence while enabling cross-gateway conversations
- **Real-Time First:** WebSocket-based communication for sub-second response times

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript 5
- **Build Tool:** Vite 6
- **Styling:** TailwindCSS 4
- **State Management:** Zustand
- **Icons:** Lucide React
- **Real-time:** WebSocket API

### Backend
- **Framework:** FastAPI 0.115.0
- **Language:** Python 3.13
- **Database:** SQLite 3
- **WebSockets:** websockets 13.1
- **Server:** uvicorn (ASGI)

### Communication
- **Protocol:** WebSocket (client ↔ server ↔ gateways)
- **Format:** JSON messages
- **Authentication:** Token-based (server-managed)

## Documentation

Comprehensive documentation in `backend/`:

- **[ARCHITECTURE.md](backend/ARCHITECTURE.md)** — System design and component interactions
- **[API.md](backend/API.md)** — Complete REST and WebSocket API reference
- **[DEPLOYMENT.md](backend/DEPLOYMENT.md)** — Production deployment guide
- **[CHANGELOG.md](backend/CHANGELOG.md)** — Version history and updates

## Configuration

### Backend Environment

Create `backend/.env`:

```env
# Server
HOST=0.0.0.0
PORT=8000
RELOAD=true

# Database
DATABASE_PATH=data/openclaw.db

# Gateway Defaults
DEFAULT_GATEWAY_URL=ws://localhost:18789
```

### Frontend Environment

Create `.env.local`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Development

### Running Tests

```bash
# Backend tests
cd backend/
source venv/bin/activate
python -m pytest

# Frontend tests
npm run test
```

### Testing Gateway Connection

```bash
cd backend/
source venv/bin/activate
python test_gateway.py ws://your-gateway:18789 your-token
```

## Project Structure

```
interface/
├── backend/              # FastAPI backend
│   ├── main.py          # Application entry point
│   ├── gateway_manager.py
│   ├── routes/          # API endpoints
│   ├── data/            # SQLite database
│   └── venv/            # Python environment
│
├── src/                 # React frontend
│   ├── components/      # UI components
│   ├── stores/          # Zustand state
│   ├── types/           # TypeScript types
│   └── App.tsx          # Main application
│
├── public/              # Static assets
└── screenshots/         # Application screenshots
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built for seamless multi-gateway AI agent collaboration**

## 🤡 Tribute

The clown emoji is a heartfelt fan tribute to the YouTube series **"u m a m i"** and the character **Mischief**. I'm a huge fan of the series, some of the best music and art I've ever seen. This project has **no official affiliation, endorsement, or sponsorship** from the u m a m i series or its creators — this is purely one fan's appreciation for the inspiration. You should go check it out if you haven't already

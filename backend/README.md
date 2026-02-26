# OpenClaw Chat Backend

FastAPI backend for OpenClaw chat application with persistent WebSocket connections to gateways.

## Features

- 🔐 **Secure token storage** - Tokens stay server-side, never exposed to browser
- 💾 **Message persistence** - SQLite database for chat history
- 🔌 **WebSocket proxy** - Maintains persistent connections to OpenClaw gateways
- 🔄 **Auto-reconnect** - Exponential backoff reconnection on connection loss
- 🧹 **Thinking tag stripping** - Automatically removes `<think>`, `<thinking>`, `<antthinking>` tags
- 📊 **Session management** - Track conversations across multiple gateways

## Quick Start

1. **Run setup (first time only):**
   ```bash
   ./setup.sh
   ```
   
   This creates a Python 3.13 virtual environment and installs dependencies.

2. **Configure environment (optional):**
   Edit `.env` file if needed (defaults work for local development)

3. **Start the server:**
   ```bash
   ./run.sh
   ```

4. **Server runs on:** http://localhost:8000
   - API docs: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

## Testing

Test gateway connection:
```bash
source venv/bin/activate
python test_gateway.py ws://your-gateway:18789 your-token
```

## API Endpoints

### Gateways
- `GET /api/gateways` - List all gateways (tokens omitted)
- `POST /api/gateways` - Add new gateway
- `DELETE /api/gateways/{id}` - Remove gateway
- `GET /api/gateways/{id}/status` - Connection status + agents + models

### Sessions
- `GET /api/gateways/{gw_id}/sessions` - List sessions
- `POST /api/gateways/{gw_id}/sessions` - Create session
- `GET /api/gateways/{gw_id}/sessions/{key}` - Get session info
- `DELETE /api/gateways/{gw_id}/sessions/{key}` - Delete session

### Messages
- `GET /api/gateways/{gw_id}/sessions/{key}/messages?limit=50&before=ID` - Get messages

### WebSocket
- `WS /ws/chat/{gw_id}` - Chat WebSocket endpoint

## WebSocket Protocol

**Browser → Backend:**
```json
{"type": "chat", "sessionKey": "webchat-123", "message": "hello"}
{"type": "abort", "sessionKey": "webchat-123"}
{"type": "history", "sessionKey": "webchat-123", "limit": 50}
```

**Backend → Browser:**
```json
{"type": "stream", "state": "delta", "text": "partial..."}
{"type": "stream", "state": "final", "text": "complete response"}
{"type": "stream", "state": "error", "error": "message"}
{"type": "connected", "agents": [...], "models": [...], "defaultModel": "..."}
{"type": "history", "messages": [...]}
```

## Database Schema

- **gateways** - Gateway configurations (tokens stored here)
- **sessions** - Chat sessions per gateway
- **messages** - Message history with JSON content

Database auto-initializes on first run at `data/chat.db`.

## Configuration

Edit `.env`:
```
DATABASE_URL=sqlite:///./data/chat.db
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Architecture

- **gateway_manager.py** - Manages persistent WebSocket connections to gateways
- **routes/** - API endpoint handlers
- **database.py** - SQLite setup and migrations
- **models.py** - Pydantic models for validation
- **config.py** - Settings management

## Security Notes

- Tokens are NEVER exposed in API responses
- Only stored server-side in SQLite database
- Gateway list endpoint returns `id`, `name`, `url`, `connected` only
- CORS restricted to configured origins

# Architecture Overview

## Component Structure

```
┌─────────────────┐
│  React Frontend │
│   (Browser)     │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│  FastAPI        │
│  Backend        │
│  (This code)    │
└────────┬────────┘
         │
    ┌────┴────┬─────────────────┐
    ▼         ▼                 ▼
┌────────┐ ┌──────────┐  ┌────────────┐
│ SQLite │ │ Gateway  │  │ Gateway 2  │
│  DB    │ │ Manager  │  │ Manager..  │
└────────┘ └─────┬────┘  └─────┬──────┘
                 │              │
           WebSocket      WebSocket
                 ▼              ▼
         ┌────────────┐  ┌────────────┐
         │ OpenClaw   │  │ OpenClaw   │
         │ Gateway 1  │  │ Gateway 2  │
         └────────────┘  └────────────┘
```

## Data Flow

### Chat Message Flow
1. User types message in React frontend
2. Frontend sends `{"type":"chat", "sessionKey":"...", "message":"..."}` via WebSocket to backend
3. Backend:
   - Saves user message to SQLite
   - Forwards to OpenClaw gateway via persistent WebSocket
   - Streams responses back to frontend
   - Saves final assistant response (with thinking tags stripped) to SQLite

### Connection Management
- **Persistent Connections:** Backend maintains WebSocket connections to all configured gateways
- **Auto-Reconnect:** Exponential backoff (1s → 2s → 4s → ... → 60s max)
- **Handshake:** Full OpenClaw protocol handshake on connect
- **Metadata Caching:** Agents, models, and default model cached in memory

### Message Persistence
- **Immediate Save:** User messages saved before sending to gateway
- **Strip Thinking:** Assistant responses have `<think>`, `<thinking>`, `<antthinking>` tags removed
- **Fast History:** Messages served from SQLite (instant), optional gateway sync

## Gateway Manager

The `GatewayManager` class manages multiple `GatewayConnection` instances:

```python
# One connection per gateway
connections: Dict[gateway_id → GatewayConnection]

# Each connection maintains:
- WebSocket client
- Request/response matching (req_id → Future)
- Event handlers (event_type → callback)
- Auto-reconnect loop
- Metadata cache (agents, models)
```

### OpenClaw Protocol

**Handshake:**
1. Connect WebSocket
2. Wait for `connect.challenge` event
3. Send `connect` request with token/auth
4. Receive `connect` response with protocol version + snapshot

**Chat:**
1. Send `chat.send` request with sessionKey + message
2. Receive stream of `chat` events:
   - `state: "delta"` - partial response
   - `state: "final"` - complete response
   - `state: "error"` - error occurred

**Other Operations:**
- `chat.history` - fetch message history
- `chat.abort` - stop generation
- `agents.list` - get available agents
- `models.list` - get available models
- `sessions.list` - list recent sessions

## Database Schema

**gateways** - Gateway configurations
- `id` - unique gateway identifier
- `name` - display name
- `url` - WebSocket URL (ws://... or wss://...)
- `token` - auth token (NEVER exposed in API responses)
- `password` - optional password

**sessions** - Chat sessions
- `id` - auto-increment primary key
- `gateway_id` - which gateway this session belongs to
- `session_key` - unique session identifier (e.g. "webchat-123")
- `title` - optional display title
- `agent_id` - which agent is handling this session
- `model` - which model is being used
- `last_activity` - updated on every message

**messages** - Message history
- `id` - auto-increment primary key
- `session_id` - foreign key to sessions
- `role` - "user", "assistant", or "system"
- `content` - JSON array of content blocks
- `timestamp` - Unix timestamp from gateway
- Indexed on `(session_id, created_at)` for fast history queries

## Security

- **Token Storage:** Tokens stored in SQLite, never exposed via API
- **CORS:** Restricted to configured origins (localhost:3000, localhost:5173 by default)
- **No Public Tokens:** Gateway list endpoint returns `{id, name, url, connected}` only
- **Server-Side Proxy:** Browser never connects directly to gateways

## Performance

- **Persistent Connections:** No handshake overhead per request
- **Message Batching:** Multiple requests can be in-flight simultaneously
- **Database Indexing:** Messages indexed on session_id for fast history retrieval
- **Async Throughout:** All I/O is async (FastAPI, aiosqlite, websockets)

## Error Handling

- **Connection Loss:** Auto-reconnect with exponential backoff
- **Request Timeout:** 30 second timeout per request
- **Failed Requests:** Return error to frontend, don't crash
- **Database Errors:** Rollback on failure, return 400 error

## Extensibility

Easy to add:
- **Authentication:** Add auth middleware to FastAPI
- **Multi-user:** Add `user_id` column to gateways/sessions
- **Search:** Full-text search on messages table
- **Export:** CSV/JSON export endpoints
- **Analytics:** Track message counts, response times
- **Rate Limiting:** Add rate limiter middleware
- **Webhook Support:** Notify external services on events

# API Documentation

Base URL: `http://localhost:8000`

## Gateway Management

### List Gateways
```http
GET /api/gateways
```

**Response:**
```json
[
  {
    "id": "local-gateway",
    "name": "Local OpenClaw",
    "url": "ws://localhost:18789",
    "connected": true,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

**Note:** Token and password are NEVER returned in responses.

---

### Add Gateway
```http
POST /api/gateways
Content-Type: application/json
```

**Body:**
```json
{
  "id": "local-gateway",
  "name": "Local OpenClaw",
  "url": "ws://localhost:18789",
  "token": "your-token-here",
  "password": null
}
```

**Response:**
```json
{
  "id": "local-gateway",
  "name": "Local OpenClaw",
  "url": "ws://localhost:18789",
  "connected": true,
  "created_at": "2024-01-01T00:00:00"
}
```

---

### Delete Gateway
```http
DELETE /api/gateways/{gateway_id}
```

**Response:**
```json
{"ok": true}
```

---

### Get Gateway Status
```http
GET /api/gateways/{gateway_id}/status
```

**Response:**
```json
{
  "id": "local-gateway",
  "connected": true,
  "agents": [
    {"id": "main", "name": "Main Agent", ...}
  ],
  "models": [
    {"id": "opus", "name": "Claude Opus", ...}
  ],
  "default_model": "opus"
}
```

## Session Management

### List Sessions
```http
GET /api/gateways/{gateway_id}/sessions
```

**Response:**
```json
[
  {
    "id": 1,
    "gateway_id": "local-gateway",
    "session_key": "webchat-123",
    "title": "My Chat",
    "agent_id": "main",
    "model": "opus",
    "created_at": "2024-01-01T00:00:00",
    "last_activity": "2024-01-01T00:05:00"
  }
]
```

---

### Create Session
```http
POST /api/gateways/{gateway_id}/sessions
Content-Type: application/json
```

**Body:**
```json
{
  "session_key": "webchat-456",
  "title": "New Chat",
  "agent_id": "main",
  "model": "sonnet"
}
```

**Response:** Same as session object above.

---

### Get Session
```http
GET /api/gateways/{gateway_id}/sessions/{session_key}
```

**Response:** Session object.

---

### Delete Session
```http
DELETE /api/gateways/{gateway_id}/sessions/{session_key}
```

**Response:**
```json
{"ok": true}
```

**Note:** Also deletes all messages in this session.

## Message History

### Get Messages
```http
GET /api/gateways/{gateway_id}/sessions/{session_key}/messages?limit=50&before=123
```

**Query Parameters:**
- `limit` (optional, default 50, max 500) - Number of messages to fetch
- `before` (optional) - Fetch messages before this message ID (for pagination)

**Response:**
```json
[
  {
    "id": 1,
    "session_id": 1,
    "role": "user",
    "content": "[{\"type\":\"text\",\"text\":\"Hello\"}]",
    "timestamp": 1704067200,
    "created_at": "2024-01-01T00:00:00"
  },
  {
    "id": 2,
    "session_id": 1,
    "role": "assistant",
    "content": "[{\"type\":\"text\",\"text\":\"Hi there!\"}]",
    "timestamp": 1704067205,
    "created_at": "2024-01-01T00:00:05"
  }
]
```

**Note:** Messages are returned in chronological order (oldest first).

## WebSocket Chat

### Connect
```
WS /ws/chat/{gateway_id}
```

### Browser → Backend Messages

**Send Chat Message:**
```json
{
  "type": "chat",
  "sessionKey": "webchat-123",
  "message": "What is 2+2?"
}
```

**Abort Generation:**
```json
{
  "type": "abort",
  "sessionKey": "webchat-123"
}
```

**Fetch History:**
```json
{
  "type": "history",
  "sessionKey": "webchat-123",
  "limit": 50
}
```

### Backend → Browser Messages

**Connection Established:**
```json
{
  "type": "connected",
  "agents": [...],
  "models": [...],
  "defaultModel": "opus"
}
```

**Streaming Response (Delta):**
```json
{
  "type": "stream",
  "state": "delta",
  "text": "The answer is"
}
```

**Final Response:**
```json
{
  "type": "stream",
  "state": "final",
  "text": "The answer is 4."
}
```

**Note:** Thinking tags are stripped from final responses.

**Error:**
```json
{
  "type": "stream",
  "state": "error",
  "error": "Gateway disconnected"
}
```

**History Response:**
```json
{
  "type": "history",
  "messages": [
    {
      "role": "user",
      "content": [{"type": "text", "text": "Hello"}],
      "timestamp": 1704067200
    },
    {
      "role": "assistant",
      "content": [{"type": "text", "text": "Hi there!"}],
      "timestamp": 1704067205
    }
  ]
}
```

## Health Check

### Server Health
```http
GET /health
```

**Response:**
```json
{"status": "ok"}
```

---

### Root Info
```http
GET /
```

**Response:**
```json
{
  "name": "OpenClaw Chat Backend",
  "version": "1.0.0",
  "status": "running"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message here"
}
```

HTTP status codes:
- `400` - Bad request (validation error, duplicate gateway, etc.)
- `404` - Not found (gateway/session doesn't exist)
- `500` - Internal server error

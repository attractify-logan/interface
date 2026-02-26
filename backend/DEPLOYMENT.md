# Deployment Guide

## Production Deployment

### 1. Environment Setup

**Install dependencies:**
```bash
./setup.sh
```

**Configure `.env` for production:**
```bash
DATABASE_URL=sqlite:///./data/chat.db
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 2. Database

The SQLite database is created automatically on first run at `data/chat.db`.

**Backup strategy:**
```bash
# Daily backup
cp data/chat.db backups/chat-$(date +%Y%m%d).db

# Or use SQLite backup command
sqlite3 data/chat.db ".backup backups/chat-$(date +%Y%m%d).db"
```

### 3. Run with systemd (Linux)

**Create `/etc/systemd/system/openclaw-chat.service`:**
```ini
[Unit]
Description=OpenClaw Chat Backend
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/openclaw-chat/backend
ExecStart=/path/to/openclaw-chat/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable openclaw-chat
sudo systemctl start openclaw-chat
sudo systemctl status openclaw-chat
```

### 4. Reverse Proxy (nginx)

**Example nginx config:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 6. Monitoring

**Check logs:**
```bash
sudo journalctl -u openclaw-chat -f
```

**Health check:**
```bash
curl http://localhost:8000/health
```

**Gateway status:**
```bash
curl http://localhost:8000/api/gateways
```

## Docker Deployment (Alternative)

**Create `Dockerfile`:**
```dockerfile
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Create `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
```

**Run:**
```bash
docker-compose up -d
```

## Security Checklist

- [ ] Change default CORS origins in `.env`
- [ ] Use HTTPS in production (reverse proxy + Let's Encrypt)
- [ ] Restrict database file permissions: `chmod 600 data/chat.db`
- [ ] Consider adding authentication middleware
- [ ] Set up regular database backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated: `pip install --upgrade -r requirements.txt`

## Scaling Considerations

**Current limitations (SQLite):**
- Single server deployment
- ~100 concurrent WebSocket connections comfortable
- ~1000 messages/second throughput

**If you need more:**
- Switch to PostgreSQL (change `database.py`)
- Use Redis for session state
- Load balance multiple backend instances
- Consider separating WebSocket servers from API servers

## Maintenance

**Update dependencies:**
```bash
source venv/bin/activate
pip install --upgrade -r requirements.txt
sudo systemctl restart openclaw-chat
```

**Database migration (if schema changes):**
```bash
# Backup first!
cp data/chat.db data/chat.db.backup

# Run migration script
python migrate_database.py
```

**Clean old sessions:**
```sql
-- Delete sessions inactive for 30+ days
DELETE FROM sessions 
WHERE last_activity < datetime('now', '-30 days');

-- Delete orphaned messages
DELETE FROM messages 
WHERE session_id NOT IN (SELECT id FROM sessions);

-- Vacuum to reclaim space
VACUUM;
```

## Troubleshooting

**Backend won't start:**
- Check Python version: `python --version` (need 3.11+)
- Check logs: `journalctl -u openclaw-chat -n 50`
- Verify .env file exists and is readable

**Gateway won't connect:**
- Check gateway URL is reachable
- Verify token is correct
- Check gateway logs
- Test with `python test_gateway.py ws://... token`

**WebSocket disconnects:**
- Check reverse proxy WebSocket support
- Verify CORS settings
- Look for network/firewall issues

**Database locked:**
- SQLite doesn't handle concurrent writes well
- Consider PostgreSQL for high-concurrency scenarios
- Ensure only one backend instance is running

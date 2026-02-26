import aiosqlite
import os
from pathlib import Path
from config import settings


def get_db_path() -> str:
    """Extract the actual file path from DATABASE_URL"""
    url = settings.database_url
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "")
        # Handle relative paths
        if path.startswith("./"):
            path = path[2:]
        return path
    return "data/chat.db"


async def get_db():
    """Get database connection"""
    db_path = get_db_path()
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """Initialize database schema"""
    db_path = get_db_path()
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    db = await aiosqlite.connect(db_path)
    
    try:
        # Create gateways table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS gateways (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                token TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create sessions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gateway_id TEXT NOT NULL REFERENCES gateways(id),
                session_key TEXT NOT NULL,
                title TEXT,
                agent_id TEXT,
                model TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(gateway_id, session_key)
            )
        """)
        
        # Create messages table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL REFERENCES sessions(id),
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create index
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session
            ON messages(session_id, created_at)
        """)

        # Create federated_sessions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS federated_sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create federated_session_gateways junction table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS federated_session_gateways (
                federated_session_id TEXT NOT NULL REFERENCES federated_sessions(id),
                gateway_id TEXT NOT NULL REFERENCES gateways(id),
                session_key TEXT NOT NULL,
                PRIMARY KEY (federated_session_id, gateway_id)
            )
        """)

        await db.commit()
        print("✅ Database initialized successfully")
        
    finally:
        await db.close()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db, get_db
from gateway_manager import gateway_manager
from config import settings
from routes import gateways, sessions, messages, ws, federated


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown"""
    # Startup
    print("🚀 Starting OpenClaw Chat Backend...")
    
    # Initialize database
    await init_db()
    
    # Load and connect to existing gateways
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id, url, token, password FROM gateways")
        rows = await cursor.fetchall()
        
        for row in rows:
            await gateway_manager.add_gateway(
                row["id"],
                row["url"],
                row["token"],
                row["password"]
            )
    finally:
        await db.close()
    
    print("✅ Backend ready")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down...")
    await gateway_manager.stop_all()
    print("✅ Shutdown complete")


app = FastAPI(
    title="OpenClaw Chat Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(gateways.router)
app.include_router(sessions.router)
app.include_router(messages.router)
app.include_router(federated.router)
app.include_router(ws.router)


@app.get("/")
async def root():
    return {
        "name": "OpenClaw Chat Backend",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "ok"}

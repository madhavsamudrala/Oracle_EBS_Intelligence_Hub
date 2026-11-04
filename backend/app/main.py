"""
backend/app/main.py
Oracle EBS Intelligence Hub v6.0 — FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import chat, sql_advisor, academy, intelligence, health
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(
    title=settings.app_name,
    description="ICA Context Studio integration backend for Oracle EBS Intelligence Hub v6.0",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router)
app.include_router(chat.router,        prefix="/api")
app.include_router(sql_advisor.router, prefix="/api")
app.include_router(academy.router,     prefix="/api")
app.include_router(intelligence.router,prefix="/api")
@app.on_event("startup")
async def startup_event():
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(f"  {settings.app_name} v{settings.app_version}")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(f"  ICA Workflow : {'✅ Configured' if settings.ica_configured else '❌ Not configured'}")
    logger.info(f"  MCP Gateway  : {'✅ Configured' if settings.mcp_configured else '❌ Not configured'}")
    logger.info(f"  Context ID   : {settings.ica_context_id}")
    logger.info(f"  Debug Mode   : {settings.debug}")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
@app.get("/")
async def root():
    return {
        "app":            settings.app_name,
        "version":        settings.app_version,
        "ica_configured": settings.ica_configured,
        "mcp_configured": settings.mcp_configured,
        "context_id":     settings.ica_context_id,
        "docs":           "/docs"
    }
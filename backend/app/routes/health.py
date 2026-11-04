"""
backend/app/routes/health.py
Health check endpoint — used by ebs-ica-integration.js on load.
"""
from fastapi import APIRouter
from datetime import datetime, timezone
from app.config import settings
router = APIRouter()
@router.get("/health")
@router.post("/health")
async def health_check():
    return {
        "status":          "ok",
        "version":         settings.app_version,
        "service":         settings.app_name,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "ica_configured":  settings.ica_configured,
        "mcp_configured":  settings.mcp_configured,
        "context_id":      settings.ica_context_id,
        "debug":           settings.debug
    }
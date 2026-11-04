"""
backend/app/routes/academy.py
Academy context enrichment endpoint.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ica_workflow_service import ICAWorkflowService

router  = APIRouter()
service = ICAWorkflowService()

class AcademyRequest(BaseModel):
    module_id: str
    topic_id:  str = ""

@router.post("/academy")
async def get_academy_context(req: AcademyRequest):
    tables = service.get_module_tables(req.module_id)
    rules  = service.get_module_rules(req.module_id)
    return {
        "source":    "backend",
        "module_id": req.module_id,
        "topic_id":  req.topic_id,
        "tables":    tables,
        "rules":     rules,
        "context":   f"ICA context for {req.module_id} / {req.topic_id} — {len(tables)} tables, {len(rules)} rules.",
    }

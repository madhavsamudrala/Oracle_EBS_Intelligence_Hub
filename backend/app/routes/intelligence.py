"""
backend/app/routes/intelligence.py
Intelligence panel data endpoint.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ica_workflow_service import ICAWorkflowService

router  = APIRouter()
service = ICAWorkflowService()

class IntelRequest(BaseModel):
    module:  str = "AP"
    context: dict = {}

@router.post("/intelligence")
async def get_intelligence(req: IntelRequest):
    module  = req.module
    tables  = service.get_module_tables(module)
    reports = service.get_module_reports(module)
    rules   = service.get_module_rules(module)
    return {
        "source":     "backend",
        "module":     module,
        "topTables":  tables[:5],
        "topReports": reports[:5],
        "metrics": {
            "tables":      len(tables),
            "reports":     len(reports),
            "rules":       len(rules),
            "sqlPatterns": 8,
        },
        "riceCount": service.get_rice_counts(module),
    }

"""
backend/app/routes/sql_advisor.py
SQL compliance check endpoint.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.compliance_checker import ComplianceChecker

router  = APIRouter()
checker = ComplianceChecker()

class SQLRequest(BaseModel):
    sql: str

@router.post("/sql_advisor")
async def check_sql(req: SQLRequest):
    return checker.check(req.sql)

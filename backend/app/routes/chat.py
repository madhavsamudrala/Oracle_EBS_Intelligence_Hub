"""
backend/app/routes/chat.py
Chat endpoints for Oracle EBS Intelligence Hub v6.0
"""
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
import httpx
from app.config import settings
from app.services.ica_reply import classify_reply, redact_secrets
router = APIRouter()
logger = logging.getLogger(__name__)
ICA_WORKFLOW_URL = settings.ica_workflow_url
ICA_API_KEY = settings.ica_api_key
MCP_API_KEY = settings.mcp_api_key
ICA_CONTEXT_ID = settings.ica_context_id
REQUEST_TIMEOUT = settings.request_timeout
MAX_RETRIES = settings.max_retries
# Phase 0: seconds to wait before the single retry of an "unreachable" reply.
UNREACHABLE_RETRY_DELAY = 1.5
EBS_KNOWLEDGE = """
ORACLE EBS R12 REPORTS CATALOG:
AP MODULE REPORTS:
- Invoice Register (RPT-AP-001) - All AP invoices with status
- Payment Register (RPT-AP-002) - All payments made to suppliers
- Aged Payables Detail (RPT-AP-003) - Outstanding invoices by aging bucket
- AP Trial Balance (RPT-AP-004) - Vendor liability balances
- Withholding Tax Report (RPT-AP-005) - Tax deductions by supplier
- Supplier High Payments (RPT-AP-006) - Top vendors by payment amount
AR MODULE REPORTS:
- AR Aging Report (RPT-AR-001) - Customer outstanding balances
- Customer Statement (RPT-AR-002) - Account statement by customer
GL MODULE REPORTS:
- GL Journal Entries (RPT-GL-001) - Posted journal detail
- GL Trial Balance (RPT-GL-002) - Account balances by period
- Account Analysis (RPT-GL-003) - Transaction detail by account
PO MODULE REPORTS:
- PO Detail Report (RPT-PO-001) - Purchase order lines and status
- PO Distributions (RPT-PO-002) - Accounting distributions
- Receipt Adjustments (RPT-PO-003) - Receipt corrections
- Savings Analysis (RPT-PO-004) - Procurement savings by buyer
HRMS MODULE REPORTS:
- Active Employees (RPT-HR-001) - Current headcount with details
- Terminated Employees (RPT-HR-002) - Leavers in period
- Supervisor Details (RPT-HR-003) - Org hierarchy report
- Cost Allocation (RPT-HR-004) - Expense account mapping
iExpense MODULE REPORTS:
- iExpense Detail (RPT-EXP-001) - Expense report submissions
- Credit Card Report (RPT-EXP-002) - Corporate card transactions
- Workflow Approvals (RPT-EXP-003) - Approval cycle times
INV MODULE REPORTS:
- Inventory Valuation (RPT-INV-001) - Stock value by item
SQL COMPLIANCE RULES:
- RULE_001: ORG_ID required on all _ALL tables
- RULE_002: DateTrack filter required on HR _F tables
- RULE_003: PRIMARY_FLAG=Y required on assignments
- RULE_004: Exclude cancelled invoices (cancelled_date IS NULL)
- RULE_005: Exclude void cheques (status != VOIDED)
- RULE_006: SUMMARY_FLAG=N on GL_CODE_COMBINATIONS
- RULE_007: SOURCE filter on iExpense tables
"""
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[str] = "general"
class ChatResponse(BaseModel):
    success: bool
    message: str
    source: str
    session_id: Optional[str] = None
    # Phase 0: why an AI reply was rejected (auth | unreachable | tool_failed |
    # agent_error | empty_reply). None for normal answers. Old clients ignore it.
    error_kind: Optional[str] = None
    # Phase 0: how many times Langflow was asked (1 normally, 2 after the unreachable retry).
    attempts: int = 1
class EnrichRequest(BaseModel):
    message: str
    module: str = "AP"
def extract_ica_message(rd):
    try:
        outputs = rd.get("outputs", [])
        if outputs:
            inner = outputs[0].get("outputs", [])
            if inner:
                results = inner[0].get("results", {})
                msg = results.get("message", {})
                if isinstance(msg, dict):
                    return msg.get("text", "")
                if isinstance(msg, str):
                    return msg
        for k in ["text", "message", "output", "result"]:
            val = rd.get(k)
            if val is not None:
                return str(val)
        return str(rd)
    except Exception as e:
        logger.error(f"Extraction failed: {str(e)}")
        return "Could not extract response"
async def fetch_mcp_context(query: str) -> str:
    mcp_url = settings.mcp_gateway_url
    mcp_token = settings.mcp_api_key
    bearer = settings.mcp_bearer_token
    if not mcp_url or not mcp_token:
        return ""
    headers = {
        "Authorization": f"Bearer {bearer}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "id": 1,
        "params": {
            "name": "context-broker-vector-query",
            "arguments": {
                "context_id": ICA_CONTEXT_ID,
                "AgentPersona": "OracleEBSIntelligenceAgent",
                "query": query,
                "top_k": 8,
                "x-api-key": mcp_token
            }
        }
    }
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                mcp_url,
                headers=headers,
                json=payload
            )
        if response.status_code == 200:
            content = response.json().get(
                "result", {}
            ).get("content", [])
            if content:
                text = content[0].get("text", "")
                logger.info(
                    f"MCP context: {len(text)} chars"
                )
                return text
    except Exception as e:
        logger.warning(f"MCP skipped: {str(e)}")
    return ""
@router.post("/chat", response_model=ChatResponse)
async def ica_chat(req: ChatRequest):
    if not req.message.strip():
        return ChatResponse(
            success=False,
            message="Message cannot be empty",
            source="error",
            session_id=req.session_id
        )
    if not ICA_WORKFLOW_URL or not ICA_API_KEY:
        return ChatResponse(
            success=False,
            message="ICA not configured",
            source="config_error",
            session_id=req.session_id
        )
    mcp_context = "" if settings.ica_agent_mode else await fetch_mcp_context(req.message)
    if settings.ica_agent_mode:
        enriched_message = req.message
    elif mcp_context:
        enriched_message = f"""You are Oracle EBS Intelligence Agent v6.0.
BUILT-IN EBS KNOWLEDGE:
{EBS_KNOWLEDGE}
ADDITIONAL RETRIEVED CONTEXT FROM EBS KNOWLEDGE BASE:
{mcp_context[:5000]}
USER QUESTION: {req.message}
Instructions:
- Answer specifically and practically
- List all relevant reports with their IDs
- Format with bullet points and clear sections
- DO NOT include Tool Trace in your response
- DO NOT include Recommended Actions section
- DO NOT include Retrieved Findings section
- DO NOT include tool call information
- DO NOT include MCP tool references
- Just answer the question directly and clearly
- Never say context is insufficient - use built-in knowledge"""
        logger.info("MCP context injected into prompt")
    else:
        enriched_message = f"""You are Oracle EBS Intelligence Agent v6.0.
BUILT-IN EBS KNOWLEDGE:
{EBS_KNOWLEDGE}
USER QUESTION: {req.message}
Answer specifically using the EBS knowledge above.
Format with bullet points and clear sections."""
        logger.warning("No MCP context - using built-in knowledge")
    headers = {
        "x-api-key": ICA_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "input_value": enriched_message,
        "output_type": "chat",
        "input_type": "chat"
    }
    if req.session_id:
        payload["session_id"] = req.session_id
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"ICA attempt {attempt+1}: {req.message[:50]}")
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    ICA_WORKFLOW_URL,
                    headers=headers,
                    json=payload
                )
            logger.info(f"ICA status: {response.status_code}")
            if response.status_code == 200:
                text = extract_ica_message(response.json())
                # Langflow returns 200 even when the agent could not reach the
                # knowledge graph (e.g. "Invalid token"). Check the reply text
                # instead of trusting the status code alone.
                check = classify_reply(text)
                attempt_notes = []   # short, secret-free outcome of each attempt
                if check.kind == "unreachable":
                    attempt_notes.append("1: unreachable")
                    # Phase 0: the knowledge graph was briefly unreachable.
                    # Ask the SAME read-only question ONE more time. This is a
                    # single fixed retry (not tied to MAX_RETRIES) so it cannot
                    # loop. auth / session_expired / agent_error are never retried.
                    logger.warning("ICA reply was 'unreachable' - retrying once")
                    await asyncio.sleep(UNREACHABLE_RETRY_DELAY)
                    try:
                        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                            retry_resp = await client.post(
                                ICA_WORKFLOW_URL, headers=headers, json=payload)
                        if retry_resp.status_code == 200:
                            text = extract_ica_message(retry_resp.json())
                            check = classify_reply(text)
                            attempt_notes.append(f"2: {check.kind}")
                        else:
                            attempt_notes.append(f"2: HTTP {retry_resp.status_code}")
                    except Exception as e:
                        # Keep the first (unreachable) result and report it.
                        attempt_notes.append(f"2: {type(e).__name__}")
                        logger.warning(f"ICA unreachable-retry failed: {type(e).__name__}")
                attempts = 2 if attempt_notes else 1
                if not check.ok:
                    # Log a redacted, shortened copy: replies can echo keys.
                    logger.error(
                        f"ICA reply rejected ({check.kind}, attempts={attempts}): "
                        f"{redact_secrets(text)[:300]}")
                    message = check.user_message
                    if attempt_notes:
                        # Only fixed labels (kind, HTTP status, exception class): no reply text, no keys.
                        message += f" Tried 2 times ({'; '.join(attempt_notes)})."
                    return ChatResponse(
                        success=False,
                        message=message,
                        source=check.source,
                        session_id=req.session_id,
                        error_kind=check.kind,
                        attempts=attempts
                    )
                return ChatResponse(
                    success=True,
                    message=text,
                    source="ica_live",
                    session_id=req.session_id,
                    attempts=attempts
                )
            elif response.status_code in [401, 403]:
                                return ChatResponse(
                    success=False,
                    message=f"ICA auth failed ({response.status_code})",
                    source="ica_auth_error",
                    session_id=req.session_id
                )
            elif response.status_code >= 500:
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return ChatResponse(
                    success=False,
                    message="ICA server error",
                    source="ica_server_error",
                    session_id=req.session_id
                )
            else:
                return ChatResponse(
                    success=False,
                    message=f"Unexpected: {response.status_code}",
                    source="ica_error",
                    session_id=req.session_id
                )
        except httpx.TimeoutException:
            logger.warning(f"ICA timeout attempt {attempt+1}")
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            return ChatResponse(
                success=False,
                message="ICA timed out",
                source="ica_timeout",
                session_id=req.session_id
            )
        except httpx.ConnectError:
            return ChatResponse(
                success=False,
                message="Cannot connect to ICA. Check IBM VPN.",
                source="ica_connection_error",
                session_id=req.session_id
            )
        except Exception as e:
            logger.error(f"ICA error: {str(e)}")
            return ChatResponse(
                success=False,
                message="Unexpected error while contacting ICA",
                source="ica_error",
                session_id=req.session_id
            )
    return ChatResponse(
        success=False,
        message="ICA failed after retries",
        source="ica_failed",
        session_id=req.session_id
    )
MODULE_TABLES = {
    "AP": ["AP_INVOICES_ALL", "AP_SUPPLIERS", "AP_CHECKS_ALL",
           "AP_PAYMENT_SCHEDULES_ALL", "AP_INVOICE_PAYMENTS"],
    "AR": ["AR_PAYMENT_SCHEDULES_ALL", "AR_CASH_RECEIPTS_ALL"],
    "GL": ["GL_JE_HEADERS", "GL_JE_LINES",
           "GL_CODE_COMBINATIONS", "GL_BALANCES"],
    "PO": ["PO_HEADERS_ALL", "PO_LINES_ALL", "PO_DISTRIBUTIONS_ALL"],
    "HRMS": ["PER_ALL_PEOPLE_F", "PER_ALL_ASSIGNMENTS_F",
             "HR_ALL_ORGANIZATION_UNITS"],
    "iExpense": ["AP_EXPENSE_REPORT_HEADERS_ALL",
                 "AP_EXPENSE_REPORT_LINES_ALL",
                 "AP_CREDIT_CARD_TRXNS_ALL"],
    "INV": ["MTL_SYSTEM_ITEMS_B", "MTL_ONHAND_QUANTITIES_DETAIL"],
}
MODULE_REPORTS = {
    "AP": ["Aged Payables", "Invoice Register",
           "AP Trial Balance", "Withholding Tax", "Supplier Payments"],
    "AR": ["AR Aging Report", "Customer Statement"],
    "GL": ["GL Journal Entries", "GL Trial Balance", "Account Analysis"],
    "PO": ["PO Detail Report", "PO Distributions",
           "Receipt Adjustments", "Savings Analysis"],
    "HRMS": ["Active Employees", "Terminated Employees",
             "Supervisor Details", "Cost Allocation"],
    "iExpense": ["iExpense Detail", "Credit Card Report", "Workflow Approvals"],
    "INV": ["Inventory Valuation"],
}
MODULE_RULES = {
    "AP": ["RULE_001 ORG_ID required",
           "RULE_004 Cancelled invoices", "RULE_005 Void cheques"],
    "AR": ["RULE_001 ORG_ID required"],
    "GL": ["RULE_001 ORG_ID required", "RULE_006 Summary flag filter"],
    "PO": ["RULE_001 ORG_ID required"],
    "HRMS": ["RULE_002 DateTrack PPF", "RULE_003 DateTrack PAF"],
    "iExpense": ["RULE_001 ORG_ID required", "RULE_007 SOURCE filter"],
    "INV": ["RULE_001 ORG_ID required"],
}
def detect_module(text):
    t = text.lower()
    if any(k in t for k in ["payable", "invoice", "supplier", "vendor", "ap_"]):
        return "AP"
    if any(k in t for k in ["receivable", "customer", "ar_"]):
        return "AR"
    if any(k in t for k in ["journal", "ledger", "gl_", "trial balance"]):
        return "GL"
    if any(k in t for k in ["purchase", "po_", "procurement"]):
        return "PO"
    if any(k in t for k in ["employee", "hrms", "per_", "assignment"]):
        return "HRMS"
    if any(k in t for k in ["iexpense", "expense report", "credit card"]):
        return "iExpense"
    if any(k in t for k in ["inventory", "item", "mtl_"]):
        return "INV"
    return "AP"
@router.post("/chat/enrich")
async def enrich_chat(req: EnrichRequest):
    module = req.module or detect_module(req.message)
    tables = MODULE_TABLES.get(module, MODULE_TABLES["AP"])
    rules = MODULE_RULES.get(module, MODULE_RULES["AP"])
    reports = MODULE_REPORTS.get(module, MODULE_REPORTS["AP"])
    return {
        "source": "backend",
        "module": module,
        "tables": tables,
        "rules": rules,
        "reports": reports,
        "insight": (
            f"ICA Context ({module}): {len(reports)} reports, "
            f"{len(tables)} key tables, "
            f"{len(rules)} compliance rules active."
        ),
    }
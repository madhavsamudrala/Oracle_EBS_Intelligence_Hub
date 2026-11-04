# Tab 7: AI Chat — Knowledge Document

## Overview

The AI Chat tab is the **conversational intelligence layer** of the Oracle EBS Intelligence Hub.
It connects to **IBM ICA Context Studio** via the MCP Gateway to provide AI-powered answers
to Oracle EBS questions, report discovery, data analysis, and training queries.

Available to **both Employee and Technical roles** with full access.

---

## Technology: IBM ICA Context Studio

The AI Chat does NOT use a general-purpose LLM directly. It routes through:

```
User Question
     ↓
EBS Portal (browser)
     ↓
FastAPI Backend (localhost:8000/api/chat)
     ↓
IBM ICA MCP Gateway
     ↓
ICA Context Studio (Oracle EBS Knowledge Graph)
     ↓
17,000+ characters of Oracle EBS R12 knowledge
     ↓
AI-generated response with EBS-specific context
     ↓
Displayed in chat panel
```

**Why this matters:** The AI has deep Oracle EBS R12 context baked in — it knows EBS table
names, module relationships, Cook County business rules, report definitions, and AMS
engagement context. It does NOT hallucinate generic Oracle answers.

---

## What the AI Knows (Knowledge Graph)

The ICA Context Studio knowledge graph contains:

| Knowledge Area | Details |
|---|---|
| Oracle EBS R12 Modules | AP, AR, GL, PO, HRMS, INV, iExpense — full business process knowledge |
| EBS Tables | 200+ key table names, their purpose, key columns, join patterns |
| Report Definitions | All 26 reports — fields, filters, business purpose, SQL patterns |
| Business Rules | Cook County-specific rules, approval workflows, iExpense policies |
| SQL Patterns | Common EBS SQL templates, Multi-Org patterns, performance tips |
| EBS Terminology | 150+ EBS terms defined in Cook County AMS context |
| Module Relationships | How AP feeds GL, how PO links to AP, how iExpense flows to AP |
| Role Definitions | What each role (AP Clerk, DBA, PM, BA) does on the engagement |

---

## Supported Conversation Types

### Type 1: Report Discovery
User asks which report to use for a business need.

**Example:**
```
User: "I need to see all invoices that haven't been paid in more than 60 days"
AI:   "That's the AP Aging Report. It shows invoices grouped into 0-30, 31-60,
       61-90, and 90+ day buckets. Go to Reports tab → AP module → AP Aging Report.
       Filter by Operating Unit and set the date range. The report highlights
       invoices in red when they exceed your payment terms."
```

### Type 2: EBS Concept Explanation
User asks what an EBS term or process means.

**Example:**
```
User: "What is 3-way matching in Oracle AP?"
AI:   "3-way matching is the process of verifying that three documents agree before
       paying a supplier invoice:
       1. Purchase Order (PO) — what was ordered at what price
       2. Goods Receipt (GR) — what was actually received
       3. Supplier Invoice — what the supplier is charging
       In Oracle EBS, this is managed in the AP module. If the invoice amount,
       quantity, and price match the PO and receipt within your defined tolerances,
       the invoice is approved automatically. If not, it goes on hold."
```

### Type 3: SQL Help
User asks for help with an Oracle EBS SQL query.

**Example:**
```
User: "How do I query all AP invoices for a specific vendor?"
AI:   "Here's the standard query for AP invoices by vendor:

SELECT ai.invoice_id,
       ai.invoice_num,
       ai.invoice_date,
       ai.invoice_amount,
       ai.payment_status_flag,
       pv.vendor_name
FROM   ap_invoices_all ai
JOIN   po_vendors pv ON ai.vendor_id = pv.vendor_id
WHERE  ai.org_id = :p_org_id
AND    pv.vendor_name LIKE :p_vendor_name
ORDER BY ai.invoice_date DESC;

Key notes:
- Always include org_id for Multi-Org compliance
- Use LIKE with % for partial vendor name match
- payment_status_flag: 'Y' = Paid, 'N' = Unpaid, 'P' = Partial"
```

### Type 4: Academy / Training
User asks to learn something about EBS.

**Example:**
```
User: "Explain the Oracle EBS period close process"
AI:   "The Oracle EBS period close follows a strict sequence to ensure the
       sub-ledgers balance to the GL:
       1. AP Close: Post all invoices and payments, close AP period
       2. AR Close: Post all invoices and receipts, close AR period
       3. PO Close: Post receiving accruals (GRNI), close PO period
       4. INV Close: Post inventory transactions, close INV period
       5. HRMS/Payroll Close: Post payroll costing journals
       6. GL Close: Run Journal Import, run GL Consolidation if needed,
          run FSG reports to verify, then close GL period
       Common issues: AP invoices stuck in 'Needs Revalidation', GRNI
       accruals not posting, missing journal imports."
```

### Type 5: Inline Data Analysis
User asks the AI to analyse data visible in the current report.

**Example:**
```
User: "Looking at the AP Aging report — what does this data tell me?"
AI:   "Based on the AP Aging data: Your total outstanding AP is $2.4M.
       $180K is in the 61-90 day bucket — this is concerning as most vendors
       have 60-day payment terms. I'd prioritise reviewing those invoices
       for holds or disputes. The 90+ day balance of $45K likely has specific
       hold reasons — check the AP Hold Analysis report for details."
```

---

## Configuration (Backend .env)

For AI Chat to work, the FastAPI backend must have these variables in `backend/.env`:

```
ICA_WORKFLOW_URL=https://servicesessentials.ibm.com/mcp-gateway/service/gateway/servers/{your-server-id}/mcp
ICA_API_KEY=your_context_studio_key_here
MCP_BEARER_TOKEN=your_mcp_gateway_token_here
```

These are never exposed to the browser — all ICA calls are proxied through the backend.

---

## Common User Questions & Answers

**Q: Why does the AI sometimes say "I don't have information about that"?**
A: The AI is restricted to its Oracle EBS knowledge graph. If a question is outside that
   scope, it will say so rather than guessing. This is intentional (DASC compliance).

**Q: Is my conversation stored anywhere?**
A: Conversations are stored only in browser memory for the current session. No conversation
   data is persisted to any server or database.

**Q: Can the AI run SQL against the database for me?**
A: No. The AI generates SQL text only. Use SQL Lab to find the query, then run it yourself
   in Toad or SQL*Plus. The Live DB Proxy (Data Connect tab) runs pre-approved queries only.

**Q: Why does the AI respond faster sometimes?**
A: Response time depends on ICA MCP Gateway availability and network latency.
   The FastAPI backend has a 30-second timeout — if exceeded, retry your question.

**Q: Can I use the chat without the backend running?**
A: No. AI Chat requires the FastAPI backend (`start-backend.bat`). If the backend is not
   running, the chat panel shows a connection error. Use `start-all.bat` to start everything.

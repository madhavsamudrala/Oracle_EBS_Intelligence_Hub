# BOB Usage Guide
## Oracle EBS Intelligence Hub v6.0 — Cook County AMS Project

This document describes how **IBM BOB** (Build-on-Bob) is used throughout this project — from initial scaffolding to every feature, security model, and integration component.

---

## What is IBM BOB?

BOB is IBM's AI agent and code generation framework. In this project, **every line of code was generated using IBM Bob** — from the HTML/CSS/JS frontend to the Python FastAPI backend, the ICA ontology schema, the SQL compliance rules, and all documentation.

---

## How BOB Powers This Application

### 1. 💬 Chat Assistant — ICA MCP Gateway
BOB connects the Chat Assistant to IBM ICA Context Studio via MCP Gateway:
- System prompt: enterprise EBS context grounding
- Every user query enriched with: detected EBS module, relevant Oracle tables, active compliance rules
- ICA retrieves 17,000+ characters of enterprise knowledge per query
- `ebs-ica-integration.js` → `POST /api/chat` → `backend/app/routes/chat.py` → ICA Context Studio

### 2. 🛡️ DASC Security Model
BOB was used to design and implement the complete IBM Digital AppSec Champion (DASC) security architecture:
- Role-based tab visibility (`_applyRoleTabVisibility()`)
- Employee least-privilege: only Chat, Reports, Data Connect visible — no indication of other tabs
- Zero-trust API: ICA API key and MCP token never exposed to client — stored in backend `.env` only
- DASC info bar (`_showDascInfoBar()`) — role-specific clearance display after login
- Dual-control deletion governance: Employee requests → Technical approves → immutable audit entry
- Recycle bin with full snapshot restore capability

### 3. 🔍 SQL Advisor — Compliance Engine
BOB's reasoning layer applied to SQL analysis:
- 27 compliance checks across 5 categories (EBS Compliance, Performance, Best Practice, Security, Date Handling)
- Performance scoring: 100 − (Critical×20) − (Major×10) − (Minor×5)
- Code Review, Performance Advisor, and Formatter all generated via BOB prompts
- COMP-001 to COMP-010 Oracle EBS compliance rules from ICA ontology

### 4. 🎓 EBS Academy — Knowledge Base
- 15 module knowledge base with 40+ AI response handlers
- BOB generated all module content: AP → iExpense + Concurrent Programs, DBA, Architecture, SOA, APEX, Security, PM Guide
- AI assistant uses keyword-matched responses from `ebs-academy-data.js`

### 5. ♻️ Team Reuse Strategy
BOB was used to architect the team-wide deployment model:
- `start-all.bat` — one-command startup for entire team
- FastAPI backend proxy — keeps secrets secure, serves as ICA gateway
- ICA Context Studio knowledge shared across all team members
- Deployment documentation and onboarding guides all BOB-generated

---

## Integration Architecture

```
Browser (HTML + JS)
  └── oracle-ebs-intelligence-hub.html    — UI, login, DASC info bar, 7 tabs
  └── ebs-reports.js             — Logic, DASC enforcement, delete/recycle
  └── ebs-ica-integration.js     — ICA service + BOB hooks
        └── POST /api/chat         → backend/app/routes/chat.py → ICA MCP
        └── POST /api/sql_advisor  → backend/app/routes/sql_advisor.py
        └── POST /api/academy      → backend/app/routes/academy.py
        └── GET  /health           → backend/app/routes/health.py
```

---

## BOB Prompts Used — Key Examples

### Security & DASC
```
"Implement IBM DASC-compliant role-based access control.
 Employee role sees only Chat, EBS Reports, and Data Connect.
 Technical role sees all 7 tabs.
 Employee users must never see any indication of tabs beyond their clearance.
 Add a DASC security info bar below the tab nav showing role clearance after login.
 Use light mint green (#f0f7f4) for Employee bar and soft blue (#f0f5ff) for Technical bar."

"Add a _showDascInfoBar(role) function called on login/logout.
 Employee bar shows: DASC Security Active — Your access is ready
 with ✓ Chat Assistant / ✓ EBS Reports / ✓ Data Connect pills.
 Technical bar shows: DASC Full Clearance with all 7 tab pills."
```

### ICA MCP Integration
```
"Integrate IBM ICA Context Studio via MCP Gateway.
 Build a FastAPI backend at localhost:8000 that proxies chat requests to ICA.
 Store ICA API key and MCP Bearer token in .env file only.
 Add an ICA Live status badge in the chat header that polls /health every 30 seconds."
```

### Team Reuse Strategy
```
"Add a Team Reuse Strategy section to the Chat welcome message.
 It should explain that this is a reusable IBM Consulting accelerator,
 not a personal productivity tool.
 Any IBM Oracle EBS team can deploy in under 1 hour via start-all.bat.
 ICA Context Studio knowledge graph is shared across the entire team."
```

### DASC Colour Fix
```
"The 🛡️ DASC badge in the app header has blue text on dark navy background —
 completely unreadable. Change it to use a light frosted glass style:
 rgba(255,255,255,0.12) background, rgba(255,255,255,0.35) border, #d4f5e2 text.
 Fix all other DASC elements to use light theme: #f0f7f4 background,
 #a7d9c0 border, #1a6b45 text — visible but not dominant."
```

### Delete & Recycle Bin (DASC Governance)
```
"Implement dual-control deletion governance:
 Employee role: clicking Delete shows a request dialog with reason dropdown and notes.
 Request is stored in window.DELETE_REQUESTS with status 'pending'.
 Technical role: sees notification bell badge with count of pending requests.
 Technical can Approve (soft-deletes report, saves snapshot to Recycle Bin) or Reject.
 Recycle Bin allows Technical to restore any deleted report with full data snapshot."
```

---

## Running BOB Locally

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add ICA_API_KEY and MCP_BEARER_TOKEN to .env
uvicorn app.main:app --reload --port 8000
```

### Full Stack (one command)
```bash
start-all.bat
```

### Frontend Only
```bash
python -m http.server 8080
# open http://localhost:8080/oracle-ebs-intelligence-hub.html
```

---

## BOB AppStudio Configuration

> The current agent definition is [`appstudio/oracle-ebs-intelligence-hub-agent-v6.yaml`](../appstudio/oracle-ebs-intelligence-hub-agent-v6.yaml).
> The v5.0 file below is archived (see [`appstudio/README.md`](../appstudio/README.md)); its rule IDs are out of date.

See [`appstudio/oracle-ebs-intelligence-hub-agent.yaml`](../appstudio/oracle-ebs-intelligence-hub-agent.yaml) (archived v5.0) for the original BOB agent design:
- System prompt with DASC security context
- ICA Context Studio knowledge base references
- Tool definitions (report lookup, SQL analysis, Academy queries)
- ICA Context Studio MCP server reference
- Team deployment instructions

---

## BOB Challenge Submission

**Team:** Cook County AMS Project  
**Demo:** Oracle EBS Intelligence Hub v6.0

### Submission Pages
1. Cover — Oracle EBS Intelligence Hub v6.0
2. Problem — The Pain / Waste
3. Solution — The Hub
4. Security — DASC (Digital AppSec Champion)
5. Team Value & Reuse Strategy
6. Productivity Impact
7. Bob Usage Evidence
8. Demo Script Part 1 (Tabs 1–4)
9. Demo Script Part 2 (Tabs 5–7 + Key Phrases)
10. Demo Script Part 3 — DASC Security Demo
11. Demo Script Part 4 — Team Reuse Strategy Demo
12. One Slide Summary
13. Dark Closing / Thank You

---

## Revision History

| Version | Date | BOB Usage Additions |
|---|---|---|
| v6.0 | Jul 2025 | DASC security model, DASC info bar, team reuse strategy, ICA MCP live badge, start-all.bat |
| v5.2 | Jul 2025 | Ontology v5.2 RICE taxonomy, ModuleKnowledge, 30+ OWL classes |
| v5.0 | Jun 2025 | SQL Lab AI, Academy 15 modules, Delete/Recycle Bin, Employee request workflow |
| v4.0 | Mar 2025 | Oracle Blue theme, role-based login, fiscal date fix |
| v3.0 | Jan 2025 | Data Connect, column fuzzy mapping, 100 mapping rules |
| v2.0 | Oct 2024 | Code Review 27 checks, SQL Formatter, SVG diagrams |
| v1.0 | Jun 2024 | Initial scaffolding, 26 reports, Chat, SQL Advisor, Doc Generator |

---

*Oracle EBS Intelligence Hub v6.0 | Cook County AMS Project | IBM BoB Challenge | Built entirely with IBM Bob*

# Oracle EBS Intelligence Hub

**Version:** 6.0 | **Status:** Production Ready | **Platform:** SPA + FastAPI Backend | **Team:** Cook County AMS Project

> A deployable IBM Consulting accelerator for Oracle EBS R12 — AI-powered reporting via IBM ICA Context Studio, SQL development tools, a 15-module learning academy, live data import, and document generation. Built entirely using IBM Bob. DASC-compliant security model. Team-wide deployment in under 1 hour.

[![IBM Bob Built](https://img.shields.io/badge/Built%20with-IBM%20Bob-0572CE)](https://www.ibm.com)
[![ICA Powered](https://img.shields.io/badge/Powered%20by-ICA%20Context%20Studio-198038)](https://www.ibm.com)
[![DASC Compliant](https://img.shields.io/badge/🛡️%20DASC-Compliant-1a6b45)](https://www.ibm.com)

---

## Quick Start

```bash
# One command starts everything (frontend + backend + ICA)
start-all.bat

# Or manually:
# 1. Start backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Open frontend
open oracle-ebs-intelligence-hub.html
# or: python -m http.server 8080
```

**Login credentials:** passwords are not stored in the repo. Copy `ebs-credentials.example.js` to `ebs-credentials.js` (git-ignored) and set your own values before first use.

| Role | Password | Access |
|---|---|---|
| Employee | _set in local `ebs-credentials.js`_ | Chat · EBS Reports · Data Connect |
| Technical | _set in local `ebs-credentials.js`_ | All 7 tabs · SQL Tools · Governance |

---

## What Is This?

The Oracle EBS Intelligence Hub is a **reusable IBM Consulting accelerator** — not a personal tool. Any IBM Oracle EBS engagement team can deploy it in under one hour.

| Problem | Solution |
|---|---|
| Business users need IT to run every report | Self-service: 26 EBS reports across 7 modules, filterable by year/month/keyword |
| Developers write slow or non-compliant SQL | SQL Advisor: Performance analysis + 27-check Code Review + Formatter |
| New team members take months to learn EBS | Academy: 15 modules from AP basics to DBA to Project Manager |
| No way to test with real data without DB access | Data Connect: drag & drop Excel or query live Oracle DB |
| No enterprise AI grounding | IBM ICA Context Studio: 17,000+ chars of EBS knowledge per query via MCP Gateway |
| Security risk from unrestricted access | DASC-compliant role-based access: Employee sees only what they need |

---

## 🛡️ DASC Security Model

The Oracle EBS Intelligence Hub is **IBM Digital AppSec Champion (DASC) compliant** — security is built into every layer.

| Principle | Implementation |
|---|---|
| **Least Privilege** | Employee role sees only Chat, EBS Reports, Data Connect. SQL tools hidden entirely. |
| **Zero Trust API** | All secrets (ICA API key, MCP Bearer token) stored in backend `.env` only — never in client code |
| **Audit Trail** | Every deletion, approval, and data push is logged with timestamp and user role |
| **Dual-Control Governance** | Report deletion requires Employee request + Technical approval |
| **Role Enforcement** | Tab visibility enforced in JS via `_applyRoleTabVisibility()` — blocked tabs are not rendered, not just hidden |

### Role Clearances

| | 👤 Employee | ⚙️ Technical |
|---|---|---|
| **Clearance Level** | Standard | Full |
| **Chat Assistant** | ✅ | ✅ |
| **EBS Reports** | ✅ View, filter, export | ✅ View, filter, export |
| **Data Connect** | ✅ Import & push | ✅ Import & push |
| **SQL Advisor** | — (not visible) | ✅ Full access |
| **Doc Generator** | — (not visible) | ✅ Full access |
| **SQL Lab** | — (not visible) | ✅ Full access |
| **EBS Academy** | — (not visible) | ✅ Full access |
| **Delete reports** | Request only → Technical approves | Direct delete + Recycle Bin |
| **Notification bell** | — | ✅ Pending requests + Recycle Bin |

> Employee users are never shown which tabs exist beyond their clearance — no ❌ indicators, no curiosity triggers. The app feels complete at their access level.

---

## ♻️ Team Reuse Strategy

This is not a personal productivity tool. It is a **reusable IBM Consulting accelerator** designed for team-wide deployment.

| Benefit | Detail |
|---|---|
| **< 1 Hour Deploy** | Run `start-all.bat` — frontend + backend + ICA connectivity starts automatically |
| **Shared Knowledge** | ICA Context Studio knowledge graph shared across the entire team — every consultant gets the same grounded EBS responses |
| **Onboarding** | New joiners productive in days instead of weeks — Academy + Chat replace tribal knowledge |
| **SQL Protection** | 27 compliance rules protect every team member from costly Oracle EBS SQL mistakes |
| **Any Engagement** | Reusable across any IBM Oracle EBS R12 engagement — AP, AR, GL, PO, HRMS, INV, iExpense |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (oracle-ebs-intelligence-hub.html)                  │
│  ├── Chat Assistant  (ICA MCP live)                 │
│  ├── EBS Reports     (26 reports, 7 modules)        │
│  ├── SQL Advisor     (Technical only)               │
│  ├── Doc Generator   (Technical only)               │
│  ├── SQL Lab         (Technical only)               │
│  ├── EBS Academy     (Technical only)               │
│  └── Data Connect    (Excel/CSV/Live DB)            │
└──────────────┬──────────────────────────────────────┘
               │ POST /api/chat, /api/sql_advisor, /health
               ▼
┌─────────────────────────────────────────────────────┐
│  FastAPI Backend  (localhost:8000)                  │
│  backend/app/routes/                               │
│  ├── chat.py          → IBM ICA Context Studio      │
│  ├── health.py        → status + ICA ping           │
│  └── (secrets in .env — never in client code)      │
└──────────────┬──────────────────────────────────────┘
               │ MCP Gateway / REST
               ▼
┌─────────────────────────────────────────────────────┐
│  IBM ICA Context Studio                             │
│  17,000+ chars enterprise EBS knowledge per query  │
│  Ontology: 30+ OWL classes, 52+ properties         │
└─────────────────────────────────────────────────────┘
```

---

## The Seven Features

### 🤖 1. Chat Assistant — IBM ICA Powered

Ask plain-English questions — get enterprise-grounded EBS answers via IBM ICA Context Studio.

```
"Show me unpaid invoices"           → Invoice Register (ICA-grounded)
"AP aging over 90 days"             → AP Aging Report
"What SQL rules apply to invoices"  → ICA retrieves compliance rules live
"List all AP module reports"        → 17,000+ chars from Context Studio
```

- **ICA Live badge** in header — confirms MCP Gateway connection
- Falls back gracefully to local schema when backend offline
- Upload Excel/CSV in chat → data auto-loaded into matching report
- Download previewed reports as CSV, Excel, or PDF

---

### 📊 2. EBS Reports Browser (26 Reports)

| Module | Reports |
|---|---|
| **Accounts Payable** | Invoice Register, AP Aging, Supplier List, Withholding Tax, Payment Register, Expense Distribution, Void Payments, Invoice on Hold |
| **Accounts Receivable** | AR Aging Report, Customer Statements |
| **General Ledger** | Journal Entries, Trial Balance, Budget vs Actual |
| **iExpense** | Expense Reports, Credit Card Transactions, Expense Approval |
| **HRMS** | Employee List, Supervisor Hierarchy, Payroll Summary, Cost Allocation |
| **Purchasing** | PO Status, Buyer Workload, Receipt Register, Spend by Supplier |
| **Inventory / Other** | Inventory Valuation, Concurrent Requests |

**Per report:** Filter · Paginate · Chart · SQL view · Export (CSV/Excel/PDF) · DASC delete workflow

---

### 🔍 3. SQL Advisor _(Technical Only)_

Three sub-tabs:

#### ⚡ Performance Advisor
- Estimates execution cost before and after optimisation
- Detects: missing ORG_ID, SELECT *, comma joins, correlated subqueries

#### 🔎 Code Review — 27 Checks
Score = 100 − (Critical×20) − (Major×10) − (Minor×5)

| Category | Example Checks |
|---|---|
| **EBS Compliance** | Missing ORG_ID, PRIMARY_FLAG, CANCELLED_DATE |
| **Performance** | SELECT *, correlated subquery, TRUNC on index |
| **Security** | EXECUTE IMMEDIATE without bind variables |
| **Date Handling** | DateTrack filter missing, raw SYSDATE |

#### ✨ Code Formatter
- SELECT, DML, PL/SQL — keyword casing, one column/JOIN per line, EBS header comment

---

### 🎓 4. EBS Academy _(Technical Only)_ — 15 Modules

Covers AP → INV + Concurrent Programs, DBA, Architecture, SOA, APEX, Testing, Security, PM Guide. Per topic: structured content + SVG flowchart + SQL examples + AI assistant.

---

### 🔬 5. SQL Lab _(Technical Only)_

500+ pre-written Oracle EBS queries + AI prompt-to-SQL. Out-of-scope detection (rejects non-EBS prompts).

---

### 🔌 6. Data Connect

Replace demo data with real data — three ways: Excel/CSV upload, DB Simulated, or Live Oracle DB via proxy. Fuzzy auto-mapping + 6 column transforms.

---

### 📄 7. Document Generator _(Technical Only)_

Complete TDD/FSD in under 2 minutes — cover page, SVG diagrams (Process Flow, Data Flow, ERD, PL/SQL Flowchart), business rules, error handling. Export HTML → print to PDF.

---

## Delete & Recycle Bin (DASC Governance Workflow)

```
Employee → Request deletion (reason + notes)
         → Technical notified via 🔔 bell
         → Technical: Approve → soft-delete → Recycle Bin
                    OR Reject  → report stays live
         → Immutable audit entry created at each step
         → Recycle Bin: restore anytime (full snapshot)
```

---

## Repository Structure

```
Oracle-EBS-Intelligence-HUB/
│
├── oracle-ebs-intelligence-hub.html       Main app — login, 7 tab panels, DASC info bar
├── ebs-reports.js                All logic — 180+ functions (incl. DASC role enforcement)
├── ebs-reports.css               Styles — Oracle Blue theme
├── ebs-reports-data.js           26 report definitions + sample data
├── ebs-sqllib-data.js            SQL library — 500+ queries
├── ebs-academy-data.js           Academy — 15 modules × topics
├── ebs-ica-integration.js        ICA Context Studio + MCP Gateway integration
├── start-all.bat                 ★ One-command team deployment
│
├── backend/
│   ├── app/main.py               FastAPI app
│   ├── app/routes/chat.py        ICA chat route
│   ├── app/routes/health.py      Health + ICA status
│   └── .env                      Secrets (ICA API key, MCP token) — never committed
│
├── docs/
│   ├── TECHNICAL_SPEC.md
│   ├── FUNCTIONAL_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── PROJECT_OVERVIEW.md
│   └── BOB_USAGE.md
│
└── ica-schema/
    ├── ebs-ontology.jsonld            OWL ontology — 30+ classes, 52+ properties
    ├── ebs-complete-ontology.jsonld   PRIMARY ICA upload (2008 lines)
    └── csv/                           Nodes, edges, NL queries, column mappings
```

---

## Technology Stack

| Component | Technology | Version |
|---|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS ES6+ | — |
| Backend | Python FastAPI | 0.104+ |
| Charts | Chart.js | 4.4.0 |
| Excel I/O | SheetJS (xlsx) | 0.18.5 |
| Downloads | FileSaver.js | 2.0.5 |
| AI | IBM ICA Context Studio via MCP Gateway | — |
| Fonts | IBM Plex Sans / Mono | CDN |

---

## IBM BoB Challenge — Cook County AMS Project

Built entirely using **IBM Bob** for the IBM Build-on-Bob (BoB) challenge.

| Team Member | Role |
|---|---|
| Madhav Samudrala | Lead Developer + Architecture |

**Key metrics:**
- 26 pre-built EBS reports across 7 modules
- 27 SQL compliance rules
- 500+ SQL library queries
- 15 Academy learning modules
- 17,000+ chars retrieved per ICA query
- Report discovery: 15 min → 30 sec
- SQL review: 3 hrs → 30 sec
- TDD generation: 4 hrs → 2 min
- Team of 100 consultants: **600 hours saved per week**

---

## Revision History

| Version | Date | Key Changes |
|---|---|---|
| v6.0 | Jul 2025 | **DASC security model** (role-based access, least privilege, zero-trust API); **DASC info bar** in app; Team Reuse Strategy; `start-all.bat` one-command deploy; ICA MCP live badge; Cook County AMS Project submission |
| v5.2 | Jul 2025 | Ontology v5.2: 30+ OWL classes, 52+ properties; RICE taxonomy; ebs-complete-ontology.jsonld |
| v5.0 | Jun 2025 | SQL Lab AI, Academy (15 modules), Delete/Recycle Bin, Employee request workflow, Notification panel |
| v4.0 | Mar 2025 | Oracle Blue theme, role-based login, fiscal date fix |
| v3.0 | Jan 2025 | Data Connect, Excel/CSV import, IBM Carbon theme |
| v2.0 | Oct 2024 | Code Review (27 checks), SQL Formatter, SVG diagrams |
| v1.0 | Jun 2024 | Initial: Chat, 26 Reports, SQL Advisor, Doc Generator |

---

*Oracle EBS Intelligence Hub v6.0 | Cook County AMS Project Team | IBM BoB Challenge | Built with IBM Bob · Powered by IBM ICA Context Studio · 🛡️ DASC-Compliant*

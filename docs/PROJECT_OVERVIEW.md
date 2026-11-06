# Oracle EBS Intelligence Hub — Complete Project Overview

**Version:** 6.0 | **Platform:** Oracle EBS R12 | **Built by:** Cook County AMS Project (IBM BoB Challenge)  
**Stack:** HTML5 / CSS3 / Vanilla JavaScript + Python FastAPI Backend + IBM ICA Context Studio via MCP  
**Files:** `oracle-ebs-intelligence-hub.html` + `ebs-reports.js` + `ebs-reports.css` + `ebs-ica-integration.js` + `backend/`

---

## 1. What Is This Project?

**Oracle EBS Intelligence Hub** is a **reusable IBM Consulting accelerator** — a single-page web application that acts as an intelligent front-end portal for Oracle E-Business Suite R12. Deployable by any IBM Oracle EBS engagement team in under one hour via `start-all.bat`.

It combines:

- **AI-powered chat assistant** — routes to IBM ICA Context Studio via MCP Gateway (17,000+ chars of enterprise EBS knowledge per query)
- **Pre-built EBS report library** across 7 modules (AP, PO, iExpense, HRMS, GL, AR, INV)
- **SQL tools** — performance advisor, code reviewer (27 checks), formatter, and curated SQL library (500+ queries)
- **Document generation** — Technical Design Documents and Functional Specifications with SVG diagrams
- **Learning platform** — 15-module EBS Academy with functional + technical split view + AI assistant
- **Data integration** — Excel/CSV upload or live Oracle DB query → fuzzy column mapping → push to reports
- **🛡️ DASC security model** — IBM Digital AppSec Champion compliant role-based access

The app runs entirely in the browser. The optional Python FastAPI backend (`http://localhost:8000`) enables the IBM ICA Agent for live enterprise-grounded responses.

---

## 2. 🛡️ DASC Security Model

The portal is **IBM Digital AppSec Champion (DASC) compliant** — security built into every layer.

### DASC Principles Applied

| Principle | Implementation |
|---|---|
| **Least Privilege** | Employee role sees only their 3 tabs — no indication other tabs exist |
| **Zero Trust API** | ICA API key + MCP token in backend `.env` only — never in client JS |
| **Audit Trail** | Every deletion, approval, data push logged with timestamp + role |
| **Dual-Control Governance** | Report deletion: Employee request → Technical approval → soft-delete → Recycle Bin |

### DASC Info Bar
After login, a role-specific clearance bar appears below the tabs:
- **Employee** — light mint green bar: `🛡️ DASC Security Active · Your access is ready — Chat, EBS Reports & Data Connect available`
- **Technical** — soft blue bar: `🛡️ DASC Full Clearance · Technical user — full access · governance authority · deletion approval`

### DASC Header Badge
A `🛡️ DASC` badge is permanently visible in the app header (frosted glass style — visible against the dark navy header without being dominant).

---

## 3. Login & Role System

### Login Screen (Two-Step)

**Step 1 — Choose Role:**

| Role | Icon | Description |
|------|------|-------------|
| **Employee / Business User** | 👤 | Chat Assistant · EBS Reports · Data Connect |
| **Technical / Power User** | ⚙️ | Full access — all 7 tabs + governance |

A `🛡️ DASC Security Model Active` banner appears on the login screen (light mint style — not dominant).

**Step 2 — Enter Password:**

| Role | Password |
|------|----------|
| Employee / Business User | _local ebs-credentials.js_ |
| Technical / Power User | _local ebs-credentials.js_ |

### Tab Visibility by Role

**Employee sees:** Chat Assistant · EBS Reports · Data Connect  
**Technical sees:** All 7 tabs (Chat · Reports · SQL Advisor · Doc Generator · SQL Lab · EBS Academy · Data Connect)

> **DASC Principle:** Employee users are never shown which tabs are restricted. The app feels complete and purpose-built at their access level — no ❌ indicators, no curiosity triggers.

---

## 4. Global Header (After Login)

After successful login, the IBM Carbon-style header is permanently visible:

| Element | Description |
|---------|-------------|
| **IBM \| Oracle EBS Intelligence Hub** | Branded app title |
| **Cook County AMS Project pill** | Team identifier — always visible during demo |
| **🛡️ DASC badge** | Frosted glass badge — always visible, DASC branding |
| **ICA Live / Offline badge** | Green "ICA Live" / grey "ICA Offline" — polls `/health` every 30s |
| **Role pill** | Shows Employee / Technical with role icon |
| **🔔 Notifications bell** | Technical only — pending delete requests + recycle bin count |
| **Sign Out** | Clears session, returns to login, hides DASC info bar |

---

## 5. Tabs — Detailed Reference

---

### TAB 1 — Chat Assistant (`tab-chat`)
> **Visible to:** Employee + Technical

The Chat Assistant connects to **IBM ICA Context Studio via MCP Gateway** for live enterprise-grounded responses.

**ICA Live Integration:**
- Green `● ICA Live` badge confirms MCP Gateway connection
- Falls back gracefully to local schema when backend offline
- Each query retrieves 17,000+ characters of Oracle EBS knowledge from Context Studio

**Features:**
- Natural language → EBS report, SQL rules, module knowledge
- Upload Excel/CSV directly in chat → auto-loads into matching report
- Preview reports inline with charts
- Download as CSV / Excel / PDF
- Clear chat, recent sessions history

**Chat Welcome Includes:**
- DASC Security Model card (Employee/Technical role split — no negative indicators for Employee)
- Team Reuse Strategy card (IBM Consulting accelerator pitch)

---

### TAB 2 — EBS Reports (`tab-reports`)
> **Visible to:** Employee + Technical

26 pre-built Oracle EBS reports across 7 modules:

| Module | Report Count | Key Reports |
|--------|-------------|-------------|
| Accounts Payable (AP) | 9 | Invoice Register, Aged Payables, Withholding Tax |
| Accounts Receivable (AR) | 2 | AR Aging, Customer Statement |
| General Ledger (GL) | 3 | Journal Entries, Trial Balance, Account Analysis |
| iExpense | 3 | Detail, Credit Card, Workflow Approvals |
| HRMS | 4 | Active Employees, Supervisor Hierarchy, Cost Allocation |
| Purchasing (PO) | 4 | PO Detail, Receipt Adjustments, Savings Analysis |
| Inventory (INV) | 1 | Inventory Valuation |

**Per report:** Year/month/keyword filter · Paginate · Chart (bar/line/pie/doughnut) · SQL view · Export (CSV/Excel/PDF) · DASC delete workflow

---

### TAB 3 — SQL Advisor (`tab-sql`)
> **Visible to:** Technical only (not shown to Employee)

Three sub-tabs:

#### ⚡ Performance Advisor
Estimates execution cost, detects issues, generates optimised SQL with side-by-side compare.

#### 🔎 Code Review — 27 Checks
Score = 100 − (Critical×20) − (Major×10) − (Minor×5)

| Category | Checks |
|---|---|
| EBS Compliance | ORG_ID, PRIMARY_FLAG, CANCELLED_DATE, FND_LOOKUPS |
| Performance | SELECT *, correlated subquery, TRUNC on index |
| SQL Best Practice | LIKE %, NOT IN nulls, hard literals |
| Security | EXECUTE IMMEDIATE without bind variables |
| Date Handling | DateTrack filter, raw SYSDATE |

#### ✨ Code Formatter
SELECT / DML / PL/SQL — keyword casing, one column/JOIN per line, Oracle EBS header block.

---

### TAB 4 — Doc Generator (`tab-docgen`)
> **Visible to:** Technical only

Generates complete TDD or FSD in under 2 minutes:
- Cover page, SVG diagrams (Process Flow · Data Flow · ERD · PL/SQL Flowchart)
- Business rules, parameters, tables, error handling, change log
- Export as HTML → print to PDF

---

### TAB 5 — SQL Lab (`tab-sqllab`)
> **Visible to:** Technical only

500+ pre-written Oracle EBS queries in 12 categories. AI prompt-to-SQL with out-of-scope detection.

---

### TAB 6 — EBS Academy (`tab-academy`)
> **Visible to:** Technical only

15 modules: AP, AR, GL, iExpense, HRMS, PO, INV + Concurrent Programs, DBA, Architecture, SOA, APEX/Modernisation, Testing, Security, PM Guide. Per topic: content + SVG flowchart + SQL examples + AI assistant.

---

### TAB 7 — Data Connect (`tab-dataconnect`)
> **Visible to:** Employee + Technical

Three import paths:
- **Excel/CSV upload** → SheetJS parse → fuzzy auto-map → transform → preview → push to report
- **DB Simulated** → paste SQL → demo data match → map → push
- **Live Oracle DB** → configure proxy → POST query → map → push

Fuzzy auto-mapping normalises column names (lowercase, strip spaces/underscores/specials) with substring matching.

---

## 6. ♻️ Team Reuse Strategy

Oracle EBS Intelligence Hub is a **reusable IBM Consulting accelerator** — designed for team-wide deployment on any Oracle EBS engagement.

| Benefit | Detail |
|---|---|
| **< 1 Hour Deploy** | `start-all.bat` starts frontend + backend + ICA connectivity |
| **Shared ICA Knowledge** | Context Studio knowledge graph shared — every consultant gets same grounded answers |
| **Fast Onboarding** | New joiners productive in 2–3 days via Academy + Chat (was 4+ weeks) |
| **SQL Compliance** | 27 rules protect every team member from costly Oracle EBS mistakes |
| **Any Engagement** | Reusable across any IBM Oracle EBS R12 project — AP, AR, GL, PO, HRMS, INV, iExpense |
| **Junior to Senior** | Chat for analysts, SQL Advisor for DBAs, Academy for consultants, Doc Gen for architects |

---

## 7. Delete & Recycle Bin (DASC Governance Workflow)

```
Employee → clicks Delete → Request form (reason dropdown + notes)
                        → DELETE_REQUESTS[reqId] = { status: 'pending' }
                        → Technical's 🔔 badge increments

Technical → opens Notification Panel
          → Pending Requests tab: Approve OR Reject
          → Approve → _doDeleteReport(key) → RECYCLE_BIN snapshot
          → Recycle Bin tab: Restore → REPORT_DATA restored + sidebar link re-shown
```

Immutable audit entry created at every step. Zero risk of data loss — full restore always available.

---

## 8. ICA Context Studio Integration

```
ebs-ica-integration.js
  └── EBSICAService class
        ├── checkHealth()     — polls http://localhost:8000/health every 30s
        ├── sendChat()        — POST /api/chat → ICA Context Studio via MCP
        └── analyzeSql()      — POST /api/sql_advisor → ICA-grounded SQL analysis

backend/app/routes/
  ├── chat.py         — proxies to IBM ICA MCP Gateway
  ├── health.py       — returns ICA connectivity status
  └── config.py       — reads ICA_API_KEY + MCP_BEARER_TOKEN from .env
```

**Security:** API credentials stored exclusively in `backend/.env` — never transmitted to or from the browser.

---

## 9. File Structure

```
Oracle-EBS-Intelligence-HUB/
│
├── oracle-ebs-intelligence-hub.html       Main app (login, DASC info bar, 7 tabs, modals)
├── ebs-reports.js                All logic (DASC enforcement, delete/recycle, chat, reports)
├── ebs-reports.css               Styles (Oracle Blue theme, responsive)
├── ebs-reports-data.js           26 report definitions + sample data
├── ebs-sqllib-data.js            SQL library (500+ queries, 12 categories)
├── ebs-academy-data.js           Academy (15 modules × topics + AI responses)
├── ebs-ica-integration.js        ICA Context Studio + MCP Gateway
├── start-all.bat                 One-command team deployment
│
├── backend/
│   ├── app/main.py
│   ├── app/routes/chat.py
│   ├── app/routes/health.py
│   ├── app/config.py
│   └── .env                      ICA_API_KEY + MCP_BEARER_TOKEN (never committed)
│
├── docs/
│   ├── TECHNICAL_SPEC.md
│   ├── FUNCTIONAL_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── PROJECT_OVERVIEW.md
│   └── BOB_USAGE.md
│
└── ica-schema/
    ├── ebs-ontology.jsonld              OWL 2 ontology (30+ classes, 52+ properties)
    ├── ebs-complete-ontology.jsonld     PRIMARY ICA upload
    ├── ebs-context-config.csv           Context config (v6.0 — incl. DASC + team reuse)
    └── csv/
        ├── ebs_nodes.csv               Nodes (incl. DASC + ICA + Reuse nodes)
        ├── ebs_edges.csv               Edges
        ├── column_mapping_rules.csv    100 Data Connect column mappings
        └── natural_language_queries.csv 115+ NL query → report/tab mappings
```

---

*Oracle EBS Intelligence Hub v6.0 | Cook County AMS Project | IBM BoB Challenge 2025 | Built with IBM Bob · 🛡️ DASC-Compliant · ♻️ Team Reuse Ready*

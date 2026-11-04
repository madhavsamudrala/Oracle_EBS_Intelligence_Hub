# Architecture Document
## Oracle EBS Intelligence Hub v6.0

---

## Overview

The Oracle EBS Intelligence Hub is a **pure browser-based application** augmented by an optional **FastAPI backend** for live ICA Context Studio integration. It follows a layered architecture with clear separation between data, logic, presentation, and integration layers.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Static App)                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  oracle-ebs-intelligence-hub.html  —  Shell, tabs, modals, layout    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐     │
│  │ebs-reports.js│  │ebs-reports   │  │ ebs-ica-integration   │     │
│  │(main ~8300L) │  │-additions.css│  │ .js  (ICA layer)      │     │
│  └──────┬───────┘  └──────────────┘  └──────────┬────────────┘     │
│         │                                         │                   │
│  ┌──────▼──────────────────────────────────────┐ │                   │
│  │            Data Layer (JS modules)           │ │                   │
│  │  ebs-reports-data.js  — 26 reports + data   │ │                   │
│  │  ebs-sqllib-data.js   — 500+ SQL queries    │ │                   │
│  │  ebs-academy-data.js  — 15 academy modules  │ │                   │
│  └─────────────────────────────────────────────┘ │                   │
│                                                    │                   │
└────────────────────────────────────────────────────│──────────────────┘
                                                      │ HTTP POST (optional)
                                          ┌───────────▼────────────────┐
                                          │   FastAPI Backend (v6.0)   │
                                          │   backend/app/main.py      │
                                          │                            │
                                          │  Routes:                   │
                                          │  GET/POST /health          │
                                          │  POST /api/chat            │
                                          │  POST /api/sql_advisor     │
                                          │  POST /api/academy         │
                                          │  POST /api/intelligence    │
                                          │                            │
                                          │  Services:                 │
                                          │  ICAWorkflowService        │
                                          │  ComplianceChecker         │
                                          └────────────────────────────┘
```

---

## Component Descriptions

### Frontend Components

| File | Purpose | Lines |
|---|---|---|
| `oracle-ebs-intelligence-hub.html` | Main shell: tabs, modals, login, layout | ~2,380 |
| `ebs-reports.js` | All app logic: chat, reports, SQL, academy, data connect | ~8,350 |
| `ebs-reports.css` | Core styles: Oracle Blue theme, all tab layouts | ~7,044 |
| `ebs-reports-additions.css` | ICA-specific styles: badge, panel, compliance | ~390 |
| `ebs-ica-integration.js` | ICA service layer + fallback logic | ~630 |
| `ebs-reports-data.js` | 26 EBS reports with columns and sample data | ~1,200 |
| `ebs-sqllib-data.js` | 500+ categorised Oracle SQL queries | ~3,000 |
| `ebs-academy-data.js` | 15 academy modules with topic content | ~2,500 |

### Backend Components

| File | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app, CORS, router registration |
| `backend/app/config.py` | Settings from `.env` via pydantic-settings |
| `backend/app/routes/health.py` | `GET/POST /health` — connectivity check |
| `backend/app/routes/chat.py` | `POST /api/chat` — chat message enrichment |
| `backend/app/routes/sql_advisor.py` | `POST /api/sql_advisor` — SQL compliance |
| `backend/app/routes/academy.py` | `POST /api/academy` — topic context |
| `backend/app/routes/intelligence.py` | `POST /api/intelligence` — panel data |
| `backend/app/services/ica_workflow_service.py` | Module→tables/reports/rules lookup |
| `backend/app/services/compliance_checker.py` | 28-rule SQL compliance engine |

### Schema / ICA Assets

| File | Purpose |
|---|---|
| `ica-schema/ebs-complete-ontology.jsonld` | Full OWL ontology (2,008 lines) |
| `ica-schema/ebs-knowledge-graph-schema.json` | KG node/edge type definitions |
| `ica-schema/01-nodes.json` | 80+ graph nodes |
| `ica-schema/02-rules.json` | RULE_001–RULE_028 definitions |
| `ica-schema/03-relationships.json` | REL_001–REL_030 definitions |
| `ica-schema/csv/ebs_nodes.csv` | Node registry (155 rows, 10 types) |
| `ica-schema/csv/ebs_edges.csv` | Edge registry (79 rows, 5 types) |
| `ica-schema/csv/column_mapping_rules.csv` | 100 Data Connect mapping rules |

---

## Data Flow

### Chat Assistant Flow
```
User types message
  → sendChatMessage() [ebs-reports.js]
  → _icaDetectModule() [ebs-ica-integration.js]  ← detect AP/GL/HRMS etc.
  → icaService.enrichChatMessage()               ← POST /api/chat (or local fallback)
  → generateChatResponse() [ebs-reports.js]      ← intent matching → report key
  → showReportPreviewInChat()                    ← render table + chart
  → _icaAppendInsightToChat()                    ← ICA context bubble
```

### SQL Compliance Flow
```
User pastes SQL in SQL Advisor
  → analyzeSQL() [ebs-reports.js]
  → window.icaCheckSQL(sql, containerId)         ← from ebs-ica-integration.js
  → icaService.checkSQLCompliance(sql)           ← POST /api/sql_advisor (or local)
  → icaRenderComplianceResults()                 ← render findings panel
```

### Data Connect Flow
```
User drops Excel/CSV file
  → _dcLoadFile() → _dcParseActiveSheet()
  → _dcDetectType() per column
  → dcTargetChanged() → dcAutoMap()              ← fuzzy name matching
  → column_mapping_rules.csv (100 rules)
  → dcApplyMapping() → _dcRenderGrid()
  → dcPushToReports() → switchTab('tab-reports')
```

---

## Security Considerations

- **Browser-only**: no data leaves the browser unless the optional backend proxy is configured
- **Passwords**: stored only in JS constants, not persisted to localStorage or cookies
- **Backend**: runs locally at `localhost:8000` — not exposed to the internet
- **SQL execution**: SQL Advisor is **analysis only** — no query execution against any database
- **Data Connect live DB**: requires an explicit proxy URL configured by the user; credentials are never stored

---

## Deployment

### Static (no backend)
Simply open `oracle-ebs-intelligence-hub.html` in a browser. All features work in local fallback mode.

### With Backend (ICA live mode)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Then open `oracle-ebs-intelligence-hub.html`. The ICA badge will show **● ICA Live**.

### Hosting on a Web Server
Copy all root-level files to any static file host (Apache, Nginx, GitHub Pages). The backend must be deployed separately if live ICA enrichment is needed.

---

## Versioning

| Version | Key Changes |
|---|---|
| v3.0 | Initial release — core reports, chat, SQL advisor |
| v5.0 | Academy, SQL Lab, Doc Generator, Data Connect |
| v5.2 | ICA ontology v2, RICE taxonomy, 28 SQL rules, 100 mapping rules |
| v6.0 | FastAPI backend, ebs-ica-integration.js, ICA status badge, intelligence panel, ebs_nodes/edges CSV updates |

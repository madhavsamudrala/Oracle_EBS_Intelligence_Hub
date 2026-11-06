# Oracle EBS Intelligence Hub
## Technical Specification

**Version:** 6.0
**Date:** July 2025
**Author:** Cook County AMS Project — IBM ICA Oracle EBS Team
**Status:** Production Ready | IBM BoB Challenge Submission

---

## 1. TECHNICAL OVERVIEW

### 1.1 Architecture Philosophy

The Oracle EBS Intelligence Hub is a **pure client-side Single Page Application (SPA)** — zero backend, zero installation, zero infrastructure cost. Every feature runs inside the user's browser using HTML5 + CSS3 + ES6+ JavaScript.

| Principle | Detail |
|---|---|
| **FastAPI Backend** | Python FastAPI at `localhost:8000` — proxies ICA MCP, stores secrets, health check |
| **SPA Frontend** | All UI in browser — HTML5 + CSS3 + ES6+ JS, no framework |
| **ICA MCP Gateway** | Chat connects to IBM ICA Context Studio via MCP — 17,000+ chars per query |
| **DASC Compliant** | IBM Digital AppSec Champion — role-based access, zero-trust API, audit trail |
| **Role-Based UI** | Employee (3 tabs) / Technical (7 tabs) — enforced in `_applyRoleTabVisibility()` |
| **In-Memory State** | All report data in JS objects — cleared on page refresh |
| **Zero-Trust Secrets** | ICA API key + MCP token in `backend/.env` only — never in client code |
| **One-Command Deploy** | `start-all.bat` starts frontend + backend + ICA for entire team |

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Markup | HTML5 | — | Login screen, DASC info bar, 7 tab panels, modals |
| Styling | CSS3 | — | Oracle Blue theme, DASC styling, responsive layout |
| Logic | JavaScript ES6+ | ES2020+ | All app behaviour + DASC enforcement (~8300+ lines) |
| Backend | Python FastAPI | 0.104+ | ICA MCP proxy, health check, secrets management |
| AI | IBM ICA Context Studio | MCP | 17,000+ chars enterprise EBS knowledge per query |
| Charts | Chart.js | 4.4.0 | Bar / line / pie / doughnut charts on reports |
| Excel I/O | SheetJS (xlsx) | 0.18.5 | Excel import (Data Connect) and Excel export |
| PDF Export | FileSaver.js | 2.0.5 | Browser-side file download |
| Fonts | IBM Plex Sans / Mono | — | Google Fonts CDN |

### 1.3 File Inventory

| File | Lines (approx.) | Role |
|---|---|---|
| `oracle-ebs-intelligence-hub.html` | ~2900 | HTML shell — login, DASC info bar, 7 tabs, modals |
| `ebs-reports.js` | ~8500+ | App logic + DASC enforcement + `_showDascInfoBar()` |
| `ebs-reports.css` | ~5200 | Styles — Oracle Blue theme, responsive |
| `ebs-ica-integration.js` | ~800 | ICA Context Studio + MCP Gateway integration |
| `ebs-reports-data.js` | ~3500 | 26 report definitions + sample data |
| `ebs-sqllib-data.js` | ~2000 | SQL Library — 500+ queries in 12 categories |
| `ebs-academy-data.js` | ~2500 | Academy — 15 modules × topics + AI responses |
| `backend/app/main.py` | ~100 | FastAPI app entry point |
| `backend/app/routes/chat.py` | ~150 | ICA MCP chat proxy route |
| `backend/app/routes/health.py` | ~50 | Health check + ICA status |
| `backend/app/.env` | — | Secrets: `ICA_API_KEY`, `MCP_BEARER_TOKEN` |
| `start-all.bat` | ~30 | One-command team deployment |

### 1.4 Browser Compatibility

| Browser | Min Version | Notes |
|---|---|---|
| Chrome | 90+ | Fully supported |
| Edge | 90+ | Fully supported |
| Firefox | 88+ | Fully supported |
| Safari | 14+ | `navigator.clipboard` requires HTTPS |
| Mobile Chrome | Android 10+ | Supported |
| Mobile Safari | iOS 14+ | Supported |

---

## 2. AUTHENTICATION, ROLE SYSTEM & DASC SECURITY

### 2.1 Login Flow

```
Landing Page (roleLanding)
  ↓ DASC banner shown (light mint — not dominant)
  ↓ User selects role card (Employee | Technical)
  → rlSelectOpt(role)           — highlights selected card
  → rlGoToLogin()               — shows password step
  ↓ User enters password → rlDoLogin()
  → validates credentials (RL_CREDENTIALS — no server call)
  → selectRole(role)            — stores role in APP_ROLE
  → _applyRoleTabVisibility(role) — Employee: 3 tabs only; Technical: all 7
  → _showDascInfoBar(role)      — shows role clearance bar below tabs
  → ICA health check begins     — polls /health every 30s, updates ICA badge
  → hides roleLanding, shows app chrome
```

### 2.2 DASC Security Implementation

**IBM Digital AppSec Champion (DASC) compliance is enforced at every layer:**

| Layer | Implementation |
|---|---|
| **Least Privilege** | `_applyRoleTabVisibility()` — Employee tabs `display:none`, not just disabled |
| **No Curiosity Triggers** | Employee never sees ❌ or names of restricted tabs — app feels complete |
| **DASC Info Bar** | `_showDascInfoBar(role)` — role-specific clearance bar, hidden on logout |
| **Zero-Trust API** | `ICA_API_KEY` + `MCP_BEARER_TOKEN` in `backend/.env` — never in client JS |
| **Dual-Control Delete** | Employee request → `DELETE_REQUESTS[reqId]` → Technical approval gate |
| **Audit Trail** | Immutable entry at each step: request, approve/reject, delete, restore |
| **Recycle Bin** | `RECYCLE_BIN[key]` snapshot — full restore always available |

### 2.3 Credentials

| Role | Password | Clearance |
|---|---|---|
| Employee | _local ebs-credentials.js_ | Standard — Chat, Reports, Data Connect |
| Technical | _local ebs-credentials.js_ | Full — All 7 tabs + governance |

Validated in [`rlDoLogin()`](../ebs-reports.js) via `RL_CREDENTIALS` object. No hashing, no server call.

### 2.4 Tab Visibility by Role

**Employee (Standard Clearance):** Chat Assistant · EBS Reports · Data Connect
**Technical (Full Clearance):** All 7 tabs + governance controls

Controlled by [`_applyRoleTabVisibility(role)`](../ebs-reports.js):
```javascript
// Technical-only tabs set to display:none for Employee
btn.style.display = role === 'employee' ? 'none' : '';
```

### 2.5 DASC Info Bar (`_showDascInfoBar`)

```javascript
// Called in selectRole() on login, hides in rlLogout()
function _showDascInfoBar(role) {
  // Employee: light mint bar — shows 3 accessible tabs only
  // Technical: soft blue bar — shows all 7 tab clearances
}
```

Employee bar: `background:#f0f7f4; border-bottom:1px solid #a7d9c0` — informative, not dominant
Technical bar: `background:#f0f5ff; border-bottom:1px solid #b8ccf0`

---

## 3. STATE MANAGEMENT

### 3.1 Global Registries

```javascript
// Role & credentials
const APP_ROLE           = { current: null }          // 'employee' | 'technical'
const RL_CREDENTIALS     = window.EBS_CREDENTIALS || {}  // loaded from git-ignored ebs-credentials.js

// Reports
const IMPORTED_REPORTS   = {}   // { [key]: true }  — reports loaded via Data Connect
const DELETE_REQUESTS    = {}   // { [reqId]: {key, title, reason, notes, status} }
const RECYCLE_BIN        = {}   // { [key]: {title, columns, rows, ...} }  — deleted snapshots
const DELETED_REPORTS    = {}   // { [key]: true }  — gates loadReport()
const _REPORT_DATA_BACKUP = {}  // original rows before first Data Connect push

// APP navigation object
const APP = {
  currentReport: null,       // active report key
  allRows: [],               // all rows for current report (pre-filter)
  filteredRows: [],          // rows after year/month/search filter
  currentPage: 1,
  pageSize: 25,
  chartInstance: null,       // Chart.js instance (report tab)
  chatChartInstance: null,   // Chart.js instance (chat preview)
  currentChartType: 'bar',
  currentChartDim: 'month',
  navigationHistory: ['home'],
  tabHistory: ['tab-chat'],
  currentTab: 'tab-chat',
  sqlInAdvisor: '',
  paramCount: 1,
  tableCount: 1,
  vsCount: 1,
}
```

### 3.2 Navigation Model

```
TAB NAVIGATION (breadcrumb back stack):
  tabHistory = ['tab-chat']
  Click SQL Advisor → push 'tab-chat' → ['tab-chat']
  Click Back → pop → return to 'tab-chat'

REPORT NAVIGATION (within EBS Reports tab):
  navigationHistory = ['home']
  Open Invoice Register → push 'invoice_register' → ['home', 'invoice_register']
  Open another report  → push new key
  Click Back           → pop → previous report or 'home' welcome screen
```

---

## 4. COMPONENT ARCHITECTURE

### 4.1 HTML Panel Structure

```
oracle-ebs-intelligence-hub.html
├── #roleLanding              Login screen (2-step: role select → password)
│   ├── .role-landing-left    Branding panel (IBM logo, feature pills)
│   └── .role-landing-right   Login form (role cards, password, submit)
│
├── .ebs-navbar               Top navigation bar
│   ├── .nav-tabs             Tab buttons (role-filtered)
│   ├── .nav-user-pill        Logged-in user + role badge
│   └── #notifBell            Notification bell + badge (Technical only)
│
├── #tab-chat                 Chat Assistant tab
│   ├── .chat-messages        Message history
│   ├── .chat-input-bar       Text input + send button + upload
│   └── #chatPreview          Inline report preview modal
│
├── #tab-reports              EBS Reports tab
│   ├── .reports-sidebar      Module groups + report list
│   ├── #reportWelcome        Welcome card grid (16 quick-launch cards)
│   └── #reportContent        Active report: filters + table + chart + SQL
│
├── #tab-sql                  SQL Advisor tab (3 sub-tabs)
│   ├── #sql-perf-tab         Performance Advisor
│   ├── #sql-codereview-tab   Code Review (27 checks)
│   └── #sql-formatter-tab    Code Formatter
│
├── #tab-sqllab               SQL Lab tab
│   ├── #sqlLabCategoryTree   Category tree sidebar
│   ├── #sqlLabWelcome        Welcome + prompt input
│   └── #sqlLabResult         AI result: SQL + tags + actions
│
├── #tab-academy              EBS Academy tab
│   ├── #academyModuleTree    Module tree sidebar
│   ├── #academyWelcome       Welcome / module cards
│   └── #academyContent       Topic content + flowchart + SQL
│
├── #tab-dataconnect          Data Connect tab
│   ├── .dc-sidebar           Source selector (Excel | DB)
│   ├── #dcWelcome            Welcome screen
│   ├── #dcMappingArea        Column mapping table
│   └── #dcPreviewArea        Mapped data preview grid
│
├── #tab-docgen               Document Generator tab
│
├── #deleteConfirmOverlay     Custom delete confirm modal
├── #deleteRequestModal       Employee delete request form
└── #notifPanel               Notification + Recycle Bin slide panel
```

### 4.2 Key Function Groups

| Group | Functions | Lines |
|---|---|---|
| Auth / Login | `rlDoLogin`, `selectRole`, `rlLogout`, `_applyRoleTabVisibility` | ~57–240 |
| Delete / Recycle | `deleteCurrentReport`, `deleteImportedReport`, `_doDeleteReport`, `restoreDeletedReport`, `_hideSidebarItem`, `_showSidebarItem` | ~280–510 |
| Notifications | `openNotifPanel`, `renderNotifPanel`, `_refreshNotifBadge`, `resolveDeleteRequest` | ~989–1195 |
| Report Loading | `loadReport`, `renderTable`, `applyFilters`, `resetFilters` | ~794–1630 |
| Chart | `toggleChart`, `changeChartType`, `renderReportChart` | ~1655–1760 |
| Downloads | `downloadReport`, `downloadAsCSV`, `downloadAsExcel`, `downloadAsPDF` | ~1759–1830 |
| Chat | `sendChatMessage`, `generateChatResponse`, `showReportPreviewInChat` | ~1838–2070 |
| SQL Advisor | `analyzeSQL`, `performSQLAnalysis`, `generateOptimizedSQL` | ~2330–2560 |
| Code Review | `performCodeReview` (27 checks) | ~3942–4464 |
| SQL Formatter | `formatSQL`, `formatSelectStatement`, `formatByClause`, `formatDML`, `formatPLSQL` | ~4645–5027 |
| SQL Lab | `initSqlLab`, `generateSqlFromPrompt`, `_isNonEBSPrompt`, `_showSqlLabResult` | ~5038–5790 |
| Academy | `initAcademy`, `loadAcademyTopic`, `generateAsstResponse` | ~5843–7530 |
| Data Connect | `initDataConnect`, `dcRunDbQuery`, `dcRunLiveQuery`, `dcApplyMapping`, `dcPushToReports` | ~7532–8360 |

---

## 5. DELETE & RECYCLE BIN SYSTEM

### 5.1 Delete Flow

```
deleteCurrentReport()
  ├── if Employee role → openDeleteRequestDialog(key)   [sends request to Technical]
  └── if Technical role → _showDeleteConfirm(key, title) [shows custom confirm modal]
            ↓ user clicks OK
        _deleteConfirmOK()
            ↓
        _doDeleteReport(key)
          ├── RECYCLE_BIN[key] = { title, columns, rows, module, source, deletedAt }
          ├── DELETED_REPORTS[key] = true
          ├── if IMPORTED_REPORTS[key] → delete from IMPORTED_REPORTS + REPORT_DATA
          ├── _hideSidebarItem(key)    — hides sidebar link
          ├── _refreshNotifBadge()    — updates bell badge count
          └── clears DOM, shows welcome screen
```

### 5.2 Restore Flow

```
Technical opens Notification Panel → Recycle Bin tab
  → restoreDeletedReport(key)
      ├── REPORT_DATA[key] = RECYCLE_BIN[key] snapshot
      ├── delete DELETED_REPORTS[key]
      ├── IMPORTED_REPORTS[key] = true
      ├── _showSidebarItem(key)   — re-shows sidebar link
      ├── delete RECYCLE_BIN[key]
      └── renderNotifPanel()      — refreshes panel
```

### 5.3 Employee Delete Request Flow

```
Employee clicks Delete → openDeleteRequestDialog(key)
  → Modal: reason dropdown + notes textarea + Send Request
  → submitDeleteRequest()
      ├── DELETE_REQUESTS[reqId] = { key, title, reason, notes, status:'pending' }
      ├── _refreshNotifBadge()   — increments Technical bell badge
      └── shows confirmation toast

Technical opens Notification Panel → Pending Requests tab
  → resolveDeleteRequest(reqId, 'approve' | 'reject')
      ├── if approve → _doDeleteReport(key)
      └── UPDATE status, re-render panel
```

---

## 6. SQL LAB — AI ENGINE

### 6.1 Architecture

SQL Lab has **no LLM integration**. All SQL generation is rule-based:

```
generateSqlFromPrompt()
  ↓
_isNonEBSPrompt(prompt)    — blocks Python/Java/weather/HR etc.
  ↓
tokenise prompt → filter _SQL_STOP_WORDS
  ↓
score each query in EBS_SQL_LIBRARY against meaningful tokens
  ↓
pick highest score if score > threshold (meaningful token count × 0.4)
  ↓
_showSqlLabResult() or _showOutOfScope()
```

### 6.2 Stop Words & Domain Tokens

```javascript
_SQL_STOP_WORDS = { 'show','me','the','a','an','for','from','of','give','get',...}
_EBS_DOMAIN_TOKENS = ['invoice','supplier','vendor','payment','gl','journal',
                      'employee','payroll','purchase','order','expense','customer',...]
```

### 6.3 Out-of-Scope Detection

If the prompt contains no EBS domain tokens AND matches non-EBS patterns (Python keywords, weather terms, general coding etc.), [`_isNonEBSPrompt()`](../ebs-reports.js:5403) returns `true` and [`_showOutOfScope()`](../ebs-reports.js:5349) is called — displaying a friendly "I only handle Oracle EBS SQL" message.

---

## 7. ACADEMY — AI ASSISTANT ENGINE

### 7.1 Architecture

```
generateAsstResponse(question)
  ↓
40+ if/else keyword blocks — each covering a module/topic area
  ↓
Returns static HTML string with headings, bullet points, code blocks
```

No LLM. Responses are pre-written strings selected by keyword matching on the lowercased question.

### 7.2 Module Coverage (15 Modules)

| # | Module | Topics |
|---|---|---|
| 1 | Accounts Payable | Invoice lifecycle, 3-way match, holds, payments |
| 2 | Accounts Receivable | Customer setup, invoicing, cash application |
| 3 | General Ledger | Chart of accounts, journals, period close |
| 4 | iExpense | Expense reports, approval workflow, credit cards |
| 5 | HRMS | Employee records, assignments, DateTrack |
| 6 | Purchasing / PO | Requisitions, PO types, receipts, 3-way match |
| 7 | Inventory | Items, transactions, valuations, cycle count |
| 8 | Concurrent Programs | Request submission, parameters, output |
| 9 | DBA & System Admin | Patching (adop), cloning, performance, RMAN |
| 10 | EBS Architecture | Three-tier, Multi-Org, ORG_ID |
| 11 | SOA & Integration | SOA Suite, OIC, Open Interfaces, Business Events, EDI |
| 12 | Oracle APEX & Modernisation | APEX foundation, EBS-to-APEX, EBS→Fusion roadmap |
| 13 | Testing & QA | Unit/SIT/UAT/Regression, OATS, SQL validation |
| 14 | Security & Access Control | Users, Responsibilities, Menus, Functions, Audit Trail |
| 15 | Project Manager Guide | OUM/AIM, CRP, Cutover, Hypercare, Team Roles |

---

## 8. DATA CONNECT — ETL PIPELINE

### 8.0 Three Import Paths

```
Excel/CSV Upload ──────── SheetJS parse ──→ DC.rawHeaders / DC.rawRows
DB Simulated ──────────── TABLE_MAP lookup ──→ demo REPORT_DATA rows
Live Oracle DB ────────── POST proxy /query ──→ {columns, rows} JSON

                                  ↓  (all paths converge)
                           dcAutoMap() — fuzzy normalised column matching
                                  ↓
                        _dcRenderMappingTable() — user reviews mapping
                                  ↓
                         dcApplyMapping() — applies transforms → previewRows
                                  ↓
                         dcPushToReports() — swaps REPORT_DATA[key].rows
```

### 8.1 Excel/CSV Path

```
_dcLoadFile(file)           — FileReader reads binary
  ↓ XLSX.utils.sheet_to_json()
_dcParseActiveSheet()       — extracts headers + data rows (up to 5000)
_dcDetectType()             — samples 50 rows → 'number'|'date'|'text'|'bool'|'mixed'
_dcShowMapping()            — renders mapping table UI
dcAutoMap()                 — fuzzy normalised name matching
dcApplyMapping()            — builds previewRows with transforms applied
_dcShowPreview()            — paginated grid + data profile bar
dcPushToReports()           — swaps REPORT_DATA[key].rows in memory
```

### 8.2 DB Simulated Path

```
dcRunDbQuery()
  ↓ parse SQL text for table names
  ↓ TABLE_MAP lookup → matched report key
  ↓ loads that report's demo data into DC state
  ↓ identity auto-map → _dcShowMapping() → dcApplyMapping()

Supported table names:
  ap_invoices_all, ap_suppliers, ar_customers, gl_je_headers,
  per_all_people_f, po_headers_all, fnd_concurrent_requests
```

### 8.3 Live DB Path

```
User fills: Host / Port / SID / Username / Password / Proxy URL
dcTestConnection()   — OPTIONS fetch to proxy to verify reachability
dcRunLiveQuery()     — POST {sql, host, port, sid, user, pass} to proxy
  ↓ proxy returns { columns: string[], rows: any[][] }
  ↓ loaded into DC state → mapping → preview → push
```

**Proxy API contract:**
```
POST /query
Content-Type: application/json
Body:    { "sql": "...", "host": "...", "port": "1521", "sid": "EBSPROD", "user": "...", "pass": "..." }
Returns: { "columns": ["COL1","COL2"], "rows": [["val1","val2"]] }
```

Proxy implementations: Node.js + `oracledb`, or Python + `cx_Oracle`.
Must set `Access-Control-Allow-Origin: *` response header for browser CORS.

### 8.4 Column Mapping — dcAutoMap()

```javascript
// Normalisation: lowercase + strip spaces/underscores/special chars
const norm = hdr.toLowerCase().replace(/[\s_\/\-\.#]/g, '');
// Match if: exact | target-includes-source | source-includes-target
const match = targets.find(t => {
  const tn = t.toLowerCase().replace(/[\s_\/\-\.#]/g, '');
  return tn === norm || tn.includes(norm) || norm.includes(tn);
});
```

**Column Mapping Rules CSV** — [`ica-schema/csv/column_mapping_rules.csv`](../ica-schema/csv/column_mapping_rules.csv)
documents 100 known source→target column mappings with confidence scores and transform
suggestions. Covers all 7 EBS modules. Examples:

| Source Column | Normalised | Target Column | Confidence |
|---|---|---|---|
| `Vendor Name` | `vendorname` | `VENDOR_NAME` | 1.0 |
| `Supplier Name` | `suppliername` | `VENDOR_NAME` | 0.85 |
| `Join Date` | `joindate` | `HIRE_DATE` | 0.85 |
| `Days Past Due` | `dayspastdue` | `DAYS_OVERDUE` | 0.85 |
| `Invoice No` | `invoiceno` | `INVOICE_NUM` | 0.85 |
| `Accounting Period` | `accountingperiod` | `PERIOD_NAME` | 0.85 |
| `ORG_ID` | `orgid` | `ORG_ID` | 1.0 (required on all _ALL tables) |

### 8.5 Transforms Available

| Transform ID | Action | Example |
|---|---|---|
| `trim` | Strip leading/trailing whitespace | `" ABC "` → `"ABC"` |
| `upper` | Convert to UPPERCASE | `"invoice"` → `"INVOICE"` |
| `lower` | Convert to lowercase | `"VENDOR"` → `"vendor"` |
| `title` | Title Case each word | `"ahmed al mansoori"` → `"Ahmed Al Mansoori"` |
| `date_fmt` | Normalise to YYYY-MM-DD | `"01/15/2024"` → `"2024-01-15"` |
| `num_fmt` | `toLocaleString` 2 decimal places | `"15000"` → `"15,000.00"` |

---

## 9. ICA ONTOLOGY — KNOWLEDGE GRAPH (v5.2)

The [`ica-schema/`](../ica-schema/) directory contains the full **ICA Context Studio schema and OWL 2 ontology** for uploading into IBM ICA Context Studio. Derived from `bob ontology guide.txt` Sections A–AE.

### 9.1 Files

| File | Format | Purpose |
|------|--------|---------|
| [`ebs-ontology.jsonld`](../ica-schema/ebs-ontology.jsonld) | JSON-LD / OWL | **30+ OWL classes**, 52+ properties |
| [`ebs-complete-ontology.jsonld`](../ica-schema/ebs-complete-ontology.jsonld) | JSON-LD | **PRIMARY UPLOAD** — 2008 lines, all entity instances |
| [`ebs-knowledge-graph-schema.json`](../ica-schema/ebs-knowledge-graph-schema.json) | JSON | 29 node types, 24 edge types, Data Connect spec |
| [`csv/ebs_nodes.csv`](../ica-schema/csv/ebs_nodes.csv) | CSV | 112+ node instances |
| [`csv/ebs_edges.csv`](../ica-schema/csv/ebs_edges.csv) | CSV | 52+ graph edges |
| [`csv/ebs_relationships.csv`](../ica-schema/csv/ebs_relationships.csv) | CSV | 15 Oracle EBS SQL JOIN relationships |
| [`csv/column_mapping_rules.csv`](../ica-schema/csv/column_mapping_rules.csv) | CSV | 100 column fuzzy mapping rules |
| [`csv/natural_language_queries.csv`](../ica-schema/csv/natural_language_queries.csv) | CSV | 115+ NL query → report/tab mappings |
| [`csv/approval_rules.csv`](../ica-schema/csv/approval_rules.csv) | CSV | 27+ SQL compliance rules |

### 9.2 OWL Classes (30+)

#### Core EBS Domain
| Class | OWL Superclass | Count |
|-------|----------------|-------|
| `ebs:OracleModule` | `schema:SoftwareApplication` | 13 instances |
| `ebs:BusinessProcess` | `schema:Action` | 4 (P2P, O2C, H2R, R2R) |
| `ebs:EBSReport` | `schema:Dataset` | 26 instances |
| `ebs:OracleTable` | `schema:Dataset` | 40+ |
| `ebs:BusinessRule` | — | 10 COMP + 28 RULE checks |
| `ebs:ComplianceRule` | `ebs:BusinessRule` | 38 total rules |
| `ebs:SQLPattern` | `schema:SoftwareSourceCode` | 6 templates |
| `ebs:NLQuery` | `schema:SearchAction` | 115+ |

#### RICE Taxonomy (11 new in v5.1/v5.2)
| Class | OWL Superclass | Instances |
|-------|----------------|---------|
| `ebs:RICEComponent` | `schema:SoftwareSourceCode` | base class |
| `ebs:EBSInterface` | `ebs:RICEComponent` | 3 (AP, GL, HR) |
| `ebs:EBSConversion` | `ebs:RICEComponent` | 3 (Supplier, GL Bal, AP Inv) |
| `ebs:EBSExtension` | `ebs:RICEComponent` | 2 (Trigger, Package) |
| `ebs:AMEConfiguration` | `schema:Action` | 2 (AP, PO) |
| `ebs:OracleWorkflow` | `schema:Action` | 3 (AP, PO, HR) |
| `ebs:OAFComponent` | `ebs:RICEComponent` | 1 |
| `ebs:SOAService` | `ebs:RICEComponent` | 1 |
| `ebs:APEXApplication` | `ebs:RICEComponent` | 1 |
| `ebs:ADFApplication` | `ebs:RICEComponent` | 1 |
| `ebs:RedwoodComponent` | `ebs:RICEComponent` | 1 |

#### Knowledge & Application
| Class | OWL Superclass | Count |
|-------|----------------|-------|
| `ebs:ModuleKnowledge` | `schema:LearningResource` | 15 topics |
| `ebs:AcademyModule` | `schema:Course` | 15 |
| `ebs:AcademyTopic` | `schema:LearningResource` | varies |
| `ebs:UserRole` | `schema:Role` | 2 |
| `ebs:AppTab` | — | 7 |
| `ebs:SQLQuery` | `schema:SoftwareSourceCode` | 500+ |
| `ebs:SQLCategory` | — | 12 |
| `ebs:DataConnectSource` | `schema:DataFeed` | 3 |
| `ebs:ColumnMapping` | `schema:PropertyValue` | 100 rules |
| `ebs:DeleteRequest` | `schema:Action` | runtime |
| `ebs:RecycleBinEntry` | `schema:CreativeWork` | runtime |
| `ebs:Employee` | `schema:Person` | sample |
| `ebs:Supplier` | `schema:Organization` | sample |
| `ebs:DocumentTemplate` | `schema:DigitalDocument` | 2 |
| `ebs:OperatingUnit` | `schema:Organization` | 3 sample |

### 9.3 ICA Context Studio Upload Order (v5.2)

```
1.  ebs-ontology.jsonld               (JSON-LD — OWL 30+ classes, 52+ properties)
2.  ebs-complete-ontology.jsonld      (JSON-LD — PRIMARY: all entity instances, 2008 lines)
3.  ebs-knowledge-graph-schema.json   (JSON  — 29 node types, 24 edge types)
4.  csv/ebs_nodes.csv                 (CSV   — 112+ nodes including RICE/AME/WF/ModuleKnowledge)
5.  csv/ebs_edges.csv                 (CSV   — 52+ graph edges)
6.  csv/ebs_relationships.csv         (CSV   — SQL JOIN paths)
7.  csv/column_mapping_rules.csv      (CSV   — Data Connect 100 column mappings)
8.  csv/natural_language_queries.csv  (CSV   — 115+ chat intent mappings)
9.  csv/approval_rules.csv            (CSV   — SQL compliance rules)
10. ebs-context-config.csv            (CSV   — context configuration)
```

---

## 10. SECURITY MODEL

| Concern | Approach |
|---|---|
| XSS | `escHTML()` wraps all user-sourced content before DOM insertion |
| SQL injection | Formatter/Advisor are static text transforms — no SQL execution |
| Password visibility | Credentials not displayed in login UI (removed in v5.0) |
| Sample data | All demo data uses synthetic names and amounts |
| Clipboard | Uses `navigator.clipboard` (requires HTTPS or localhost) |
| No external calls | Core app makes zero network requests (CDN libs only on load) |
| Live DB pass | Credentials sent only to user-configured proxy URL via POST |

---

## 10. CSS ARCHITECTURE

### 10.1 Theme Variables

```css
--oracle-blue:       #0572CE;   /* Primary brand blue */
--oracle-dark:       #003366;   /* Dark navy */
--oracle-darker:     #00274D;   /* Deepest navy */
--oracle-light:      #E8F4FD;   /* Light blue background */
--oracle-accent:     #FF6B35;   /* Accent orange */
--success:           #28A745;
--warning:           #FFC107;
--danger:            #DC3545;
```

### 10.2 Tab Isolation Pattern

```css
.tab-content          { display: none !important; }
.tab-content.active   { display: block !important; }
.tab-hidden           { display: none !important; }  /* role-filtered tabs */
```

### 10.3 Key Component Classes

| Class | Purpose |
|---|---|
| `.role-landing` | Full-screen login overlay |
| `.ebs-navbar` | Top navigation bar |
| `.reports-sidebar` | Module/report tree |
| `.dc-mapping-table` | Data Connect column mapping |
| `.sqllab-display` | SQL Lab output panel (overflow-y: auto) |
| `.notif-badge` | Notification bell count badge |
| `#deleteConfirmOverlay` | Custom delete confirm modal |

---

## 11. REVISION HISTORY

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2024-06 | Initial release — 4 tabs, 26 reports, Chat, SQL Advisor |
| v2.0 | 2024-10 | Code Review (27 checks), SQL Formatter, SVG diagrams |
| v3.0 | 2025-01 | IBM Carbon theme, Data Connect tab, XLSX import |
| **v6.0** | **2025-07** | **DASC security model** (`_showDascInfoBar`, `_applyRoleTabVisibility`); Employee least-privilege (no curiosity triggers); DASC info bar (mint/blue light theme); ICA MCP live badge; FastAPI backend (`start-all.bat`); Team Reuse Strategy; DASC + Reuse nodes in ICA ontology; Cook County AMS Project submission 13-page PDF |
| v4.0 | 2025-03 | Oracle Blue theme, role-based login, fiscal date fix |
| v5.2 | 2025-07 | **Ontology v5.2**: 30+ OWL classes, 52+ properties; RICE taxonomy; ebs-complete-ontology.jsonld (2008 lines) |
| v5.1 | 2025-06 | RICE taxonomy OWL classes; ebs-complete-ontology.jsonld entity format |
| v5.0 | 2025-06 | SQL Lab AI, Academy (15 modules), Delete/Recycle Bin, password security fix, ontology (19 OWL classes), 100 column mapping rules |

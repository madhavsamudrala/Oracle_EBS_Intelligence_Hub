# Technical Design Document — Oracle EBS Intelligence Hub

**Version:** 6.0 | **Date:** July 2025 | **Status:** Production Ready

---

## 1. Executive Summary

The Oracle EBS Intelligence Hub is a **zero-dependency, pure client-side enterprise web application** delivering seven integrated capabilities: AI-driven chat assistant, 26-report EBS browser, SQL developer toolset (Performance Advisor, Code Review, Formatter), SQL Lab with 500+ query library and AI prompt-to-SQL, EBS Academy with 15 learning modules and AI assistant, Data Connect (Excel/DB import + column mapping), and document generator with SVG diagrams.

**Version 5.0 introduces:** Role-based login (Employee / Technical), EBS Academy (15 modules), SQL Lab AI, Delete / Recycle Bin system, Employee delete request workflow, Notification panel, and Data Connect live DB support.

---

## 2. Component Architecture

```
oracle-ebs-intelligence-hub.html      (~1700 lines)
├── <head>
│   ├── Chart.js 4.4.0 (CDN)
│   ├── FileSaver.js 2.0.5 (CDN)
│   ├── SheetJS xlsx 0.18.5 (CDN)
│   └── IBM Plex Sans/Mono (Google Fonts CDN)
├── <body>
│   ├── #roleLanding             2-step login: role select → password
│   ├── .ebs-navbar              Navigation bar + tab buttons + user pill + notif bell
│   ├── #tab-chat                Chat Assistant
│   ├── #tab-reports             EBS Reports Browser
│   │   ├── .reports-sidebar     Module groups + report list (26 items)
│   │   ├── #reportWelcome       Welcome grid (16 quick-launch cards)
│   │   └── #reportContent       Active report: filters + table + chart + SQL panel
│   ├── #tab-sql                 SQL Advisor
│   │   ├── #sql-perf-tab        Performance Advisor
│   │   ├── #sql-codereview-tab  Code Review (27 checks)
│   │   └── #sql-formatter-tab  Code Formatter
│   ├── #tab-sqllab              SQL Lab
│   │   ├── #sqlLabCategoryTree  Library category tree
│   │   ├── #sqlLabWelcome       Welcome + AI prompt input
│   │   └── #sqlLabResult        Generated SQL result panel
│   ├── #tab-academy             EBS Academy
│   │   ├── #academyModuleTree   Module tree (15 modules)
│   │   ├── #academyWelcome      Welcome / module cards
│   │   └── #academyContent      Topic: text + flowchart SVG + SQL
│   ├── #tab-dataconnect         Data Connect
│   │   ├── .dc-sidebar          Source selector (Excel/DB) + config
│   │   ├── #dcWelcome           Welcome (before file loaded)
│   │   ├── #dcMappingArea       Column mapping table UI
│   │   └── #dcPreviewArea       Mapped data preview grid
│   ├── #tab-docgen              Document Generator
│   ├── #deleteConfirmOverlay    Custom delete confirm modal
│   ├── #deleteRequestModal      Employee delete request form
│   ├── #notifPanel              Notification + Recycle Bin slide panel
│   ├── #dcMappingGuideModal     Data Connect mapping guide modal
│   └── #toastContainer          Toast notifications
│
ebs-reports.css              (~5200 lines)
├── CSS Reset & Oracle Blue Variables
├── Login / Landing page styles (.role-landing, .rl-*)
├── Navbar + tab button styles
├── EBS Reports: sidebar, table, filter, chart, SQL panel
├── SQL Advisor: performance, code review, formatter panels
├── SQL Lab: category tree, display panel (overflow-y:auto fixed v5.0)
├── Academy: module tree, content, flowchart, AI assistant panel
├── Data Connect: sidebar, mapping table, preview grid, profile bar
├── Document Generator: cover page, sections, SVG styles
├── Delete: confirm overlay, request modal
├── Notification panel + badge styles
└── Toast notifications
│
ebs-reports.js               (~8350 lines, 180+ functions)
├── AUTH:       rlDoLogin, selectRole, rlLogout, _applyRoleTabVisibility
├── DELETE:     deleteCurrentReport, _doDeleteReport, restoreDeletedReport
├── NOTIF:      renderNotifPanel, _refreshNotifBadge, resolveDeleteRequest
├── REPORTS:    loadReport, renderTable, applyFilters, renderReportChart
├── CHAT:       sendChatMessage, generateChatResponse, showReportPreviewInChat
├── SQL ADVSR:  analyzeSQL, performSQLAnalysis, generateOptimizedSQL
├── CODE REV:   performCodeReview (27 checks)
├── FORMATTER:  formatSQL, formatSelectStatement, formatPLSQL, formatDML
├── SQL LAB:    initSqlLab, generateSqlFromPrompt, _isNonEBSPrompt
├── ACADEMY:    initAcademy, loadAcademyTopic, generateAsstResponse (40+ handlers)
├── DATA CONN:  initDataConnect, dcApplyMapping, dcPushToReports, dcRunLiveQuery
└── DOC GEN:    generateDocument, buildDocHTML, generateProcessFlowSVG, generateERDiagramSVG
│
ebs-reports-data.js          (~3500 lines)
├── window.REPORT_DATA   { [key]: { title, module, sql, columns, rows[100] } } × 26
└── window.REPORT_LOV    parameter LOVs for date/org/module filtering
│
ebs-sqllib-data.js           (~2000 lines)
└── window.EBS_SQL_LIBRARY   { categories: [...], queries: [...] }  500+ queries
│
ebs-academy-data.js          (~2500 lines)
└── window.EBS_ACADEMY_DATA  { modules: [...] }  15 modules × topics × content
```

---

## 3. State Management

### APP Object

```javascript
const APP = {
  currentReport: null,          // active report key string
  allRows: [],                  // all rows for current report (pre-filter)
  filteredRows: [],             // rows after applying filters
  currentPage: 1,
  pageSize: 25,
  chartInstance: null,          // Chart.js instance (report tab)
  chatChartInstance: null,      // Chart.js instance (chat preview)
  currentChartType: 'bar',
  currentChartDim: 'month',
  navigationHistory: ['home'],  // report back-stack
  tabHistory: ['tab-chat'],     // tab back-stack
  currentTab: 'tab-chat',
  sqlInAdvisor: '',
  paramCount: 1,
  tableCount: 1,
  vsCount: 1,
}
```

### Global Registries (v5.0)

```javascript
const APP_ROLE        = { current: null }     // 'employee' | 'technical'
const IMPORTED_REPORTS = {}   // reports pushed via Data Connect
const DELETE_REQUESTS  = {}   // employee delete requests { reqId: {...} }
const RECYCLE_BIN      = {}   // deleted snapshots { key: { title, columns, rows... } }
const DELETED_REPORTS  = {}   // currently deleted keys — gates loadReport()
const _REPORT_DATA_BACKUP = {} // original rows before first Data Connect push

// Data Connect state
const DC = {
  source, rawWorkbook, rawFileName, activeSheet,
  rawHeaders, rawRows, colTypes,
  mapping, transforms, targetReport,
  previewRows, previewCols, previewPage, previewPageSz
}
```

---

## 4. Tab Isolation Architecture

```css
/* All tab content hidden by default */
.tab-content { display: none !important; }
/* Only active tab visible */
.tab-content.active { display: block !important; }
/* Role-filtered tabs */
.tab-hidden { display: none !important; }
```

```javascript
function switchTab(tabId, btn) {
  // 1. Hide ALL floating panels (prevents bleed across tabs)
  ['sqlResultsPanel','codeReviewPanel','sqlPanel','chartPanel',
   'compareSec','compareSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // 2. Remove active from all tabs
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  // 3. Show only target tab
  document.getElementById(tabId).classList.add('active');
  // 4. Lazy-init tabs on first open
  if (tabId === 'tab-sqllab')     initSqlLab();
  if (tabId === 'tab-academy')    initAcademy();
  if (tabId === 'tab-dataconnect') initDataConnect();
}
```

---

## 5. Authentication Architecture (v5.0)

```
Landing Page (#roleLanding)
  ↓ rlSelectOpt('employee'|'technical')    — highlights card
  ↓ rlGoToLogin()                          — slides to password step
  ↓ rlDoLogin()
      → validates against RL_CREDENTIALS
      → selectRole(role)
          → APP_ROLE.current = role
          → _applyRoleTabVisibility(role)   — adds/removes .tab-hidden
          → _updateHeaderUserPill(role)
          → _updateFooterTabList(role)
          → hides #roleLanding
          → shows main app
```

---

## 6. Delete & Recycle Bin Architecture (v5.0)

### Delete Flow

```
deleteCurrentReport()
  ├── Employee → openDeleteRequestDialog(key)
  │     → modal: reason + notes + Submit
  │     → submitDeleteRequest()
  │         → DELETE_REQUESTS[reqId] = { key, title, reason, notes, status:'pending' }
  │         → _refreshNotifBadge()
  └── Technical → _showDeleteConfirm(key, title)
        → custom modal (not window.confirm)
        → _deleteConfirmOK()
            → _doDeleteReport(key)
                → RECYCLE_BIN[key] = snapshot
                → DELETED_REPORTS[key] = true
                → if IMPORTED_REPORTS[key] → remove from REPORT_DATA
                → _hideSidebarItem(key)
                → _refreshNotifBadge()
                → clear DOM, show welcome
```

### Restore Flow

```
restoreDeletedReport(key)
  → REPORT_DATA[key] = RECYCLE_BIN[key]
  → delete DELETED_REPORTS[key]
  → IMPORTED_REPORTS[key] = true
  → _showSidebarItem(key)
  → delete RECYCLE_BIN[key]
  → renderNotifPanel()
```

### `loadReport()` Guard (v5.0)

```javascript
function loadReport(reportKey, ev) {
  if (DELETED_REPORTS[reportKey]) return;   // ← v5.0 guard
  // ... rest of load logic
}
```

---

## 7. SQL Lab — AI Engine (v5.0)

### Prompt-to-SQL Pipeline

```javascript
function generateSqlFromPrompt() {
  const prompt = input.trim().toLowerCase();

  // 1. Domain scope check — reject non-EBS prompts
  if (_isNonEBSPrompt(prompt)) {
    _showOutOfScope(prompt);
    return;
  }

  // 2. Tokenise → filter stop words
  const tokens = prompt.split(/\s+/)
    .filter(t => t.length > 2 && !_SQL_STOP_WORDS.has(t));

  // 3. Score each query in EBS_SQL_LIBRARY
  let best = null, bestScore = 0;
  EBS_SQL_LIBRARY.queries.forEach(q => {
    let score = 0;
    const haystack = (q.title + ' ' + q.description + ' ' + (q.tags||[]).join(' ')).toLowerCase();
    tokens.forEach(tok => { if (haystack.includes(tok)) score++; });
    if (score > bestScore) { bestScore = score; best = q; }
  });

  // 4. Threshold: score must exceed 40% of meaningful token count
  const threshold = Math.max(1, tokens.length * 0.4);
  if (bestScore < threshold || !best) {
    _showOutOfScope(prompt);
    return;
  }

  _showSqlLabResult(prompt, best.sql, best.tags, true);
}
```

### Key Constants

```javascript
_SQL_STOP_WORDS  = Set of 40 common English words filtered before scoring
_EBS_DOMAIN_TOKENS = ['invoice','supplier','vendor','payment','gl','journal',
                       'employee','payroll','purchase','po','expense',...]
```

---

## 8. Academy — AI Assistant Engine (v5.0)

### Response Generation

```javascript
function generateAsstResponse(q) {
  const lc = q.toLowerCase();

  if (lc.includes('invoice') || lc.includes('ap '))    return AP_RESPONSE;
  if (lc.includes('journal') || lc.includes('gl '))    return GL_RESPONSE;
  if (lc.includes('dba') || lc.includes('patch'))      return DBA_RESPONSE;
  if (lc.includes('apex') || lc.includes('fusion'))    return APEX_RESPONSE;
  if (lc.includes('soa') || lc.includes('integr'))     return SOA_RESPONSE;
  if (lc.includes('security') || lc.includes('resp'))  return SEC_RESPONSE;
  if (lc.includes('pm') || lc.includes('project'))     return PM_RESPONSE;
  // ... 40+ handlers total

  return DEFAULT_RESPONSE;   // "I can help with Oracle EBS topics..."
}
```

**No LLM, no API calls.** All 40+ handlers return pre-written static HTML strings.

---

## 9. Data Connect — ETL Pipeline

### Three Import Paths

```
Excel/CSV Upload ──────── SheetJS parse ──→ DC.rawHeaders / DC.rawRows
DB Simulated ──────────── TABLE_MAP lookup ──→ demo REPORT_DATA rows
Live Oracle DB ────────── POST proxy /query ──→ {columns, rows} JSON

                                  ↓  (all paths converge)
                           dcAutoMap() — fuzzy normalised column matching
                                  ↓
                        _dcRenderMappingTable() — user reviews/overrides
                                  ↓
                         dcApplyMapping() — applies transforms, builds preview
                                  ↓
                         dcPushToReports() — swaps REPORT_DATA[key].rows
```

### Column Mapping Algorithm

```javascript
// Normalise a column name: lowercase + strip all spaces/underscores/specials
function normalise(str) {
  return str.toLowerCase().replace(/[\s_\/\-\.#]/g, '');
}

// Auto-map algorithm (dcAutoMap)
DC.rawHeaders.forEach(hdr => {
  const norm = normalise(hdr);
  const match = targets.find(t => {
    const tn = normalise(t);
    return tn === norm           // exact match
        || tn.includes(norm)     // target contains source
        || norm.includes(tn);    // source contains target
  });
  if (match) DC.mapping[hdr] = match;
});
```

**Column Mapping Rules** — 100 pre-defined fuzzy mappings documented in
[`ica-schema/csv/column_mapping_rules.csv`](../ica-schema/csv/column_mapping_rules.csv).
These cover common synonyms across all 7 modules (e.g. "Supplier Name" → `VENDOR_NAME`,
"Join Date" → `HIRE_DATE`, "Days Past Due" → `DAYS_OVERDUE`).

### Type Detection

```javascript
function _dcDetectType(rows, colIdx) {
  // Sample first 50 rows, count numeric/date/bool values
  // Return 'number' | 'date' | 'text' | 'bool' | 'mixed'
  // based on >80% match ratio
}
```

### Data Transforms (6)

| ID | Action | Example |
|----|--------|---------|
| `trim` | Strip whitespace | `" ABC "` → `"ABC"` |
| `upper` | UPPER CASE | `"invoice"` → `"INVOICE"` |
| `lower` | lower case | `"VENDOR"` → `"vendor"` |
| `title` | Title Case | `"ahmed"` → `"Ahmed"` |
| `date_fmt` | ISO 8601 date | `"01/15/2024"` → `"2024-01-15"` |
| `num_fmt` | 2 dp locale | `"15000"` → `"15,000.00"` |

### Push to Reports

```javascript
function dcPushToReports() {
  const key = DC.targetReport;
  // Backup original data (once)
  if (!_REPORT_DATA_BACKUP[key]) {
    _REPORT_DATA_BACKUP[key] = window.REPORT_DATA[key].rows.map(r => [...r]);
  }
  // Swap in mapped data
  window.REPORT_DATA[key].columns = DC.previewCols;
  window.REPORT_DATA[key].rows    = DC.previewRows;
  IMPORTED_REPORTS[key] = true;
  // Reload report with new data
  loadReport(key);
}
```

### Live DB Proxy Contract

```
POST /query
Content-Type: application/json
Body:    { sql, host, port, sid, user, pass }
Returns: { columns: string[], rows: any[][] }
```

Minimal Node.js proxy using `oracledb`, or Python using `cx_Oracle`, is sufficient.
The proxy must add `Access-Control-Allow-Origin: *` for CORS compliance.

---

## 10. SQL Analysis Engine

### Performance Advisor

```javascript
function performSQLAnalysis(sql) {
  // 1. Extract tables via regex /(?:FROM|JOIN)\s+([\w_]+)/gi
  // 2. Pattern detectors:
  //    - /SELECT\s*\*/i             → wildcard columns
  //    - comma joins                → cartesian product risk
  //    - /SELECT\s*\(SELECT/i       → correlated subquery
  //    - _ALL tables without ORG_ID → multi-org non-compliance
  //    - ORDER BY without ROWNUM    → unbounded result set
  // 3. Cost = (tables × 1200) + (critical × 5000) + 3000
  // 4. Optimised cost = max(200, round(original × 0.15))
}
```

### Code Review — 27 Check Categories

| Severity | Count | Examples |
|---|---|---|
| Critical | 8 | Missing ORG_ID, EXECUTE IMMEDIATE injection, SELECT *, correlated subquery |
| Major | 10 | LIKE % wildcard, NOT IN with NULLs, missing DateTrack, hard literals |
| Minor | 9 | Formatting, naming conventions, missing comments |

Score = 100 − (Critical×20) − (Major×10) − (Minor×5)

---

## 11. Document Generator

### SVG Diagram Functions

| Function | Diagram | Scales With |
|---|---|---|
| `generateProcessFlowSVG(d)` | 8-step horizontal process flow | Fixed layout |
| `generateDataFlowSVG(d)` | 3-column data flow (source→process→output) | Table count |
| `generateERDiagramSVG(d)` | Grid of table entities with columns | Table count |
| `generatePLSQLFlowSVG(d)` | Vertical flowchart with decision diamonds | Param count |

All diagrams are inline SVG — no external images, print-safe.

---

## 12. ICA Ontology Layer — Knowledge Graph (v5.2)

The [`ica-schema/`](../ica-schema/) directory contains a full **JSON-LD / OWL 2 ontology** and ICA Context Studio schema for the Oracle EBS reporting domain. Fully derived from `bob ontology guide.txt` Sections A–AE.

### Ontology Files

| File | Lines | Contents |
|------|-------|---------|
| [`ebs-ontology.jsonld`](../ica-schema/ebs-ontology.jsonld) | 1,120+ | OWL 2 class hierarchy, 30+ classes, 52+ properties |
| [`ebs-complete-ontology.jsonld`](../ica-schema/ebs-complete-ontology.jsonld) | 2,008 | **Primary ICA upload** — all entity instances |

```
Namespace: https://ibm.com/ica/oracle-ebs-intelligence-hub/ontology#
Secondary: http://ibm.com/oracle-ebs#
```

### OWL Class Hierarchy (v5.2)

```
owl:Thing
├── ebs:OracleModule          (= schema:SoftwareApplication) — 13 modules
│   └── AP, AR, GL, PO, HRMS, PAY, INV, OM, FA, CM, BEN, iEXP, FND
├── ebs:BusinessProcess       (⊑ schema:Action) — P2P, O2C, H2R, R2R
├── ebs:EBSReport             (⊑ schema:Dataset) — 26 reports
├── ebs:OracleTable           (⊑ schema:Dataset) — 40+ tables
├── ebs:BusinessRule          — SQL compliance rules
│   └── ebs:ComplianceRule    — COMP-001 to COMP-010, RULE_001 to RULE_028
├── ebs:SQLPattern            (⊑ schema:SoftwareSourceCode) — 6 patterns
├── ebs:NLQuery               (⊑ schema:SearchAction) — 115+
│
├── ── RICE TAXONOMY ──
├── ebs:RICEComponent         (⊑ schema:SoftwareSourceCode) — base class
│   ├── ebs:EBSInterface      — INBOUND/OUTBOUND interfaces
│   ├── ebs:EBSConversion     — data migration components
│   ├── ebs:EBSExtension      — DB triggers, packages, custom code
│   ├── ebs:OAFComponent      — OAF pages, controllers, VO extensions
│   ├── ebs:SOAService        — BPEL, Mediator, REST, SOAP
│   ├── ebs:APEXApplication   — APEX apps with EBS SSO
│   ├── ebs:ADFApplication    — ADF apps on WebLogic
│   └── ebs:RedwoodComponent  — Oracle JET + VBCS modern UI
├── ebs:AMEConfiguration      (⊑ schema:Action) — approval rules/hierarchies
├── ebs:OracleWorkflow        (⊑ schema:Action) — workflow processes
│
├── ── KNOWLEDGE & LEARNING ──
├── ebs:ModuleKnowledge       (⊑ schema:LearningResource) — 15 topics
├── ebs:AcademyModule         (⊑ schema:Course) — 15 modules
├── ebs:AcademyTopic          (⊑ schema:LearningResource)
│
└── ── APPLICATION & USER ──
    ├── ebs:UserRole          (⊑ schema:Role) — Employee/Technical
    ├── ebs:AppTab            — 7 navigation tabs
    ├── ebs:SQLQuery          (⊑ schema:SoftwareSourceCode) — 500+
    ├── ebs:SQLCategory       — 12 categories
    ├── ebs:DataConnectSource (⊑ schema:DataFeed) — Excel/DB/Live
    ├── ebs:ColumnMapping     (⊑ schema:PropertyValue) — 100 rules
    ├── ebs:DeleteRequest     (⊑ schema:Action)
    ├── ebs:RecycleBinEntry   (⊑ schema:CreativeWork)
    ├── ebs:Employee          (⊑ schema:Person)
    ├── ebs:Supplier          (⊑ schema:Organization)
    ├── ebs:DocumentTemplate  (⊑ schema:DigitalDocument)
    └── ebs:OperatingUnit     (⊑ schema:Organization)
```

### RICE Taxonomy Design

The RICE taxonomy covers all Oracle EBS customisation types:

| Category | Code | OWL Class | Key Properties |
|----------|------|-----------|----------------|
| Reports | R | `ebs:EBSInterface` (sub) | reportType, concurrentProgramName, outputFormat |
| Interfaces | I | `ebs:EBSInterface` | interfaceDirection, openInterfaceTable, apiPackage |
| Conversions | C | `ebs:EBSConversion` | conversionType, stagingTable, cutoverSequence |
| Extensions | E | `ebs:EBSExtension` | extensionType, baseObject, triggerPoint |
| AME | — | `ebs:AMEConfiguration` | transactionType, approvalType, conditions, rules |
| Workflow | — | `ebs:OracleWorkflow` | itemType, processName, workflowType |
| OAF | — | `ebs:OAFComponent` | javaControllerClass, extensionType, basePagePath |
| SOA | — | `ebs:SOAService` | serviceType, namespace, integrationPattern |
| APEX | — | `ebs:APEXApplication` | authenticationScheme, pages, appAlias |
| ADF | — | `ebs:ADFApplication` | adfVersion, deploymentTarget, businessComponents |
| Redwood | — | `ebs:RedwoodComponent` | oracleJETVersion, vbcsVersion, dataSourceType |

### Key Inverse Property Pairs

| Property | Inverse |
|----------|---------|
| `ebs:moduleHasReport` | `ebs:reportBelongsToModule` |
| `ebs:module_has_rice_component` | `ebs:riceComponentBelongsToModule` |
| `ebs:ame_governs_workflow` | `ebs:workflowGovernedByAME` |

### ICA Context Studio Upload Order (v5.2)

| Step | File | Format | Contents |
|------|------|--------|---------|
| 1 | `ica-schema/ebs-ontology.jsonld` | JSON-LD / OWL | 30+ classes, 52+ properties |
| 2 | `ica-schema/ebs-complete-ontology.jsonld` | JSON-LD | **PRIMARY** — 2008 lines, all instances |
| 3 | `ica-schema/ebs-knowledge-graph-schema.json` | JSON | 29 node types, 24 edge types |
| 4 | `ica-schema/csv/ebs_nodes.csv` | CSV | 112+ nodes |
| 5 | `ica-schema/csv/ebs_edges.csv` | CSV | 52+ edges |
| 6 | `ica-schema/csv/ebs_relationships.csv` | CSV | 15 SQL JOINs |
| 7 | `ica-schema/csv/column_mapping_rules.csv` | CSV | 100 Data Connect rules |
| 8 | `ica-schema/csv/natural_language_queries.csv` | CSV | 115+ NL mappings |
| 9 | `ica-schema/csv/approval_rules.csv` | CSV | SQL compliance rules |
| 10 | `ica-schema/ebs-context-config.csv` | CSV | Context config |

---

## 13. Performance Characteristics

| Operation | Data Size | Target |
|---|---|---|
| Page load (cold) | 4 JS/CSS files + 3 CDN libs | < 3 seconds |
| Report load | 100 rows × 10 cols | < 100ms |
| renderTable() | 100 rows | < 100ms |
| Chart.js render | 12 data points | < 300ms |
| applyFilters() | 100 rows | < 10ms |
| Excel parse | 500 rows | < 1 second |
| performCodeReview() | 500-line SQL | < 200ms |
| formatSQL() | 200-line SQL | < 200ms |
| buildDocHTML() | Full document | < 500ms |
| generateSqlFromPrompt() | 500 library queries | < 50ms |

---

## 14. Security

| Concern | Approach |
|---|---|
| XSS | `escHTML()` used on all user-sourced content before DOM insertion |
| SQL execution | None — formatter/advisor are static text transforms only |
| Password display | Removed from login UI in v5.0 |
| Sample data | Synthetic names and amounts only |
| Clipboard | `navigator.clipboard` (HTTPS or localhost only) |
| No external calls | Zero network requests from core app — CDN libs loaded once on startup |
| Live DB creds | Sent only to user-configured proxy URL via POST |

---

## 15. Revision History

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2024-06 | Initial — 4 tabs, 26 reports, Chat, SQL Advisor (~2930 lines JS) |
| v2.0 | 2024-10 | Code Review 27 checks, SQL Formatter, SVG diagrams |
| v3.0 | 2025-01 | IBM Carbon theme, Data Connect tab, XLSX import (~5500 lines JS) |
| v4.0 | 2025-03 | Oracle Blue theme, role-based login, fiscal date fix (~6800 lines JS) |
| v5.2 | 2025-07 | **Ontology v5.2**: 30+ OWL classes, 52+ properties; RICE taxonomy (11 new OWL classes: RICEComponent, EBSInterface, EBSConversion, EBSExtension, AMEConfiguration, OracleWorkflow, OAFComponent, SOAService, APEXApplication, ADFApplication, RedwoodComponent); ModuleKnowledge class; ebs-complete-ontology.jsonld (2008 lines); RULE_016–RULE_028 (13 new SQL rules); REL_020–REL_030 (11 new rels); 29 node types; 24 edge types; v5.2 schema |
| v5.1 | 2025-06 | RICE taxonomy OWL classes; ebs-complete-ontology.jsonld entity format; RULE_001–RULE_015 |
| v5.0 | 2025-06 | SQL Lab AI, Academy 15 modules, Delete/Recycle Bin, Employee request workflow, Notification panel, password fix, SQL Lab scroll fix, out-of-scope detection, **JSON-LD ontology** (19 OWL classes), **100 column mapping rules** (~8350 lines JS) |

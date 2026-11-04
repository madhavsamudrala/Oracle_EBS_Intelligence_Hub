# Oracle EBS Intelligence Hub
## Functional Specification

**Version:** 6.0
**Date:** July 2025
**Author:** CookCountyBoB — IBM ICA Oracle EBS Team
**Status:** Production Ready | IBM BoB Challenge Submission

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose

The Oracle EBS Intelligence Hub is a browser-based enterprise portal that gives Finance teams, HR analysts, Oracle EBS developers, functional consultants, and project managers a **single unified interface** to access reports, analyse SQL, learn EBS concepts, import real data, and generate technical documents — with no installation, no database access required, and no backend server.

### 1.2 Business Value

| Problem | How the Hub Solves It |
|---|---|
| Business users need IT to run every report | Self-service EBS reports for all Finance/HR modules, filterable by date/year/keyword |
| Developers write slow or non-compliant SQL | SQL Advisor (Performance + Code Review + Formatter) analyses SQL and auto-optimises |
| Consultants spend hours writing TDD/FSD docs | Document Generator produces full Technical/Functional docs with SVG diagrams in seconds |
| New team members struggle to learn EBS | EBS Academy — 15 modules covering all roles from AP clerk to DBA to Project Manager |
| No way to test with real data without DB access | Data Connect — import Excel/CSV or simulate/live-query Oracle DB, push to any report |
| SQL queries hard to find and reuse | SQL Lab — 500+ pre-written EBS queries, searchable, with AI prompt-to-SQL |

### 1.3 Scope — In Scope

- Role-based login (Employee / Technical) with different tab visibility
- 26 EBS reports across 7 modules (AP, AR, GL, PO, HRMS, INV, iExpense)
- AI Chat assistant for report discovery and inline data previews
- SQL Advisor: Performance Advisor, Code Review (27 checks), Code Formatter
- EBS Academy: 15 learning modules with AI assistant, flowcharts, SQL examples
- SQL Lab: 500+ library queries + AI prompt-to-SQL generation
- Data Connect: Excel/CSV upload, DB simulation, live Oracle DB query
- Document Generator: Technical Design Document + Functional Spec with SVG diagrams
- Delete / Recycle Bin workflow with employee request + technical approval
- Notification panel for Technical role

### 1.4 Scope — Out of Scope

- Real-time Oracle EBS database connection (without a proxy server)
- User account management or persistent sessions
- Workflow execution in Oracle EBS
- Payment processing or transaction creation
- Multi-language support

---

## 2. USER ROLES & PERSONAS

### 2.1 Role Matrix

| Feature / Tab | 👤 Employee (Standard Clearance) | ⚙️ Technical (Full Clearance) |
|---|---|---|
| 🤖 Chat Assistant | ✅ Full access + ICA MCP live | ✅ Full access + ICA MCP live |
| 📊 EBS Reports | ✅ View, filter, export | ✅ View, filter, export |
| 🔌 Data Connect | ✅ Import & push data | ✅ Import & push data |
| 🔍 SQL Advisor | Not visible (DASC least privilege) | ✅ Full access |
| 🎓 EBS Academy | Not visible (DASC least privilege) | ✅ Full access |
| 🔬 SQL Lab | Not visible (DASC least privilege) | ✅ Full access |
| 📄 Doc Generator | Not visible (DASC least privilege) | ✅ Full access |
| Delete a report | Request only → Technical approves (DASC dual-control) | Direct delete + Recycle Bin |
| Notification bell | Not visible | ✅ Pending requests + Recycle Bin |

> **DASC Note:** Employee role sees only their 3 tabs. No indication of other tabs is shown — no ❌ markers. The app feels complete at their clearance level.

### 2.2 Personas

#### 👤 Employee (Finance / HR Business User)

- Runs pre-built EBS reports (AP aging, invoice register, employee list, etc.)
- Filters by year, month, keyword
- Downloads reports as CSV / Excel / PDF
- Uploads their own Excel data to replace demo data
- Uses Chat assistant to find and preview reports by plain English question
- Submits a delete request for reports they no longer need

#### 🔧 Technical (Developer / Consultant / DBA / Project Manager)

- All Employee capabilities, plus:
- Analyses SQL for performance issues and EBS compliance
- Runs 27-check Code Review on SQL
- Formats PL/SQL and SELECT statements
- Browses 500+ SQL Library queries by module/category
- Prompts the SQL Lab AI for EBS-specific SQL
- Learns EBS concepts in all 15 Academy modules with an AI assistant
- Generates full Technical Design Documents and Functional Specs
- Connects to live Oracle DB via a proxy for live data
- Approves or rejects employee delete requests from notification panel
- Restores deleted reports from Recycle Bin

---

## 3. FEATURE SPECIFICATIONS

---

### 3.1 Feature: Login & Role Selection

**User Story:** As a user, I want to log in with my role so I see only the features relevant to me.

**Flow:**
1. Landing page shows DASC security banner + role selection cards: **Employee** and **Technical**
2. User clicks a role card → password step appears
3. User enters password → validated → main app loads
4. Navigation tabs filtered by role via `_applyRoleTabVisibility()` — Employee sees only 3 tabs
5. DASC info bar appears below tab nav showing role clearance (`_showDascInfoBar()`)
6. ICA MCP health check begins — ICA Live badge turns green when backend online

**Credentials:**
- Employee: set in local `ebs-credentials.js`
- Technical: set in local `ebs-credentials.js`

**Acceptance Criteria:**
- [ ] Wrong password shows error message, does not proceed
- [ ] Employee role shows only Chat, EBS Reports, Data Connect — no other tab names visible
- [ ] Technical role shows all 7 tabs
- [ ] DASC info bar shows correct role clearance after login
- [ ] DASC info bar hidden on logout
- [ ] Logout returns to landing page, clears session

---

### 3.2 Feature: EBS Reports Browser

**User Story:** As a Finance user, I want to browse and filter EBS reports without needing IT help.

**Reports Available (26 total):**

| Module | Reports |
|---|---|
| Accounts Payable | Invoice Register, AP Aging, Supplier List, Withholding Tax, Payment Register, Expense Distribution, Void Payments, Invoice on Hold |
| Accounts Receivable | AR Aging Report, Customer Statements |
| General Ledger | Journal Entries, Trial Balance, Budget vs Actual |
| iExpense | Expense Reports, Credit Card Transactions, Expense Approval |
| HRMS | Employee List, Supervisor Hierarchy, Payroll Summary, Cost Allocation |
| Purchasing | PO Status, Buyer Workload, Receipt Register, Spend by Supplier |
| Inventory / Other | Inventory Valuation, Concurrent Requests |

**Filtering:**
- Year dropdown (populated from data)
- Month dropdown
- Free-text search across all columns

**Other Report Actions:**
- Toggle SQL panel (view the EBS query behind the report)
- Toggle Chart panel (bar / line / pie / doughnut)
- Download: CSV, Excel, PDF
- Load SQL to SQL Advisor or Code Review
- Delete report (Employee: sends request; Technical: direct delete with confirm)

**Acceptance Criteria:**
- [ ] All 26 reports load and display data in paginated table
- [ ] Year/month/search filters correctly reduce displayed rows
- [ ] Chart renders for all report types
- [ ] All three download formats produce valid files
- [ ] SQL panel shows formatted Oracle EBS SQL

---

### 3.3 Feature: AI Chat Assistant — IBM ICA Powered

**User Story:** As a business user, I want to ask plain English questions and get enterprise-grounded EBS answers.

**Behaviour:**
- User types question → routed to IBM ICA Context Studio via MCP Gateway (when backend online)
- ICA retrieves 17,000+ characters of enterprise Oracle EBS knowledge per query
- Falls back to local keyword-based matching when backend offline
- Report preview appears inline in chat
- User can download the previewed report or navigate to it

**ICA Live Badge:**
- Green `● ICA Live` badge in chat header confirms MCP Gateway connection
- Polls `http://localhost:8000/health` every 30 seconds
- Turns grey `● ICA Offline` when backend not running (graceful fallback)

**Chat Welcome Includes:**
- DASC Security Model card (role permission overview — positive framing only)
- Team Reuse Strategy card (IBM Consulting accelerator pitch)
- 4 demo query prompts for guided discovery

**Also Supports:**
- Uploading an Excel/CSV file in chat → auto-maps to matching report
- Quick-launch query buttons in sidebar
- Chat history persisted during session

**Acceptance Criteria:**
- [ ] Common EBS keywords map to correct reports (invoice → Invoice Register, etc.)
- [ ] Unrecognised queries return a helpful fallback with suggestions
- [ ] Upload in chat correctly loads data into matching report
- [ ] Chat history scrollable, clearable

---

### 3.4 Feature: SQL Advisor (Technical Only)

Three sub-tabs in one panel:

#### Sub-tab A — Performance Advisor

**User Story:** As a developer, I want to paste my SQL and get a performance analysis with a cost estimate.

- Detects: missing ORG_ID, SELECT *, comma joins, correlated subqueries, missing ROWNUM, full table scans
- Estimates cost before/after optimisation (based on table count + issue severity)
- Shows optimised SQL with fix comments
- Compare view: side-by-side original vs optimised

#### Sub-tab B — Code Review (27 Checks)

**User Story:** As a developer, I want a full compliance check of my SQL before it goes to production.

27 checks across categories:

| Category | Example Checks |
|---|---|
| Performance | Missing ORG_ID, SELECT *, correlated subquery, missing index hints |
| EBS Compliance | Multi-Org filter, PRIMARY_FLAG, CANCELLED_DATE, FND_LOOKUPS usage |
| SQL Best Practice | LIKE % leading wildcard, NOT IN with NULLs, IN list > 1000, hard literals |
| Security | EXECUTE IMMEDIATE without bind variables, SQL injection patterns |
| Date Handling | SYSDATE vs TRUNC, DateTrack filter missing, fiscal year format |

Each check shows: severity (Critical/Major/Minor/Info) + before/after code example.

Score = 100 − (Critical×20) − (Major×10) − (Minor×5)

#### Sub-tab C — Code Formatter

**User Story:** As a developer, I want consistent, readable SQL with proper casing and indentation.

- Formats SELECT, DML (INSERT/UPDATE/DELETE), and PL/SQL blocks
- Keyword casing: UPPER / lower / Title options
- One column per line option
- Oracle EBS header comment block option
- Stats: line count, keyword count, table count, join count, complexity score

**Acceptance Criteria:**
- [ ] All 3 sub-tabs isolated — no bleed across panels
- [ ] Performance Advisor shows cost estimate and optimised SQL
- [ ] Code Review returns minimum 5 checks for typical EBS query
- [ ] Formatter handles SELECT, INSERT, UPDATE, PL/SQL
- [ ] SQL can be sent from Formatter → Advisor, from Advisor → Formatter

---

### 3.5 Feature: EBS Academy (Technical Only)

**User Story:** As a consultant or developer, I want structured learning content for every EBS module with an AI assistant I can ask questions.

**15 Modules:**

| # | Module | Target Audience |
|---|---|---|
| 1 | Accounts Payable | AP Clerks, Finance consultants |
| 2 | Accounts Receivable | AR Analysts |
| 3 | General Ledger | GL Accountants |
| 4 | iExpense | Finance users, Approvers |
| 5 | HRMS | HR Analysts, Payroll |
| 6 | Purchasing / PO | Buyers, Procurement |
| 7 | Inventory | Warehouse, Inventory Analysts |
| 8 | Concurrent Programs | All technical users |
| 9 | DBA & System Admin | DBAs, System Admins |
| 10 | EBS Architecture | Architects, Senior Consultants |
| 11 | SOA & Integration | Integration Developers |
| 12 | Oracle APEX & Modernisation | Developers, Modernisation leads |
| 13 | Testing & QA | QA Engineers, Test leads |
| 14 | Security & Access Control | Security Admins, Auditors |
| 15 | Project Manager Guide | Project Managers, Delivery leads |

**Per Topic:**
- Structured text content (concepts, steps, best practices)
- Process flowchart (SVG, auto-generated per topic)
- Embedded SQL examples with copy + send-to-SQL-Lab buttons
- Keyword search across all modules

**AI Assistant:**
- Slide-in panel
- Ask any EBS question in natural language
- 40+ keyword-matched response handlers covering all 15 modules
- Conversation history during session

**Acceptance Criteria:**
- [ ] All 15 modules load with at least 3 topics each
- [ ] AI assistant answers questions relevant to all module topics
- [ ] SQL examples copy correctly and send to SQL Lab/Advisor
- [ ] Flowcharts render as SVG for at least 8 common processes

---

### 3.6 Feature: SQL Lab (Technical Only)

**User Story:** As a developer, I want to find EBS SQL by browsing a library or by typing a plain English prompt.

**SQL Library:**
- 500+ pre-written Oracle EBS queries
- Organised by module and category (12 categories)
- Searchable by keyword
- Each query: title, description, SQL, tags, module badge

**AI Prompt-to-SQL:**
- User types: "Show me all unpaid invoices over $10,000"
- Engine tokenises → filters stop words → scores against library queries
- Returns best-matching SQL with confidence tags
- Out-of-scope detection: if prompt is about Python, weather, general topics → friendly rejection message

**Actions on each query:**
- Copy SQL
- Send to SQL Advisor (Performance Advisor)
- Send to Code Formatter

**Acceptance Criteria:**
- [ ] Library loads all categories with correct query counts
- [ ] Search filters queries in real-time
- [ ] AI prompt matches correct SQL for common EBS scenarios
- [ ] Out-of-scope prompts (non-EBS) are gracefully rejected
- [ ] Copy + send actions work correctly

---

### 3.7 Feature: Data Connect

**User Story:** As a user, I want to connect my real Oracle EBS data to the reports so I can see actual figures.

**Three Data Sources:**

#### Source A — Excel / CSV Upload
1. Drag & drop `.xlsx` or `.csv` file
2. File parsed — headers and data extracted
3. Column types auto-detected (number / date / text / bool / mixed)
4. User selects target EBS report from dropdown
5. Auto-map tries to match column names (fuzzy normalisation)
6. User adjusts any unmapped columns manually
7. Apply transforms per column (TRIM, UPPER, lower, Title, Format Date, Format Number)
8. Preview: paginated grid + data profile bar (null%, unique count, sample values)
9. Push to Reports → live report now uses your data

#### Source B — DB Simulated
1. User pastes a SELECT query (any EBS table name)
2. Engine matches table name to a demo report
3. Loads that demo data as if query ran
4. Full mapping flow follows

#### Source C — Live Oracle DB
1. User enters: Host / Port / SID / Username / Password / Proxy URL
2. Test Connection → verifies proxy is reachable
3. User enters SELECT query
4. Query sent to proxy (POST JSON) → proxy executes via JDBC/cx_Oracle
5. Results returned as `{ columns, rows }` JSON
6. Full mapping flow follows

**Acceptance Criteria:**
- [ ] Excel upload handles .xlsx and .csv, multi-sheet workbooks
- [ ] Header row configurable (default row 1)
- [ ] Auto-map correctly matches identically-named columns
- [ ] All 6 transforms apply correctly
- [ ] Preview shows correct paginated data
- [ ] Push replaces live report data and all filters/charts work on new data
- [ ] DB Simulated mode matches correct demo data for all supported table names
- [ ] Live DB mode sends correct POST to proxy

---

### 3.8 Feature: Delete & Recycle Bin

**User Story:** As a Technical user, I want to delete reports I no longer need, and restore them if I made a mistake.

**Technical Role — Direct Delete:**
1. Open any report → click Delete button
2. Custom confirm modal appears (not browser `window.confirm`)
3. Click OK → report deleted:
   - Removed from sidebar
   - Data cleared from memory
   - Snapshot saved to Recycle Bin
   - Notification badge updated

**Employee Role — Delete Request:**
1. Open any report → click Delete button
2. Form appears: select reason (No longer needed / Incorrect data / Duplicate / Other) + notes
3. Submit → request logged, Technical notification badge increments

**Technical Notification Panel:**
- Bell icon in top-right navbar (badge shows pending count)
- Two sections: Pending Requests + Recycle Bin
- Pending Requests: approve (deletes) or reject each request
- Recycle Bin: restore any deleted report back to sidebar

**Acceptance Criteria:**
- [ ] Employee sees Delete button → opens request form (not direct delete)
- [ ] Technical sees Delete button → opens confirm modal → direct delete
- [ ] Deleted report disappears from sidebar immediately
- [ ] Deleted report cannot be reopened via sidebar or chat
- [ ] Recycle Bin restores report to sidebar and memory
- [ ] Notification badge shows correct count and clears when panel opened

---

### 3.9 Feature: Document Generator (Technical Only)

**User Story:** As a consultant, I want to generate a complete Technical Design Document or Functional Spec for an EBS custom report in seconds.

**Input Form:**
- Program name, short name, package name, procedure name
- Module (AP / AR / GL / PO / HRMS / INV / iExpense)
- Document type: Technical / Functional / Both
- Description, business rules, error handling, output layout
- Dynamic parameters table (add/remove rows)
- Dynamic source tables table (add/remove rows)
- Dynamic value sets table (add/remove rows)

**Generated Output:**
- Cover page with metadata
- Table of contents
- Business purpose section
- Technical architecture section
- Parameters section (formatted table)
- Source tables section
- Business rules section
- 4 SVG diagrams: Process Flow, Data Flow, ER Diagram, PL/SQL Flow
- Error handling section
- Change log

**Export:** HTML (print/save) or PDF (via browser print dialog)

**Acceptance Criteria:**
- [ ] All form fields populate corresponding doc sections
- [ ] All 4 SVG diagrams render inline
- [ ] Dynamic rows (params/tables/value sets) all appear in output
- [ ] Download produces readable HTML document
- [ ] Sample data button populates a complete realistic example

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 Performance

| Operation | Target |
|---|---|
| Page load (cold) | < 3 seconds |
| Report load (26 reports) | < 100ms |
| Table render (100 rows) | < 100ms |
| SQL analysis | < 200ms |
| Excel parse (500 rows) | < 1 second |
| Chart render | < 300ms |
| Document generation | < 500ms |

### 4.2 Usability

- All key actions reachable in ≤ 3 clicks from login
- Toast notifications confirm every major action
- Tooltips on all icon buttons
- Keyboard navigation supported throughout
- Mobile-responsive (works on tablets, readable on phones)

### 4.3 Security

- All user input run through `escHTML()` before DOM insertion
- Passwords not displayed in login screen or browser console
- Live DB credentials sent only to user-specified proxy URL
- No external analytics or tracking scripts
- No cookies or local storage used

### 4.4 Reliability

- Zero network dependencies for core features (demo data mode)
- All failures show user-facing toast messages (no raw error stack traces)
- Deleted report state enforced via `DELETED_REPORTS` registry — prevents ghost reopens

---

## 5. ACCEPTANCE CRITERIA SUMMARY

| Category | Pass Criteria |
|---|---|
| Login | Both roles authenticate, wrong password rejected, tab visibility correct |
| Reports | All 26 reports load, filters work, charts render, downloads produce valid files |
| SQL Advisor | All 3 sub-tabs functional, 27 code review checks run, formatter handles all SQL types |
| Academy | 15 modules accessible, AI assistant responds relevantly, flowcharts render |
| SQL Lab | Library loads, search works, AI prompt matches correct queries, out-of-scope rejected |
| Data Connect | Excel upload works, auto-map matches columns, push replaces live report data |
| Delete Flow | Employee sees request form, Technical sees confirm modal, recycle bin restores |
| Doc Generator | Form inputs populate all doc sections, SVG diagrams render, export works |

---

## 6. REVISION HISTORY

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2024-06 | Initial 4-tab app — Chat, Reports, SQL Advisor, Doc Generator |
| v2.0 | 2024-10 | Code Review 27 checks, SQL Formatter, SVG diagrams |
| v3.0 | 2025-01 | Data Connect tab, Excel import, IBM Carbon theme |
| **v6.0** | **2025-07** | **DASC security model** — least privilege (no curiosity triggers), DASC info bar, zero-trust API; ICA MCP live with IBM ICA Context Studio; `start-all.bat` team deployment; Team Reuse Strategy; CookCountyBoB IBM BoB Challenge submission |
| v5.0 | 2025-06 | SQL Lab (500+ queries + AI), Academy (15 modules), Delete/Recycle Bin system, employee delete request workflow, notification panel |
| v4.0 | 2025-03 | Oracle Blue theme, role-based login (Employee/Technical), fiscal date fix |
| v5.1 | 2025-06 | Knowledge graph ontology: RICE taxonomy (RICEComponent/EBSInterface/EBSConversion/EBSExtension/AMEConfiguration/OracleWorkflow/OAFComponent/SOAService/APEXApplication/ADFApplication/RedwoodComponent), ModuleKnowledge class; ebs-complete-ontology.jsonld entity format |
| v5.2 | 2025-07 | Ontology v5.2 — 30+ OWL classes, 52+ properties, RULE_016–RULE_028 (13 new SQL code review rules), REL_020–REL_030 (11 new relationships), 29 node types, 24 edge types; complete RICE taxonomy as 01-nodes.json instances; 15 ModuleKnowledge topic nodes; updated ica-schema/README.md, README.md, TECHNICAL_DESIGN.md, TECHNICAL_SPEC.md |

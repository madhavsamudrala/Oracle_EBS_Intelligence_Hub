# Functional Specification — Oracle EBS Reports Extracts

**Version:** 2.0 | **Date:** 2024-10 | **Module:** Cross-Module (AP/AR/GL/PO/HRMS/iExpense/INV)

---

## 1. Business Overview

### 1.1 System Purpose

The Oracle EBS Reports Extracts portal provides Cook County (and any Oracle EBS R12 customer) with a self-service reporting interface that connects business users directly to Oracle EBS financial and HR data through natural-language queries, pre-built report templates, and developer tools — all without requiring direct access to the Oracle EBS application servers.

### 1.2 Business Context

| Business Area | Current Challenge | Portal Solution |
|---|---|---|
| Accounts Payable | Finance analysts must log into EBS and navigate complex menus | One-click report generation from chat or sidebar |
| Purchasing | PO status requires multiple concurrent program runs | Instant PO Detail report with charts |
| General Ledger | Journal entry review requires Crystal Reports knowledge | GL Journals and Trial Balance with chart analysis |
| iExpense | Approval status not visible without workflow admin access | Workflow & Approvals report shows all pending |
| HRMS | Headcount reports require HR team intervention | Active/Terminated employee reports self-serve |
| SQL Development | Developers deploy slow SQL causing production issues | SQL Advisor checks before deployment |
| Documentation | TDD/FSD writing takes 4-8 hours per program | Doc Generator produces complete spec in 2 minutes |

### 1.3 Business Benefits

| Benefit | KPI | Target |
|---|---|---|
| Self-service reporting | % reports generated without IT | 80% |
| Faster SQL delivery | Avg time for code review | From 2 days to 30 minutes |
| Documentation quality | % programs with complete TDD | From 40% to 100% |
| User productivity | Minutes saved per report request | 30-60 minutes per request |
| Compliance | % AP payments with audit trail | 100% |

---

## 2. Module Functional Specifications

### 2.1 Accounts Payable Reports

#### 2.1.1 Suppliers Report

**Business Need:** AP team requires a regularly-updated list of all registered suppliers for reference, audit verification, and contact management.

**Acceptance Criteria:**
- Shows all suppliers with ENABLED_FLAG = 'Y'
- Displays vendor number, name, type, tax ID, city, country, pay group
- Hold flag clearly highlighted in red for suppliers on payment hold
- Searchable by vendor name or vendor number
- Downloadable as CSV, Excel, PDF

**Business Rules:**
1. Include suppliers across all vendor types (VENDOR, EMPLOYEE, GOVERNMENT)
2. Tax ID field shows NUM_1099 for US, VAT_REGISTRATION_NUM for EU/UK
3. Sorting: alphabetical by vendor name
4. Hold All Payments Flag = 'Y' shown with red badge "On Hold"

#### 2.1.2 Aged Payables

**Business Need:** Finance management requires visibility of outstanding supplier liabilities by age to manage cash flow and avoid late payment penalties.

**Acceptance Criteria:**
- 5 aging buckets: 0-30, 31-60, 61-90, 91-120, 120+ days
- Bucket calculated from payment due date (not invoice date)
- Only shows invoices with outstanding balance > 0
- Totals per bucket per supplier
- Highlights 90+ day items in red

**Business Rules:**
1. Aging based on AP_PAYMENT_SCHEDULES_ALL.DUE_DATE
2. Cancelled invoices excluded (CANCELLED_DATE IS NULL)
3. Filter by operating unit via ORG_ID
4. Currency: report in functional currency; foreign currency invoices converted at rate of payment

#### 2.1.3 Invoice Register

**Business Need:** AP Supervisor needs complete log of all invoices entered in a period for batch reconciliation and period closing.

**Acceptance Criteria:**
- Shows all invoices for user-selected date range
- Grouped by batch for reconciliation
- Totals by invoice type (Standard, Credit Memo, Prepayment)
- Created-by user visible for audit purposes

### 2.2 iExpense Reports

#### 2.2.1 iExpense Detail Report

**Business Need:** Finance and HR Audit require visibility of all submitted expense reports with approval status to monitor policy compliance.

**Policy Rules Enforced:**
1. Meals limit: INR 500/day — flag rows exceeding limit
2. International travel requires pre-approval — check PRIOR_APPROVAL field
3. Original receipts required for amounts > INR 1,000
4. Weekend claims require manager pre-approval

**Workflow States:**
| Status Code | Meaning | Action Required |
|---|---|---|
| A | Approved | No action — ready for payment |
| N | Not Approved / Pending | Awaiting approver action |
| R | Rejected | Employee must resubmit |
| W | Withdrawn | Employee cancelled submission |

#### 2.2.2 Credit Card Reconciliation

**Business Need:** Corporate card administrators need to match credit card transactions to submitted expense reports monthly.

**Reconciliation Rules:**
1. All card transactions must be matched to an expense report line within 30 days
2. Unmatched transactions > 30 days flagged as "Overdue — Action Required"
3. Personal transactions must be refunded (flag PERSONAL_EXPENSE_FLAG = 'Y')
4. Disputed transactions require written explanation within 7 days

### 2.3 HRMS Reports

#### 2.3.1 Active Employees Report

**Business Need:** HR and Finance need current headcount data for cost allocation, payroll reconciliation, and organisational planning.

**Data Freshness:** Employee data is DateTrack — always read with SYSDATE filter.

**Employment Categories:**
| Category | Description |
|---|---|
| FULL_TIME | Permanent full-time employee |
| PART_TIME | Permanent part-time |
| CONTRACTOR | Fixed-term or agency contractor |
| CONTINGENT | Contingent worker (no payroll) |

#### 2.3.2 Expense Cost Allocation

**Business Need:** Finance requires GL account mapping for all employee expenses to ensure costs are booked to correct cost centres, projects, and funds.

**Allocation Rules:**
1. Primary cost centre from PER_ASSIGNMENTS_F.DEFAULT_CODE_COMB_ID
2. Project-based expenses override with PA project account
3. International expenses allocated to home country cost centre

---

## 3. SQL Advisor — Functional Specification

### 3.1 Performance Advisor

**User:** Oracle Technical Developer / DBA
**Trigger:** Developer has a slow-running concurrent program or report SQL

**Process Flow:**
```
1. Developer pastes SQL into textarea
2. Selects module and DB version context
3. Clicks "Analyse & Optimise"
4. System extracts table names, analyses patterns
5. Displays:
   a. Cost scorecard (before/after estimate)
   b. Issue list with severity
   c. Table metadata grid
   d. Numbered recommendations
   e. Optimised SQL rewrite
   f. Side-by-side comparison
6. Developer reviews, copies optimised SQL, implements fixes
```

**Cost Estimation Model:**
```
Base cost = (number of tables × 1,200) + 3,000
Critical issue premium = 5,000 per critical issue
Total before cost = base + premiums
After cost = max(200, before × 0.15)  // 85% improvement achievable
```

### 3.2 Code Review — 27 Check Categories

| Category | Checks | Oracle EBS Impact |
|---|---|---|
| Multi-Org Compliance | ORG_ID filter, MOAC | Wrong data across all operating units |
| DateTrack Tables | Effective date filters, HR | Duplicate rows, wrong counts |
| HRMS Best Practices | PRIMARY_FLAG, assignment filter | Duplicate employee records |
| Performance | Correlated subqueries, comma joins, TRUNC on column | N×full table scans |
| Security | EXECUTE IMMEDIATE with concat | SQL injection vulnerability |
| Data Quality | CANCELLED_DATE, SUMMARY_FLAG | Inflated financials |
| ANSI Compliance | NVL vs COALESCE, NLS dates | Portability, NLS failures |
| Query Design | ROWNUM+ORDER BY, NOT IN NULL, DISTINCT | Wrong results, zero rows |

### 3.3 Code Formatter — Formatting Rules

| Rule | Implementation |
|---|---|
| Keyword casing | `applyKeywordCasing()` — longest-match keyword list (50+ keywords) |
| SELECT columns | `splitSelectCols()` — parenthesis-depth-aware splitter |
| JOIN alignment | `/\bJOIN\b/gi` detection with `\n` prefix |
| WHERE conditions | Each AND/OR condition on new indented line |
| Subquery indentation | Wrap in parentheses, indent contents by one level |
| PL/SQL blocks | DECLARE/BEGIN/EXCEPTION/END on own lines; IF/THEN/ELSE indented |
| String preservation | `normaliseWhitespace()` skips inside `'quoted strings'` |

---

## 4. Document Generator — Functional Specification

### 4.1 Technical Specification (TDD)

A TDD (Technical Design Document) for an Oracle EBS concurrent program includes:

| Section | Mandatory | Source |
|---|---|---|
| Program Overview | Yes | Form fields |
| Description | Yes | Free text input |
| Parameters table | Yes | Dynamic rows |
| Tables & Objects | Yes | Dynamic rows |
| Value Sets | No | Dynamic rows |
| Business Rules | No | Free text |
| Error Handling | No | Free text + EBS standards callout |
| Output Layout | No | Free text |
| Technical Design | Yes (TDD only) | Auto-generated with EBS standards |
| PL/SQL Flowchart | Yes (TDD only) | Generated from form data |
| Data Flow Diagram | Yes (TDD only) | Generated from tables entered |
| ER Diagram | Yes if 2+ tables | Generated from tables entered |
| Sample PL/SQL | Yes (TDD only) | Auto-generated skeleton |
| Revision History | Yes | Auto-populated with v1.0 + today |

### 4.2 Functional Specification (FSD)

Additional sections for FSD:

| Section | Content |
|---|---|
| Process Flow Diagram | 8-step business process SVG |
| Business Impact | Upstream/downstream dependencies, SLA, frequency |
| User Acceptance Criteria | 6-point checklist |

### 4.3 SVG Diagram Specifications

#### Process Flow Diagram (generateProcessFlowSVG)
- 8 boxes in horizontal row
- Each box: icon, 2-line label, step number
- Arrows between boxes using SVG marker
- Colour palette: Oracle red → IBM blue → Green progression
- Viewbox scales to fit all steps

#### Data Flow Diagram (generateDataFlowSVG)
- Left column: Source tables (from form input)
- Centre: Processing box (procedure name)
- Right: Output box (BI Publisher / FND_FILE)
- Dashed arrows: Source → Processing
- Solid green arrow: Processing → Output
- Additional FND_FILE LOG box below Processing

#### ER Diagram (generateERDiagramSVG)
- Grid layout (max 3 columns)
- Each table entity box: coloured header, column list
- Gold key (🔑) for first (PK) column
- Dashed lines connecting consecutive tables
- Pre-populated column lists for known Oracle EBS tables

#### PL/SQL Flowchart (generatePLSQLFlowSVG)
- Vertical flow with 8 nodes
- Rectangles for process steps, diamonds for decision points
- Decision 1: "Parameters Valid?" — No → Exception box (right)
- Decision 2: "Records Found?" — No → Warning (retcode=1)
- Happy path: Init → Main Cursor → Process Each Row → Write Output → Success
- Exception box: shows retcode=2, Log+RAISE

---

## 5. User Journey Maps

### 5.1 Finance User — AP Report Journey
```
Opens portal (Chat tab)
  │
  ├─ Types: "show aged payables October 2024"
  │         ↓
  │   AI recognises intent → loads aged_payables_detail
  │   Preview table + bar chart shown in chat
  │         ↓
  │   User clicks "Download CSV" → file saved
  │
  ├─ OR clicks "EBS Reports" tab
  │   Expands "Accounts Payable" module
  │   Clicks "Aged Payables Detail"
  │   Table loads → sets Year=2024, Month=10
  │   Clicks "Show Chart" → bar chart appears
  │   Clicks "Download Excel" → .xlsx saved
  │
  └─ Clicks "View SQL" → sees Oracle EBS query
     Clicks "Send to SQL Advisor" → SQL loaded in Tab 3
```

### 5.2 Oracle Developer — SQL Review Journey
```
Opens portal (SQL Advisor tab, or from Tab 2 via "Send to Advisor")
  │
  ├─ Sub-tab A: Performance Advisor
  │   Pastes slow AP query
  │   Clicks "Analyse & Optimise"
  │   Reviews BEFORE=42,000 / AFTER=6,300 cost
  │   Reads 3 critical issues (comma joins, missing ORG_ID, correlated subquery)
  │   Copies optimised SQL
  │         ↓
  ├─ Sub-tab C: Code Formatter
  │   Pastes original messy SQL
  │   Sets: Keywords=UPPERCASE, Indent=4sp, One column per line
  │   Clicks "Format SQL"
  │   Copies formatted SQL for peer review
  │         ↓
  └─ Sub-tab B: Code Review
     Pastes formatted SQL
     Clicks "Run Code Review"
     Reviews Score: 65/100
     Fixes 2 CRITICAL, 1 MAJOR issues
     Re-runs Code Review → Score: 95/100
     SQL approved for deployment
```

### 5.3 Functional Consultant — Document Generation Journey
```
Opens portal (Doc Generator tab)
  │
  ├─ Clicks "Load Sample" to see format
  │   Reviews generated document structure
  │         ↓
  ├─ Clears form, fills in:
  │   - Concurrent Program Name: XXBOB_AP_INVOICE_AGING_RPT
  │   - Module: AP, Type: Technical
  │   - Description: (2-3 sentences from client)
  │   - Adds 3 parameters (P_ORG_ID, P_START_DATE, P_END_DATE)
  │   - Adds 4 tables (AP_SUPPLIERS, AP_INVOICES_ALL, AP_PAYMENT_SCHEDULES_ALL, HR_ALL_ORG_UNITS)
  │         ↓
  ├─ Clicks "Generate Document"
  │   Reviews cover page, all sections
  │   Reviews SVG diagrams (Process Flow, ER Diagram, PL/SQL Flowchart)
  │   Reviews auto-generated PL/SQL skeleton
  │         ↓
  └─ Clicks "HTML Download"
     Opens in Microsoft Word
     Saves as .docx
     Sends to client for review
     Total time: 8 minutes (vs 4 hours manual)
```

---

*Functional Specification v2.0 | Oracle EBS Reports Extracts | IBM BOB + ICA Context Studio*

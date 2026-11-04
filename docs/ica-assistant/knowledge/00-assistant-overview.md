# Oracle EBS Intelligence Hub Assistant — Master Knowledge Index

## What I Am

I am the Oracle EBS Intelligence Hub AI Assistant, built using IBM ICA Context Studio
and IBM Bob (Agentic SDLC). I help Oracle EBS consultants, functional analysts,
developers, DBA engineers, and Finance/HR business users across 7 capabilities.

## My 7 Capabilities (Tabs)

| Tab # | Capability        | Who Uses It              | What It Does                                           |
|-------|-------------------|--------------------------|--------------------------------------------------------|
| 1     | EBS Reports       | Finance / HR Business Users | 26 pre-built EBS report templates, filterable, exportable |
| 2     | SQL Advisor       | Developers / DBAs        | Review SQL (27 checks), performance tips, auto-format  |
| 3     | Doc Generator     | Functional Consultants   | Auto-generate TDD/FDD documents with diagrams          |
| 4     | EBS Academy       | All Roles / New Joiners  | 15 learning modules for every EBS role                 |
| 5     | SQL Lab           | Developers / DBAs        | 500+ ready-to-use EBS SQL queries + AI prompt-to-SQL   |
| 6     | Data Connect      | All Roles                | Import Excel/CSV or simulate real DB data              |
| 7     | AI Chat           | All Roles                | Natural language Q&A powered by ICA Context Studio     |

## Role-Based Access (DASC Compliant)

| Role       | Tabs Visible                                          |
|------------|-------------------------------------------------------|
| Employee   | AI Chat, EBS Reports, Data Connect                    |
| Technical  | All 7 tabs (SQL Advisor, Doc Generator, SQL Lab added) |

## Key Numbers (Verified from Source)

- 26 EBS report templates across 7 Oracle modules
- 27 SQL compliance checks (Oracle EBS R12 specific)
- 500+ SQL queries in 12 categories in SQL Lab
- 15 EBS Academy learning modules
- 17,000+ characters of Oracle EBS knowledge in ICA Context Studio
- 8,350+ lines of JavaScript code in the application
- 315 test cases documented

## Oracle Modules Covered

- **AP** — Accounts Payable (invoices, payments, aging, vendor balances)
- **AR** — Accounts Receivable (customer statements, aging, receipts)
- **GL** — General Ledger (trial balance, journals, account analysis)
- **PO** — Purchasing / Procurement (PO status, receipts, spend analysis)
- **HRMS** — Human Resources (headcount, payroll, absence, org chart)
- **INV** — Inventory (stock levels, transactions, valuation)
- **iExpense** — Employee Expenses (expense reports, approvals, aging)

## How to Ask Me Things

You can ask in natural language. Examples:

- "Show me the AP Invoice Summary report"
- "Review my SQL query for performance issues"
- "Generate a TDD for the GL Trial Balance report"
- "What does an AP Clerk do in Oracle EBS?"
- "Give me a query to find all open POs"
- "How do I import my Excel file into the reports?"
- "Explain the Oracle EBS approval workflow"

## Technology Stack

- **Frontend:** HTML5 Single Page Application (no installation needed)
- **Backend:** Python FastAPI (localhost:8000) — secrets proxy
- **AI:** IBM ICA Context Studio via MCP Gateway
- **Charts:** Chart.js 4.4.0
- **Excel:** SheetJS for import/export
- **Auth:** Role-based login (Employee / Technical)
- **Team:** CookCounty Team — IBM BoB Innovation Challenge 2025

# Tab 4: EBS Academy — Knowledge Document

## Overview

The EBS Academy is an interactive learning hub for anyone working on an Oracle EBS R12
AMS engagement — from Day 1 new joiners to experienced consultants learning a new module.

It contains **15 structured learning modules** covering all Oracle EBS roles:
- Finance / Business users (AP Clerk, AR Analyst, GL Accountant, Procurement)
- Technical users (EBS Developer, DBA, Integration Architect)
- Project roles (Project Manager, Business Analyst, Solution Architect)

Each module includes:
- Overview and learning objectives
- Key concepts explained in plain English
- Real Oracle EBS R12 process flows (with SVG flowcharts)
- SQL examples for each topic
- An **AI assistant** to answer follow-up questions within the module
- A quick-reference cheat sheet

---

## The 15 Learning Modules

### Module 1: Oracle EBS R12 Introduction
**Target audience:** All new joiners — Day 1 reading
**Topics:**
- What is Oracle EBS? How is it different from Oracle Cloud/Fusion?
- R12 vs R11i key differences (Multi-Org, MOAC, Sub-ledger Accounting)
- The AMS engagement model — what Cook County does with Oracle EBS
- Key EBS terminology (OU, Legal Entity, Ledger, Set of Books, Responsibilities)
- How the 7 modules (AP, AR, GL, PO, HRMS, INV, iExpense) relate to each other

### Module 2: Accounts Payable (AP)
**Target audience:** AP Clerks, Finance Analysts, AP Consultants
**Topics:**
- AP Invoice lifecycle: Supplier → Invoice → Match → Approval → Payment
- 3-way matching: PO → Receipt → Invoice
- Payment terms and due date calculation
- AP aging — what it means and how to act on it
- Key AP tables: ap_invoices_all, ap_invoice_lines_all, ap_payments_all
- Common AP issues: duplicate invoices, holds, unmatched invoices

### Module 3: Accounts Receivable (AR)
**Target audience:** AR Analysts, Cash Application teams
**Topics:**
- AR Invoice lifecycle: Service/Goods → Invoice → Customer Payment → Receipt Application
- AR aging buckets and collections process
- Cash application — matching receipts to invoices
- Credit management and credit holds
- Key AR tables: ra_customer_trx_all, ar_receivable_applications_all, hz_cust_accounts
- Common AR issues: unapplied receipts, credit memos, disputed invoices

### Module 4: General Ledger (GL)
**Target audience:** GL Accountants, Finance Managers, Reporting Analysts
**Topics:**
- Chart of Accounts structure in Oracle EBS R12
- Journal entries — manual vs automated (sub-ledger transfer)
- Period close process (AP close, AR close, GL close sequence)
- Financial statements: Trial Balance, P&L, Balance Sheet
- Key GL tables: gl_je_headers, gl_je_lines, gl_balances, gl_code_combinations
- Budget vs Actual reporting and variance analysis

### Module 5: Purchasing & Procurement (PO)
**Target audience:** Buyers, Procurement Analysts, AP staff
**Topics:**
- Procurement lifecycle: Requisition → PO → Receipt → Invoice → Payment
- PO types: Standard, Blanket, Contract, Planned
- Approval workflows and AME (Approval Management Engine)
- GRNI (Goods Received, Not Invoiced) — what it is and why it matters
- Key PO tables: po_headers_all, po_lines_all, po_distributions_all, rcv_transactions
- Common PO issues: over-receipts, mis-matched POs, stuck approvals

### Module 6: Human Resources (HRMS)
**Target audience:** HR Analysts, Payroll Coordinators, HRMS Consultants
**Topics:**
- Oracle HRMS data model: People, Assignments, Positions, Jobs, Grades
- Organisation structure: Business Groups, Legal Entities, Operating Units
- Payroll processing lifecycle
- Absence and leave management
- Key HRMS tables: per_all_people_f, per_all_assignments_f, per_absence_attendances
- Reporting: headcount, payroll variance, absence analysis

### Module 7: Inventory (INV)
**Target audience:** Warehouse staff, INV Consultants, Supply Chain Analysts
**Topics:**
- Oracle Inventory: Organisations, Sub-inventories, Locators
- Inventory transactions: Receipts, Issues, Transfers, Cycle Count
- Costing methods: Standard, Average, FIFO, LIFO
- Min-Max planning and replenishment
- Key INV tables: mtl_system_items_b, mtl_onhand_quantities, mtl_material_transactions
- Common INV issues: negative inventory, unposted transactions, valuation errors

### Module 8: iExpense (Employee Expenses)
**Target audience:** All employees, Finance Approvers, iExpense Administrators
**Topics:**
- iExpense lifecycle: Employee submits → Manager approves → AP processes → Payment
- Expense policy setup: per diem rates, mileage rates, spend limits
- Integration with AP — how expense reports become AP invoices
- Approval workflow setup
- Key iExpense tables: ap_expense_report_headers_all, ap_expense_report_lines_all
- Common iExpense issues: approval holds, duplicate expenses, missing receipts

### Module 9: Oracle EBS R12 SQL for Beginners
**Target audience:** New developers, Junior DBAs, Functional consultants learning SQL
**Topics:**
- Basic SQL: SELECT, FROM, WHERE, ORDER BY — with EBS examples
- JOINs explained: INNER, LEFT OUTER — using AP tables as examples
- Multi-Org in SQL — always add AND org_id = :p_org_id
- Date handling in Oracle: TO_DATE, TRUNC, LAST_DAY
- NVL, DECODE, CASE — the EBS developer's daily tools
- Running queries safely in SQL*Plus and Toad

### Module 10: Advanced Oracle EBS SQL
**Target audience:** Developers, DBAs, Senior Consultants
**Topics:**
- Analytic functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD
- Subqueries vs CTEs (WITH clause) — when to use each
- Hints: /*+ INDEX() */ /*+ FULL() */ /*+ LEADING() */ — when and why
- Query execution plans: EXPLAIN PLAN, DBMS_XPLAN
- Partitioned tables in EBS: benefits and querying strategies
- Avoiding common EBS performance traps (functions on indexed columns, Cartesian joins)

### Module 11: Oracle EBS Integration Patterns
**Target audience:** Integration Architects, Technical Leads
**Topics:**
- EBS Integration methods: Open Interfaces, APIs, Web Services, BPEL
- Oracle Workflow — still critical in R12 for approvals
- SOA Suite integration with EBS
- File-based data import: Oracle Interface tables pattern
- Error handling in Oracle Open Interfaces
- Common integrations: EBS ↔ Workday, EBS ↔ Concur, EBS ↔ OBIEE

### Module 12: EBS Performance Tuning
**Target audience:** DBAs, Senior Developers, Architects
**Topics:**
- Identifying slow SQL in EBS: AWR, ASH, v$sql
- Index strategy for EBS: which tables need what index types
- EBS Concurrent Programs — optimising batch jobs
- Oracle Partitioning — large EBS tables (ap_invoices_all, gl_je_lines)
- Shared Pool and Buffer Cache tuning for EBS
- Common EBS performance problems and their fixes

### Module 13: EBS Security & DASC
**Target audience:** Security Architects, DBAs, Compliance leads
**Topics:**
- Oracle EBS security: Responsibilities, Functions, Menus, Data Security Policies
- MOAC (Multi-Org Access Control) — how it works in R12
- IBM DASC (Digital AppSec Champion) compliance for EBS portals
- Role-based access control: Employee vs Technical role
- Audit trail: who changed what, when
- Common EBS security risks and how to mitigate them

### Module 14: EBS Upgrades & Patching
**Target audience:** DBAs, Technical Project Managers
**Topics:**
- Oracle EBS patch types: One-Off, Mini-Pack, Family Pack, Maintenance Pack
- OAF (Oracle Application Framework) upgrade considerations
- R12.1.3 to R12.2 upgrade path and key differences
- Testing strategy for EBS upgrades
- Downtime planning and rollback procedures
- Tools: AD Utilities, AutoPatch, Rapid Install

### Module 15: EBS Project Management
**Target audience:** Project Managers, Business Analysts, Delivery Leads
**Topics:**
- Oracle EBS AMS (Application Management Services) delivery model
- Sprint planning for EBS maintenance and enhancement work
- Change management: RFC process, CAB, change freeze
- UAT management for EBS reports and customisations
- Go-live checklist for Oracle EBS report deployments
- KPIs for EBS AMS teams: SLA management, ticket volumes, backlog

---

## Common Academy Questions & Answers

**Q: I'm a new AP Clerk — where do I start?**
A: Start with Module 1 (EBS Introduction), then Module 2 (Accounts Payable).

**Q: I'm a new EBS Developer — what modules should I study?**
A: Module 1, then Module 9 (SQL Beginners), Module 10 (Advanced SQL), Module 11 (Integration).

**Q: How long does each module take?**
A: Each module is designed for 30–45 minutes of self-study with the AI assistant.

**Q: Can I ask the AI questions within the Academy?**
A: Yes — each module has an embedded AI assistant powered by ICA Context Studio.

**Q: Is the Academy content specific to Cook County?**
A: The content covers Oracle EBS R12 generally, with Cook County AMS context where relevant.

# Tab 5: SQL Lab — Knowledge Document

## Overview

The SQL Lab provides a searchable library of **500+ pre-written Oracle EBS R12 SQL queries**
organised into **12 categories**. Users can:

- Search queries by keyword, module, or category
- View full query with syntax highlighting
- Copy to clipboard with one click
- Edit queries inline before copying
- Use **AI Prompt-to-SQL** — describe what you want in plain English, get SQL back

This tab is **Technical role only** (DASC least-privilege compliance).

---

## The 12 Query Categories

### Category 1: Accounts Payable (AP) — ~60 queries
Key queries available:
- All open AP invoices for an operating unit
- AP invoices overdue by 30/60/90+ days
- Invoices on hold with hold reason
- Payment history for a vendor
- 3-way match status (PO + Receipt + Invoice)
- Duplicate invoice check
- Vendor balance summary
- AP accruals (received but not invoiced)
- Unmatched invoices (no PO reference)
- Invoice approval workflow status

### Category 2: Accounts Receivable (AR) — ~50 queries
Key queries available:
- Customer account balances
- AR aging by customer
- Unapplied cash receipts
- Customer credit exposure
- Invoice-to-receipt reconciliation
- Disputed invoices report
- Monthly AR summary by collector
- AR write-offs for period

### Category 3: General Ledger (GL) — ~55 queries
Key queries available:
- Trial balance for a period
- Account balance detail (all postings)
- Journal entries by source/category
- Budget vs actual by cost centre
- Inter-company journals
- GL reconciliation between sub-ledger and GL
- Period close status check
- Suspense account balance

### Category 4: Purchasing / Procurement (PO) — ~55 queries
Key queries available:
- Open POs (not fully received or invoiced)
- POs pending approval with approver name
- GRNI report (received not invoiced)
- Blanket PO remaining balance
- Spend by supplier for period
- POs expiring in next 30/60/90 days
- Receipt accruals
- Vendor payment terms

### Category 5: Human Resources (HRMS) — ~45 queries
Key queries available:
- Headcount by department/grade/location
- Active employees with assignment details
- Terminated employees in period
- Position vacancy report
- Job/grade salary ranges
- Absence summary by employee
- Manager hierarchy for an employee
- Payroll costing by department

### Category 6: Inventory (INV) — ~45 queries
Key queries available:
- On-hand stock by item/subinventory
- Items below minimum stock level
- Inventory transactions for a date range
- Inventory valuation (standard cost)
- Slow-moving or obsolete stock
- Cycle count variances
- FIFO/LIFO layer details
- Inventory adjustment history

### Category 7: iExpense — ~30 queries
Key queries available:
- Expense reports pending approval
- Expense reports by employee/period
- Policy violations in expense claims
- High-value expense analysis
- Expense aging (submitted but unpaid)
- Expense by cost centre/project

### Category 8: System Administration — ~40 queries
Key queries available:
- Concurrent program run history
- Concurrent program errors and output
- Request groups and responsibilities
- User-to-responsibility mapping
- Menu and function security
- Profile option values
- Active user sessions
- FND lookup values for a lookup type

### Category 9: Multi-Org (MOAC) — ~25 queries
Key queries available:
- All operating units for a legal entity
- Data access sets and ledgers
- Org assignments for a responsibility
- Cross-OU transactions
- MOAC security profile check

### Category 10: Performance Diagnostics — ~35 queries
Key queries available:
- Top 20 slowest SQL statements (v$sql)
- Current long-running sessions
- Locking and blocking sessions
- Index usage stats for EBS tables
- Table sizes (segments) in EBS schema
- Buffer cache hit ratio
- Shared pool fragmentation
- AWR snapshot summary

### Category 11: EBS Integration / Open Interfaces — ~30 queries
Key queries available:
- AP Open Interface error check
- GL Open Interface unprocessed records
- PO Open Interface pending imports
- AR AutoInvoice interface errors
- HR Open Interface validation errors
- Interface table row counts
- Error reconciliation by batch

### Category 12: Audit & Compliance — ~30 queries
Key queries available:
- FND audit records for a table
- Who created/updated a record (created_by, last_updated_by join to fnd_user)
- Responsibility access audit trail
- Sensitive data access log
- Password policy compliance check
- Last login for all active users
- Dormant user accounts (no login in 90 days)

---

## AI Prompt-to-SQL Feature

Users can describe a query in plain English and the AI generates the SQL:

**Example prompts and what they produce:**

| Prompt | Generated SQL Summary |
|---|---|
| "Show all unpaid AP invoices for vendor ABC over 60 days" | SELECT from ap_invoices_all with vendor name join, payment_status='UNPAID', invoice_date filter |
| "Who are the top 10 suppliers by spend this year?" | SELECT vendor_name, SUM(invoice_amount) FROM ap_invoices_all GROUP BY vendor_name ORDER BY 2 DESC |
| "Find all employees hired in the last 6 months" | SELECT from per_all_people_f and per_all_assignments_f with hire_date filter |
| "What GL accounts have no activity this period?" | LEFT OUTER JOIN gl_balances approach to find zero-balance accounts |
| "List all concurrent programs that failed today" | SELECT from fnd_concurrent_requests WHERE status_code='E' and request_date = TRUNC(SYSDATE) |

---

## Important Multi-Org Rule (Applied to All Queries)

**EVERY query on a Multi-Org EBS table MUST include `org_id` filter:**
```sql
-- Correct
SELECT * FROM ap_invoices_all WHERE org_id = :p_org_id

-- Wrong — returns all OUs, massive performance issue
SELECT * FROM ap_invoices_all
```

The SQL Lab AI always includes `AND org_id = :p_org_id` or equivalent in generated queries.

---

## Common User Questions & Answers

**Q: How do I find a query for AP aging?**
A: Search "aging" in the keyword search, or browse Category 1 (Accounts Payable).

**Q: Can I save my own queries?**
A: Yes — use the bookmark feature to save queries to your personal library (stored in browser localStorage).

**Q: Are these queries safe to run on production?**
A: All queries in the library are SELECT-only. The SQL Advisor will flag any DML.
Always test on a copy environment first.

**Q: Does the AI Prompt-to-SQL connect to the database?**
A: No. It generates SQL text only. You run the SQL yourself in Toad, SQL*Plus, or Oracle Reports.

**Q: Why can't I see SQL Lab?**
A: SQL Lab is Technical role only. Log in with the Technical credentials.

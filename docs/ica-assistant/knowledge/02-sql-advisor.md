# Tab 2: SQL Advisor — Knowledge Document

## Overview

The SQL Advisor is a Technical-role-only tool with 3 sub-capabilities:
1. **Performance Advisor** — Detects slow patterns, suggests optimisations
2. **Code Review** — 27 Oracle EBS R12 compliance checks
3. **Code Formatter** — Reformats SQL to consistent Oracle style

This tab is only visible to users logged in with the **Technical** role (DASC least-privilege).

The engine is a **client-side keyword tokeniser** — it does NOT send SQL to any AI or external
service. All 27 checks run locally in the browser using JavaScript pattern matching.

---

## Sub-tab 1: Performance Advisor

### What It Checks
The Performance Advisor analyses SQL for common Oracle EBS performance anti-patterns:

| Issue | Description | Suggestion |
|---|---|---|
| `SELECT *` | Fetches all columns — excessive I/O | Name only the columns you need |
| Missing WHERE clause | Full table scan on large EBS tables | Always filter — ap_invoices_all has millions of rows |
| Functions on indexed columns | `TO_DATE(column)` in WHERE defeats index | Move function to the literal side |
| `OR` on indexed columns | Prevents index usage | Rewrite as UNION ALL |
| Non-SARGable predicates | `LIKE '%text'` leading wildcard | Use function-based index or full-text search |
| Implicit conversion | VARCHAR2 compared to NUMBER | Explicit cast prevents index skip |
| `ROWNUM` with ORDER BY | ORDER BY after ROWNUM gives wrong results | Use subquery: WHERE rownum <= n around sorted query |
| Cartesian joins | Missing join condition between two tables | Check all tables have explicit join conditions |
| Missing hints | Heavy queries benefit from `/*+ INDEX() */` | Add hints for large AMS batch queries |
| `DISTINCT` overuse | Often a sign of missing join condition | Review join logic first |

### Example Performance Review Output
```
SQL Input:    SELECT * FROM ap_invoices_all WHERE TO_CHAR(invoice_date,'YYYY') = '2024'

Issues Found:
⚠ SELECT * — specify column list to reduce I/O
⚠ Function on indexed column — TO_CHAR(invoice_date) prevents use of index on invoice_date
   Fix: WHERE invoice_date >= DATE '2024-01-01' AND invoice_date < DATE '2025-01-01'
✓ WHERE clause present — good
Score: 65/100 — Needs optimisation
```

---

## Sub-tab 2: Code Review (27 Checks)

### The 27 Oracle EBS Compliance Checks

**Category 1 — Security & Access (Checks 1–6)**
1. `GRANT` statement present — check for unauthorized privilege grants
2. Direct table DML on production tables — should use Oracle API packages
3. `DROP` or `TRUNCATE` — destructive DDL must never be in report SQL
4. Hard-coded credentials or connection strings in SQL
5. Accessing `dba_*` views without DBA role justification
6. Missing `v$session` / `v$sql` access control comment

**Category 2 — Oracle EBS R12 Coding Standards (Checks 7–14)**
7. Multi-Org table used without OU filter (`org_id` missing)
8. `fnd_global.org_id` not used for multi-org queries
9. Missing `SET SCHEMA` or `apps.` prefix on EBS package calls
10. Direct base table access instead of using Oracle EBS views (e.g. `ap_invoices_v`)
11. Missing `gl_period_statuses` join for period-aware GL queries
12. Using `sysdate` without timezone consideration in global EBS instances
13. Missing `WHERE enabled_flag = 'Y'` on lookup tables
14. `ap_invoice_distributions_all` queried without `accounting_event_id` filter (huge table)

**Category 3 — Performance Standards (Checks 15–20)**
15. `SELECT *` from any table
16. Missing `ROWNUM` limit on unfiltered large-table queries
17. Implicit data type conversion in WHERE clause
18. Functions applied to indexed columns in WHERE clause
19. `LIKE '%text'` leading-wildcard pattern
20. Cross-join or missing join condition (Cartesian product risk)

**Category 4 — Code Quality (Checks 21–27)**
21. Missing SQL comment block (author, date, description)
22. Non-standard alias naming (should be meaningful, e.g. `ai` for `ap_invoices_all`)
23. Inconsistent capitalisation (Oracle standard: keywords UPPER, objects lower)
24. Missing semicolon at end of statement
25. Hardcoded date literals instead of parameterised dates
26. Inconsistent indentation (should be 2 or 4 spaces, not mixed tabs/spaces)
27. Missing column alias on computed or aggregated columns

### Check Result Format
Each check returns one of:
- ✅ **PASS** — compliant
- ⚠ **WARNING** — not blocking but should be fixed
- ❌ **FAIL** — must be fixed before code promotion

---

## Sub-tab 3: Code Formatter

### What It Does
Reformats pasted SQL into Oracle standard style:

- Keywords → UPPERCASE (SELECT, FROM, WHERE, AND, OR, JOIN, GROUP BY, ORDER BY)
- Object names → lowercase (table names, column names, aliases)
- Indentation → 2-space consistent indent
- One clause per line (each JOIN, WHERE condition, ORDER BY column on its own line)
- Blank lines between major clauses
- Adds semicolon if missing
- Aligns AS aliases in SELECT list

### Example: Before and After Formatting

**Before:**
```sql
select ai.invoice_id,ai.vendor_id,ai.invoice_amount,ai.invoice_date from ap_invoices_all ai where ai.invoice_date>sysdate-30 and ai.org_id=101 order by ai.invoice_date desc
```

**After:**
```sql
SELECT
  ai.invoice_id,
  ai.vendor_id,
  ai.invoice_amount,
  ai.invoice_date
FROM
  ap_invoices_all ai
WHERE
  ai.invoice_date > SYSDATE - 30
  AND ai.org_id = 101
ORDER BY
  ai.invoice_date DESC;
```

---

## Common User Questions & Answers

**Q: Does my SQL get sent to an AI or external server?**
A: No. All 27 checks run locally in your browser using JavaScript. No SQL leaves your machine.

**Q: What Oracle version are the checks based on?**
A: Oracle EBS R12.2.x. Most checks also apply to R12.1.3.

**Q: Why is SQL Advisor not visible to me?**
A: It is only shown to Technical role users. Log in with the Technical credentials.

**Q: Can I add a custom check?**
A: Yes — add the check pattern to the `sqlAdvisorChecks` array in `ebs-reports.js`.

**Q: What score counts as passing?**
A: 80/100 or above with no FAIL results is the AMS team standard.

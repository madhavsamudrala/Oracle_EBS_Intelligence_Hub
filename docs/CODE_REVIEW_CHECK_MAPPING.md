# Rule to Code Review check mapping (Phase 0, round 4)

Master field: `code_review_check_number` in `ica-schema/02-rules.json`.
Code under test: `performCodeReview()` in `ebs-reports.js` (27 checks, unchanged).
Tests: `backend/tests/test_code_review_check_mapping.py` (52 tests, read the real JavaScript).

## Rule used

A rule gets a check number **only if** that check's detection code really detects what the rule says. A similar topic is not enough. If no check matches, the field is `null` in the master, blank in the CSV and absent in the JSON-LD.

## Result: 14 mapped, 14 blank

### Mapped (number verified against the detection code and the severity)

| Rule | Name | Severity | Check | Check detects | Before |
|---|---|---|---|---|---|
| RULE_001 | Multi-Org ORG_ID Required | Critical | **5** | `_ALL` table in the multi-org list without `ORG_ID` / `MO_GLOBAL` | 4 (wrong: implicit joins) |
| RULE_002 | DateTrack PER_PEOPLE_F Filter | Critical | **6** | `PER_PEOPLE_F` (and 7 other HR tables) without `EFFECTIVE_START_DATE` / `END_DATE` | 5 (wrong: ORG_ID) |
| RULE_003 | DateTrack PER_ASSIGNMENTS_F PRIMARY_FLAG | Critical | 21 | `PER_ASSIGNMENTS_F` without `PRIMARY_FLAG = 'Y'` | 21 |
| RULE_004 | Exclude Cancelled Invoices | Minor | 23 | `AP_INVOICES_ALL` without `CANCELLED_DATE IS NULL` | 23 |
| RULE_006 | GL Summary Flag Filter | Minor | 22 | `GL_CODE_COMBINATIONS` without `SUMMARY_FLAG` / `ENABLED_FLAG` | 22 |
| RULE_007 | iExpense SOURCE Filter | Major | 25 | `AP_EXPENSE_REPORT_HEADERS_ALL` without a `SOURCE` filter | 25 |
| RULE_008 | SELECT * Wildcard Prohibited | Critical | 2 | `SELECT *` | 2 |
| RULE_009 | Correlated Scalar Subquery N+1 | Critical | 3 | `(SELECT` inside a SELECT | 3 |
| RULE_010 | EXECUTE IMMEDIATE SQL Injection | Critical | 27 | `EXECUTE IMMEDIATE` with `'` `\|\|` concatenation | 27 |
| RULE_011 | LIKE Leading Wildcard Index Bypass | Major | 15 | `LIKE '%x` | 15 |
| RULE_012 | NOT IN with NULLs | Critical | 16 | `NOT IN (SELECT ...)` | 16 |
| RULE_013 | ROWNUM with ORDER BY | Critical | 20 | `ROWNUM` with `ORDER BY` and no inline-view pattern | 20 |
| RULE_014 | FND_LOOKUPS Use VL View | Info | 24 | `FND_LOOKUPS` without `FND_LOOKUP_VALUES_VL` | 24 |
| RULE_015 | Missing SQL Comment Header | Major | 1 | no `--` and no `/*` anywhere | 1 |

Corrected: 2 (`RULE_001`, `RULE_002`). Already correct: 12.

### Blank (no genuine browser check)

| Rule | Name | Old number (what it really pointed at) | Why blank |
|---|---|---|---|
| RULE_005 | Exclude Void Cheques | 0 (no check 0) | No check looks at `VOID_DATE` or void cheques |
| RULE_016 | AP Invoice Void Cheque Filter | 6 (DateTrack) | Same as `RULE_005` |
| RULE_017 | Use MO_GLOBAL for Multi-Org Context | 7 (TRUNC on a column) | Check 14 flags a *quoted* id (`org_id = '204'`), a type problem. No check flags a hard-coded org id. Check 5 accepts `MO_GLOBAL` but only as a way to pass its own test |
| RULE_018 | DateTrack Historical Query Pattern | 8 (NVL vs COALESCE) | No as-of-date check |
| RULE_019 | PO FINALLY CLOSED Filter | 9 (ORDER BY row limit) | No PO closed_code check |
| RULE_020 | AR Complete Flag Filter | 10 (FOR UPDATE) | No `COMPLETE_FLAG` check |
| RULE_021 | AR Payment Schedule Status Filter | 11 (optimizer hints) | No `AR_PAYMENT_SCHEDULES_ALL` check |
| RULE_022 | GL Actual Flag Filter | 12 (date literals) | No `GL_BALANCES` / `ACTUAL_FLAG` check |
| RULE_023 | Inventory Organization ID Filter | 13 (SELECT DISTINCT) | No `ORGANIZATION_ID` check. Check 5 lists `MTL_MATERIAL_TRANSACTIONS`, but tests the column `ORG_ID`, which is a different column |
| RULE_024 | Use BULK COLLECT for Large Data Sets | 14 (quoted number) | No PL/SQL loop check |
| RULE_025 | Explicit Transaction Control in PL/SQL | 17 (large IN list) | No `COMMIT` / `ROLLBACK` / exception check |
| RULE_026 | WHO Columns Required in Custom Tables | 18 (hard-coded literals) | No DDL or WHO-column check |
| RULE_027 | FND_GLOBAL Context Required for EBS APIs | 19 (TRUNC SYSDATE) | No `APPS_INITIALIZE` check |
| RULE_028 | Use EXISTS Instead of IN for Subqueries | 26 (MERGE without WHERE) | See below |

### RULE_028 and check 16 (asked about specifically)

Check 16 does **not** cover `RULE_028`.

- Check 16's detection is `/NOT\s+IN\s*\(\s*SELECT\b/`. It fires only on **NOT IN** with a subquery. Its problem is NULL safety: one NULL makes the whole `NOT IN` return no rows.
- `RULE_028` is about a **positive** `IN (SELECT ...)` and the performance advice to use `EXISTS`. A positive `IN` never triggers check 16, and a query with `NOT IN` is not what `RULE_028` describes.
- Check 17 is the only other check using `IN (`; it counts the items in a literal list (over 50) and ignores subqueries.
- `RULE_012` (NOT IN with NULLs) is the rule check 16 really implements. Giving `RULE_028` the same number would make two rules share one check and would be an approximation, so it stays blank.

`test_rule_028_exists_vs_in_is_not_covered_by_check_16` proves this from the real code: it finds exactly one `IN (SELECT` pattern in all detection code and it is the negated one.

## What changed in the knowledge files

| File | Change |
|---|---|
| `ica-schema/02-rules.json` | 16 lines: `RULE_001` 4->5, `RULE_002` 5->6, 14 rules -> `null` |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | Regenerated. 14 rule nodes no longer carry `code_review_check_number`; 2 changed. 527 nodes, no other difference |
| `ica-schema/csv/approval_rules.csv` | 5 values changed to follow the master (`RULE_001`, `RULE_002`, and `RULE_005`/`017`/`023` now blank). The 11 `APR-nnn` rows were already blank |

Note: the JSON-LD build drops empty attributes, so a blank rule has no `code_review_check_number` property at all. The agent therefore cannot quote a number for it. For a mapped rule the value is stored as text, e.g. `"5"`, as before.

## What did not change

- `ebs-reports.js`: byte-identical to the tag, so the 27 checks, their order, severity and the score formula are unchanged.
- The Python `ComplianceChecker` (14 rules): untouched.
- The UI, the agent, Langflow, all keys.

## Tests (how they protect this)

`test_code_review_check_mapping.py` fails when:
- a mapped number is not a real check, or two rules share a check, or `0` is used;
- the detection code of a mapped check no longer contains the tokens the rule needs (a check was renumbered or rewritten);
- a mapped rule and its check disagree on severity;
- an unmapped rule is given a number (including the `RULE_028` -> 16 approximation);
- a browser check starts to mention `VOID_DATE`, `FINALLY`, `COMPLETE_FLAG`, `ACTUAL_FLAG`, `ORGANIZATION_ID`, `BULK`, `COMMIT` and so on, because then an unmapped rule may now be implemented and a person must review it;
- the CSV or the JSON-LD disagrees with the master (a blank must stay blank, and a blank rule must not appear in the JSON-LD).

Each of these was checked by breaking the data on purpose (6 mutations, all caught), then restoring it.

## How to map a rule later

1. Add or change the check in `ebs-reports.js` (a Phase 2 task).
2. Set the number in `02-rules.json`.
3. Add the rule to `EXPECTED_MAPPING` in the test file, with tokens from the check's detection code. Remove it from `UNMAPPED` and `UNMAPPED_TOKENS`.
4. Run `venv\Scripts\python.exe ica-schema\build_context_schema.py` and update the CSV number.
5. Replace both sources in Context Studio (see `docs/CONTEXT_STUDIO_REINGESTION.md`).

# Rule merge review (Phase 0, Option A) - for your approval

Status: **proposal. Nothing has been uploaded to Context Studio.**

- Master list: `ica-schema/02-rules.json`
- Second list: `ica-schema/csv/approval_rules.csv`
- Old-to-new table: `docs/rule_id_mapping.csv`

How to read this:
- "CSV (old)" is the row before Phase 0 (tag `demo-v6.0-pre-phase0`).
- "Master" is the row in `02-rules.json`.
- "Browser check" is the code in `ebs-reports.js` `performCodeReview()` that really runs in the SQL Advisor tab.

---

## 1. The three merges, side by side

### 1.1 CSV `RULE_018` -> master `RULE_023` (recommendation: **merge, safe**)

| | CSV (old) | Master `RULE_023` |
|---|---|---|
| Name | INV Organization Filter | Inventory Organization ID Filter |
| Type / category | sql_compliance / INV | sql_compliance / EBS Compliance |
| Severity | **Critical** | **Critical** (same) |
| Tables | MTL_SYSTEM_ITEMS_B, MTL_ONHAND_QUANTITIES_DETAIL | MTL_MATERIAL_TRANSACTIONS, MTL_ONHAND_QUANTITIES_DETAIL, MTL_SYSTEM_ITEMS_B, MTL_PARAMETERS |
| Condition | Inventory tables require `organization_id` filter to avoid cross-warehouse aggregation | MTL tables use `organization_id` (not `org_id`); a missing filter returns all organizations' data |
| Check number | 18 (sequential, wrong) | 13 |

**Rationale.** Same subject (inventory `organization_id` scoping), same severity, same two core tables. The master is a superset (two more MTL tables) and has the fix pattern `AND mmt.organization_id = :p_organization_id`. No information is lost.

**Caveat.** Neither number is backed by a browser check. Browser check 13 is `SELECT DISTINCT`, not inventory. That is the pre-existing numbering problem in section 4, not caused by this merge.

### 1.2 CSV `RULE_019` -> master `RULE_014` (recommendation: **merge; Info is the better severity**)

| | CSV (old) | Master `RULE_014` |
|---|---|---|
| Name | FND_LOOKUP_VALUES Language | FND_LOOKUPS Use VL View |
| Type / category | sql_compliance / FND | sql_compliance / EBS Compliance |
| Severity | **Minor** | **Info** |
| Table | FND_LOOKUP_VALUES_VL | FND_LOOKUPS |
| Condition | Always use the `_VL` view, or filter `language = USERENV('LANG')` on the base table | Prefer `FND_LOOKUP_VALUES_VL` (language-aware view) over `FND_LOOKUPS` for multilingual environments |
| Check number | 19 (sequential, wrong; real check 19 is "SYSDATE time component") | 24 |

**Rationale for merging.** Both say: read lookup meanings through the language-aware `_VL` view. They differ only in example wording. The CSV adds an alternative (filter on the base table); the master states the preferred fix.

**Why Minor becomes Info.**
1. Browser check 24 is the only code that enforces this rule. It reports `sev:'info'` (`ebs-reports.js`, "CHECK 24 - Using FND_LOOKUPS instead of FND_LOOKUP_VALUES_VL"). The master matches the running code; the old CSV did not.
2. The risk is the same either way: wrong-language text, and only in multilingual installs.
3. **Scoring is not affected.** The Code Review score subtracts only critical (20), major (10) and minor (5). `info` costs 0. The browser already reports this check as `info`, so no score changes. The Python `ComplianceChecker` does not implement this rule.
4. A test (`test_rule_014_severity_matches_the_browser_check_that_implements_it`) fails if the browser check, the master and the CSV ever disagree.

**What is lost:** the phrase "or filter `language = USERENV('LANG')` on the base table". To keep it, add it to the master description later. That is a one-line change in `02-rules.json`, and it means regenerating the JSON-LD and re-ingesting it. I did **not** change the master in Phase 0.

**Alternative if you disagree:** keep the old row as a separate `APR-012` with Minor. I do not recommend it, because the graph would then hold two rules for one browser check.

### 1.3 CSV `RULE_021` -> master `RULE_017` (recommendation: **merge; only partly covered, review the wording**)

| | CSV (old) | Master `RULE_017` |
|---|---|---|
| Name | Hardcoded Org ID | Use MO_GLOBAL for Multi-Org Context |
| Type / category | sql_compliance / EBS Compliance | sql_compliance / EBS Compliance |
| Severity | **Major** | **Major** (same) |
| Tables | All queries | all `_ALL` tables |
| Condition | Never hardcode numeric `org_id` values; use `mo_global.get_current_org_id()` | In MOAC environments use `MO_GLOBAL.GET_CURRENT_ORG_ID()` or `MO_GLOBAL.SET_POLICY_CONTEXT` rather than hardcoding values |
| Pattern / fix | (none) | `WHERE org_id = hardcoded_value without MO_GLOBAL` -> `WHERE org_id = MO_GLOBAL.GET_CURRENT_ORG_ID()` |
| Check number | 21 (wrong) | 7 |

**Rationale.** Same defect (a hard-coded org id), same severity, same fix function. The master also adds `SET_POLICY_CONTEXT`. This is the closest of the three.

**Caveats.**
- The master says "rather than hardcoding values". That is softer than the CSV's "Never hardcode numeric org_id". The meaning is the same.
- No browser check enforces it as written. Browser check 7 is "TRUNC() on a column". Browser check 14 catches `org_id = '204'`, but as a *type mismatch*, which is related but different. This is the section 4 numbering problem.

### 1.4 Related, and why it is NOT a merge: CSV `RULE_017` -> `APR-004`

- Old CSV `RULE_017`, "AR Posted Transactions Only" (Minor): "Filter `status != 'CL'` for open items; use `gl_date` for posted-only AR transactions".
- Master `RULE_021`, "AR Payment Schedule Status Filter" (**Major**): `status NOT IN ('CL','VOID')`.
- They overlap on `status != 'CL'`. The CSV adds a `gl_date` condition and a lower severity.
- Merging would silently change Minor to Major and drop the `gl_date` condition, so it stays separate as `APR-004`, with a note in the mapping file.
- If you prefer to merge it into `RULE_021`, tell me. It is one mapping row plus one CSV row.

---

## 2. `rule_type` and `category` differences: intentional, documented, tested

The CSV was written with finer labels than the master. Of the 16 rows that share an ID, **14 differ in a label and none differ in name or severity.**

| ID | `rule_type`: CSV vs master | `category`: CSV vs master |
|---|---|---|
| RULE_002, 003 | same | `DateTrack` vs `EBS Compliance` |
| RULE_004, 005 | same | `AP` vs `EBS Compliance` |
| RULE_006 | same | `GL` vs `EBS Compliance` |
| RULE_007 | same | `iExpense` vs `EBS Compliance` |
| RULE_008, 009, 011, 012, 013 | `sql_best_practice` vs `sql_compliance` | same |
| RULE_010 | `security` vs `sql_compliance` | same |
| RULE_014 | same | `FND` vs `EBS Compliance` |
| RULE_023 | same | `INV` vs `EBS Compliance` |

**Why they are intentional.**
- The CSV `category` is the *module or area* (AP, GL, INV). It helps the agent answer "which rules apply to AP?". The master puts 18 of its 28 SQL rules in one bucket, `EBS Compliance`, which is less useful for that question.
- The CSV `rule_type` separates *best practice* and *security* from *compliance*. The master calls all 28 SQL rules `sql_compliance`.
- These labels do not change what a rule says, its severity or its check number.

**Why not copy the master's labels into the CSV?** The two files would be identical, but the module information the agent uses would be lost. The better long-term fix (Phase 2) is to add a module field to the master and generate the CSV from it, so there is one source.

**How it is protected.** `backend/tests/test_rule_ids_consistency.py` pins the exact list above:
- `test_rule_type_differences_are_exactly_the_documented_ones`
- `test_category_differences_are_exactly_the_documented_ones`
- `test_rule_type_differences_never_change_the_rule_name_or_severity`

A new, unreviewed difference fails the test. So does removing a documented difference without updating this document.

**Data note found while checking:** the 13 shared rows also differ in `description` wording, and in `applies_to` (CSV) versus `applies_to_tables` (master). Example: `RULE_001` in the CSV says "`org_id` filter"; the master says "`org_id = :p_org_id` or MO_GLOBAL filter". The meaning is the same and the master text is more precise. Decision for you (section 5): replace the CSV descriptions with the master text, so the agent never quotes two phrasings of one rule. I recommend yes, together with the re-ingestion.

---

## 3. Other places that list rules (alignment plan)

| Source | State | Plan |
|---|---|---|
| `appstudio/oracle-ebs-intelligence-hub-agent.yaml` (v5.0) | Lists old `RULE_014`..`RULE_027` meanings | **Archived in Phase 0.** A header comment was added and the rest is byte-for-byte unchanged. New `appstudio/README.md`. The link in `docs/BOB_USAGE.md` now points to the current file, `...-agent-v6.yaml`. |
| Hidden `tab-ica` in `oracle-ebs-intelligence-hub.html` (lines ~2383-2424) | Lists 26 `RULE_nnn` entries; **0 of 26 names match the master** (for example `RULE_002` "Use bind variables"; master "DateTrack PER_PEOPLE_F Filter") | **Not changed. Needs your approval.** See 3.1. |
| `ebs-req-analyzer.js` (hidden Req Analyzer tab), lines 277-280 and 736-738 | Cites `RULE_001` ORG_ID (correct), **`RULE_002` as "bind variables" (wrong; master is DateTrack), `RULE_003` as DateTrack (wrong; master is PRIMARY_FLAG)** | Report only. See 3.2. |
| `backend/app/routes/chat.py` and `services/ica_workflow_service.py` shorthand lists (`RULE_001`..`RULE_007`) | Names agree with the master (checked by `test_rule_catalogue.py`) | No change. |

### 3.1 Hidden `tab-ica`: how it would be removed or aligned (proposal only)

The tab button has `data-hidden="true"` and `style="display:none"`. In a real browser, the employee role sees 3 tabs, the technical role sees 7, and `tab-ica` is in neither list. Options:

- **A (recommended): align the text.** Replace the 26 invented names with the master names, taken from `02-rules.json`. It is a text-only edit inside a hidden panel, so there is no visible UI change. A test would then compare the panel with the master.
- **B: remove the rule-list block** from the hidden panel. It is also invisible; the panel just has no rules section.
- **C: delete the whole hidden tab** (button, panel and any CSS or JS only it uses). Largest change; needs its own review.

Nothing has been changed. Please choose A, B, C or "leave".

### 3.2 `ebs-req-analyzer.js` (hidden tab)

Proposed: change the label text `RULE_002` to `COMP-007 (bind variables)` and `RULE_003` to `RULE_002 (DateTrack)` on lines 737-738 and 279. It is text inside generated documents only, with no layout change. Not done, because it changes generated document wording.

---

## 4. Pre-existing problem found (not fixed; Phase 2)

`code_review_check_number` in `02-rules.json` does not match the browser's real checks for many rules. For example `RULE_001` says 4 but the ORG_ID check is 5, and `RULE_016`..`RULE_028` are shifted. This was verified against `performCodeReview()`. The three merges inherit whatever number the master has. Fixing it changes `02-rules.json`, so the generated JSON-LD changes and needs re-ingestion. It is held for Phase 2.

## 5. Decisions needed from you

1. Approve or change the three merges (and `RULE_017` -> `APR-004`).
2. Master wording for `RULE_014`: add "or filter `language = USERENV('LANG')`"? This needs the JSON-LD regenerated.
3. Replace the CSV descriptions with the master text? (recommended)
4. Hidden `tab-ica`: A, B, C or leave.
5. `ebs-req-analyzer.js` label fix: yes or no.

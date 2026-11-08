# Context Studio re-ingestion package (Phase 0, round 4)

Status: **prepared, NOT uploaded.** Nothing in Context Studio has been changed. Wait for the project owner's separate approval before doing any step below.

## 1. What changed in the knowledge files

| File | Changed? | What changed | Replace or add? |
|---|---|---|---|
| `ica-schema/csv/approval_rules.csv` | **Yes** | 27 rows. 16 rows use master `RULE_nnn` IDs with the master description. 11 rows are `APR-001`..`APR-011`. Old `RULE_014`..`RULE_027` meanings are gone. Round 4: `code_review_check_number` corrected (`RULE_001` = 5, `RULE_002` = 6) and blank where no browser check exists (`RULE_005`, `RULE_017`, `RULE_023`; the 11 `APR-` rows were already blank). | **REPLACE** the existing source |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | **Yes** | (1) `RULE_014` description also says "If the base table FND_LOOKUP_VALUES is queried instead, filter language = USERENV('LANG')". (2) Round 4: `code_review_check_number` on the 28 `RULE_001`..`RULE_028` nodes: 14 keep a verified number (`RULE_001` = 5 and `RULE_002` = 6 are corrected), 14 no longer carry the property. 527 nodes before and after. | **REPLACE** the existing source |
| `ica-schema/02-rules.json` | Yes (source of the JSON-LD) | `RULE_014` line and the check numbers (`null` = no browser check) | Not uploaded. It is the input of the build script |
| `ica-schema/ebs-ontology.jsonld` | No | | Leave as is |
| `ica-schema/ebs-complete-ontology.jsonld` | No | | Leave as is |
| `ica-schema/ebs-knowledge-graph-schema.json` | No | | Leave as is |
| `ica-schema/csv/ebs_nodes.csv`, `ebs_edges.csv`, `ebs_relationships.csv`, `column_mapping_rules.csv`, `natural_language_queries.csv` | No | | Leave as is |
| `ica-schema/ebs-context-config.csv` | No | | Leave as is |

The two files that must be replaced (not added next to the old copies) are exactly:

1. `approval_rules.csv`
2. `Oracle_EBS_Intelligence_Hub.jsonld` (the 527-node domain-model upload, schema name `Oracle_EBS_Intelligence_Hub`)

## 2. Fingerprints of the files to upload

Taken from the working copy on this machine. Check them before upload (`Get-FileHash <file> -Algorithm SHA256`). Each file has two valid fingerprints because Windows Git can convert line endings: the LF form stored in Git and the CRLF form of a Windows checkout. They are the same content (the CSV differs only by 28 carriage returns). Which form you have depends on how the folder was created. If your hash matches neither row for that file, do not upload.

| File | Bytes | SHA-256 |
|---|---|---|
| `ica-schema/csv/approval_rules.csv` | 5,326 (as stored in Git, LF; also this working folder) | `e675b1ff6ddeffb4ccc419439c49b62c6ecf8c711fa9020e1db9d3bb7957a3ea` |
| `ica-schema/csv/approval_rules.csv` | 5,354 (fresh Windows checkout, CRLF) | `2c4adf8b4871c818f5cb6f92157bb4afb5048bb73c340f13470e327755db2943` |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | 513,887 (Windows working copy, CRLF) | `1f2432a110529718eccfb14ce05b41e73601262ec4828e368a1b3cba5ccc7821` |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | 501,386 (as stored in Git, LF) | `7fe1f28d2548779233475fb4aa1fb313565fafc5db392c59b43ef5d3add773db` |

Do NOT upload the root-level `Oracle_EBS_Intelligence_Hub.jsonld` (git-ignored, older, contains demo password hints). The correct file is inside `ica-schema/`.

## 3. Exact steps (when approved)

Do these in the Context Studio web UI, in this order.

1. Open the context `oracle-ebs-intelligence-hub` and go to its sources list.
2. Note the current source names for `approval_rules.csv` and `Oracle_EBS_Intelligence_Hub.jsonld`. Take a screenshot or copy the list so you can compare afterwards.
3. **CSV.** Delete (or use "replace" on) the existing `approval_rules.csv` source. Upload `ica-schema/csv/approval_rules.csv`. Wait until ingestion shows "completed".
4. **JSON-LD.** Delete (or use "replace" on) the existing `Oracle_EBS_Intelligence_Hub.jsonld` source. Upload `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` with format `domain-model-jsonld` and schema name `Oracle_EBS_Intelligence_Hub`. Wait until ingestion shows "completed".
5. Do not touch any other source.
6. If the UI cannot delete a source but can only add one, stop and ask. Adding without deleting leaves the old `RULE_014`..`RULE_027` meanings in the graph, and the agent keeps mixing them.

If a delete is not possible, the fallback is a new context with all files uploaded in the order given in `ica-schema/README.md`; that needs a new context ID and an agent update, so ask first.

## 4. How to check it worked (Playground or Chat tab)

| Question | Expected |
|---|---|
| What is RULE_021? | "AR Payment Schedule Status Filter" |
| What is RULE_017? | "Use MO_GLOBAL for Multi-Org Context", severity Major, mentions `MO_GLOBAL.GET_CURRENT_ORG_ID()` or `SET_POLICY_CONTEXT` |
| What is RULE_014? | "FND_LOOKUPS Use VL View", severity Info, mentions `FND_LOOKUP_VALUES_VL` and `language = USERENV('LANG')` |
| What is RULE_023? | "Inventory Organization ID Filter", severity Critical, lists the 4 MTL tables |
| What is RULE_019? | "PO FINALLY CLOSED Filter" (NOT "FND_LOOKUP_VALUES Language") |
| What is APR-004? | AR posted transactions rule (the old CSV `RULE_017`), severity Minor |
| Which Code Review check number covers RULE_001? | **5** (ORG_ID missing on a multi-org table). Not 4 |
| Which Code Review check number covers RULE_002? | **6** (DateTrack effective-date filter). Not 5 |
| Which Code Review check number covers RULE_028? | No number. The agent should say no browser check implements it. It must not say 16 |
| Which Code Review check covers RULE_021 (or 005, 016, 017, 018-027)? | No number. A number such as 11, 0, 6 or 7 means the old data is still present |
| Which rule does Code Review check 16 implement? | `RULE_012` NOT IN with NULLs |
| What SQL rules apply to ap_invoices_all? | Master `RULE_nnn` IDs plus `APR-` IDs for CSV-only rules; no old meaning for `RULE_014`..`RULE_027` |

Failure signs: a check number for any of the 14 blank rules (see `docs/CODE_REVIEW_CHECK_MAPPING.md`), `RULE_019` described as a language/lookup rule, `RULE_014` described as "GL_BALANCES currency filter", or the same ID with two different names in one answer. If you see any of these, the old source is still present; go back to step 3 or 4.

## 5. Rollback

The previous versions are in Git:

    git show demo-v6.0-pre-phase0:ica-schema/csv/approval_rules.csv
    git show demo-v6.0-pre-phase0:ica-schema/Oracle_EBS_Intelligence_Hub.jsonld

Re-upload those two files the same way (replace, not add) to return to the earlier state.

## 6. Not part of this package

- The live agent instructions (the "Never reveal" constraint is still missing there). Change that separately in Agent Studio.
- Credentials. Nothing here contains a key. Rotation is in `docs/SECURITY_CLEANUP.md`.
- Adding NEW browser checks for the 14 unmapped rules (Phase 2). Mapping them later needs a regenerate of the JSON-LD and one more replace of both sources. The procedure is in `docs/CODE_REVIEW_CHECK_MAPPING.md`.

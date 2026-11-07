# Context Studio re-ingestion package (Phase 0, round 3)

Status: **prepared, NOT uploaded.** Nothing in Context Studio has been changed. Wait for the project owner's separate approval before doing any step below.

## 1. What changed in the knowledge files

| File | Changed? | What changed | Replace or add? |
|---|---|---|---|
| `ica-schema/csv/approval_rules.csv` | **Yes** | 27 rows. 16 rows use master `RULE_nnn` IDs with the master description. 11 rows are `APR-001`..`APR-011`. Old `RULE_014`..`RULE_027` meanings are gone. | **REPLACE** the existing source |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | **Yes** | One description line only: `RULE_014` now also says "If the base table FND_LOOKUP_VALUES is queried instead, filter language = USERENV('LANG')". 527 nodes before and after. | **REPLACE** the existing source |
| `ica-schema/02-rules.json` | Yes (source of the JSON-LD) | Same one `RULE_014` line | Not uploaded. It is the input of the build script |
| `ica-schema/ebs-ontology.jsonld` | No | | Leave as is |
| `ica-schema/ebs-complete-ontology.jsonld` | No | | Leave as is |
| `ica-schema/ebs-knowledge-graph-schema.json` | No | | Leave as is |
| `ica-schema/csv/ebs_nodes.csv`, `ebs_edges.csv`, `ebs_relationships.csv`, `column_mapping_rules.csv`, `natural_language_queries.csv` | No | | Leave as is |
| `ica-schema/ebs-context-config.csv` | No | | Leave as is |

The two files that must be replaced (not added next to the old copies) are exactly:

1. `approval_rules.csv`
2. `Oracle_EBS_Intelligence_Hub.jsonld` (the 527-node domain-model upload, schema name `Oracle_EBS_Intelligence_Hub`)

## 2. Fingerprints of the files to upload

Taken from the working copy on this machine. Check them before upload (`Get-FileHash <file> -Algorithm SHA256`). A fresh clone on Windows may convert line endings, so a different hash on a clone does not by itself mean a wrong file; compare content, or upload from this working folder.

| File | Bytes | SHA-256 |
|---|---|---|
| `ica-schema/csv/approval_rules.csv` | 5,330 | `ecb726ab12ee7d23d87be8f58edfd202ccbe147b4d006cda0862a2f5cfcfd646` |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | 514,484 | `23b23ffdfca00d3ebd37808d68db6ec2aa6066842b302174d744ed7463aba17b` |

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
| What SQL rules apply to ap_invoices_all? | Master `RULE_nnn` IDs plus `APR-` IDs for CSV-only rules; no old meaning for `RULE_014`..`RULE_027` |

Failure signs: `RULE_019` described as a language/lookup rule, `RULE_014` described as "GL_BALANCES currency filter", or the same ID with two different names in one answer. If you see any of these, the old source is still present; go back to step 3 or 4.

## 5. Rollback

The previous versions are in Git:

    git show demo-v6.0-pre-phase0:ica-schema/csv/approval_rules.csv
    git show demo-v6.0-pre-phase0:ica-schema/Oracle_EBS_Intelligence_Hub.jsonld

Re-upload those two files the same way (replace, not add) to return to the earlier state.

## 6. Not part of this package

- The live agent instructions (the "Never reveal" constraint is still missing there). Change that separately in Agent Studio.
- Credentials. Nothing here contains a key. Rotation is in `docs/SECURITY_CLEANUP.md`.
- `code_review_check_number` corrections in `02-rules.json` (Phase 2). Doing that later needs one more regenerate and replace of the JSON-LD.

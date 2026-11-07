# Phase 0 - what changed, why, and how to test it

Branch: `phase0-stabilise`  |  Rollback point: git tag `demo-v6.0-pre-phase0` (the demo exactly as it was).

To go back to the old demo at any time:

    git checkout main          (main was not touched by Phase 0)
    git checkout demo-v6.0-pre-phase0     (the exact same code, read-only view)

## 1. Summary

| # | Problem | Fix | Files |
|---|---|---|---|
| 1 | The backend said `success: true` when the agent replied "Invalid token" (HTTP 200 with an apology inside). | A new classifier reads the reply and rejects apologies. | `services/ica_reply.py` (new), `routes/chat.py` |
| 2 | The page showed that apology as a normal answer, or silently swapped in a local answer. | Genuine AI failures show a red "no answer generated" bubble with the reason. | `ebs-ica-integration.js`, `oracle-ebs-intelligence-hub.html` (cache-buster only) |
| 3 | `RULE_003` meant "SELECT *" in the Python checker but "PRIMARY_FLAG" in the knowledge graph (also `RULE_016`, `RULE_024`). | One catalogue of rule IDs, using the graph's IDs. | `services/rule_catalogue.py` (new), `services/compliance_checker.py` |
| 4 | No tests existed. | 90 Python tests + 7 JavaScript tests. | `backend/tests/` (new), `backend/requirements-dev.txt` (new) |
| 5 | `ica-schema/csv/approval_rules.csv` reused `RULE_014`..`RULE_027` with different meanings from the master `02-rules.json`, so the agent mixed them up. | CSV rewritten: shared rules use master IDs; 11 CSV-only rules renamed `APR-001`..`APR-011`. Mapping file added. | `ica-schema/csv/approval_rules.csv`, `docs/rule_id_mapping.csv` (new), 2 READMEs |
| 6 | A brief "knowledge graph unreachable" reply failed the whole question. | One automatic retry for `unreachable` only. The final message now says what happened on both attempts. | `routes/chat.py` |
| 7 | Old v5 agent YAML listed outdated rule IDs and looked current. | Marked ARCHIVED (comment header only), new `appstudio/README.md`, link fixed in `BOB_USAGE.md`. | `appstudio/*`, `docs/BOB_USAGE.md` |
| 8 | Nothing stopped a credential file or key from being committed. | Guard test + written inventory and rotation checklist. | `backend/tests/test_no_secrets_tracked.py`, `docs/SECURITY_CLEANUP.md` |

Not changed: every other tab, the UI layout, the agent, Langflow, the keys, the SQL Advisor browser code (27 checks), the formatter.

## 2. File by file

### 2.1 `backend/app/services/ica_reply.py` (NEW)

**What was wrong:** nothing existed to judge a reply. Langflow answers HTTP 200 even when the agent could not reach Context Studio, so the old code treated every 200 as success. Python status codes only say "the HTTP call worked", not "the answer is real".

**What it does:** `classify_reply(text)` returns `ReplyCheck(ok, kind, source, user_message)`.

| Reply looks like | `ok` | `kind` | `source` |
|---|---|---|---|
| Normal answer, greeting | True | ok | `ica_live` |
| "Invalid token", "token issue" | False | `auth` | `ica_tool_error` |
| "connection failure", "not accessible", "system startup" | False | `unreachable` | `ica_tool_error` |
| Tool Trace line says failed | False | `tool_failed` | `ica_tool_error` |
| "The agent request failed ..." | False | `agent_error` | `ica_agent_error` |
| "...Session mint failed ... exp claim" (Langflow session expired) | False | `session_expired` | `ica_agent_error` |
| Empty | False | `empty_reply` | `ica_agent_error` |

Also `redact_secrets(text)` replaces anything that looks like a key (`eyJ...`, `sk-...`, `lf-...`, `x-api-key=...`) with `[redacted]` before it is logged.

**Why this design:** a long real answer can legitimately contain the words "invalid token" (for example an explanation). So failure phrases are only trusted in SHORT replies (1,200 characters or less), or when the `Tool Trace:` line itself says the tool failed. This is covered by tests.

**Honest limit:** this reads text. If the agent words an apology in a way no pattern matches, it would still pass as an answer. The plan's Phase 3 replaces this with a structured status from the agent.

**Existing functionality affected:** none. It is a pure function with no side effects.

### 2.2 `backend/app/routes/chat.py` (EDITED, 5 places)

1. `import` of `classify_reply, redact_secrets`.
2. `ChatResponse` got one new optional field `error_kind` (default `None`). Old callers ignore unknown fields, so nothing breaks.
3. In the HTTP 200 branch the old test was:

        if not text or text starts with "the agent request failed": -> error
        else: -> success

   It is now: `check = classify_reply(text)`; if `not check.ok` return `success=False` with `check.user_message`, `check.source`, `error_kind`; otherwise success exactly as before. The error log line now goes through `redact_secrets` and is cut at 300 characters.

4. **Retry for `unreachable` only (added after review).** If the reply is classified `unreachable`, the route waits `UNREACHABLE_RETRY_DELAY` (1.5 s) and sends the SAME read-only question to Langflow ONE more time.
   - It is a separate one-shot step, not tied to `MAX_RETRIES`, so it can never loop. Maximum 2 calls per question.
   - `auth`, `session_expired`, `agent_error`, `tool_failed` and `empty_reply` are never retried; the error stays visible.
   - Langflow/Context Studio calls here only read the knowledge graph, so a retry cannot create a duplicate record.
   - If the retry itself fails (network error), the first `unreachable` result is reported.
   - **The final message reflects both attempts.** After a retry the text ends with e.g. `Tried 2 times (1: unreachable; 2: unreachable).` The labels are fixed words only (the reply kind, `HTTP <status>`, or the exception class name such as `ConnectError`). Reply text, URLs and keys are never included. The server log keeps a redacted 300-character copy of the last reply.
   - `ChatResponse` has a new field `attempts` (1 normally, 2 after a retry). Old clients ignore it.

**Unchanged:** 401/403, 5xx with retries, timeout, connect error, not-configured, empty-message. Tests confirm each.

**Behaviour change you will notice:** `test-ica.bat` tests 2-5 that used to print `"success":true,"source":"ica_live"` with an apology now print `"success":false,"source":"ica_tool_error"`. That is the fix working.

### 2.3 `ebs-ica-integration.js` (EDITED, 2 places)

**What was wrong:** `icaWorkflowChat` returned `null` for anything that was not `success: true`. The caller treated `null` as "ICA unavailable" and silently showed a local keyword answer. A user could not tell a real AI answer from a fallback.

**What changed:**
- `icaWorkflowChat`: if the backend answered `success: false` with a message, it now returns `{failed:true, kind, source, message}`. Real network or HTTP errors still return `null`, as before.
- The caller: if the result has `failed`, it turns the blue bubble red and shows "ICA Agent - no answer generated", the reason, and `AI error - <kind> - <time>`. The text is HTML-escaped. It does not fall back to local.

**Unchanged:** report-style questions still go to the local report logic; backend down or HTTP error still falls back to local; the normal "ICA Agent Response" bubble is the same.

**Cache-buster:** `ebs-ica-integration.js?v=21` -> `?v=22` in the HTML, so browsers load the new file. That is the only HTML edit.

### 2.4 `backend/app/services/rule_catalogue.py` (NEW) and `compliance_checker.py` (EDITED)

**What was wrong:** same ID, two meanings.

| ID | Old checker said | Knowledge graph says |
|---|---|---|
| RULE_003 | SELECT * | DateTrack PER_ASSIGNMENTS_F PRIMARY_FLAG |
| RULE_016 | DDL statement | AP Invoice Void Cheque Filter |
| RULE_024 | IS NOT NULL / NVL | Use BULK COLLECT for Large Data Sets |
| RULE_005 | IN (SELECT) | Exclude Void Cheques |
| RULE_007 | LIKE leading wildcard | iExpense SOURCE Filter |

The docstring also claimed "28 rules" and a JavaScript function that does not exist (the checker has 14).

**Three ID families, one rule for choosing:**
1. `COMP-nnn` (ontology) if the rule exists there.
2. else `RULE_nnn` (`ica-schema/02-rules.json`) if it exists there, with the graph's exact name.
3. else `LOCAL-nnn`: a check only this checker performs, so nobody mistakes it for a graph rule.

**Resulting catalogue (14 checks):**

| Check | Old ID | New ID | In graph |
|---|---|---|---|
| ORG_ID missing | RULE_001 | COMP-001 ORG_ID Required | yes |
| Hard-coded literal | RULE_002 | COMP-007 Bind Variables Required | yes |
| SELECT * | RULE_003 | COMP-008 No SELECT Star in Production | yes |
| Function on column | RULE_004 | COMP-009 No Functions on Indexed Columns | yes |
| IN (SELECT) | RULE_005 | RULE_028 Use EXISTS Instead of IN | yes |
| Large table, no ROWNUM | RULE_006 | LOCAL-001 | no |
| LIKE leading % | RULE_007 | RULE_011 LIKE Leading Wildcard Index Bypass | yes |
| NOT IN (SELECT) | RULE_008 | RULE_012 NOT IN with NULLs | yes |
| EXECUTE IMMEDIATE | RULE_009 | RULE_010 EXECUTE IMMEDIATE SQL Injection | yes |
| DDL | RULE_016 | LOCAL-002 | no |
| DML | RULE_017 | LOCAL-003 | no |
| Numeric literal | RULE_018 | COMP-007 Bind Variables Required | yes |
| No table alias | RULE_019 | LOCAL-004 | no |
| IS NOT NULL | RULE_024 | LOCAL-005 | no |

**What changed in `compliance_checker.py`:** each rule has a `key` instead of an `id`; the ID, name and `in_graph` flag come from the catalogue; the response findings gained two optional fields (`name`, `in_graph`). **Detection patterns, severities and scoring are untouched.** A test compares scores and fired checks to a baseline captured before the edit.

**Two rules share COMP-007** (hard-coded string literal and numeric literal). Both are "use bind variables" in the graph, so they get the same ID. If both fire, you see COMP-007 twice with different messages.

**Where else rule IDs appear:** `chat.py` (`EBS_KNOWLEDGE`, `MODULE_RULES`) and `ica_workflow_service.py` quote `RULE_001`-`RULE_007`. A test confirms these already match the graph names (ORG_ID, DateTrack, PRIMARY_FLAG, Cancelled, Void, Summary, SOURCE), so they were left alone.

**Not touched (Phase 2):** the 27 browser Code Review checks have no rule IDs. Mapping them is part of the rule-engine phase. `ica-schema/02-rules.json` already records `code_review_check_number` for the 24 it covers.

**Existing functionality affected:** `POST /api/sql_advisor` is the only caller. The page never calls it. Output has the same fields plus the new ones.

## 3. Tests

Run from the repository root:

    venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
    venv\Scripts\python.exe -m pytest backend/tests -v
    node backend/tests/js/test_ica_failure_ui.js

| File | Tests | Proves |
|---|---|---|
| `test_ica_reply.py` | 14 | Real answers pass; every apology type is rejected; long answers are not falsely rejected; secrets are redacted |
| `test_chat_route.py` | 27 | `/api/chat` with a FAKE Langflow: success, apology, agent error, empty, 401, 500, timeout, connect error, not configured, no secret in logs; plus the `unreachable` retry (success after retry, exactly 2 calls when it fails twice, retry network error, and auth / session / agent / empty are called exactly once); the final message lists both attempts and never contains reply text or keys |
| `test_rule_ids_consistency.py` | 24 | CSV descriptions equal the master; `RULE_014` carries the language filter in master and JSON-LD; hidden `tab-ica` shows all 28 master names; the analyzer cites `COMP-007` / `RULE_002`; the re-ingestion doc hashes match the files; No duplicate IDs; the same ID never has two names; CSV severity and check numbers equal the master; CSV-only rules are `APR-nnn`; the mapping file covers all 27 old IDs and points at real IDs; catalogue names equal the master; the `rule_type` / `category` differences are exactly the documented list; RULE_014 severity equals the browser check |
| `test_no_secrets_tracked.py` | 5 | No credential file name and no key-shaped value is tracked; test fixtures must be marked as invented; the old key prefix is absent |
| `test_rule_catalogue.py` | 20 | Every check catalogued; old clashing IDs gone; IDs and names equal the graph files; scores identical to the pre-Phase-0 baseline |
| `js/test_ica_failure_ui.js` | 7 | Real `ebs-ica-integration.js` in a fake browser: red bubble for AI failure, HTML escaped, old fallbacks kept |

The tests need no internet and no keys. Mutation check done: running the same chat and JS tests against the OLD code from the rollback tag makes them fail (5 Python and 3 JavaScript failures), which proves they detect the bug. The ID tests fail 4 of 14 (original 14) against the pre-fix CSV; the retry tests fail 4 when the retry is removed and 4 when every failure is retried; the secret guard fails on a tracked credential file and on a key-shaped value, and does not print the value.

## 4. Expected responses of `POST /api/chat`

Success:

    {"success": true, "message": "COMP-008 says ... Tool Trace: hybrid-query - ...", "source": "ica_live", "session_id": "...", "error_kind": null}

Invalid Context Studio token inside the reply:

    {"success": false, "message": "The ICA agent could not read the Context Studio knowledge graph because its access token was rejected (Invalid token). No answer was generated. ...", "source": "ica_tool_error", "error_kind": "auth"}

Langflow session expired:

    {"success": false, "message": "The ICA session in Langflow has expired. ... close and reopen it ...", "source": "ica_agent_error", "error_kind": "session_expired"}

Wrong Langflow API key (HTTP 401/403 from Langflow, unchanged behaviour):

    {"success": false, "message": "ICA auth failed (403)", "source": "ica_auth_error", "error_kind": null}

## 5. Manual check in the browser

1. Start everything (`start-all.bat`), press Ctrl+F5.
2. Ask `Why should SELECT * be avoided in production queries?`.
   - Everything healthy: blue "ICA Agent Response" bubble with COMP-008.
   - Langflow session expired or Invalid token: RED bubble "ICA Agent - no answer generated" with the reason. No local answer is substituted.
3. Ask `Show me aged payables for last 30 days`: local report table as before.

## 6. Rule ID clean-up (Option A)

**Problem.** The knowledge graph held two rule lists. `ica-schema/02-rules.json` (33 rules, master) and `ica-schema/csv/approval_rules.csv` (27 rules). IDs `RULE_014`..`RULE_027` meant different things in each (for example `RULE_021` = "Hardcoded Org ID" in the CSV, "AR Payment Schedule Status Filter" in the master). The agent quoted both.

**Decision.** `02-rules.json` stays the master. Only files changed; nothing was uploaded to Context Studio.

**Files changed:** `ica-schema/csv/approval_rules.csv`, `docs/rule_id_mapping.csv` (new), `ica-schema/README.md`, `ica-schema/csv/README.md`, `backend/app/services/rule_catalogue.py` (docstring only), `backend/tests/test_rule_ids_consistency.py` (new).

**Result (27 rows):** 13 rows already matched the master (wording aligned for 5), 3 rows merged into a master rule, 11 rows are CSV-only and now use the separate `APR-nnn` namespace with a blank `code_review_check_number` (no browser check implements them).

| Old CSV ID | Old name | New ID |
|---|---|---|
| RULE_014 | Missing GL_BALANCES Currency Filter | APR-001 |
| RULE_015 | PO Authorization Status | APR-002 |
| RULE_016 | AP Payment Status Flag | APR-003 |
| RULE_017 | AR Posted Transactions Only | APR-004 |
| RULE_018 | INV Organization Filter | RULE_023 (merged into master) |
| RULE_019 | FND_LOOKUP_VALUES Language | RULE_014 (merged into master) |
| RULE_020 | GL Period Status Open | APR-005 |
| RULE_021 | Hardcoded Org ID | RULE_017 (merged into master) |
| RULE_022 | Missing TRUNC on Date Comparison | APR-006 |
| RULE_023 | Implicit Column Conversion | APR-007 |
| RULE_024 | Cartesian Join Risk | APR-008 |
| RULE_025 | Bind Variable Missing in WHERE | APR-009 |
| RULE_026 | Missing NOVALIDATE on FK | APR-010 |
| RULE_027 | DBMS_OUTPUT in Production | APR-011 |

`RULE_001`..`RULE_013` keep their IDs. The full table, including notes, is `docs/rule_id_mapping.csv`.

**Judgement calls to review:** the three merges were decided by meaning. `RULE_021` "Hardcoded Org ID" is only partly covered by master `RULE_017`; CSV `RULE_017` overlaps master `RULE_021` on `status != CL` but adds a gl_date check, so it became `APR-004`. CSV `RULE_019` and master `RULE_014` differ slightly (master severity is Info, the old CSV said Minor; the master value is now used). The CSV keeps its finer `rule_type`/`category` labels (for example `security`, `DateTrack`); the test intentionally does not compare those.

**Not changed (reported only):**
- `appstudio/oracle-ebs-intelligence-hub-agent.yaml` (old v5 agent) still lists the old `RULE_014`..`RULE_027` meanings. The live v6 agent does not use it.
- Hidden `tab-ica` in `oracle-ebs-intelligence-hub.html` shows a third set of rule names. No user role can open it.
- `02-rules.json` has pre-existing wrong `code_review_check_number` values (for example `RULE_001` says 4, the real ORG_ID check is 5). Phase 2 work.
- `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` is generated from `02-rules.json`, which did not change, so it is identical.

## 7. Context Studio re-ingestion (NOT done - for you to do)

Superseded by round 3: the full, exact instructions are in **`docs/CONTEXT_STUDIO_REINGESTION.md`**. In short, two existing sources must be REPLACED (deleted and re-uploaded, never added next to the old copy):

| File | Action |
|---|---|
| `ica-schema/csv/approval_rules.csv` | **Replace.** New IDs and master descriptions. |
| `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | **Replace.** One description line changed (`RULE_014`). 527 nodes. |
| `ica-schema/02-rules.json`, every other CSV and JSON file | No upload. |

## 8. Review round 2 additions

- **Merge comparison for approval:** `docs/RULE_MERGE_REVIEW.md` (side by side for `RULE_018`->`RULE_023`, `RULE_019`->`RULE_014` including Minor->Info, `RULE_021`->`RULE_017`; intentional `rule_type`/`category` differences, pinned by tests; hidden-tab and analyzer plan).
- **Security:** `docs/SECURITY_CLEANUP.md` (credential inventory, history checks, rotation checklist). Nothing deleted or rotated.
- **Archived v5 agent YAML:** header comment only; the rest is byte-for-byte unchanged.
- **Regression of the seven tabs:** see section 9.

## 9. Browser regression result (real Edge, headless)

A script opened `oracle-ebs-intelligence-hub.html` for both roles, visited every visible tab, and ran Code Review on a fixed query. The same script was run on the pre-Phase-0 tag (`demo-v6.0-pre-phase0`) and on the current code.

| Check | Pre-Phase-0 tag | Current |
|---|---|---|
| Employee tabs that open | Chat, Reports, Data Connect | identical |
| Technical tabs that open | all 7 | identical |
| Hidden tabs (Req Analyzer, Req Studio, ICA) visible to anyone | no | no |
| Per-tab content size (text length, buttons, inputs) | recorded | identical for all 7 |
| Code Review on `SELECT * ... ORDER BY` | Score 40/100, 21 cards | Score 40/100, 21 cards |
| New console errors | only the CORS error for `/health` (no backend in this test) | same |

Chat tab with a stubbed backend (real page code, fake `/api/chat`):

| Backend reply | Pre-Phase-0 | Current |
|---|---|---|
| Real answer | answer shown | answer shown |
| `unreachable` (after 2 tries) | silently replaced by a local answer | red "no answer generated" with `Tried 2 times (...)` |
| `Invalid token` | silently replaced by a local answer | red "no answer generated" |
| Report-style question | local report | local report (no backend call) |
| Backend down | local fallback | local fallback (unchanged) |

Not covered: pixel/visual comparison (no screenshots were compared), Excel upload, exports, report deletion workflow, and the live Langflow path (needs the running backend and your keys). Those use code that Phase 0 did not touch (`ebs-reports.js` and the data files are byte-identical to the tag).

## 10. Review round 3: approved rule corrections (applied)

Decisions applied exactly as approved. Full reasoning is in `docs/RULE_MERGE_REVIEW.md`.

| # | Change | Files | Effect on detection, scoring, UI |
|---|---|---|---|
| 1 | Merges `RULE_018`->`RULE_023`, `RULE_019`->`RULE_014` (Minor->Info), `RULE_021`->`RULE_017`, and `RULE_017`->`APR-004` confirmed. Rationale and severity difference kept in the review doc. | `docs/RULE_MERGE_REVIEW.md` | None |
| 2 | `RULE_014` master description gained: "If the base table FND_LOOKUP_VALUES is queried instead, filter language = USERENV('LANG')". Checked first against browser check 24 (it only flags `FND_LOOKUPS` without `FND_LOOKUP_VALUES_VL`) and against `ebs-reports.js`, which already uses `language = USERENV('LANG')` for base-table translation joins. JSON-LD regenerated: the only diff is that line, still 527 nodes. | `ica-schema/02-rules.json`, `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` | None |
| 3 | The 16 shared CSV rows use the master description word for word. The 11 `APR-nnn` rows keep their own text (hash unchanged). | `ica-schema/csv/approval_rules.csv` | None |
| 4 | Hidden `tab-ica`: rule list text aligned. 24 invented items replaced by all 28 `RULE_001`..`RULE_028` with master names, same five groups and CSS classes. Tab kept, still hidden for both roles. | `oracle-ebs-intelligence-hub.html` | No visible change. Hidden panel only. |
| 5 | `ebs-req-analyzer.js`: bind-variable note `RULE_002`->`COMP-007`; DateTrack note `RULE_003`->`RULE_002`. Checked against `ebs-ontology.jsonld` (`COMP-007` = Bind Variables Required) and the master (`RULE_002` = DateTrack PER_PEOPLE_F Filter). Two text strings, no logic. Script cache-buster `?v=20`->`?v=21`. | `ebs-req-analyzer.js`, `oracle-ebs-intelligence-hub.html` | None on detection. Wording in generated documents only. |
| 6 | 6 new tests. The CSV-description test and the tab-ica test were each shown to fail when the data was broken on purpose, and to pass again once restored. | `backend/tests/test_rule_ids_consistency.py` | n/a |

### Regression after round 3 (real Edge, headless, pre-Phase-0 tag vs current)

| Check | Result |
|---|---|
| Visible tabs, employee role | 3 and 3, identical |
| Visible tabs, technical role | 7 and 7, identical |
| Content of the 9 tabs other than `tab-ica` (text length, buttons, inputs) | identical, both roles |
| Hidden `tab-ica` | differs on purpose: 24 -> 28 rule items. Not reachable by any role. |
| Code Review on a fixed query | identical: same score, 21 cards, same text length |
| Console errors | identical (only the CORS error for `/health`, because no backend ran) |

The Code Review score in this run is 50/100 on both sides (the earlier run used a different query, which scored 40). The point is that the tag and the current code agree.

Unchanged by round 3: `ebs-reports.js` (27 browser checks), the Python `ComplianceChecker` (14 rules, baseline test passes), scoring weights.
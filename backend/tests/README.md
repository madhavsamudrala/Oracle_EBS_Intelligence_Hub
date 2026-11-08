# Phase 0 tests

Run from the repository root:

    venv\Scripts\python.exe -m pytest backend/tests -v
    node backend/tests/js/test_ica_failure_ui.js

What is covered

| File | What it proves |
|---|---|
| `test_ica_reply.py` | The classifier separates real answers from agent apologies (Invalid token, unreachable, empty, "agent request failed"). Also redacts keys. |
| `test_chat_route.py` | `/api/chat` returns `success=false` + a clear message + `error_kind` for apologies, and `success=true` for real answers. Uses a FAKE Langflow, no network, no keys. |
| `test_rule_catalogue.py` | Every checker rule has a catalogued ID, the old clashes are gone, IDs exist in the knowledge-graph files. |
| `test_compliance_checker.py` | Scores and findings are identical to the pre-Phase-0 baseline (`fixtures/checker_baseline_before_phase0.json`); only the IDs changed. |
| `test_code_review_check_mapping.py` | Each rule's `code_review_check_number` points at a browser check that really detects it (read from `ebs-reports.js`); unmapped rules stay blank; CSV and JSON-LD agree with the master. | The browser code turns a failed reply into a visible red error bubble, and keeps the old behaviour for network errors. |

These tests need no Context Studio key, no Langflow and no internet.

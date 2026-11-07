# Security clean-up: credential inventory and rotation checklist

Prepared during Phase 0. **No secret value appears in this file.** It lists file names, counts and lengths only.
**Nothing was deleted, rotated or revoked.** Every action below is waiting for the owner's approval.

---

## 1. Findings in one table

| # | Finding | Where | Risk | Status |
|---|---|---|---|---|
| 1 | `Oracle_EBS_Intelligence_Hub.jsonld` (repo root) holds two `password_hint` fields. **Both equal the current demo login passwords** (checked by comparison, values not printed). | Untracked, now git-ignored | High if committed, shared or uploaded | Never committed. `.gitignore` line added (section 4). |
| 2 | `agent-orchestration-creation.yaml` contains a Context Studio key fragment (1 JWT-shaped string, 3 `x-api-key` mentions). | Untracked, now git-ignored | High if committed or shared | Never committed. `.gitignore` line added. |
| 3 | `backend/.env` holds the current Langflow API key (46 characters). | Git-ignored | Normal (local only) | Never committed. Correct. |
| 4 | `ebs-credentials.js` holds the two demo login passwords. | Git-ignored | Normal (local only) | Never committed. Correct. |
| 5 | Old folder `oracle-ebs-reports`: the demo login passwords are **in committed files and in 5 commits** (README, `ebs-reports.js`, specs, `ica-schema/*.json`, `appstudio/ebs-reports-agent.yaml`, ...) and in shared-style documents (2 `.docx`, 3 `.html` presentations). | Old folder, old git repo | Medium: the old repo has **no remote**, but copies of the folder or documents may have been shared | New repo history is clean (0 commits). Old folder untouched. |
| 6 | Old folder: older Langflow key, Context Studio key and MCP bearer token sit in untracked files: `backend/.env`, `.bob/mcp.json`, `docs/ica-assistant/AGENT_SETUP_GUIDE.md`, `agent-orchestration-edit (1)(2)(7)(8).yaml`. | Old folder, untracked | High if the folder was zipped or shared | Not touched. Rotate (section 3). |
| 7 | An earlier local Phase 0 commit had a test fixture with the **first 4 characters of the old Langflow key prefix** plus an invented suffix. | Local commit only (never pushed) | Very low (not a usable key) | Fixed: the fixture is now obviously fake and the local Phase 0 history was rebuilt so the old text is in no commit that is pushed (section 5). |
| 8 | Tracked `appstudio/oracle-ebs-intelligence-hub-agent.yaml` contains two `password_hint` fields. | Tracked | None: the value is the sentence "see local ebs-credentials.js" | No action. |

## 2. Credential-bearing files (new repo)

| File | Holds | Tracked? | Git-ignored? | Action |
|---|---|---|---|---|
| `backend/.env` | Langflow API key | no | **yes** (`*.env`) | none |
| `ebs-credentials.js` | demo login passwords | no | **yes** | none |
| `Oracle_EBS_Intelligence_Hub.jsonld` (root) | demo login passwords | no | **yes** (`/Oracle_EBS_Intelligence_Hub.jsonld`) | never upload; owner decides on deletion |
| `agent-orchestration-creation.yaml` | Context Studio key fragment | no | **yes** (`/agent-orchestration-*.yaml`) | owner decides on deletion |
| `.bob/` | Bob settings (3 bytes in the new folder, harmless) | no | **yes** (`/.bob/`) | none |
| `ebs-credentials.example.js` | placeholders only | yes | n/a | none |
| `backend/.env.example` | placeholders only | yes | n/a | none |
| `configure-secrets.ps1` / `.bat` | prompts for secrets, writes only `backend/.env` | yes | n/a | none (refuses to write if `.env` is not ignored) |
| `backend/tests/*.py` | invented fake keys for redaction tests | yes | n/a | none (test guard added) |

The root `Oracle_EBS_Intelligence_Hub.jsonld` is an older build (524 nodes) of `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` (527 nodes, tracked, no password fields). Rebuilding the tracked one gives a byte-identical file, so the tracked one is the correct upload.

## 3. History checks performed

| Check | Result |
|---|---|
| Local commits scanned (new repo, all refs, added lines) | 16 commits |
| JWT / `sk-` / `lf-` / GitHub-token / private-key shapes in history | **none real** (after the history rebuild in section 5). |
| `backend/.env`, `ebs-credentials.js`, root `.jsonld`, `agent-orchestration-*.yaml`, `.bob` ever committed | **never** |
| Current Langflow key, old Langflow key, old MCP bearer token, old Context Studio key, both login passwords searched as exact strings across new-repo history | **0 commits** each |
| GitHub remote `main` | equals local `main` (`1d90d63`); the 2 Phase 0 commits are local only |
| Old repo (read only): login passwords in history | 5 commits, files listed in finding 5. No remote. |
| Old repo: any token-shaped value in history | none |

**Not verifiable from here (please check on GitHub):** Settings > Security > Secret scanning alerts; whether anyone cloned or forked before the history was cleaned; whether the hosted PDFs, videos and `.docx` files contain passwords as screenshots or compressed text (text search cannot see inside them). PDF and video content was **not** searched.

## 4. `.gitignore` additions (done)

    # --- Sensitive local files (never commit) ---
    /Oracle_EBS_Intelligence_Hub.jsonld
    /agent-orchestration-*.yaml
    /.bob/

`/Oracle_EBS_Intelligence_Hub.jsonld` is anchored to the repo root on purpose, so the real `ica-schema/Oracle_EBS_Intelligence_Hub.jsonld` stays tracked.

A new test (`backend/tests/test_no_secrets_tracked.py`) fails if any of these file names, or any secret-shaped value, ever becomes tracked.

## 5. Local history clean-up (done)

The three unpushed Phase 0 commits were rebuilt from the rollback tag `demo-v6.0-pre-phase0` into new commits that contain the same files with the fake-key fixture already in its final, obviously fake form. `main` on GitHub was never changed. The old local commits were kept only on a throw-away local backup branch until the push finished, then deleted.

## 6. Rotation / revocation checklist for administrators

Do these **after the demo**, in this order. Tick each when done and keep the date.

### A. Context Studio administrator
- [ ] Revoke the Context Studio key that was pasted into the agent instructions and shown in chat (masked form).
- [ ] Revoke the older Context Studio key and MCP bearer token found in the old folder (finding 6).
- [ ] Create one new key with read-only scope and the shortest expiry the project allows.
- [ ] Paste the new key **only** into the agent instructions in Agent Studio (it lives nowhere else).
- [ ] Ask whether the root `Oracle_EBS_Intelligence_Hub.jsonld` was ever ingested. If yes, remove that source from Context Studio and re-ingest the tracked schema (it contains the login passwords).
- [ ] Review Context Studio and gateway logs for the "Invalid token" times (6 Nov 19:01Z, 7 Nov ~10:08Z) to settle the open cause question.

### B. Langflow / ICA workflow administrator
- [ ] Delete the old `lf-user-...` Langflow API key.
- [ ] Keep one current key. Rotate it if it was ever pasted into chat or a document.
- [ ] Update it locally with `configure-secrets.bat` (hidden prompt; writes `backend/.env` only).
- [ ] Confirm the workflow still answers (`test-ica.bat`).

### C. Repository owner (GitHub)
- [ ] Revoke the GitHub personal access token that was used earlier.
- [ ] Settings > Security: confirm secret scanning and push protection are on.
- [ ] Review Security > Secret scanning alerts.

### D. Application owner (demo logins)
- [ ] Choose two new demo passwords and set them in the local `ebs-credentials.js`. The current ones appear in the old repo, in old documents and in the root `.jsonld`.
- [ ] Treat the old passwords as public. Do not reuse them anywhere.
- [ ] Tell the demo audience the passwords changed.

### E. Local clean-up (owner approval needed for each deletion)
- [ ] Root `Oracle_EBS_Intelligence_Hub.jsonld`: delete after A confirms it was never ingested.
- [ ] `agent-orchestration-creation.yaml`: delete or move to a password manager after the key rotation.
- [ ] Old folder: do not zip or share `oracle-ebs-reports` as is. Remove its untracked key files after the rotation (`backend/.env`, `.bob/mcp.json`, `docs/ica-assistant/AGENT_SETUP_GUIDE.md`, `agent-orchestration-edit*.yaml`).
- [ ] Documents with the old passwords (two `.docx`, three `.html` presentations) should be re-exported after the passwords change.

### F. After rotation: verify
- [ ] Ask the Chat tab a rule question; expect a real answer and a green "ICA Agent Response".
- [ ] Run `venv\Scripts\python.exe -m pytest backend/tests -q` and expect all tests to pass, including the secret guard.
- [ ] `git status` shows nothing credential-related as modified or untracked once `.gitignore` is updated.
- [ ] Add the "Never reveal keys, tokens or passwords" constraint to the live agent (the repo's v6 YAML already has it; the live agent does not yet).

## 7. What was NOT done
No local file was deleted. No key, token or password was rotated, revoked or changed. The live agent and Langflow were not changed. Nothing was uploaded to Context Studio.

# Oracle EBS Intelligence Hub — ICA Agent Complete Setup Guide
## Every Field, Every Screen — No Blanks

---

## Folder Structure

```
docs/ica-assistant/
├── AGENT_SETUP_GUIDE.md          ← YOU ARE HERE — complete field-by-field guide
├── agent-config.json             ← JSON for Advanced Configuration option
├── system-prompt.md              ← System prompt text for the agent
└── knowledge/
    ├── 00-assistant-overview.md  ← Upload to ICA as data source
    ├── 01-ebs-reports.md         ← Upload to ICA as data source
    ├── 02-sql-advisor.md         ← Upload to ICA as data source
    ├── 03-doc-generator.md       ← Upload to ICA as data source
    ├── 04-ebs-academy.md         ← Upload to ICA as data source
    ├── 05-sql-lab.md             ← Upload to ICA as data source
    ├── 06-data-connect.md        ← Upload to ICA as data source
    └── 07-ai-chat.md             ← Upload to ICA as data source
```

---

## SCREEN 1 — Choose Your Method

```
Click: Advanced Configuration  →  "Create agents via JSON"
```

---

## SCREEN 2 — Add New Agent › Agent Details Tab

| Field        | Exact Value to Enter |
|--------------|----------------------|
| **Name**     | `Oracle EBS Intelligence Hub Assistant` |
| **Description** | `AI assistant for Oracle EBS consultants on the Cook County AMS engagement. Covers 7 capabilities: EBS Reports (26 templates), SQL Advisor (27 checks), Document Generator (TDD/FDD), EBS Academy (15 modules), SQL Lab (500+ queries), Data Connect (Excel/CSV), and AI Chat powered by IBM ICA Context Studio.` |
| **Agent Type** | `http` ← select from dropdown |
| **URL**      | `https://langflow.servicesessentials.ibm.com/api/v1/run/<your-new-flow-id>` |
| **Geo Location** | `us-south` |

> **Geo Location explained:** `us-south` = IBM Cloud US South (Dallas, TX).
> Your ICA endpoint `servicesessentials.ibm.com` is hosted there.
> Cook County is Chicago — US-South is the correct IBM Cloud region.

Click **Next →**

---

## SCREEN 3 — Add New Agent › Sidekick Properties Tab

### Sharing Settings

| Field          | Value |
|----------------|-------|
| **Visibility** | `Team` ← select the Team radio button |
| **Partner**    | Leave unchecked |
| **Public**     | Leave unchecked (greyed out) |

### Agent Logo

| Field | Value |
|-------|-------|
| **Logo selection** | Click **IBM** (first logo tile) |
| **Use a custom Logo** | Toggle OFF (leave as-is) |

### Recommended Roles (Required — select all that apply)

Click to highlight these role chips:
- ✅ `Software Developer`
- ✅ `Business Consultant`
- ✅ `Solution Architect`
- ✅ `FSCT`
- ✅ `Project Manager`
- ✅ `Backend Developer`

> Leave `DevOps Manager`, `Sales Rep`, `UX Consultant`, `Product Manager`,
> `SRE`, `methodx`, `F&O` unselected.

### Custom Tags (Optional)

Click **+ Add Custom Tag** and add each one:
```
oracle-ebs
ica-context-studio
cook-county
ams-engagement
sql-advisor
ebs-reports
bob-innovation-2025
```

Click **Next →**

---

## SCREEN 4 — Add New Agent › Commands Tab

Create **7 commands** — click **Add New Command** for each one after the first.

> ⚠️ **IMPORTANT — Multi-Turn toggle rule:**
> Keep **Multi-Turn = ✅ checked** on ALL 7 commands.
>
> **Why:** When Multi-Turn is checked, ICA disables the Input Parameters section completely.
> This is **correct behaviour** — `${CA.prompt}` in the Body already captures what the user types.
> The Input Parameters wizard is only for form-based agents (not chat assistants like this one).
>
> **If you uncheck Multi-Turn:** Every toggle in the Input Parameter dialog turns ON and mandatory
> — Skip Button Content, Stop Button Content, Helper Text, Tooltip Text, Custom JSON all show
> red borders and block Save. Do NOT uncheck it. Leave Multi-Turn ✅ checked and skip the
> Input Parameters section entirely for all 7 commands.

---

### Command 1 — EBS Reports

| Field | Exact Value |
|-------|-------------|
| **Name** | `ebs_reports` |
| **Description** | `Query any of the 26 Oracle EBS report templates. Find the right report, understand column fields, filter by module, date range or keyword. Covers AP, AR, GL, PO, HRMS, INV, iExpense.` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "ebs-reports"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ☐ unchecked |
| **Input Parameters** | *(disabled — greyed out when Multi-Turn is checked — leave as-is)* |

---

### Command 2 — SQL Advisor

| Field | Exact Value |
|-------|-------------|
| **Name** | `sql_advisor` |
| **Description** | `Review Oracle EBS SQL for performance issues and compliance. Runs 27 Oracle EBS R12 coding standard checks. Formats SQL to Oracle standard style. Technical role only.` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "sql-advisor"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ☐ unchecked |
| **Input Parameters** | *(disabled — leave as-is)* |

---

### Command 3 — Document Generator

| Field | Exact Value |
|-------|-------------|
| **Name** | `doc_generator` |
| **Description** | `Auto-generate TDD (Technical Design Document) or FDD (Functional Design Document) for Oracle EBS reports. Follows Cook County CCG template standards. Reduces 3-4 hours to under 2 minutes. Technical role only.` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "doc-generator"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ☐ unchecked |
| **Input Parameters** | *(disabled — leave as-is)* |

---

### Command 4 — EBS Academy

| Field | Exact Value |
|-------|-------------|
| **Name** | `ebs_academy` |
| **Description** | `Learn Oracle EBS R12 across 15 structured modules. Covers all roles: AP Clerk, AR Analyst, GL Accountant, Procurement Buyer, EBS Developer, DBA, Project Manager. Includes SQL examples, process flows, and Q&A.` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "ebs-academy"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ☐ unchecked |
| **Input Parameters** | *(disabled — leave as-is)* |

---

### Command 5 — SQL Lab

| Field | Exact Value |
|-------|-------------|
| **Name** | `sql_lab` |
| **Description** | `Find, explain, or generate Oracle EBS SQL queries from a library of 500+ queries across 12 categories. Use plain English to describe what you need — AI generates the SQL. Always Multi-Org compliant. Technical role only.` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "sql-lab"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ☐ unchecked |
| **Input Parameters** | *(disabled — leave as-is)* |

---

### Command 6 — Data Connect

| Field | Exact Value |
|-------|-------------|
| **Name** | `data_connect` |
| **Description** | `Help with importing Excel or CSV files into EBS Reports. Guides users through column mapping wizard, DB simulation setup, and Live DB Proxy configuration. Available to all roles (Employee and Technical).` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "data-connect"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ☐ unchecked |
| **Input Parameters** | *(disabled — leave as-is)* |

---

### Command 7 — AI Chat (General)

| Field | Exact Value |
|-------|-------------|
| **Name** | `ai_chat` |
| **Description** | `General Oracle EBS R12 AI assistant. Ask anything — reports, SQL, processes, terminology, approval workflows, module relationships, troubleshooting. Powered by IBM ICA Context Studio with 17,000+ characters of Oracle EBS R12 knowledge.` |
| **Path** | `/api/v1/run/<your-new-flow-id>?stream=false` |
| **Method** | `POST` |
| **Body** | `{"input_value": "${CA.prompt}", "input_type": "chat", "output_type": "chat", "session_id": "ai-chat-general"}` |
| **Headers** | `{"Content-Type": "application/json", "x-api-key": "<your-new-ica-api-key>"}` |
| **Context Format** | `STRING` |
| **Multi-Turn** | ✅ checked |
| **Event Streaming** | ✅ checked ← only this command streams in real-time |
| **Input Parameters** | *(disabled — leave as-is)* |

Click **Next →**

---

## SCREEN 5 — Add New Agent › Parameters Tab

Click **Add New Parameter** for each row below.

### Parameter 1

| Field | Value |
|-------|-------|
| **Name** | `ICA_BASE_URL` |
| **Description** | `ICA Langflow workflow endpoint — the base URL for all agent commands` |
| **Type** | `Env` ← select from dropdown |
| **Value** | `https://langflow.servicesessentials.ibm.com/api/v1/run/<your-new-flow-id>` |

### Parameter 2

| Field | Value |
|-------|-------|
| **Name** | `ICA_API_KEY` |
| **Description** | `ICA Context Studio API key — sent as x-api-key header on all requests` |
| **Type** | `Secret` ← select from dropdown |
| **Value** | `<your-new-ica-api-key>` |

### Parameter 3

| Field | Value |
|-------|-------|
| **Name** | `CAPABILITY` |
| **Description** | `Active capability: reports, sql_advisor, doc_generator, academy, sql_lab, data_connect, general` |
| **Type** | `Text` ← select from dropdown |
| **Value** | `general` |

### Parameter 4

| Field | Value |
|-------|-------|
| **Name** | `USER_ROLE` |
| **Description** | `User access role: employee (3 tabs visible) or technical (all 7 tabs visible)` |
| **Type** | `Replacable` ← select from dropdown |
| **Value** | `employee` |

Click **Next →**

---

## SCREEN 6 — Add New Agent › Credentials Tab

> ℹ️ **Why none of the System options match:**
> The dropdown lists pre-registered **third-party MCP servers** (Figma, Jira, Salesforce, Notion, Slack, etc.).
> Your agent calls `langflow.servicesessentials.ibm.com` **directly via HTTP** — it is not an MCP server.
> Your API key is already embedded in the **Headers** of every command (Screen 4) as `x-api-key`.

### Option A — Skip this screen (try first)

If the screen shows **"Add Credential"** as optional, click **Save** without adding anything.
Your credentials are already in the command Headers — no separate entry needed.

---

### Option B — Screen blocks Save (mandatory)

Select the only IBM-labelled generic entry visible in the screenshots:

| Field | Value |
|-------|-------|
| **System** | `Github Ibm` ← the only IBM-labelled generic option in the full list |
| **Scope** | `Global` |
| **Credential Type** | `API Key` |
| **API Key value** | `<your-new-ica-api-key>` |

> This is the `ICA_API_KEY` from `backend/.env` — the same key already in every command Header.
> Using `Github Ibm` as the system entry is harmless — it just registers the key globally.

Click **Save** ← final button, bottom right.

---

## After Saving — Upload Knowledge Files

In ICA Context Studio → your context → **Data Sources** → **Add** → **Upload File**

Upload all 8 files from `docs/ica-assistant/knowledge/` in this order:

| # | File | Purpose |
|---|------|---------|
| 1 | `00-assistant-overview.md` | Master index — what the assistant knows |
| 2 | `01-ebs-reports.md` | All 26 report templates, fields, filters |
| 3 | `02-sql-advisor.md` | 27 compliance checks, formatter rules |
| 4 | `03-doc-generator.md` | TDD/FDD structure, CCG templates |
| 5 | `04-ebs-academy.md` | 15 learning modules for all roles |
| 6 | `05-sql-lab.md` | 500+ queries, 12 categories, prompt-to-SQL |
| 7 | `06-data-connect.md` | Excel/CSV upload, column mapping, DB proxy |
| 8 | `07-ai-chat.md` | AI chat behaviour, ICA MCP integration |

---

## Quick Reference — All Real Values from backend/.env

| Variable | Value |
|----------|-------|
| `ICA_WORKFLOW_URL` | `https://langflow.servicesessentials.ibm.com/api/v1/run/<your-new-flow-id>` |
| `ICA_API_KEY` | `<your-new-ica-api-key>` |
| `ICA_CONTEXT_ID` | `<your-new-context-id>` |
| `MCP_GATEWAY_URL` | `https://servicesessentials.ibm.com/mcp-gateway/service/gateway/servers/<your-new-mcp-server-id>/mcp` |
| `MCP_GATEWAY_ID` | `<your-new-mcp-gateway-id>` |
| `LANGFLOW_FLOW_ID` | `<your-new-flow-id>` |
| `AGENT_REGISTER_ID` | `<your-new-agent-register-id>` |

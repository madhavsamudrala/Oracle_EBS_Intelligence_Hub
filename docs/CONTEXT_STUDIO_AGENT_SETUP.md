# Context Studio, Agent and Workflow Setup

How the Oracle EBS Intelligence Hub agent is wired to Context Studio. No secrets are stored in this repository.

## 1. Components

| Component | Name / ID |
|---|---|
| Context Studio context | `Oracle-EBS-Intelligence-Hub`, `ctx_b0ecd6cee49f` |
| Schema (upload) | [`ica-schema/Oracle_EBS_Intelligence_Hub.jsonld`](../ica-schema/Oracle_EBS_Intelligence_Hub.jsonld) |
| MCP tool group (Agent Studio) | `ebs-hub` (8 Context Broker tools) |
| Agent | `oracle-ebs-intelligence-hub`, Strands, single agent, model `ibm-ica:gpt-5.1` |
| Agent definition | [`appstudio/oracle-ebs-intelligence-hub-agent-v6.yaml`](../appstudio/oracle-ebs-intelligence-hub-agent-v6.yaml) |
| Workflow | Langflow flow `ebs-hub`: Chat Input -> ICA A2A Agent -> Chat Output |
| Persona | `OracleEBSIntelligenceAgent` |

## 2. Two credentials, two places

| Credential | Where it goes |
|---|---|
| MCP Gateway bearer token | App Studio -> Tools -> `ebs-hub` -> Edit MCP Server -> Authentication Type = Bearer Token -> Token field |
| Context Studio API key | Agent instructions, as `x-api-key=<value>`, sent as a tool argument on every Context Broker call |

Neither value is committed. The agent YAML in this repo contains the placeholder `<CONTEXT_STUDIO_API_KEY>`.

Symptoms:

| Playground message | Meaning |
|---|---|
| `Missing API key` | The agent did not send `x-api-key`. Check the instructions. |
| `Invalid token` | The agent sent a wrong or mis-copied key. Re-paste the key. A single failure can be a one-off; the agent retries once. |
| `Token is revoked` | The key was revoked in Context Studio. Create a new key. |

## 3. Setup order

1. In Context Studio, create the context and upload the schema from `ica-schema/`.
2. In Context Studio, create an API key for the context.
3. In App Studio, register the MCP gateway as tool group `ebs-hub` with the gateway bearer token. Keep the group name short; tool names are `<group>-<app id>-context-broker-<tool>` and must stay under 63 characters.
4. In Agent Studio, create the agent from the v6 YAML. Replace `<CONTEXT_STUDIO_API_KEY>` with the key in the edit screen only.
5. In Agent Studio, build the Langflow flow with the **ICA A2A Agent** node (not the generic A2A Agent node) and select the agent.
6. Test in the Playground.

## 4. Playground checks

| Question | Expected |
|---|---|
| `List the available contexts.` | Returns `ctx_b0ecd6cee49f` and a Tool Trace |
| `Review this SQL: select * from ap_invoices_all` | Cites COMP-001 and COMP-008 |
| `What does COMP-008 say?` | Returns "No SELECT * in Production SQL" |
| `What is the weather today?` | Says the knowledge graph has nothing relevant; no invented answer |

## 5. Rule IDs

The schema holds two rule families. The agent cites exactly the ID the tool returns.

| Family | Meaning | Examples |
|---|---|---|
| `COMP-001` to `COMP-010` | SQL compliance rules | COMP-001 ORG_ID required, COMP-008 No SELECT * |
| `RULE_nnn` | Application and code review rules | RULE_001 Multi-Org ORG_ID, RULE_008 SELECT * wildcard |

## 6. Rotating the key

1. Revoke the key in Context Studio.
2. Create a new key.
3. Edit the agent in Agent Studio and replace the value after `x-api-key=`.
4. Re-run the Playground checks above.

## 7. Local backend

The FastAPI backend in `backend/` reads its settings from `backend/.env` (git-ignored). Copy `backend/.env.example` and set:

| Variable | Value |
|---|---|
| `ICA_CONTEXT_ID` | `ctx_b0ecd6cee49f` |
| `MCP_GATEWAY_URL` | MCP gateway server URL ending in `/mcp` |
| `MCP_BEARER_TOKEN` | gateway bearer token |
| `MCP_API_KEY` | Context Studio API key |
| `ICA_WORKFLOW_URL`, `ICA_API_KEY` | Langflow workflow URL and its API key (optional) |

Without these the backend still starts and `/chat` returns `ICA not configured`.

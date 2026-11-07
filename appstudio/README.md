# appstudio/

| File | Status | Use it for |
|------|--------|-----------|
| [`oracle-ebs-intelligence-hub-agent-v6.yaml`](oracle-ebs-intelligence-hub-agent-v6.yaml) | **Current** | The agent definition that matches the deployed ICA agent. Contains a placeholder instead of the Context Studio key. |
| [`oracle-ebs-intelligence-hub-agent.yaml`](oracle-ebs-intelligence-hub-agent.yaml) | **Archived (v5.0)** | History only. Its rule list uses old IDs (`RULE_014`..`RULE_027` with the pre-Phase-0 `approval_rules.csv` meanings). Do not copy rule IDs from it. |

Rule IDs: the master list is `ica-schema/02-rules.json`. Rules that exist only in `ica-schema/csv/approval_rules.csv` use `APR-001`..`APR-011`.
Old-to-new table: [`docs/rule_id_mapping.csv`](../docs/rule_id_mapping.csv).

Never put a real key in either file. The real Context Studio key lives only in the agent instructions inside Agent Studio.

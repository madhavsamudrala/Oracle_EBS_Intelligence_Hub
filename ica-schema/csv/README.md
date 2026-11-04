# ICA Schema CSV Files — Oracle EBS Intelligence Hub v5.0

All CSV files in this directory describe the **Oracle EBS Intelligence Hub v5.0**.  
All previous iExpense Approval domain data has been replaced.

---

## File Reference

| File | Purpose | Rows |
|------|---------|------|
| `ebs_nodes.csv` | All graph nodes — modules, reports, tables, rules, roles, tabs, academy modules, SQL categories, data connect sources | 112 |
| `ebs_edges.csv` | Graph edges — module→report, report→table, table→rule relationships | 52 |
| `ebs_relationships.csv` | Oracle EBS table JOIN conditions (SQL join paths between base tables) | 15 |
| `natural_language_queries.csv` | NL query intent mappings — chat input → report key / tab / feature | 115+ |
| `approval_rules.csv` | **27 SQL compliance & business rules** (ORG_ID, DateTrack, SELECT*, injection, performance) |
| `approver_groups.csv` | **12 SQL Library categories** with query counts (AP, AR, GL, PO, HRMS, INV, iExpense, FND, Perf, Sec, WF, Multi-Org) |
| `expense_templates.csv` | **15 Academy modules** — module ID, topic count, color, sample topics |
| `special_submitters.csv` | **3 Data Connect sources** — Excel/CSV upload, Simulated DB, Live Oracle DB |
| `operating_units.csv` | 3 sample Oracle EBS operating units with module coverage |
| `test_scenarios.csv` | 35 end-to-end test scenarios covering all 7 tabs and both roles |

---

## Column Schemas

### ebs_nodes.csv
`node_id, node_type, label, property_code, property_module, property_color, property_count`

### ebs_edges.csv
`edge_id, from_node, to_node, relationship_type, property_join_type, property_required`

### ebs_relationships.csv
`rel_id, source_entity, target_entity, relationship_type, description, join_condition`

### natural_language_queries.csv
`query_id, query_text, intent, report_key, feature, tab, confidence, example_response`

### approval_rules.csv (SQL Compliance Rules)
`rule_id, rule_name, rule_type, category, severity, applies_to, description, code_review_check_number`

### approver_groups.csv (SQL Library Categories)
`category_id, category_name, module, query_count, description, color, example_queries`

### expense_templates.csv (Academy Modules)
`module_id, module_name, academy_id, topic_count, description, color, sample_topics`

### special_submitters.csv (Data Connect Sources)
`source_id, source_type, display_name, proxy_required, description, column_mapping_function, supported_formats, example_use_case`

### operating_units.csv
`ou_id, ou_name, ou_code, currency, country, ebs_org_id, modules_active, report_count, notes`

### test_scenarios.csv
`scenario_id, tab, role, action, input, expected_result, report_key, pass_condition`

---

## Notes on Repurposed Files

The following files were originally named for iExpense Approval domain data.  
They have been **fully replaced** with v5.0 content. Only the filenames remain the same to preserve file references in any tooling:

| Filename | Was | Now |
|----------|-----|-----|
| `approval_rules.csv` | iExpense AME approval routing rules (CCP/CCH/CCF) | 27 EBS SQL compliance & best practice rules |
| `approver_groups.csv` | iExpense approver groups (CCP_DEPT, CCH_FIRST_SUP, etc.) | 12 SQL Library categories |
| `expense_templates.csv` | iExpense expense templates per OU | 15 EBS Academy learning modules |
| `special_submitters.csv` | Karen Martino / Melissa / Damon Howell special routing | 3 Data Connect source types |
| `operating_units.csv` | CCP / CCH / CCF iExpense operating units | 3 real Oracle EBS operating units (UAE) |
| `test_scenarios.csv` | iExpense approval routing test cases | 35 Intelligence Hub E2E test scenarios |

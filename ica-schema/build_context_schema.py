"""
Builds ica-schema/Oracle_EBS_Intelligence_Hub.jsonld  (Context Studio "domain-model-jsonld" upload).

Sources (all in ica-schema/): ebs-complete-ontology.jsonld (base graph), 01-nodes.json, 02-rules.json,
03-relationships.json, ebs-knowledge-graph-schema.json, csv/ebs_nodes.csv, csv/ebs_edges.csv,
csv/ebs_relationships.csv, csv/natural_language_queries.csv, csv/column_mapping_rules.csv,
and report SQL/columns exported from ebs-reports-data.js (optional: reports_export.json).

Usage:  python ica-schema/build_context_schema.py
"""
import csv, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCHEMA_NAME = "Oracle_EBS_Intelligence_Hub"
VERSION = "6.0"
OUT = HERE / f"{SCHEMA_NAME}.jsonld"


def jl(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def rows(name):
    with open(HERE / "csv" / name, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


base = jl("ebs-complete-ontology.jsonld")
nodes01 = jl("01-nodes.json")["nodes"]
rules02 = jl("02-rules.json")["rules"]
rels03 = jl("03-relationships.json")["relationships"]
kg = jl("ebs-knowledge-graph-schema.json")
csv_nodes, csv_edges, csv_rels = rows("ebs_nodes.csv"), rows("ebs_edges.csv"), rows("ebs_relationships.csv")
nlq, colmap = rows("natural_language_queries.csv"), rows("column_mapping_rules.csv")
rpt_file = HERE / "reports_export.json"
REPORT_DATA = json.loads(rpt_file.read_text(encoding="utf-8")) if rpt_file.exists() else {}

# ---------- base graph (72 nodes already proven in Context Studio) ----------
graph = [n for n in base["@graph"] if n["id"] not in ("ebs:", "ebs:ContextStudioUploadStrategy")]
byid = {n["id"]: n for n in graph}
dropped = []


def add(node):
    if node["id"] in byid:
        raise SystemExit("duplicate id " + node["id"])
    graph.append(node)
    byid[node["id"]] = node
    return node


def link(src, tgt, rtype=None, **extra):
    """relatesTo edge + typed edge record on the source node."""
    if src not in byid or tgt not in byid:
        dropped.append((src, tgt, rtype))
        return
    n = byid[src]
    if tgt not in n.setdefault("relatesTo", []):
        n["relatesTo"].append(tgt)
    if rtype:
        rec = {"relationshipType": rtype, "target": tgt}
        rec.update({k: v for k, v in extra.items() if v not in ("", None)})
        lst = n.setdefault("attributes", {}).setdefault("relationships", [])
        if rec not in lst:
            lst.append(rec)


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


# ---------- module / process / rule lookups ----------
MOD = {"AP": "ebs:AP", "AR": "ebs:AR", "GL": "ebs:GL", "PO": "ebs:PO", "HRMS": "ebs:HRMS", "INV": "ebs:INV",
       "iExpense": "ebs:iEXP", "iEXP": "ebs:iEXP", "IEXP": "ebs:iEXP", "PAY": "ebs:PAY", "FA": "ebs:FA", "CM": "ebs:CM",
       "BEN": "ebs:BEN", "OM": "ebs:OM"}
PROC = {k: f"ebs:{k}_Process" for k in ("P2P", "O2C", "H2R", "R2R")}
COMP = [n["id"] for n in graph if n["id"].startswith("ebs:Rule_")]  # COMP-001..010 in order
TABLE_ALIAS = {"PER_PEOPLE_F": "PER_ALL_PEOPLE_F", "PER_ASSIGNMENTS_F": "PER_ALL_ASSIGNMENTS_F",
               "TBL_PAF": "TBL_PAAF"}
RULE_ALIAS = {"RULE_ORGID": "RULE_001", "RULE_DT_PPF": "RULE_002", "RULE_DT_PAF": "RULE_003",
              "RULE_CANCEL": "RULE_004", "RULE_VOID": "RULE_005", "RULE_SUMFLAG": "RULE_006",
              "RULE_SOURCE": "RULE_007"}
RICE_ALIAS = {"RICE_RPT_AP": "ebs:EBSReport_InvoiceRegister", "RICE_RPT_GL": "ebs:EBSReport_TrialBalance",
              "RICE_INT_GL": "ebs:EBSInterface_GLJournalOpenInterface",
              "RICE_CONV_INV": "ebs:EBSConversion_APOpenInvoices"}
REPORT_KEY_ALIAS = {"suppliers_report": "suppliers_list", "po_distribution_detail": "po_distribution",
                    "expense_reports": "iexpense_detail"}
PREFIX_MODULE = (("ap_", "AP"), ("gl_", "GL"), ("po_", "PO"), ("rcv_", "PO"), ("per_", "HRMS"), ("hr_", "HRMS"),
                 ("pay_", "HRMS"), ("mtl_", "INV"), ("fnd_", "FND"), ("wf_", "FND"), ("pa_", "PA"))

# ---------- tables ----------
tbl_info = {}  # canonical NAME -> dict
for r in csv_nodes:
    if r["node_type"] == "OracleTable":
        nm = TABLE_ALIAS.get(r["label"], r["label"])
        tbl_info[nm] = {"module": r["property_module"], "rows": r["property_color"], "pk": r["property_count"],
                        "csv": r["node_id"]}
sql_tables = set()
for key, rd in REPORT_DATA.items():
    for t in re.findall(r"(?:FROM|JOIN)\s+([a-z][a-z0-9_]*)", rd.get("sql", ""), flags=re.I):
        t = TABLE_ALIAS.get(t.upper(), t.upper())
        if "_" in t:
            sql_tables.add(t)
for t in sorted(sql_tables - set(tbl_info)):
    mod = next((m for p, m in PREFIX_MODULE if t.lower().startswith(p)), "")
    tbl_info[t] = {"module": mod, "rows": "", "pk": "", "csv": ""}


def tid(name):
    return "ebs:Table_" + TABLE_ALIAS.get(name.upper(), name.upper())


for nm, i in sorted(tbl_info.items()):
    n = add({"id": tid(nm), "name": nm, "type": "Entity", "humanRef": "tableName",
             "identityKey": f"tableName: {nm}",
             "description": f"Oracle EBS base table {nm}" + (f" ({i['module']} module)" if i["module"] else ""),
             "attributes": {"entityType": "OracleTable", "tableName": nm, "module": i["module"],
                            "primaryKey": i["pk"], "approxRows": i["rows"],
                            "multiOrgFlag": nm.endswith("_ALL") and not nm.startswith("GL_"),
                            "dateTracked": nm.endswith("_F"), "appTableId": i["csv"]}})
    if i["module"] in MOD:
        link(tid(nm), MOD[i["module"]], "table_belongs_to_module")

# ---------- reports ----------
rpt_id = {}  # csv node_id and code -> ontology id
for r in csv_nodes:
    if r["node_type"] != "EBSReport":
        continue
    code = r["property_code"]
    data = REPORT_DATA.get(code) or REPORT_DATA.get(REPORT_KEY_ALIAS.get(code, ""), {})
    rid = "ebs:Report_" + code
    attrs = {"entityType": "EBSReport", "reportKey": code, "reportName": r["label"], "module": r["property_module"],
             "sampleRows": int(r["property_count"] or 0), "hasSampleData": bool(data),
             "outputFormats": ["CSV", "Excel", "PDF"], "orgIdRequired": r["property_module"] not in ("GL", "HRMS"),
             "csvNodeId": r["node_id"]}
    if data:
        attrs.update({"columns": data["columns"], "primarySQLQuery": data["sql"], "appDataKey": data["key"]})
    add({"id": rid, "name": r["label"], "type": "Entity", "humanRef": "reportName",
         "identityKey": f"reportKey: {code}",
         "description": f"{r['label']} - {r['property_module']} report in the EBS Reports tab.", "attributes": attrs})
    rpt_id[r["node_id"]] = rpt_id[code] = rid
    if data:
        for t in sorted(set(re.findall(r"(?:FROM|JOIN)\s+([a-z][a-z0-9_]*)", data["sql"], flags=re.I))):
            if "_" in t:
                link(rid, tid(t), "report_uses_table", joinType="")
    link(rid, MOD.get(r["property_module"], ""), "report_belongs_to_module")
for k, v in REPORT_KEY_ALIAS.items():
    rpt_id.setdefault(v, rpt_id.get(k))

# ---------- application rules (02-rules.json) ----------
for x in rules02:
    rid = "ebs:AppRule_" + x["rule_id"]
    add({"id": rid, "name": x["rule_name"], "type": "Entity", "humanRef": "ruleName",
         "identityKey": f"ruleId: {x['rule_id']}", "description": x["description"],
         "attributes": {"entityType": "BusinessRule", **{k: v for k, v in x.items() if k != "description"}}})
    for t in x.get("applies_to_tables", []):
        if t.upper() in {TABLE_ALIAS.get(k, k) for k in tbl_info} or TABLE_ALIAS.get(t.upper()) in tbl_info:
            link(rid, tid(t), "rule_applies_to_table")

# ---------- roles, tabs, academy, sql categories, data connect (01-nodes.json) ----------
def readable(t, p):
    """Plain-language description instead of a raw JSON dump (better LLM comprehension)."""
    name = p.get("role_name") or p.get("tab_name") or p.get("title") or p.get("name") or p.get("source_type")
    bits = []
    for k, v in p.items():
        if k in ("name", "title", "role_name", "tab_name") or v in ("", None, [], {}):
            continue
        bits.append(f"{k.replace('_', ' ')}: " + (", ".join(map(str, v)) if isinstance(v, list) else str(v)))
    return f"{t} '{name}'. " + "; ".join(bits)


for x in nodes01:
    t, p = x["node_type"], x["properties"]
    if t not in ("UserRole", "AppTab", "AcademyModule", "SQLCategory", "DataConnectSource"):
        continue
    add({"id": "ebs:" + x["node_id"], "name": p.get("role_name") or p.get("tab_name") or p.get("title")
         or p.get("name") or p.get("source_type"), "type": "Entity", "humanRef": "name",
         "identityKey": f"nodeId: {x['node_id']}", "description": x.get("description") or readable(t, p),
         "attributes": {"entityType": t, **p}})
ACAD_MOD = {"acad_ap": "AP", "acad_ar": "AR", "acad_gl": "GL", "acad_iexp": "iExpense", "acad_hrms": "HRMS",
            "acad_po": "PO", "acad_inv": "INV"}
for x in nodes01:
    p, i = x["properties"], "ebs:" + x["node_id"]
    if x["node_type"] == "UserRole":
        for tab in p["visible_tabs"]:
            link(i, "ebs:" + tab.replace("-", "_"), "role_sees_tab")
    elif x["node_type"] == "AcademyModule" and p["module_id"] in ACAD_MOD:
        link(i, MOD[ACAD_MOD[p["module_id"]]], "academy_module_covers_module")
    elif x["node_type"] == "SQLCategory" and p.get("module") in MOD:
        link(i, MOD[p["module"]], "sql_category_covers_module")
    elif x["node_type"] == "DataConnectSource":
        link(i, "ebs:tab_dataconnect", "source_available_in_tab")

# ---------- governance / ICA / reuse nodes (ebs_nodes.csv) ----------
GEN = ("DASCSecurityModel", "DASCPrinciple", "DASCUIComponent", "DASCSecurity", "DASCGovernance",
       "TeamReuseStrategy", "TeamReuseDeployment", "TeamReuseKnowledge", "TeamReuseOnboarding",
       "ICAIntegration", "ICABackend", "ICAUIComponent")
csv_gen = {}
for r in csv_nodes:
    if r["node_type"] in GEN:
        i = "ebs:Node_" + r["node_id"]
        add({"id": i, "name": r["label"], "type": "Entity", "humanRef": "name",
             "identityKey": f"nodeId: {r['node_id']}", "description": r["label"],
             "attributes": {"entityType": r["node_type"], "code": r["property_code"], "group": r["property_module"],
                            "color": r["property_color"], "count": r["property_count"]}})
        csv_gen[r["node_id"]] = i

# ---------- resolve CSV ids ----------
ROLE_TAB = {"ROLE_EMP": "ebs:role_employee", "ROLE_TECH": "ebs:role_technical"}


def resolve(cid):
    cid = TABLE_ALIAS.get(cid, cid)
    if cid.startswith("MOD_"):
        return MOD.get(cid[4:])
    if cid in rpt_id:
        return rpt_id[cid]
    if cid.startswith("TBL_"):
        return next((tid(n) for n, i in tbl_info.items() if i["csv"] == cid), None)
    if cid in RULE_ALIAS:
        return "ebs:AppRule_" + RULE_ALIAS[cid]
    m = re.match(r"COMP_RULE_(\d+)$", cid)
    if m and 1 <= int(m.group(1)) <= len(COMP):
        return COMP[int(m.group(1)) - 1]
    if cid.startswith("PROC_"):
        return PROC.get(cid[5:])
    if cid in RICE_ALIAS:
        return RICE_ALIAS[cid]
    if cid in ROLE_TAB:
        return ROLE_TAB[cid]
    if cid.startswith("TAB_"):
        return "ebs:" + cid.lower()
    return csv_gen.get(cid)


for e in csv_edges:
    link(resolve(e["from_node"]) or e["from_node"], resolve(e["to_node"]) or e["to_node"],
         e["relationship_type"], joinType=e["property_join_type"], required=e["property_required"] == "true")
for r in csv_rels:  # table-to-table join relationships
    link(tid(r["source_entity"]), tid(r["target_entity"]), r["relationship_type"],
         description=r["description"], joinCondition=r["join_condition"])

# ---------- natural-language queries & column mapping rules ----------
for q in nlq:
    i = add({"id": "ebs:NLQ_" + q["query_id"], "name": q["query_text"], "type": "Entity", "humanRef": "queryText",
             "identityKey": f"queryId: {q['query_id']}", "description": f"{q['intent']} -> {q['report_key'] or q['feature']}",
             "attributes": {"entityType": "NLQuery", **q}})["id"]
    link(i, rpt_id.get(q["report_key"]) or "", "query_maps_to_report")
    link(i, "ebs:" + q["tab"].replace("-", "_"), "query_maps_to_tab")
for c in colmap:
    i = add({"id": "ebs:ColMap_" + c["mapping_id"], "name": f"{c['source_pattern']} -> {c['target_column']}",
             "type": "Entity", "humanRef": "sourcePattern", "identityKey": f"mappingId: {c['mapping_id']}",
             "description": c["notes"], "attributes": {"entityType": "ColumnMappingRule", **c}})["id"]
    link(i, rpt_id.get(c["report_key_hint"]) or "", "mapping_targets_report")
    link(i, MOD.get(c["target_report_module"]) or "", "mapping_for_module")

# ---------- schema-level definitions: node types, edge types, relationship types ----------
for t in kg["node_types"]:
    add({"id": "ebs:NodeType_" + t["type"], "name": t["type"], "type": "Entity", "humanRef": "name",
         "identityKey": f"nodeType: {t['type']}", "description": t["description"],
         "attributes": {"entityType": "NodeTypeDefinition", "properties": t["properties"], "required": t["required"]}})
for e in kg["edge_types"]:
    add({"id": "ebs:EdgeType_" + e["type"], "name": e["type"], "type": "Entity", "humanRef": "name",
         "identityKey": f"edgeType: {e['type']}", "description": e["description"],
         "attributes": {"entityType": "EdgeTypeDefinition", "from": e["from"], "to": e["to"],
                        "cardinality": e["cardinality"]}})
    link("ebs:EdgeType_" + e["type"], "ebs:NodeType_" + e["from"], "edge_from_type")
    link("ebs:EdgeType_" + e["type"], "ebs:NodeType_" + e["to"], "edge_to_type")
for r in rels03:
    add({"id": "ebs:RelType_" + r["relationship_name"], "name": r["relationship_name"], "type": "Entity",
         "humanRef": "name", "identityKey": f"relationshipId: {r['relationship_id']}", "description": r["description"],
         "attributes": {"entityType": "RelationshipTypeDefinition", **{k: v for k, v in r.items() if k != "description"}}})
# ---------- connect otherwise isolated nodes (Context Studio flagged "relationship incomplete") ----------
for m in ("AP", "AR", "GL", "PO", "HRMS", "INV", "iEXP"):          # every module is governed/reused/ICA-backed
    for gen in ("Node_REUSE_STRATEGY", "Node_DASC_MODEL", "Node_ICA_MCP"):
        link("ebs:" + m, "ebs:" + gen, {"Node_REUSE_STRATEGY": "module_delivered_by_reusable_accelerator",
                                       "Node_DASC_MODEL": "module_governed_by_dasc_model",
                                       "Node_ICA_MCP": "module_served_via_ica_context_studio"}[gen])
GOV = [("Node_REUSE_STRATEGY", "Node_REUSE_DEPLOY", "strategy_uses_deployment"),
       ("Node_REUSE_STRATEGY", "Node_REUSE_ICA_SHARED", "strategy_uses_shared_knowledge"),
       ("Node_REUSE_STRATEGY", "Node_REUSE_ONBOARD", "strategy_enables_onboarding"),
       ("Node_REUSE_DEPLOY", "Node_ICA_BACKEND", "deployment_starts_backend"),
       ("Node_REUSE_ICA_SHARED", "Node_ICA_MCP", "shared_knowledge_served_via_mcp"),
       ("Node_ICA_MCP", "Node_ICA_BACKEND", "mcp_accessed_through_backend"),
       ("Node_ICA_BACKEND", "Node_ICA_LIVE_BADGE", "backend_status_shown_in_badge"),
       ("Node_ICA_LIVE_BADGE", "tab_chat", "badge_displayed_in_tab"),
       ("Node_DASC_MODEL", "Node_DASC_LEAST_PRIV", "model_has_principle"),
       ("Node_DASC_MODEL", "Node_DASC_ZERO_TRUST", "model_has_principle"),
       ("Node_DASC_MODEL", "Node_DASC_AUDIT", "model_has_principle"),
       ("Node_DASC_MODEL", "Node_DASC_DUAL_CTRL", "model_has_principle"),
       ("Node_DASC_MODEL", "Node_DASC_INFO_BAR", "model_shown_in_ui_component"),
       ("Node_DASC_INFO_BAR", "tab_chat", "info_bar_displayed_in_tab"),
       ("Node_DASC_LEAST_PRIV", "Node_DASC_EMP_CLEARANCE", "principle_applied_as_clearance"),
       ("Node_DASC_LEAST_PRIV", "Node_DASC_TECH_CLEARANCE", "principle_applied_as_clearance"),
       ("Node_DASC_EMP_CLEARANCE", "role_employee", "clearance_granted_to_role"),
       ("Node_DASC_TECH_CLEARANCE", "role_technical", "clearance_granted_to_role"),
       ("Node_DASC_DUAL_CTRL", "Node_DELETE_WORKFLOW", "principle_enforced_by_workflow"),
       ("Node_DELETE_WORKFLOW", "Node_RECYCLE_BIN", "workflow_moves_to_recycle_bin"),
       ("Node_DELETE_WORKFLOW", "Node_AUDIT_LOG", "workflow_writes_audit_log"),
       ("Node_DASC_AUDIT", "Node_AUDIT_LOG", "principle_enforced_by_audit_log"),
       ("Node_DASC_ZERO_TRUST", "Node_ICA_BACKEND", "principle_enforced_by_backend"),
       ("Node_RECYCLE_BIN", "tab_reports", "recycle_bin_available_in_tab")]
for s, t, rt in GOV:
    link("ebs:" + s, "ebs:" + t, rt)
for x in rules02:                                       # application rules -> where they are enforced
    i = "ebs:AppRule_" + x["rule_id"]
    if x["rule_type"] == "sql_compliance":
        link(i, "ebs:tab_sql", "rule_checked_in_tab")
    if x["rule_id"] in ("RULE_020", "RULE_021"):
        link(i, "ebs:AR", "rule_applies_to_module")
    if x["rule_id"] == "RULE_017":
        link(i, "ebs:AppRule_RULE_001", "rule_complements_rule")
APP_RULE_TARGET = {"RULE_101": ("Node_DELETE_WORKFLOW", "tab_reports"), "RULE_102": ("tab_reports",),
                   "RULE_103": ("tab_reports", "Node_RECYCLE_BIN"), "RULE_104": ("tab_sqllab",),
                   "RULE_105": ("Node_DASC_ZERO_TRUST",)}
for rid_, targets in APP_RULE_TARGET.items():
    for t in targets:
        link("ebs:AppRule_" + rid_, "ebs:" + t, "rule_enforced_in")
for n in list(graph):
    et = n.get("attributes", {}).get("entityType")
    if et == "AcademyModule":
        link(n["id"], "ebs:tab_academy", "academy_module_in_tab")
    elif et == "SQLCategory":
        link(n["id"], "ebs:tab_sqllab", "sql_category_in_tab")
    elif et == "RelationshipTypeDefinition":
        a = n["attributes"]
        link(n["id"], "ebs:NodeType_" + a.get("source_node_type", ""), "relationship_source_type")
        link(n["id"], "ebs:NodeType_" + a.get("target_node_type", ""), "relationship_target_type")
    elif n["type"] == "Operation":                      # Context Studio drops from/to, so mirror them as edges
        for end in ("from", "to"):
            if n.get(end):
                link(n["id"], n[end], "operation_" + end)
for qid, tgt in (("NL111", "role_employee"), ("NL112", "role_technical"), ("NL113", "Node_DASC_MODEL")):
    link("ebs:NLQ_" + qid, "ebs:" + tgt, "query_maps_to_role" if tgt.startswith("role") else "query_maps_to_governance")



# remaining orphans: SQL patterns / compliance rules -> module or tab, multi-org column mappings -> rule
for pid, mod in (('SQLPattern_AP_Invoice_Basic', 'AP'), ('SQLPattern_GL_Journal_Basic', 'GL'),
                 ('SQLPattern_HRMS_Employee_Basic', 'HRMS'), ('SQLPattern_P2P_Status', 'PO'),
                 ('SQLPattern_O2C_Status', 'OM'), ('SQLPattern_Payroll_Results', 'PAY'),
                 ('Rule_Cancelled_Invoice_Filter', 'AP'), ('Rule_Reversal_Distribution_Filter', 'AP'),
                 ('Rule_Primary_Assignment_Filter', 'HRMS'), ('Rule_HRMS_Business_Group', 'HRMS')):
    link('ebs:' + pid, MOD[mod], 'pattern_or_rule_applies_to_module')
    link('ebs:' + pid, 'ebs:tab_sql', 'pattern_or_rule_used_in_tab')
for rid_ in ('Rule_Bind_Variables', 'Rule_No_Select_Star', 'Rule_No_Function_On_Index'):
    link('ebs:' + rid_, 'ebs:tab_sql', 'pattern_or_rule_used_in_tab')
for cm in ('CM089', 'CM090'):
    link('ebs:ColMap_' + cm, 'ebs:AppRule_RULE_001', 'mapping_supports_rule')
    link('ebs:ColMap_' + cm, 'ebs:tab_dataconnect', 'mapping_used_in_tab')
for nt, tgt in (('OperatingUnit', 'AppRule_RULE_001'), ('DocumentTemplate', 'tab_docgen'), ('Employee', 'role_employee'),
                ('Supplier', 'AP'), ('OAFComponent', 'ModuleKnowledge_iExpense'), ('APEXApplication', 'tab_reports'),
                ('ADFApplication', 'tab_reports')):
    link('ebs:NodeType_' + nt, MOD.get(tgt) or 'ebs:' + tgt, 'node_type_relates_to')

# ---------- Context Studio normalisation (learned from the platform's own re-export) ----------
# 1. Context Studio keeps only string-valued attributes: lists/dicts/bools/ints were dropped on import,
#    and empty strings were replaced by the placeholder "string".  Convert everything to a string and omit blanks.
# 2. Node names must be unique: nodes whose name collided with another node (e.g. "Accounts Payable" for the
#    module, Academy module and SQL category) were deleted.  Suffix the colliding non-core nodes.


def to_str(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return v
    if isinstance(v, list) and all(isinstance(x, (str, int, float, bool)) for x in v):
        return "; ".join(to_str(x) for x in v)
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


for n in graph:
    attrs = n.get("attributes")
    if isinstance(attrs, dict):
        n["attributes"] = {k: to_str(v) for k, v in attrs.items() if v not in ("", None, [], {})}
        if "relationships" in attrs:  # plain-language edge list instead of a JSON blob
            n["attributes"]["relationships"] = "; ".join(
                f"{r['relationshipType']} -> {byid[r['target']]['name'] if r['target'] in byid else r['target']}"
                + (f" [{r['joinCondition']}]" if r.get("joinCondition") else "") for r in attrs["relationships"])

LABEL = {"AcademyModule": "Academy Module", "SQLCategory": "SQL Category", "UserRole": "User Role",
         "AppTab": "App Tab", "NodeTypeDefinition": "Node Type", "EdgeTypeDefinition": "Edge Type",
         "RelationshipTypeDefinition": "Relationship Type", "NLQuery": "NL Query", "OracleTable": "Table",
         "EBSReport": "Report", "BusinessRule": "Rule", "DataConnectSource": "Data Connect Source"}
core = {n["id"] for n in base["@graph"]}
seen = {}
for n in graph:  # core ontology nodes claim their names first
    if n["id"] in core:
        seen[n["name"].lower()] = n["id"]
for n in graph:
    if n["id"] in core:
        continue
    key = n["name"].lower()
    if key in seen:
        et = n.get("attributes", {}).get("entityType", "")
        suffix = LABEL.get(et, et or "Item")
        n["name"] = f"{n['name']} ({suffix})" if et != "NLQuery" else f"{n['name']} [{n['id'].split('_')[-1]}]"
        key = n["name"].lower()
        assert key not in seen, "unresolvable duplicate name " + n["name"]
    seen[key] = n["id"]


# ---------- header + validation ----------
header = {"id": "ebs:", "type": "owl:Ontology", "name": SCHEMA_NAME, "dcterms:title": SCHEMA_NAME,
          "dcterms:description": "Oracle EBS Intelligence Hub v6.0 - Oracle EBS R12.2 modules, business processes, "
          "reports, tables and join relationships, SQL compliance rules, RICE components, AME, Workflow, "
          "NL queries, Data Connect column mapping, roles/tabs, Academy, SQL Lab categories and DASC governance.",
          "dcterms:version": VERSION, "dcterms:creator": "Oracle EBS Intelligence Hub team", "owl:versionIRI": f"ebs:v{VERSION}",
          "rdfs:seeAlso": "https://github.com/madhavsamudrala/Oracle_EBS_Intelligence_Hub",
          "rdfs:comment": "Context Studio upload: schema name Oracle_EBS_Intelligence_Hub, format domain-model-jsonld."}
doc = {"@context": base["@context"], "@graph": [header] + graph}
OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")

ids = [n["id"] for n in doc["@graph"]]
assert len(ids) == len(set(ids)), "duplicate ids"
dang = [(n["id"], r) for n in graph for r in n.get("relatesTo", []) if r not in byid]
assert not dang, dang[:5]
from collections import Counter
print("wrote", OUT.name, OUT.stat().st_size, "bytes;", len(ids), "nodes")
print("by type:", dict(Counter(n["type"] for n in graph)))
print("by entityType:", dict(Counter(n.get("attributes", {}).get("entityType") for n in graph
                                     if n.get("attributes", {}).get("entityType"))))
print("edges dropped (unresolved CSV ids):", len(dropped))
for d in dropped:
    print("  ", d)

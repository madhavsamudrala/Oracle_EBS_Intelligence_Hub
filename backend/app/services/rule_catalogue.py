"""
backend/app/services/rule_catalogue.py

Phase 0: ONE place that says which rule ID means what.

The problem this fixes
----------------------
The old ComplianceChecker used IDs RULE_001 ... RULE_024 with its own meanings.
The knowledge graph (ica-schema/) uses the SAME ids with DIFFERENT meanings:

    ID         old ComplianceChecker        knowledge graph (02-rules.json)
    RULE_003   SELECT *                     PRIMARY_FLAG on assignments
    RULE_016   DDL statement                AP Invoice Void Cheque Filter
    RULE_024   IS NOT NULL / NVL            Use BULK COLLECT for large data sets

So "RULE_003" meant two different things depending on who said it.

The ID families that exist
--------------------------
    COMP-001 ... COMP-010   SQL compliance rules in the ontology
                            (ica-schema/ebs-ontology.jsonld). The agent finds
                            these when it reviews SQL.
    RULE_001 ... RULE_028   SQL rules in ica-schema/02-rules.json.
    RULE_101 ... RULE_105   Application rules (not SQL).
    APR-001 ... APR-011     Rules that exist ONLY in ica-schema/csv/approval_rules.csv.
                            (Before Phase 0 that CSV reused RULE_014..RULE_027 with
                            different meanings. See docs/rule_id_mapping.csv.)
                            The ComplianceChecker does not use these.
    LOCAL-001 ...           NEW. Checks the ComplianceChecker performs that
                            have no equivalent in the knowledge graph.
                            "LOCAL" makes it obvious they are not graph rules.

Canonical ID choice
-------------------
1. If the rule exists in the ontology, use its COMP-nnn id.
2. Otherwise if it exists in 02-rules.json, use its RULE_nnn id.
3. Otherwise use LOCAL-nnn.
When a rule exists in both families the other id is kept in `aliases`.

Nothing here changes how a rule is DETECTED or scored. Only its label.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class RuleInfo:
    id: str                       # canonical id shown to users
    name: str                     # name exactly as used in the knowledge graph
    in_graph: bool                # True if the id exists in the knowledge graph
    legacy_id: str                # the id the old ComplianceChecker used
    aliases: List[str] = field(default_factory=list)  # other graph ids, same meaning
    graph_severity: Optional[str] = None               # severity in the graph, for information


# key = internal name of the check inside compliance_checker.py
CATALOGUE: Dict[str, RuleInfo] = {
    "ORG_ID_MISSING": RuleInfo(
        id="COMP-001", name="ORG_ID Required", in_graph=True,
        legacy_id="RULE_001", aliases=["RULE_001"], graph_severity="CRITICAL"),
    "BIND_VARIABLES": RuleInfo(
        id="COMP-007", name="Bind Variables Required", in_graph=True,
        legacy_id="RULE_002", graph_severity="CRITICAL"),
    "SELECT_STAR": RuleInfo(
        id="COMP-008", name="No SELECT Star in Production", in_graph=True,
        legacy_id="RULE_003", aliases=["RULE_008"], graph_severity="MAJOR"),
    "FUNCTION_ON_COLUMN": RuleInfo(
        id="COMP-009", name="No Functions on Indexed Columns", in_graph=True,
        legacy_id="RULE_004", graph_severity="MAJOR"),
    "IN_SUBQUERY": RuleInfo(
        id="RULE_028", name="Use EXISTS Instead of IN for Subqueries", in_graph=True,
        legacy_id="RULE_005", graph_severity="Major"),
    "LARGE_TABLE_NO_LIMIT": RuleInfo(
        id="LOCAL-001", name="Large Table Without Row Limit", in_graph=False,
        legacy_id="RULE_006"),
    "LIKE_LEADING_WILDCARD": RuleInfo(
        id="RULE_011", name="LIKE Leading Wildcard Index Bypass", in_graph=True,
        legacy_id="RULE_007", graph_severity="Major"),
    "NOT_IN_SUBQUERY": RuleInfo(
        id="RULE_012", name="NOT IN with NULLs", in_graph=True,
        legacy_id="RULE_008", graph_severity="Critical"),
    "EXECUTE_IMMEDIATE": RuleInfo(
        id="RULE_010", name="EXECUTE IMMEDIATE SQL Injection", in_graph=True,
        legacy_id="RULE_009", graph_severity="Critical"),
    "DDL_STATEMENT": RuleInfo(
        id="LOCAL-002", name="DDL Statement Not Permitted In Reports", in_graph=False,
        legacy_id="RULE_016"),
    "DML_STATEMENT": RuleInfo(
        id="LOCAL-003", name="DML Statement Not Permitted In Reports", in_graph=False,
        legacy_id="RULE_017"),
    "NUMERIC_LITERAL": RuleInfo(
        id="COMP-007", name="Bind Variables Required", in_graph=True,
        legacy_id="RULE_018", graph_severity="CRITICAL"),
    "TABLE_ALIASES": RuleInfo(
        id="LOCAL-004", name="Use Table Aliases", in_graph=False,
        legacy_id="RULE_019"),
    "NULL_HANDLING": RuleInfo(
        id="LOCAL-005", name="Defensive NULL Handling", in_graph=False,
        legacy_id="RULE_024"),
}


def info_for(key: str) -> RuleInfo:
    """Look up a check by its internal key. Raises KeyError if it is not catalogued."""
    return CATALOGUE[key]


def canonical_ids() -> List[str]:
    """Every canonical id in the catalogue, de-duplicated, in a stable order."""
    seen: List[str] = []
    for r in CATALOGUE.values():
        if r.id not in seen:
            seen.append(r.id)
    return seen


def legacy_to_canonical() -> Dict[str, str]:
    """Map the OLD ComplianceChecker ids to the new canonical ids."""
    return {r.legacy_id: r.id for r in CATALOGUE.values()}

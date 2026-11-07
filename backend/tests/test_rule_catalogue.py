"""Tests for the rule ID catalogue and the ComplianceChecker.

The key idea: the checker's BEHAVIOUR (what it detects, severity, score) must not change in Phase 0.
Only the ID labels change. The baseline file was captured BEFORE any Phase 0 edit.
"""
import json
import re
from pathlib import Path

import pytest

from app.services.compliance_checker import ComplianceChecker, RULES
from app.services.rule_catalogue import CATALOGUE, canonical_ids, legacy_to_canonical

REPO = Path(__file__).resolve().parents[2]
BASELINE = json.loads((Path(__file__).parent / "fixtures" / "checker_baseline_before_phase0.json").read_text("utf-8"))


# ---------------------------------------------------------------- catalogue
def test_every_checker_rule_is_in_the_catalogue():
    for rule in RULES:
        assert rule["key"] in CATALOGUE, f"{rule['key']} missing from rule_catalogue.py"


def test_every_catalogue_entry_is_used_by_the_checker():
    used = {r["key"] for r in RULES}
    assert set(CATALOGUE) == used


def test_old_clashing_ids_are_gone_from_checker_output():
    """RULE_003 (SELECT *), RULE_016 (DDL) and RULE_024 (IS NOT NULL) meant something else in the graph."""
    c = ComplianceChecker()
    out = c.check("SELECT * FROM x; DROP TABLE y; SELECT 1 FROM z WHERE a IS NOT NULL")
    ids = {f["rule"] for f in out["findings"]}
    assert "RULE_003" not in ids
    assert "RULE_016" not in ids
    assert "RULE_024" not in ids
    assert "COMP-008" in ids          # SELECT *
    assert "LOCAL-002" in ids         # DDL
    assert "LOCAL-005" in ids         # IS NOT NULL


def test_select_star_is_comp_008_like_the_graph():
    c = ComplianceChecker()
    f = [x for x in c.check("SELECT * FROM t")["findings"] if x["rule"] == "COMP-008"]
    assert f and f[0]["name"] == "No SELECT Star in Production" and f[0]["in_graph"] is True


def test_id_format():
    for rid in canonical_ids():
        assert re.fullmatch(r"(COMP-\d{3}|RULE_\d{3}|LOCAL-\d{3})", rid), rid


def test_local_ids_are_never_flagged_as_in_graph():
    for info in CATALOGUE.values():
        assert info.in_graph == (not info.id.startswith("LOCAL-")), info


# ---------------------------------------------------------------- knowledge graph agreement
def graph_ids():
    rules = json.loads((REPO / "ica-schema" / "02-rules.json").read_text("utf-8"))
    rule_ids = {r["rule_id"] for r in rules["rules"]}
    comp_ids = set(rules["ontology_rule_ids"])
    return rule_ids, comp_ids, {r["rule_id"]: r["rule_name"] for r in rules["rules"]}


def test_every_in_graph_id_exists_in_the_knowledge_graph_files():
    rule_ids, comp_ids, _ = graph_ids()
    for info in CATALOGUE.values():
        if info.in_graph:
            assert info.id in rule_ids | comp_ids, f"{info.id} is not in ica-schema/02-rules.json"


def test_rule_family_names_match_the_graph_exactly():
    """For RULE_nnn ids the catalogue name must equal the graph rule_name (no more clashes)."""
    _, _, names = graph_ids()
    for info in CATALOGUE.values():
        if info.id.startswith("RULE_"):
            assert info.name == names[info.id], (info.id, info.name, names[info.id])


def test_comp_names_match_the_ontology_labels():
    onto = (REPO / "ica-schema" / "ebs-ontology.jsonld").read_text("utf-8")
    for info in CATALOGUE.values():
        if info.id.startswith("COMP-"):
            m = re.search(r'"rdfs:label": "%s ([^"(]+?) \(' % re.escape(info.id), onto)
            assert m, f"{info.id} label not found in ontology"
            assert m.group(1).strip() == info.name, (info.id, m.group(1), info.name)


def test_local_ids_do_not_exist_in_graph_files():
    rule_ids, comp_ids, _ = graph_ids()
    for info in CATALOGUE.values():
        if info.id.startswith("LOCAL-"):
            assert info.id not in rule_ids | comp_ids


def test_legacy_mapping_covers_all_old_ids():
    old = {"RULE_001", "RULE_002", "RULE_003", "RULE_004", "RULE_005", "RULE_006", "RULE_007",
           "RULE_008", "RULE_009", "RULE_016", "RULE_017", "RULE_018", "RULE_019", "RULE_024"}
    assert set(legacy_to_canonical()) == old


# ---------------------------------------------------------------- behaviour unchanged
@pytest.mark.parametrize("name", list(BASELINE["samples"]))
def test_scores_and_detections_match_pre_phase0_baseline(name):
    """Same SQL -> same score and the same checks fire (compared via the legacy id map)."""
    sql = BASELINE["samples"][name]
    before = BASELINE["baseline"][name]
    after = ComplianceChecker().check(sql)
    assert after["score"] == before["score"]
    legacy = legacy_to_canonical()
    expected = sorted(legacy[f["rule"]] for f in before["findings"])
    assert sorted(f["rule"] for f in after["findings"]) == expected
    assert [f["severity"] for f in after["findings"]] == [f["severity"] for f in before["findings"]]


def test_old_response_fields_still_present():
    out = ComplianceChecker().check("SELECT * FROM t")
    assert {"source", "findings", "score", "summary"} <= set(out)
    assert {"rule", "severity", "message"} <= set(out["findings"][0])


# ---------------------------------------------------------------- other places that mention rule IDs
def test_chat_py_rule_list_agrees_with_the_graph():
    """chat.py (EBS_KNOWLEDGE and MODULE_RULES) quotes RULE_001..RULE_007. Each must exist in the
    graph AND describe the same thing, so the legacy chat prompt cannot contradict the graph."""
    _, _, names = graph_ids()
    src = (REPO / "backend" / "app" / "routes" / "chat.py").read_text("utf-8")
    expected_keyword = {            # id -> word that must appear in the graph rule name
        "RULE_001": "ORG_ID", "RULE_002": "DateTrack", "RULE_003": "PRIMARY_FLAG",
        "RULE_004": "Cancelled", "RULE_005": "Void", "RULE_006": "Summary", "RULE_007": "SOURCE",
    }
    found = set(re.findall(r"RULE_\d{3}", src))
    assert found == set(expected_keyword), found
    for rid, word in expected_keyword.items():
        assert word.lower() in names[rid].lower(), (rid, names[rid])


def test_sql_advisor_endpoint_keeps_old_shape_and_new_ids():
    from fastapi.testclient import TestClient
    from app.main import app
    r = TestClient(app).post("/api/sql_advisor", json={"sql": "SELECT * FROM ap_invoices_all"}).json()
    assert {"source", "findings", "score", "summary"} <= set(r)
    assert "COMP-008" in {f["rule"] for f in r["findings"]}

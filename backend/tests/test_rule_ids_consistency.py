"""Rule ID consistency tests (Phase 0, Option A).

Background: ica-schema/02-rules.json is the MASTER rule list. ica-schema/csv/approval_rules.csv
used to reuse RULE_014..RULE_027 with different meanings, so the AI agent mixed them up.

These tests fail if:
  * the same ID appears twice in one file,
  * the same ID has two different names in two files,
  * a CSV-only rule is not in the APR-nnn namespace,
  * the old-ID -> new-ID mapping file is incomplete or points at missing IDs.
"""
import csv
import json
import re
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MASTER_JSON = REPO / "ica-schema" / "02-rules.json"
RULES_CSV = REPO / "ica-schema" / "csv" / "approval_rules.csv"
MAPPING_CSV = REPO / "docs" / "rule_id_mapping.csv"

APR_RE = re.compile(r"^APR-\d{3}$")
RULE_RE = re.compile(r"^RULE_\d{3}$")


def _master():
    return json.loads(MASTER_JSON.read_text("utf-8"))["rules"]


def _csv_rows():
    with RULES_CSV.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _mapping_rows():
    with MAPPING_CSV.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


# ------------------------------------------------------------ no duplicates
def test_master_has_no_duplicate_ids():
    dupes = [i for i, n in Counter(r["rule_id"] for r in _master()).items() if n > 1]
    assert not dupes, f"duplicate IDs in 02-rules.json: {dupes}"


def test_csv_has_no_duplicate_ids():
    dupes = [i for i, n in Counter(r["rule_id"] for r in _csv_rows()).items() if n > 1]
    assert not dupes, f"duplicate IDs in approval_rules.csv: {dupes}"


def test_csv_has_27_rows():
    assert len(_csv_rows()) == 27


# ------------------------------------------------- same ID => same meaning
def test_same_id_never_has_two_names():
    """The original bug: RULE_021 was 'Hardcoded Org ID' in the CSV and something else in the master."""
    master = {r["rule_id"]: r["rule_name"] for r in _master()}
    conflicts = [
        (r["rule_id"], r["rule_name"], master[r["rule_id"]])
        for r in _csv_rows()
        if r["rule_id"] in master and r["rule_name"] != master[r["rule_id"]]
    ]
    assert not conflicts, f"ID reused with a different name (csv, master): {conflicts}"


def test_csv_rule_ids_use_master_values():
    """For shared IDs, severity and check number must also match the master.

    rule_type and category are NOT compared: the CSV deliberately uses finer labels
    (e.g. 'security', 'DateTrack') than the master's 'sql_compliance' / 'EBS Compliance'.
    That is a classification difference, not a different rule.
    """
    master = {r["rule_id"]: r for r in _master()}
    for r in _csv_rows():
        m = master.get(r["rule_id"])
        if not m:
            continue
        assert r["severity"] == m["severity"], r["rule_id"]
        assert r["code_review_check_number"] == str(m["code_review_check_number"]), r["rule_id"]


# ------------------------------------------------------------- namespaces
def test_csv_ids_are_master_or_apr():
    master_ids = {r["rule_id"] for r in _master()}
    for r in _csv_rows():
        rid = r["rule_id"]
        if APR_RE.match(rid):
            continue
        assert RULE_RE.match(rid) and rid in master_ids, f"{rid} is neither a master RULE_nnn nor APR-nnn"


def test_apr_ids_are_unique_and_sequential():
    ids = [r["rule_id"] for r in _csv_rows() if r["rule_id"].startswith("APR-")]
    assert ids == [f"APR-{i:03d}" for i in range(1, len(ids) + 1)]


def test_apr_ids_do_not_exist_in_master():
    assert not [r for r in _master() if r["rule_id"].startswith("APR-")]


def test_apr_rules_have_no_fake_check_number():
    """A blank number is honest: no browser check implements an APR rule."""
    for r in _csv_rows():
        if r["rule_id"].startswith("APR-"):
            assert r["code_review_check_number"] == "", r["rule_id"]


# --------------------------------------------------------------- mapping file
def test_mapping_covers_all_27_old_ids():
    rows = _mapping_rows()
    assert len(rows) == 27
    assert [r["old_id_in_approval_rules_csv"] for r in rows] == [f"RULE_{i:03d}" for i in range(1, 28)]


def test_mapping_targets_exist():
    master_ids = {r["rule_id"] for r in _master()}
    csv_ids = {r["rule_id"] for r in _csv_rows()}
    for r in _mapping_rows():
        new = r["new_id"]
        assert new in master_ids or new in csv_ids, f"mapping points at missing ID {new}"


def test_every_apr_rule_is_in_the_mapping():
    mapped = {r["new_id"] for r in _mapping_rows() if r["new_id"].startswith("APR-")}
    in_csv = {r["rule_id"] for r in _csv_rows() if r["rule_id"].startswith("APR-")}
    assert mapped == in_csv


def test_mapping_names_agree_with_master():
    master = {r["rule_id"]: r["rule_name"] for r in _master()}
    for r in _mapping_rows():
        if r["new_id"] in master:
            assert r["master_rule_name"] == master[r["new_id"]], r["new_id"]


# ------------------------------------------------------ other places use master
def test_catalogue_rule_names_match_master():
    from app.services.rule_catalogue import CATALOGUE

    master = {r["rule_id"]: r["rule_name"] for r in _master()}
    for info in CATALOGUE.values():
        if info.id.startswith("RULE_"):
            assert master.get(info.id) == info.name, f"{info.id}: catalogue name differs from master"


# ------------------------------------------- intentional CSV vs master differences
# The CSV uses finer labels than the master. These differences are DELIBERATE and are
# documented in docs/RULE_MERGE_REVIEW.md. The tests below pin the exact list, so:
#   * a NEW unreviewed difference fails the test, and
#   * a documented difference that disappears also fails (the doc would then be stale).
DOCUMENTED_RULE_TYPE_DIFFS = {          # id -> CSV rule_type (master says 'sql_compliance' for all)
    "RULE_008": "sql_best_practice",
    "RULE_009": "sql_best_practice",
    "RULE_010": "security",
    "RULE_011": "sql_best_practice",
    "RULE_012": "sql_best_practice",
    "RULE_013": "sql_best_practice",
}
DOCUMENTED_CATEGORY_DIFFS = {           # id -> CSV category (master says 'EBS Compliance' for all)
    "RULE_002": "DateTrack",
    "RULE_003": "DateTrack",
    "RULE_004": "AP",
    "RULE_005": "AP",
    "RULE_006": "GL",
    "RULE_007": "iExpense",
    "RULE_014": "FND",
    "RULE_023": "INV",
}


def _diffs(field):
    master = {r["rule_id"]: r for r in _master()}
    return {r["rule_id"]: r[field] for r in _csv_rows()
            if r["rule_id"] in master and r[field] != master[r["rule_id"]][field]}


def test_rule_type_differences_are_exactly_the_documented_ones():
    assert _diffs("rule_type") == DOCUMENTED_RULE_TYPE_DIFFS


def test_category_differences_are_exactly_the_documented_ones():
    assert _diffs("category") == DOCUMENTED_CATEGORY_DIFFS


def test_rule_type_differences_never_change_the_rule_name_or_severity():
    """A label difference must not hide a real disagreement."""
    master = {r["rule_id"]: r for r in _master()}
    for rid in set(DOCUMENTED_RULE_TYPE_DIFFS) | set(DOCUMENTED_CATEGORY_DIFFS):
        row = next(r for r in _csv_rows() if r["rule_id"] == rid)
        assert row["rule_name"] == master[rid]["rule_name"]
        assert row["severity"] == master[rid]["severity"]


# ------------------------------------------- evidence for the RULE_019 -> RULE_014 merge
def test_rule_014_severity_matches_the_browser_check_that_implements_it():
    """Merge RULE_019 (Minor) -> RULE_014 (Info): the browser's Code Review check 24 (FND_LOOKUPS)
    reports severity 'info', which is what the master says. The old CSV 'Minor' had no implementation."""
    js = (REPO / "ebs-reports.js").read_text("utf-8")
    start = js.index("CHECK 24 - Using FND_LOOKUPS")
    block = js[start:start + 900]
    assert "sev:'info'" in block
    master = {r["rule_id"]: r for r in _master()}
    assert master["RULE_014"]["severity"] == "Info"
    assert master["RULE_014"]["code_review_check_number"] == 24
    csv_row = next(r for r in _csv_rows() if r["rule_id"] == "RULE_014")
    assert csv_row["severity"] == "Info"

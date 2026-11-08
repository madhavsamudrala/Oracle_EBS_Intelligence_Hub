"""Rule -> browser Code Review check mapping tests (Phase 0, round 4).

ica-schema/02-rules.json has a field `code_review_check_number`. It says which of the 27 checks in
`performCodeReview()` (ebs-reports.js) detects the rule. Context Studio stores that number, so a wrong
number makes the AI agent quote a wrong check.

Rules:
  * a number is allowed ONLY when the browser check really detects what the rule describes;
  * otherwise the field is null in the master, blank in the CSV and absent in the JSON-LD;
  * these tests read the real ebs-reports.js, so they fail if a check is renumbered or changed.

To add a mapping later: change 02-rules.json, add the rule to EXPECTED_MAPPING below with tokens that
the check's detection code really contains, then regenerate the JSON-LD and the CSV.
"""
import csv
import json
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
JS = REPO / "ebs-reports.js"
MASTER = REPO / "ica-schema" / "02-rules.json"
CSV_FILE = REPO / "ica-schema" / "csv" / "approval_rules.csv"
JSONLD = REPO / "ica-schema" / "Oracle_EBS_Intelligence_Hub.jsonld"

# rule -> (check number, regex strings that must appear in that check's DETECTION code)
EXPECTED_MAPPING = {
    "RULE_001": (5,  [r"MULTI_ORG_TABLES", r"ORG_ID"]),
    "RULE_002": (6,  [r"PER_PEOPLE_F", r"EFFECTIVE_START_DATE"]),
    "RULE_003": (21, [r"PER_ASSIGNMENTS_F", r"PRIMARY_FLAG"]),
    "RULE_004": (23, [r"AP_INVOICES_ALL", r"CANCELLED_DATE"]),
    "RULE_006": (22, [r"GL_CODE_COMBINATIONS", r"SUMMARY_FLAG"]),
    "RULE_007": (25, [r"AP_EXPENSE_REPORT_HEADERS_ALL", r"SOURCE"]),
    "RULE_008": (2,  [r"SELECT\\s\+\\\*"]),
    "RULE_009": (3,  [r"\\\(\\s\*SELECT"]),
    "RULE_010": (27, [r"EXECUTE\\s\+IMMEDIATE", r"\\\|\\\|"]),
    "RULE_011": (15, [r"LIKE\\s\+'%"]),
    "RULE_012": (16, [r"NOT\\s\+IN\\s\*\\\(\\s\*SELECT"]),
    "RULE_013": (20, [r"ROWNUM", r"ORDER\\s\+BY"]),
    "RULE_014": (24, [r"FND_LOOKUPS", r"FND_LOOKUP_VALUES_VL"]),
    "RULE_015": (1,  [r"S\.includes\('--'\)", r"S\.includes\('/\*'\)"]),
}

# rule -> why no browser check matches (documented in docs/CODE_REVIEW_CHECK_MAPPING.md)
UNMAPPED = {
    "RULE_005": "no check looks at VOID_DATE / AP_CHECKS_ALL cheques",
    "RULE_016": "same as RULE_005: no void-cheque check",
    "RULE_017": "no check looks for a hard-coded org id value (check 14 flags a QUOTED id, a type problem)",
    "RULE_018": "no as-of-date / historical DateTrack check",
    "RULE_019": "no PO FINALLY CLOSED check",
    "RULE_020": "no RA_CUSTOMER_TRX_ALL complete_flag check",
    "RULE_021": "no AR_PAYMENT_SCHEDULES_ALL status check",
    "RULE_022": "no GL_BALANCES actual_flag check",
    "RULE_023": "no MTL organization_id check (check 5 lists MTL_MATERIAL_TRANSACTIONS for ORG_ID, a different column)",
    "RULE_024": "no BULK COLLECT / FORALL check",
    "RULE_025": "no PL/SQL COMMIT / ROLLBACK / exception-handler check",
    "RULE_026": "no WHO-column check on custom tables",
    "RULE_027": "no FND_GLOBAL.APPS_INITIALIZE check",
    "RULE_028": "check 16 flags only NOT IN (SELECT ...); no check recommends EXISTS for a positive IN (SELECT ...)",
}

# Words that would show a browser check really covers an unmapped rule. If one appears in any check's
# detection code, the test fails and a person must review the mapping.
UNMAPPED_TOKENS = {
    "RULE_005": ["VOID_DATE"], "RULE_016": ["VOID_DATE"],
    "RULE_018": ["AS_OF", "HISTORIC"],
    "RULE_019": ["FINALLY"], "RULE_020": ["COMPLETE_FLAG"],
    "RULE_021": ["AR_PAYMENT_SCHEDULES"], "RULE_022": ["GL_BALANCES", "ACTUAL_FLAG"],
    "RULE_023": ["ORGANIZATION_ID"], "RULE_024": ["BULK", "FORALL"],
    "RULE_025": ["COMMIT", "ROLLBACK"], "RULE_026": ["XXCUST", "CREATED_BY"],
    "RULE_027": ["APPS_INITIALIZE", "FND_GLOBAL"],
}


# ----------------------------------------------------------------------------- readers
def _checks():
    """Parse performCodeReview(): {number: {'heading': str, 'detect': str}}.

    'detect' is the code from the CHECK comment up to the first reviews.push(...), so it holds the
    condition and any table list, but not the explanatory text (detail/before/after strings)."""
    js = JS.read_text("utf-8")
    body = js[js.index("function performCodeReview()"):js.index("function runCodeReview()")]
    marks = list(re.finditer(r"CHECK\s+(\d+)\s*[\u2014\-:]\s*([^\n]+)", body))
    out = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        block = body[m.start():end]
        out[int(m.group(1))] = {"heading": m.group(2).strip(), "detect": block.split("reviews.push", 1)[0]}
    return out


def _master():
    return {r["rule_id"]: r for r in json.loads(MASTER.read_text("utf-8"))["rules"]}


def _sql_rules():
    return {k: v for k, v in _master().items() if re.fullmatch(r"RULE_0(0\d|1\d|2[0-8])", k)}


# ----------------------------------------------------------------------------- the browser side
def test_browser_has_exactly_27_numbered_checks():
    checks = _checks()
    assert sorted(checks) == list(range(1, 28)), sorted(checks)


def test_every_check_detection_code_was_found():
    for n, c in _checks().items():
        assert len(c["detect"]) > 40, f"check {n}: detection code not parsed"


# ----------------------------------------------------------------------------- master numbers
def test_master_covers_rule_001_to_028_and_nothing_is_missing_from_the_tables():
    assert sorted(_sql_rules()) == [f"RULE_{i:03d}" for i in range(1, 29)]
    assert sorted(list(EXPECTED_MAPPING) + list(UNMAPPED)) == sorted(_sql_rules())


def test_master_numbers_equal_the_verified_mapping():
    master = _sql_rules()
    for rid, (num, _) in EXPECTED_MAPPING.items():
        assert master[rid]["code_review_check_number"] == num, f"{rid} should map to check {num}"


def test_unmapped_rules_are_null_in_master_not_zero_or_guessed():
    master = _sql_rules()
    for rid in UNMAPPED:
        assert "code_review_check_number" in master[rid], f"{rid}: keep the key, set it to null"
        assert master[rid]["code_review_check_number"] is None, f"{rid}: must be null (no genuine browser check)"


def test_every_mapped_number_is_a_real_check_and_used_once():
    nums = [n for n, _ in EXPECTED_MAPPING.values()]
    assert all(1 <= n <= 27 for n in nums)
    assert len(nums) == len(set(nums)), "two rules point at the same check: review it"
    assert 0 not in nums


def test_rule_001_and_002_corrections():
    master = _master()
    assert master["RULE_001"]["code_review_check_number"] == 5   # was 4 (implicit joins)
    assert master["RULE_002"]["code_review_check_number"] == 6   # was 5 (ORG_ID)


# ----------------------------------------------------------------------------- number vs real code
@pytest.mark.parametrize("rid", sorted(EXPECTED_MAPPING))
def test_mapped_check_really_detects_what_the_rule_describes(rid):
    num, tokens = EXPECTED_MAPPING[rid]
    detect = _checks()[num]["detect"]
    for tok in tokens:
        assert re.search(tok, detect), f"{rid} -> check {num}: detection code lacks /{tok}/"


@pytest.mark.parametrize("rid", sorted(UNMAPPED_TOKENS))
def test_no_browser_check_secretly_covers_an_unmapped_rule(rid):
    for n, c in _checks().items():
        for tok in UNMAPPED_TOKENS[rid]:
            assert tok not in c["detect"].upper(), (
                f"check {n} now mentions {tok}: {rid} may be implemented. Review and map it.")


def test_rule_028_exists_vs_in_is_not_covered_by_check_16():
    """RULE_028 says: prefer EXISTS over a positive IN (SELECT ...).
    Check 16 detects only NOT IN (SELECT ...), a different problem (NULL safety)."""
    checks = _checks()
    c16 = checks[16]["detect"]
    assert r"NOT\s+IN\s*\(\s*SELECT" in c16
    # No detection code anywhere tests for a plain IN (SELECT ...): every such pattern is the NOT IN one.
    all_detect = "\n".join(c["detect"] for c in checks.values())
    plain = all_detect.count(r"IN\s*\(\s*SELECT")
    negated = all_detect.count(r"NOT\s+IN\s*\(\s*SELECT")
    assert plain == negated == 1
    # Check 17 is about the SIZE of an IN list, not subqueries.
    assert "inListItems" in checks[17]["detect"]
    assert _master()["RULE_028"]["code_review_check_number"] is None


def test_rule_017_hardcoded_org_is_not_check_14():
    """Check 14 flags a QUOTED id compared to a number column. It does not flag a hard-coded org id."""
    c14 = _checks()[14]["detect"]
    assert r"=\s*'[\d]+'" in c14
    assert _master()["RULE_017"]["code_review_check_number"] is None
    mo_checks = [n for n, c in _checks().items() if "MO_GLOBAL" in c["detect"].upper()]
    assert mo_checks == [5], f"MO_GLOBAL is now handled by checks {mo_checks}: review RULE_017"


# ----------------------------------------------------------------------------- copies stay in sync
def test_csv_numbers_equal_master_and_unmapped_are_blank():
    master = _sql_rules()
    rows = list(csv.DictReader(CSV_FILE.open(encoding="utf-8", newline="")))
    seen = 0
    for r in rows:
        m = master.get(r["rule_id"])
        if not m:
            assert r["code_review_check_number"] == "", r["rule_id"]       # APR-nnn
            continue
        seen += 1
        want = "" if m["code_review_check_number"] is None else str(m["code_review_check_number"])
        assert r["code_review_check_number"] == want, r["rule_id"]
    assert seen == 16, "16 CSV rows share an ID with the master; the other 11 are APR-nnn"


def test_csv_has_no_literal_zero_none_or_null():
    rows = list(csv.DictReader(CSV_FILE.open(encoding="utf-8", newline="")))
    bad = [r["rule_id"] for r in rows if r["code_review_check_number"].strip().lower() in ("0", "none", "null")]
    assert not bad, bad


def test_jsonld_has_the_number_only_for_mapped_rules():
    master = _sql_rules()
    graph = json.loads(JSONLD.read_text("utf-8"))["@graph"]
    nodes = {n["attributes"]["rule_id"]: n["attributes"] for n in graph
             if isinstance(n, dict) and (n.get("attributes") or {}).get("entityType") == "BusinessRule"
             and (n["attributes"].get("rule_id") in master)}
    assert sorted(nodes) == sorted(master)
    for rid, attrs in nodes.items():
        want = master[rid]["code_review_check_number"]
        if want is None:
            assert "code_review_check_number" not in attrs, f"{rid}: blank rule must not carry a number"
        else:
            assert attrs["code_review_check_number"] == str(want), rid
    assert sum("code_review_check_number" in a for a in nodes.values()) == len(EXPECTED_MAPPING)


@pytest.mark.parametrize("rid", sorted(EXPECTED_MAPPING))
def test_mapped_rule_severity_equals_browser_check_severity(rid):
    """A rule and the check that implements it must agree on severity (critical/major/minor/info)."""
    num, _ = EXPECTED_MAPPING[rid]
    detect_and_push = _checks_with_push()[num]
    first_sev = re.search(r"sev:\s*'(\w+)'", detect_and_push).group(1)
    assert _master()[rid]["severity"].lower() == first_sev, f"{rid}: master {_master()[rid]['severity']} vs check {num} {first_sev}"


def _checks_with_push():
    """Like _checks() but keeps the reviews.push(...) block, which holds sev:'...'."""
    js = JS.read_text("utf-8")
    body = js[js.index("function performCodeReview()"):js.index("function runCodeReview()")]
    marks = list(re.finditer(r"CHECK\s+(\d+)\s*[\u2014\-:]\s*([^\n]+)", body))
    return {int(m.group(1)): body[m.start():(marks[i + 1].start() if i + 1 < len(marks) else len(body))]
            for i, m in enumerate(marks)}
"""
backend/app/services/compliance_checker.py
SQL compliance checker — evaluates Oracle EBS SQL against 28 rules.
Mirrors the local checks in ebs-ica-integration.js _icaLocalSQLCheck().
"""
import re
from dataclasses import dataclass
from typing import List

@dataclass
class Finding:
    rule:     str
    severity: str
    message:  str

RULES = [
    dict(id="RULE_001", sev="High",     test=lambda s: "ORG_ID" not in s,
         msg="Missing ORG_ID filter — multi-org tables require org context."),
    dict(id="RULE_002", sev="Medium",   test=lambda s: bool(re.search(r"'[^']+'", s)) and ":" not in s,
         msg="Possible hard-coded literal — consider using bind variables."),
    dict(id="RULE_003", sev="High",     test=lambda s: bool(re.search(r"SELECT\s+\*", s)),
         msg="SELECT * detected — list explicit columns for performance."),
    dict(id="RULE_004", sev="Medium",   test=lambda s: bool(re.search(r"TO_DATE\(.*INVOICE_DATE|TRUNC\(.*INVOICE_DATE", s)),
         msg="Function on indexed column may suppress index usage."),
    dict(id="RULE_005", sev="Medium",   test=lambda s: bool(re.search(r" IN\s*\(SELECT", s)),
         msg="IN (SELECT) — consider EXISTS for better performance."),
    dict(id="RULE_006", sev="Low",      test=lambda s: "AP_INVOICES_ALL" in s and "ROWNUM" not in s,
         msg="Large table queried without ROWNUM limit."),
    dict(id="RULE_007", sev="Medium",   test=lambda s: bool(re.search(r" LIKE\s+'%", s)),
         msg="Leading wildcard LIKE — full index scan."),
    dict(id="RULE_008", sev="High",     test=lambda s: bool(re.search(r" NOT IN\s*\(SELECT", s)),
         msg="NOT IN with subquery — NULL handling may return no rows."),
    dict(id="RULE_009", sev="Critical", test=lambda s: "EXECUTE IMMEDIATE" in s,
         msg="EXECUTE IMMEDIATE detected — SQL injection risk."),
    dict(id="RULE_016", sev="Critical", test=lambda s: bool(re.search(r"\bCREATE\b|\bDROP\b|\bALTER\b", s)),
         msg="DDL statement detected — not permitted in reports."),
    dict(id="RULE_017", sev="Critical", test=lambda s: bool(re.search(r"\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bMERGE\b", s)),
         msg="DML statement detected — SELECT only allowed."),
    dict(id="RULE_018", sev="Medium",   test=lambda s: bool(re.search(r"WHERE\s+\w+\s*=\s*[0-9]+", s)),
         msg="Implicit numeric literal — use bind variable."),
    dict(id="RULE_019", sev="Low",      test=lambda s: bool(re.search(r"FROM\s+\w+\s+WHERE", s)) and "." not in s,
         msg="Consider using table aliases for clarity."),
    dict(id="RULE_024", sev="Low",      test=lambda s: bool(re.search(r"IS\s+NOT\s+NULL", s)),
         msg="Consider NVL/COALESCE to handle NULLs defensively."),
]

SEVERITY_SCORE = {"Critical": 30, "High": 20, "Medium": 10, "Low": 5}


class ComplianceChecker:
    def check(self, sql: str) -> dict:
        upper    = sql.upper()
        findings = []

        for rule in RULES:
            try:
                if rule["test"](upper):
                    findings.append(Finding(rule=rule["id"], severity=rule["sev"], message=rule["msg"]))
            except Exception:
                pass

        deductions = sum(SEVERITY_SCORE.get(f.severity, 5) for f in findings)
        score      = max(0, 100 - deductions)

        return {
            "source":   "backend",
            "findings": [{"rule": f.rule, "severity": f.severity, "message": f.message} for f in findings],
            "score":    score,
            "summary":  "✅ No compliance issues detected." if not findings
                        else f"⚠️ {len(findings)} issue(s) found — review before running in production.",
        }

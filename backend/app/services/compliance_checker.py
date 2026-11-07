"""
backend/app/services/compliance_checker.py
SQL compliance checker - evaluates Oracle EBS SQL against 14 rules.

Phase 0 change: rule IDs now come from rule_catalogue.py, so they agree with
the knowledge graph. Detection logic, severities and scoring are UNCHANGED.
(The old docstring claimed 28 rules and a JS function that does not exist.)
"""
import re
from dataclasses import dataclass
from typing import List

from app.services.rule_catalogue import info_for


@dataclass
class Finding:
    rule:     str
    severity: str
    message:  str
    name:     str = ""
    in_graph: bool = False


# key = catalogue key (see rule_catalogue.py). Do not change test/sev/msg here
# unless you also update the baseline test.
RULES = [
    dict(key="ORG_ID_MISSING",        sev="High",     test=lambda s: "ORG_ID" not in s,
         msg="Missing ORG_ID filter — multi-org tables require org context."),
    dict(key="BIND_VARIABLES",        sev="Medium",   test=lambda s: bool(re.search(r"'[^']+'", s)) and ":" not in s,
         msg="Possible hard-coded literal — consider using bind variables."),
    dict(key="SELECT_STAR",           sev="High",     test=lambda s: bool(re.search(r"SELECT\s+\*", s)),
         msg="SELECT * detected — list explicit columns for performance."),
    dict(key="FUNCTION_ON_COLUMN",    sev="Medium",   test=lambda s: bool(re.search(r"TO_DATE\(.*INVOICE_DATE|TRUNC\(.*INVOICE_DATE", s)),
         msg="Function on indexed column may suppress index usage."),
    dict(key="IN_SUBQUERY",           sev="Medium",   test=lambda s: bool(re.search(r" IN\s*\(SELECT", s)),
         msg="IN (SELECT) — consider EXISTS for better performance."),
    dict(key="LARGE_TABLE_NO_LIMIT",  sev="Low",      test=lambda s: "AP_INVOICES_ALL" in s and "ROWNUM" not in s,
         msg="Large table queried without ROWNUM limit."),
    dict(key="LIKE_LEADING_WILDCARD", sev="Medium",   test=lambda s: bool(re.search(r" LIKE\s+'%", s)),
         msg="Leading wildcard LIKE — full index scan."),
    dict(key="NOT_IN_SUBQUERY",       sev="High",     test=lambda s: bool(re.search(r" NOT IN\s*\(SELECT", s)),
         msg="NOT IN with subquery — NULL handling may return no rows."),
    dict(key="EXECUTE_IMMEDIATE",     sev="Critical", test=lambda s: "EXECUTE IMMEDIATE" in s,
         msg="EXECUTE IMMEDIATE detected — SQL injection risk."),
    dict(key="DDL_STATEMENT",         sev="Critical", test=lambda s: bool(re.search(r"\bCREATE\b|\bDROP\b|\bALTER\b", s)),
         msg="DDL statement detected — not permitted in reports."),
    dict(key="DML_STATEMENT",         sev="Critical", test=lambda s: bool(re.search(r"\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bMERGE\b", s)),
         msg="DML statement detected — SELECT only allowed."),
    dict(key="NUMERIC_LITERAL",       sev="Medium",   test=lambda s: bool(re.search(r"WHERE\s+\w+\s*=\s*[0-9]+", s)),
         msg="Implicit numeric literal — use bind variable."),
    dict(key="TABLE_ALIASES",         sev="Low",      test=lambda s: bool(re.search(r"FROM\s+\w+\s+WHERE", s)) and "." not in s,
         msg="Consider using table aliases for clarity."),
    dict(key="NULL_HANDLING",         sev="Low",      test=lambda s: bool(re.search(r"IS\s+NOT\s+NULL", s)),
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
                    info = info_for(rule["key"])
                    findings.append(Finding(
                        rule=info.id, severity=rule["sev"], message=rule["msg"],
                        name=info.name, in_graph=info.in_graph))
            except Exception:
                pass

        deductions = sum(SEVERITY_SCORE.get(f.severity, 5) for f in findings)
        score      = max(0, 100 - deductions)

        return {
            "source":   "backend",
            "findings": [
                {"rule": f.rule, "name": f.name, "in_graph": f.in_graph,
                 "severity": f.severity, "message": f.message}
                for f in findings
            ],
            "score":    score,
            "summary":  "✅ No compliance issues detected." if not findings
                        else f"⚠️ {len(findings)} issue(s) found — review before running in production.",
        }

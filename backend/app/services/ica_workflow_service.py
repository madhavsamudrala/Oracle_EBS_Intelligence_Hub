"""
backend/app/services/ica_workflow_service.py
Core service — mirrors the local fallback data in ebs-ica-integration.js
so the backend returns the same structured context as the frontend fallback.
"""

MODULE_TABLES = {
    "AP":       ["AP_INVOICES_ALL","AP_SUPPLIERS","AP_CHECKS_ALL","AP_PAYMENT_SCHEDULES_ALL","AP_INVOICE_PAYMENTS"],
    "AR":       ["AR_PAYMENT_SCHEDULES_ALL","AR_CASH_RECEIPTS_ALL"],
    "GL":       ["GL_JE_HEADERS","GL_JE_LINES","GL_CODE_COMBINATIONS","GL_BALANCES"],
    "PO":       ["PO_HEADERS_ALL","PO_LINES_ALL","PO_DISTRIBUTIONS_ALL"],
    "HRMS":     ["PER_ALL_PEOPLE_F","PER_ALL_ASSIGNMENTS_F","HR_ALL_ORGANIZATION_UNITS"],
    "iExpense": ["AP_EXPENSE_REPORT_HEADERS_ALL","AP_EXPENSE_REPORT_LINES_ALL","AP_CREDIT_CARD_TRXNS_ALL"],
    "INV":      ["MTL_SYSTEM_ITEMS_B","MTL_ONHAND_QUANTITIES_DETAIL"],
}

MODULE_REPORTS = {
    "AP":       ["Aged Payables","Invoice Register","AP Trial Balance","Withholding Tax","Supplier Payments"],
    "AR":       ["AR Aging Report","Customer Statement"],
    "GL":       ["GL Journal Entries","GL Trial Balance","Account Analysis"],
    "PO":       ["PO Detail Report","PO Distributions","Receipt Adjustments","Savings Analysis"],
    "HRMS":     ["Active Employees","Terminated Employees","Supervisor Details","Cost Allocation"],
    "iExpense": ["iExpense Detail","Credit Card Report","Workflow Approvals"],
    "INV":      ["Inventory Valuation"],
}

MODULE_RULES = {
    "AP":       ["RULE_001 ORG_ID required","RULE_004 Cancelled invoices","RULE_005 Void cheques"],
    "AR":       ["RULE_001 ORG_ID required"],
    "GL":       ["RULE_001 ORG_ID required","RULE_006 Summary flag filter"],
    "PO":       ["RULE_001 ORG_ID required"],
    "HRMS":     ["RULE_002 DateTrack PPF","RULE_003 DateTrack PAF"],
    "iExpense": ["RULE_001 ORG_ID required","RULE_007 SOURCE filter"],
    "INV":      ["RULE_001 ORG_ID required"],
}

RICE_COUNTS = {
    "AP":       {"R": 2, "I": 2, "C": 1, "E": 1},
    "AR":       {"R": 1, "I": 0, "C": 1, "E": 0},
    "GL":       {"R": 1, "I": 1, "C": 0, "E": 0},
    "PO":       {"R": 1, "I": 0, "C": 0, "E": 1},
    "HRMS":     {"R": 1, "I": 0, "C": 0, "E": 1},
    "iExpense": {"R": 1, "I": 0, "C": 0, "E": 1},
    "INV":      {"R": 1, "I": 0, "C": 0, "E": 0},
}

MODULE_KEYWORDS = {
    "AP":       ["payable","invoice","supplier","vendor","ap_"],
    "AR":       ["receivable","customer","ar_"],
    "GL":       ["journal","ledger","gl_","trial balance"],
    "PO":       ["purchase","po_","procurement"],
    "HRMS":     ["employee","hrms","per_","assignment"],
    "iExpense": ["iexpense","expense report","credit card"],
    "INV":      ["inventory","item","mtl_"],
}


class ICAWorkflowService:
    def detect_module(self, text: str) -> str:
        lower = text.lower()
        for module, keywords in MODULE_KEYWORDS.items():
            if any(kw in lower for kw in keywords):
                return module
        return "AP"

    def get_module_tables(self, module: str) -> list:
        return MODULE_TABLES.get(module, MODULE_TABLES["AP"])

    def get_module_reports(self, module: str) -> list:
        return MODULE_REPORTS.get(module, MODULE_REPORTS["AP"])

    def get_module_rules(self, module: str) -> list:
        return MODULE_RULES.get(module, MODULE_RULES["AP"])

    def get_rice_counts(self, module: str) -> dict:
        return RICE_COUNTS.get(module, {"R": 0, "I": 0, "C": 0, "E": 0})

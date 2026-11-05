# Data Dictionary — Oracle EBS Intelligence Hub

**Version:** 6.0 | **Oracle EBS:** R12.2.x | **Date:** 2026-11

This document describes every report in the portal: its business purpose, Oracle EBS source tables, column definitions, key SQL notes, and data quality considerations.

---

## Table of Contents

- [Module: Accounts Payable (AP)](#accounts-payable-ap)
- [Module: Purchasing (PO)](#purchasing-po)
- [Module: General Ledger (GL)](#general-ledger-gl)
- [Module: iExpense](#iexpense)
- [Module: HRMS](#hrms)
- [Module: Accounts Receivable (AR)](#accounts-receivable-ar)
- [Module: Inventory (INV)](#inventory-inv)
- [Core Oracle EBS Tables Reference](#core-oracle-ebs-tables-reference)
- [Multi-Org (MOAC) Rules](#multi-org-moac-rules)
- [DateTrack Tables Guide](#datetrack-tables-guide)

---

## Accounts Payable (AP)

### 1. Suppliers Report

**Report Key:** `suppliers_report`
**Business Purpose:** Lists all active Oracle EBS suppliers with their address, tax identifiers, and whether any purchasing holds are in place.

| Column | Source | Description |
|---|---|---|
| Vendor Number | AP_SUPPLIERS.SEGMENT1 | Unique supplier identifier in EBS |
| Vendor Name | AP_SUPPLIERS.VENDOR_NAME | Legal or trade name of the supplier |
| Vendor Type | AP_SUPPLIERS.VENDOR_TYPE_LOOKUP_CODE | VENDOR, EMPLOYEE, GOVERNMENT etc. |
| Tax Reg Number | AP_SUPPLIERS.NUM_1099 | Tax identification number (TIN/GSTIN) |
| City | AP_SUPPLIER_SITES_ALL.CITY | Primary site city |
| Country | AP_SUPPLIER_SITES_ALL.COUNTRY | ISO country code |
| Pay Group | AP_SUPPLIERS.PAY_GROUP_LOOKUP_CODE | Payment group for batch processing |
| Hold Flag | AP_SUPPLIERS.HOLD_ALL_PAYMENTS_FLAG | Y=all payments on hold |
| Enabled | AP_SUPPLIERS.ENABLED_FLAG | Y=active supplier |

**Key SQL Notes:**
- Filter `ENABLED_FLAG = 'Y'` for active suppliers only
- Join `AP_SUPPLIERS` to `AP_SUPPLIER_SITES_ALL` on `VENDOR_ID`; filter `AP_SUPPLIER_SITES_ALL.ORG_ID` for multi-org
- Tax number field varies by country: `NUM_1099` for US, `VAT_REGISTRATION_NUM` for EU

---

### 2. Suppliers High Payments (3 Years)

**Report Key:** `suppliers_high_payments_by_year`
**Business Purpose:** Ranks suppliers by total payment amount received over the last 3 fiscal years. Used for vendor audit, spend analysis, and renegotiation.

| Column | Source | Description |
|---|---|---|
| Vendor Name | AP_SUPPLIERS.VENDOR_NAME | Supplier name |
| Vendor Number | AP_SUPPLIERS.SEGMENT1 | Unique EBS vendor ID |
| Fiscal Year | Derived from AP_CHECKS_ALL.CHECK_DATE | FY2022, FY2023, FY2024 |
| Total Amount | SUM(AP_CHECKS_ALL.AMOUNT) | Total payments issued |
| Invoice Count | COUNT(DISTINCT AP_INVOICES_ALL.INVOICE_ID) | Number of invoices paid |
| Last Payment | MAX(AP_CHECKS_ALL.CHECK_DATE) | Most recent payment date |
| Payment Method | AP_CHECKS_ALL.PAYMENT_METHOD_LOOKUP_CODE | CHECK, EFT, WIRE etc. |

**Key SQL Notes:**
- GROUP BY VENDOR_ID with fiscal year bucketing using `TO_CHAR(check_date,'YYYY')` or fiscal period logic
- Exclude void checks: `AP_CHECKS_ALL.VOID_DATE IS NULL`
- Multi-org: filter `AP_CHECKS_ALL.ORG_ID = mo_global.get_current_org_id()`

---

### 3. Supplier Paid Invoice History

**Report Key:** `supplier_paid_invoice_history`
**Business Purpose:** Shows historical data of invoices fully or partially paid to specific suppliers. Key for reconciliation and dispute resolution.

| Column | Source | Description |
|---|---|---|
| Supplier Name | AP_SUPPLIERS.VENDOR_NAME | Supplier |
| Invoice Number | AP_INVOICES_ALL.INVOICE_NUM | Invoice reference |
| Invoice Date | AP_INVOICES_ALL.INVOICE_DATE | Invoice date |
| Invoice Amount | AP_INVOICES_ALL.INVOICE_AMOUNT | Original invoice value |
| Amount Paid | AP_INVOICE_PAYMENTS.AMOUNT | Amount paid on this payment |
| Payment Date | AP_CHECKS_ALL.CHECK_DATE | Date of payment |
| Check Number | AP_CHECKS_ALL.CHECK_NUMBER | Cheque/EFT reference |
| Payment Status | Derived | Fully Paid / Partially Paid |

**Key SQL Notes:**
- Join chain: `AP_SUPPLIERS` → `AP_INVOICES_ALL` → `AP_INVOICE_PAYMENTS` → `AP_CHECKS_ALL`
- Exclude cancelled invoices: `AP_INVOICES_ALL.CANCELLED_DATE IS NULL`
- Exclude void cheques: `AP_CHECKS_ALL.VOID_DATE IS NULL`

---

### 4. Aged Payables Detail

**Report Key:** `aged_payables_detail`
**Business Purpose:** Categorises outstanding supplier invoices into aging buckets to manage cash flow and identify overdue payments.

| Column | Source | Description |
|---|---|---|
| Supplier Name | AP_SUPPLIERS.VENDOR_NAME | Supplier |
| Invoice Number | AP_INVOICES_ALL.INVOICE_NUM | Invoice reference |
| Invoice Date | AP_INVOICES_ALL.INVOICE_DATE | Invoice creation date |
| Due Date | AP_PAYMENT_SCHEDULES_ALL.DUE_DATE | Payment due date |
| Amount Due Remaining | AP_PAYMENT_SCHEDULES_ALL.AMOUNT_REMAINING | Outstanding balance |
| Days Overdue | SYSDATE - DUE_DATE | Calculated field |
| Aging Bucket | Derived | 0-30, 31-60, 61-90, 91-120, 120+ |
| Currency | AP_INVOICES_ALL.INVOICE_CURRENCY_CODE | Invoice currency |

**Key SQL Notes:**
- Use `AP_PAYMENT_SCHEDULES_ALL` not `AP_INVOICES_ALL` for outstanding balance (handles partial payments correctly)
- `AMOUNT_REMAINING > 0` to exclude fully paid
- Multi-org: filter `AP_PAYMENT_SCHEDULES_ALL.ORG_ID`

---

### 5. AP Trial Balance

**Report Key:** `ap_trial_balance`
**Business Purpose:** Lists vendor open balances as of a specific date for financial period-end reconciliation.

| Column | Source | Description |
|---|---|---|
| Supplier Name | AP_SUPPLIERS.VENDOR_NAME | Supplier |
| Vendor Number | AP_SUPPLIERS.SEGMENT1 | EBS vendor ID |
| Open Balance | SUM(AP_PAYMENT_SCHEDULES_ALL.AMOUNT_REMAINING) | Total outstanding |
| Invoice Count | COUNT(DISTINCT INVOICE_ID) | Number of open invoices |
| Oldest Invoice | MIN(AP_INVOICES_ALL.INVOICE_DATE) | Earliest unpaid invoice |
| Operating Unit | HR_ALL_ORGANIZATION_UNITS.NAME | OU name |

---

### 6. Invoice Register

**Report Key:** `invoice_register`
**Business Purpose:** Details all AP invoices entered for a period. Used for audit, batch reconciliation, and period-end closing.

| Column | Source | Description |
|---|---|---|
| Batch Name | AP_BATCHES_ALL.BATCH_NAME | Batch reference |
| Invoice Number | AP_INVOICES_ALL.INVOICE_NUM | Invoice reference |
| Invoice Type | AP_INVOICES_ALL.INVOICE_TYPE_LOOKUP_CODE | STANDARD, CREDIT, DEBIT MEMO |
| Invoice Date | AP_INVOICES_ALL.INVOICE_DATE | Invoice date |
| Supplier Name | AP_SUPPLIERS.VENDOR_NAME | Supplier |
| Amount | AP_INVOICES_ALL.INVOICE_AMOUNT | Invoice amount |
| Tax Amount | AP_INVOICES_ALL.TOTAL_TAX_AMOUNT | Tax |
| Status | AP_INVOICES_ALL.APPROVAL_STATUS_LOOKUP_CODE | APPROVED, NEEDS REAPPROVAL |
| Created By | FND_USER.USER_NAME | Data entry user |

---

### 7. Withholding Tax by Supplier

**Report Key:** `withholding_tax`
**Business Purpose:** Shows withholding tax deducted from supplier payments for statutory tax compliance (1099/TDS/WHT reporting).

| Column | Source | Description |
|---|---|---|
| Supplier Name | AP_SUPPLIERS.VENDOR_NAME | Supplier |
| Tax Type | AP_AWT_TEMP.TAX_NAME | Withholding tax type |
| Invoice Number | AP_INVOICES_ALL.INVOICE_NUM | Source invoice |
| Tax Base Amount | AP_AWT_TEMP.TAX_BASE_AMOUNT | Amount subject to WHT |
| Tax Amount | AP_AWT_TEMP.TAX_AMOUNT | WHT deducted |
| Period | GL_PERIODS.PERIOD_NAME | Accounting period |

---

### 8. Supplier Audit Report

**Report Key:** `supplier_audit`
**Business Purpose:** Tracks changes made to supplier records including bank account changes, address changes, and payment term modifications.

| Column | Source | Description |
|---|---|---|
| Supplier Name | AP_SUPPLIERS.VENDOR_NAME | Supplier |
| Change Date | FND_AUDIT_COLUMN.LAST_UPDATE_DATE | When change was made |
| Changed By | FND_USER.USER_NAME | Who made the change |
| Field Changed | FND_AUDIT_COLUMN.COLUMN_NAME | Which field was modified |
| Old Value | FND_AUDIT_COLUMN.OLD_VALUE | Previous value |
| New Value | FND_AUDIT_COLUMN.NEW_VALUE | New value |

---

## Purchasing (PO)

### 9. Purchase Order Detail Report

**Report Key:** `po_detail`
**Business Purpose:** Comprehensive details for all purchase orders including items, quantities, pricing, and approval status.

| Column | Source | Description |
|---|---|---|
| PO Number | PO_HEADERS_ALL.SEGMENT1 | PO document number |
| PO Type | PO_HEADERS_ALL.TYPE_LOOKUP_CODE | STANDARD, BLANKET, CONTRACT |
| Supplier | AP_SUPPLIERS.VENDOR_NAME | Supplier name |
| PO Date | PO_HEADERS_ALL.CREATION_DATE | PO creation date |
| Line Number | PO_LINES_ALL.LINE_NUM | Line sequence |
| Item Description | PO_LINES_ALL.ITEM_DESCRIPTION | Item or service |
| Quantity Ordered | PO_LINE_LOCATIONS_ALL.QUANTITY | Qty on PO |
| Unit Price | PO_LINES_ALL.UNIT_PRICE | Price per unit |
| Line Amount | Derived | Qty × Unit Price |
| PO Status | PO_HEADERS_ALL.STATUS_LOOKUP_CODE | APPROVED, INCOMPLETE, etc. |
| Approved By | PO_HEADERS_ALL.APPROVED_BY | Approver person ID |

**Key SQL Notes:**
- Join: `PO_HEADERS_ALL` → `PO_LINES_ALL` → `PO_LINE_LOCATIONS_ALL`
- Filter `PO_HEADERS_ALL.ORG_ID` for multi-org
- `PO_HEADERS_ALL.CLOSED_CODE` excludes closed POs if needed

---

### 10. PO Distribution Detail

**Report Key:** `po_distribution_detail`
**Business Purpose:** Shows financial accounting distributions for PO lines, mapping procurement to GL charge accounts.

| Column | Source | Description |
|---|---|---|
| PO Number | PO_HEADERS_ALL.SEGMENT1 | PO reference |
| Distribution Number | PO_DISTRIBUTIONS_ALL.DISTRIBUTION_NUM | Distribution sequence |
| GL Account | GL_CODE_COMBINATIONS.CONCATENATED_SEGMENTS | Charge account segments |
| Quantity Ordered | PO_DISTRIBUTIONS_ALL.QUANTITY_ORDERED | Distribution qty |
| Amount Ordered | PO_DISTRIBUTIONS_ALL.AMOUNT_ORDERED | Distribution amount |
| Project | PA_PROJECTS_ALL.SEGMENT1 | Project number (if project-based) |
| Task | PA_TASKS.TASK_NUMBER | Task number |
| Accrue on Receipt | PO_DISTRIBUTIONS_ALL.ACCRUE_ON_RECEIPT_FLAG | Y/N |

---

### 11. Receipt Adjustments Report

**Report Key:** `receipt_adjustments`
**Business Purpose:** Lists receipts requiring adjustments, helping reconcile discrepancies between ordered and received goods.

| Column | Source | Description |
|---|---|---|
| Receipt Number | RCV_SHIPMENT_HEADERS.SHIPMENT_NUM | Receiving shipment number |
| Transaction Type | RCV_TRANSACTIONS.TRANSACTION_TYPE | RECEIVE, RETURN, CORRECT |
| Item | MTL_SYSTEM_ITEMS_B.SEGMENT1 | Item number |
| Quantity | RCV_TRANSACTIONS.QUANTITY | Transaction quantity |
| UOM | RCV_TRANSACTIONS.UNIT_OF_MEASURE | Unit of measure |
| Transaction Date | RCV_TRANSACTIONS.TRANSACTION_DATE | Date of transaction |
| PO Number | PO_HEADERS_ALL.SEGMENT1 | Source PO |

---

### 12. Savings Analysis Report

**Report Key:** `savings_analysis`
**Business Purpose:** Analyses procurement savings by buyer or category, comparing negotiated price to list price.

| Column | Source | Description |
|---|---|---|
| Buyer | PER_PEOPLE_F.FULL_NAME | Buying agent |
| Category | MTL_CATEGORIES_B.SEGMENT1 | Purchasing category |
| Item | PO_LINES_ALL.ITEM_DESCRIPTION | Item/service |
| List Price | PO_LINES_ALL.LIST_PRICE_PER_UNIT | Published list price |
| Negotiated Price | PO_LINES_ALL.UNIT_PRICE | Agreed PO price |
| Quantity | PO_LINE_LOCATIONS_ALL.QUANTITY | Ordered quantity |
| Savings Amount | (List - Negotiated) × Qty | Calculated savings |
| Savings % | Savings / List × 100 | Percentage saving |

---

## General Ledger (GL)

### 13. GL Journal Entries

**Report Key:** `gl_journals`
**Business Purpose:** Shows all general ledger journal entries for a period, by source and category.

| Column | Source | Description |
|---|---|---|
| Journal Name | GL_JE_HEADERS.NAME | Journal batch/header name |
| Period Name | GL_JE_HEADERS.PERIOD_NAME | Accounting period |
| Source | GL_JE_HEADERS.JE_SOURCE | AP, AR, PO, Manual, etc. |
| Category | GL_JE_HEADERS.JE_CATEGORY | Purchase, Payment, Accrual, etc. |
| Account | GL_CODE_COMBINATIONS.CONCATENATED_SEGMENTS | GL account string |
| Debit | GL_JE_LINES.ENTERED_DR | Debit amount |
| Credit | GL_JE_LINES.ENTERED_CR | Credit amount |
| Status | GL_JE_HEADERS.STATUS | Posted, Unposted |
| Created By | FND_USER.USER_NAME | Journal creator |

**Key SQL Notes:**
- Always filter by `LEDGER_ID` and `PERIOD_NAME`
- `GL_JE_LINES` can have 10M+ rows in large systems — always join to header first
- Posted only: `GL_JE_HEADERS.STATUS = 'P'`

---

### 14. GL Trial Balance

**Report Key:** `gl_trial_balance`
**Business Purpose:** Shows account balances for a specific period and ledger. Foundation for period-end financial statements.

| Column | Source | Description |
|---|---|---|
| Account | GL_CODE_COMBINATIONS.CONCATENATED_SEGMENTS | Full account string |
| Account Type | GL_CODE_COMBINATIONS.ACCOUNT_TYPE | A=Asset, L=Liability, O=OE, R=Revenue, E=Expense |
| Period Name | GL_BALANCES.PERIOD_NAME | Accounting period |
| Begin Balance DR | GL_BALANCES.BEGIN_BALANCE_DR | Opening debit balance |
| Begin Balance CR | GL_BALANCES.BEGIN_BALANCE_CR | Opening credit balance |
| Period Net DR | GL_BALANCES.PERIOD_NET_DR | Period debit activity |
| Period Net CR | GL_BALANCES.PERIOD_NET_CR | Period credit activity |
| End Balance DR | GL_BALANCES.END_BALANCE_DR | Closing debit balance |
| End Balance CR | GL_BALANCES.END_BALANCE_CR | Closing credit balance |

**Key SQL Notes:**
- Filter: `GL_BALANCES.TRANSLATED_FLAG IS NULL` for actual (non-translated) balances
- Filter: `GL_BALANCES.CURRENCY_CODE = :p_currency` for single currency view
- `GL_CODE_COMBINATIONS.SUMMARY_FLAG = 'N'` for detail accounts only

---

### 15. Account Analysis

**Report Key:** `gl_account_analysis`
**Business Purpose:** Detailed line-level GL activity for a specific account range and period.

| Column | Source | Description |
|---|---|---|
| Period | GL_JE_HEADERS.PERIOD_NAME | Accounting period |
| Account | GL_CODE_COMBINATIONS.CONCATENATED_SEGMENTS | Account string |
| Journal Name | GL_JE_HEADERS.NAME | Journal name |
| Source | GL_JE_HEADERS.JE_SOURCE | Journal source |
| Line Description | GL_JE_LINES.DESCRIPTION | Line narrative |
| Debit | GL_JE_LINES.ENTERED_DR | Debit |
| Credit | GL_JE_LINES.ENTERED_CR | Credit |
| Running Balance | Analytical (SUM OVER) | Cumulative balance |

---

## iExpense

### 16. iExpense Detail Report

**Report Key:** `iexpense_detail`
**Business Purpose:** Full detail of all submitted employee expense reports with approval status, amounts, and expense category breakdown.

| Column | Source | Description |
|---|---|---|
| Employee Number | PER_PEOPLE_F.EMPLOYEE_NUMBER | Employee ID |
| Employee Name | PER_PEOPLE_F.FULL_NAME | Employee full name |
| Report Number | AP_EXPENSE_REPORT_HEADERS_ALL.REPORT_HEADER_ID | Expense report ID |
| Week End Date | AP_EXPENSE_REPORT_HEADERS_ALL.WEEK_END_DATE | Report period end date |
| Total Amount | AP_EXPENSE_REPORT_HEADERS_ALL.TOTAL | Report total |
| Approval Status | AP_EXPENSE_REPORT_HEADERS_ALL.WORKFLOW_APPROVED_FLAG | A=Approved, N=Not approved |
| Expense Type | AP_EXPENSE_REPORT_LINES_ALL.WEB_PARAMETER_ID | Category (Meals, Travel, etc.) |
| Line Amount | AP_EXPENSE_REPORT_LINES_ALL.AMOUNT | Line item amount |
| Receipt Required | AP_EXPENSE_REPORT_LINES_ALL.RECEIPT_REQUIRED_FLAG | Y/N |
| Operating Unit | HR_ALL_ORGANIZATION_UNITS.NAME | OU name |

**Key SQL Notes:**
- Filter: `AP_EXPENSE_REPORT_HEADERS_ALL.SOURCE IN ('Both','NonValidatedWebExpense')` for iExpense only
- Filter: `AP_EXPENSE_REPORT_HEADERS_ALL.ORG_ID` for multi-org
- Date-effective: `PER_PEOPLE_F`: filter `SYSDATE BETWEEN EFFECTIVE_START_DATE AND EFFECTIVE_END_DATE`

---

### 17. Credit Card Report

**Report Key:** `credit_card_report`
**Business Purpose:** Shows all corporate credit card transactions with their match status to expense reports.

| Column | Source | Description |
|---|---|---|
| Cardholder | PER_PEOPLE_F.FULL_NAME | Employee name |
| Card Number (masked) | AP_CREDIT_CARD_TRXNS_ALL.CARD_NUMBER | Last 4 digits |
| Transaction Date | AP_CREDIT_CARD_TRXNS_ALL.TRANSACTION_DATE | Card swipe date |
| Merchant | AP_CREDIT_CARD_TRXNS_ALL.MERCHANT_NAME | Merchant/vendor |
| Category | AP_CREDIT_CARD_TRXNS_ALL.CATEGORY | MCC category |
| Amount | AP_CREDIT_CARD_TRXNS_ALL.TRANSACTION_AMOUNT | Transaction amount |
| Match Status | AP_CREDIT_CARD_TRXNS_ALL.MATCH_STATUS_FLAG | Matched/Unmatched/Disputed |
| Expense Report | AP_EXPENSE_REPORT_HEADERS_ALL.REPORT_HEADER_ID | Linked expense report |

**Key SQL Notes:**
- `MATCH_STATUS_FLAG = 'N'` for unmatched transactions requiring attention
- Join to `AP_CREDIT_CARD_ACCOUNTS` on `ACCOUNT_SEGMENT_VALUE`

---

### 18. Workflow & Approvals

**Report Key:** `workflow_approvals`
**Business Purpose:** Shows iExpense workflow approval status, current approver, pending notifications, and approval cycle times.

| Column | Source | Description |
|---|---|---|
| Report Number | AP_EXPENSE_REPORT_HEADERS_ALL.REPORT_HEADER_ID | Expense report |
| Submitter | PER_PEOPLE_F.FULL_NAME | Employee who submitted |
| Submission Date | WF_ITEM_ACTIVITY_STATUSES.BEGIN_DATE | When submitted |
| Current Approver | WF_NOTIFICATIONS.TO_USER | Pending with |
| Approval Level | WF_ITEM_ATTRIBUTE_VALUES.TEXT_VALUE | Level 1/2/3 |
| Status | WF_ITEM_ACTIVITY_STATUSES.ACTIVITY_STATUS | ACTIVE, COMPLETE, ERROR |
| Days Pending | SYSDATE - Submission Date | Calculated |
| Amount | AP_EXPENSE_REPORT_HEADERS_ALL.TOTAL | Report total |

---

## HRMS

### 19. Active Employees

**Report Key:** `active_employees`
**Business Purpose:** Complete list of currently active employees with job, department, supervisor, and cost allocation.

| Column | Source | Description |
|---|---|---|
| Employee Number | PER_PEOPLE_F.EMPLOYEE_NUMBER | Employee ID |
| Full Name | PER_PEOPLE_F.FULL_NAME | Legal name |
| Job Title | PER_JOBS.NAME | Job name |
| Department | HR_ALL_ORGANIZATION_UNITS.NAME | Department |
| Grade | PER_GRADES.NAME | Pay grade |
| Supervisor | PER_PEOPLE_F.FULL_NAME (self-join) | Manager name |
| Location | HR_LOCATIONS_ALL.LOCATION_CODE | Work location |
| Hire Date | PER_PERIODS_OF_SERVICE.DATE_START | Original hire date |
| Employment Type | PER_ASSIGNMENTS_F.EMPLOYMENT_CATEGORY | FULL_TIME, PART_TIME, CONTRACTOR |

**Key SQL Notes:**
- `PER_PEOPLE_F`: filter `SYSDATE BETWEEN EFFECTIVE_START_DATE AND EFFECTIVE_END_DATE`
- `PER_ASSIGNMENTS_F`: filter `PRIMARY_FLAG = 'Y'` AND date range
- `PER_PERIODS_OF_SERVICE.DATE_END IS NULL` for active employees
- `PER_ASSIGNMENTS_F.ASSIGNMENT_STATUS_TYPE_ID` linked to `PER_ASSIGNMENT_STATUS_TYPES.PER_SYSTEM_STATUS = 'ACTIVE_ASSIGN'`

---

### 20. Terminated Employees

**Report Key:** `terminated_employees`
**Business Purpose:** Employees who left in the last 12 months with termination reason, final salary, and last working day.

| Column | Source | Description |
|---|---|---|
| Employee Number | PER_PEOPLE_F.EMPLOYEE_NUMBER | Employee ID |
| Full Name | PER_PEOPLE_F.FULL_NAME | Name |
| Termination Date | PER_PERIODS_OF_SERVICE.ACTUAL_TERMINATION_DATE | Last day |
| Termination Reason | PER_LEAVING_REASONS.MEANING | Resignation, Redundancy, etc. |
| Final Salary | PER_PAY_PROPOSALS.PROPOSED_SALARY_N | Last base salary |
| Department | HR_ALL_ORGANIZATION_UNITS.NAME | Last department |
| Manager | PER_PEOPLE_F.FULL_NAME (supervisor join) | Last manager |

---

### 21. Supervisor Details

**Report Key:** `supervisor_details`
**Business Purpose:** Management hierarchy showing each employee with their direct supervisor chain.

| Column | Source | Description |
|---|---|---|
| Employee Name | PER_PEOPLE_F.FULL_NAME | Employee |
| Employee Number | PER_PEOPLE_F.EMPLOYEE_NUMBER | ID |
| Supervisor Name | PER_PEOPLE_F.FULL_NAME (self-join) | Direct manager |
| Supervisor Number | PER_PEOPLE_F.EMPLOYEE_NUMBER | Manager ID |
| Department | HR_ALL_ORGANIZATION_UNITS.NAME | Department |
| Direct Reports Count | COUNT(sub-query) | Number of direct reports |
| Job Level | PER_JOBS.NAME | Job title |

---

### 22. Expense Cost Allocation

**Report Key:** `expense_cost_allocation`
**Business Purpose:** Maps employee expenses to GL accounting segments for cost centre reporting.

| Column | Source | Description |
|---|---|---|
| Employee Name | PER_PEOPLE_F.FULL_NAME | Employee |
| GL Account | GL_CODE_COMBINATIONS.CONCATENATED_SEGMENTS | Full account string |
| Cost Centre | GL_CODE_COMBINATIONS.SEGMENT2 | Cost centre code |
| Fund | GL_CODE_COMBINATIONS.SEGMENT1 | Fund/Entity |
| Expense Category | AP_EXPENSE_REPORT_LINES_ALL.WEB_PARAMETER_ID | Expense type |
| Amount | AP_EXPENSE_REPORT_LINES_ALL.AMOUNT | Line amount |
| Period | TO_CHAR(WEEK_END_DATE,'MON-YYYY') | Period |
| Project | PA_PROJECTS_ALL.SEGMENT1 | Project (if applicable) |

---

## Accounts Receivable (AR)

### 23. AR Aging Report

**Report Key:** `ar_aging`
**Business Purpose:** Customer outstanding balances categorised by aging bucket for collections management.

| Column | Source | Description |
|---|---|---|
| Customer Name | HZ_PARTIES.PARTY_NAME | Customer legal name |
| Customer Number | HZ_CUST_ACCOUNTS.ACCOUNT_NUMBER | AR customer number |
| Invoice Number | AR_PAYMENT_SCHEDULES_ALL.TRX_NUMBER | Transaction number |
| Invoice Date | AR_PAYMENT_SCHEDULES_ALL.TRX_DATE | Invoice date |
| Due Date | AR_PAYMENT_SCHEDULES_ALL.DUE_DATE | Payment due date |
| Amount Due | AR_PAYMENT_SCHEDULES_ALL.AMOUNT_DUE_REMAINING | Outstanding |
| Aging Bucket | Derived | 0-30, 31-60, 61-90, 91-120, 120+ |
| Collector | AR_COLLECTORS.NAME | Assigned collections agent |

---

### 24. Customer Statement

**Report Key:** `customer_statement`
**Business Purpose:** Detailed statement of all transactions for a customer over a period.

| Column | Source | Description |
|---|---|---|
| Customer | HZ_PARTIES.PARTY_NAME | Customer |
| Transaction Type | RA_CUST_TRX_TYPES_ALL.NAME | Invoice, Credit Memo, Debit Memo |
| Transaction Number | RA_CUSTOMER_TRX_ALL.TRX_NUMBER | Document number |
| Transaction Date | RA_CUSTOMER_TRX_ALL.TRX_DATE | Date |
| Amount | RA_CUSTOMER_TRX_ALL.INVOICE_CURRENCY_CODE + amounts | Amount |
| Payment Applied | AR_RECEIVABLE_APPLICATIONS_ALL.AMOUNT_APPLIED | Payment received |
| Balance | AR_PAYMENT_SCHEDULES_ALL.AMOUNT_DUE_REMAINING | Outstanding |

---

## Inventory (INV)

### 25. Inventory Valuation

**Report Key:** `inventory_valuation`
**Business Purpose:** On-hand inventory quantities and values by item and organisation for financial reporting.

| Column | Source | Description |
|---|---|---|
| Item Number | MTL_SYSTEM_ITEMS_B.SEGMENT1 | Item code |
| Item Description | MTL_SYSTEM_ITEMS_B.DESCRIPTION | Item description |
| Organisation | ORG_ORGANIZATION_DEFINITIONS.ORGANIZATION_NAME | Inventory org |
| Subinventory | MTL_ONHAND_QUANTITIES_DETAIL.SUBINVENTORY_CODE | Storage location |
| Quantity On Hand | SUM(MTL_ONHAND_QUANTITIES_DETAIL.PRIMARY_TRANSACTION_QUANTITY) | Units on hand |
| Unit Cost | CST_ITEM_COSTS.ITEM_COST | Standard/Average cost per unit |
| Total Value | Qty × Unit Cost | Total inventory value |
| Category | MTL_ITEM_CATEGORIES.CATEGORY_ID | Item category |

---

## Core Oracle EBS Tables Reference

| Table | Module | Est. Rows | Primary Key | Key Indexes | Multi-Org |
|---|---|---|---|---|---|
| AP_SUPPLIERS | AP | 50K | VENDOR_ID | VENDOR_NAME, SEGMENT1 | No |
| AP_INVOICES_ALL | AP | 5M+ | INVOICE_ID | VENDOR_ID, INVOICE_DATE, ORG_ID | Yes |
| AP_INVOICE_PAYMENTS | AP | 5M+ | INVOICE_PAYMENT_ID | INVOICE_ID, CHECK_ID | No |
| AP_CHECKS_ALL | AP | 2M+ | CHECK_ID | VENDOR_ID, CHECK_DATE, ORG_ID | Yes |
| AP_PAYMENT_SCHEDULES_ALL | AP | 6M+ | PAYMENT_SCHEDULE_ID | INVOICE_ID, DUE_DATE | Yes |
| AP_EXPENSE_REPORT_HEADERS_ALL | iExp | 500K | REPORT_HEADER_ID | EMPLOYEE_ID, ORG_ID | Yes |
| AP_EXPENSE_REPORT_LINES_ALL | iExp | 2M+ | REPORT_LINE_ID | REPORT_HEADER_ID | No |
| AP_CREDIT_CARD_TRXNS_ALL | iExp | 300K | TRX_ID | CARD_NUMBER, TRX_DATE | No |
| PO_HEADERS_ALL | PO | 1M+ | PO_HEADER_ID | SEGMENT1, VENDOR_ID, ORG_ID | Yes |
| PO_LINES_ALL | PO | 3M+ | PO_LINE_ID | PO_HEADER_ID, ITEM_ID | No |
| PO_DISTRIBUTIONS_ALL | PO | 4M+ | PO_DISTRIBUTION_ID | PO_HEADER_ID, CODE_COMBINATION_ID | No |
| RCV_SHIPMENT_HEADERS | PO | 500K | SHIPMENT_HEADER_ID | RECEIPT_NUM, VENDOR_ID | No |
| RCV_TRANSACTIONS | PO | 2M+ | TRANSACTION_ID | SHIPMENT_HEADER_ID | No |
| GL_JE_HEADERS | GL | 1M+ | JE_HEADER_ID | LEDGER_ID, PERIOD_NAME, STATUS | No |
| GL_JE_LINES | GL | 10M+ | JE_LINE_NUM | JE_HEADER_ID, CODE_COMBINATION_ID | No |
| GL_CODE_COMBINATIONS | GL | 100K | CODE_COMBINATION_ID | CONCATENATED_SEGMENTS | No |
| GL_BALANCES | GL | 5M+ | (LEDGER_ID,CODE_COMB_ID,CURRENCY,PERIOD) | LEDGER_ID, PERIOD_NAME | No |
| PER_PEOPLE_F | HR | 200K | PERSON_ID | EMPLOYEE_NUMBER, FULL_NAME | No |
| PER_ASSIGNMENTS_F | HR | 300K | ASSIGNMENT_ID | PERSON_ID, SUPERVISOR_ID | No |
| PER_PERIODS_OF_SERVICE | HR | 200K | PERIOD_OF_SERVICE_ID | PERSON_ID | No |
| HR_ALL_ORGANIZATION_UNITS | HR | 1K | ORGANIZATION_ID | NAME | No |
| AR_PAYMENT_SCHEDULES_ALL | AR | 3M+ | PAYMENT_SCHEDULE_ID | CUSTOMER_ID, DUE_DATE, ORG_ID | Yes |
| RA_CUSTOMER_TRX_ALL | AR | 2M+ | CUSTOMER_TRX_ID | TRX_NUMBER, BILL_TO_CUSTOMER_ID | Yes |
| HZ_PARTIES | AR | 300K | PARTY_ID | PARTY_NAME, PARTY_TYPE | No |
| MTL_SYSTEM_ITEMS_B | INV | 100K | (INVENTORY_ITEM_ID, ORGANIZATION_ID) | SEGMENT1 | No |
| MTL_ONHAND_QUANTITIES_DETAIL | INV | 1M+ | (ITEM_ID, ORG_ID, SUBINV) | ORGANIZATION_ID | No |

---

## Multi-Org (MOAC) Rules

Tables ending in `_ALL` are multi-org. **Always** filter by `ORG_ID`:

```sql
-- Correct multi-org filter
WHERE apia.org_id = mo_global.get_current_org_id()

-- Or explicit ORG_ID parameter
WHERE apia.org_id = :p_org_id

-- Never query _ALL table without ORG_ID
-- WRONG: SELECT * FROM ap_invoices_all  -- returns ALL orgs data!
```

**Multi-org tables in this portal:**
`AP_INVOICES_ALL`, `AP_CHECKS_ALL`, `AP_PAYMENT_SCHEDULES_ALL`, `AP_EXPENSE_REPORT_HEADERS_ALL`, `PO_HEADERS_ALL`, `AR_PAYMENT_SCHEDULES_ALL`, `RA_CUSTOMER_TRX_ALL`

---

## DateTrack Tables Guide

Oracle HR stores a complete history of every change as new rows with effective date ranges:

```sql
-- WRONG: Returns all historical rows for every employee
SELECT ppf.full_name
FROM   per_people_f ppf
WHERE  ppf.employee_number = :p_emp;

-- CORRECT: Returns only current record
SELECT ppf.full_name
FROM   per_people_f ppf
WHERE  ppf.employee_number = :p_emp
AND    SYSDATE BETWEEN ppf.effective_start_date
                   AND ppf.effective_end_date;
```

**DateTrack tables:** `PER_PEOPLE_F`, `PER_ASSIGNMENTS_F`, `PER_JOBS`, `PER_GRADES`, `PER_POSITIONS`, `PER_PAY_PROPOSALS`

---

*Data Dictionary v6.0 | Oracle EBS Intelligence Hub | IBM BOB + ICA Context Studio*

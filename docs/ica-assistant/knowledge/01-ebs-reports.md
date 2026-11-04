# Tab 1: EBS Reports — Knowledge Document

## Overview

The EBS Reports tab provides 26 pre-built Oracle EBS report templates across 7 modules.
Reports use demo data (randomly generated) but the structure, fields, and filters match
real Oracle EBS R12 production reports exactly.

Users can:
- Filter reports by module, date range, keyword, status
- View data in a data grid with sorting and column reordering
- Export to Excel (.xlsx) or PDF
- Push real data via Data Connect (Excel import)
- View charts (bar, line, pie, doughnut) inline

## The 26 Reports by Module

### AP — Accounts Payable (5 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| AP Invoice Summary | All supplier invoices with status | Vendor, Invoice#, Amount, Due Date, Status, PO# |
| AP Aging Report | Invoices grouped by age buckets | 0-30, 31-60, 61-90, 90+ days overdue |
| AP Payment Register | Payments made in period | Payment Date, Check#, Bank, Amount, Vendor |
| AP Vendor Balance | Outstanding balance per vendor | Vendor Name, Total Invoiced, Paid, Outstanding |
| AP Hold Analysis | Invoices on hold | Hold Reason, Hold Date, Approver, Amount |

### AR — Accounts Receivable (4 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| AR Customer Statement | Customer account statement | Customer, Invoice#, Due Date, Amount, Balance |
| AR Aging Analysis | Receivables aged by bucket | 0-30, 31-60, 61-90, 91+ days |
| AR Receipt Register | Cash receipts for period | Receipt Date, Amount, Customer, Bank, Applied |
| AR Unapplied Receipts | Receipts not matched to invoice | Receipt#, Amount, Customer, Date Received |

### GL — General Ledger (4 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| GL Trial Balance | All accounts with debit/credit | Account Code, Account Name, Dr, Cr, Net Balance |
| GL Journal Entry Summary | Journal entries for period | Journal Name, Source, Category, Period, Amount |
| GL Account Analysis | Transactions per account | Account, Period, Description, Dr, Cr, Running Balance |
| GL Budget vs Actual | Budget vs actual by cost centre | Cost Centre, Budget, Actual, Variance, % |

### PO — Purchasing (4 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| PO Status Report | All POs and their status | PO#, Supplier, Status, Ordered, Received, Billed |
| PO Receipt Accruals | Goods received, not invoiced (GRNI) | PO#, Item, Qty Received, Qty Billed, Accrual Amt |
| PO Spend Analysis | Spend by supplier / category | Category, Supplier, Spend, Orders, Avg Order Value |
| PO Approval Workflow | POs pending approval | PO#, Requestor, Approver, Amount, Days Pending |

### HRMS — Human Resources (4 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| HRMS Headcount Report | Employee count by department | Department, Grade, Location, FTE, Headcount |
| HRMS Payroll Summary | Payroll totals by period | Period, Gross, Tax, NI, Net, Dept, Grade |
| HRMS Absence Analysis | Leave taken vs entitlement | Employee, Leave Type, Days Taken, Days Remaining |
| HRMS Org Chart Data | Org structure data | Employee, Manager, Dept, Grade, Location |

### INV — Inventory (3 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| INV Stock Levels | Current stock on hand | Item, Warehouse, On Hand, Reserved, Available |
| INV Transaction History | All inventory movements | Date, Item, Transaction Type, Qty, Value |
| INV Valuation Report | Inventory value by method | Item, Valuation Method, Unit Cost, Total Value |

### iExpense — Employee Expenses (2 reports)
| Report Name | Description | Key Fields |
|---|---|---|
| iExpense Aging Report | Expense reports by age | Employee, Expense Report#, Submitted, Days Open, Amount |
| iExpense Summary | All expense reports for period | Employee, Type, Amount, Status, Approver |

## Filter Options Available on All Reports

- **Date Range:** Start / End date picker
- **Module:** Filter to show only one Oracle module
- **Keyword:** Search across all text fields
- **Status:** Filter by Open, Approved, Rejected, On Hold, Paid, etc.
- **Year:** Quick filter by financial year

## Export Capabilities

- **Excel Export:** Downloads full dataset as .xlsx, preserves all columns
- **PDF Export:** Browser print-to-PDF with formatted layout
- **Copy to Clipboard:** Tab-separated for pasting into other tools

## Data Connect Integration

Reports support importing real data via:
1. **Excel Upload:** Upload your own .xlsx file → column mapping wizard → data populates report
2. **DB Simulation:** Generates realistic Oracle EBS-style data programmatically
3. **Live DB Proxy:** Connect to a real Oracle DB via backend proxy (requires DBA setup)

## Common User Questions & Answers

**Q: How do I filter the AP Invoice Summary by date?**
A: Use the Date Range filter at the top of the report. Set Start Date and End Date.

**Q: Can I export to Excel?**
A: Yes. Click the Excel Export button (green icon) above the report grid.

**Q: The data looks like test data. How do I use real data?**
A: Use the Data Connect tab. Upload your Excel file from Oracle EBS or connect via DB proxy.

**Q: Why can't I see SQL Advisor?**
A: SQL Advisor is only visible to Technical role users. Log in with Technical credentials.

**Q: How many reports are there?**
A: 26 report templates across AP, AR, GL, PO, HRMS, INV, and iExpense modules.

**Q: Can I add a new report template?**
A: Yes — add the report definition in ebs-reports-data.js following the existing pattern.

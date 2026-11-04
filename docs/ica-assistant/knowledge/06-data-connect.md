# Tab 6: Data Connect — Knowledge Document

## Overview

Data Connect lets users bring **real data** into the EBS Reports portal without direct
database access. It has three modes:

1. **Excel / CSV Upload** — Upload a file exported from Oracle EBS, map columns, push to reports
2. **DB Simulation** — Generate realistic Oracle EBS-style test data locally (no DB needed)
3. **Live DB Proxy** — Connect to a real Oracle DB via the FastAPI backend (DBA setup required)

Data Connect is available to **both Employee and Technical roles**.

---

## Mode 1: Excel / CSV Upload

### What It Does
Upload any Excel (.xlsx) or CSV file. The column mapping wizard matches your file's
column headers to the report's expected columns. Once mapped, your data replaces the
demo data in the selected report.

### Supported File Formats
- `.xlsx` — Microsoft Excel (all versions)
- `.csv` — Comma-separated values
- `.tsv` — Tab-separated values (rename to .csv before uploading)

### Column Mapping Wizard

The wizard shows:
- **Left column:** Your file's column headers
- **Right column:** Report's expected column names
- **Auto-match:** Headers that match exactly are auto-mapped (shown in green)
- **Manual match:** Remaining headers — select from dropdown
- **Ignore:** Columns in your file not needed by the report — mark as Ignore

### Supported Data Types in Mapping
| Type | Formats Accepted |
|---|---|
| Date | DD-MON-YYYY, MM/DD/YYYY, YYYY-MM-DD, Excel serial dates |
| Currency | With or without £/$/€ symbol, with or without comma separators |
| Number | Integer or decimal, positive or negative |
| Text | Any string value |
| Status | Maps to predefined status values (Open, Paid, Approved, etc.) |

### Step-by-Step: Excel Upload
1. Click **Data Connect** tab
2. Select **Excel Upload**
3. Click **Choose File** → select your .xlsx or .csv file
4. Select which **report** you want to push data to
5. Review the **Column Mapping** table — fix any unmatched columns
6. Click **Preview** — see first 10 rows of mapped data
7. Click **Apply to Report** — your data now shows in the selected report

---

## Mode 2: DB Simulation

### What It Does
Generates realistic Oracle EBS-style data programmatically using the browser's
random number generator. The data structure exactly matches what a real Oracle EBS
database would return — correct column names, realistic values, correct date formats.

### Use Cases
- Demo environment with no database access
- Training sessions for new team members
- Testing report filters and export features
- Demonstrating the portal to clients before live data is available

### Simulation Parameters
Users can configure:
- **Number of rows:** 10 to 1,000 rows
- **Date range:** Start and end date for simulated data
- **Operating Unit:** CCP, CCH, CCF, or custom OU ID
- **Module:** AP, AR, GL, PO, HRMS, INV, iExpense
- **Status distribution:** % Open / % Paid / % On Hold (for AP/AR reports)

---

## Mode 3: Live DB Proxy

### What It Does
Sends a query to the FastAPI backend (`localhost:8000/api/query`), which forwards it
to a real Oracle database and returns results. Requires DBA to configure a read-only
Oracle connection in `backend/.env`.

### Configuration (DBA Setup)
Add to `backend/.env`:
```
ORACLE_DSN=hostname:1521/EBSPROD
ORACLE_USER=apps_readonly
ORACLE_PASSWORD=your_password
```

### Security Note
- The backend only accepts pre-approved queries from a whitelist
- No raw SQL from the client is forwarded to Oracle — only named query IDs
- Connection uses a read-only Oracle user (no DML permissions)
- SSL/TLS enforced for database connection

### Supported Live Query Types
| Query ID | Returns |
|---|---|
| `ap_invoices_summary` | AP invoices for org_id + date range |
| `ar_aging` | AR customer balances and aging |
| `gl_trial_balance` | GL balances for a period |
| `po_open_status` | Open POs not fully received/invoiced |
| `hrms_headcount` | Employee headcount by dept |

---

## Common User Questions & Answers

**Q: My Excel file has different column headers — will it still work?**
A: Yes. The column mapping wizard handles any header names. Map them manually using the dropdown.

**Q: How many rows can I upload?**
A: Up to 50,000 rows per upload. Larger files should be split or use Live DB Proxy instead.

**Q: Does Data Connect send my file to any server?**
A: No. Excel parsing happens entirely in your browser using SheetJS. No data leaves your machine.

**Q: Can I push data to multiple reports from one upload?**
A: Yes — use the "Apply to Multiple Reports" toggle and select which reports to update.

**Q: What happens to my uploaded data when I refresh the page?**
A: It is cleared (stored only in browser memory). Re-upload after a page refresh.

**Q: How do I export from Oracle EBS to use with Excel Upload?**
A: In Oracle EBS, run the relevant standard report and export to Excel. For most reports:
   Navigate to the report → Run → Output Format: Excel → Download → Upload here.

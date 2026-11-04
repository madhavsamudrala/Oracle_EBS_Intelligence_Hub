# Tab 3: Document Generator — Knowledge Document

## Overview

The Document Generator automatically produces two types of Oracle EBS delivery documents:

1. **TDD — Technical Design Document** (also called Technical Document or Tech Spec)
2. **FDD — Functional Design Document** (also called Functional Spec or Business Spec)

These match the **CCG (Cook County Government) EBS document templates** used on the AMS
engagement. A document that used to take 3–4 hours to write manually is generated in
**under 2 minutes** by entering just the report name and a brief description.

---

## TDD — Technical Design Document

### What It Contains (Auto-Generated Sections)

| Section | Content |
|---|---|
| 1. Document Header | Report name, version, date, author (from input), CCG template ref |
| 2. Purpose & Scope | What the report does, which Oracle module, who uses it |
| 3. Technical Architecture | File: HTML/JS SPA, Backend: FastAPI, AI: ICA MCP |
| 4. Database Objects | Tables/views accessed (AP, AR, GL, PO, HRMS, INV, iExpense) |
| 5. SQL Design | Sample SQL with EBS R12 join patterns, Multi-Org filter, bind variables |
| 6. Data Flow Diagram | Auto-generated SVG flowchart showing: User → Portal → Oracle DB → Report |
| 7. Column Mapping | Source DB column → Display label → Data type → Format |
| 8. Parameters & Filters | All filter parameters with type, required/optional, default values |
| 9. Performance Considerations | Index hints, ROWNUM limits, org_id filters |
| 10. Security | Role-based access, DASC compliance notes |
| 11. Error Handling | Null handling, date format errors, empty result sets |
| 12. Test Cases | 5 auto-generated test cases per report (populated/empty/filter/export/print) |
| 13. Deployment Notes | Steps to deploy the portal update |
| 14. Sign-off Table | Developer, Reviewer, Tech Lead, Client sign-off fields |

### CCG Document Template Reference

The TDD matches the official Cook County template:
```
File: CCG-DO080-REP-XXX-XXX-Technical_Document.doc
Location: docs/templates/
Naming convention: CCG-DO080-REP-{MODULE}-{SEQUENCE}-Technical_Document
```

---

## FDD — Functional Design Document

### What It Contains (Auto-Generated Sections)

| Section | Content |
|---|---|
| 1. Document Header | Report name, version, date, business owner, CCG template ref |
| 2. Business Purpose | Why this report is needed, business process it supports |
| 3. User Stories | 3–5 auto-generated user stories in "As a [role] I want to..." format |
| 4. Functional Requirements | Numbered list of what the report must do |
| 5. Report Layout Mockup | ASCII art table showing column headers and sample data rows |
| 6. Filter Specification | Each filter: label, type, required/optional, validation rules |
| 7. Business Rules | Key EBS business rules relevant to the module (AP: 3-way match, etc.) |
| 8. Data Sources | Which Oracle EBS tables/modules the data comes from |
| 9. Exception Handling | What happens for no data, invalid dates, missing org_id |
| 10. Acceptance Criteria | List of conditions for UAT sign-off |
| 11. Change History | Version table (auto-populated with v1.0 initial entry) |
| 12. Sign-off Table | Business Owner, Functional Lead, Client sign-off fields |

### CCG Document Template Reference

The FDD matches the official Cook County functional template:
```
File: CCG ERP FS REP-XXX-XXX-Functional_Document.doc
Location: docs/templates/
Naming convention: CCG-FS-REP-{MODULE}-{SEQUENCE}-Functional_Document
```

---

## SVG Diagram Generation

The Doc Generator produces an inline SVG data flow diagram showing:

```
[User Browser] → [Oracle EBS Portal] → [ICA Context Studio]
                        ↓
                 [FastAPI Backend]
                        ↓
               [Oracle EBS Database]
                        ↓
    [AP Tables] [AR Tables] [GL Tables] [PO Tables] [HRMS] [INV] [iExpense]
                        ↓
              [Report Data Layer]
                        ↓
            [HTML Report Grid + Charts]
                        ↓
           [Excel Export / PDF Export]
```

The SVG is embedded directly in the downloaded HTML document and is fully editable.

---

## How to Use the Doc Generator

1. Open the **Doc Generator** tab (Technical role only)
2. Select **document type**: TDD or FDD
3. Select the **report name** from the dropdown (all 26 reports available)
4. Optionally enter the **author name** and **date**
5. Click **Generate Document**
6. Document appears in the viewer — review, edit inline if needed
7. Click **Download as HTML** or **Download as Word** to save

---

## Time Savings on AMS Engagement

| Task | Before Doc Generator | With Doc Generator |
|---|---|---|
| TDD for a new report | 3–4 hours | Under 2 minutes |
| FDD for a new report | 2–3 hours | Under 90 seconds |
| SVG diagram creation | 1–2 hours (Visio/Draw.io) | Instant (auto-generated) |
| Template compliance check | 30 minutes | Instant (template built-in) |

---

## Common User Questions & Answers

**Q: Can I edit the generated document?**
A: Yes — the document renders in an editable viewer. All sections are editable before download.

**Q: Does it create a real Word .docx file?**
A: It downloads as a formatted HTML file that opens correctly in Microsoft Word.

**Q: Does it follow the CCG template?**
A: Yes — the structure and section headings match the official CCG ERP document templates.

**Q: Can I generate a doc for a report that isn't in the list?**
A: Type the report name manually in the text field. The generator will produce a generic template.

**Q: Why is Doc Generator not visible?**
A: It is Technical role only. Log in with Technical credentials to see it.

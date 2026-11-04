# Document Templates — Oracle EBS CCG Standard

## What Are These Files?

This folder contains the **CCG-standard Word document templates** used as the reference format for the Document Generator (Tab 4 of the portal).

| File | Document Type | When to Use |
|---|---|---|
| `CCG-DO080-REP-XXX-XXX-Technical_Document.doc` | Technical Design Document (TDD) | For documenting Oracle EBS concurrent programs, reports, interfaces, conversions, and extensions |
| `CCG ERP FS REP-XXX-XXX-Functional_Document.doc` | Functional Specification Document (FSD) | For documenting business requirements, functional flows, and user acceptance criteria |

---

## How the Document Generator Uses These Templates

The Document Generator (Tab 4) does NOT fill in these Word files directly. Instead, it generates an HTML document that follows the **exact same structure and section numbering** as these CCG templates.

**To get a Word document from the generator:**

1. Open the portal and click the **Doc Generator** tab
2. Fill in the form fields (program name, parameters, tables, etc.)
3. Click **Generate Document**
4. Click **📥 Download HTML**
5. Open the downloaded `.html` file in **Microsoft Word**
6. Word will convert it to an editable document automatically
7. Click **File → Save As** → choose `.docx` format
8. The document will have proper headings, tables, and formatting

---

## CCG Template Section Structure

Both templates follow this section structure (the generator matches it exactly):

### Technical Design Document (TDD)

```
Cover Page
  - Document title, program name, module, version, author, date
  - Status badge (DRAFT / APPROVED / FINAL)

Document Control Table
  - Version, date, author, change description

1. Program Overview
   - Concurrent Program name, short name, application
   - Oracle Package and Procedure
   - Output format and destination

2. Purpose and Description
   - What the program does and why it exists

3. Parameters
   Table: # | Parameter Name | Data Type | Required | LOV/Value Set | Description

4. Database Tables Used
   Table: Table Name | Alias | Schema Owner | Access Type (Read/Read-Write) | Description

5. Value Sets / LOVs
   Table: Value Set Name | Validation Type | Used By Parameter | Notes

6. Business Rules and Logic
   - Numbered list of business rules applied

7. Error Handling
   - Exception handling approach
   - Oracle EBS error standards callout

8. Output / Report Layout
   - Report format, columns, grouping, sorting

9. Technical Design
   - Package structure
   - Oracle EBS coding standards note

10. PL/SQL Flowchart (SVG diagram)
    - Auto-generated from the program structure

11. Data Flow Diagram (SVG diagram)
    - How data flows from Oracle tables through the program to output

12. ER Diagram (SVG diagram)
    - Auto-generated from the tables you entered in section 4

13. Sample PL/SQL Code
    - Auto-generated skeleton with standard header, parameters, main block

Revision History Table
```

### Functional Specification Document (FSD)

```
Cover Page (same as TDD)
Document Control Table (same as TDD)

1. Executive Summary

2. Business Context and Background

3. Functional Requirements
   Table: # | Requirement | Priority | Acceptance Criteria

4. Parameters (same as TDD)

5. Business Rules and Logic

6. Process Flow Diagram (SVG diagram)
   - 8-step business process flow

7. Data Requirements

8. Error Handling and Exceptions

9. Business Impact
   - Upstream and downstream systems
   - SLA and frequency
   - Stakeholders

10. User Acceptance Criteria (UAC Checklist)
    6-point checklist for sign-off

Revision History Table
```

---

## Naming Convention for CCG Documents

CCG uses this naming convention for document files:

```
CCG-DO080-REP-XXX-XXX-[Short Document Name].doc

Where:
  CCG         = Cook County Government
  DO080       = Document reference number (Technical Design = DO080)
  REP         = Report type (could also be INT, CONV, EXT, FORM, WF)
  XXX-XXX     = Sequential number (e.g. 001-001, 001-002)
  [Name]      = Short descriptive name of the program/report
```

**Examples:**
- `CCG-DO080-REP-001-001-Aged_Payables_Detail.doc`
- `CCG-DO080-REP-002-001-Supplier_Payment_History.doc`
- `CCG ERP FS REP-001-001-iExpense_Approval_Workflow.doc`

---

## Tips for Using the Generated Documents

1. **Headers and Footers**: After opening in Word, add your organisation's header (logo, document reference) and footer (page numbers, confidentiality notice) using Word's Header/Footer feature.

2. **Styles**: The HTML output uses standard heading levels (H1, H2, H3). After opening in Word, apply your organisation's Word styles using Format → Styles.

3. **SVG Diagrams**: The four SVG diagrams in the generated document are inline SVG. They render perfectly in modern browsers and in Word 2013 or later. If you need to edit a diagram, open the HTML file in a text editor and modify the SVG code.

4. **Table Formatting**: After opening in Word, you can select any table and apply a Word table style using Table Design → Table Styles.

5. **Version Control**: Update the Revision History table in the Word document each time you make a change. The version number should follow this format: 0.1 (draft), 1.0 (approved), 1.1 (minor update), 2.0 (major revision).

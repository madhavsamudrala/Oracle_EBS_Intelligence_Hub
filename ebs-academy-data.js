/* ═══════════════════════════════════════════════════════════════════
   Oracle EBS Academy Data — Tab 6: Complete EBS Learning Portal
   Version 1.0 | Oracle E-Business Suite | Functional + Technical
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
window.EBS_ACADEMY = {

modules: [

/* ══════════════════════════════════════════════════════════════════
   1. HRMS — Human Resource Management System
   ══════════════════════════════════════════════════════════════════ */
{
  id:'hrms', icon:'👥', label:'HRMS', color:'#0572CE',
  desc:'Complete Human Resources cycle — Hire to Retire, Payroll integration, Self-Service HR',
  topics:[
  {
    id:'hrms_overview', label:'HRMS Overview & Architecture',
    content:{
      summary:'Oracle HRMS (Human Resources Management System) is a fully integrated suite covering the entire employee lifecycle from recruitment to retirement. In E-Business Suite it is organised around three core pillars: Core HR (people management), Payroll (compensation processing), and Self-Service HR (manager/employee self-service).',
      functional:[
        'Core HR manages the Work Structures (Business Groups, Organisations, Jobs, Positions, Grades)',
        'DateTrack is the signature EBS feature — every HR record has an EFFECTIVE_START_DATE / EFFECTIVE_END_DATE so full history is preserved',
        'Assignment is the central concept — every employee has at least one Assignment linking them to an Organisation, Job, Position, Grade, and Payroll',
        'Person record holds biographical data; multiple Assignments can exist per Person (e.g., primary + secondary)',
        'Supervisor hierarchy is driven by supervisor_id on per_all_assignments_f',
        'Responsibility: HR Manager, HR Specialist, Employee Self-Service, Manager Self-Service'
      ],
      technical:[
        'Key tables: PER_ALL_PEOPLE_F (persons), PER_ALL_ASSIGNMENTS_F (assignments), PER_JOBS (jobs), PER_GRADES (grades), HR_ALL_ORGANIZATION_UNITS (orgs)',
        'All _F tables are DateTracked — always join with EFFECTIVE_START_DATE <= TRUNC(SYSDATE) AND EFFECTIVE_END_DATE >= TRUNC(SYSDATE)',
        'Business Group = top-level HR organisation; controlled by BUSINESS_GROUP_ID on every HR table',
        'HR_LOOKUPS / FND_LOOKUPS store all list-of-values (EMP_TYPE, MARITAL_STATUS, NATIONALITY etc.)',
        'API calls: hr_person_api.create_person, per_assignment_api.create_employee_assignment'
      ],
      sql:`/* Active Employees with Assignment Details */
SELECT papf.employee_number,
       papf.full_name,
       papf.date_of_birth,
       paaf.assignment_number,
       paaf.assignment_status_type_id,
       haou.name            org_name,
       pj.name              job_name,
       pg.name              grade_name,
       ppf.full_name        supervisor_name
  FROM per_all_people_f       papf
  JOIN per_all_assignments_f  paaf ON paaf.person_id = papf.person_id
  JOIN hr_all_organization_units haou ON haou.organization_id = paaf.organization_id
  LEFT JOIN per_jobs            pj   ON pj.job_id = paaf.job_id
  LEFT JOIN per_grades          pg   ON pg.grade_id = paaf.grade_id
  LEFT JOIN per_all_people_f    ppf  ON ppf.person_id = paaf.supervisor_id
                                    AND TRUNC(SYSDATE) BETWEEN ppf.effective_start_date AND ppf.effective_end_date
 WHERE paaf.primary_flag = 'Y'
   AND paaf.assignment_type = 'E'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
 ORDER BY papf.full_name;`
    }
  },
  {
    id:'hrms_hire', label:'Hire-to-Retire Cycle',
    content:{
      summary:'The Hire-to-Retire cycle covers every HR event from the moment a candidate is recruited through to final retirement/termination, including all mid-life events such as promotions, transfers, and leaves of absence.',
      functional:[
        '1. Recruitment: vacancy raised → applicant created (APPLICANT person type) → offer made',
        '2. Hire: applicant converted to EMPLOYEE via "Hire an Applicant" or "Quick Hire" forms',
        '3. Probation Period tracked via per_periods_of_service.probation_end_date',
        '4. Promotion / Grade Step: DateTrack UPDATE to per_all_assignments_f changing grade_id / position_id',
        '5. Transfer: change organisation on assignment (DateTrack mode = UPDATE)',
        '6. Leave of Absence: absence recorded in per_absence_attendances; assignment_status = SUSP-UNPAID etc.',
        '7. Termination: per_periods_of_service.actual_termination_date set; all assignments end-dated',
        '8. Rehire: new Period of Service created; employee_number preserved by default'
      ],
      technical:[
        'PER_PERIODS_OF_SERVICE: one row per period; DATE_START, ACTUAL_TERMINATION_DATE, LAST_STANDARD_PROCESS_DATE',
        'DateTrack modes: INSERT (new record), UPDATE (new row same dates+), CORRECTION (overwrite current row)',
        'Termination API: hr_ex_employee_api.actual_termination_emp',
        'Absence API: hr_person_absence_api.create_person_absence',
        'Per_assignment_status_types: ACTIVE_ASSIGN, TERM_ASSIGN, SUSP_ASSIGN — control payroll processing'
      ],
      sql:`/* Employee Service History (all periods) */
SELECT papf.employee_number, papf.full_name,
       ppos.date_start         hire_date,
       ppos.actual_termination_date termination_date,
       ppos.leaving_reason,
       ROUND(NVL(ppos.actual_termination_date,SYSDATE) - ppos.date_start) service_days
  FROM per_all_people_f      papf
  JOIN per_periods_of_service ppos ON ppos.person_id = papf.person_id
 WHERE TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
 ORDER BY papf.full_name, ppos.date_start;`
    }
  },
  {
    id:'hrms_payroll_link', label:'HRMS ↔ Payroll Integration',
    content:{
      summary:'HRMS feeds directly into Oracle Payroll. Every assignment must be linked to a Payroll (e.g., Monthly, Bi-Weekly) so that payroll runs can pick up the correct salary, elements, and costing.',
      functional:[
        'Payroll is defined under Compensation & Benefits → Payroll menu',
        'Assignment must have PAYROLL_ID populated and PRIMARY_FLAG = Y',
        'Salary basis and grade step control basic pay (per_pay_proposals stores each pay proposal)',
        'Element Entries drive variable pay — overtime, bonuses, deductions, tax',
        'Costing links assignment to GL cost centres via pay_cost_allocations_f'
      ],
      technical:[
        'PAY_PAYROLLS_F: payroll definition with pay_frequency',
        'PAY_ELEMENT_ENTRIES_F: element entries per assignment (DateTracked)',
        'PAY_ELEMENT_ENTRY_VALUES_F: actual values (amount, rate, days)',
        'PER_PAY_PROPOSALS: salary proposals per assignment',
        'PAY_COST_ALLOCATIONS_F: GL costing segments per assignment'
      ],
      sql:`/* Employee Salary & Element Summary */
SELECT papf.employee_number, papf.full_name,
       pet.element_name,
       peev.screen_entry_value   entry_value,
       pee.effective_start_date,
       pee.effective_end_date
  FROM per_all_people_f         papf
  JOIN per_all_assignments_f    paaf ON paaf.person_id = papf.person_id
  JOIN pay_element_entries_f    pee  ON pee.assignment_id = paaf.assignment_id
  JOIN pay_element_entry_values_f peev ON peev.element_entry_id = pee.element_entry_id
  JOIN pay_element_types_f      pet  ON pet.element_type_id = pee.element_type_id
 WHERE paaf.primary_flag = 'Y'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pee.effective_start_date  AND pee.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN peev.effective_start_date AND peev.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pet.effective_start_date  AND pet.effective_end_date
 ORDER BY papf.full_name, pet.element_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   2. PAYROLL — Oracle Payroll Processing
   ══════════════════════════════════════════════════════════════════ */
{
  id:'payroll', icon:'💵', label:'Payroll', color:'#00829B',
  desc:'Full payroll run cycle, elements, balances, costing, year-end',
  topics:[
  {
    id:'pay_run_cycle', label:'Payroll Run Cycle',
    content:{
      summary:'The Payroll Run Cycle in Oracle EBS Payroll processes employee earnings, deductions, and taxes for a defined pay period. The cycle runs through several mandatory steps each period.',
      functional:[
        '1. Pre-Payroll: check for missing/invalid element entries, salary proposals, assignment statuses',
        '2. Payroll Run: calculates gross pay, deductions, net pay for all assignments in the payroll',
        '3. Pre-Payments: assigns payment method (bank transfer / check) to each net payment',
        '4. Magnetic Transfer / Check Writer: generates payment files or check print batches',
        '5. NACHA / ACH: electronic funds transfer file generation',
        '6. Costing: allocates payroll costs to GL cost centres',
        '7. Transfer to GL: journal entries posted to GL via pay_action_interlocks',
        '8. Payslip Generation: SOE (Statement of Earnings) generated per employee'
      ],
      technical:[
        'PAY_PAYROLL_ACTIONS: one row per payroll run (payroll_action_id)',
        'PAY_ASSIGNMENT_ACTIONS: one row per assignment per run (assignment_action_id)',
        'PAY_RUN_RESULTS: formula result rows per element per run',
        'PAY_RUN_RESULT_VALUES: actual values for each result (amount, hours, rate)',
        'PAY_BALANCE_FEEDS_F: maps run result values to balance dimensions',
        'PAY_ASSIGNMENT_LATEST_BALANCES: latest balance cache for performance'
      ],
      sql:`/* Payroll Run Summary for Last Period */
SELECT ppa.payroll_action_id,
       ppf.payroll_name,
       ppa.effective_date        pay_date,
       ppa.action_status,
       COUNT(paa.assignment_action_id) assignments_processed,
       SUM(prrv.result_value)    total_net_pay
  FROM pay_payroll_actions  ppa
  JOIN pay_payrolls_f       ppf ON ppf.payroll_id = ppa.payroll_id
  JOIN pay_assignment_actions paa ON paa.payroll_action_id = ppa.payroll_action_id
  JOIN pay_run_results       prr ON prr.assignment_action_id = paa.assignment_action_id
  JOIN pay_run_result_values prrv ON prrv.run_result_id = prr.run_result_id
 WHERE ppa.action_type = 'R'   -- R = Payroll Run
   AND ppa.effective_date >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-1)
   AND TRUNC(SYSDATE) BETWEEN ppf.effective_start_date AND ppf.effective_end_date
 GROUP BY ppa.payroll_action_id, ppf.payroll_name, ppa.effective_date, ppa.action_status
 ORDER BY ppa.effective_date DESC;`
    }
  },
  {
    id:'pay_elements', label:'Elements, Balances & Fast Formulas',
    content:{
      summary:'Elements are the building blocks of Oracle Payroll. Each element represents an earning (basic salary, overtime) or deduction (tax, pension). Fast Formulas define the calculation logic.',
      functional:[
        'Element Classification: Earnings, Pre-Tax Deductions, Tax, Involuntary Deductions, Employer Charges',
        'Element Links: attach elements to assignment criteria (payroll, organisation, job) — mandatory before entry',
        'Element Entries: the actual input values per assignment per period',
        'Balances: running totals by dimension (Year-To-Date, Period-To-Date, All-Time)',
        'Fast Formula: Oracle proprietary formula language — used for custom element calculations, skip rules, proration',
        'Recurring vs Non-Recurring: recurring entries persist period-to-period; non-recurring cleared after each run'
      ],
      technical:[
        'PAY_ELEMENT_TYPES_F: element definitions (name, classification, processing_type)',
        'PAY_INPUT_VALUES_F: input values per element (Amount, Rate, Hours, From/To dates)',
        'PAY_ELEMENT_LINKS_F: link criteria — which assignments get this element',
        'PAY_BALANCE_TYPES: balance definitions (GROSS_EARNINGS, TOTAL_DEDUCTIONS, etc.)',
        'FF_FORMULAS_F: Fast Formula source code',
        'FF_FORMULA_TYPES: type classification (element skip, payroll, assignment set)'
      ],
      sql:`/* All Active Element Entries with Input Values */
SELECT papf.employee_number, papf.full_name,
       pet.element_name,
       piv.name        input_value_name,
       peev.screen_entry_value,
       pee.effective_start_date,
       pee.effective_end_date,
       pet.processing_type  -- R=Recurring, N=Non-Recurring
  FROM per_all_people_f         papf
  JOIN per_all_assignments_f    paaf  ON paaf.person_id = papf.person_id
  JOIN pay_element_entries_f    pee   ON pee.assignment_id = paaf.assignment_id
  JOIN pay_element_entry_values_f peev ON peev.element_entry_id = pee.element_entry_id
  JOIN pay_input_values_f       piv   ON piv.input_value_id = peev.input_value_id
  JOIN pay_element_types_f      pet   ON pet.element_type_id = piv.element_type_id
 WHERE paaf.primary_flag = 'Y'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pee.effective_start_date  AND pee.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN peev.effective_start_date AND peev.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN piv.effective_start_date  AND piv.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pet.effective_start_date  AND pet.effective_end_date
 ORDER BY papf.full_name, pet.element_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   3. ACCOUNTS PAYABLE (AP)
   ══════════════════════════════════════════════════════════════════ */
{
  id:'ap', icon:'💳', label:'Accounts Payable', color:'#C74634',
  desc:'Full Procure-to-Pay cycle — suppliers, invoices, payments, reconciliation',
  topics:[
  {
    id:'ap_p2p', label:'Procure-to-Pay (P2P) Cycle',
    content:{
      summary:'The Procure-to-Pay cycle starts with a Purchase Requisition and ends with a cleared supplier payment. Oracle EBS integrates Purchasing (PO) and Payables (AP) modules throughout this cycle.',
      functional:[
        '1. Purchase Requisition: department raises a need (iProcurement or Purchasing form)',
        '2. RFQ / Quotation (optional): request for quotation sent to suppliers',
        '3. Purchase Order: approved requisition becomes a PO (Standard / Blanket / Contract)',
        '4. Receipt: goods/services received against PO (3-way match: PO + Receipt + Invoice)',
        '5. Invoice Entry: AP Clerk enters invoice from supplier; matched to PO/Receipt',
        '6. Invoice Validation: validates accounting, distributions, tax',
        '7. Approval: Approval Workflow routes to approver (AME or custom WF)',
        '8. Payment Batch: Treasurer creates payment batch, selects invoices due',
        '9. Payment: checks printed or EFT/ACH file generated',
        '10. Bank Reconciliation: payments matched against bank statement in Cash Management'
      ],
      technical:[
        'AP_SUPPLIERS (formerly PO_VENDORS): supplier master',
        'AP_SUPPLIER_SITES_ALL: supplier site details per OU',
        'AP_INVOICES_ALL: invoice header (invoice_id, vendor_id, invoice_amount, payment_status_flag)',
        'AP_INVOICE_LINES_ALL: line-level detail (line_type: ITEM/FREIGHT/TAX)',
        'AP_INVOICE_DISTRIBUTIONS_ALL: GL distribution lines (DR/CR, account_id, amount)',
        'AP_PAYMENTS_ALL / AP_CHECKS_ALL: payment records',
        'PO_HEADERS_ALL → AP_INVOICES_ALL linked via AP_INVOICE_LINES_ALL.PO_HEADER_ID'
      ],
      sql:`/* Invoice-to-Payment Trace (3-way match summary) */
SELECT aia.invoice_num,
       aps.vendor_name,
       aia.invoice_date,
       aia.invoice_amount,
       aia.amount_paid,
       aia.payment_status_flag,   -- Y=Fully Paid, P=Partial, N=Unpaid
       pha.segment1  po_number,
       aca.check_number,
       aca.check_date,
       aca.amount    payment_amount
  FROM ap_invoices_all          aia
  JOIN ap_suppliers             aps  ON aps.vendor_id = aia.vendor_id
  LEFT JOIN ap_invoice_lines_all ail ON ail.invoice_id = aia.invoice_id AND ail.line_type_lookup_code = 'ITEM'
  LEFT JOIN po_headers_all      pha  ON pha.po_header_id = ail.po_header_id
  LEFT JOIN ap_invoice_payments_all aip ON aip.invoice_id = aia.invoice_id
  LEFT JOIN ap_checks_all       aca  ON aca.check_id = aip.check_id
 WHERE aia.org_id = :p_org_id
   AND aia.invoice_date >= TRUNC(SYSDATE,'YYYY')
 ORDER BY aia.invoice_date DESC;`
    }
  },
  {
    id:'ap_aging', label:'AP Aging & Accruals',
    content:{
      summary:'AP Aging categorises outstanding invoices by how long they have been unpaid (0-30, 31-60, 61-90, 90+ days). Accruals ensure month-end cut-off accuracy for goods received but not yet invoiced.',
      functional:[
        'Aging buckets are user-defined in AP setup (Payables Options)',
        'Run AP Aging Report from Concurrent Programs: "Payables Aging Report"',
        'Accrual: at period end, run "Uninvoiced Receipts Report" to identify GRNI (Goods Received Not Invoiced)',
        'Accrual Reconciliation: RCV_TRANSACTIONS vs AP_INVOICES_ALL matching',
        'On-hold invoices appear in aging but cannot be paid until hold released',
        'Always exclude cancelled invoices (cancelled_date IS NULL)'
      ],
      technical:[
        'AP_INVOICES_ALL.PAYMENT_STATUS_FLAG: Y=Paid, P=Partial, N=Unpaid',
        'AP_INVOICES_ALL.CANCELLED_DATE: non-null means cancelled',
        'AP_INVOICE_HOLDS_ALL: hold records (HOLD_LOOKUP_CODE, RELEASE_LOOKUP_CODE)',
        'RCV_TRANSACTIONS: receipt transactions for accrual matching',
        'PO_ACCRUAL_RECONCILE_TEMP: used by standard accrual reconciliation'
      ],
      sql:`/* AP Aging Buckets */
SELECT aps.vendor_name,
       aia.invoice_num,
       aia.invoice_date,
       aia.due_date,
       TRUNC(SYSDATE) - aia.due_date  days_overdue,
       aia.invoice_amount - NVL(aia.amount_paid,0)  outstanding,
       CASE
         WHEN TRUNC(SYSDATE) - aia.due_date <= 30  THEN '0-30 Days'
         WHEN TRUNC(SYSDATE) - aia.due_date <= 60  THEN '31-60 Days'
         WHEN TRUNC(SYSDATE) - aia.due_date <= 90  THEN '61-90 Days'
         ELSE '> 90 Days'
       END  aging_bucket
  FROM ap_invoices_all  aia
  JOIN ap_suppliers     aps ON aps.vendor_id = aia.vendor_id
 WHERE aia.payment_status_flag != 'Y'
   AND aia.cancelled_date IS NULL
   AND aia.org_id = :p_org_id
 ORDER BY days_overdue DESC;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   4. ACCOUNTS RECEIVABLE (AR)
   ══════════════════════════════════════════════════════════════════ */
{
  id:'ar', icon:'💰', label:'Accounts Receivable', color:'#198038',
  desc:'Order-to-Cash cycle — customers, invoices, receipts, deductions, collections',
  topics:[
  {
    id:'ar_o2c', label:'Order-to-Cash (O2C) Cycle',
    content:{
      summary:'The Order-to-Cash cycle starts with a customer sales order and ends with cash collected in the bank. Oracle EBS integrates Order Management (OM), Shipping, Receivables (AR), and Cash Management.',
      functional:[
        '1. Sales Order: created in OM (Order Management) against a customer',
        '2. Pick Release & Ship Confirm: warehouse ships goods; creates RMA if returns',
        '3. AutoInvoice: OM shipping lines transferred to AR via AutoInvoice import program',
        '4. Invoice: AR invoice generated with payment terms (Net 30, 2/10 Net 30, etc.)',
        '5. Statement: periodic customer statement sent',
        '6. Receipt: customer payment received — manual or lockbox (EDI 820)',
        '7. Application: receipt applied to invoice(s) — full, partial, or on-account',
        '8. Deduction / Dispute: short-payment creates a deduction claim',
        '9. Collections: Dunning letters sent for overdue invoices',
        '10. Write-off: bad debt write-off posts to allowance account'
      ],
      technical:[
        'RA_CUSTOMERS (HZ_PARTIES + HZ_CUST_ACCOUNTS): customer master',
        'RA_CUSTOMER_TRX_ALL: transaction header (invoice, credit memo, debit memo)',
        'RA_CUSTOMER_TRX_LINES_ALL: line details',
        'RA_CUST_TRX_LINE_GL_DIST_ALL: GL distributions',
        'AR_CASH_RECEIPTS_ALL: receipt header',
        'AR_RECEIVABLE_APPLICATIONS_ALL: receipt-to-invoice applications',
        'AR_PAYMENT_SCHEDULES_ALL: aged balance per transaction'
      ],
      sql:`/* AR Aging by Customer */
SELECT hca.account_number,
       hp.party_name          customer_name,
       rct.trx_number         invoice_number,
       rct.trx_date           invoice_date,
       aps.due_date,
       aps.amount_due_original,
       aps.amount_due_remaining,
       TRUNC(SYSDATE) - aps.due_date  days_overdue,
       CASE
         WHEN TRUNC(SYSDATE) - aps.due_date <= 0  THEN 'Current'
         WHEN TRUNC(SYSDATE) - aps.due_date <= 30 THEN '1-30 Days'
         WHEN TRUNC(SYSDATE) - aps.due_date <= 60 THEN '31-60 Days'
         WHEN TRUNC(SYSDATE) - aps.due_date <= 90 THEN '61-90 Days'
         ELSE '> 90 Days'
       END  aging_bucket
  FROM ar_payment_schedules_all aps
  JOIN ra_customer_trx_all      rct ON rct.customer_trx_id = aps.customer_trx_id
  JOIN hz_cust_accounts         hca ON hca.cust_account_id = rct.bill_to_customer_id
  JOIN hz_parties               hp  ON hp.party_id = hca.party_id
 WHERE aps.status = 'OP'        -- Open items only
   AND aps.org_id = :p_org_id
 ORDER BY days_overdue DESC;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   5. GENERAL LEDGER (GL)
   ══════════════════════════════════════════════════════════════════ */
{
  id:'gl', icon:'📒', label:'General Ledger', color:'#6929C4',
  desc:'Chart of accounts, journals, period close, consolidation, FSG reporting',
  topics:[
  {
    id:'gl_coa', label:'Chart of Accounts & Accounting Flexfield',
    content:{
      summary:'The Chart of Accounts (COA) in Oracle EBS is defined as an Accounting Key Flexfield (KFF). Every GL transaction posts to a Flexfield combination (CCID — Code Combination ID) that represents the full accounting string.',
      functional:[
        'Accounting Flexfield: typically Company-Cost Centre-Account-Product-Intercompany-Future',
        'Each segment is a List of Values (LOV) from FND_FLEX_VALUES',
        'Summary accounts aggregate detail accounts for FSG reporting',
        'Cross-Validation Rules prevent invalid segment combinations',
        'Ledger (formerly Set of Books): primary accounting entity; has Currency, Calendar, COA, Accounting Method',
        'Balancing Segment ensures Dr = Cr per balancing segment value'
      ],
      technical:[
        'GL_CODE_COMBINATIONS: all valid CCID combinations (num_of_segments up to 30)',
        'FND_FLEX_VALUES: segment value master',
        'GL_LEDGERS: ledger definitions (ledger_id, currency_code, period_set_name, chart_of_accounts_id)',
        'GL_PERIODS: period definitions per calendar',
        'GL_JE_HEADERS / GL_JE_LINES: journal entry header and line detail'
      ],
      sql:`/* Trial Balance by Account */
SELECT gcc.segment1  company,
       gcc.segment2  cost_center,
       gcc.segment3  account,
       gcc.segment4  product,
       SUM(CASE WHEN gljl.entered_dr IS NOT NULL THEN gljl.entered_dr ELSE 0 END)  total_dr,
       SUM(CASE WHEN gljl.entered_cr IS NOT NULL THEN gljl.entered_cr ELSE 0 END)  total_cr,
       SUM(NVL(gljl.entered_dr,0) - NVL(gljl.entered_cr,0))  net_balance
  FROM gl_je_lines         gljl
  JOIN gl_je_headers        gljh ON gljh.je_header_id = gljl.je_header_id
  JOIN gl_code_combinations gcc  ON gcc.code_combination_id = gljl.code_combination_id
  JOIN gl_periods           gp   ON gp.period_name = gljh.period_name
                                AND gp.period_set_name = :p_period_set
 WHERE gljh.status = 'P'         -- Posted journals only
   AND gljh.ledger_id = :p_ledger_id
   AND gp.period_year = :p_year
 GROUP BY gcc.segment1, gcc.segment2, gcc.segment3, gcc.segment4
 ORDER BY gcc.segment1, gcc.segment3;`
    }
  },
  {
    id:'gl_period_close', label:'Period Close Process',
    content:{
      summary:'GL Period Close is the monthly process that finalises accounting for a period, preventing further postings and producing financial statements.',
      functional:[
        '1. Sub-ledger Close: AP, AR, PO, INV sub-ledgers must be closed before GL',
        '2. Accruals: month-end accrual journals entered (prepayments, accrued expenses)',
        '3. Reconciliation: AP Trial Balance + AR Aging reconcile to GL control accounts',
        '4. Allocation: run periodic allocation journals (cost centre allocations)',
        '5. Revaluation: revalue foreign currency balances (GL Revaluation program)',
        '6. Translation (optional): translate functional to reporting currency',
        '7. Consolidation (optional): consolidate subsidiary ledgers into parent',
        '8. FSG Reports: Financial Statement Generator produces P&L, Balance Sheet',
        '9. Close Period: change period status from OPEN to CLOSED in Accounting Period form'
      ],
      technical:[
        'GL_PERIOD_STATUSES: (LEDGER_ID, APPLICATION_ID, PERIOD_NAME, CLOSING_STATUS) — F=Future, O=Open, C=Closed, P=Permanently Closed',
        'To close: UPDATE gl_period_statuses SET closing_status = C — done via form, not direct SQL',
        'SLA (Sub-Ledger Accounting): XLA_AE_HEADERS / XLA_AE_LINES store all sub-ledger accounting before GL transfer',
        'GL_INTERFACE: staging table for journal import from external sources',
        'GLPPOS — Concurrent program "Post Journals" (action_flag = P)'
      ],
      sql:`/* Open/Closed Period Status per Ledger */
SELECT gl.name           ledger_name,
       gps.period_name,
       gps.period_year,
       gps.period_num,
       gps.closing_status,
       DECODE(gps.closing_status,
              'O','Open','C','Closed','F','Future','P','Perm Closed', gps.closing_status) status_desc
  FROM gl_period_statuses gps
  JOIN gl_ledgers         gl  ON gl.ledger_id = gps.ledger_id
  JOIN fnd_application    fa  ON fa.application_id = gps.application_id
 WHERE fa.application_short_name = 'SQLGL'
   AND gps.period_year IN (:p_year, :p_year - 1)
 ORDER BY gl.name, gps.period_year, gps.period_num;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   6. CASH MANAGEMENT (CM)
   ══════════════════════════════════════════════════════════════════ */
{
  id:'cm', icon:'🏦', label:'Cash Management', color:'#005D5D',
  desc:'Bank reconciliation, bank statements, cash forecasting, treasury',
  topics:[
  {
    id:'cm_recon', label:'Bank Reconciliation Process',
    content:{
      summary:'Cash Management (CE module) reconciles Oracle EBS payments and receipts against bank statements, identifying cleared items, exceptions, and timing differences.',
      functional:[
        '1. Bank Statement Import: BAI2 / SWIFT MT940 / manual entry loads statement lines',
        '2. AutoReconciliation: matches statement lines to AP payments and AR receipts automatically',
        '3. Manual Reconciliation: unmatched items reconciled manually',
        '4. Exceptions: NSF (Non-Sufficient Funds), stopped cheques, bank charges posted',
        '5. Statement Close: reconciled statement closed; cleared date updated on payments',
        '6. Cash Position: CE Cash Position Worksheet shows available cash by bank account',
        '7. Cash Forecasting: projects cash inflows (AR receipts due) vs outflows (AP due)'
      ],
      technical:[
        'CE_BANK_ACCOUNTS: bank account definitions',
        'CE_BANK_ACCT_USES_ALL: linking bank accounts to operating units',
        'CE_STATEMENT_HEADERS_INT / CE_STATEMENT_LINES_INT: statement import interface tables',
        'CE_STATEMENT_RECONCILS_ALL: reconciliation records (AP payment ↔ statement line)',
        'AP_CHECKS_ALL.CLEARED_DATE: set when payment cleared in bank recon',
        'AR_CASH_RECEIPTS_ALL.STATUS: CLEARED when reconciled'
      ],
      sql:`/* Bank Reconciliation Status — Uncleared Payments */
SELECT cba.bank_account_name,
       aca.check_number,
       aca.check_date,
       aca.amount,
       aca.currency_code,
       aca.status_lookup_code  payment_status,
       aca.cleared_date,
       TRUNC(SYSDATE) - aca.check_date  days_outstanding
  FROM ap_checks_all      aca
  JOIN ce_bank_acct_uses_all cbau ON cbau.bank_acct_use_id = aca.ce_bank_acct_use_id
  JOIN ce_bank_accounts     cba  ON cba.bank_account_id = cbau.bank_account_id
 WHERE aca.status_lookup_code NOT IN ('VOIDED','OVERFLOW')
   AND aca.cleared_date IS NULL
   AND aca.check_date >= ADD_MONTHS(TRUNC(SYSDATE), -6)
 ORDER BY days_outstanding DESC;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   7. SCM — Supply Chain Management
   ══════════════════════════════════════════════════════════════════ */
{
  id:'scm', icon:'📦', label:'SCM / Purchasing', color:'#8A3800',
  desc:'Requisition to Receipt, PO types, blanket agreements, inventory movements',
  topics:[
  {
    id:'scm_r2r', label:'Requisition-to-Receipt Cycle',
    content:{
      summary:'The Requisition-to-Receipt (R2R) cycle in Oracle EBS covers the full procurement workflow from an internal need being raised to goods or services being physically received.',
      functional:[
        '1. Requisition: Internal PR raised by department (iProcurement or Purchasing forms)',
        '2. Approval: AME/Workflow routes to budget holder → purchasing manager',
        '3. Sourcing: buyer assigns to supplier via RFQ, catalogue, or blanket agreement',
        '4. Purchase Order: PO created (Standard, Blanket, Contract, Planned)',
        '5. PO Approval: AME routes PO to required approval hierarchy',
        '6. Send to Supplier: PO printed/faxed/EDI 850 transmitted',
        '7. Advance Shipment Notice (ASN): supplier sends ASN (EDI 856) — optional',
        '8. Receipt: Receiving clerk enters receipt against PO lines',
        '9. Inspection (optional): items inspected before delivery to inventory',
        '10. Delivery: items moved to inventory subinventory / expense delivered'
      ],
      technical:[
        'PO_REQUISITION_HEADERS_ALL / PO_REQUISITION_LINES_ALL: requisition data',
        'PO_HEADERS_ALL: PO header (type_lookup_code: STANDARD/BLANKET/CONTRACT/PLANNED)',
        'PO_LINES_ALL: PO line (item_id, quantity, unit_price)',
        'PO_LINE_LOCATIONS_ALL: shipment schedules (quantity_shipped, quantity_billed)',
        'RCV_SHIPMENT_HEADERS / RCV_SHIPMENT_LINES: receipt header/lines',
        'RCV_TRANSACTIONS: RECEIVE, DELIVER, RETURN TO VENDOR transaction types'
      ],
      sql:`/* PO to Receipt Matching */
SELECT pha.segment1       po_number,
       pha.type_lookup_code po_type,
       aps.vendor_name,
       pla.line_num,
       pla.item_description,
       plla.quantity_ordered,
       plla.quantity_received,
       plla.quantity_billed,
       plla.quantity_ordered - plla.quantity_received  qty_open,
       pla.unit_price,
       (plla.quantity_ordered - plla.quantity_received) * pla.unit_price  open_value
  FROM po_headers_all      pha
  JOIN ap_suppliers        aps  ON aps.vendor_id = pha.vendor_id
  JOIN po_lines_all        pla  ON pla.po_header_id = pha.po_header_id
  JOIN po_line_locations_all plla ON plla.po_line_id = pla.po_line_id
 WHERE pha.org_id = :p_org_id
   AND pha.authorization_status = 'APPROVED'
   AND pha.closed_code != 'FINALLY CLOSED'
   AND NVL(plla.cancel_flag,'N') = 'N'
   AND plla.quantity_ordered > NVL(plla.quantity_received,0)
 ORDER BY pha.segment1, pla.line_num;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   8. WORKFLOW
   ══════════════════════════════════════════════════════════════════ */
{
  id:'workflow', icon:'🔄', label:'Oracle Workflow', color:'#4589FF',
  desc:'Business events, notification mailer, AME, workflow builder, monitoring',
  topics:[
  {
    id:'wf_architecture', label:'Workflow Architecture & Builder',
    content:{
      summary:'Oracle Workflow is the EBS notification and approval routing engine. Every approval in EBS (PO, AP Invoice, iExpense, HR actions) is driven by a Workflow process definition built in the Workflow Builder.',
      functional:[
        'Workflow Item Type: top-level container (e.g., APINV = AP Invoice Approval)',
        'Process: flowchart of activities (Start → Function/Notification → Decision → End)',
        'Notification Activity: sends email/FYI or approval request to a role or user',
        'Function Activity: executes a PL/SQL procedure as part of the flow',
        'Roles & Users: WF_ROLES view maps users to notification recipients',
        'Notification Mailer: background process that sends/receives email for workflow',
        'Business Events: loosely coupled integration via raise/subscribe model (WF_EVENT)',
        'AME (Approvals Management Engine): rule-based approval routing for PO, AP, etc.'
      ],
      technical:[
        'WF_ITEMS: active workflow process instances',
        'WF_ITEM_ACTIVITY_STATUSES: status of each activity per process (NOTIFIED, COMPLETE, ERROR)',
        'WF_NOTIFICATIONS: notification records (status: OPEN, CLOSED, CANCELLED)',
        'WF_ROLES / WF_USER_ROLES: role ↔ user membership',
        'WF_DEFERRED: deferred/background activities queue',
        'FND_CONCURRENT_PROGRAMS: "Workflow Background Process" — must run regularly'
      ],
      sql:`/* Stuck / Errored Workflow Notifications (last 30 days) */
SELECT wi.item_type,
       wi.item_key,
       wias.activity_label,
       wias.activity_status,
       wias.activity_result_code,
       wias.error_name,
       wias.error_message,
       wias.begin_date,
       wn.subject          notification_subject,
       wn.recipient_role
  FROM wf_item_activity_statuses wias
  JOIN wf_items                  wi  ON wi.item_type = wias.item_type
                                    AND wi.item_key  = wias.item_key
  LEFT JOIN wf_notifications     wn  ON wn.item_type = wias.item_type
                                    AND wn.item_key  = wias.item_key
 WHERE wias.activity_status IN ('ERROR','NOTIFIED')
   AND wias.begin_date >= SYSDATE - 30
 ORDER BY wias.begin_date DESC;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   9. OAF — Oracle Application Framework
   ══════════════════════════════════════════════════════════════════ */
{
  id:'oaf', icon:'🖥️', label:'OAF Development', color:'#FF832B',
  desc:'OA Framework pages, personalisations, extensions, BC4J architecture',
  topics:[
  {
    id:'oaf_arch', label:'OAF Architecture (MVC)',
    content:{
      summary:'Oracle Application Framework (OAF) is a Java/J2EE MVC framework used for all self-service pages in E-Business Suite (iExpense, iProcurement, iRecruitment, Payslip, etc.). Understanding OAF is essential for extending or personalising these pages.',
      functional:[
        'MVC: Model (Business Components for Java — BC4J), View (XML Page Definitions), Controller (Java AM/CO)',
        'Pages are defined as XML metadata stored in MDS (Metadata Store) — $JAVA_TOP/oracle/apps/.../webui/',
        'Personalisation: end-users or admins can add/hide/rearrange fields via Personalise Page link',
        'Extensions: custom CO (Controller Override) / VO (View Object) sub-class deployed to $JAVA_TOP',
        'Responsibility drives which pages a user can access (FND_RESPONSIBILITY → ICX_HR_SELF_SERVICE_PG)',
        'OAF Pages registered as Functions in FND_FORM_FUNCTIONS with web_html_call'
      ],
      technical:[
        'Application Module (AM): root container managing VO connections and transaction',
        'View Object (VO): SQL query wrapped as a Java object; exposes rows as Row objects',
        'Entity Object (EO): maps 1:1 to a database table; handles DML; used by VO',
        'Controller (CO): processRequest / processFormRequest methods in Java',
        'Deploying Extension: jar + add to $CLASSPATH, import metadata via MDS import utility',
        'Key packages: oracle.apps.fnd.framework.*, oracle.apps.fnd.framework.webui.*'
      ],
      sql:`/* OAF Pages Registered as Functions */
SELECT fff.function_name,
       fff.user_function_name,
       fff.web_html_call,
       fff.description,
       frg.resp_key,
       frg.responsibility_name
  FROM fnd_form_functions    fff
  JOIN fnd_responsibility_vl frg ON 1=1   -- cross join for demo; filter as needed
 WHERE fff.type = 'SSWA jsp function'
   AND fff.web_html_call LIKE '%OA.jsp%'
   AND ROWNUM <= 50
 ORDER BY fff.function_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   10. FORMS — Oracle Forms Development
   ══════════════════════════════════════════════════════════════════ */
{
  id:'forms', icon:'📋', label:'Oracle Forms', color:'#A56EFF',
  desc:'Forms 10g development, triggers, FND_FUNCTION, custom forms deployment',
  topics:[
  {
    id:'forms_dev', label:'Forms Development & Deployment',
    content:{
      summary:'Oracle EBS uses Oracle Forms 10g/12c for most of its core transactional UI (Invoices, Purchase Orders, Employee forms, etc.). Custom forms must follow Oracle EBS naming conventions and integration standards.',
      functional:[
        'Forms are .fmb (source) compiled to .fmx (runtime) and deployed to $AU_TOP/forms/US/',
        'Every custom form must be registered as an FND Function (type=FORM)',
        'Add to a Responsibility Menu so users can navigate to it',
        'TEMPLATE.fmb: Oracle-supplied starting point for all custom forms — includes standard triggers',
        'Standard zoom: Ctrl+L or zoom button allows drill-down to related records',
        'CUSTOM library (CUSTOM.pll): Oracle hook for custom trigger logic without modifying Oracle forms'
      ],
      technical:[
        'KEY-COMMIT trigger: fires on Ctrl+S / save — always call standard commit via DO_KEY(COMMIT_FORM)',
        'POST-QUERY trigger: enrich records after query (attach additional display-only fields)',
        'WHEN-VALIDATE-ITEM: real-time field validation (LOV check, business rule)',
        'FND_PROFILE.VALUE(): read profile option value in form trigger',
        'FND_MESSAGE: raise Oracle standard error messages in forms',
        'Registering: FND → Application → Form → Register; then Function → Menu'
      ],
      sql:`/* Custom Forms Registered in EBS */
SELECT fff.function_name,
       fff.user_function_name,
       ff.form_name,
       fa.application_short_name,
       fff.description
  FROM fnd_form_functions    fff
  JOIN fnd_form              ff  ON ff.form_id = fff.form_id
  JOIN fnd_application       fa  ON fa.application_id = ff.application_id
 WHERE fff.type = 'FORM'
   AND fa.application_short_name NOT IN ('FND','SYSADMIN','AOL')
 ORDER BY fa.application_short_name, fff.function_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   11. RDF REPORTS — Oracle Reports
   ══════════════════════════════════════════════════════════════════ */
{
  id:'rdf', icon:'📄', label:'RDF Reports', color:'#6929C4',
  desc:'Oracle Reports 10g/11g development, concurrent program registration, bursting',
  topics:[
  {
    id:'rdf_dev', label:'RDF Development & Registration',
    content:{
      summary:'Oracle EBS uses Oracle Reports (formerly Reports 6i/10g, now 11g/12c) for structured tabular reports — invoices, remittance advices, payroll payslips, tax forms. Reports are .rdf files compiled to .rep.',
      functional:[
        'Report Types: Tabular (table layout), Form-letter (one record per page), Matrix (crosstab), Group-above',
        'Every RDF must be registered as a Concurrent Program of type "Oracle Reports"',
        'Parameters: defined in Reports Builder and matched 1:1 to Concurrent Program parameters',
        'Report Output: Previewer (HTML), Printer, File (CSV/PDF)',
        'Report Sets: group multiple reports to run sequentially with shared parameter set',
        'Bursting: distribute report output to different printers/email per content'
      ],
      technical:[
        'File location: $<APP>_TOP/reports/US/*.rdf → compile to *.rep',
        'Concurrent Program: executable_name matches the .rdf filename (without extension)',
        'Parser: Oracle Reports Server (rwservlet) — ensure running on apps tier',
        'Tokens: &P_ORG_ID, &P_DATE_FROM passed as lexical parameters to WHERE clause',
        'SRW.USER_EXIT: calls FND_FLEX_EXT.GET_SEGS for flexfield display in reports',
        'FND_FILE.PUT_LINE: write to concurrent log/out from PL/SQL inside a report'
      ],
      sql:`/* Concurrent Programs of type Oracle Reports */
SELECT fcp.concurrent_program_name  short_name,
       fcpv.user_concurrent_program_name,
       fex.executable_name,
       fex.execution_file_name       rdf_file_name,
       fex.execution_method_code,
       fa.application_short_name
  FROM fnd_concurrent_programs     fcp
  JOIN fnd_concurrent_programs_vl  fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                        AND fcpv.application_id        = fcp.application_id
  JOIN fnd_executables              fex  ON fex.executable_id = fcp.executable_id
                                        AND fex.application_id = fcp.executable_application_id
  JOIN fnd_application              fa   ON fa.application_id = fcp.application_id
 WHERE fex.execution_method_code = 'R'   -- R = Oracle Reports
 ORDER BY fa.application_short_name, fcp.concurrent_program_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   12. BIP — BI Publisher Reports
   ══════════════════════════════════════════════════════════════════ */
{
  id:'bip', icon:'📊', label:'BIP Reports', color:'#009D9A',
  desc:'XML Publisher / BI Publisher — data models, RTF templates, bursting, scheduling',
  topics:[
  {
    id:'bip_dev', label:'BIP Development End-to-End',
    content:{
      summary:'Oracle BI Publisher (formerly XML Publisher) is the modern reporting tool in Oracle E-Business Suite. It separates data extraction (Data Model / SQL query) from presentation (RTF/PDF/Excel template), enabling pixel-perfect formatted outputs.',
      functional:[
        '1. Data Definition: registered in XML Publisher Administrator (FND → XML Publisher → Data Definitions)',
        '2. SQL Query / Data Model: the SQL that generates the XML data extract',
        '3. Template: RTF template built in MS Word with BIP Template Builder add-in',
        '4. Template Registration: upload .rtf to XML Publisher → Templates',
        '5. Concurrent Program: type = XML Publisher Report; references the data definition',
        '6. Output Formats: PDF, RTF, HTML, Excel (XLS/XLSX), CSV, Data (XML)',
        '7. Bursting: xdo_delivery_details — split and deliver output per document'
      ],
      technical:[
        'XDO_DS_DEFINITIONS_B: data source/definition registration',
        'XDO_TEMPLATES_B: template registration',
        'XDO_LOBS: stores RTF/XSL template binary data',
        'FND_CONCURRENT_PROGRAMS: concurrent program with output_file_type = XML',
        'Template tags: <?for-each:ROW?>, <?end for-each?>, <?AMOUNT?> for field binding',
        'Conditional: <?if:STATUS=&apos;APPROVED&apos;?>...<?end if?>',
        'FO (Formatting Object): for advanced PDF control — page breaks, headers/footers'
      ],
      sql:`/* BIP Templates and Data Definitions */
SELECT xdd.application_short_name,
       xdd.data_source_code,
       xdd.data_source_name,
       xt.template_code,
       xt.template_name,
       xt.template_type_code,
       xt.default_output_type,
       xt.language,
       xl.file_name
  FROM xdo_ds_definitions_b  xdd
  JOIN xdo_templates_b       xt  ON xt.data_source_code = xdd.data_source_code
                                 AND xt.application_short_name = xdd.application_short_name
  LEFT JOIN xdo_lobs         xl  ON xl.lob_code = xt.template_code
                                 AND xl.application_short_name = xt.application_short_name
 ORDER BY xdd.application_short_name, xdd.data_source_code, xt.template_code;`
    }
  }
  ]
}

,

/* ══════════════════════════════════════════════════════════════════
   9. DBA — Database Administration, Patching, Cloning, Upgrade
   ══════════════════════════════════════════════════════════════════ */
{
  id:'dba', icon:'🛡️', label:'DBA & System Admin', color:'#6929C4',
  desc:'Oracle EBS DBA guide — Patching (AD Utilities), Cloning (adcfgclone), Upgrades (R12.1→R12.2), Performance Tuning, Backup & Recovery',
  topics:[
  {
    id:'dba_patching', label:'EBS Patching — AD Utilities & Methodology',
    content:{
      summary:'Oracle EBS patches are delivered as Patch Zip files applied using AD (Application DBA) utilities. Every EBS DBA must master the patch lifecycle: download, stage, prerequisite check, apply, and verify.',
      functional:[
        'Patch Types: One-off patches (bug fixes), Bundle Patches (BPs), Release Update Packs (RUPs), Mini-Packs, Maintenance Packs',
        'Oracle Support (MOS) is the source — search by bug number or patch number on support.oracle.com',
        'Patch Readme: every patch ships a README.txt with pre-reqs, steps, and post-apply actions',
        'Maintenance Mode: put EBS in maintenance mode before applying most patches (fnd_product_maintenance)',
        'Online Patching (R12.2): EBS R12.2 introduces Online Patching — patch applied in PATCH edition while RUNTIME edition serves users',
        'Downtime vs Online patches: downtime patches require full system shutdown; online patches (R12.2 only) allow zero-downtime',
        'Test on non-prod first — ALWAYS apply patches on Dev/Test before Production'
      ],
      technical:[
        'adpatch: the primary patching utility — runs SQL, EXEC, COPY, GENERATE, COMPILE actions from a driver file',
        'adpatch options=nocompiledb,nocompilejsp: skip recompile for speed when not required',
        'Patch driver types: u (unified), c (copy), d (database), g (generate)',
        'adop (AD Online Patching, R12.2): replaces adpatch; manages patch and run editions',
        'adop phases: prepare → apply → finalize → cutover → cleanup',
        'adop apply: adop phase=apply patches=<patch_number> patchtop=<staging_dir>',
        'adop cutover: switches PATCH edition to RUNTIME (brief downtime ~15 min)',
        'Key log files: $APPL_TOP/admin/<SID>/log/adpatch*.log, adop_<phase>_<date>.log',
        'admrgpch: merge multiple patches into one for efficiency',
        'adutility: AD Controller to monitor/restart failed workers',
        'Pre-req check: adpatch prereq=yes — validates all prerequisites without applying'
      ],
      sql:`/* Check applied patch history */
SELECT ap.patch_name,
       ap.patch_type,
       ap.creation_date    applied_date,
       ap.success_flag,
       ap.applied_by,
       ap.language,
       ap.platform
  FROM ad_applied_patches   ap
 ORDER BY ap.creation_date DESC
 FETCH FIRST 50 ROWS ONLY;

/* Check patch worker status */
SELECT worker_id,
       status,
       action_type,
       object_name,
       object_schema,
       start_date,
       end_date
  FROM ad_deferred_jobs
 WHERE status != 'Completed'
 ORDER BY worker_id;`
    }
  },
  {
    id:'dba_cloning', label:'EBS Cloning — adcfgclone & Rapid Clone',
    content:{
      summary:'Cloning creates a copy of an EBS instance (e.g., Prod → Dev/Test). Oracle provides the Rapid Clone methodology using adcfgclone.pl. A full clone involves both DB tier and Apps tier steps.',
      functional:[
        'Clone Use Cases: refresh Dev/Test with Prod data, disaster recovery standby, upgrade testing, performance testing',
        'Pre-clone: run adpreclone.pl on both DB and Apps tiers to capture source system context',
        'Post-clone: run adcfgclone.pl on the target to reconfigure — changes hostnames, ports, SIDs, paths',
        'Exclusions: never copy file system passwords; target SID must differ from source to avoid conflicts',
        'MOS Doc 406982.1: the definitive Rapid Clone guide',
        'Auto-config (autoconfig): runs after cloning to regenerate all config files (.xml, .env, httpd.conf etc.)',
        'Cold clone: DB must be shut down; hot clone: RMAN used while DB is running'
      ],
      technical:[
        'Step 1 — DB Tier Pre-Clone: perl $ORACLE_HOME/appsutil/bin/adpreclone.pl dbTier',
        'Step 2 — Apps Tier Pre-Clone: perl $ADMIN_SCRIPTS_HOME/adpreclone.pl appsTier',
        'Step 3 — Copy DB files: cold backup or RMAN backup/restore to target',
        'Step 4 — Apps Tier Copy: rsync or tar of $APPL_TOP, $COMMON_TOP, $ORA_TOP',
        'Step 5 — DB Tier Clone: perl $ORACLE_HOME/appsutil/clone/bin/adcfgclone.pl dbTier',
        'Step 6 — Apps Tier Clone: perl $ADMIN_SCRIPTS_HOME/adcfgclone.pl appsTier',
        'Step 7 — Run AutoConfig: $ADMIN_SCRIPTS_HOME/adautocfg.sh (Apps); $ORACLE_HOME/appsutil/bin/adautocfg.sh (DB)',
        'Step 8 — Compile invalids: utlrp.sql',
        'Step 9 — Start EBS: $ADMIN_SCRIPTS_HOME/adstrtal.sh',
        'Key files: Context file ($APPL_TOP/admin/<SID>_<hostname>.xml) stores all instance parameters',
        'adcfgclone parameters: new SID, new hostname, new ports, new DB connect string'
      ],
      sql:`/* Verify clone completed — check instance details */
SELECT instance_name,
       host_name,
       version,
       status,
       database_status,
       logins
  FROM v$instance;

/* Verify EBS profile for new hostname */
SELECT fpov.profile_option_value,
       fpo.profile_option_name
  FROM fnd_profile_option_values fpov
  JOIN fnd_profile_options       fpo  ON fpo.profile_option_id = fpov.profile_option_id
 WHERE fpo.profile_option_name LIKE '%HOST%'
    OR fpo.profile_option_name LIKE '%SERVER%'
    OR fpo.profile_option_name LIKE '%URL%'
 ORDER BY fpo.profile_option_name;`
    }
  },
  {
    id:'dba_upgrade', label:'EBS Upgrade — R12.1 → R12.2 Steps',
    content:{
      summary:'Upgrading Oracle EBS from R12.1 to R12.2 is a major project. R12.2 introduces Online Patching (Edition-Based Redefinition), a new technology stack (WebLogic, OHS 12c), and requires careful planning and execution.',
      functional:[
        'R12.2 Key Changes: Online Patching (adop), WebLogic Server replaces OC4J, OHS 12c replaces Apache, Forms Server 12c',
        'Edition-Based Redefinition (EBR): DB objects exist in multiple editions — PATCH and RUNTIME — enabling zero-downtime patching',
        'Upgrade path: must be on minimum R12.1.3 before upgrading to R12.2',
        'Pre-upgrade: complete any open transactions, close periods, resolve workflow errors',
        'Dual maintenance: after upgrade to R12.2 GA, immediately apply latest RUP (Release Update Pack)',
        'Downtime window: full upgrade typically requires 8–24 hours of downtime',
        'Testing: full regression test of customisations, interfaces, and reports post-upgrade'
      ],
      technical:[
        'Technology Stack Change: iAS 10.1.2/10.1.3 → WebLogic 12c + OHS 12c',
        'Database requirement: Oracle DB 11gR2 (11.2.0.4) or 12c minimum for R12.2',
        'Step 1: Apply R12.2 upgrade patch (patch 13516595 or latest) — runs AutoUpgrade utility',
        'Step 2: DB upgrade scripts — catupgrd.sql, utlrp.sql',
        'Step 3: Apply R12.2.x RUP (latest available)',
        'Step 4: Migrate customisations to EBR-compatible code (triggers, packages must be edition-aware)',
        'Step 5: Recompile and test all custom code, OAF pages, reports, interfaces',
        'Step 6: Configure new tech stack — WebLogic Admin Server, Managed Servers, OHS',
        'Step 7: Enable Online Patching (adop) — verify with: adop phase=validate',
        'Custom objects: any custom DB objects in APPS schema must be wrapped in editioned views/packages',
        'adop validate: checks all system pre-requisites before running any adop phase'
      ],
      sql:`/* Pre-upgrade invalid objects check */
SELECT object_type,
       COUNT(*) invalid_count
  FROM dba_objects
 WHERE status = 'INVALID'
   AND owner IN ('APPS','SYSTEM')
 GROUP BY object_type
 ORDER BY 2 DESC;

/* Check EBS version */
SELECT release_name,
       to_char(last_update_date,'DD-MON-YYYY HH24:MI:SS') last_updated
  FROM fnd_product_groups;

/* Check edition-based objects (R12.2) */
SELECT object_name, object_type, edition_name
  FROM dba_objects_ae
 WHERE owner = 'APPS'
   AND edition_name IS NOT NULL
 ORDER BY edition_name, object_type, object_name
 FETCH FIRST 30 ROWS ONLY;`
    }
  },
  {
    id:'dba_performance', label:'EBS Performance Tuning',
    content:{
      summary:'EBS performance issues fall into three categories: concurrent program performance, form/page response time, and database-level bottlenecks. DBA and Technical teams must collaborate using Oracle diagnostic tools.',
      functional:[
        'Concurrent Manager tuning: increase number of workers, set work shifts, use specialised managers for heavy programs',
        'Profile options for performance: FND: Debug Log Level, FND: Diagnostics, MO: Security Profile caching',
        'Gather statistics regularly: FND Gather Schema Statistics concurrent program',
        'Purge old concurrent requests: Purge Concurrent Request and/or Manager Data program',
        'SLA (Sub-Ledger Accounting) Sweep: resolve unprocessed accounting events promptly'
      ],
      technical:[
        'AWR (Automatic Workload Repository): generates performance snapshots; DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT',
        'ASH (Active Session History): V$ACTIVE_SESSION_HISTORY — real-time query of what DB was doing',
        'Top SQL: query V$SQL ordered by elapsed_time / buffer_gets / disk_reads',
        'Execution plans: EXPLAIN PLAN / DBMS_XPLAN.DISPLAY_CURSOR to see Oracle optimizer choices',
        'Indexes on _ALL tables: ORG_ID column must always be in the WHERE clause for partition pruning',
        'Bind variables: EBS uses bind variables extensively — ensure CURSOR_SHARING = EXACT (not FORCE)',
        'SGA sizing: db_cache_size, shared_pool_size, large_pool_size — properly sized for EBS workload',
        'DB File Sequential/Scattered Read waits: indicate I/O bottleneck — check storage and RAID configuration',
        'Library Cache Latch: high version counts for a SQL ID → investigate CURSOR_SHARING or bind peeking issues'
      ],
      sql:`/* Top 10 SQL by Elapsed Time (last hour) */
SELECT sql_id,
       ROUND(elapsed_time/1e6, 1)       elapsed_secs,
       executions,
       ROUND(elapsed_time/DECODE(executions,0,1,executions)/1e6, 3) secs_per_exec,
       buffer_gets,
       disk_reads,
       SUBSTR(sql_text,1,100)           sql_snippet
  FROM v$sql
 WHERE last_active_time >= SYSDATE - 1/24
 ORDER BY elapsed_time DESC
 FETCH FIRST 10 ROWS ONLY;

/* Concurrent Manager worker status */
SELECT fcq.concurrent_queue_name,
       fcp.user_concurrent_program_name,
       fcr.status_code,
       ROUND((SYSDATE - fcr.actual_start_date)*60,1) running_mins,
       fcr.request_id
  FROM fnd_concurrent_requests    fcr
  JOIN fnd_concurrent_programs_vl fcp ON fcp.concurrent_program_id = fcr.concurrent_program_id
  JOIN fnd_concurrent_queues_vl   fcq ON fcq.concurrent_queue_id   = fcr.controlling_manager
 WHERE fcr.status_code = 'R'
 ORDER BY running_mins DESC;`
    }
  },
  {
    id:'dba_backup', label:'Backup, Recovery & RMAN',
    content:{
      summary:'EBS backup strategy must protect both the Oracle Database and the Application File System. RMAN (Recovery Manager) handles the database; OS-level backup (tar/rsync) handles the apps tier.',
      functional:[
        'RPO (Recovery Point Objective): how much data can you afford to lose? Drives backup frequency',
        'RTO (Recovery Time Objective): how long can EBS be down? Drives backup type (hot/cold, DR)',
        'Hot Backup: database backed up while running (ARCHIVELOG mode required)',
        'Cold Backup: EBS and DB shut down; cold backup is simpler but requires downtime',
        'Archive Log mode: mandatory for hot backups and Data Guard; ALTER DATABASE ARCHIVELOG',
        'Data Guard: standby database for DR — physical standby (block-level copy) or logical standby'
      ],
      technical:[
        'RMAN full backup: RMAN TARGET / BACKUP DATABASE PLUS ARCHIVELOG DELETE INPUT;',
        'RMAN incremental: BACKUP INCREMENTAL LEVEL 0 DATABASE; then LEVEL 1 CUMULATIVE daily',
        'RMAN catalog: use a recovery catalog DB for long-term backup metadata — recommended for EBS',
        'Apps tier backup: tar -czf appl_backup.tar.gz $APPL_TOP $COMMON_TOP $ORA_TOP',
        'Test restores: restore to a sandbox at least quarterly — untested backups are worthless',
        'RMAN restore DB: RESTORE DATABASE; RECOVER DATABASE; ALTER DATABASE OPEN RESETLOGS;',
        'Block change tracking: ALTER DATABASE ENABLE BLOCK CHANGE TRACKING — speeds incremental backups',
        'Flashback Database: ALTER DATABASE FLASHBACK ON — fast rewind for test environments',
        'Key logs: alert log ($ORACLE_BASE/diag/rdbms/<db>/<SID>/trace/alert_<SID>.log), RMAN log'
      ],
      sql:`/* Check RMAN backup history */
SELECT bs.start_time,
       bs.end_time,
       bs.status,
       bs.backup_type,
       bs.incremental_level,
       ROUND(bs.elapsed_seconds/60,1)  elapsed_mins,
       bsp.bytes/1073741824            gb_backed_up
  FROM v$backup_set      bs
  JOIN v$backup_piece    bsp ON bsp.set_key = bs.set_key
 ORDER BY bs.start_time DESC
 FETCH FIRST 20 ROWS ONLY;

/* Check Archive log generation rate */
SELECT TRUNC(first_time,'HH24')       hour_start,
       COUNT(*)                        logs_generated,
       ROUND(SUM(blocks*block_size)/1073741824,2) gb_generated
  FROM v$archived_log
 WHERE first_time >= SYSDATE - 1
 GROUP BY TRUNC(first_time,'HH24')
 ORDER BY 1;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   10. ARCHITECTURE — EBS Technical Architecture & Integration
   ══════════════════════════════════════════════════════════════════ */
{
  id:'architecture', icon:'🏛️', label:'EBS Architecture', color:'#005D5D',
  desc:'Three-tier architecture, Oracle EBS R12.2 tech stack, Multi-Org, Security model, AutoConfig, and application server configuration',
  topics:[
  {
    id:'arch_3tier', label:'Three-Tier Architecture',
    content:{
      summary:'Oracle EBS uses a three-tier architecture: Desktop (Presentation), Application (Middle) Tier, and Database Tier. Understanding this architecture is essential for every Architect, DBA, and Senior Developer.',
      functional:[
        'Tier 1 — Desktop/Client: Web browser (HTML/HTTPS) for self-service pages; Oracle Forms client for forms-based screens',
        'Tier 2 — Application Tier: Web Server (OHS), Forms Server, Concurrent Processing Server, Admin Server (WebLogic)',
        'Tier 3 — Database Tier: Oracle RDBMS stores all EBS data; all business logic in PL/SQL packages',
        'R12.2 Tech Stack: Oracle HTTP Server 12c, WebLogic Server 12c (replaces OC4J), Oracle Forms/Reports 12c',
        'Multi-node: Application tier can be split across multiple nodes for load balancing',
        'Load Balancer: F5 / Oracle Traffic Director sits in front of multiple app nodes'
      ],
      technical:[
        'Context File: $APPL_TOP/admin/<SID>_<host>.xml — single source of truth for all EBS config',
        'AutoConfig: perl $ADMIN_SCRIPTS_HOME/adautocfg.sh — regenerates all config files from context',
        'WebLogic: AdminServer (port 7001) + EBS_domain (Managed Servers: oacore, forms, oafm)',
        'OHS (Oracle HTTP Server): routes HTTP traffic; mod_wl_ohs proxies to WebLogic; mod_plsql for PL/SQL gateway',
        'Forms Listener Servlet: FRMListener servlet in WebLogic handles Forms client connections',
        'Environment file: source /u01/oracle/VIS/EBSapps.env run — sets PATH, ORACLE_HOME, TWO_TASK',
        'Service control: $ADMIN_SCRIPTS_HOME/adstrtal.sh (start) adstptal.sh (stop) adchktal.sh (status)',
        'Ports: HTTP 8000, HTTPS 4443, WebLogic Admin 7001, Forms 9000 (default)',
        'Key directories: APPL_TOP (product code), COMMON_TOP (shared), ORA_TOP (Oracle homes), FND_TOP (foundation)'
      ],
      sql:`/* EBS instance parameters from context */
SELECT profile_option_name,
       profile_option_value
  FROM (
    SELECT fpo.profile_option_name,
           fpov.profile_option_value
      FROM fnd_profile_options      fpo
      JOIN fnd_profile_option_values fpov ON fpov.profile_option_id = fpo.profile_option_id
     WHERE fpov.level_id = 10001  -- Site level
       AND fpo.profile_option_name IN (
         'APPS_SERVLET_AGENT','APPS_FRAMEWORK_AGENT','ICX_FORMS_LAUNCHER',
         'ICX_LANGUAGE','CONC_LOG_DIRECTORY','CONC_OUT_DIRECTORY')
  )
 ORDER BY profile_option_name;`
    }
  },
  {
    id:'arch_multiorg', label:'Multi-Org (MO) Architecture',
    content:{
      summary:'Multi-Org (MO) is the Oracle EBS mechanism that allows a single database instance to serve multiple Legal Entities, Operating Units, and Inventory Organisations simultaneously. Every AP, AR, PO, and OE transaction is stamped with ORG_ID.',
      functional:[
        'Business Group: top of the hierarchy — one per HRMS installation; contains all personnel records',
        'Legal Entity: represents a legal company — linked to ledger for financial reporting',
        'Operating Unit (OU): transactional unit for AP, AR, PO, OE; most transactions stamped with ORG_ID',
        'Inventory Organisation: warehouse/plant for SCM; identified by ORGANIZATION_ID',
        'Balancing Segment: segment on Chart of Accounts that maps to Legal Entity for intercompany',
        'MO: Security Profile: profile option controlling which OUs a user can see — key for security',
        'MO: Operating Unit: single OU profile — legacy R11i style; being replaced by MO: Security Profile'
      ],
      technical:[
        '_ALL tables: AP_INVOICES_ALL, AR_CASH_RECEIPTS_ALL etc. — contain all OUs; always filter on ORG_ID',
        'Non-_ALL tables: view based on MO context; no explicit ORG_ID filter needed',
        'mo_global.set_policy_context: sets the MO context for a session — required before querying _ALL tables in code',
        'DBMS_APPLICATION_INFO: set module/action for session tracing in multi-org environments',
        'HR_OPERATING_UNITS: master list of Operating Units',
        'GL_LEDGERS: ledgers linked to legal entities',
        'HZ_PARTIES / HZ_CUST_ACCOUNTS: Trading Community Architecture — customers/suppliers span all OUs',
        'Custom code: always include org_id = mo_global.get_current_org_id() in WHERE clause for _ALL tables'
      ],
      sql:`/* List all Operating Units */
SELECT hou.organization_id,
       hou.name                       operating_unit,
       hou.short_code,
       gl.name                        ledger,
       gl.currency_code,
       hou.date_from,
       hou.date_to
  FROM hr_operating_units   hou
  JOIN gl_ledgers            gl  ON gl.ledger_id = hou.set_of_books_id
 ORDER BY hou.name;

/* Check MO Security Profile assignments */
SELECT fu.user_name,
       fpov.profile_option_value       mo_security_profile_id,
       hou.name                        operating_unit
  FROM fnd_user_resp_groups_all  furg
  JOIN fnd_users                 fu  ON fu.user_id = furg.user_id
  JOIN fnd_profile_option_values fpov ON fpov.level_value = furg.responsibility_id
                                     AND fpov.level_id = 10003
  JOIN fnd_profile_options       fpo ON fpo.profile_option_id = fpov.profile_option_id
                                    AND fpo.profile_option_name = 'XLA_MO_SECURITY_PROFILE_LEVEL'
  JOIN hr_operating_units        hou ON TO_CHAR(hou.organization_id) = fpov.profile_option_value
 ORDER BY fu.user_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   11. SOA & INTEGRATION — SOA Suite, Integration, Interfaces
   ══════════════════════════════════════════════════════════════════ */
{
  id:'soa', icon:'🔗', label:'SOA & Integration', color:'#FF832B',
  desc:'Oracle SOA Suite integration with EBS, Web Services (BPEL, OSB), EDI, File-based interfaces, iDOC Script, and REST/SOAP APIs',
  topics:[
  {
    id:'soa_overview', label:'SOA Suite Architecture & EBS Integration',
    content:{
      summary:'Oracle SOA Suite (Oracle Service Bus + BPEL + Mediator) is the middleware layer that connects EBS to external systems. EBS exposes data through Open Interfaces, Business Events, and Web Services. SOA orchestrates these into end-to-end integration flows.',
      functional:[
        'Integration Patterns: File-based (FTP/SFTP), Database (direct table insert), Web Service (SOAP/REST), Messaging (JMS/AQ)',
        'EBS Open Interfaces: standard staging tables that EBS programs read from — AP_INVOICES_INTERFACE, GL_INTERFACE, PO_HEADERS_INTERFACE',
        'Business Events System: EBS raises events on key actions — pay invoice, create PO, complete receipt — SOA can subscribe',
        'iDOC (Integration Document): XML-based standard for EBS concurrent programs — alternative to direct API calls',
        'EDI Integration: X12 850 (PO), 810 (Invoice), 856 (ASN) mapped to EBS via SOA or direct staging tables',
        'Human Workflow: BPEL can include human approval tasks that write back to EBS AME/Workflow'
      ],
      technical:[
        'EBS Adapter (Oracle Apps Adapter): JCA adapter in SOA Suite — connects to EBS APIs natively',
        'Oracle E-Business Suite Adapter: available in Oracle Integration Cloud (OIC) — no SOA middleware required',
        'Open Interface tables: data loaded into staging → EBS Import program validates and moves to base tables',
        'Example: GL_INTERFACE → Journal Import concurrent program → GL_JE_HEADERS/LINES',
        'Example: AP_INVOICES_INTERFACE + AP_INVOICE_LINES_INTERFACE → Payables Open Interface Import',
        'Business Events: WF_EVENT_T (event payload), WF_EVENT.RAISE (raise API), subscription = SOA composite endpoint',
        'SOAP Web Services: EBS exposes PL/SQL packages as Web Services via Oracle Web Services Manager (OWSM)',
        'REST API: EBS R12.2 introduced REST services for some modules (limited vs full OIC/SOA)',
        'MQ integration: Oracle AQ (Advanced Queuing) bridges JMS to EBS for async messaging'
      ],
      sql:`/* EBS Business Events registered */
SELECT we.name          event_name,
       we.display_name,
       we.status,
       wes.system_guid,
       wes.on_error_code,
       wes.phase         subscription_phase
  FROM wf_events          we
  JOIN wf_event_subscriptions wes ON wes.event_filter_guid = we.guid
 WHERE we.status = 'ENABLED'
 ORDER BY we.name
 FETCH FIRST 30 ROWS ONLY;

/* GL Interface staging table — pending rows */
SELECT status,
       COUNT(*)   row_count,
       SUM(NVL(entered_dr,0) - NVL(entered_cr,0))  net_amount
  FROM gl_interface
 WHERE set_of_books_id = :p_ledger_id
 GROUP BY status
 ORDER BY status;`
    }
  },
  {
    id:'soa_oic', label:'Oracle Integration Cloud (OIC) & EBS',
    content:{
      summary:'Oracle Integration Cloud (OIC) is the modern cloud-based integration platform that replaces on-premises SOA Suite for most new EBS integrations. It provides a visual drag-and-drop integration designer with pre-built EBS adapters.',
      functional:[
        'OIC Adapters for EBS: EBS Adapter (calls EBS APIs/Open Interfaces), File Adapter (SFTP), REST Adapter, SOAP Adapter',
        'Pre-built Integrations: Oracle provides recipe packs — pre-built integration templates for common EBS flows',
        'Integration Patterns: App-driven (trigger from external, call EBS), Schedule (run on timer), Event (triggered by EBS Business Event)',
        'Monitoring: OIC dashboard shows all integration instances, errors, and throughput in real time',
        'EBS prerequisites: install EBS Adapter prerequisites on EBS server — MOS Doc 1981762.1'
      ],
      technical:[
        'EBS Adapter connection: hostname, port, SID, APPS username, EBS schema — configured in OIC Connections',
        'Invoke EBS API: OIC → EBS Adapter → select service (PL/SQL API, Open Interface, Business Event)',
        'File-based integration: OIC reads SFTP file → maps to EBS staging table → triggers import program via REST/EBS Adapter',
        'Error handling: always implement Fault Handling in OIC — log to OIC monitoring + send email alert',
        'Versioning: OIC integrations are versioned — active version is locked; new changes create new version',
        'Security: use Oracle Wallet / Secrets Vault for credentials — never hardcode passwords in OIC'
      ],
      sql:`/* Monitor EBS Open Interface errors after OIC load */
SELECT rejection_reason,
       COUNT(*)  error_count
  FROM ap_interface_rejections
 WHERE creation_date >= SYSDATE - 1
 GROUP BY rejection_reason
 ORDER BY error_count DESC;

/* AP Open Interface staging — check loaded invoices */
SELECT status,
       invoice_type_lookup_code,
       COUNT(*)        invoice_count,
       SUM(invoice_amount) total_amount
  FROM ap_invoices_interface
 WHERE creation_date >= TRUNC(SYSDATE)
 GROUP BY status, invoice_type_lookup_code
 ORDER BY status;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   12. ORACLE APEX & EBS-TO-APEX MIGRATION
   ══════════════════════════════════════════════════════════════════ */
{
  id:'apex', icon:'⚡', label:'Oracle APEX & Modernisation', color:'#FF7B72',
  desc:'Oracle APEX foundations, building apps on EBS DB, EBS to APEX migration strategy, APEX 23.x features, and connecting APEX to EBS tables',
  topics:[
  {
    id:'apex_foundation', label:'Oracle APEX Foundation',
    content:{
      summary:'Oracle APEX (Application Express) is Oracle\'s low-code development platform built directly into the Oracle Database. It is the strategic direction for replacing Oracle Forms and many OAF pages in EBS modernisation projects.',
      functional:[
        'APEX runs entirely inside the Oracle Database — no separate middleware required',
        'Development model: Workspace → Application → Pages → Regions/Items/Processes',
        'Page types: Form page, Report page (Interactive Report, Interactive Grid), Chart, Card, Master-Detail',
        'Authentication: APEX accounts, Oracle DB, LDAP/AD, SAML (SSO), Custom PL/SQL scheme',
        'Authorisation: roles/privileges controlled by Authorisation Schemes on components or pages',
        'APEX 23.x features: Low-code automation, REST-enabled SQL, Native Map region, Push notifications, PWA support',
        'Universal Theme (UT): the responsive HTML5 theme for all modern APEX apps — mobile-friendly out of the box'
      ],
      technical:[
        'Install APEX: download from apex.oracle.com → run apexins.sql in DB → configure ORDS or Embedded PL/SQL Gateway',
        'ORDS (Oracle REST Data Services): the web server for APEX in production — runs on Tomcat or WebLogic',
        'APEX schema: APEX_230100 (version-specific) owns all APEX metadata; your app data is in your own schema',
        'Creating an app: APEX App Builder → Create App from Scratch / Create App from Spreadsheet / Install Sample App',
        'SQL Workshop: built-in SQL editor, Object Browser, REST Workshop — useful for EBS table queries',
        'Dynamic Actions: client-side behaviour without writing JavaScript — Show, Hide, Refresh, Execute JS, Submit',
        'APEX_UTIL package: APEX PL/SQL API — apex_util.get_username, apex_application.g_user, apex_util.set_session_state',
        'REST APIs: APEX REST Workshop enables any query as a REST endpoint — useful for EBS data exposure'
      ],
      sql:`/* APEX workspaces and applications */
SELECT w.workspace,
       a.application_id,
       a.application_name,
       a.pages,
       a.last_updated_on,
       a.authentication_scheme
  FROM apex_workspaces    w
  JOIN apex_applications  a ON a.workspace = w.workspace
 ORDER BY w.workspace, a.application_id;

/* APEX Interactive Report columns for a page */
SELECT application_id,
       page_id,
       page_name,
       region_name,
       column_alias,
       heading,
       display_text_as
  FROM apex_application_page_ir_col
 WHERE application_id = :p_app_id
 ORDER BY page_id, column_alias;`
    }
  },
  {
    id:'apex_ebs_migration', label:'EBS to APEX Migration Strategy',
    content:{
      summary:'Migrating Oracle Forms and OAF pages to APEX is the dominant modernisation strategy for EBS customers. APEX can connect directly to the EBS Oracle Database, reusing all existing PL/SQL business logic, tables, and views.',
      functional:[
        'Migration Triggers: Oracle Forms desupported in R12.2; OAF requires JDeveloper expertise; APEX = lower TCO',
        'What to migrate: Custom Forms/OAF pages first, then standard EBS Forms (Oracle provides APEX-based EBS 25 as a roadmap)',
        'As-Is vs Re-engineer: Lift and shift (replicate form behaviour in APEX) vs redesign (improve UX using APEX capabilities)',
        'Phased approach: identify high-value/high-usage custom forms → prototype in APEX → user acceptance testing → cutover',
        'APEX + EBS DB: APEX app in same DB as EBS — no data movement, no latency, full PL/SQL reuse',
        'Authentication bridge: use APEX Custom Auth Scheme calling FND_USER validation PL/SQL — EBS users log into APEX with EBS credentials',
        'EBS responsibilities → APEX roles: map EBS responsibility to APEX User Group / Authorisation Scheme'
      ],
      technical:[
        'Step 1: Install APEX in the EBS database (same DB, separate schema — does not interfere with EBS)',
        'Step 2: Create APEX workspace pointing to EBS schemas (APPS, custom XX schemas)',
        'Step 3: Create APEX Custom Authentication scheme — call fnd_user_pkg.ValidateLogin or your own PL/SQL wrapper',
        'Step 4: Build APEX app using APEX App Builder — use EBS base tables and views directly',
        'Step 5: Call EBS PL/SQL APIs from APEX Processes (e.g. hr_person_api, po_orders_pub, mo_global.set_policy_context)',
        'Step 6: Set MO context in APEX application: mo_global.set_policy_context(\'S\', :P_ORG_ID) in Application Process "Set Context"',
        'Step 7: Deploy — APEX on ORDS sitting behind same reverse proxy as EBS for seamless SSO',
        'APEX for EBS Reports: replace BIP reports with APEX Interactive Reports/Grids — live data, exportable to Excel/CSV/PDF',
        'Migration tool: Oracle Forms to APEX Migration (built into APEX) — imports .fmb file and scaffolds equivalent APEX pages'
      ],
      sql:`/* Validate EBS user from APEX custom auth */
-- Call this in APEX Authentication Scheme "Authentication Function"
CREATE OR REPLACE FUNCTION ebs_apex_auth(
  p_username IN VARCHAR2,
  p_password IN VARCHAR2
) RETURN BOOLEAN
IS
  l_result VARCHAR2(100);
BEGIN
  -- Set MO context (adjust ORG_ID as needed)
  mo_global.set_policy_context('S', 101);

  -- Validate against FND users
  -- In real impl use: fnd_user_pkg.ValidateLogin
  SELECT 'VALID'
    INTO l_result
    FROM fnd_user
   WHERE UPPER(user_name) = UPPER(p_username)
     AND NVL(end_date, SYSDATE+1) > SYSDATE;

  RETURN TRUE;
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN FALSE;
END ebs_apex_auth;
/

/* EBS tables accessible from APEX — test query */
SELECT papf.employee_number,
       papf.full_name,
       haou.name   org
  FROM apps.per_all_people_f        papf
  JOIN apps.per_all_assignments_f   paaf ON paaf.person_id = papf.person_id
  JOIN apps.hr_all_organization_units haou ON haou.organization_id = paaf.organization_id
 WHERE paaf.primary_flag  = 'Y'
   AND paaf.assignment_type = 'E'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
 ORDER BY papf.full_name;`
    }
  },
  {
    id:'apex_upgrade', label:'E-Business Suite → Oracle APEX + Fusion Roadmap',
    content:{
      summary:'The long-term Oracle EBS modernisation roadmap leads toward Oracle Cloud ERP (Fusion). Customers on EBS R12.2 can extend their investment with APEX for custom functionality while planning a phased Cloud migration.',
      functional:[
        'Oracle Roadmap: EBS R12.2 is the "indefinitely supported" on-premises path; Oracle Cloud ERP is the cloud destination',
        'Three paths: (1) Stay on EBS R12.2 + modernise with APEX, (2) Lift EBS to OCI (Oracle Cloud Infrastructure), (3) Migrate to Oracle Fusion Cloud ERP',
        'EBS on OCI: run EBS R12.2 on OCI compute — same code, cloud infrastructure benefits (auto-scaling, DR, managed DB)',
        'Coexistence: EBS + Fusion can coexist — use Integration Cloud (OIC) to bridge processes during transition',
        'APEX on OCI: Oracle APEX Application Development (Autonomous Database) — fully managed, zero administration',
        'Data migration: Oracle Data Masking, Data Pump (expdp/impdp), Oracle GoldenGate for live migration'
      ],
      technical:[
        'EBS on OCI: use Oracle\'s EBS Cloud Marketplace images — pre-configured EBS AMIs for OCI',
        'Lift to OCI: Database → OCI Exadata DB Service; Apps tier → OCI Compute (VM.Standard shapes)',
        'APEX Autonomous DB: free tier available (5 GB, 1 OCPU) — ideal for prototyping APEX replacements',
        'Oracle Migration Advisor: tool on MOS that analyses EBS customisations and estimates Fusion migration effort',
        'Data Guard on OCI: built-in HA — primary in one availability domain, standby in another',
        'EBS Integration to Fusion via OIC: OIC connects EBS Financials (AP/AR/GL) to Fusion Finance as hybrid coexistence'
      ],
      sql:`/* EBS customisation footprint — assess before Cloud migration */
SELECT fa.application_short_name,
       COUNT(DISTINCT fo.object_name)  custom_objects
  FROM fnd_application      fa
  JOIN fnd_objects          fo ON fo.application_id = fa.application_id
 WHERE fo.object_name LIKE 'XX%'   -- custom prefix
    OR fo.object_name LIKE 'ZZ%'
 GROUP BY fa.application_short_name
HAVING COUNT(DISTINCT fo.object_name) > 0
 ORDER BY custom_objects DESC;

/* Custom concurrent programs */
SELECT fa.application_short_name,
       fcp.concurrent_program_name,
       fcpv.user_concurrent_program_name,
       fcp.execution_method_code   exec_type,
       fcp.creation_date
  FROM fnd_concurrent_programs    fcp
  JOIN fnd_concurrent_programs_vl fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                      AND fcpv.application_id = fcp.application_id
  JOIN fnd_application            fa   ON fa.application_id = fcp.application_id
 WHERE fcp.concurrent_program_name LIKE 'XX%'
    OR fcp.concurrent_program_name LIKE 'ZZ%'
 ORDER BY fa.application_short_name, fcp.concurrent_program_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   13. TESTING — EBS Testing Strategy & Tools
   ══════════════════════════════════════════════════════════════════ */
{
  id:'testing', icon:'🧪', label:'Testing & QA', color:'#198038',
  desc:'EBS Testing strategy — Unit, SIT, UAT, Regression, Performance testing; OATS (Oracle Application Testing Suite); test scripts for patches and upgrades',
  topics:[
  {
    id:'test_strategy', label:'EBS Testing Strategy',
    content:{
      summary:'Testing in Oracle EBS projects requires a structured approach covering Unit Testing, System Integration Testing (SIT), User Acceptance Testing (UAT), and Regression Testing — especially after patches and upgrades.',
      functional:[
        'Test Types: Unit (developer tests single component), SIT (end-to-end process flows), UAT (business users validate), Regression (ensure no breakage after change)',
        'Test Scope for Patches: all business processes that use the patched module + any downstream impacts',
        'Test Scope for Upgrades: 100% functional coverage — every responsibility, every key transaction type',
        'UAT sign-off: business users must formally sign off before Production go-live — no exceptions',
        'Defect management: use a tool (Jira, Azure DevOps, Oracle Test Manager) — log, triage, re-test, close',
        'Regression test pack: a fixed set of test scripts run after every change — gradually automated',
        'Data masking: use masked copy of Production data for testing — never use live customer/employee data'
      ],
      technical:[
        'OATS (Oracle Application Testing Suite): Oracle\'s own test automation tool for EBS — records EBS Forms and web sessions',
        'Selenium: for OAF/HTML-based pages — use with Page Object Model for maintainability',
        'SQL validation scripts: write SQL queries to verify data at each step — counts, amounts, statuses',
        'Concurrent program testing: submit concurrent program → check status in FND_CONCURRENT_REQUESTS → validate output',
        'API testing: test PL/SQL APIs directly via SQL*Plus or SQL Developer — verify output parameters',
        'Performance testing: JMeter or OATS load test with multiple concurrent users — target: 100 users submitting concurrent requests simultaneously',
        'Test environment: dedicated non-Production instance with recent data refresh'
      ],
      sql:`/* Test script: Verify invoice creation */
-- Step 1: Count invoices before test
SELECT COUNT(*) invoices_before
  FROM ap_invoices_all
 WHERE org_id = :p_org_id
   AND creation_date >= TRUNC(SYSDATE);

-- Step 2: (Run test — create invoice in form/API)

-- Step 3: Verify invoice created
SELECT aia.invoice_num,
       aia.invoice_amount,
       aia.approval_status_lookup_code,
       aia.payment_status_flag,
       aia.creation_date
  FROM ap_invoices_all aia
 WHERE aia.org_id = :p_org_id
   AND aia.creation_date >= TRUNC(SYSDATE)
 ORDER BY aia.creation_date DESC;

/* Verify concurrent program completed successfully */
SELECT fcr.request_id,
       DECODE(fcr.status_code,'C','Complete','E','Error','R','Running',fcr.status_code) status,
       fcr.actual_start_date,
       fcr.actual_completion_date,
       fcr.logfile_name
  FROM fnd_concurrent_requests fcr
 WHERE fcr.request_id = :p_request_id;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   14. SECURITY — EBS Security Model
   ══════════════════════════════════════════════════════════════════ */
{
  id:'security', icon:'🔐', label:'Security & Access Control', color:'#8A3800',
  desc:'EBS Security model — Users, Responsibilities, Menus, Functions, Data Security, Row-Level Security, and Audit Trail',
  topics:[
  {
    id:'sec_model', label:'EBS Security Architecture',
    content:{
      summary:'Oracle EBS security is based on a layered model: FND Users authenticate, Responsibilities control menu access, Functions gate individual pages/reports, and Data Security restricts which rows a user can see.',
      functional:[
        'FND User: every person who logs into EBS has an FND_USER record with USER_NAME and encrypted password',
        'Responsibility: a bundle of access rights — linked to a Menu, a Data Group, and a Request Group (concurrent programs)',
        'Menu: tree of Functions; a user with a Responsibility sees only the Menu items linked to that Responsibility',
        'Function: a single navigable unit — a Form, OAF Page, Report, or concurrent program',
        'Request Group: set of concurrent programs a Responsibility can submit',
        'Data Group: maps application to DB schema (almost always APPS schema)',
        'Security Profile: HRMS concept — restricts which employees a user can see (by org, supervisor hierarchy)',
        'Exclusions: you can exclude specific Functions or Menu entries from a Responsibility — faster than creating a new Responsibility'
      ],
      technical:[
        'FND_USERS: username, encrypted_foundation_password, start_date, end_date',
        'FND_RESPONSIBILITY_VL: responsibility_id, responsibility_name, menu_id, request_group_id',
        'FND_USER_RESP_GROUPS_ALL: user_id → responsibility_id mapping (with start_date/end_date)',
        'FND_MENUS / FND_MENU_ENTRIES: tree of menu nodes linking to functions',
        'FND_FORM_FUNCTIONS: each function — name, type (FORM/JSP/SSWA), HTML call / form name',
        'FND_RESP_FUNCTIONS: function exclusions per responsibility',
        'FND_PROFILE_OPTION_VALUES: security profile, MO policy, and all other profile options per user/responsibility/site',
        'Audit Trail: FND_AUDIT_TABLES / FND_AUDIT_COLUMNS — configure which columns to audit; AUD$ for Oracle DB audit',
        'Password policy: FND_USER signon_password_expiration_date; configure in Security profile option'
      ],
      sql:`/* User → Responsibility mapping */
SELECT fu.user_name,
       fu.email_address,
       frg.responsibility_name,
       fa.application_short_name,
       furg.start_date,
       furg.end_date,
       CASE WHEN NVL(furg.end_date,SYSDATE+1) > SYSDATE
            THEN 'ACTIVE' ELSE 'EXPIRED' END  status
  FROM fnd_users               fu
  JOIN fnd_user_resp_groups_all furg ON furg.user_id = fu.user_id
  JOIN fnd_responsibility_vl   frg  ON frg.responsibility_id = furg.responsibility_id
                                    AND frg.application_id   = furg.responsibility_application_id
  JOIN fnd_application         fa   ON fa.application_id = frg.application_id
 ORDER BY fu.user_name, frg.responsibility_name;

/* Functions excluded from a responsibility */
SELECT frg.responsibility_name,
       fff.function_name,
       fff.user_function_name,
       frf.rule_type  -- FUNCTION or MENU exclusion
  FROM fnd_resp_functions      frf
  JOIN fnd_responsibility_vl   frg ON frg.responsibility_id = frf.responsibility_id
  JOIN fnd_form_functions      fff ON fff.function_id = frf.action_id
 ORDER BY frg.responsibility_name;`
    }
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   15. PROJECT MANAGER — EBS Implementation Guide
   ══════════════════════════════════════════════════════════════════ */
{
  id:'pm', icon:'📋', label:'Project Manager Guide', color:'#4589FF',
  desc:'EBS implementation methodology, AIM/OUM/AIM for EBS, project phases, team structure, go-live checklist, risk management, and post-go-live support',
  topics:[
  {
    id:'pm_methodology', label:'EBS Implementation Methodology',
    content:{
      summary:'Oracle EBS implementations follow structured methodologies — most commonly Oracle Unified Method (OUM) or AIM (Application Implementation Methodology). Every project has 5 core phases regardless of methodology.',
      functional:[
        'Phase 1 — Inception/Scope: Define project scope, team, timeline, budget; identify integrations and customisations',
        'Phase 2 — Definition/Fit-Gap: Map business processes to EBS standard functionality; identify gaps requiring customisation',
        'Phase 3 — Build/Configuration: Configure EBS (setups), develop customisations, build integrations, create reports',
        'Phase 4 — Testing: SIT (System Integration Testing), UAT (User Acceptance Testing), Performance testing',
        'Phase 5 — Deploy/Go-Live: Data migration, cutover planning, training, go-live, hypercare support',
        'Workstreams: Functional (module configuration), Technical (customisations), Infrastructure (DBA/server), PMO (governance)',
        'Key Artifacts: Business Requirements Document (BRD), Functional Design Document (FDD), Technical Design Document (TDD), Test Scripts, Cut-Over Plan'
      ],
      technical:[
        'EBS Conference Room Pilot (CRP): configure a prototype EBS environment and walk through key business scenarios with business users',
        'CRP 1: core setups; CRP 2: end-to-end process with real data; CRP 3: near-production rehearsal',
        'Data Migration: legacy data cleansed, transformed, and loaded via Open Interfaces / Custom scripts',
        'Cut-Over Plan: detailed sequence of tasks (with owner + duration) for the final go-live weekend',
        'Go-Live Decision Gate: sign-off from business, IT, management — all UAT complete, data migrated, users trained',
        'Hypercare: 2–4 week intensive support post go-live — key team members on standby',
        'RAID Log: Risks, Assumptions, Issues, Dependencies — updated weekly in project status meeting'
      ],
      sql:`/* Project tracking — concurrent programs run today (go-live monitoring) */
SELECT fcpv.user_concurrent_program_name,
       COUNT(*)                                          runs_today,
       SUM(CASE WHEN fcr.status_code = 'C' THEN 1 ELSE 0 END) completed,
       SUM(CASE WHEN fcr.status_code = 'E' THEN 1 ELSE 0 END) errored,
       SUM(CASE WHEN fcr.status_code = 'R' THEN 1 ELSE 0 END) running
  FROM fnd_concurrent_requests    fcr
  JOIN fnd_concurrent_programs_vl fcpv ON fcpv.concurrent_program_id = fcr.concurrent_program_id
 WHERE fcr.actual_start_date >= TRUNC(SYSDATE)
 GROUP BY fcpv.user_concurrent_program_name
 ORDER BY runs_today DESC;`
    }
  }
  ]
}

] /* end modules */

}; /* end window.EBS_ACADEMY */

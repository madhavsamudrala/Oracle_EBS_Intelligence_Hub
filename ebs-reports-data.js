/* ═══════════════════════════════════════════════════════════════════
   Oracle EBS Intelligence Hub — Sample Data (100 records per report)
   Version: 6.0  |  Oracle EBS R12 Enterprise Suite
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Utility ────────────────────────────────────────────────────── */
function rnd(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function fmt(n){return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtDate(y,m,d){return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}

/* Current year constants — keeps all demo data in sync with today's date */
const CY  = new Date().getFullYear();      // e.g. 2025
const CY1 = CY - 1;                        // e.g. 2024
const CY2 = CY - 2;                        // e.g. 2023
const CY3 = CY - 3;                        // e.g. 2022

const SUPPLIERS = ['Accenture Inc','Deloitte Consulting','IBM Global Services','Oracle America',
  'SAP SE','Microsoft Corp','Cisco Systems','Dell Technologies','HP Inc','Infosys Ltd',
  'Wipro Ltd','TCS Americas','Capgemini US','Cognizant Tech','Unisys Corp',
  'Booz Allen Hamilton','Leidos Holdings','ManTech Intl','SAIC Inc','Perspecta Inc',
  'General Dynamics IT','CSRA LLC','DXC Technology','Atos SE','CGI Federal',
  'Maximus Federal','ICF International','Engility Corp','Alion Science','Battelle Memorial',
  'Jacobs Engr','AECOM Tech','Parsons Corp','KBR Inc','Fluor Corp',
  'Burns & McDonnell','Tetra Tech','WSP USA','HDR Inc','Michael Baker Intl',
  'Amazon Web Services','Salesforce.com','ServiceNow Inc','Workday Inc','Adobe Systems',
  'Splunk Inc','CrowdStrike','Palo Alto Networks','Fortinet Inc','Zscaler Inc'];

const EMPLOYEES = ['James Wilson','Sarah Johnson','Michael Chen','Emily Davis','Robert Brown',
  'Linda Martinez','David Anderson','Patricia Taylor','Christopher Moore','Barbara Jackson',
  'Richard Harris','Susan Thompson','Joseph White','Jessica Garcia','Thomas Martinez',
  'Karen Robinson','Charles Clark','Nancy Lewis','Daniel Walker','Karen Hall',
  'Matthew Allen','Betty Young','Mark Hernandez','Dorothy King','Donald Wright',
  'Sandra Lopez','Paul Hill','Donna Scott','Mark Green','Carol Adams',
  'Kevin Baker','Ruth Gonzalez','Brian Nelson','Sharon Carter','George Mitchell',
  'Michelle Perez','Edward Roberts','Laura Turner','Ronald Phillips','Stephanie Campbell',
  'Timothy Parker','Joyce Evans','Kenneth Edwards','Frances Collins','Frank Stewart',
  'Evelyn Sanchez','Raymond Morris','Judith Rogers','Gregory Reed','Joan Cook'];

const DEPARTMENTS = ['Finance','Information Technology','Human Resources','Legal','Operations',
  'Procurement','Accounting','Audit','Compliance','Administration',
  'Engineering','Research & Development','Sales','Marketing','Customer Service'];

const OU_LIST = ['Cook County Primary (CCP)','Cook County Health (CCH)','Cook County Finance (CCF)'];
const COST_CENTERS = ['CC-1001','CC-1002','CC-1003','CC-2001','CC-2002','CC-3001','CC-3002','CC-4001'];
const GL_ACCOUNTS = ['01-000-5100-0000','01-000-5200-0000','01-000-5300-0000','01-000-6100-0000',
                     '01-000-6200-0000','01-000-7100-0000','01-100-5100-0000','01-200-5200-0000'];
const PO_TYPES = ['Standard','Blanket Release','Contract','Planned'];
const INVOICE_TYPES = ['Standard','Credit','Prepayment','Mixed'];
const PAY_METHODS = ['Check','Wire Transfer','EFT','ACH'];
const APPROVAL_STATUS = ['Approved','Pending','Rejected','On Hold','In Progress'];
const EMP_STATUS = ['Active','Terminated','Leave of Absence','Suspended'];
const EXPENSE_TYPES = ['Travel','Meals & Entertainment','Office Supplies','Training','Mileage','Hotel','Airfare','Conference'];

/* ─── SUPPLIERS REPORT (100 rows) ────────────────────────────────── */
window.REPORT_DATA = {};

window.REPORT_DATA.suppliers_list = {
  title: 'Suppliers Report',
  module: 'Accounts Payable',
  columns: ['Supplier ID','Supplier Name','Type','Status','TIN/Tax ID','Country','State','City','Phone','Hold Status','Sites','Created Date'],
  sql: `SELECT aps.vendor_id,
       aps.vendor_name,
       aps.vendor_type_lookup_code  vendor_type,
       aps.enabled_flag             status,
       aps.num_1099                 tax_id,
       aps.country,
       apss.state,
       apss.city,
       aps.phone,
       aps.hold_flag,
       COUNT(apss.vendor_site_id)   site_count,
       aps.creation_date
FROM   ap_suppliers          aps
JOIN   ap_supplier_sites_all apss ON apss.vendor_id = aps.vendor_id
WHERE  aps.enabled_flag = 'Y'
GROUP BY aps.vendor_id, aps.vendor_name, aps.vendor_type_lookup_code,
         aps.enabled_flag, aps.num_1099, aps.country, apss.state,
         apss.city, aps.phone, aps.hold_flag, aps.creation_date
ORDER BY aps.vendor_name`,
  rows: Array.from({length:100},(_,i)=>{
    const s=SUPPLIERS[i%SUPPLIERS.length];
    return [10000+i,s,['VENDOR','EMPLOYEE','PARTY'][i%3],'Active',`${rnd(10,99)}-${rnd(1000000,9999999)}`,
      'US',['IL','TX','CA','NY','VA'][i%5],['Chicago','Dallas','San Jose','New York','Arlington'][i%5],
      `312-${rnd(100,999)}-${rnd(1000,9999)}`,i%15===0?'Y':'N',rnd(1,8),fmtDate(CY1-2+i%4,rnd(1,12),rnd(1,28))];
  })
};

/* ─── HIGH PAYMENT SUPPLIERS (100 rows) ──────────────────────────── */
window.REPORT_DATA.suppliers_high_payments = {
  title: 'Suppliers Received High Payments (Last 3 Fiscal Years)',
  module: 'Accounts Payable',
  columns: ['Vendor ID','Vendor Name',`FY${CY3} Amount`,`FY${CY2} Amount`,`FY${CY1} Amount`,'Total 3Y Payments','Invoice Count','Avg Invoice','Last Payment Date','Rank'],
  sql: `SELECT aps.vendor_id,
       aps.vendor_name,
       SUM(CASE WHEN EXTRACT(YEAR FROM apia.invoice_date)=2022
                THEN apia.invoice_amount ELSE 0 END) fy2022,
       SUM(CASE WHEN EXTRACT(YEAR FROM apia.invoice_date)=2023
                THEN apia.invoice_amount ELSE 0 END) fy2023,
       SUM(CASE WHEN EXTRACT(YEAR FROM apia.invoice_date)=2024
                THEN apia.invoice_amount ELSE 0 END) fy2024,
       SUM(apia.invoice_amount)        total_3y,
       COUNT(apia.invoice_id)          invoice_count,
       AVG(apia.invoice_amount)        avg_invoice,
       MAX(apc.check_date)             last_payment_date,
       RANK() OVER (ORDER BY SUM(apia.invoice_amount) DESC) rnk
FROM   ap_invoices_all     apia
JOIN   ap_suppliers        aps  ON aps.vendor_id  = apia.vendor_id
JOIN   ap_invoice_payments apip ON apip.invoice_id = apia.invoice_id
JOIN   ap_checks_all       apc  ON apc.check_id   = apip.check_id
WHERE  apia.invoice_date >= ADD_MONTHS(SYSDATE,-36)
AND    apia.payment_status_flag = 'Y'
GROUP BY aps.vendor_id, aps.vendor_name
ORDER BY total_3y DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const fy22=rnd(50000,2000000); const fy23=rnd(60000,2200000); const fy24=rnd(70000,2500000);
    const total=fy22+fy23+fy24; const cnt=rnd(10,200);
    return [10000+i,SUPPLIERS[i%SUPPLIERS.length],`$${fmt(fy22)}`,`$${fmt(fy23)}`,`$${fmt(fy24)}`,
      `$${fmt(total)}`,cnt,`$${fmt(total/cnt)}`,fmtDate(CY1,rnd(1,12),rnd(1,28)),i+1];
  })
};

/* ─── SUPPLIER PAID INVOICE HISTORY (100 rows) ───────────────────── */
window.REPORT_DATA.supplier_paid_invoice_history = {
  title: 'Supplier Paid Invoice History Report',
  module: 'Accounts Payable',
  columns: ['Invoice ID','Invoice Num','Vendor Name','Invoice Date','Invoice Type','Invoice Amount','Amount Paid','Payment Date','Check Number','Payment Method','Status'],
  sql: `SELECT apia.invoice_id,
       apia.invoice_num,
       aps.vendor_name,
       apia.invoice_date,
       apia.invoice_type_lookup_code invoice_type,
       apia.invoice_amount,
       apia.amount_paid,
       apc.check_date payment_date,
       apc.check_number,
       apc.payment_method_code,
       apia.payment_status_flag
FROM   ap_invoices_all     apia
JOIN   ap_suppliers        aps  ON aps.vendor_id   = apia.vendor_id
JOIN   ap_invoice_payments apip ON apip.invoice_id = apia.invoice_id
JOIN   ap_checks_all       apc  ON apc.check_id    = apip.check_id
WHERE  apia.payment_status_flag IN ('Y','P')
AND    apc.check_date BETWEEN :p_start_date AND :p_end_date
ORDER BY apc.check_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const amt=rnd(500,150000);
    return [200000+i,`INV-${CY}-${String(i+1).padStart(5,'0')}`,SUPPLIERS[i%SUPPLIERS.length],
      fmtDate(CY,rnd(1,12),rnd(1,28)),INVOICE_TYPES[i%4],`$${fmt(amt)}`,`$${fmt(amt)}`,
      fmtDate(CY,rnd(1,12),rnd(1,28)),`CHK-${rnd(100000,999999)}`,PAY_METHODS[i%4],'Fully Paid'];
  })
};

/* ─── SUPPLIER PAYMENT HISTORY (100 rows) ───────────────────────── */
window.REPORT_DATA.supplier_payment_history = {
  title: 'Supplier Payment History Report',
  module: 'Accounts Payable',
  columns: ['Check ID','Check Number','Vendor Name','Check Date','Check Amount','Bank Account','Currency','Void Flag','Payment Batch','OU Name'],
  sql: `SELECT apc.check_id,
       apc.check_number,
       aps.vendor_name,
       apc.check_date,
       apc.amount check_amount,
       apc.bank_account_name,
       apc.currency_code,
       apc.void_flag,
       aba.name payment_batch,
       haou.name ou_name
FROM   ap_checks_all        apc
JOIN   ap_suppliers         aps  ON aps.vendor_id    = apc.vendor_id
JOIN   ap_batches_all       aba  ON aba.batch_id     = apc.future_pay_due_date
JOIN   hr_all_organization_units haou ON haou.organization_id = apc.org_id
WHERE  apc.status_lookup_code = 'CLEARED'
ORDER BY apc.check_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    return [300000+i,`CHK-${rnd(100000,999999)}`,SUPPLIERS[i%SUPPLIERS.length],
      fmtDate(CY,rnd(1,12),rnd(1,28)),`$${fmt(rnd(1000,500000))}`,
      `BANK-ACCT-${rnd(1000,9999)}`,'USD',i%20===0?'Y':'N',
      `BATCH-${rnd(100,999)}`,OU_LIST[i%3]];
  })
};

/* ─── SUPPLIER AUDIT (100 rows) ─────────────────────────────────── */
window.REPORT_DATA.supplier_audit = {
  title: 'Supplier Audit Report',
  module: 'Accounts Payable',
  columns: ['Audit ID','Vendor Name','Field Changed','Old Value','New Value','Changed By','Change Date','Change Type','Reason','IP Address'],
  sql: `SELECT faa.audit_id,
       aps.vendor_name,
       fac.column_name field_changed,
       faa.old_value,
       faa.new_value,
       fu.user_name changed_by,
       faa.last_update_date change_date,
       faa.audit_transaction_type change_type,
       faa.last_update_login,
       NULL ip_address
FROM   fnd_audit_trail faa
JOIN   fnd_audit_columns fac ON fac.table_app_id = faa.table_app_id
JOIN   ap_suppliers      aps ON TO_CHAR(aps.vendor_id) = faa.row_key
JOIN   fnd_user          fu  ON fu.user_id = faa.last_updated_by
WHERE  fac.table_name = 'AP_SUPPLIERS'
ORDER BY faa.last_update_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const fields=['VENDOR_NAME','HOLD_FLAG','ENABLED_FLAG','NUM_1099','PAYMENT_METHOD','BANK_ACCOUNT'];
    return [900000+i,SUPPLIERS[i%SUPPLIERS.length],fields[i%fields.length],
      `Old_Value_${i}`,'New_Value_'+i,EMPLOYEES[i%EMPLOYEES.length].split(' ')[0].toUpperCase(),
      fmtDate(CY,rnd(1,12),rnd(1,28)),['INSERT','UPDATE','DELETE'][i%3],
      'Routine Update',`192.168.${rnd(1,10)}.${rnd(1,254)}`];
  })
};

/* ─── PO DETAIL (100 rows) ───────────────────────────────────────── */
window.REPORT_DATA.po_detail = {
  title: 'Purchase Order Detail Report',
  module: 'Purchasing',
  columns: ['PO Number','PO Type','Vendor Name','Buyer','PO Date','Ship-To','Quantity','Unit Price','Line Total','Approved Status','Need By Date','Description'],
  sql: `SELECT poh.segment1             po_number,
       poh.type_lookup_code      po_type,
       aps.vendor_name,
       ppf.full_name             buyer_name,
       poh.creation_date         po_date,
       hl.location_code          ship_to,
       pol.quantity,
       pol.unit_price,
       pol.quantity * pol.unit_price line_total,
       poh.authorization_status  approved_status,
       pol.need_by_date,
       pol.item_description
FROM   po_headers_all   poh
JOIN   po_lines_all     pol  ON pol.po_header_id = poh.po_header_id
JOIN   ap_suppliers     aps  ON aps.vendor_id    = poh.vendor_id
JOIN   per_people_f     ppf  ON ppf.person_id    = poh.agent_id
JOIN   hr_locations_all hl   ON hl.location_id   = pol.ship_to_location_id
WHERE  poh.org_id = :p_org_id
AND    poh.creation_date BETWEEN :p_start AND :p_end
ORDER BY poh.creation_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const qty=rnd(1,500); const price=rnd(100,50000);
    return [`PO-${CY}-${String(i+1).padStart(5,'0')}`,PO_TYPES[i%4],SUPPLIERS[i%SUPPLIERS.length],
      EMPLOYEES[i%EMPLOYEES.length],fmtDate(CY,rnd(1,12),rnd(1,28)),'CHICAGO-MAIN',
      qty,`$${fmt(price)}`,`$${fmt(qty*price)}`,APPROVAL_STATUS[i%5],
      fmtDate(CY,rnd(1,12),rnd(1,28)),`IT Services - Lot ${i+1}`];
  })
};

/* ─── PO DISTRIBUTION (100 rows) ────────────────────────────────── */
window.REPORT_DATA.po_distribution = {
  title: 'Purchase Order Distribution Detail Report',
  module: 'Purchasing',
  columns: ['PO Number','Line#','Distribution#','GL Account','Cost Center','Fund','Amount','Quantity Ordered','Quantity Billed','Encumbrance Amount','Project','Task'],
  sql: `SELECT poh.segment1        po_number,
       pol.line_num          line_num,
       pod.distribution_num  dist_num,
       gcc.concatenated_segments gl_account,
       pod.code_combination_id,
       pod.award_id          fund,
       pod.amount_ordered    amount,
       pod.quantity_ordered,
       pod.quantity_billed,
       pod.encumbered_amount,
       pp.project_number,
       pt.task_number
FROM   po_distributions_all pod
JOIN   po_headers_all       poh ON poh.po_header_id  = pod.po_header_id
JOIN   po_lines_all         pol ON pol.po_line_id    = pod.po_line_id
JOIN   gl_code_combinations gcc ON gcc.code_combination_id = pod.code_combination_id
LEFT   JOIN pa_projects_all pp  ON pp.project_id    = pod.project_id
LEFT   JOIN pa_tasks        pt  ON pt.task_id       = pod.task_id
WHERE  poh.org_id = :p_org_id
ORDER BY poh.segment1, pol.line_num, pod.distribution_num`,
  rows: Array.from({length:100},(_,i)=>{
    const amt=rnd(500,200000);
    return [`PO-${CY}-${String(Math.floor(i/3)+1).padStart(5,'0')}`,
      (i%3)+1,(i%2)+1,GL_ACCOUNTS[i%GL_ACCOUNTS.length],
      COST_CENTERS[i%COST_CENTERS.length],`FUND-${rnd(41000,43000)}`,
      `$${fmt(amt)}`,rnd(1,200),rnd(0,200),`$${fmt(amt*0.85)}`,
      `PROJ-${rnd(1000,9999)}`,`TASK-${rnd(100,999)}`];
  })
};

/* ─── RECEIPT ADJUSTMENTS (100 rows) ────────────────────────────── */
window.REPORT_DATA.receipt_adjustments = {
  title: 'Receipt Adjustments Report',
  module: 'Purchasing',
  columns: ['Receipt Number','PO Number','Vendor Name','Item Description','Ordered Qty','Received Qty','Adjustment Qty','Adjustment Reason','Adjustment Date','Status'],
  sql: `SELECT rsh.receipt_num,
       poh.segment1           po_number,
       aps.vendor_name,
       pol.item_description,
       pol.quantity           ordered_qty,
       rt.quantity            received_qty,
       rca.adjustment_quantity,
       rca.reason_code,
       rca.creation_date      adjustment_date,
       rca.status_code
FROM   rcv_shipment_headers  rsh
JOIN   rcv_transactions      rt  ON rt.shipment_header_id = rsh.shipment_header_id
JOIN   rcv_corrections       rca ON rca.transaction_id    = rt.transaction_id
JOIN   po_headers_all        poh ON poh.po_header_id      = rt.po_header_id
JOIN   po_lines_all          pol ON pol.po_line_id        = rt.po_line_id
JOIN   ap_suppliers          aps ON aps.vendor_id         = poh.vendor_id
WHERE  rca.creation_date >= ADD_MONTHS(SYSDATE,-12)
ORDER BY rca.creation_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const ord=rnd(50,500); const rcv=ord-rnd(1,20);
    return [`RCV-${rnd(100000,999999)}`,`PO-${CY}-${String(i+1).padStart(5,'0')}`,
      SUPPLIERS[i%SUPPLIERS.length],`Item Description ${i+1}`,ord,rcv,rcv-ord,
      ['Short Shipment','Damaged Goods','Wrong Item','Quality Reject'][i%4],
      fmtDate(CY,rnd(1,12),rnd(1,28)),['Pending','Processed','Approved'][i%3]];
  })
};

/* ─── SAVINGS ANALYSIS (100 rows) ────────────────────────────────── */
window.REPORT_DATA.savings_analysis = {
  title: 'Savings Analysis Report (By Buyer / Category)',
  module: 'Purchasing',
  columns: ['Buyer Name','Category','Vendor Name','Target Price','Actual Price','Qty Purchased','List Savings','Negotiated Savings','Total Savings','Savings %','FY Period'],
  sql: `SELECT ppf.full_name          buyer_name,
       mcat.category_concat_segs category,
       aps.vendor_name,
       pol.list_price_per_unit   target_price,
       pol.unit_price            actual_price,
       pol.quantity,
       (pol.list_price_per_unit - pol.unit_price)*pol.quantity savings,
       pol.negotiated_by_preparer_flag,
       pol.quantity*(pol.list_price_per_unit - pol.unit_price) total_savings,
       ROUND((1 - pol.unit_price/NULLIF(pol.list_price_per_unit,0))*100,2) pct_savings,
       TO_CHAR(poh.creation_date,'YYYY-MM') fy_period
FROM   po_lines_all     pol
JOIN   po_headers_all   poh  ON poh.po_header_id = pol.po_header_id
JOIN   ap_suppliers     aps  ON aps.vendor_id    = poh.vendor_id
JOIN   per_people_f     ppf  ON ppf.person_id    = poh.agent_id
JOIN   mtl_categories   mcat ON mcat.category_id = pol.category_id
WHERE  pol.list_price_per_unit IS NOT NULL
ORDER BY total_savings DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const list=rnd(1000,50000); const actual=list*0.75; const qty=rnd(5,200);
    const savings=(list-actual)*qty;
    return [EMPLOYEES[i%EMPLOYEES.length],['IT Hardware','Software','Professional Svcs','Office','Facilities'][i%5],
      SUPPLIERS[i%SUPPLIERS.length],`$${fmt(list)}`,`$${fmt(actual)}`,qty,
      `$${fmt(list*qty)}`,`$${fmt(actual*qty)}`,`$${fmt(savings)}`,
      `${fmt(25)}%`,`${CY}-${String(rnd(1,12)).padStart(2,'0')}`];
  })
};

/* ─── AGED PAYABLES DETAIL (100 rows) ───────────────────────────── */
window.REPORT_DATA.aged_payables_detail = {
  title: 'Aged Payables Detail Report',
  module: 'Accounts Payable',
  columns: ['Vendor Name','Invoice Number','Invoice Date','Due Date','Invoice Amount','Current (0-30)','31-60 Days','61-90 Days','91-120 Days','Over 120 Days','Total Outstanding'],
  sql: `SELECT aps.vendor_name,
       apia.invoice_num,
       apia.invoice_date,
       apit.due_date,
       apia.invoice_amount,
       CASE WHEN SYSDATE-apit.due_date <= 30  THEN apit.amount_remaining ELSE 0 END cur_bucket,
       CASE WHEN SYSDATE-apit.due_date BETWEEN 31 AND 60 THEN apit.amount_remaining ELSE 0 END b30_60,
       CASE WHEN SYSDATE-apit.due_date BETWEEN 61 AND 90 THEN apit.amount_remaining ELSE 0 END b61_90,
       CASE WHEN SYSDATE-apit.due_date BETWEEN 91 AND 120 THEN apit.amount_remaining ELSE 0 END b91_120,
       CASE WHEN SYSDATE-apit.due_date > 120 THEN apit.amount_remaining ELSE 0 END over120,
       apit.amount_remaining total_outstanding
FROM   ap_invoices_all      apia
JOIN   ap_suppliers         aps  ON aps.vendor_id  = apia.vendor_id
JOIN   ap_payment_schedules apit ON apit.invoice_id = apia.invoice_id
WHERE  apit.payment_status_flag != 'Y'
AND    apia.org_id = :p_org_id
ORDER BY aps.vendor_name, apit.due_date`,
  rows: Array.from({length:100},(_,i)=>{
    const total=rnd(5000,500000);
    const buckets=[0,0,0,0,0]; buckets[i%5]=total;
    return [SUPPLIERS[i%SUPPLIERS.length],`INV-${rnd(100000,999999)}`,
      fmtDate(CY,rnd(1,12),rnd(1,28)),fmtDate(CY,rnd(1,12),rnd(1,28)),
      `$${fmt(total)}`,`$${fmt(buckets[0])}`,`$${fmt(buckets[1])}`,
      `$${fmt(buckets[2])}`,`$${fmt(buckets[3])}`,`$${fmt(buckets[4])}`,`$${fmt(total)}`];
  })
};

/* ─── AGED PAYABLES SUMMARY (100 rows) ──────────────────────────── */
window.REPORT_DATA.aged_payables_summary = {
  title: 'Aged Payables Summary Report',
  module: 'Accounts Payable',
  columns: ['Vendor Name','Vendor Type','Invoice Count','Total Outstanding','0-30 Days','31-60 Days','61-90 Days','Over 90 Days','Last Invoice Date'],
  sql: `SELECT aps.vendor_name,
       aps.vendor_type_lookup_code,
       COUNT(apia.invoice_id)     invoice_count,
       SUM(apit.amount_remaining) total_outstanding,
       SUM(CASE WHEN SYSDATE-apit.due_date<=30 THEN apit.amount_remaining ELSE 0 END) cur_30,
       SUM(CASE WHEN SYSDATE-apit.due_date BETWEEN 31 AND 60 THEN apit.amount_remaining ELSE 0 END) b31_60,
       SUM(CASE WHEN SYSDATE-apit.due_date BETWEEN 61 AND 90 THEN apit.amount_remaining ELSE 0 END) b61_90,
       SUM(CASE WHEN SYSDATE-apit.due_date>90 THEN apit.amount_remaining ELSE 0 END) over90,
       MAX(apia.invoice_date) last_invoice_date
FROM   ap_invoices_all      apia
JOIN   ap_suppliers         aps  ON aps.vendor_id  = apia.vendor_id
JOIN   ap_payment_schedules apit ON apit.invoice_id = apia.invoice_id
WHERE  apit.payment_status_flag != 'Y'
GROUP BY aps.vendor_name, aps.vendor_type_lookup_code
ORDER BY total_outstanding DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const total=rnd(10000,2000000); const c1=total*0.4; const c2=total*0.3; const c3=total*0.2; const c4=total*0.1;
    return [SUPPLIERS[i%SUPPLIERS.length],'VENDOR',rnd(5,80),`$${fmt(total)}`,
      `$${fmt(c1)}`,`$${fmt(c2)}`,`$${fmt(c3)}`,`$${fmt(c4)}`,fmtDate(CY,rnd(1,12),rnd(1,28))];
  })
};

/* ─── AP TRIAL BALANCE (100 rows) ───────────────────────────────── */
window.REPORT_DATA.ap_trial_balance = {
  title: 'Accounts Payable Trial Balance',
  module: 'Accounts Payable',
  columns: ['Vendor Name','GL Account','Liability Balance','Prepayment Balance','Discount Available','Net Balance','Period Name','OU Name'],
  sql: `SELECT aps.vendor_name,
       gcc.concatenated_segments gl_account,
       SUM(CASE WHEN aca.accounting_class_code='LIABILITY'
                THEN aca.accounted_cr - aca.accounted_dr ELSE 0 END) liability_bal,
       SUM(CASE WHEN aca.accounting_class_code='PREPAID'
                THEN aca.accounted_cr - aca.accounted_dr ELSE 0 END) prepay_bal,
       SUM(DECODE(aca.accounting_class_code,'DISCOUNT',aca.accounted_cr,0)) disc_avail,
       SUM(aca.accounted_cr - aca.accounted_dr) net_bal,
       gp.period_name,
       haou.name ou_name
FROM   ap_ae_lines_all        aca
JOIN   ap_ae_headers_all      ach  ON ach.ae_header_id = aca.ae_header_id
JOIN   ap_invoices_all        apia ON apia.invoice_id  = ach.source_id
JOIN   ap_suppliers           aps  ON aps.vendor_id    = apia.vendor_id
JOIN   gl_code_combinations   gcc  ON gcc.code_combination_id = aca.code_combination_id
JOIN   gl_periods             gp   ON gp.period_name   = ach.period_name
JOIN   hr_all_organization_units haou ON haou.organization_id = apia.org_id
WHERE  gp.period_name = :p_period
GROUP BY aps.vendor_name, gcc.concatenated_segments, gp.period_name, haou.name
ORDER BY aps.vendor_name`,
  rows: Array.from({length:100},(_,i)=>{
    const lib=rnd(5000,500000); const pre=rnd(0,50000);
    return [SUPPLIERS[i%SUPPLIERS.length],GL_ACCOUNTS[i%GL_ACCOUNTS.length],
      `$${fmt(lib)}`,`$${fmt(pre)}`,`$${fmt(lib*0.02)}`,`$${fmt(lib+pre)}`,
      `${CY}-${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][i%12]}`,OU_LIST[i%3]];
  })
};

/* ─── INVOICE REGISTER (100 rows) ───────────────────────────────── */
window.REPORT_DATA.invoice_register = {
  title: 'Invoice Register',
  module: 'Accounts Payable',
  columns: ['Invoice ID','Invoice Num','Vendor Name','Invoice Date','Invoice Type','Invoice Amount','Tax Amount','Freight','Net Amount','Payment Status','GL Period','Batch Name'],
  sql: `SELECT apia.invoice_id,
       apia.invoice_num,
       aps.vendor_name,
       apia.invoice_date,
       apia.invoice_type_lookup_code,
       apia.invoice_amount,
       apia.total_tax_amount,
       apia.freight_amount,
       apia.invoice_amount - NVL(apia.total_tax_amount,0) - NVL(apia.freight_amount,0) net_amount,
       apia.payment_status_flag,
       apia.gl_date_period_name,
       aba.name batch_name
FROM   ap_invoices_all apia
JOIN   ap_suppliers    aps ON aps.vendor_id = apia.vendor_id
LEFT   JOIN ap_batches_all aba ON aba.batch_id = apia.batch_id
WHERE  apia.org_id = :p_org_id
AND    apia.invoice_date BETWEEN :p_start AND :p_end
ORDER BY apia.invoice_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const inv=rnd(1000,200000); const tax=inv*0.085; const frt=rnd(0,500);
    return [400000+i,`INV-${CY}-${String(i+1).padStart(5,'0')}`,SUPPLIERS[i%SUPPLIERS.length],
      fmtDate(CY,rnd(1,12),rnd(1,28)),INVOICE_TYPES[i%4],`$${fmt(inv)}`,`$${fmt(tax)}`,
      `$${fmt(frt)}`,`$${fmt(inv-tax-frt)}`,['Y','N','P'][i%3],
      `${CY}-${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][i%12]}`,
      `BATCH-${rnd(100,999)}`];
  })
};

/* ─── WITHHOLDING TAX (100 rows) ────────────────────────────────── */
window.REPORT_DATA.withholding_tax = {
  title: 'Withholding Tax by Supplier Report',
  module: 'Accounts Payable',
  columns: ['Vendor Name','TIN/Tax ID','1099 Type','Tax Code','Taxable Amount','Withheld Amount','Tax Rate','Payment Date','Invoice Number','GL Account'],
  sql: `SELECT aps.vendor_name,
       aps.num_1099           tin,
       aps.vendor_1099        type_1099,
       awt.tax_name           tax_code,
       apwt.taxable_base_amount,
       apwt.withheld_amount,
       awt.percentage_rate    tax_rate,
       apc.check_date         payment_date,
       apia.invoice_num,
       gcc.concatenated_segments gl_account
FROM   ap_invoices_all              apia
JOIN   ap_suppliers                 aps  ON aps.vendor_id = apia.vendor_id
JOIN   ap_invoice_payments          apip ON apip.invoice_id = apia.invoice_id
JOIN   ap_checks_all                apc  ON apc.check_id   = apip.check_id
JOIN   ap_awt_tax_rates_history     apwt ON apwt.invoice_id = apia.invoice_id
JOIN   ap_tax_codes_all             awt  ON awt.tax_id      = apwt.tax_code_id
JOIN   gl_code_combinations         gcc  ON gcc.code_combination_id = apwt.awt_related_id
WHERE  aps.allow_awt_flag = 'Y'
ORDER BY aps.vendor_name, apc.check_date`,
  rows: Array.from({length:100},(_,i)=>{
    const taxable=rnd(5000,200000);
    return [SUPPLIERS[i%SUPPLIERS.length],`${rnd(10,99)}-${rnd(1000000,9999999)}`,
      ['MISC','INT','DIV','NEC'][i%4],['WHT-FED','WHT-STATE','BACKUP-WHT'][i%3],
      `$${fmt(taxable)}`,`$${fmt(taxable*0.28)}`,`28%`,
      fmtDate(CY,rnd(1,12),rnd(1,28)),`INV-${rnd(100000,999999)}`,GL_ACCOUNTS[i%GL_ACCOUNTS.length]];
  })
};

/* ─── IEXPENSE DETAIL (100 rows) ────────────────────────────────── */
window.REPORT_DATA.iexpense_detail = {
  title: 'Oracle iExpense Detail Report',
  module: 'iExpense',
  columns: ['Report Number','Employee Name','Report Date','OU','Expense Type','Amount','Reimbursable','Purpose','Approval Status','Submitted Date','Approver'],
  sql: `SELECT oiea.report_header_id  report_number,
       ppf.full_name           employee_name,
       oiea.week_end_date      report_date,
       haou.name               ou_name,
       oiel.web_parameter_id   expense_type,
       oiel.amount,
       oiel.reimbursable_amount,
       oiea.description        purpose,
       oiea.workflow_approved_flag approval_status,
       oiea.submission_date,
       ppf2.full_name          approver_name
FROM   ap_expense_report_headers_all oiea
JOIN   ap_expense_report_lines_all   oiel ON oiel.report_header_id = oiea.report_header_id
JOIN   per_people_f                  ppf  ON ppf.person_id  = oiea.employee_id
JOIN   hr_all_organization_units    haou  ON haou.organization_id = oiea.org_id
LEFT   JOIN per_people_f            ppf2  ON ppf2.person_id = oiea.override_approver_id
WHERE  oiea.source = 'Both'
ORDER BY oiea.submission_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const amt=rnd(50,8000);
    return [`EXP-${CY}-${String(i+1).padStart(5,'0')}`,EMPLOYEES[i%EMPLOYEES.length],
      fmtDate(CY,rnd(1,12),rnd(1,28)),OU_LIST[i%3],EXPENSE_TYPES[i%EXPENSE_TYPES.length],
      `$${fmt(amt)}`,`$${fmt(amt)}`,`Business travel for Q${rnd(1,4)} project`,
      APPROVAL_STATUS[i%5],fmtDate(CY,rnd(1,12),rnd(1,28)),EMPLOYEES[(i+5)%EMPLOYEES.length]];
  })
};

/* ─── CREDIT CARD REPORT (100 rows) ─────────────────────────────── */
window.REPORT_DATA.credit_card_report = {
  title: 'iExpense Credit Card Report',
  module: 'iExpense',
  columns: ['Transaction ID','Card Number (Masked)','Employee Name','Transaction Date','Merchant','Category','Amount','Expense Report#','Status','Billed Date'],
  sql: `SELECT cct.transaction_id,
       '****-****-****-'||SUBSTR(cct.card_number,-4) masked_card,
       ppf.full_name          employee_name,
       cct.transaction_date,
       cct.merchant_name,
       cct.category,
       cct.transaction_amount,
       aerh.report_header_id  expense_report_num,
       cct.status,
       cct.billed_date
FROM   ap_credit_card_trxns_all cct
JOIN   per_people_f              ppf  ON ppf.person_id    = cct.employee_id
LEFT   JOIN ap_expense_report_headers_all aerh ON aerh.report_header_id = cct.report_header_id
WHERE  cct.transaction_date BETWEEN :p_start AND :p_end
ORDER BY cct.transaction_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    return [700000+i,`****-****-****-${rnd(1000,9999)}`,EMPLOYEES[i%EMPLOYEES.length],
      fmtDate(CY,rnd(1,12),rnd(1,28)),
      ['Delta Airlines','Marriott Hotels','Uber','Starbucks','Office Depot','Amazon','Southwest Airlines'][i%7],
      EXPENSE_TYPES[i%EXPENSE_TYPES.length],`$${fmt(rnd(20,5000))}`,
      `EXP-${CY}-${String(i+1).padStart(5,'0')}`,['Expensed','Unmatched','Disputed','Cleared'][i%4],
      fmtDate(CY,rnd(1,12),rnd(1,28))];
  })
};

/* ─── WORKFLOW APPROVALS (100 rows) ─────────────────────────────── */
window.REPORT_DATA.workflow_approvals = {
  title: 'iExpense Workflow & Approvals Report',
  module: 'iExpense',
  columns: ['Report Number','Employee','Report Amount','Submitted Date','Approver Level 1','L1 Action Date','Approver Level 2','L2 Action Date','Final Status','Cycle Time (Days)','Notes'],
  sql: `SELECT aerh.report_header_id  report_num,
       ppf.full_name           employee_name,
       aerh.total             report_amount,
       aerh.submission_date,
       ppf2.full_name         approver_l1,
       wn1.action_date        l1_action_date,
       ppf3.full_name         approver_l2,
       wn2.action_date        l2_action_date,
       aerh.workflow_approved_flag final_status,
       ROUND(NVL(wn2.action_date,SYSDATE) - aerh.submission_date,0) cycle_days,
       wn1.notification_comment notes
FROM   ap_expense_report_headers_all aerh
JOIN   per_people_f                  ppf  ON ppf.person_id  = aerh.employee_id
LEFT   JOIN wf_notifications wn1 ON wn1.item_key = TO_CHAR(aerh.report_header_id) AND wn1.activity_name LIKE '%APPROVE%L1%'
LEFT   JOIN wf_notifications wn2 ON wn2.item_key = TO_CHAR(aerh.report_header_id) AND wn2.activity_name LIKE '%APPROVE%L2%'
LEFT   JOIN per_people_f ppf2 ON ppf2.person_id = TO_NUMBER(wn1.to_user)
LEFT   JOIN per_people_f ppf3 ON ppf3.person_id = TO_NUMBER(wn2.to_user)
WHERE  aerh.source = 'Both'
ORDER BY aerh.submission_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const days=rnd(1,15);
    return [`EXP-${CY}-${String(i+1).padStart(5,'0')}`,EMPLOYEES[i%EMPLOYEES.length],
      `$${fmt(rnd(100,10000))}`,fmtDate(CY,rnd(1,12),rnd(1,28)),
      EMPLOYEES[(i+2)%EMPLOYEES.length],fmtDate(CY,rnd(1,12),rnd(1,28)),
      i%3===0?EMPLOYEES[(i+4)%EMPLOYEES.length]:'N/A',
      i%3===0?fmtDate(CY,rnd(1,12),rnd(1,28)):'N/A',
      APPROVAL_STATUS[i%5],days,['Standard Approval','Escalated','Auto-Approved'][i%3]];
  })
};

/* ─── EMPLOYEE REPORT (100 rows) ────────────────────────────────── */
window.REPORT_DATA.employee_report = {
  title: 'HRMS Employee Report',
  module: 'HRMS',
  columns: ['Employee ID','Full Name','Job Title','Department','Grade','Hire Date','Location','Manager','Employee Type','Status','Email','Phone'],
  sql: `SELECT ppf.employee_number,
       ppf.full_name,
       pj.name                  job_title,
       haou.name                department,
       pg.name                  grade,
       ppf.original_date_of_hire hire_date,
       hl.location_code,
       ppf2.full_name           manager_name,
       ppt.system_person_type   emp_type,
       pas.per_system_status     status,
       ppf.email_address,
       ppf.work_telephone
FROM   per_people_f     ppf
JOIN   per_assignments_f paf ON paf.person_id    = ppf.person_id
JOIN   per_jobs         pj   ON pj.job_id        = paf.job_id
JOIN   hr_all_organization_units haou ON haou.organization_id = paf.organization_id
JOIN   per_grades       pg   ON pg.grade_id      = paf.grade_id
JOIN   hr_locations_all hl   ON hl.location_id   = paf.location_id
JOIN   per_person_types ppt  ON ppt.person_type_id = ppf.person_type_id
JOIN   per_assignment_status_types pas ON pas.assignment_status_type_id = paf.assignment_status_type_id
LEFT   JOIN per_people_f ppf2 ON ppf2.person_id  = paf.supervisor_id
WHERE  paf.primary_flag = 'Y'
AND    SYSDATE BETWEEN paf.effective_start_date AND paf.effective_end_date
ORDER BY ppf.full_name`,
  rows: Array.from({length:100},(_,i)=>{
    return [`EMP-${String(10000+i)}`,EMPLOYEES[i%EMPLOYEES.length],
      ['Senior Analyst','Manager','Director','Specialist','Coordinator','VP','Consultant'][i%7],
      DEPARTMENTS[i%DEPARTMENTS.length],`G${rnd(4,9)}`,
      fmtDate(2010+i%14,rnd(1,12),rnd(1,28)),'CHICAGO-MAIN',
      EMPLOYEES[(i+7)%EMPLOYEES.length],'Employee',EMP_STATUS[i%4],
      `${EMPLOYEES[i%EMPLOYEES.length].split(' ')[0].toLowerCase()}@cookcounty.gov`,
      `312-${rnd(100,999)}-${rnd(1000,9999)}`];
  })
};

/* ─── ACTIVE EMPLOYEES (100 rows) ───────────────────────────────── */
window.REPORT_DATA.active_employees = {
  title: 'Active Employees Report',
  module: 'HRMS',
  columns: ['Employee ID','Full Name','Job','Department','Grade','Hire Date','Years of Service','Supervisor','Cost Center','Position','FTE','Payroll'],
  sql: `SELECT ppf.employee_number,
       ppf.full_name,
       pj.name job_title,
       haou.name department,
       pg.name grade,
       ppf.original_date_of_hire,
       ROUND((SYSDATE-ppf.original_date_of_hire)/365,1) yrs_service,
       ppf2.full_name supervisor,
       paf.default_code_comb_id cost_center,
       pp.name position_name,
       paf.fte,
       ppg.payroll_name
FROM   per_people_f     ppf
JOIN   per_assignments_f paf ON paf.person_id = ppf.person_id AND paf.primary_flag='Y'
  AND SYSDATE BETWEEN paf.effective_start_date AND paf.effective_end_date
JOIN   per_jobs         pj   ON pj.job_id = paf.job_id
JOIN   hr_all_organization_units haou ON haou.organization_id = paf.organization_id
JOIN   per_grades       pg   ON pg.grade_id = paf.grade_id
JOIN   per_positions    pp   ON pp.position_id = paf.position_id
JOIN   pay_payrolls_f   ppg  ON ppg.payroll_id = paf.payroll_id
LEFT   JOIN per_people_f ppf2 ON ppf2.person_id = paf.supervisor_id
WHERE  ppf.current_employee_flag = 'Y'
ORDER BY ppf.full_name`,
  rows: Array.from({length:100},(_,i)=>{
    return [`EMP-${10000+i}`,EMPLOYEES[i%EMPLOYEES.length],
      ['Analyst','Manager','Director','Specialist','Admin'][i%5],
      DEPARTMENTS[i%DEPARTMENTS.length],`G${rnd(4,8)}`,
      fmtDate(2010+i%12,rnd(1,12),rnd(1,28)),`${rnd(1,14)} yrs`,
      EMPLOYEES[(i+3)%EMPLOYEES.length],COST_CENTERS[i%COST_CENTERS.length],
      `POS-${rnd(1000,9999)}`,`1.0`,['BI-WEEKLY','SEMI-MONTHLY'][i%2]];
  })
};

/* ─── CONTINGENT WORKERS (100 rows) ─────────────────────────────── */
window.REPORT_DATA.contingent_workers = {
  title: 'Contingent Workers Report',
  module: 'HRMS',
  columns: ['Worker ID','Full Name','Job Title','Supplier Company','Department','Start Date','End Date','Contract Type','PO Number','Daily Rate','Status'],
  sql: `SELECT ppf.employee_number,
       ppf.full_name,
       pj.name               job_title,
       aps.vendor_name       supplier_company,
       haou.name             department,
       paf.effective_start_date start_date,
       paf.projected_assignment_end end_date,
       paf.assignment_type   contract_type,
       poh.segment1          po_number,
       paf.projected_hourly_labour_rate daily_rate,
       pas.per_system_status status
FROM   per_people_f     ppf
JOIN   per_assignments_f paf ON paf.person_id = ppf.person_id
JOIN   per_jobs         pj   ON pj.job_id = paf.job_id
JOIN   hr_all_organization_units haou ON haou.organization_id = paf.organization_id
JOIN   per_assignment_status_types pas ON pas.assignment_status_type_id = paf.assignment_status_type_id
LEFT   JOIN ap_suppliers aps  ON aps.vendor_id = paf.vendor_id
LEFT   JOIN po_headers_all poh ON poh.po_header_id = paf.po_header_id
WHERE  ppf.current_npw_flag = 'Y'
ORDER BY ppf.full_name`,
  rows: Array.from({length:100},(_,i)=>{
    return [`CWK-${10000+i}`,EMPLOYEES[i%EMPLOYEES.length],
      ['Contractor','Consultant','Temp Worker','Freelancer'][i%4],
      SUPPLIERS[i%SUPPLIERS.length],DEPARTMENTS[i%DEPARTMENTS.length],
      fmtDate(CY,rnd(1,6),rnd(1,28)),fmtDate(CY,rnd(7,12),rnd(1,28)),
      ['Fixed Term','Time & Material','Milestone'][i%3],
      `PO-${CY}-${String(rnd(1,9999)).padStart(5,'0')}`,`$${fmt(rnd(400,1200))}`,
      ['Active','Ended','Suspended'][i%3]];
  })
};

/* ─── TERMINATED EMPLOYEES (100 rows) ───────────────────────────── */
window.REPORT_DATA.terminated_employees = {
  title: 'Terminated Employees Report',
  module: 'HRMS',
  columns: ['Employee ID','Full Name','Department','Job Title','Hire Date','Termination Date','Termination Reason','Last Salary','Notice Period','Final Pay Date','Rehire Eligible'],
  sql: `SELECT ppf.employee_number,
       ppf.full_name,
       haou.name         department,
       pj.name           job_title,
       ppf.original_date_of_hire,
       ppf.actual_termination_date,
       plr.meaning       termination_reason,
       pap.proposed_salary_n last_salary,
       ROUND((ppf.actual_termination_date - ppf.last_day_worked)) notice_days,
       ppf.final_process_date,
       ppf.rehire_recommendation
FROM   per_people_f ppf
JOIN   per_assignments_f paf ON paf.person_id = ppf.person_id AND paf.primary_flag='Y'
JOIN   per_jobs         pj   ON pj.job_id = paf.job_id
JOIN   hr_all_organization_units haou ON haou.organization_id = paf.organization_id
JOIN   per_pay_proposals pap ON pap.assignment_id = paf.assignment_id
JOIN   per_lookup_values plr ON plr.lookup_code = ppf.leaving_reason AND plr.lookup_type='LEAV_REAS'
WHERE  ppf.current_employee_flag = 'N'
AND    ppf.actual_termination_date >= ADD_MONTHS(SYSDATE,-12)
ORDER BY ppf.actual_termination_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    return [`EMP-${20000+i}`,EMPLOYEES[i%EMPLOYEES.length],DEPARTMENTS[i%DEPARTMENTS.length],
      ['Analyst','Manager','Specialist','Coordinator'][i%4],
      fmtDate(2015+i%8,rnd(1,12),rnd(1,28)),fmtDate(CY,rnd(1,12),rnd(1,28)),
      ['Resignation','Retirement','Layoff','Contract End','Mutual Agreement'][i%5],
      `$${fmt(rnd(45000,180000))}`,`${rnd(0,90)} days`,
      fmtDate(CY,rnd(1,12),rnd(1,28)),['Y','N'][i%2]];
  })
};

/* ─── SUPERVISOR DETAILS (100 rows) ─────────────────────────────── */
window.REPORT_DATA.supervisor_details = {
  title: 'Supervisor Details Report',
  module: 'HRMS',
  columns: ['Supervisor ID','Supervisor Name','Job Title','Department','Direct Reports','Total Headcount','Approval Limit','Location','Email','Manager Level'],
  sql: `SELECT ppf_sup.employee_number,
       ppf_sup.full_name       supervisor_name,
       pj.name                 job_title,
       haou.name               department,
       COUNT(paf_sub.person_id) direct_reports,
       COUNT(paf_sub.person_id) total_headcount,
       ppf_sup.email_address,
       hl.location_code,
       plr.meaning             mgr_level
FROM   per_people_f     ppf_sup
JOIN   per_assignments_f paf_sup ON paf_sup.person_id = ppf_sup.person_id AND paf_sup.primary_flag='Y'
  AND SYSDATE BETWEEN paf_sup.effective_start_date AND paf_sup.effective_end_date
JOIN   per_assignments_f paf_sub ON paf_sub.supervisor_id = ppf_sup.person_id
JOIN   per_jobs          pj   ON pj.job_id = paf_sup.job_id
JOIN   hr_all_organization_units haou ON haou.organization_id = paf_sup.organization_id
JOIN   hr_locations_all  hl   ON hl.location_id = paf_sup.location_id
LEFT   JOIN per_lookup_values plr ON plr.lookup_code = paf_sup.manager_level
GROUP BY ppf_sup.employee_number, ppf_sup.full_name, pj.name, haou.name,
         ppf_sup.email_address, hl.location_code, plr.meaning
ORDER BY direct_reports DESC`,
  rows: Array.from({length:100},(_,i)=>{
    return [`EMP-${10000+i}`,EMPLOYEES[i%EMPLOYEES.length],
      ['Director','Senior Manager','Manager','Team Lead'][i%4],
      DEPARTMENTS[i%DEPARTMENTS.length],rnd(2,25),rnd(5,80),
      `$${fmt(rnd(10000,500000))}`,`CHICAGO-${['MAIN','NORTH','SOUTH','WEST'][i%4]}`,
      `${EMPLOYEES[i%EMPLOYEES.length].split(' ')[0].toLowerCase()}@cookcounty.gov`,
      ['L1 Manager','L2 Manager','Senior Leader','Executive'][i%4]];
  })
};

/* ─── EXPENSE COST ALLOCATION (100 rows) ────────────────────────── */
window.REPORT_DATA.expense_cost_allocation = {
  title: 'Expense Account Cost Allocation Full Details Report',
  module: 'HRMS / iExpense',
  columns: ['Employee ID','Employee Name','Department','Cost Center','GL Account','Expense Type','Expense Amount','Fund','Program','Project','Task','Report Period'],
  sql: `SELECT ppf.employee_number,
       ppf.full_name,
       haou.name              department,
       gcc.segment2           cost_center,
       gcc.concatenated_segments gl_account,
       oiel.web_parameter_id  expense_type,
       oiel.amount            expense_amount,
       gcc.segment4           fund,
       gcc.segment3           program,
       oiel.project_id,
       oiel.task_id,
       TO_CHAR(oiea.week_end_date,'YYYY-MM') report_period
FROM   ap_expense_report_headers_all oiea
JOIN   ap_expense_report_lines_all   oiel ON oiel.report_header_id = oiea.report_header_id
JOIN   per_people_f  ppf ON ppf.person_id = oiea.employee_id
JOIN   hr_all_organization_units haou ON haou.organization_id = oiea.org_id
JOIN   gl_code_combinations gcc ON gcc.code_combination_id = oiel.code_combination_id
WHERE  oiea.source = 'Both'
AND    oiea.workflow_approved_flag = 'A'
ORDER BY ppf.full_name, oiea.week_end_date`,
  rows: Array.from({length:100},(_,i)=>{
    return [`EMP-${10000+i}`,EMPLOYEES[i%EMPLOYEES.length],DEPARTMENTS[i%DEPARTMENTS.length],
      COST_CENTERS[i%COST_CENTERS.length],GL_ACCOUNTS[i%GL_ACCOUNTS.length],
      EXPENSE_TYPES[i%EXPENSE_TYPES.length],`$${fmt(rnd(50,8000))}`,
      `${rnd(41000,43000)}`,`PROG-${rnd(100,999)}`,`PROJ-${rnd(1000,9999)}`,
      `TASK-${rnd(100,999)}`,`${CY}-${String(rnd(1,12)).padStart(2,'0')}`];
  })
};

/* ─── GL JOURNALS (100 rows) ────────────────────────────────────── */
window.REPORT_DATA.gl_journals = {
  title: 'GL Journal Entry Report',
  module: 'General Ledger',
  columns: ['Journal Name','Source','Category','Period Name','GL Account','Dr Amount','Cr Amount','Posted Status','Batch Name','Created By','Creation Date'],
  sql: `SELECT gjh.name            journal_name,
       gjh.je_source         source,
       gjh.je_category       category,
       gjh.period_name,
       gcc.concatenated_segments gl_account,
       gjl.accounted_dr,
       gjl.accounted_cr,
       gjh.status            posted_status,
       gjb.name              batch_name,
       fu.user_name          created_by,
       gjh.creation_date
FROM   gl_je_headers  gjh
JOIN   gl_je_lines    gjl ON gjl.je_header_id = gjh.je_header_id
JOIN   gl_code_combinations gcc ON gcc.code_combination_id = gjl.code_combination_id
JOIN   gl_je_batches  gjb ON gjb.je_batch_id  = gjh.je_batch_id
JOIN   fnd_user       fu  ON fu.user_id       = gjh.created_by
WHERE  gjh.period_name = :p_period
ORDER BY gjh.creation_date DESC`,
  rows: Array.from({length:100},(_,i)=>{
    const amt=rnd(5000,500000);
    return [`JE-${CY}-${String(i+1).padStart(5,'0')}`,
      ['Manual','Payables','Purchasing','iExpense','Payroll'][i%5],
      ['Accrual','Adjustment','Purchase','Payment','Salary'][i%5],
      `${CY}-${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][i%12]}`,
      GL_ACCOUNTS[i%GL_ACCOUNTS.length],i%2===0?`$${fmt(amt)}`:null,
      i%2===1?`$${fmt(amt)}`:null,['Posted','Unposted'][i%2],
      `BATCH-${rnd(100,999)}`,EMPLOYEES[i%EMPLOYEES.length].split(' ')[0].toUpperCase(),
      fmtDate(CY,rnd(1,12),rnd(1,28))];
  })
};

/* ─── GL TRIAL BALANCE (100 rows) ───────────────────────────────── */
window.REPORT_DATA.gl_trial_balance = {
  title: 'General Ledger Trial Balance',
  module: 'General Ledger',
  columns: ['Account Code','Account Description','Account Type','Period Dr','Period Cr','Net Activity','Beg Balance','Ending Balance','Currency','Ledger'],
  sql: `SELECT gcc.concatenated_segments acct_code,
       fav.description         acct_desc,
       gcc.account_type,
       SUM(gb.period_net_dr)   period_dr,
       SUM(gb.period_net_cr)   period_cr,
       SUM(gb.period_net_dr - gb.period_net_cr) net_activity,
       SUM(gb.begin_balance_dr - gb.begin_balance_cr) beg_bal,
       SUM((gb.begin_balance_dr + gb.period_net_dr) -
           (gb.begin_balance_cr + gb.period_net_cr)) end_bal,
       gb.currency_code,
       gl.name                 ledger_name
FROM   gl_balances            gb
JOIN   gl_code_combinations   gcc ON gcc.code_combination_id = gb.code_combination_id
JOIN   gl_ledgers             gl  ON gl.ledger_id            = gb.ledger_id
LEFT   JOIN fnd_flex_values_vl fav ON fav.flex_value          = gcc.segment5
WHERE  gb.period_name = :p_period
AND    gb.actual_flag = 'A'
GROUP BY gcc.concatenated_segments, fav.description, gcc.account_type,
         gb.currency_code, gl.name
ORDER BY gcc.concatenated_segments`,
  rows: Array.from({length:100},(_,i)=>{
    const dr=rnd(10000,5000000); const cr=rnd(8000,4500000);
    return [GL_ACCOUNTS[i%GL_ACCOUNTS.length],
      ['Cash','AP Liability','Revenue','Expense','Payroll'][i%5],
      ['A','L','R','E','O'][i%5],`$${fmt(dr)}`,`$${fmt(cr)}`,
      `$${fmt(dr-cr)}`,`$${fmt(rnd(100000,10000000))}`,`$${fmt(dr-cr+rnd(100000,10000000))}`,
      'USD','Cook County Ledger'];
  })
};

/* ─── GL ACCOUNT ANALYSIS (100 rows) ────────────────────────────── */
window.REPORT_DATA.gl_account_analysis = {
  title: 'GL Account Analysis Report',
  module: 'General Ledger',
  columns: ['GL Account','Transaction Date','Journal Name','Source','Dr Amount','Cr Amount','Running Balance','Reference','Created By','Period'],
  sql: `SELECT gcc.concatenated_segments gl_account,
       gjl.effective_date,
       gjh.name            journal_name,
       gjh.je_source       source,
       gjl.accounted_dr,
       gjl.accounted_cr,
       SUM(gjl.accounted_dr - gjl.accounted_cr) OVER (
           PARTITION BY gjl.code_combination_id
           ORDER BY gjl.effective_date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) running_balance,
       gjl.reference_1     reference,
       fu.user_name        created_by,
       gjh.period_name
FROM   gl_je_lines    gjl
JOIN   gl_je_headers  gjh ON gjh.je_header_id = gjl.je_header_id
JOIN   gl_code_combinations gcc ON gcc.code_combination_id = gjl.code_combination_id
JOIN   fnd_user       fu  ON fu.user_id = gjh.created_by
WHERE  gjl.code_combination_id = :p_ccid
AND    gjh.period_name BETWEEN :p_from AND :p_to
ORDER BY gjl.effective_date`,
  rows: Array.from({length:100},(_,i)=>{
    const dr=rnd(0,200000); const cr=rnd(0,200000);
    return [GL_ACCOUNTS[i%GL_ACCOUNTS.length],fmtDate(CY,rnd(1,12),rnd(1,28)),
      `JE-${CY}-${String(i+1).padStart(5,'0')}`,
      ['Manual','AP','AR','PO','Payroll'][i%5],
      dr>0?`$${fmt(dr)}`:'—',cr>0?`$${fmt(cr)}`:'—',
      `$${fmt(rnd(100000,5000000))}`,`REF-${rnd(10000,99999)}`,
      EMPLOYEES[i%EMPLOYEES.length].split(' ')[0].toUpperCase(),
      `${CY}-${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][i%12]}`];
  })
};

/* ─── REPORT METADATA INDEX ─────────────────────────────────────── */

/* --- SUPPLIERS HIGH PAYMENTS BY YEAR (100 rows) ---------------------------------------- */
window.REPORT_DATA.suppliers_high_payments_by_year = {
  title: 'Suppliers with High Payments by Year',
  module: 'Accounts Payable',
  defaultYear: new Date().getFullYear() - 1,
  columns: ['Supplier Name','Supplier Number','Fiscal Year','Total Payments (USD)','Invoice Count','Avg Payment','Last Payment Date','Payment Method','Bank Account','Status'],
  sql: `SELECT aps.vendor_name,
       aps.segment1                              supplier_number,
       TO_CHAR(apc.check_date,'YYYY')            fiscal_year,
       SUM(apip.amount)                          total_payments,
       COUNT(DISTINCT apia.invoice_id)            invoice_count,
       ROUND(AVG(apip.amount),2)                 avg_payment,
       MAX(apc.check_date)                       last_payment_date,
       apc.payment_method_code                   payment_method,
       aba.bank_account_num                      bank_account,
       aps.vendor_type_lookup_code               status
FROM   ap_suppliers              aps
JOIN   ap_invoices_all           apia  ON apia.vendor_id   = aps.vendor_id
                                      AND apia.org_id      = mo_global.get_current_org_id()
JOIN   ap_invoice_payments       apip  ON apip.invoice_id  = apia.invoice_id
JOIN   ap_checks_all             apc   ON apc.check_id     = apip.check_id
                                      AND apc.org_id       = mo_global.get_current_org_id()
                                      AND apc.void_date    IS NULL
LEFT JOIN ap_bank_accounts_all   aba   ON aba.bank_account_id = apc.external_bank_account_id
WHERE  TO_CHAR(apc.check_date,'YYYY') = TO_CHAR(:p_year)
AND    apip.amount                   > :p_min_amount
GROUP  BY aps.vendor_name, aps.segment1,
          TO_CHAR(apc.check_date,'YYYY'),
          apc.payment_method_code,
          aba.bank_account_num,
          aps.vendor_type_lookup_code
HAVING SUM(apip.amount) > :p_threshold
ORDER  BY total_payments DESC`,
  rows: (function() {
    var rows = [];
    var thisYear = new Date().getFullYear();
    for (var i = 0; i < 100; i++) {
      var yr = (thisYear - 1) - Math.floor(i / 34);
      var total = rnd(500000, 15000000);
      var invCnt = rnd(5, 120);
      var avg = Math.round(total / invCnt);
      rows.push([
        SUPPLIERS[i % SUPPLIERS.length],
        'SUP-' + String(1000 + i).padStart(5,'0'),
        String(yr),
        '$' + fmt(total),
        String(invCnt),
        '$' + fmt(avg),
        fmtDate(yr, rnd(1,12), rnd(1,28)),
        PAY_METHODS[i % PAY_METHODS.length],
        'BANK-' + String(rnd(1000,9999)),
        i % 10 === 0 ? 'On Hold' : 'Active'
      ]);
    }
    return rows;
  })()
};


/* ─── LOV / Valid-values catalogue — used by parameter bar dropdowns ─ */
window.REPORT_LOV = {
  org_id:  [{ v:'101', l:'101 — Cook County Primary (CCP)' },
            { v:'201', l:'201 — Cook County Health (CCH)'  },
            { v:'301', l:'301 — Cook County Finance (CCF)' }],
  period:  (function(){ var a=[]; for(var y=CY;y>=CY2;y--){
              ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].forEach(function(m){ a.push({v:y+'-'+m,l:y+'-'+m}); }); } return a; })(),
  year:    [{v:String(CY),l:'FY '+CY},{v:String(CY1),l:'FY '+CY1},{v:String(CY2),l:'FY '+CY2},{v:String(CY3),l:'FY '+CY3}],
  ccid:    GL_ACCOUNTS.map(function(a){ return {v:a,l:a}; }),
  start_date: [{v:CY+'-01-01',l:CY+'-01-01 (Jan 1)'},{v:CY+'-04-01',l:CY+'-04-01 (Apr 1)'},{v:CY+'-07-01',l:CY+'-07-01 (Jul 1)'}],
  end_date:   [{v:CY+'-03-31',l:CY+'-03-31 (Mar 31)'},{v:CY+'-06-30',l:CY+'-06-30 (Jun 30)'},{v:CY+'-09-30',l:CY+'-09-30 (Sep 30)'},{v:CY+'-12-31',l:CY+'-12-31 (Dec 31)'}],
  start:      [{v:CY+'-01-01',l:CY+'-01-01'},{v:CY+'-04-01',l:CY+'-04-01'},{v:CY+'-07-01',l:CY+'-07-01'}],
  end:        [{v:CY+'-03-31',l:CY+'-03-31'},{v:CY+'-06-30',l:CY+'-06-30'},{v:CY+'-09-30',l:CY+'-09-30'},{v:CY+'-12-31',l:CY+'-12-31'}],
  p_start:    [{v:CY+'-01-01',l:CY+'-01-01'},{v:CY+'-04-01',l:CY+'-04-01'},{v:CY+'-07-01',l:CY+'-07-01'}],
  p_end:      [{v:CY+'-03-31',l:CY+'-03-31'},{v:CY+'-06-30',l:CY+'-06-30'},{v:CY+'-09-30',l:CY+'-09-30'},{v:CY+'-12-31',l:CY+'-12-31'}],
  p_start_date:[{v:CY+'-01-01',l:CY+'-01-01'},{v:CY+'-04-01',l:CY+'-04-01'},{v:CY+'-07-01',l:CY+'-07-01'}],
  p_end_date:  [{v:CY+'-03-31',l:CY+'-03-31'},{v:CY+'-06-30',l:CY+'-06-30'},{v:CY+'-09-30',l:CY+'-09-30'},{v:CY+'-12-31',l:CY+'-12-31'}],
  p_org_id:  [{ v:'101', l:'101 — Cook County Primary (CCP)' },
              { v:'201', l:'201 — Cook County Health (CCH)'  },
              { v:'301', l:'301 — Cook County Finance (CCF)' }],
  p_period:  (function(){ var a=[]; for(var y=CY;y>=CY2;y--){
               ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].forEach(function(m){ a.push({v:y+'-'+m,l:y+'-'+m}); }); } return a; })(),
  p_year:    [{v:String(CY),l:'FY '+CY},{v:String(CY1),l:'FY '+CY1},{v:String(CY2),l:'FY '+CY2},{v:String(CY3),l:'FY '+CY3}],
  p_ccid:    GL_ACCOUNTS.map(function(a){ return {v:a,l:a}; }),
  p_from:    (function(){ var a=[]; for(var y=CY;y>=CY2;y--){ ['JAN','FEB','MAR','JUL','OCT'].forEach(function(m){ a.push({v:y+'-'+m,l:y+'-'+m}); }); } return a; })(),
  p_to:      (function(){ var a=[]; for(var y=CY;y>=CY2;y--){ ['MAR','JUN','SEP','DEC'].forEach(function(m){ a.push({v:y+'-'+m,l:y+'-'+m}); }); } return a; })(),
  p_min_amount: [{v:'100000',l:'$100,000'},{v:'500000',l:'$500,000'},{v:'1000000',l:'$1,000,000'}],
  p_threshold:  [{v:'500000',l:'$500,000'},{v:'1000000',l:'$1,000,000'},{v:'5000000',l:'$5,000,000'}],
};

window.REPORT_META = {
  suppliers_list:             { title:'Suppliers Report',                       module:'Accounts Payable',  color:'#C74634' },
  suppliers_high_payments_by_year: { title:'High Payment Suppliers by Year',   module:'Accounts Payable',  color:'#C74634' },
  suppliers_high_payments:    { title:'High Payment Suppliers (3 Years)',       module:'Accounts Payable',  color:'#C74634' },
  supplier_paid_invoice_history:{ title:'Supplier Paid Invoice History',         module:'Accounts Payable',  color:'#C74634' },
  supplier_payment_history:   { title:'Supplier Payment History',               module:'Accounts Payable',  color:'#C74634' },
  supplier_audit:             { title:'Supplier Audit Report',                  module:'Accounts Payable',  color:'#C74634' },
  po_detail:                  { title:'Purchase Order Detail',                  module:'Purchasing',        color:'#0043CE' },
  po_distribution:            { title:'PO Distribution Detail',                 module:'Purchasing',        color:'#0043CE' },
  receipt_adjustments:        { title:'Receipt Adjustments',                    module:'Purchasing',        color:'#0043CE' },
  savings_analysis:           { title:'Savings Analysis',                       module:'Purchasing',        color:'#0043CE' },
  aged_payables_detail:       { title:'Aged Payables Detail',                   module:'Accounts Payable',  color:'#8A3FC7' },
  aged_payables_summary:      { title:'Aged Payables Summary',                  module:'Accounts Payable',  color:'#8A3FC7' },
  ap_trial_balance:           { title:'AP Trial Balance',                       module:'Accounts Payable',  color:'#8A3FC7' },
  invoice_register:           { title:'Invoice Register',                       module:'Accounts Payable',  color:'#8A3FC7' },
  withholding_tax:            { title:'Withholding Tax by Supplier',            module:'Accounts Payable',  color:'#8A3FC7' },
  iexpense_detail:            { title:'iExpense Detail Report',                 module:'iExpense',          color:'#00832D' },
  credit_card_report:         { title:'Credit Card Report',                     module:'iExpense',          color:'#00832D' },
  workflow_approvals:         { title:'Workflow & Approvals Report',            module:'iExpense',          color:'#00832D' },
  employee_report:            { title:'HRMS Employee Report',                   module:'HRMS',              color:'#B7590A' },
  active_employees:           { title:'Active Employees',                       module:'HRMS',              color:'#B7590A' },
  contingent_workers:         { title:'Contingent Workers',                     module:'HRMS',              color:'#B7590A' },
  terminated_employees:       { title:'Terminated Employees',                   module:'HRMS',              color:'#B7590A' },
  supervisor_details:         { title:'Supervisor Details',                     module:'HRMS',              color:'#B7590A' },
  expense_cost_allocation:    { title:'Expense Cost Allocation',                module:'HRMS / iExpense',   color:'#B7590A' },
  gl_journals:                { title:'GL Journal Entry Report',                module:'General Ledger',    color:'#5C6BC0' },
  gl_trial_balance:           { title:'GL Trial Balance',                       module:'General Ledger',    color:'#5C6BC0' },
  gl_account_analysis:        { title:'GL Account Analysis',                   module:'General Ledger',    color:'#5C6BC0' },
};

console.log('[EBS Data] Loaded', Object.keys(window.REPORT_DATA).length, 'reports with 100 records each.');

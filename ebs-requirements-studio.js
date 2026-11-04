/* ═══════════════════════════════════════════════════════════════════════
   Oracle EBS Intelligence Hub — Requirements Studio  v2.0
   Tab: Requirements Studio | Role: Technical
   Generates: SQL Queries, PL/SQL Packages, Procedures, Triggers,
              Staging Tables, Test Cases, Technical Design Documents

   FIXED:
   - Module selection is respected; auto-detect only used when NONE selected
   - Artifact checkboxes are strictly honoured — unchecked = not generated
   - SQL generation is context-aware per requirement (correct tables/columns)
   - Count badges use correct selectors
   - Upload file input click is decoupled from zone onclick to prevent double-fire
   - Sentence-split fallback removed to prevent flooding with generic queries
   - Each artifact generates exactly once (not per-requirement looped for package)
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const RequirementsStudio = (() => {

  /* ── STATE ──────────────────────────────────────────────────────────────── */
  let _state = {
    rawText: '',
    fileName: '',
    dbMode: false,
    dataMode: false,
    pastedData: '',
    dbConfig: {},
    parsedRequirements: [],
    selectedModules: [],
    selectedArtifacts: [],
    generated: {},
    activeArtifact: 'sql',
    generating: false,
  };

  let _parsedColumns = [];

  /* ── EBS MODULE KEYWORD MAP ─────────────────────────────────────────────── */
  const MODULE_KEYWORDS = {
    GL:  ['general ledger','journal','gl batch','gl period','chart of accounts','ledger','intercompany','code combination','gl_je'],
    AP:  ['accounts payable','invoice','vendor','supplier','payment','payable','withholding','ap_invoice','payment batch','payment term','ap_'],
    AR:  ['accounts receivable','customer','receipt','billing','dunning','credit memo','debit memo','lockbox','revenue','ar_','ra_customer'],
    PO:  ['purchase order','requisition','procurement','rfq','quotation','blanket','receiving','shipment','po_header','po_line'],
    INV: ['inventory','item master','warehouse','subinventory','lot number','serial number','onhand','cycle count','mtl_','organization_id'],
    OM:  ['order management','sales order','order line','shipping','pick release','backorder','price list','oe_order'],
    HR:  ['employee','person','position','grade','payroll','salary','absence','assignment','per_all','hrms','hcm','per_'],
    FA:  ['fixed asset','depreciation','asset book','asset category','asset addition','retirement','revaluation','fa_'],
    CM:  ['cash management','bank statement','reconciliation','cash position','bank account','ce_bank'],
    PA:  ['project','task','expenditure','budget','project accounting','pa_project','pa_task'],
  };

  /* ── EBS TABLE MAP ──────────────────────────────────────────────────────── */
  const TABLE_MAP = {
    GL:  ['GL_JE_HEADERS','GL_JE_LINES','GL_CODE_COMBINATIONS','GL_PERIODS','GL_LEDGERS'],
    AP:  ['AP_INVOICES_ALL','AP_INVOICE_LINES_ALL','AP_INVOICE_DISTRIBUTIONS_ALL','AP_PAYMENT_SCHEDULES_ALL','AP_CHECKS_ALL','AP_SUPPLIERS','AP_SUPPLIER_SITES_ALL'],
    AR:  ['AR_CASH_RECEIPTS_ALL','RA_CUSTOMER_TRX_ALL','RA_CUSTOMER_TRX_LINES_ALL','HZ_CUST_ACCOUNTS','HZ_PARTIES'],
    PO:  ['PO_HEADERS_ALL','PO_LINES_ALL','PO_LINE_LOCATIONS_ALL','PO_DISTRIBUTIONS_ALL','PO_REQUISITION_HEADERS_ALL','RCV_SHIPMENT_HEADERS','RCV_TRANSACTIONS'],
    INV: ['MTL_SYSTEM_ITEMS_B','MTL_ONHAND_QUANTITIES_DETAIL','MTL_MATERIAL_TRANSACTIONS','MTL_TRANSACTION_TYPES','MTL_PARAMETERS'],
    OM:  ['OE_ORDER_HEADERS_ALL','OE_ORDER_LINES_ALL','WSH_DELIVERY_DETAILS','OE_PRICE_ADJUSTMENTS'],
    HR:  ['PER_ALL_PEOPLE_F','PER_ALL_ASSIGNMENTS_F','PER_JOBS','HR_ALL_ORGANIZATION_UNITS','PAY_PAYROLL_ACTIONS'],
    FA:  ['FA_ADDITIONS_B','FA_BOOKS','FA_DEPRN_SUMMARY','FA_TRANSACTION_HEADERS','FA_CATEGORIES_B'],
    CM:  ['CE_BANK_ACCOUNTS','CE_BANK_ACCT_BALANCES','CE_STATEMENT_HEADERS','CE_STATEMENT_LINES'],
    PA:  ['PA_PROJECTS_ALL','PA_TASKS','PA_EXPENDITURE_ITEMS_ALL','PA_BUDGETS','PA_BUDGET_LINES'],
  };

  /* Module-specific SELECT column lists */
  const MODULE_SELECT_COLS = {
    GL:  ['gjh.JE_HEADER_ID','gjh.NAME','gjh.PERIOD_NAME','gjh.STATUS','gjh.CURRENCY_CODE','gjl.ENTERED_DR','gjl.ENTERED_CR','gcc.SEGMENT1||\'.\' ||gcc.SEGMENT2||\'.\' ||gcc.SEGMENT3 ACCOUNT'],
    AP:  ['ai.INVOICE_ID','ai.INVOICE_NUM','aps.VENDOR_NAME','ai.INVOICE_AMOUNT','ai.INVOICE_DATE','ai.PAYMENT_STATUS_FLAG','ai.ORG_ID','ai.INVOICE_CURRENCY_CODE'],
    AR:  ['rct.CUSTOMER_TRX_ID','rct.TRX_NUMBER','hp.PARTY_NAME','rct.TRX_DATE','rct.COMPLETE_FLAG','rct.ORG_ID'],
    PO:  ['ph.PO_HEADER_ID','ph.SEGMENT1 PO_NUMBER','aps.VENDOR_NAME','ph.TOTAL_AMOUNT','ph.AUTHORIZATION_STATUS','ph.ORG_ID','ph.CREATION_DATE'],
    INV: ['msib.INVENTORY_ITEM_ID','msib.SEGMENT1 ITEM_NUMBER','msib.DESCRIPTION','msib.PRIMARY_UOM_CODE','msib.ITEM_TYPE','msib.ORGANIZATION_ID'],
    OM:  ['oeh.HEADER_ID','oeh.ORDER_NUMBER','oeh.ORDERED_DATE','oeh.FLOW_STATUS_CODE','oeh.ORDERED_ITEM','oeh.ORG_ID'],
    HR:  ['papf.PERSON_ID','papf.EMPLOYEE_NUMBER','papf.FULL_NAME','papf.EFFECTIVE_START_DATE','papf.EFFECTIVE_END_DATE','haou.NAME DEPARTMENT'],
    FA:  ['fab.ASSET_ID','fab.ASSET_NUMBER','fab.DESCRIPTION','fb.COST','fb.DEPRECIATION_RESERVE','fb.NET_BOOK_VALUE','fab.DATE_PLACED_IN_SERVICE'],
    CM:  ['cba.BANK_ACCOUNT_NUM','cba.BANK_ACCOUNT_NAME','csh.STATEMENT_NUMBER','csh.STATEMENT_DATE','csl.AMOUNT','csl.STATUS'],
    PA:  ['pp.PROJECT_ID','pp.SEGMENT1 PROJECT_NUMBER','pp.NAME PROJECT_NAME','pt.TASK_ID','pt.TASK_NUMBER','pp.PROJECT_STATUS_CODE'],
  };

  /* Module-specific FROM / JOIN clauses */
  const MODULE_FROM_JOIN = {
    GL:  'GL_JE_HEADERS gjh\n  JOIN GL_JE_LINES gjl ON gjl.JE_HEADER_ID = gjh.JE_HEADER_ID\n  LEFT JOIN GL_CODE_COMBINATIONS gcc ON gcc.CODE_COMBINATION_ID = gjl.CODE_COMBINATION_ID',
    AP:  'AP_INVOICES_ALL ai\n  JOIN AP_SUPPLIERS aps ON aps.VENDOR_ID = ai.VENDOR_ID',
    AR:  'RA_CUSTOMER_TRX_ALL rct\n  JOIN HZ_CUST_ACCOUNTS hca ON hca.CUST_ACCOUNT_ID = rct.BILL_TO_CUSTOMER_ID\n  JOIN HZ_PARTIES hp ON hp.PARTY_ID = hca.PARTY_ID',
    PO:  'PO_HEADERS_ALL ph\n  JOIN AP_SUPPLIERS aps ON aps.VENDOR_ID = ph.VENDOR_ID\n  LEFT JOIN PO_LINES_ALL pl ON pl.PO_HEADER_ID = ph.PO_HEADER_ID AND pl.ORG_ID = ph.ORG_ID',
    INV: 'MTL_SYSTEM_ITEMS_B msib\n  LEFT JOIN MTL_ONHAND_QUANTITIES_DETAIL moqd ON moqd.INVENTORY_ITEM_ID = msib.INVENTORY_ITEM_ID AND moqd.ORGANIZATION_ID = msib.ORGANIZATION_ID',
    OM:  'OE_ORDER_HEADERS_ALL oeh\n  LEFT JOIN OE_ORDER_LINES_ALL oel ON oel.HEADER_ID = oeh.HEADER_ID AND oel.ORG_ID = oeh.ORG_ID',
    HR:  'PER_ALL_PEOPLE_F papf\n  JOIN PER_ALL_ASSIGNMENTS_F paaf ON paaf.PERSON_ID = papf.PERSON_ID AND paaf.PRIMARY_FLAG = \'Y\' AND paaf.EFFECTIVE_START_DATE <= TRUNC(SYSDATE) AND paaf.EFFECTIVE_END_DATE >= TRUNC(SYSDATE)\n  LEFT JOIN HR_ALL_ORGANIZATION_UNITS haou ON haou.ORGANIZATION_ID = paaf.ORGANIZATION_ID',
    FA:  'FA_ADDITIONS_B fab\n  JOIN FA_BOOKS fb ON fb.ASSET_ID = fab.ASSET_ID AND fb.TRANSACTION_HEADER_ID_OUT IS NULL',
    CM:  'CE_BANK_ACCOUNTS cba\n  LEFT JOIN CE_STATEMENT_HEADERS csh ON csh.BANK_ACCOUNT_ID = cba.BANK_ACCOUNT_ID\n  LEFT JOIN CE_STATEMENT_LINES csl ON csl.STATEMENT_HEADER_ID = csh.STATEMENT_HEADER_ID',
    PA:  'PA_PROJECTS_ALL pp\n  LEFT JOIN PA_TASKS pt ON pt.PROJECT_ID = pp.PROJECT_ID',
  };

  /* Module-specific WHERE base conditions */
  const MODULE_WHERE = {
    GL:  "gjh.LEDGER_ID   = FND_PROFILE.VALUE('GL_SET_OF_BKS_ID')\n  AND gjh.STATUS      = 'P'",
    AP:  "ai.ORG_ID       = FND_PROFILE.VALUE('ORG_ID')\n  AND ai.CANCELLED_DATE IS NULL",
    AR:  "rct.ORG_ID      = FND_PROFILE.VALUE('ORG_ID')",
    PO:  "ph.ORG_ID       = FND_PROFILE.VALUE('ORG_ID')\n  AND ph.CANCEL_FLAG  = 'N'",
    INV: "msib.ORGANIZATION_ID = FND_PROFILE.VALUE('MFG_ORGANIZATION_ID')\n  AND msib.ENABLED_FLAG = 'Y'",
    OM:  "oeh.ORG_ID      = FND_PROFILE.VALUE('ORG_ID')\n  AND oeh.CANCELLED_FLAG = 'N'",
    HR:  "papf.EFFECTIVE_START_DATE <= TRUNC(SYSDATE)\n  AND papf.EFFECTIVE_END_DATE   >= TRUNC(SYSDATE)",
    FA:  "fab.ASSET_TYPE  <> 'EXPENSED'",
    CM:  "cba.ORG_ID      = FND_PROFILE.VALUE('ORG_ID')",
    PA:  "pp.ORG_ID       = FND_PROFILE.VALUE('ORG_ID')\n  AND pp.COMPLETION_DATE IS NULL",
  };

  const MODULE_PK = {
    GL: 'gjh.JE_HEADER_ID', AP: 'ai.INVOICE_ID', AR: 'rct.CUSTOMER_TRX_ID',
    PO: 'ph.PO_HEADER_ID', INV: 'msib.INVENTORY_ITEM_ID', OM: 'oeh.HEADER_ID',
    HR: 'papf.PERSON_ID', FA: 'fab.ASSET_ID', CM: 'cba.BANK_ACCOUNT_ID', PA: 'pp.PROJECT_ID',
  };

  /* ═══════════════════════════════════════════════════════════════════════
     DOCUMENT PARSER
     ═══════════════════════════════════════════════════════════════════════ */
  const DocumentParser = {

    readFile(file) {
      return new Promise((resolve, reject) => {
        if (!file) return reject('No file provided');
        const name = file.name.toLowerCase();
        const reader = new FileReader();
        reader.onerror = () => reject('File read error');
        reader.onload = e => {
          let text = '';
          if (name.endsWith('.pdf')) {
            /* Extract printable ASCII from PDF bytes */
            const bytes = new Uint8Array(e.target.result);
            let raw = '';
            for (let i = 0; i < bytes.length; i++) {
              const c = bytes[i];
              if ((c >= 32 && c <= 126) || c === 10 || c === 13) raw += String.fromCharCode(c);
            }
            text = raw.replace(/ {3,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
          } else if (name.endsWith('.docx')) {
            /* DOCX via SheetJS if available, else XML strip */
            try {
              const arr = new Uint8Array(e.target.result);
              const wb  = XLSX.read(arr, { type: 'array' });
              const ws  = wb.Sheets[wb.SheetNames[0]];
              text = XLSX.utils.sheet_to_csv(ws);
            } catch (_) {
              const raw = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(e.target.result));
              text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            }
          } else {
            text = e.target.result || '';
          }
          resolve(text);
        };
        if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });
    },

    /* Extract structured requirement lines from free text.
       Returns at most 10 items to avoid flooding the UI. */
    extractRequirements(text) {
      if (!text || !text.trim()) return [];
      const lines = text.split(/\r?\n/);
      const reqs  = [];
      let   cur   = '';

      /* Pattern: REQ-001, FR-1, 1. , 1) , BR001: etc */
      const startPat = /^(?:REQ[-\s]?\d+|FR[-\s]?\d+|BR[-\s]?\d+|[A-Z]{2,5}-\d+|Requirement\s*\d*\s*[:–\-]|\d+[\.\)]\s+[A-Z]|[•\-]\s+[A-Z])/i;

      for (const line of lines) {
        const t = line.trim();
        if (!t) {
          if (cur.trim()) { reqs.push(cur.trim()); cur = ''; }
          continue;
        }
        if (startPat.test(t) && cur.trim()) {
          reqs.push(cur.trim());
          cur = t;
        } else {
          cur = cur ? cur + ' ' + t : t;
        }
      }
      if (cur.trim()) reqs.push(cur.trim());

      /* Filter: must be at least 25 chars, cap at 10 */
      const filtered = reqs.filter(r => r.length >= 25);
      if (filtered.length > 0) return filtered.slice(0, 10);

      /* Fallback: whole text is one requirement */
      return [text.trim().substring(0, 500)];
    },

    detectModules(text) {
      const lower = text.toLowerCase();
      return Object.keys(MODULE_KEYWORDS).filter(mod =>
        MODULE_KEYWORDS[mod].some(kw => lower.includes(kw))
      );
    },

    parseDataColumns(csvText) {
      if (!csvText || !csvText.trim()) return [];
      const firstLine = csvText.split('\n')[0];
      const sep = firstLine.includes('\t') ? '\t' : ',';
      return firstLine.split(sep).map(c => c.trim().replace(/^"|"$/g, '')).filter(Boolean);
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     SQL GENERATOR  — context-aware per requirement
     ═══════════════════════════════════════════════════════════════════════ */
  const SQLGenerator = {

    generate(requirements, modules, columns) {
      return requirements.map((req, idx) => {
        /* Per-requirement: use passed modules if selected, else detect from this req line */
        const mods   = modules.length ? modules : DocumentParser.detectModules(req);
        const mod    = mods[0] || 'AP';  /* primary module drives SQL structure */
        const sql    = this._buildSQL(req, mod, modules, columns, idx + 1);
        return { id: idx + 1, requirement: req, sql };
      });
    },

    _buildSQL(req, primaryMod, allMods, columns, num) {
      const lower    = req.toLowerCase();
      const today    = new Date().toLocaleDateString('en-GB');
      const hasDate  = /date|period|month|year|fiscal|from|to/i.test(lower);
      const hasAmt   = /amount|total|sum|balance|value|cost/i.test(lower);
      const hasStatus= /status|active|pending|approved|rejected|complete|paid|unpaid/i.test(lower);
      const isAgg    = /total|sum|count|how many|summary|aggregate|group/i.test(lower);

      /* Build SELECT */
      let selectCols;
      if (columns && columns.length > 0) {
        /* Use exact columns from Excel/pasted data */
        const alias = _getBaseAlias(primaryMod);
        selectCols = columns.map(c => `  ${alias}.${c.toUpperCase()}`).join(',\n');
      } else {
        const cols = MODULE_SELECT_COLS[primaryMod] || MODULE_SELECT_COLS.AP;
        if (isAgg) {
          const grpCols = [];
          if (hasDate)   grpCols.push(`  TRUNC(${_getBaseAlias(primaryMod)}.CREATION_DATE,'MM') AS PERIOD`);
          if (hasStatus) grpCols.push(`  ${_getBaseAlias(primaryMod)}.${_getStatusCol(primaryMod)}`);
          grpCols.push(`  COUNT(*)                                                AS RECORD_COUNT`);
          if (hasAmt)    grpCols.push(`  SUM(${_getAmtCol(primaryMod)})           AS TOTAL_AMOUNT`);
          selectCols = grpCols.join(',\n');
        } else {
          selectCols = cols.map(c => `  ${c}`).join(',\n');
        }
      }

      const fromJoin  = MODULE_FROM_JOIN[primaryMod] || `${TABLE_MAP[primaryMod]?.[0] || 'XX_TABLE'} a`;
      const whereBase = MODULE_WHERE[primaryMod] || `a.ORG_ID = FND_PROFILE.VALUE('ORG_ID')`;

      let whereClauses = '';
      if (hasDate)   whereClauses += `  AND    (:p_start_date IS NULL OR ${_getDateCol(primaryMod)} >= TRUNC(:p_start_date))\n  AND    (:p_end_date   IS NULL OR ${_getDateCol(primaryMod)} <= TRUNC(:p_end_date))\n`;
      if (hasStatus) whereClauses += `  AND    (:p_status IS NULL OR ${_getBaseAlias(primaryMod)}.${_getStatusCol(primaryMod)} = :p_status)\n`;
      if (primaryMod === 'AP' && /unpaid|outstanding/i.test(lower)) whereClauses += `  AND    ai.PAYMENT_STATUS_FLAG = 'U'\n`;
      if (primaryMod === 'AP' && /overdue/i.test(lower))           whereClauses += `  AND    apsa.DUE_DATE < TRUNC(SYSDATE)\n`;

      let groupBy = '';
      if (isAgg) {
        const gcols = [];
        if (hasDate)   gcols.push(`  TRUNC(${_getBaseAlias(primaryMod)}.CREATION_DATE,'MM')`);
        if (hasStatus) gcols.push(`  ${_getBaseAlias(primaryMod)}.${_getStatusCol(primaryMod)}`);
        if (gcols.length) groupBy = `GROUP  BY\n${gcols.join(',\n')}\n`;
      }

      return (
`-- ============================================================
-- SQL Query #${num}
-- Requirement: ${req.substring(0, 80).replace(/\n/g,' ')}${req.length > 80 ? '...' : ''}
-- Module     : ${primaryMod}
-- Generated  : ${today} | Oracle EBS Intelligence Hub
-- ============================================================

SELECT
${selectCols}
FROM
  ${fromJoin}
WHERE
  ${whereBase}
${whereClauses}${groupBy}ORDER  BY  ${_getOrderCol(primaryMod)}
FETCH  FIRST 1000 ROWS ONLY;
`);
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     PL/SQL GENERATOR
     ═══════════════════════════════════════════════════════════════════════ */
  const PLSQLGenerator = {

    generatePackage(requirements, modules) {
      const mod     = modules[0] || 'EBS';
      const pkgName = `XX_${mod}_REQ_PKG`;
      const mainTbl = (TABLE_MAP[mod] || ['XX_CUSTOM_TABLE'])[0];
      const fromJoin= MODULE_FROM_JOIN[mod] || `${mainTbl} a`;
      const today   = new Date().toLocaleDateString('en-GB');

      let spec = `-- ============================================================\n-- Package : ${pkgName}\n-- Module  : ${mod}\n-- Created : ${today}\n-- ============================================================\n\n`;
      spec += `CREATE OR REPLACE PACKAGE ${pkgName} AS\n\n`;
      spec += `  gc_pkg CONSTANT VARCHAR2(60) := '${pkgName}';\n\n`;
      spec += `  e_validation_error EXCEPTION;\n  PRAGMA EXCEPTION_INIT(e_validation_error, -20001);\n\n`;
      requirements.forEach((req, i) => {
        const pn = `process_req_${i + 1}`;
        spec += `  -- REQ-${i + 1}: ${req.substring(0, 70).replace(/\n/g,' ')}\n`;
        spec += `  PROCEDURE ${pn}(\n    p_org_id      IN  NUMBER,\n    p_start_date  IN  DATE     DEFAULT NULL,\n    p_end_date    IN  DATE     DEFAULT NULL,\n    p_status      IN  VARCHAR2 DEFAULT NULL,\n    errbuf        OUT VARCHAR2,\n    retcode       OUT NUMBER\n  );\n\n`;
      });
      spec += `END ${pkgName};\n/\n\n`;

      let body = `CREATE OR REPLACE PACKAGE BODY ${pkgName} AS\n\n`;
      body += `  PROCEDURE log_msg(p_msg IN VARCHAR2) IS\n  BEGIN\n    FND_FILE.PUT_LINE(FND_FILE.LOG,    p_msg);\n    FND_FILE.PUT_LINE(FND_FILE.OUTPUT, p_msg);\n  EXCEPTION WHEN OTHERS THEN NULL;\n  END log_msg;\n\n`;

      requirements.forEach((req, i) => {
        const pn   = `process_req_${i + 1}`;
        const sql  = SQLGenerator._buildSQL(req, mod, modules, _parsedColumns, i + 1);
        body += `  -- ──────────────────────────────────────────────────────────\n`;
        body += `  -- REQ-${i + 1}: ${req.substring(0, 70).replace(/\n/g,' ')}\n`;
        body += `  -- ──────────────────────────────────────────────────────────\n`;
        body += `  PROCEDURE ${pn}(\n    p_org_id      IN  NUMBER,\n    p_start_date  IN  DATE     DEFAULT NULL,\n    p_end_date    IN  DATE     DEFAULT NULL,\n    p_status      IN  VARCHAR2 DEFAULT NULL,\n    errbuf        OUT VARCHAR2,\n    retcode       OUT NUMBER\n  ) IS\n    l_count NUMBER := 0;\n  BEGIN\n`;
        body += `    retcode := 0;\n    log_msg('=== ${pkgName}.${pn} START ===');\n\n`;
        body += `    IF p_org_id IS NULL THEN\n      RAISE_APPLICATION_ERROR(-20001, 'ORG_ID is mandatory');\n    END IF;\n\n`;
        body += `    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_start_date > p_end_date THEN\n      RAISE_APPLICATION_ERROR(-20002, 'Start Date must be <= End Date');\n    END IF;\n\n`;
        body += `    MO_GLOBAL.SET_POLICY_CONTEXT('S', p_org_id);\n\n`;
        body += `    FOR r IN (\n${sql.split('\n').map(l => '      ' + l).join('\n')}\n    ) LOOP\n      l_count := l_count + 1;\n      -- TODO: process row r\n      NULL;\n    END LOOP;\n\n`;
        body += `    COMMIT;\n    log_msg('Processed: ' || l_count || ' rows');\n    log_msg('=== ${pkgName}.${pn} END ===');\n\n`;
        body += `  EXCEPTION\n    WHEN e_validation_error THEN\n      retcode := 2;\n      errbuf  := SQLERRM;\n    WHEN OTHERS THEN\n      ROLLBACK;\n      retcode := 2;\n      errbuf  := 'FATAL: ' || SQLERRM;\n      FND_FILE.PUT_LINE(FND_FILE.LOG, DBMS_UTILITY.FORMAT_ERROR_BACKTRACE);\n  END ${pn};\n\n`;
      });
      body += `END ${pkgName};\n/\n`;
      return spec + body;
    },

    generateProcedure(requirements, modules) {
      const mod     = modules[0] || 'AP';
      const mainTbl = (TABLE_MAP[mod] || ['XX_CUSTOM_TABLE'])[0];
      const today   = new Date().toLocaleDateString('en-GB');
      let   out     = '';

      requirements.forEach((req, i) => {
        const procName = `XX_${mod}_REQ${i + 1}_PRC`;
        const sql  = SQLGenerator._buildSQL(req, mod, modules, _parsedColumns, i + 1);
        out += `-- ============================================================\n-- Procedure : ${procName}\n-- REQ-${i + 1}    : ${req.substring(0, 70).replace(/\n/g,' ')}\n-- Module    : ${mod} | Created: ${today}\n-- ============================================================\nCREATE OR REPLACE PROCEDURE ${procName} (\n  p_org_id      IN  NUMBER,\n  p_start_date  IN  DATE     DEFAULT NULL,\n  p_end_date    IN  DATE     DEFAULT NULL,\n  p_status      IN  VARCHAR2 DEFAULT NULL,\n  errbuf        OUT VARCHAR2,\n  retcode       OUT NUMBER\n) AS\n  l_count NUMBER := 0;\nBEGIN\n  retcode := 0;\n\n  IF p_org_id IS NULL THEN\n    RAISE_APPLICATION_ERROR(-20001, 'p_org_id is mandatory');\n  END IF;\n\n  MO_GLOBAL.SET_POLICY_CONTEXT('S', p_org_id);\n\n  FOR r IN (\n${sql.split('\n').map(l => '    ' + l).join('\n')}\n  ) LOOP\n    l_count := l_count + 1;\n    NULL; -- TODO: add processing logic\n  END LOOP;\n\n  COMMIT;\n  FND_FILE.PUT_LINE(FND_FILE.LOG, 'Processed ' || l_count || ' rows');\n\nEXCEPTION\n  WHEN OTHERS THEN\n    ROLLBACK;\n    retcode := 2;\n    errbuf  := 'Error in ${procName}: ' || SQLERRM;\nEND ${procName};\n/\n\n`;
      });
      return out;
    },

    generateTrigger(requirements, modules) {
      const mod   = modules[0] || 'AP';
      const table = (TABLE_MAP[mod] || ['XX_CUSTOM_TABLE'])[0];
      const today = new Date().toLocaleDateString('en-GB');
      let   out   = '';

      requirements.forEach((req, i) => {
        const trigName = `XX_${mod}_REQ${i + 1}_TRG`;
        out += `-- ============================================================\n-- Trigger  : ${trigName}\n-- Table    : ${table}\n-- REQ-${i + 1}   : ${req.substring(0, 70).replace(/\n/g,' ')}\n-- Created  : ${today}\n-- ============================================================\nCREATE OR REPLACE TRIGGER ${trigName}\n  BEFORE INSERT OR UPDATE ON ${table}\n  FOR EACH ROW\nDECLARE\n  l_user  NUMBER := NVL(FND_GLOBAL.USER_ID, -1);\n  l_login NUMBER := NVL(FND_GLOBAL.LOGIN_ID, -1);\nBEGIN\n  -- WHO column population\n  IF INSERTING THEN\n    :NEW.CREATED_BY        := l_user;\n    :NEW.CREATION_DATE     := SYSDATE;\n    :NEW.LAST_UPDATED_BY   := l_user;\n    :NEW.LAST_UPDATE_DATE  := SYSDATE;\n    :NEW.LAST_UPDATE_LOGIN := l_login;\n  ELSIF UPDATING THEN\n    :NEW.LAST_UPDATED_BY   := l_user;\n    :NEW.LAST_UPDATE_DATE  := SYSDATE;\n    :NEW.LAST_UPDATE_LOGIN := l_login;\n  END IF;\n\n  -- ORG_ID validation\n  IF :NEW.ORG_ID IS NULL THEN\n    RAISE_APPLICATION_ERROR(-20010, 'ORG_ID cannot be NULL on ${table}');\n  END IF;\n\nEXCEPTION\n  WHEN OTHERS THEN\n    RAISE_APPLICATION_ERROR(-20099, '${trigName}: ' || SQLERRM);\nEND ${trigName};\n/\n\n`;
      });
      return out;
    },

    generateStagingTable(requirements, modules, columns) {
      const mod   = modules[0] || 'EBS';
      const today = new Date().toLocaleDateString('en-GB');
      let   out   = '';

      requirements.forEach((req, i) => {
        const stg = `XX_${mod}_REQ${i + 1}_STG`;
        const seq = `${stg}_S`;
        out += `-- ============================================================\n-- Staging Table : ${stg}\n-- REQ-${i + 1}          : ${req.substring(0, 70).replace(/\n/g,' ')}\n-- Module        : ${mod} | Created: ${today}\n-- ============================================================\n\n-- DROP TABLE ${stg} PURGE;\n-- DROP SEQUENCE ${seq};\n\nCREATE TABLE ${stg} (\n  -- Control columns\n  STG_ID              NUMBER          NOT NULL,\n  BATCH_ID            NUMBER,\n  REQUEST_ID          NUMBER,\n  STATUS_CODE         VARCHAR2(30)    DEFAULT 'NEW'   NOT NULL,\n  ERROR_MESSAGE       VARCHAR2(4000),\n  PROCESS_FLAG        VARCHAR2(1)     DEFAULT 'N'     NOT NULL,\n  RETRY_COUNT         NUMBER          DEFAULT 0,\n\n  -- Source / data columns\n  SOURCE_ID           NUMBER,\n  ORG_ID              NUMBER,\n`;
        if (columns && columns.length > 0) {
          columns.forEach(col => {
            out += `  ${col.toUpperCase().replace(/\s+/g,'_').padEnd(24)}VARCHAR2(500),\n`;
          });
        } else {
          const srcCols = {
            AP: '  INVOICE_ID          NUMBER,\n  INVOICE_NUM         VARCHAR2(50),\n  VENDOR_NAME         VARCHAR2(240),\n  INVOICE_AMOUNT      NUMBER,\n  INVOICE_DATE        DATE,\n  PAYMENT_STATUS_FLAG VARCHAR2(1),\n',
            AR: '  TRX_ID              NUMBER,\n  TRX_NUMBER          VARCHAR2(20),\n  CUSTOMER_NAME       VARCHAR2(240),\n  AMOUNT              NUMBER,\n  TRX_DATE            DATE,\n',
            GL: '  JE_HEADER_ID        NUMBER,\n  PERIOD_NAME         VARCHAR2(15),\n  ENTERED_DR          NUMBER,\n  ENTERED_CR          NUMBER,\n  CURRENCY_CODE       VARCHAR2(15),\n',
            PO: '  PO_HEADER_ID        NUMBER,\n  PO_NUMBER           VARCHAR2(20),\n  VENDOR_NAME         VARCHAR2(240),\n  TOTAL_AMOUNT        NUMBER,\n  AUTH_STATUS         VARCHAR2(25),\n',
            HR: '  PERSON_ID           NUMBER,\n  EMPLOYEE_NUMBER     VARCHAR2(30),\n  FULL_NAME           VARCHAR2(240),\n  DEPARTMENT          VARCHAR2(100),\n',
            INV:'  INVENTORY_ITEM_ID   NUMBER,\n  ITEM_NUMBER         VARCHAR2(40),\n  DESCRIPTION         VARCHAR2(240),\n  ONHAND_QTY          NUMBER,\n',
          };
          out += (srcCols[mod] || '  SOURCE_VALUE        VARCHAR2(4000),\n  AMOUNT              NUMBER,\n  TRX_DATE            DATE,\n');
        }
        out += `\n  -- WHO columns\n  CREATED_BY          NUMBER          DEFAULT -1      NOT NULL,\n  CREATION_DATE       DATE            DEFAULT SYSDATE NOT NULL,\n  LAST_UPDATED_BY     NUMBER          DEFAULT -1      NOT NULL,\n  LAST_UPDATE_DATE    DATE            DEFAULT SYSDATE NOT NULL,\n  LAST_UPDATE_LOGIN   NUMBER,\n\n  CONSTRAINT ${stg}_PK PRIMARY KEY (STG_ID)\n)\nTABLESPACE XXCUST_DATA;\n\nCREATE SEQUENCE ${seq} START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;\n\nCREATE INDEX ${stg}_N1 ON ${stg}(STATUS_CODE, PROCESS_FLAG) TABLESPACE XXCUST_INDX;\nCREATE INDEX ${stg}_N2 ON ${stg}(SOURCE_ID)                 TABLESPACE XXCUST_INDX;\n\nCREATE OR REPLACE PUBLIC SYNONYM ${stg} FOR ${stg};\nGRANT SELECT, INSERT, UPDATE ON ${stg} TO APPS;\n\n`;
      });
      return out;
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TEST CASE GENERATOR
     ═══════════════════════════════════════════════════════════════════════ */
  const TestCaseGenerator = {

    generate(requirements, modules) {
      const mod   = modules[0] || 'AP';
      const cases = [];

      requirements.forEach((req, ri) => {
        const base  = `TC-${String(ri + 1).padStart(3, '0')}`;
        const lower = req.toLowerCase();
        const hasAmt    = /amount|total|sum|value|balance/i.test(lower);
        const hasDate   = /date|period|month|year/i.test(lower);
        const hasStatus = /status|approved|rejected|pending|paid|unpaid/i.test(lower);

        cases.push({
          id: `${base}-P01`, type: 'positive',
          requirement: `REQ-${ri + 1}`,
          description: `Verify valid execution for: "${req.substring(0, 60).replace(/\n/g,' ')}"`,
          preconditions: `Valid ORG_ID exists in ${mod} module. Required records present in source tables.`,
          testSteps: ['1. Log in as Technical user with appropriate EBS responsibility','2. Execute with valid ORG_ID and date range','3. Verify record count > 0 and all columns populated'],
          expectedResult: `Query/procedure returns expected records. No ORA- errors. Return code = 0 / 'S'.`,
          actualResult: '', status: 'Not Executed',
        });

        cases.push({
          id: `${base}-N01`, type: 'negative',
          requirement: `REQ-${ri + 1}`,
          description: `Verify NULL ORG_ID is rejected`,
          preconditions: `Test environment accessible`,
          testSteps: ['1. Execute with p_org_id = NULL','2. Observe error behaviour'],
          expectedResult: `ORA-20001 raised: "ORG_ID is mandatory". No records processed. retcode = 2.`,
          actualResult: '', status: 'Not Executed',
        });

        cases.push({
          id: `${base}-N02`, type: 'negative',
          requirement: `REQ-${ri + 1}`,
          description: `Verify invalid / non-existent ORG_ID returns no data`,
          preconditions: `Use ORG_ID = 9999999 (does not exist)`,
          testSteps: ['1. Execute with ORG_ID = 9999999','2. Check row count'],
          expectedResult: `0 rows returned. No exception. MO policy enforced correctly.`,
          actualResult: '', status: 'Not Executed',
        });

        if (hasDate) cases.push({
          id: `${base}-N03`, type: 'negative',
          requirement: `REQ-${ri + 1}`,
          description: `Start date > End date should raise validation error`,
          preconditions: `Valid ORG_ID`,
          testSteps: ['1. Set p_start_date = SYSDATE','2. Set p_end_date = SYSDATE - 1','3. Execute'],
          expectedResult: `ORA-20002: "Start Date must be <= End Date". No processing.`,
          actualResult: '', status: 'Not Executed',
        });

        if (hasAmt) cases.push({
          id: `${base}-B01`, type: 'boundary',
          requirement: `REQ-${ri + 1}`,
          description: `Boundary test: zero-amount records`,
          preconditions: `Records with amount = 0 exist in source`,
          testSteps: ['1. Query with no amount filter','2. Check 0-amount rows returned'],
          expectedResult: `Zero-amount rows included or excluded per business rule. No ORA-1403.`,
          actualResult: '', status: 'Not Executed',
        });

        if (hasStatus) cases.push({
          id: `${base}-B02`, type: 'boundary',
          requirement: `REQ-${ri + 1}`,
          description: `Boundary test: invalid status value`,
          preconditions: `Valid ORG_ID`,
          testSteps: ['1. Pass p_status = \'INVALID_STATUS\'','2. Observe result'],
          expectedResult: `0 rows returned. No exception. Bind variable prevents SQL injection.`,
          actualResult: '', status: 'Not Executed',
        });

        cases.push({
          id: `${base}-S01`, type: 'security',
          requirement: `REQ-${ri + 1}`,
          description: `Cross-org data access must be blocked`,
          preconditions: `User assigned to Org A (ORG_ID = 101)`,
          testSteps: ['1. Execute with ORG_ID belonging to different operating unit','2. Verify MO policy enforcement'],
          expectedResult: `No cross-org records returned. FND_PROFILE / MO_GLOBAL enforces ORG boundary.`,
          actualResult: '', status: 'Not Executed',
        });
      });

      return cases;
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TDD GENERATOR
     ═══════════════════════════════════════════════════════════════════════ */
  const TDDGenerator = {

    generate(requirements, modules, fileName, columns, dbMode) {
      const mod   = modules[0] || 'EBS';
      const mods  = modules.join(', ') || 'Oracle EBS';
      const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
      const tables= (TABLE_MAP[mod] || []).slice(0, 5).join(', ') || 'See module tables';

      let doc = `╔══════════════════════════════════════════════════════════════════╗\n║  TECHNICAL DESIGN DOCUMENT                                       ║\n║  Oracle EBS Intelligence Hub — Requirements Studio              ║\n╚══════════════════════════════════════════════════════════════════╝\n\n`;
      doc += `DOCUMENT INFORMATION\n${'─'.repeat(60)}\n  Project      : Oracle EBS Customisation\n  Document     : Technical Design Document (TDD)\n  Module(s)    : ${mods}\n  Source File  : ${fileName || 'Requirements Text'}\n  Generated By : Oracle EBS Intelligence Hub — Requirements Studio\n  Date         : ${today}\n  Version      : 1.0   Status: DRAFT\n\n`;
      doc += `1. OVERVIEW\n${'─'.repeat(60)}\n  This TDD describes the technical design for requirements\n  sourced from "${fileName || 'pasted text'}". It covers\n  Oracle EBS module(s): ${mods}.\n\n`;
      doc += `2. REQUIREMENTS SUMMARY\n${'─'.repeat(60)}\n`;
      requirements.forEach((r, i) => { doc += `  REQ-${String(i+1).padStart(3,'0')} : ${r.substring(0,110).replace(/\n/g,' ')}\n`; });
      doc += `\n3. EBS MODULES & BASE TABLES\n${'─'.repeat(60)}\n`;
      modules.forEach(m => {
        doc += `  ${m}:\n`;
        (TABLE_MAP[m] || []).forEach(t => { doc += `    - ${t}\n`; });
      });
      doc += `\n4. DATA SOURCE\n${'─'.repeat(60)}\n`;
      if (columns && columns.length) {
        doc += `  Source Type : Excel / Pasted column data\n  Columns     : ${columns.join(', ')}\n`;
      } else {
        doc += `  Source Type : ${dbMode ? 'Live EBS Database Connection' : 'Requirements Document / Text'}\n  Tables      : ${tables}\n`;
      }
      doc += `\n5. ARTIFACTS GENERATED\n${'─'.repeat(60)}\n`;
      doc += `  5.1 SQL Queries      — ${requirements.length} SELECT queries (1 per requirement)\n`;
      doc += `  5.2 PL/SQL Package   — XX_${mod}_REQ_PKG (spec + body), FND_FILE logging, MO_GLOBAL\n`;
      doc += `  5.3 Procedures       — ${requirements.length} standalone procedures (XX_${mod}_REQn_PRC)\n`;
      doc += `  5.4 Triggers         — ${requirements.length} BEFORE INSERT OR UPDATE triggers (WHO columns)\n`;
      doc += `  5.5 Staging Tables   — ${requirements.length} tables (XX_${mod}_REQn_STG + seq + synonym)\n`;
      doc += `\n6. ERROR HANDLING\n${'─'.repeat(60)}\n  - ORA-20001 : ORG_ID is NULL\n  - ORA-20002 : Start Date > End Date\n  - ORA-20010 : ORG_ID NULL on trigger table\n  - OTHERS    : ROLLBACK, log FND_FILE, retcode = 2\n  - Row-level : catch OTHERS, mark staging row STATUS_CODE = 'ERROR'\n\n`;
      doc += `7. SECURITY & MULTI-ORG\n${'─'.repeat(60)}\n  - MO_GLOBAL.SET_POLICY_CONTEXT enforced in all procedures\n  - FND_PROFILE.VALUE('ORG_ID') used in SQL WHERE clauses\n  - Bind variables used for all parameters (SQL injection prevention)\n  - DateTrack applied for ${mod === 'HR' ? 'PER_ tables (EFFECTIVE_START/END_DATE)' : 'N/A (non-HRMS module)'}\n\n`;
      doc += `8. DEPLOYMENT CHECKLIST\n${'─'.repeat(60)}\n  [ ] Review and rename objects to project naming convention\n  [ ] Execute Staging Table DDL in DEV\n  [ ] Compile PL/SQL Package and Procedures\n  [ ] Create Triggers\n  [ ] Run unit tests (positive + negative + boundary)\n  [ ] Code review sign-off\n  [ ] SIT / UAT migration\n  [ ] Production change management approval\n\n`;
      doc += `── END OF DOCUMENT ──────────────────────────────────────────────\n`;
      return doc;
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════════════════════ */
  function _getBaseAlias(mod) {
    return { GL:'gjh', AP:'ai', AR:'rct', PO:'ph', INV:'msib', OM:'oeh', HR:'papf', FA:'fab', CM:'cba', PA:'pp' }[mod] || 'a';
  }
  function _getDateCol(mod) {
    return { GL:'gjh.DEFAULT_EFFECTIVE_DATE', AP:'ai.INVOICE_DATE', AR:'rct.TRX_DATE',
             PO:'ph.CREATION_DATE', INV:'msib.LAST_UPDATE_DATE', OM:'oeh.ORDERED_DATE',
             HR:'papf.EFFECTIVE_START_DATE', FA:'fab.DATE_PLACED_IN_SERVICE',
             CM:'csh.STATEMENT_DATE', PA:'pp.COMPLETION_DATE' }[mod] || `${_getBaseAlias(mod)}.CREATION_DATE`;
  }
  function _getStatusCol(mod) {
    return { GL:'STATUS', AP:'PAYMENT_STATUS_FLAG', AR:'STATUS', PO:'AUTHORIZATION_STATUS',
             INV:'INVENTORY_ITEM_STATUS_CODE', OM:'FLOW_STATUS_CODE', HR:'EMPLOYMENT_CATEGORY',
             FA:'ASSET_TYPE', CM:'STATUS', PA:'PROJECT_STATUS_CODE' }[mod] || 'STATUS';
  }
  function _getAmtCol(mod) {
    return { AP:'ai.INVOICE_AMOUNT', AR:'rct.REVENUE_AMOUNT', GL:'gjl.ENTERED_DR',
             PO:'ph.TOTAL_AMOUNT', FA:'fb.COST', PA:'pe.RAW_COST' }[mod] || `${_getBaseAlias(mod)}.AMOUNT`;
  }
  function _getOrderCol(mod) {
    return { GL:'gjh.PERIOD_NAME', AP:'ai.INVOICE_DATE DESC', AR:'rct.TRX_DATE DESC',
             PO:'ph.CREATION_DATE DESC', INV:'msib.SEGMENT1', OM:'oeh.ORDERED_DATE DESC',
             HR:'papf.EMPLOYEE_NUMBER', FA:'fab.DATE_PLACED_IN_SERVICE DESC',
             CM:'csh.STATEMENT_DATE DESC', PA:'pp.SEGMENT1' }[mod] || `${_getBaseAlias(mod)}.CREATION_DATE DESC`;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     UI CONTROLLER
     ═══════════════════════════════════════════════════════════════════════ */
  const UI = {

    init() {
      this._bindUpload();
      this._bindDbToggle();
      this._bindDataToggle();
      this._bindArtifactTabs();
      this._bindGenerate();
      this._bindClear();
    },

    _bindUpload() {
      const zone  = document.getElementById('rs-upload-zone');
      const input = document.getElementById('rs-file-input');
      if (!zone || !input) return;

      /* Click on zone triggers file browse — but NOT if already clicking the input itself */
      zone.addEventListener('click', e => {
        if (e.target !== input) input.click();
      });
      zone.addEventListener('dragover',  e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', e => { e.stopPropagation(); zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', async e => {
        e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) await this._handleFile(f);
      });
      input.addEventListener('change', async () => {
        if (input.files[0]) await this._handleFile(input.files[0]);
        input.value = ''; /* reset so same file can be re-selected */
      });
    },

    async _handleFile(file) {
      const fname = document.getElementById('rs-file-name');
      try {
        _state.fileName = file.name;
        const text = await DocumentParser.readFile(file);
        _state.rawText = text;
        const ta = document.getElementById('rs-req-textarea');
        if (ta) ta.value = text.substring(0, 4000);
        if (fname) { fname.textContent = '📄 ' + file.name; fname.classList.add('visible'); }
        this._autoDetectModules(text);
      } catch (err) {
        if (fname) { fname.textContent = '⚠️ Could not read file — paste text below'; fname.classList.add('visible'); }
        console.error('RS file read error:', err);
      }
    },

    _autoDetectModules(text) {
      const detected = DocumentParser.detectModules(text);
      document.querySelectorAll('.rs-mod-cb').forEach(cb => {
        cb.checked = detected.includes(cb.value);
      });
    },

    _bindDbToggle() {
      const tog    = document.getElementById('rs-db-toggle');
      const fields = document.getElementById('rs-db-fields');
      if (!tog || !fields) return;
      tog.addEventListener('change', () => {
        _state.dbMode = tog.checked;
        fields.classList.toggle('visible', tog.checked);
      });
    },

    _bindDataToggle() {
      const tog    = document.getElementById('rs-data-toggle');
      const fields = document.getElementById('rs-excel-paste');
      if (!tog || !fields) return;
      tog.addEventListener('change', () => {
        _state.dataMode = tog.checked;
        fields.classList.toggle('visible', tog.checked);
      });
    },

    _bindArtifactTabs() {
      document.querySelectorAll('.rs-art-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.rs-art-tab').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.rs-art-panel').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const target = document.getElementById('rs-panel-' + btn.dataset.artifact);
          if (target) target.classList.add('active');
          _state.activeArtifact = btn.dataset.artifact;
        });
      });
    },

    _bindGenerate() {
      const btn = document.getElementById('rs-generate-btn');
      if (!btn) return;
      btn.addEventListener('click', () => this._runGeneration());
    },

    _bindClear() {
      const btn = document.getElementById('rs-clear-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const ta = document.getElementById('rs-req-textarea');
        const fi = document.getElementById('rs-file-input');
        const fn = document.getElementById('rs-file-name');
        if (ta) ta.value = '';
        if (fi) fi.value = '';
        if (fn) { fn.textContent = ''; fn.classList.remove('visible'); }
        _state.rawText = ''; _state.fileName = ''; _state.generated = {};
        document.querySelectorAll('.rs-mod-cb').forEach(c => c.checked = false);
        document.querySelectorAll('.rs-artifact-type-cb').forEach(c => c.checked = true);
        this._resetUI();
      });
    },

    _resetUI() {
      document.querySelectorAll('.rs-art-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('rs-panel-sql').classList.add('active');
      document.querySelectorAll('.rs-art-tab').forEach(b => b.classList.remove('active'));
      document.querySelector('.rs-art-tab[data-artifact="sql"]').classList.add('active');
      /* Reset count badges */
      document.querySelectorAll('.rs-art-count').forEach(el => { el.textContent = ''; el.classList.remove('visible'); });
      const badge  = document.getElementById('rs-status-badge');
      const dlBtn  = document.getElementById('rs-download-all-btn');
      const pbar   = document.getElementById('rs-progress-bar');
      const pstat  = document.getElementById('rs-progress-status');
      if (badge)  { badge.textContent = 'Ready'; badge.className = 'rs-status-badge'; }
      if (dlBtn)  dlBtn.disabled = true;
      if (pbar)   pbar.style.width = '0%';
      if (pstat)  pstat.textContent = 'Ready to generate';
    },

    async _runGeneration() {
      const ta   = document.getElementById('rs-req-textarea');
      const text = (ta && ta.value.trim()) || _state.rawText;
      if (!text) { alert('Please upload a document or paste requirements text first.'); return; }

      /* ── 1. Collect selected MODULES ─────────────────────────────── */
      const checkedMods = [];
      document.querySelectorAll('.rs-mod-cb:checked').forEach(cb => checkedMods.push(cb.value));
      /* Only fall back to auto-detect when user has NOT ticked any module */
      _state.selectedModules = checkedMods.length ? checkedMods : DocumentParser.detectModules(text);
      if (!_state.selectedModules.length) _state.selectedModules = ['AP']; /* ultimate fallback */

      /* ── 2. Collect selected ARTIFACTS ───────────────────────────── */
      const checkedArt = [];
      document.querySelectorAll('.rs-artifact-type-cb:checked').forEach(cb => checkedArt.push(cb.value));
      _state.selectedArtifacts = checkedArt; /* empty = user unchecked everything, generate nothing */

      if (!_state.selectedArtifacts.length) {
        alert('Please select at least one artifact type to generate.');
        return;
      }

      /* ── 3. Collect Excel column data ────────────────────────────── */
      const pasteEl = document.getElementById('rs-data-paste');
      _parsedColumns = (pasteEl && pasteEl.value.trim())
        ? DocumentParser.parseDataColumns(pasteEl.value.trim())
        : [];

      this._setGenerating(true);
      await this._progress('Parsing requirements…', 5);

      const reqs = DocumentParser.extractRequirements(text);
      if (!reqs.length) {
        alert('Could not extract any requirements. Each requirement should be on its own line, optionally prefixed with REQ-001, FR-01, 1. etc.');
        this._setGenerating(false);
        return;
      }

      _state.parsedRequirements = reqs;
      _state.generated = {};
      const mods = _state.selectedModules;

      /* ── 4. Generate only selected artifacts ─────────────────────── */
      if (_state.selectedArtifacts.includes('sql')) {
        await this._progress('Generating SQL queries…', 20);
        _state.generated.sql = SQLGenerator.generate(reqs, mods, _parsedColumns);
        this._renderSQL(_state.generated.sql);
      }

      if (_state.selectedArtifacts.includes('package')) {
        await this._progress('Generating PL/SQL Package…', 38);
        _state.generated.package = PLSQLGenerator.generatePackage(reqs, mods);
        this._renderCode('rs-panel-package', _state.generated.package, 'PL/SQL Package', 'PLSQL');
      }

      if (_state.selectedArtifacts.includes('procedure')) {
        await this._progress('Generating Procedures…', 54);
        _state.generated.procedure = PLSQLGenerator.generateProcedure(reqs, mods);
        this._renderCode('rs-panel-procedure', _state.generated.procedure, 'Procedures', 'PLSQL');
      }

      if (_state.selectedArtifacts.includes('trigger')) {
        await this._progress('Generating Triggers…', 66);
        _state.generated.trigger = PLSQLGenerator.generateTrigger(reqs, mods);
        this._renderCode('rs-panel-trigger', _state.generated.trigger, 'Triggers', 'PLSQL');
      }

      if (_state.selectedArtifacts.includes('staging')) {
        await this._progress('Generating Staging Tables…', 77);
        _state.generated.staging = PLSQLGenerator.generateStagingTable(reqs, mods, _parsedColumns);
        this._renderCode('rs-panel-staging', _state.generated.staging, 'Staging Tables (DDL)', 'SQL');
      }

      if (_state.selectedArtifacts.includes('testcases')) {
        await this._progress('Generating Test Cases…', 88);
        _state.generated.testcases = TestCaseGenerator.generate(reqs, mods);
        this._renderTestCases(_state.generated.testcases);
      }

      if (_state.selectedArtifacts.includes('tdd')) {
        await this._progress('Generating Technical Design Document…', 96);
        _state.generated.tdd = TDDGenerator.generate(reqs, mods, _state.fileName, _parsedColumns, _state.dbMode);
        this._renderCode('rs-panel-tdd', _state.generated.tdd, 'Technical Design Document', 'TEXT');
      }

      await this._progress('Complete!', 100);
      this._setGenerating(false, true);
      this._updateCounts();
      document.getElementById('rs-download-all-btn').disabled = false;

      /* Switch to first generated artifact tab */
      const firstArt = _state.selectedArtifacts[0];
      const firstTab = document.querySelector(`.rs-art-tab[data-artifact="${firstArt}"]`);
      if (firstTab) firstTab.click();
    },

    _setGenerating(on, done) {
      _state.generating = on;
      const btn   = document.getElementById('rs-generate-btn');
      const badge = document.getElementById('rs-status-badge');
      if (btn) btn.disabled = on;
      if (badge) {
        if (on)         { badge.textContent = 'Generating…'; badge.className = 'rs-status-badge generating'; }
        else if (done)  { badge.textContent = 'Complete';    badge.className = 'rs-status-badge done'; }
        else            { badge.textContent = 'Ready';       badge.className = 'rs-status-badge'; }
      }
    },

    _progress(msg, pct) {
      const bar  = document.getElementById('rs-progress-bar');
      const stat = document.getElementById('rs-progress-status');
      if (bar)  bar.style.width = pct + '%';
      if (stat) stat.textContent = msg;
      return new Promise(r => setTimeout(r, 50));
    },

    _renderSQL(sqlItems) {
      const panel = document.getElementById('rs-panel-sql');
      if (!panel) return;
      const combined = sqlItems.map(item => item.sql).join('\n');
      this._injectCodeView(panel, combined, `${sqlItems.length} SQL Quer${sqlItems.length === 1 ? 'y' : 'ies'}`, 'SQL');
    },

    _renderCode(panelId, code, title, lang) {
      const panel = document.getElementById(panelId);
      if (!panel || !code) return;
      this._injectCodeView(panel, code, title, lang);
    },

    _injectCodeView(panel, code, title, lang) {
      const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const safeTitle = title.replace(/'/g, "\\'");
      panel.innerHTML = `
        <div class="rs-code-header">
          <div class="rs-code-header-left">
            <span class="rs-code-title">${title}</span>
            <span class="rs-code-lang-badge">${lang}</span>
          </div>
          <div class="rs-code-actions">
            <button class="rs-code-action-btn" onclick="RequirementsStudio.copyCode(this)">📋 Copy</button>
            <button class="rs-code-action-btn" onclick="RequirementsStudio.downloadCode(this,'${safeTitle.replace(/\s+/g,'_')}.sql')">⬇ Download</button>
          </div>
        </div>
        <textarea class="rs-code-editor" spellcheck="false">${escaped}</textarea>`;
      panel.querySelector('.rs-code-editor').dataset.raw = code;
    },

    _renderTestCases(cases) {
      const panel = document.getElementById('rs-panel-testcases');
      if (!panel) return;

      const typeLabel = { positive:'✅ Positive', negative:'❌ Negative', boundary:'⚠️ Boundary', security:'🔒 Security' };
      const badgeCls  = { positive:'positive',    negative:'negative',    boundary:'boundary',     security:'boundary' };

      let html = `<div class="rs-doc-panel">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
          <button class="rs-code-action-btn" style="background:#1e2d42;color:#a8c0d8;border-color:#3a5068;padding:6px 14px;"
            onclick="RequirementsStudio.downloadTestCases()">⬇ Download Test Cases CSV</button>
        </div>
        <div class="rs-doc-section">
          <div class="rs-doc-section-header">📋 Test Cases — ${cases.length} Scenarios</div>
          <div class="rs-doc-section-body">
            <table>
              <thead><tr><th>TC ID</th><th>Type</th><th>Req</th><th>Description</th><th>Pre-conditions</th><th>Test Steps</th><th>Expected Result</th><th>Status</th></tr></thead>
              <tbody>`;

      cases.forEach(tc => {
        const badge = `<span class="rs-tc-badge ${badgeCls[tc.type] || 'boundary'}">${typeLabel[tc.type] || tc.type}</span>`;
        html += `<tr>
          <td><strong>${tc.id}</strong></td>
          <td>${badge}</td>
          <td><small>${tc.requirement}</small></td>
          <td>${tc.description}</td>
          <td><small>${tc.preconditions}</small></td>
          <td><small>${tc.testSteps.join('<br>')}</small></td>
          <td><small>${tc.expectedResult}</small></td>
          <td><span class="rs-tc-badge boundary">${tc.status}</span></td>
        </tr>`;
      });

      html += `</tbody></table></div></div></div>`;
      panel.innerHTML = html;
    },

    _updateCounts() {
      const countMap = {
        sql:       (_state.generated.sql       || []).length,
        package:   _state.generated.package   ? 1 : 0,
        procedure: _state.generated.procedure ? _state.parsedRequirements.length : 0,
        trigger:   _state.generated.trigger   ? _state.parsedRequirements.length : 0,
        staging:   _state.generated.staging   ? _state.parsedRequirements.length : 0,
        testcases: (_state.generated.testcases || []).length,
        tdd:       _state.generated.tdd       ? 1 : 0,
      };
      /* Use data-artifact selector to find the count badge inside each tab button */
      Object.entries(countMap).forEach(([key, val]) => {
        const tab = document.querySelector(`.rs-art-tab[data-artifact="${key}"]`);
        if (!tab) return;
        let cnt = tab.querySelector('.rs-art-count');
        if (!cnt) return;
        if (val > 0) { cnt.textContent = val; cnt.classList.add('visible'); }
        else         { cnt.textContent = '';  cnt.classList.remove('visible'); }
      });
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════════════════ */
  function copyCode(btn) {
    const panel  = btn.closest('.rs-art-panel');
    const editor = panel && panel.querySelector('.rs-code-editor');
    if (!editor) return;
    const text = editor.dataset.raw || editor.value;
    navigator.clipboard.writeText(text)
      .then(() => { btn.textContent = '✅ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); })
      .catch(() => { editor.select(); document.execCommand('copy'); btn.textContent = '✅ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); });
  }

  function downloadCode(btn, filename) {
    const panel  = btn.closest('.rs-art-panel');
    const editor = panel && panel.querySelector('.rs-code-editor');
    if (!editor) return;
    const blob = new Blob([editor.dataset.raw || editor.value], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = filename || 'artifact.sql';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadTestCases() {
    const cases = _state.generated.testcases;
    if (!cases || !cases.length) return;
    const hdr  = 'TC ID,Type,Requirement,Description,Pre-conditions,Test Steps,Expected Result,Actual Result,Status\n';
    const rows = cases.map(tc =>
      `"${tc.id}","${tc.type}","${tc.requirement}","${tc.description}","${tc.preconditions}","${tc.testSteps.join(' | ')}","${tc.expectedResult}","","${tc.status}"`
    ).join('\n');
    const blob = new Blob([hdr + rows], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'TestCases_Requirements_Studio.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    const g     = _state.generated;
    const parts = [];
    if (g.sql)       parts.push({ name:'SQL_Queries.sql',         content: g.sql.map(s => s.sql).join('\n') });
    if (g.package)   parts.push({ name:'PLSQL_Package.sql',       content: g.package });
    if (g.procedure) parts.push({ name:'PLSQL_Procedures.sql',    content: g.procedure });
    if (g.trigger)   parts.push({ name:'DB_Triggers.sql',         content: g.trigger });
    if (g.staging)   parts.push({ name:'Staging_Tables_DDL.sql',  content: g.staging });
    if (g.tdd)       parts.push({ name:'Technical_Design_Doc.txt',content: g.tdd });
    if (!parts.length) return;

    const combined = parts.map(p =>
      `${'═'.repeat(68)}\n-- FILE: ${p.name}\n${'═'.repeat(68)}\n\n${p.content}`
    ).join('\n\n');
    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'EBS_Requirements_Studio_All.sql';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (g.testcases && g.testcases.length) downloadTestCases();
  }

  /* Init on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI.init());
  } else {
    setTimeout(() => UI.init(), 0);
  }

  return { copyCode, downloadCode, downloadAll, downloadTestCases };

})();

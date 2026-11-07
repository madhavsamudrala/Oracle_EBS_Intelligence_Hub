/**
 * ebs-req-analyzer.js
 * Oracle EBS Intelligence Hub v6.0 — Requirements Analyzer Engine
 *
 * Parses a plain-text or uploaded requirement document and generates:
 *   1. Oracle EBS–compliant SQL query
 *   2. PL/SQL Package (spec + body)
 *   3. Database Trigger (optional)
 *   4. Staging Table DDL + Sequence + Synonym
 *   5. Test Cases (positive / negative / boundary / security)
 *   6. Technical Design Document (HTML, printable to PDF)
 *   7. Functional Specification Document (HTML)
 *
 * All generation is local (no backend call) using pattern-matching
 * against the Oracle EBS knowledge base embedded in this file.
 */

'use strict';

/* ── State ──────────────────────────────────────────────────────────────── */
const RQA = {
  rawText:    '',
  fileName:   '',
  parsed:     null,   /* result of rqaParseRequirement() */
  artefacts:  {},     /* { sql, pkg, trigger, staging, testcases, techdoc, funcdoc } */
  activePane: null,
};

/* ═══════════════════════════════════════════════════════════════════════════
   FILE HANDLING
   ═══════════════════════════════════════════════════════════════════════════ */

function rqaDragOver(e)  { e.preventDefault(); document.getElementById('rqaDropZone').classList.add('rqa-drag-active'); }
function rqaDragLeave(e) { document.getElementById('rqaDropZone').classList.remove('rqa-drag-active'); }
function rqaDrop(e) {
  e.preventDefault();
  document.getElementById('rqaDropZone').classList.remove('rqa-drag-active');
  const file = e.dataTransfer.files[0];
  if (file) _rqaLoadFile(file);
}

function rqaFileSelected(input) {
  const file = input.files[0];
  if (file) _rqaLoadFile(file);
  input.value = '';
}

function _rqaLoadFile(file) {
  const name = file.name.toLowerCase();
  RQA.fileName = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    let text = '';
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = e.target.result;
    } else if (name.endsWith('.docx')) {
      /* DOCX: SheetJS can read raw text from docx — use basic XML strip fallback */
      try {
        const arr  = new Uint8Array(e.target.result);
        const wb   = XLSX.read(arr, { type: 'array' });
        /* Extract text from first sheet if any */
        const ws   = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      } catch {
        /* Fallback: try to decode as text */
        text = new TextDecoder().decode(new Uint8Array(e.target.result));
      }
    } else if (name.endsWith('.pdf')) {
      /* PDF: minimal text extraction — read raw bytes and extract visible ASCII */
      const bytes = new Uint8Array(e.target.result);
      let raw = '';
      for (let i = 0; i < bytes.length; i++) {
        const c = bytes[i];
        if ((c >= 32 && c <= 126) || c === 10 || c === 13) raw += String.fromCharCode(c);
      }
      /* Extract text between BT/ET markers or just filter printable runs */
      text = raw.replace(/[^\x20-\x7E\n\r]/g, ' ')
                .replace(/ {3,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n');
    } else {
      if (typeof showToast === 'function') showToast('Unsupported file type.', 'warning');
      return;
    }

    RQA.rawText = text.trim();
    document.getElementById('rqaManualText').value = RQA.rawText;
    document.getElementById('rqaFileBadgeName').textContent = file.name;
    document.getElementById('rqaFileBadge').style.display = '';
    if (typeof showToast === 'function') showToast(`📄 Loaded: ${file.name}`, 'success');
  };

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

function rqaClearFile() {
  RQA.rawText = '';
  RQA.fileName = '';
  document.getElementById('rqaManualText').value = '';
  document.getElementById('rqaFileBadge').style.display = 'none';
  document.getElementById('rqaFileBadgeName').textContent = '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN ORCHESTRATOR
   ═══════════════════════════════════════════════════════════════════════════ */

function rqaAnalyse() {
  const text = (document.getElementById('rqaManualText').value || RQA.rawText || '').trim();
  if (!text) {
    if (typeof showToast === 'function') showToast('Please upload a document or paste a requirement first.', 'warning');
    return;
  }
  RQA.rawText = text;

  /* Show spinner, hide welcome + results */
  document.getElementById('rqaWelcome').style.display  = 'none';
  document.getElementById('rqaResults').style.display  = 'none';
  document.getElementById('rqaSpinner').style.display  = '';

  /* Async so spinner renders */
  setTimeout(() => {
    try {
      RQA.parsed    = rqaParseRequirement(text);
      RQA.artefacts = rqaGenerateAll(RQA.parsed);
      _rqaRenderResults(RQA.parsed, RQA.artefacts);
    } catch(err) {
      if (typeof showToast === 'function') showToast('Error during analysis: ' + err.message, 'error');
      document.getElementById('rqaWelcome').style.display = '';
    } finally {
      document.getElementById('rqaSpinner').style.display = 'none';
    }
  }, 40);
}

/* ═══════════════════════════════════════════════════════════════════════════
   REQUIREMENT PARSER — extracts structured intent from free text
   ═══════════════════════════════════════════════════════════════════════════ */

function rqaParseRequirement(text) {
  const lower  = text.toLowerCase();
  const module = _rqaDetectModule(lower);
  const rice   = _rqaDetectRice(lower);
  const tables = _rqaDetectTables(module, lower);
  const params = _rqaDetectParams(lower);
  const name   = _rqaDeriveName(text, module, rice);
  const needsStaging = /staging|stg|interface|load|insert|migration|conversion/i.test(lower);
  const needsTrigger = /trigger|before insert|after insert|before update|after update/i.test(lower);

  return { text, lower, module, rice, tables, params, name, needsStaging, needsTrigger };
}

function _rqaDetectModule(t) {
  const sel = document.getElementById('rqaModule');
  if (sel && sel.value !== 'auto') return sel.value;
  if (/payable|invoice|supplier|vendor|ap_/.test(t))   return 'AP';
  if (/receivable|customer|ar_/.test(t))                return 'AR';
  if (/journal|ledger|gl_|trial balance/.test(t))       return 'GL';
  if (/purchase|po_|procurement/.test(t))               return 'PO';
  if (/employee|hrms|per_|assignment|payroll/.test(t))  return 'HRMS';
  if (/iexpense|expense report|credit card/.test(t))    return 'iExpense';
  if (/inventory|item|mtl_/.test(t))                    return 'INV';
  return 'AP';
}

function _rqaDetectRice(t) {
  const sel = document.getElementById('rqaRiceType');
  if (sel && sel.value !== 'auto') return sel.value;
  if (/interface|load|inbound|outbound/.test(t)) return 'I';
  if (/conversion|migration|historical|one.time/.test(t)) return 'C';
  if (/extension|custom form|oaf|workflow|trigger/.test(t)) return 'E';
  return 'R';  /* default Report */
}

const MODULE_TABLES_RQA = {
  AP:       ['AP_INVOICES_ALL ai', 'AP_SUPPLIERS aps', 'AP_PAYMENT_SCHEDULES_ALL apsa', 'AP_CHECKS_ALL ac'],
  AR:       ['AR_PAYMENT_SCHEDULES_ALL arps', 'AR_CUSTOMERS_ALL arc'],
  GL:       ['GL_JE_HEADERS gjh', 'GL_JE_LINES gjl', 'GL_CODE_COMBINATIONS gcc'],
  PO:       ['PO_HEADERS_ALL ph', 'PO_LINES_ALL pl', 'PO_DISTRIBUTIONS_ALL pd'],
  HRMS:     ['PER_ALL_PEOPLE_F papf', 'PER_ALL_ASSIGNMENTS_F paaf', 'HR_ALL_ORGANIZATION_UNITS haou'],
  iExpense: ['AP_EXPENSE_REPORT_HEADERS_ALL aerh', 'AP_EXPENSE_REPORT_LINES_ALL aerl', 'PER_ALL_PEOPLE_F papf'],
  INV:      ['MTL_SYSTEM_ITEMS_B msib', 'MTL_ONHAND_QUANTITIES_DETAIL moqd'],
  FND:      ['FND_CONCURRENT_REQUESTS fcr', 'FND_CONCURRENT_PROGRAMS_VL fcpv', 'FND_LOOKUP_VALUES_VL flv'],
};

function _rqaDetectTables(module, t) {
  return MODULE_TABLES_RQA[module] || MODULE_TABLES_RQA.AP;
}

function _rqaDetectParams(t) {
  const params = [
    { name: 'p_org_id',      type: 'NUMBER',  desc: 'Operating Unit (ORG_ID)',     required: true  },
    { name: 'p_start_date',  type: 'DATE',    desc: 'Start Date for date range',   required: false },
    { name: 'p_end_date',    type: 'DATE',    desc: 'End Date for date range',     required: false },
  ];
  if (/supplier|vendor/.test(t))  params.push({ name:'p_vendor_id',   type:'NUMBER', desc:'Supplier / Vendor ID', required:false });
  if (/status/.test(t))           params.push({ name:'p_status',       type:'VARCHAR2', desc:'Status filter',        required:false });
  if (/currency/.test(t))         params.push({ name:'p_currency_code',type:'VARCHAR2', desc:'Currency Code',        required:false });
  if (/employee|person/.test(t))  params.push({ name:'p_person_id',    type:'NUMBER', desc:'Employee Person ID',    required:false });
  if (/ledger|set.of.books/.test(t)) params.push({ name:'p_ledger_id', type:'NUMBER', desc:'Ledger ID',             required:false });
  return params;
}

function _rqaDeriveName(text, module, rice) {
  /* Try to extract a program/object name from the text */
  const m = text.match(/(?:program|report|package|procedure|interface|conversion)[\s:]*([A-Z_a-z0-9]{4,40})/i);
  if (m) return `XX${module}_${m[1].toUpperCase().replace(/\s+/g,'_')}`;
  return `XX${module}_CUSTOM_${rice}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ARTEFACT GENERATORS
   ═══════════════════════════════════════════════════════════════════════════ */

function rqaGenerateAll(p) {
  const out = {};
  if (document.getElementById('rqaGenSQL')?.checked)       out.sql       = _rqaGenSQL(p);
  if (document.getElementById('rqaGenPkg')?.checked)       out.pkg       = _rqaGenPackage(p);
  if (document.getElementById('rqaGenTrigger')?.checked)   out.trigger   = _rqaGenTrigger(p);
  if (document.getElementById('rqaGenStaging')?.checked)   out.staging   = _rqaGenStagingDDL(p);
  if (document.getElementById('rqaGenTestCases')?.checked) out.testcases = _rqaGenTestCases(p);
  if (document.getElementById('rqaGenTechDoc')?.checked)   out.techdoc   = _rqaGenTechDoc(p);
  if (document.getElementById('rqaGenFuncDoc')?.checked)   out.funcdoc   = _rqaGenFuncDoc(p);
  return out;
}

/* ── 1. SQL Query ─────────────────────────────────────────────────────── */
function _rqaGenSQL(p) {
  const tbl    = p.tables[0] || 'AP_INVOICES_ALL ai';
  const alias  = tbl.split(' ').pop();
  const module = p.module;
  const joins  = p.tables.slice(1).map(t => {
    const a = t.split(' ').pop();
    return _rqaGetJoin(module, t, alias);
  }).join('\n');

  const where  = _rqaBuildWhere(module, alias, p);
  const cols   = _rqaBuildSelectCols(module, alias);

  return `-- ============================================================
-- Oracle EBS Custom SQL Query
-- Requirement: ${p.text.substring(0, 80).replace(/\n/g,' ')}...
-- Module     : ${module}
-- RICE Type  : ${p.rice}
-- Generated  : ${new Date().toLocaleDateString()}
-- ============================================================

SELECT ${cols}
FROM   ${tbl}
${joins}
WHERE  1 = 1
${where}
ORDER  BY ${alias}.${_rqaGetOrderCol(module)}
/`;
}

function _rqaBuildSelectCols(mod, a) {
  const cols = {
    AP:       [`${a}.invoice_id`, `${a}.invoice_num`, `${a}.vendor_id`, `${a}.invoice_amount`, `${a}.invoice_date`, `${a}.payment_status_flag`, `${a}.org_id`],
    AR:       [`${a}.payment_schedule_id`, `${a}.customer_id`, `${a}.amount_due_remaining`, `${a}.due_date`, `${a}.org_id`],
    GL:       [`${a}.je_header_id`, `${a}.je_batch_id`, `${a}.period_name`, `${a}.status`, `${a}.currency_code`, `${a}.ledger_id`],
    PO:       [`${a}.po_header_id`, `${a}.segment1 po_number`, `${a}.vendor_id`, `${a}.total_amount`, `${a}.authorization_status`, `${a}.org_id`],
    HRMS:     [`${a}.person_id`, `${a}.employee_number`, `${a}.full_name`, `${a}.effective_start_date`, `${a}.effective_end_date`],
    iExpense: [`${a}.report_header_id`, `${a}.week_end_date`, `${a}.total`, `${a}.workflow_approved_flag`, `${a}.org_id`],
    INV:      [`${a}.inventory_item_id`, `${a}.segment1 item_number`, `${a}.description`, `${a}.primary_uom_code`, `${a}.organization_id`],
    FND:      [`${a}.request_id`, `${a}.concurrent_program_id`, `${a}.status_code`, `${a}.phase_code`, `${a}.requested_start_date`],
  };
  return (cols[mod] || cols.AP).join(',\n       ');
}

function _rqaBuildWhere(mod, a, p) {
  const lines = [];
  lines.push(`AND    ${a}.org_id         = FND_PROFILE.VALUE('ORG_ID')  -- Multi-org: RULE_001`);
  if (mod === 'AP')       lines.push(`AND    ${a}.cancelled_date IS NULL                       -- Exclude cancelled`);
  if (mod === 'HRMS')     lines.push(`AND    ${a}.effective_start_date <= TRUNC(SYSDATE)        -- DateTrack: RULE_002\nAND    ${a}.effective_end_date   >= TRUNC(SYSDATE)`);
  if (mod === 'iExpense') lines.push(`AND    ${a}.source             = 'NonValidatedWebExpense'  -- iExpense filter: RULE_007`);
  if (p.params.find(x=>x.name==='p_start_date'))
    lines.push(`AND    (:p_start_date IS NULL OR ${a}.${_rqaGetDateCol(mod)} >= TRUNC(:p_start_date))`);
  if (p.params.find(x=>x.name==='p_end_date'))
    lines.push(`AND    (:p_end_date   IS NULL OR ${a}.${_rqaGetDateCol(mod)} <= TRUNC(:p_end_date))`);
  lines.push(`AND    (:p_status IS NULL OR ${a}.${_rqaGetStatusCol(mod)} = :p_status)`);
  return lines.map(l => `       ${l}`).join('\n');
}

function _rqaGetJoin(mod, tbl, baseAlias) {
  const a = tbl.split(' ').pop();
  const joinMap = {
    'aps':  `LEFT JOIN AP_SUPPLIERS ${a}           ON ${a}.vendor_id   = ${baseAlias}.vendor_id`,
    'apsa': `LEFT JOIN AP_PAYMENT_SCHEDULES_ALL ${a} ON ${a}.invoice_id = ${baseAlias}.invoice_id AND ${a}.org_id = ${baseAlias}.org_id`,
    'gjl':  `INNER JOIN GL_JE_LINES ${a}           ON ${a}.je_header_id = ${baseAlias}.je_header_id`,
    'gcc':  `LEFT JOIN GL_CODE_COMBINATIONS ${a}   ON ${a}.code_combination_id = gjl.code_combination_id`,
    'pl':   `INNER JOIN PO_LINES_ALL ${a}          ON ${a}.po_header_id = ${baseAlias}.po_header_id AND ${a}.org_id = ${baseAlias}.org_id`,
    'aerl': `INNER JOIN AP_EXPENSE_REPORT_LINES_ALL ${a} ON ${a}.report_header_id = ${baseAlias}.report_header_id`,
    'paaf': `INNER JOIN PER_ALL_ASSIGNMENTS_F ${a} ON ${a}.person_id = ${baseAlias}.person_id AND ${a}.primary_flag = 'Y' AND ${a}.effective_start_date <= TRUNC(SYSDATE) AND ${a}.effective_end_date >= TRUNC(SYSDATE)`,
    'moqd': `INNER JOIN MTL_ONHAND_QUANTITIES_DETAIL ${a} ON ${a}.inventory_item_id = ${baseAlias}.inventory_item_id AND ${a}.organization_id = ${baseAlias}.organization_id`,
  };
  return joinMap[a] || `/* JOIN ${tbl} — add join condition */`;
}

function _rqaGetDateCol(mod) {
  return { AP:'invoice_date', AR:'due_date', GL:'default_effective_date', PO:'creation_date',
           HRMS:'effective_start_date', iExpense:'week_end_date', INV:'last_update_date', FND:'requested_start_date' }[mod] || 'creation_date';
}
function _rqaGetStatusCol(mod) {
  return { AP:'payment_status_flag', AR:'status', GL:'status', PO:'authorization_status',
           HRMS:'employment_category', iExpense:'workflow_approved_flag', INV:'inventory_item_status_code', FND:'status_code' }[mod] || 'status';
}
function _rqaGetOrderCol(mod) {
  return { AP:'invoice_date DESC', AR:'due_date DESC', GL:'period_name', PO:'creation_date DESC',
           HRMS:'employee_number', iExpense:'week_end_date DESC', INV:'segment1', FND:'request_id DESC' }[mod] || 'creation_date DESC';
}

/* ── 2. PL/SQL Package ────────────────────────────────────────────────── */
function _rqaGenPackage(p) {
  const pkg  = `${p.name}_PKG`;
  const proc = `main_process`;
  const stg  = `${p.name}_STG`;
  const pList = p.params.map(x => `    p_${x.name.replace(/^p_/,'')} IN ${x.type}`).join(',\n');

  return `-- ============================================================
-- Package Specification: ${pkg}
-- Module   : ${p.module}
-- Requirement: ${p.text.substring(0,80).replace(/\n/g,' ')}...
-- Generated: ${new Date().toLocaleDateString()}
-- ============================================================

CREATE OR REPLACE PACKAGE ${pkg} AS

  /* Public constants */
  gc_package_name CONSTANT VARCHAR2(50) := '${pkg}';

  /* Main entry point — called by concurrent program */
  PROCEDURE ${proc}(
    errbuf  OUT VARCHAR2,
    retcode OUT NUMBER,
${pList}
  );

END ${pkg};
/

-- ============================================================
-- Package Body: ${pkg}
-- ============================================================

CREATE OR REPLACE PACKAGE BODY ${pkg} AS

  /* ── Private: log wrapper ──────────────────────────────────── */
  PROCEDURE log_msg(p_msg IN VARCHAR2) IS
  BEGIN
    FND_FILE.PUT_LINE(FND_FILE.LOG, p_msg);
    FND_FILE.PUT_LINE(FND_FILE.OUTPUT, p_msg);
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END log_msg;

  /* ── Private: validate parameters ──────────────────────────── */
  PROCEDURE validate_params(
${pList}
  ) IS
  BEGIN
    IF p_org_id IS NULL THEN
      RAISE_APPLICATION_ERROR(-20001, 'Operating Unit (ORG_ID) is required.');
    END IF;
    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
      IF p_start_date > p_end_date THEN
        RAISE_APPLICATION_ERROR(-20002, 'Start Date must be before End Date.');
      END IF;
    END IF;
  END validate_params;

  /* ── Private: set org context ──────────────────────────────── */
  PROCEDURE set_org_context(p_org_id IN NUMBER) IS
  BEGIN
    MO_GLOBAL.SET_POLICY_CONTEXT('S', p_org_id);
    FND_CLIENT_INFO.SET_ORG_CONTEXT(p_org_id);
  END set_org_context;

  /* ── Main procedure ─────────────────────────────────────────── */
  PROCEDURE ${proc}(
    errbuf  OUT VARCHAR2,
    retcode OUT NUMBER,
${pList}
  ) IS
    l_proc_name CONSTANT VARCHAR2(30) := '${proc}';
    l_rows_processed  NUMBER := 0;
    l_rows_inserted   NUMBER := 0;
    l_rows_error      NUMBER := 0;

    CURSOR c_main IS
      ${_rqaGenSQL(p).replace(/^/gm, '      ').trim()};

  BEGIN
    log_msg('=== ' || gc_package_name || '.' || l_proc_name || ' START ===');
    log_msg('Parameters: ORG_ID=' || p_org_id);

    -- Step 1: Validate parameters
    validate_params(${p.params.map(x=>x.name).join(', ')});

    -- Step 2: Set multi-org context
    set_org_context(p_org_id);

    -- Step 3: Truncate staging table (if applicable)
    EXECUTE IMMEDIATE 'TRUNCATE TABLE ${stg}';
    log_msg('Staging table truncated: ${stg}');

    -- Step 4: Process main cursor
    FOR r IN c_main LOOP
      BEGIN
        l_rows_processed := l_rows_processed + 1;

        INSERT INTO ${stg} (
          stg_id,
          source_id,
          record_data,
          status_code,
          created_by,
          creation_date,
          last_updated_by,
          last_update_date,
          request_id
        ) VALUES (
          ${stg}_S.NEXTVAL,
          r.${_rqaGetPkCol(p.module)},
          'PROCESSED',
          'NEW',
          FND_GLOBAL.USER_ID,
          SYSDATE,
          FND_GLOBAL.USER_ID,
          SYSDATE,
          FND_GLOBAL.CONC_REQUEST_ID
        );

        l_rows_inserted := l_rows_inserted + 1;

      EXCEPTION
        WHEN OTHERS THEN
          l_rows_error := l_rows_error + 1;
          log_msg('ERROR on row ' || l_rows_processed || ': ' || SQLERRM);
          UPDATE ${stg}
          SET    status_code   = 'ERROR',
                 error_message = SUBSTR(SQLERRM, 1, 2000)
          WHERE  source_id = r.${_rqaGetPkCol(p.module)};
      END;
    END LOOP;

    COMMIT;

    -- Step 5: Summary
    log_msg('=== SUMMARY ===');
    log_msg('Rows Processed : ' || l_rows_processed);
    log_msg('Rows Inserted  : ' || l_rows_inserted);
    log_msg('Rows Error     : ' || l_rows_error);
    log_msg('=== ' || gc_package_name || '.' || l_proc_name || ' END ===');

    retcode := CASE WHEN l_rows_error > 0 THEN 1 ELSE 0 END;
    errbuf  := 'Completed. Processed=' || l_rows_processed || ' Inserted=' || l_rows_inserted || ' Errors=' || l_rows_error;

  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      log_msg('FATAL ERROR: ' || SQLERRM);
      FND_FILE.PUT_LINE(FND_FILE.LOG, DBMS_UTILITY.FORMAT_ERROR_BACKTRACE);
      retcode := 2;
      errbuf  := 'FATAL: ' || SQLERRM;
      RAISE;
  END ${proc};

END ${pkg};
/`;
}

function _rqaGetPkCol(mod) {
  return { AP:'invoice_id', AR:'payment_schedule_id', GL:'je_header_id', PO:'po_header_id',
           HRMS:'person_id', iExpense:'report_header_id', INV:'inventory_item_id', FND:'request_id' }[mod] || 'id';
}

/* ── 3. Trigger ───────────────────────────────────────────────────────── */
function _rqaGenTrigger(p) {
  const tbl   = p.tables[0].split(' ')[0];
  const alias = p.name;
  return `-- ============================================================
-- Trigger: ${alias}_TRG
-- Table  : ${tbl}
-- Generated: ${new Date().toLocaleDateString()}
-- ============================================================

CREATE OR REPLACE TRIGGER ${alias}_TRG
  BEFORE INSERT OR UPDATE ON ${tbl}
  FOR EACH ROW
DECLARE
  l_user  NUMBER := FND_GLOBAL.USER_ID;
  l_login NUMBER := FND_GLOBAL.LOGIN_ID;
BEGIN

  -- Audit columns — populate on INSERT
  IF INSERTING THEN
    :NEW.created_by         := NVL(:NEW.created_by,    l_user);
    :NEW.creation_date      := NVL(:NEW.creation_date, SYSDATE);
    :NEW.last_updated_by    := l_user;
    :NEW.last_update_date   := SYSDATE;
    :NEW.last_update_login  := l_login;
  END IF;

  -- Audit columns — always update on UPDATE
  IF UPDATING THEN
    :NEW.last_updated_by    := l_user;
    :NEW.last_update_date   := SYSDATE;
    :NEW.last_update_login  := l_login;
  END IF;

  -- Business rule: validate ORG_ID
  IF :NEW.org_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20010, 'ORG_ID cannot be NULL on ${tbl}');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE_APPLICATION_ERROR(-20099, '${alias}_TRG error: ' || SQLERRM);
END ${alias}_TRG;
/`;
}

/* ── 4. Staging Table DDL ─────────────────────────────────────────────── */
function _rqaGenStagingDDL(p) {
  const stg = `${p.name}_STG`;
  const seq = `${p.name}_STG_S`;
  const mod = p.module;
  const srcCols = _rqaGetStagingSourceCols(mod);

  return `-- ============================================================
-- Staging Table DDL: ${stg}
-- Module   : ${mod}
-- Generated: ${new Date().toLocaleDateString()}
-- ============================================================

-- Drop if exists (comment out in production)
-- DROP TABLE ${stg} PURGE;
-- DROP SEQUENCE ${seq};

CREATE TABLE ${stg} (
  -- Control columns
  stg_id              NUMBER         NOT NULL,
  batch_id            NUMBER,
  request_id          NUMBER,
  status_code         VARCHAR2(30)   DEFAULT 'NEW'   NOT NULL,
  error_message       VARCHAR2(4000),
  process_flag        VARCHAR2(1)    DEFAULT 'N'     NOT NULL,
  retry_count         NUMBER         DEFAULT 0,

  -- Source data columns (${mod} module)
  source_id           NUMBER,
  org_id              NUMBER,
${srcCols}

  -- Audit columns (WHO columns — mandatory)
  created_by          NUMBER         DEFAULT -1      NOT NULL,
  creation_date       DATE           DEFAULT SYSDATE NOT NULL,
  last_updated_by     NUMBER         DEFAULT -1      NOT NULL,
  last_update_date    DATE           DEFAULT SYSDATE NOT NULL,
  last_update_login   NUMBER,

  CONSTRAINT ${stg}_PK PRIMARY KEY (stg_id)
)
TABLESPACE XXCUST_DATA
STORAGE (INITIAL 1M NEXT 1M PCTINCREASE 0)
/

-- Sequence for primary key
CREATE SEQUENCE ${seq}
  START WITH 1
  INCREMENT BY 1
  NOCACHE
  NOCYCLE
/

-- Index on status for processing queries
CREATE INDEX ${stg}_N1 ON ${stg}(status_code, process_flag) TABLESPACE XXCUST_INDX
/

-- Index on source_id for lookups
CREATE INDEX ${stg}_N2 ON ${stg}(source_id) TABLESPACE XXCUST_INDX
/

-- Public synonym
CREATE OR REPLACE PUBLIC SYNONYM ${stg} FOR ${stg}
/

-- Grant access to APPS schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ${stg} TO APPS
/`;
}

function _rqaGetStagingSourceCols(mod) {
  const cols = {
    AP: `  invoice_id          NUMBER,\n  invoice_num         VARCHAR2(50),\n  vendor_id           NUMBER,\n  vendor_name         VARCHAR2(240),\n  invoice_amount      NUMBER,\n  invoice_date        DATE,\n  payment_status_flag VARCHAR2(1),\n`,
    AR: `  payment_schedule_id NUMBER,\n  customer_id         NUMBER,\n  amount_due_remaining NUMBER,\n  due_date            DATE,\n  status              VARCHAR2(30),\n`,
    GL: `  je_header_id        NUMBER,\n  period_name         VARCHAR2(15),\n  currency_code       VARCHAR2(15),\n  ledger_id           NUMBER,\n  entered_dr          NUMBER,\n  entered_cr          NUMBER,\n`,
    PO: `  po_header_id        NUMBER,\n  po_number           VARCHAR2(20),\n  vendor_id           NUMBER,\n  total_amount        NUMBER,\n  authorization_status VARCHAR2(25),\n`,
    HRMS:`  person_id           NUMBER,\n  employee_number     VARCHAR2(30),\n  full_name           VARCHAR2(240),\n  job_id              NUMBER,\n  department_id       NUMBER,\n`,
    iExpense:`  report_header_id    NUMBER,\n  employee_id         NUMBER,\n  total              NUMBER,\n  week_end_date       DATE,\n  workflow_approved_flag VARCHAR2(1),\n`,
    INV: `  inventory_item_id   NUMBER,\n  organization_id     NUMBER,\n  item_number         VARCHAR2(40),\n  description         VARCHAR2(240),\n  quantity_on_hand    NUMBER,\n`,
    FND: `  conc_request_id     NUMBER,\n  program_name        VARCHAR2(240),\n  status_code         VARCHAR2(10),\n  phase_code          VARCHAR2(10),\n  actual_start_date   DATE,\n`,
  };
  return cols[mod] || cols.AP;
}

/* ── 5. Test Cases ────────────────────────────────────────────────────── */
function _rqaGenTestCases(p) {
  const name = p.name;
  const mod  = p.module;
  const today = new Date().toLocaleDateString();
  const cases = [
    /* Positive */
    { id:'TC-001', type:'Positive', scenario:'Valid request with all mandatory parameters', steps:'1. Set ORG_ID to valid operating unit\n2. Set date range to current period\n3. Submit concurrent request', expected:'Request completes with status Normal. Output file generated with correct records.', priority:'High' },
    { id:'TC-002', type:'Positive', scenario:'Valid request — large data volume', steps:'1. Set date range spanning 12 months\n2. Submit with valid ORG_ID', expected:'All records processed. Staging table populated. Log shows correct record count.', priority:'High' },
    { id:'TC-003', type:'Positive', scenario:`${mod}-specific: status filter applied`, steps:`1. Set status filter\n2. Submit request`, expected:'Only records matching status are returned. Count matches direct SQL count.', priority:'Medium' },
    /* Negative */
    { id:'TC-004', type:'Negative', scenario:'Submit without ORG_ID (mandatory parameter)', steps:'1. Leave ORG_ID blank\n2. Submit request', expected:'Request fails immediately with error: "Operating Unit is required". Retcode=2.', priority:'High' },
    { id:'TC-005', type:'Negative', scenario:'Start Date > End Date', steps:'1. Set start_date = today\n2. Set end_date = yesterday\n3. Submit request', expected:'Validation error: "Start Date must be before End Date". No records processed.', priority:'High' },
    { id:'TC-006', type:'Negative', scenario:'Invalid ORG_ID (non-existent)', steps:'1. Set ORG_ID = 9999999\n2. Submit request', expected:'Request completes with 0 records. Log shows org context error or empty result.', priority:'Medium' },
    /* Boundary */
    { id:'TC-007', type:'Boundary', scenario:'Date range spanning fiscal year boundary', steps:'1. Set start=01-Jan, end=31-Mar\n2. Submit request', expected:'Records from both fiscal years returned correctly. No duplicates.', priority:'Medium' },
    { id:'TC-008', type:'Boundary', scenario:'Single day date range', steps:'1. Set start_date = end_date = today\n2. Submit', expected:'Only records for that date returned.', priority:'Low' },
    { id:'TC-009', type:'Boundary', scenario:'Maximum data volume — 100K+ rows', steps:'1. Set date range for full year\n2. Monitor memory and timing', expected:'Completes within acceptable time. Bulk COLLECT used if applicable. No ORA-01555.', priority:'Medium' },
    /* Security */
    { id:'TC-010', type:'Security', scenario:'Cross-org data access attempt', steps:'1. Log in as User A (Org 101)\n2. Submit with ORG_ID of Org 102', expected:'No data returned for Org 102. MO_GLOBAL policy enforced.', priority:'High' },
    { id:'TC-011', type:'Security', scenario:'SQL injection via parameter', steps:'1. Enter malicious string in varchar parameter\n2. Submit', expected:'Parameter sanitised by bind variable. No ORA error. No data exposure.', priority:'High' },
    /* Integration */
    { id:'TC-012', type:'Integration', scenario:'Staging table populated and downstream process triggered', steps:'1. Run main program\n2. Verify staging table rows\n3. Run downstream program', expected:'Staging table contains correct rows with status=NEW. Downstream reads successfully.', priority:'High' },
  ];

  let csv  = `Test Case ID,Type,Scenario,Steps,Expected Result,Priority,Module,Program\n`;
  cases.forEach(c => {
    csv += `"${c.id}","${c.type}","${c.scenario}","${c.steps.replace(/\n/g,' | ')}","${c.expected}","${c.priority}","${mod}","${name}"\n`;
  });

  let html = `<div class="rqa-testcase-wrap">
<div class="rqa-tc-header">
  <strong>📋 Test Cases for ${name}</strong>
  <span class="rqa-tc-count">${cases.length} test cases | ${mod} Module</span>
</div>`;

  const types = ['Positive','Negative','Boundary','Security','Integration'];
  types.forEach(type => {
    const group = cases.filter(c=>c.type===type);
    if (!group.length) return;
    html += `<div class="rqa-tc-group"><div class="rqa-tc-group-title">${_rqaTcIcon(type)} ${type} Tests</div>`;
    group.forEach(c => {
      html += `<div class="rqa-tc-row rqa-tc-${type.toLowerCase()}">
  <div class="rqa-tc-id">${c.id}</div>
  <div class="rqa-tc-body">
    <div class="rqa-tc-scenario">${c.scenario}</div>
    <div class="rqa-tc-steps"><strong>Steps:</strong><br>${c.steps.replace(/\n/g,'<br>')}</div>
    <div class="rqa-tc-expected"><strong>Expected:</strong> ${c.expected}</div>
  </div>
  <div class="rqa-tc-priority rqa-pri-${c.priority.toLowerCase()}">${c.priority}</div>
</div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  return { html, csv };
}

function _rqaTcIcon(type) {
  return { Positive:'✅', Negative:'❌', Boundary:'⚠️', Security:'🔒', Integration:'🔗' }[type] || '📋';
}

/* ── 6. Technical Design Document ─────────────────────────────────────── */
function _rqaGenTechDoc(p) {
  const today = new Date().toLocaleDateString('en-GB');
  const name  = p.name;
  const mod   = p.module;
  const tblRows = p.tables.map((t,i) => `<tr><td>${t.split(' ')[0]}</td><td>${t.split(' ')[1]||''}</td><td>${i===0?'Primary':'Joined'}</td><td>SELECT</td></tr>`).join('');
  const paramRows = p.params.map(x => `<tr><td>${x.name}</td><td>${x.type}</td><td>${x.required?'Mandatory':'Optional'}</td><td>${x.desc}</td></tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Calibri',Arial,sans-serif;font-size:11pt;color:#1a1a2e;margin:30px 40px}
  h1{font-size:18pt;color:#003366;border-bottom:3px solid #0572CE;padding-bottom:6px}
  h2{font-size:13pt;color:#003366;border-left:4px solid #0572CE;padding-left:10px;margin-top:24px}
  h3{font-size:11pt;color:#003366}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt}
  th{background:#003366;color:#fff;padding:7px 10px;text-align:left;font-weight:600}
  td{padding:6px 10px;border:1px solid #C8DFF5}
  tr:nth-child(even) td{background:#F0F7FF}
  .cover{text-align:center;padding:40px 0 30px;border-bottom:2px solid #003366;margin-bottom:30px}
  .cover h1{border:none;font-size:22pt}
  .cover .meta{font-size:10pt;color:#666;margin-top:8px}
  .badge{display:inline-block;background:#E7F3FF;color:#0043CE;padding:2px 8px;border-radius:10px;font-size:9pt;font-weight:700;margin:2px}
  pre{background:#F8FBFF;border:1px solid #C8DFF5;border-radius:4px;padding:12px;font-size:9pt;white-space:pre-wrap;font-family:'Courier New',monospace}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
  .info-cell{padding:8px;background:#F8FBFF;border:1px solid #D6E6F5;border-radius:4px}
  .info-cell label{font-size:9pt;color:#5A7A94;display:block;margin-bottom:2px}
  .info-cell span{font-weight:700;color:#00274D}
  @media print{body{margin:15px 20px} .no-print{display:none}}
</style>
</head><body>

<div class="cover">
  <div style="color:#0572CE;font-size:12pt;font-weight:700;margin-bottom:8px">IBM ICA | Oracle EBS Intelligence Hub</div>
  <h1>Technical Design Document</h1>
  <div style="font-size:14pt;color:#003366;margin:8px 0">${name}</div>
  <div class="meta">
    <span class="badge">Module: ${mod}</span>
    <span class="badge">RICE: ${p.rice}</span>
    <span class="badge">Version: 1.0</span>
    <span class="badge">Date: ${today}</span>
  </div>
</div>

<h2>1. Document Control</h2>
<div class="info-grid">
  <div class="info-cell"><label>Program Name</label><span>${name}</span></div>
  <div class="info-cell"><label>Module</label><span>${mod}</span></div>
  <div class="info-cell"><label>RICE Type</label><span>${p.rice === 'R'?'Report':p.rice==='I'?'Interface':p.rice==='C'?'Conversion':'Extension'}</span></div>
  <div class="info-cell"><label>Package</label><span>${name}_PKG</span></div>
  <div class="info-cell"><label>Status</label><span>Draft</span></div>
  <div class="info-cell"><label>Generated</label><span>${today}</span></div>
</div>

<h2>2. Business Requirement</h2>
<p>${p.text.replace(/\n/g,'<br>')}</p>

<h2>3. Technical Approach</h2>
<p>This program follows Oracle EBS RICE (<strong>${p.rice === 'R'?'Report':p.rice==='I'?'Interface':p.rice==='C'?'Conversion':'Extension'}</strong>) pattern for the <strong>${mod}</strong> module. It is implemented as a PL/SQL concurrent program registered in Oracle Application Object Library (AOL).</p>

<h3>3.1 Key Technical Decisions</h3>
<ul>
  <li><strong>Multi-Org:</strong> MO_GLOBAL.SET_POLICY_CONTEXT used for ORG_ID enforcement (RULE_001)</li>
  <li><strong>Bind Variables:</strong> All parameters passed as bind variables to prevent SQL injection (COMP-007)</li>
  <li><strong>DateTrack:</strong> ${mod==='HRMS'?'EFFECTIVE_START_DATE / EFFECTIVE_END_DATE filters applied on PER_ tables (RULE_002)':'Not applicable for this module'}</li>
  <li><strong>Error Handling:</strong> Row-level exception handling with ROLLBACK on fatal errors</li>
  <li><strong>Logging:</strong> FND_FILE.PUT_LINE used for LOG and OUTPUT streams</li>
  <li><strong>Staging:</strong> ${p.needsStaging?`${name}_STG table used for intermediate data storage`:'Direct processing — no staging table required'}</li>
</ul>

<h2>4. Parameters</h2>
<table><thead><tr><th>Parameter Name</th><th>Data Type</th><th>Required</th><th>Description</th></tr></thead>
<tbody>${paramRows}</tbody></table>

<h2>5. Tables &amp; Views</h2>
<table><thead><tr><th>Table / View</th><th>Alias</th><th>Role</th><th>Access</th></tr></thead>
<tbody>${tblRows}
${p.needsStaging?`<tr><td>${name}_STG</td><td>stg</td><td>Staging (Custom)</td><td>INSERT / UPDATE</td></tr>`:''}
</tbody></table>

<h2>6. SQL Query</h2>
<pre>${_rqaEscHtml(_rqaGenSQL(p))}</pre>

<h2>7. Processing Logic</h2>
<ol>
  <li>Validate mandatory parameters (ORG_ID, date range)</li>
  <li>Set multi-org context via MO_GLOBAL</li>
  <li>${p.needsStaging?`Truncate staging table ${name}_STG`:'Initialise processing counters'}</li>
  <li>Open main cursor and iterate rows</li>
  <li>Apply business rules and transformations per row</li>
  <li>${p.needsStaging?`Insert each row into ${name}_STG with status = NEW`:'Write output to FND_FILE'}</li>
  <li>Commit on success; rollback and log on fatal error</li>
  <li>Write processing summary to LOG and OUTPUT</li>
</ol>

<h2>8. Error Handling</h2>
<table><thead><tr><th>Error Code</th><th>Condition</th><th>Action</th></tr></thead>
<tbody>
  <tr><td>ORA-20001</td><td>ORG_ID is NULL</td><td>Raise application error, retcode=2</td></tr>
  <tr><td>ORA-20002</td><td>Start Date > End Date</td><td>Raise application error, retcode=2</td></tr>
  <tr><td>OTHERS (row)</td><td>Any row-level error</td><td>Log error, update staging status=ERROR, continue</td></tr>
  <tr><td>OTHERS (fatal)</td><td>Unrecoverable error</td><td>ROLLBACK, log backtrace, retcode=2, RAISE</td></tr>
</tbody></table>

<h2>9. Concurrent Program Registration</h2>
<table><thead><tr><th>Field</th><th>Value</th></tr></thead>
<tbody>
  <tr><td>Executable Name</td><td>${name}</td></tr>
  <tr><td>Execution Method</td><td>PL/SQL Stored Procedure</td></tr>
  <tr><td>Execution File Name</td><td>${name}_PKG.MAIN_PROCESS</td></tr>
  <tr><td>Application</td><td>XXCUST (Custom Application)</td></tr>
  <tr><td>Request Group</td><td>XXCUST_REQUEST_GROUP</td></tr>
</tbody></table>

<h2>10. Revision History</h2>
<table><thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Change</th></tr></thead>
<tbody><tr><td>1.0</td><td>${today}</td><td>Generated by Oracle EBS Intelligence Hub</td><td>Initial Draft</td></tr></tbody>
</table>

<div style="margin-top:30px;padding-top:10px;border-top:1px solid #C8DFF5;font-size:9pt;color:#888;text-align:center">
  IBM ICA | Oracle EBS Intelligence Hub v6.0 | Generated ${today} | IBM Bob + ICA Context Studio
</div>
</body></html>`;
}

/* ── 7. Functional Document ────────────────────────────────────────────── */
function _rqaGenFuncDoc(p) {
  const today = new Date().toLocaleDateString('en-GB');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Calibri',Arial,sans-serif;font-size:11pt;color:#1a1a2e;margin:30px 40px}
  h1{font-size:18pt;color:#003366;border-bottom:3px solid #0572CE;padding-bottom:6px}
  h2{font-size:13pt;color:#003366;border-left:4px solid #0572CE;padding-left:10px;margin-top:24px}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt}
  th{background:#003366;color:#fff;padding:7px 10px;text-align:left}
  td{padding:6px 10px;border:1px solid #C8DFF5}
  tr:nth-child(even) td{background:#F0F7FF}
  .cover{text-align:center;padding:40px 0 30px;border-bottom:2px solid #003366;margin-bottom:30px}
  .badge{display:inline-block;background:#E7F3FF;color:#0043CE;padding:2px 8px;border-radius:10px;font-size:9pt;font-weight:700;margin:2px}
</style></head><body>
<div class="cover">
  <div style="color:#0572CE;font-size:12pt;font-weight:700;margin-bottom:8px">IBM ICA | Oracle EBS Intelligence Hub</div>
  <h1>Functional Specification Document</h1>
  <div style="font-size:14pt;color:#003366;margin:8px 0">${p.name}</div>
  <div><span class="badge">Module: ${p.module}</span><span class="badge">Date: ${today}</span></div>
</div>
<h2>1. Business Overview</h2>
<p>${p.text.replace(/\n/g,'<br>')}</p>
<h2>2. Scope</h2>
<p>This functional specification covers the requirements, business rules, and acceptance criteria for the <strong>${p.name}</strong> program in Oracle E-Business Suite ${p.module} module.</p>
<h2>3. Business Rules</h2>
<ul>
  <li>All data must be filtered by Operating Unit (ORG_ID) — no cross-org data access.</li>
  <li>Date range filters are optional but mutually exclusive (both or neither).</li>
  <li>${p.module==='HRMS'?'Employee records must use DateTrack effective date logic.':'Cancelled / voided records must be excluded from results.'}</li>
  <li>Output must include audit trail (created_by, creation_date, last_updated_by).</li>
</ul>
<h2>4. Functional Flow</h2>
<ol>
  <li>User submits concurrent request with operating unit and optional filters.</li>
  <li>System validates mandatory parameters and raises error if invalid.</li>
  <li>System sets multi-org context and queries ${p.module} tables.</li>
  <li>Business rules and filters applied to result set.</li>
  <li>Output generated (report / staging table / file) with record count summary.</li>
  <li>Request completes: Normal (0), Warning (1), Error (2).</li>
</ol>
<h2>5. Acceptance Criteria</h2>
<ul>
  <li>All records returned match the filter criteria exactly.</li>
  <li>Record counts match direct SQL count against source tables.</li>
  <li>No cross-org data leakage (ORG_ID strictly enforced).</li>
  <li>Concurrent request completes within agreed SLA (< 30 mins for typical volume).</li>
  <li>Error rows logged with descriptive message; process continues for other rows.</li>
</ul>
<h2>6. Revision History</h2>
<table><thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Change</th></tr></thead>
<tbody><tr><td>1.0</td><td>${today}</td><td>Generated by Oracle EBS Intelligence Hub</td><td>Initial Draft</td></tr></tbody></table>
<div style="margin-top:30px;padding-top:10px;border-top:1px solid #C8DFF5;font-size:9pt;color:#888;text-align:center">
  IBM ICA | Oracle EBS Intelligence Hub v6.0 | Generated ${today}
</div></body></html>`;
}

function _rqaEscHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESULTS RENDERER
   ═══════════════════════════════════════════════════════════════════════════ */

const RQA_ARTEFACT_META = {
  sql:       { label:'🔍 SQL Query',         icon:'🔍', ext:'sql',  mime:'text/plain' },
  pkg:       { label:'📦 PL/SQL Package',    icon:'📦', ext:'sql',  mime:'text/plain' },
  trigger:   { label:'⚡ Trigger',           icon:'⚡', ext:'sql',  mime:'text/plain' },
  staging:   { label:'🗄️ Staging Table DDL', icon:'🗄️', ext:'sql',  mime:'text/plain' },
  testcases: { label:'✅ Test Cases',        icon:'✅', ext:'csv',  mime:'text/csv'   },
  techdoc:   { label:'📄 Technical Doc',     icon:'📄', ext:'html', mime:'text/html'  },
  funcdoc:   { label:'📋 Functional Doc',    icon:'📋', ext:'html', mime:'text/html'  },
};

function _rqaRenderResults(parsed, artefacts) {
  document.getElementById('rqaWelcome').style.display = 'none';

  /* Summary bar */
  document.getElementById('rqaSummaryBar').innerHTML = `
    <div class="rqa-sum-chip">📦 <strong>${parsed.module}</strong> Module</div>
    <div class="rqa-sum-chip">🏗️ RICE: <strong>${parsed.rice}</strong></div>
    <div class="rqa-sum-chip">🗄️ Tables: <strong>${parsed.tables.length}</strong></div>
    <div class="rqa-sum-chip">⚙️ Params: <strong>${parsed.params.length}</strong></div>
    <div class="rqa-sum-chip">📋 Artefacts: <strong>${Object.keys(artefacts).length}</strong></div>`;

  /* Output tab bar */
  const keys = Object.keys(artefacts);
  document.getElementById('rqaOutTabs').innerHTML = keys.map((k,i) =>
    `<button class="rqa-out-tab ${i===0?'active':''}" onclick="rqaSwitchPane('${k}',this)">
       ${RQA_ARTEFACT_META[k]?.label || k}
     </button>`
  ).join('');

  /* Output panels */
  const panels = document.getElementById('rqaOutputPanels');
  panels.innerHTML = keys.map((k,i) => {
    const meta = RQA_ARTEFACT_META[k] || { icon:'📄', ext:'txt', mime:'text/plain' };
    const art  = artefacts[k];
    const isHtml = meta.ext === 'html';
    const isTC   = k === 'testcases';
    let content  = '';

    if (isHtml) {
      content = `<div class="rqa-panel-toolbar">
        <button class="rqa-tool-btn" onclick="rqaDownload('${k}')">⬇ Download HTML</button>
        <button class="rqa-tool-btn" onclick="rqaPrintDoc('${k}')">🖨 Print / Save PDF</button>
      </div>
      <iframe class="rqa-doc-preview" id="rqaFrame_${k}" srcdoc="${_rqaAttr(art)}"></iframe>`;
    } else if (isTC) {
      content = `<div class="rqa-panel-toolbar">
        <button class="rqa-tool-btn" onclick="rqaCopyCode('${k}')">📋 Copy</button>
        <button class="rqa-tool-btn" onclick="rqaDownload('${k}')">⬇ Download CSV</button>
      </div>
      ${art.html}`;
    } else {
      content = `<div class="rqa-panel-toolbar">
        <button class="rqa-tool-btn" onclick="rqaCopyCode('${k}')">📋 Copy to Clipboard</button>
        <button class="rqa-tool-btn" onclick="rqaDownload('${k}')">⬇ Download .${meta.ext}</button>
        <button class="rqa-tool-btn" onclick="rqaSendToAdvisor('${k}')">🔍 Send to SQL Advisor</button>
      </div>
      <pre class="rqa-code-pre" id="rqaCode_${k}">${_rqaEscHtml(String(art))}</pre>`;
    }

    return `<div class="rqa-panel ${i===0?'active':''}" id="rqaPane_${k}">${content}</div>`;
  }).join('');

  document.getElementById('rqaResults').style.display = '';
  RQA.activePane = keys[0];
}

function _rqaAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function rqaSwitchPane(key, btn) {
  document.querySelectorAll('.rqa-out-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.rqa-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('rqaPane_' + key);
  if (panel) panel.classList.add('active');
  RQA.activePane = key;
}

function rqaCopyCode(key) {
  const el = document.getElementById('rqaCode_' + key);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    if (typeof showToast === 'function') showToast('Copied to clipboard ✓', 'success');
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Copy failed — select & copy manually.', 'warning');
  });
}

function rqaDownload(key) {
  const art  = RQA.artefacts[key];
  const meta = RQA_ARTEFACT_META[key] || { ext:'txt', mime:'text/plain' };
  const name = (RQA.parsed?.name || 'output') + '_' + key + '.' + meta.ext;

  let content = '';
  if (key === 'testcases') content = art.csv;
  else if (meta.ext === 'html') content = art;
  else content = String(art);

  const blob = new Blob([content], { type: meta.mime + ';charset=utf-8' });
  if (typeof saveAs === 'function') {
    saveAs(blob, name);
  } else {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
  if (typeof showToast === 'function') showToast(`⬇ Downloaded: ${name}`, 'success');
}

function rqaPrintDoc(key) {
  const art = RQA.artefacts[key];
  if (!art) return;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(String(art));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }
}

function rqaSendToAdvisor(key) {
  const art = RQA.artefacts[key];
  if (!art || typeof switchTab !== 'function') return;
  /* Send first SQL query to SQL Advisor workspace */
  const sqlInput = document.getElementById('sqlAdvisorWorkspace') || document.getElementById('sqlPerfInput');
  if (sqlInput) {
    sqlInput.value = String(art);
    switchTab('tab-sql', document.querySelector('[data-tab="tab-sql"]'));
    if (typeof showToast === 'function') showToast('SQL loaded into SQL Advisor ✓', 'success');
  }
}

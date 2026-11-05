/* ═══════════════════════════════════════════════════════════════════
   Oracle EBS Intelligence Hub — Main Application JavaScript
   Version: 6.0  |  Oracle EBS R12 Enterprise Portal
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   ROLE SYSTEM — Login + Employee vs Technical User
   ═══════════════════════════════════════════════════════════════════════ */

/* Tabs only available to Technical users */
const TECHNICAL_TABS = ['tab-sql', 'tab-docgen', 'tab-sqllab', 'tab-academy', 'tab-reqstudio'];

/* Registry of imported/pushed reports: { key → { title, source, pushedAt } } */
const IMPORTED_REPORTS = {};

/* ─────────────────────────────────────────────────────────────────────────
   DELETE REQUESTS REGISTRY
   Stores Employee-initiated delete requests that need Technical approval.
   { id → { id, reportKey, reportTitle, reason, notes, requestedBy,
             requestedAt, status: 'pending'|'approved'|'declined',
             resolvedAt, resolvedNote } }
   ───────────────────────────────────────────────────────────────────────── */
const DELETE_REQUESTS = {};

/* ─────────────────────────────────────────────────────────────────────────
   RECYCLE BIN
   Stores report data snapshots after deletion so Technical can restore them.
   { reportKey → { reportKey, title, module, sql, columns, rows,
                   source, deletedAt, _wasImported, _originalKey } }
   ───────────────────────────────────────────────────────────────────────── */
const RECYCLE_BIN = {};

/* ─────────────────────────────────────────────────────────────────────────
   DELETED REPORTS REGISTRY
   Tracks which report keys are currently in the deleted/recycle-bin state.
   This blocks loadReport() from reloading a deleted built-in report when
   the user clicks its hardcoded sidebar item.
   Set<string>  (plain object used as a set for ES5 compat)
   ───────────────────────────────────────────────────────────────────────── */
const DELETED_REPORTS = {};

/* Credentials are NOT stored in this file. They are loaded from ebs-credentials.js
   (git-ignored, local only). Copy ebs-credentials.example.js to ebs-credentials.js and set values. */
const RL_CREDENTIALS = window.EBS_CREDENTIALS || {};

/* ── Module-level state ─────────────────────────────────────────────────── */
const APP_ROLE = {
  current:      null,
  selectedRole: null,   /* chosen on Step 1, not yet authenticated */
};

/* ── STEP 1: User picks a role option ───────────────────────────────────── */
function rlSelectOpt(role) {
  APP_ROLE.selectedRole = role;

  /* Visual feedback */
  document.getElementById('rlOptEmployee').classList.toggle('selected',  role === 'employee');
  document.getElementById('rlOptTechnical').classList.toggle('selected', role === 'technical');

  /* Enable Continue button */
  document.getElementById('rlNextBtn').disabled = false;
}

/* ── STEP 1 → STEP 2: Show password form ────────────────────────────────── */
function rlGoToLogin() {
  const role = APP_ROLE.selectedRole;
  if (!role) return;

  /* Populate role badge */
  document.getElementById('rlLoginRoleIcon').textContent  = role === 'employee' ? '👤' : '⚙️';
  document.getElementById('rlLoginRoleLabel').textContent = role === 'employee' ? 'Employee / Business User' : 'Technical / Power User';
  document.getElementById('rlLoginHint').textContent      = role === 'employee'
    ? 'Enter your employee access password'
    : 'Enter the technical user password';

  /* Clear previous state */
  document.getElementById('rlPassword').value    = '';
  document.getElementById('rlErrorMsg').style.display = 'none';

  /* Swap steps */
  document.getElementById('rlStepRole').style.display  = 'none';
  document.getElementById('rlStepLogin').style.display = '';

  /* Focus the password field */
  setTimeout(() => document.getElementById('rlPassword').focus(), 80);
}

/* ── STEP 2 → STEP 1: Back ──────────────────────────────────────────────── */
function rlGoToRole() {
  document.getElementById('rlStepLogin').style.display = 'none';
  document.getElementById('rlStepRole').style.display  = '';
}

/* ── Show / hide password ───────────────────────────────────────────────── */
function rlTogglePw() {
  const inp = document.getElementById('rlPassword');
  const btn = document.getElementById('rlPwToggle');
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁';
  }
}

/* ── Validate password and sign in ──────────────────────────────────────── */
function rlDoLogin() {
  const role = APP_ROLE.selectedRole;
  const pw   = document.getElementById('rlPassword').value;
  const err  = document.getElementById('rlErrorMsg');

  if (!pw) {
    err.textContent = '⚠ Please enter your password.';
    err.style.display = '';
    return;
  }

  if (!RL_CREDENTIALS[role]) {
    err.textContent = '⚠ Login is not configured. Create ebs-credentials.js from ebs-credentials.example.js.';
    err.style.display = '';
    return;
  }

  if (pw !== RL_CREDENTIALS[role]) {
    /* Wrong password — shake and show error */
    err.textContent = '⚠ Incorrect password. Please try again.';
    err.style.display = '';
    const wrap = document.getElementById('rlStepLogin');
    wrap.classList.remove('rl-shake');
    void wrap.offsetWidth; /* reflow to restart animation */
    wrap.classList.add('rl-shake');
    document.getElementById('rlPassword').value = '';
    document.getElementById('rlPassword').focus();
    return;
  }

  /* ✅ Correct — proceed */
  err.style.display = 'none';
  selectRole(role);
}

/* ── Reset all tab visible state on login / profile switch ─────────────── */
function _resetAllTabState() {
  /* ── EBS Reports tab: back to welcome screen ── */
  APP.currentReport = null;
  APP.allRows       = [];
  APP.filteredRows  = [];
  APP.navigationHistory = ['home'];
  const rc = document.getElementById('reportContent');
  const rw = document.getElementById('reportWelcome');
  if (rc) { rc.style.display = 'none'; }
  if (rw) { rw.style.display = 'flex'; }
  /* Clear report table content */
  const tbody = document.getElementById('reportTableBody');
  const thead = document.getElementById('reportTableHead');
  const rt    = document.getElementById('reportTitle');
  const rm    = document.getElementById('reportRecordCount');
  if (tbody) tbody.innerHTML = '';
  if (thead) thead.innerHTML = '';
  if (rt)    rt.textContent   = '';
  if (rm)    rm.textContent   = '0 records';
  /* Hide report action buttons and panels */
  ['btnDeleteReport','btnNewReport','btnShowSQL',
   'reportParamsBar','sqlPanel','chartPanel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  /* Clear active states in sidebar */
  document.querySelectorAll('.report-item.active').forEach(function(el) {
    el.classList.remove('active');
  });

  /* ── Chat tab: reset to welcome message ── */
  if (typeof clearChat === 'function') clearChat();

  /* ── Data Connect tab: back to welcome screen ── */
  var dcWelcome = document.getElementById('dcWelcome');
  var dcMapping = document.getElementById('dcMappingArea');
  var dcPreview = document.getElementById('dcPreviewArea');
  if (dcWelcome) dcWelcome.style.display = '';
  if (dcMapping) dcMapping.style.display = 'none';
  if (dcPreview) dcPreview.style.display = 'none';
  /* Reset DC file/sheet badges */
  ['dcFileBadge','dcSheetSelector','dcRowRange'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  /* ── SQL Advisor tab: clear all sub-editors + results ── */
  ['sqlInputArea','codeReviewInput','fmtInput'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  /* Hide result areas */
  ['sqlIssues','sqlTableAnalysis','sqlRecommendations'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  /* ── SQL Lab tab: clear prompt + restore welcome view ── */
  var slPrompt  = document.getElementById('sqlLabPrompt');
  var slSearch  = document.getElementById('sqlLabSearch');
  var slResults = document.getElementById('sqlLabResultsList');
  var slDisplay  = document.getElementById('sqlLabDisplay');
  var slSearchResults = document.getElementById('sqlLabSearchResults');
  var slWelcome  = document.getElementById('sqlLabWelcome');
  if (slPrompt)  slPrompt.value  = '';
  if (slSearch)  slSearch.value  = '';
  if (slResults) slResults.innerHTML = '';
  if (slDisplay) slDisplay.style.display = 'none';
  if (slSearchResults) slSearchResults.style.display = 'none';
  if (slWelcome) slWelcome.style.display = '';

  /* ── Doc Generator tab: hide preview panel ── */
  var docPreview = document.getElementById('docPreviewPanel');
  if (docPreview) docPreview.style.display = 'none';

  /* ── Academy tab: close assistant panel, back to welcome ── */
  var asstPanel = document.getElementById('academyAsstPanel');
  if (asstPanel) {
    asstPanel.classList.remove('open');
    asstPanel.style.removeProperty('width');
    asstPanel.style.removeProperty('height');
  }
  /* Clear Academy assistant history so new session starts fresh */
  if (typeof ACADEMY_ASST_HISTORY !== 'undefined') {
    ACADEMY_ASST_HISTORY = [];
  }
  var asstMsgs = document.getElementById('academyAsstMessages');
  if (asstMsgs) asstMsgs.innerHTML = '';
  /* Hide academy content, show welcome */
  var acContent = document.getElementById('academyContent');
  var acWelcome = document.getElementById('academyWelcome');
  if (acContent) acContent.style.display = 'none';
  if (acWelcome) acWelcome.style.display = '';
  /* Clear active module/topic highlights */
  document.querySelectorAll('.academy-mod-header.active,  .academy-topic-item.active').forEach(function(el) {
    el.classList.remove('active', 'expanded');
  });
}

/* ── Activate role after successful login ───────────────────────────────── */
function selectRole(role) {
  sessionStorage.setItem('ebs_role', role);
  APP_ROLE.current = role;

  /* ── Reset ALL tab state so no previous session data bleeds through ── */
  _resetAllTabState();

  /* Hide landing, show app chrome */
  document.getElementById('roleLanding').style.display    = 'none';
  document.getElementById('appHeader').style.display       = '';
  document.getElementById('appTabsWrapper').style.display  = '';

  /* Show footer */
  const footer = document.getElementById('appFooter');
  if (footer) footer.style.display = '';

  /* Show DASC info bar for the correct role */
  _showDascInfoBar(role);

  /* Update tab visibility */
  _applyRoleTabVisibility(role);

  /* Update footer tab list */
  _updateFooterTabList(role);

  /* Update header user pill */
  _updateHeaderUserPill(role);

  /* Re-render imported reports sidebar filtered by role */
  renderImportedReportsSidebar();

  /* Show/hide notification bell based on role */
  _refreshNotifBadge();

  /* Go to Chat tab */
  switchTab('tab-chat', document.querySelector('[data-tab="tab-chat"]'));

  showToast(
    role === 'employee'
      ? '👤 Signed in as Employee — Reports, Chat & Data Connect available'
      : '⚙️ Signed in as Technical User — Full access enabled',
    'success'
  );
}

/* ── Sign out ───────────────────────────────────────────────────────────── */
function rlLogout() {
  sessionStorage.removeItem('ebs_role');
  APP_ROLE.current      = null;
  APP_ROLE.selectedRole = null;

  /* Reset ALL tab state so next login starts completely fresh */
  _resetAllTabState();

  /* Hide app, show landing */
  document.getElementById('roleLanding').style.display    = 'flex';
  document.getElementById('appHeader').style.display       = 'none';
  document.getElementById('appTabsWrapper').style.display  = 'none';
  const footer = document.getElementById('appFooter');
  if (footer) footer.style.display = 'none';

  /* Hide DASC info bar */
  var dib = document.getElementById('dascInfoBar');
  if (dib) dib.style.display = 'none';

  /* Reset login form to Step 1 */
  document.getElementById('rlStepLogin').style.display = 'none';
  document.getElementById('rlStepRole').style.display  = '';
  document.getElementById('rlOptEmployee').classList.remove('selected');
  document.getElementById('rlOptTechnical').classList.remove('selected');
  document.getElementById('rlNextBtn').disabled = true;
  document.getElementById('rlPassword').value = '';
  document.getElementById('rlErrorMsg').style.display = 'none';

  showToast('Signed out successfully.', 'info');
}

/* ── Show / hide DASC info bar based on role ───────────────────────────── */
function _showDascInfoBar(role) {
  var bar  = document.getElementById('dascInfoBar');
  var emp  = document.getElementById('dascBarEmployee');
  var tech = document.getElementById('dascBarTechnical');
  if (!bar) return;
  bar.style.display  = '';
  if (emp)  emp.style.display  = role === 'employee'  ? '' : 'none';
  if (tech) tech.style.display = role === 'technical' ? '' : 'none';
}

/* ── Apply tab visibility based on role ─────────────────────────────────── */
function _applyRoleTabVisibility(role) {
  document.querySelectorAll('.tab-btn[data-role="technical"]').forEach(btn => {
    /* Permanently hidden tabs (data-hidden="true") are never shown regardless of role */
    if (btn.dataset.hidden === 'true') {
      btn.style.display = 'none';
      return;
    }
    if (role === 'employee') {
      btn.classList.add('role-locked');
      btn.style.display = 'none';
    } else {
      btn.classList.remove('role-locked');
      btn.style.display = '';
    }
  });
}

/* ── Update footer tab list based on role ───────────────────────────────── */
function _updateFooterTabList(role) {
  const el = document.getElementById('footerTabList');
  if (!el) return;
  if (role === 'employee') {
    el.textContent = 'Chat ◆ EBS Reports ◆ Data Connect';
  } else {
    el.textContent = 'Chat ◆ Reports ◆ SQL Advisor ◆ Doc Generator ◆ SQL Lab ◆ EBS Academy ◆ Data Connect';
  }
}

/* ── Update header user pill ────────────────────────────────────────────── */
function _updateHeaderUserPill(role) {
  const icon  = document.getElementById('rlUserPillIcon');
  const name  = document.getElementById('rlUserPillName');
  const rlbl  = document.getElementById('rlUserPillRole');
  if (icon)  icon.textContent  = role === 'employee' ? '👤' : '⚙️';
  if (name)  name.textContent  = role === 'employee' ? 'Employee' : 'Technical';
  if (rlbl)  rlbl.textContent  = role === 'employee' ? 'Business User' : 'Power User';
}

/* ── On page load: restore session ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  const saved = sessionStorage.getItem('ebs_role');
  if (saved === 'employee' || saved === 'technical') {
    APP_ROLE.selectedRole = saved;
    selectRole(saved);
  }
  /* else: landing screen stays visible (default) */
});


/* ═══════════════════════════════════════════════════════════════════════
   IMPORTED REPORTS REGISTRY — push, pull, delete
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Register a report as "imported" so it appears in the sidebar panel.
 * Called from dcPushToReports() and dcCreateCustomReport().
 * @param {string} key      — REPORT_DATA key
 * @param {string} title    — display title
 * @param {string} source   — 'excel' | 'db' | 'custom'
 */
function registerImportedReport(key, title, source) {
  IMPORTED_REPORTS[key] = {
    key,
    title,
    source,
    pushedBy:  APP_ROLE.current || 'employee',   /* track who pushed it */
    pushedAt:  new Date().toLocaleTimeString(),
  };
  renderImportedReportsSidebar();
}

/* ─────────────────────────────────────────────────────────────────────────
   CUSTOM DELETE CONFIRM MODAL
   Replaces window.confirm() which can be blocked by some browsers.
   _pendingDeleteKey stores the key until user presses OK or Cancel.
   ───────────────────────────────────────────────────────────────────────── */
var _pendingDeleteKey = null;

function _showDeleteConfirm(key, title) {
  _pendingDeleteKey = key;
  var msg = document.getElementById('deleteConfirmMsg');
  if (msg) msg.textContent = 'Delete "' + title + '"?';
  var ov = document.getElementById('deleteConfirmOverlay');
  if (ov) { ov.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  setTimeout(function() {
    var ok = document.getElementById('deleteConfirmOK');
    if (ok) ok.focus();
  }, 80);
}

function _deleteConfirmOK() {
  var key = _pendingDeleteKey;
  _pendingDeleteKey = null;
  var ov = document.getElementById('deleteConfirmOverlay');
  if (ov) { ov.style.display = 'none'; document.body.style.overflow = ''; }
  if (key) _doDeleteReport(key);
}

function _deleteConfirmCancel() {
  _pendingDeleteKey = null;
  var ov = document.getElementById('deleteConfirmOverlay');
  if (ov) { ov.style.display = 'none'; document.body.style.overflow = ''; }
}

/**
 * Remove a report — save a snapshot to RECYCLE_BIN for possible restore.
 *
 * ev:
 *   Event object   → sidebar 🗑 click (stopPropagation)
 *   null           → header Delete button (Technical direct — shows confirm modal)
 *   '__approved__' → programmatic from resolveDeleteRequest (no confirm)
 */
function deleteImportedReport(key, ev) {
  console.log('[deleteImportedReport] called  key=' + key + '  ev=' + ev);
  /* Only call stopPropagation for genuine DOM events */
  if (ev && typeof ev === 'object' && typeof ev.stopPropagation === 'function') {
    ev.stopPropagation();
  }

  const rep       = IMPORTED_REPORTS[key];
  const dataEntry = window.REPORT_DATA && window.REPORT_DATA[key];
  const title     = (rep && rep.title) || (dataEntry && dataEntry.title) || key;

  console.log('[deleteImportedReport] title=' + title + '  ev=__approved__? ' + (ev === '__approved__'));

  /* For programmatic approve — skip confirmation and delete immediately */
  if (ev === '__approved__') {
    _doDeleteReport(key);
    return;
  }

  /* For interactive calls — show custom confirm modal */
  _showDeleteConfirm(key, title);
}

/**
 * Internal: perform the actual deletion after confirmation.
 * Called by _deleteConfirmOK() or directly when ev === '__approved__'.
 */
function _doDeleteReport(key) {
  console.log('[_doDeleteReport] EXECUTING delete for key=' + key);
  const rep       = IMPORTED_REPORTS[key];
  const dataEntry = window.REPORT_DATA && window.REPORT_DATA[key];
  const title     = (rep && rep.title) || (dataEntry && dataEntry.title) || key;

  /* ── STEP 1: Save full snapshot to RECYCLE_BIN before touching anything ── */
  if (dataEntry) {
    RECYCLE_BIN[key] = {
      reportKey:    key,
      title:        title,
      module:       dataEntry.module   || '',
      sql:          dataEntry.sql      || '',
      columns:      [...(dataEntry.columns || [])],
      rows:         (dataEntry.rows || []).map(r => [...r]),
      source:       (rep && rep.source) || (dataEntry._imported ? 'imported' : 'builtin'),
      pushedBy:     (rep && rep.pushedBy) || dataEntry._pushedBy || 'technical',
      deletedAt:    new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      _wasImported: !!dataEntry._imported,
    };
  }

  /* ── STEP 2: Remove from IMPORTED_REPORTS registry ── */
  if (rep) delete IMPORTED_REPORTS[key];

  /* ── STEP 3: Handle REPORT_DATA entry ─────────────────────────────────
       Mark as deleted in DELETED_REPORTS registry so loadReport() is blocked.
       For imported reports: fully remove from REPORT_DATA.
       For built-in reports: keep REPORT_DATA intact (the data is needed for
       restore), but the DELETED_REPORTS gate will prevent loadReport() loading it. */
  DELETED_REPORTS[key] = true;   /* ← THE KEY FIX: blocks sidebar click reload */

  if (dataEntry && dataEntry._imported) {
    /* Custom imported report — remove data entirely */
    delete window.REPORT_DATA[key];
  }
  /* Built-in reports: leave REPORT_DATA[key] in place for restore; the
     DELETED_REPORTS gate in loadReport() stops it being re-opened. */

  /* ── STEP 4: Reset the report display area to the welcome screen ── */
  APP.currentReport = null;
  APP.allRows       = [];
  APP.filteredRows  = [];

  /* Hide reportContent, show welcome */
  const rc = document.getElementById('reportContent');
  const rw = document.getElementById('reportWelcome');
  if (rc) {
    rc.style.display = 'none';
    const tbody = document.getElementById('reportTableBody');
    const thead = document.getElementById('reportTableHead');
    if (tbody) tbody.innerHTML = '';
    if (thead) thead.innerHTML = '';
    const rt = document.getElementById('reportTitle');
    const rm = document.getElementById('reportRecordCount');
    if (rt) rt.textContent = '';
    if (rm) rm.textContent = '0 records';
  }
  if (rw) { rw.removeAttribute('style'); rw.style.display = 'flex'; }

  /* Hide action buttons */
  ['btnDeleteReport','btnNewReport','btnShowSQL'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  /* Hide params / SQL / chart panels */
  ['reportParamsBar','sqlPanel','chartPanel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  /* Remove active highlight from all sidebar items */
  document.querySelectorAll('.report-item.active').forEach(el => el.classList.remove('active'));

  /* ── STEP 5: Visually dim/hide the sidebar item for this report ──
     Use data-attribute selector OR onclick text match — both built-in
     and imported items get hidden from view. */
  _hideSidebarItem(key);

  renderImportedReportsSidebar();
  _refreshNotifBadge();
  showToast(`🗑 "${title}" deleted — restore anytime via the 🔔 panel.`, 'info');
  console.log('[_doDeleteReport] DONE. DELETED_REPORTS:', Object.keys(DELETED_REPORTS));
}

/**
 * Hide ALL sidebar elements associated with a given report key.
 * Handles both:
 *  - Hardcoded HTML items:  onclick="loadReport('key', event)"
 *  - Dynamic imported rows: onclick="loadReport('key', event)"  (in importedReportsList)
 */
function _hideSidebarItem(key) {
  /* Escape key for use inside a CSS attribute selector */
  const safe = key.replace(/'/g, "\\'");
  document.querySelectorAll(
    `.report-item[onclick*="${safe}"], .imported-report-name[onclick*="${safe}"]`
  ).forEach(function(el) {
    el.closest('.report-item, .imported-report-row') ?
      (el.closest('.report-item, .imported-report-row').style.display = 'none') :
      (el.style.display = 'none');
  });
}

/**
 * Unhide a sidebar item when it is restored from the Recycle Bin.
 */
function _showSidebarItem(key) {
  const safe = key.replace(/'/g, "\\'");
  document.querySelectorAll(
    `.report-item[onclick*="${safe}"], .imported-report-name[onclick*="${safe}"]`
  ).forEach(function(el) {
    var row = el.closest('.report-item, .imported-report-row');
    if (row) row.style.display = '';
    else el.style.display = '';
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   RESTORE A DELETED REPORT (Technical only)
   ───────────────────────────────────────────────────────────────────────── */
function restoreDeletedReport(key) {
  const snap = RECYCLE_BIN[key];
  if (!snap) {
    showToast('Nothing in Recycle Bin for this report.', 'warning');
    return;
  }

  /* Rebuild REPORT_DATA entry from the snapshot */
  window.REPORT_DATA[key] = {
    title:     snap.title,
    module:    snap.module,
    sql:       snap.sql,
    columns:   [...snap.columns],
    rows:      snap.rows.map(r => [...r]),
    _imported: snap._wasImported,
    _pushedBy: snap.pushedBy,
    _restoredAt: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
  };

  /* Clear the deleted-gate so loadReport() will accept this key again */
  delete DELETED_REPORTS[key];

  /* Re-register in IMPORTED_REPORTS so it shows in the sidebar */
  if (snap._wasImported) {
    registerImportedReport(key, snap.title, snap.source || 'custom');
  }

  /* Re-show the sidebar item (both built-in HTML item and imported row) */
  _showSidebarItem(key);

  /* Remove from recycle bin — it's been restored */
  delete RECYCLE_BIN[key];

  /* Update the request card that triggered deletion (if any) */
  Object.values(DELETE_REQUESTS).forEach(req => {
    if (req.reportKey === key && req.status === 'approved') {
      req.status     = 'restored';
      req.resolvedAt = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }
  });

  _refreshNotifBadge();
  renderNotifPanel();
  renderImportedReportsSidebar();
  showToast(`♻️ "${snap.title}" has been restored and is available in EBS Reports.`, 'success');
}

/**
 * Pull an imported report back into Data Connect for re-mapping.
 */
function pullImportedReport(key, ev) {
  if (ev) ev.stopPropagation();
  const rep = IMPORTED_REPORTS[key];
  const data = window.REPORT_DATA && window.REPORT_DATA[key];
  if (!rep || !data) return;

  /* Load the report data back into DC state */
  DC.rawFileName  = rep.title;
  DC.activeSheet  = rep.title;
  DC.rawHeaders   = [...(data.columns || [])];
  DC.rawRows      = (data.rows || []).map(r => [...r]);
  DC.colTypes     = DC.rawHeaders.map((_, ci) => _dcDetectType(DC.rawRows, ci));
  DC.mapping      = {};
  DC.transforms   = {};
  DC.targetReport = key;

  /* Auto-map identity */
  DC.rawHeaders.forEach(h => { DC.mapping[h] = h; });

  /* Update badge */
  document.getElementById('dcFileBadgeName').textContent =
    `${DC.rawFileName} · ${DC.rawHeaders.length} cols · ${DC.rawRows.length} rows`;
  document.getElementById('dcFileBadge').style.display = '';

  /* Switch to Data Connect tab */
  switchTab('tab-dataconnect', document.querySelector('[data-tab="tab-dataconnect"]'));

  /* Show mapping */
  setTimeout(() => {
    _dcPopulateTargetReports();
    _dcShowMapping();
    showToast(`🔀 Pulled "${rep.title}" back into Data Connect — re-map & push again.`, 'success');
  }, 300);
}

/**
 * Render the imported reports section in the EBS Reports sidebar.
 */
function renderImportedReportsSidebar() {
  const currentRole = APP_ROLE.current || 'employee';
  const allKeys     = Object.keys(IMPORTED_REPORTS);

  /* Employee sees only their own; Technical sees all */
  const visibleKeys = currentRole === 'technical'
    ? allKeys
    : allKeys.filter(k => IMPORTED_REPORTS[k].pushedBy === 'employee');

  const section = document.getElementById('importedReportsSection');
  const list    = document.getElementById('importedReportsList');
  const counter = document.getElementById('importedReportsCount');
  if (!section || !list) return;

  if (visibleKeys.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  if (counter) counter.textContent = String(visibleKeys.length);

  const sourceIcon  = s => s === 'excel' ? '📊' : s === 'db' ? '🗄️' : '📋';
  const sourceLabel = s => s === 'excel' ? 'Excel' : s === 'db' ? 'DB' : 'Custom';

  list.innerHTML = visibleKeys.map(key => {
    const rep     = IMPORTED_REPORTS[key];
    /* Technical users see who pushed it */
    const ownerTag = currentRole === 'technical' && rep.pushedBy
      ? `<span class="imported-report-owner">${rep.pushedBy === 'employee' ? '👤' : '⚙️'}</span>`
      : '';

    return `
      <div class="imported-report-row">
        <div class="imported-report-name" onclick="loadReport('${escHTML(key)}', event)"
             title="Click to open · pushed at ${escHTML(rep.pushedAt)}">
          ${sourceIcon(rep.source)}
          <span style="overflow:hidden;text-overflow:ellipsis;">${escHTML(rep.title)}</span>
          <span class="imported-report-badge">${sourceLabel(rep.source)}</span>
          ${ownerTag}
        </div>
        <div class="imported-report-actions">
          <button class="imported-rep-btn pull"
                  onclick="pullImportedReport('${escHTML(key)}', event)"
                  title="Pull back into Data Connect to re-map">🔀</button>
          <button class="imported-rep-btn del"
                  onclick="deleteImportedReport('${escHTML(key)}', event)"
                  title="Delete this imported report">🗑</button>
        </div>
      </div>`;
  }).join('');
}

/* ──────────────────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────────────────── */
const APP = {
  currentReport: null,
  allRows: [],
  filteredRows: [],
  currentPage: 1,
  pageSize: 25,
  chartInstance: null,
  chatChartInstance: null,
  currentChartType: 'bar',
  currentChartDim: 'month',
  navigationHistory: ['home'],
  /* tabHistory tracks which tab the user was on before the current one */
  tabHistory: ['tab-chat'],
  currentTab: 'tab-chat',
  sqlInAdvisor: '',
  paramCount: 1,
  tableCount: 1,
  vsCount: 1,
};

/* ──────────────────────────────────────────────────────────────────
   NAVIGATION
   ────────────────────────────────────────────────────────────────── */
function goHome() {
  /* Reset all navigation state */
  APP.currentReport = null;
  APP.navigationHistory = ['home'];
  APP.tabHistory = [];
  APP.currentTab = 'tab-chat';

  /* Hide all floating panels */
  ['reportContent','sqlResultsPanel','codeReviewPanel','sqlPanel',
   'chartPanel','compareSec','compareSection'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  /* Show Reports welcome */
  var welcome = document.getElementById('reportWelcome');
  if (welcome) welcome.style.display = 'flex';

  /* Clear active states */
  document.querySelectorAll('.report-item').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('.module-group').forEach(function(el) {
    el.classList.remove('active', 'expanded');
  });

  /* Go to Chat Assistant tab and scroll to top */
  switchTab('tab-chat', document.querySelector('[data-tab="tab-chat"]'));
}

function goBack() {
  /* Try report-level back first (inside EBS Reports tab) */
  if (APP.currentTab === 'tab-reports' && APP.navigationHistory.length > 1) {
    APP.navigationHistory.pop();
    var prev = APP.navigationHistory[APP.navigationHistory.length - 1];
    if (!prev || prev === 'home') {
      /* Back to reports welcome screen */
      var rc = document.getElementById('reportContent');
      var rw = document.getElementById('reportWelcome');
      if (rc) rc.style.display = 'none';
      if (rw) rw.style.display = 'flex';
      /* Hide any open panels */
      ['sqlPanel','chartPanel'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      document.querySelectorAll('.report-item').forEach(function(el) {
        el.classList.remove('active');
      });
      APP.currentReport = null;
      showToast('Back to report list', 'info');
    } else {
      loadReport(prev, null);
      showToast('Back to: ' + (window.REPORT_DATA[prev] ? window.REPORT_DATA[prev].title : prev), 'info');
    }
    return;
  }

  /* Tab-level back — go to the previous tab */
  if (APP.tabHistory.length > 0) {
    var prevTab = APP.tabHistory.pop();
    /* Don't re-push to history (we're going back, not forward) */
    var currentBeforeBack = APP.currentTab;
    APP.currentTab = prevTab;

    /* Hide all tabs */
    document.querySelectorAll('.tab-content').forEach(function(el) {
      el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
      el.classList.remove('active');
    });

    /* Hide floating panels */
    ['sqlResultsPanel','codeReviewPanel','sqlPanel','chartPanel',
     'compareSec','compareSection'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    /* Show previous tab */
    var prevEl = document.getElementById(prevTab);
    if (prevEl) prevEl.classList.add('active');
    var prevBtn = document.querySelector('[data-tab="' + prevTab + '"]');
    if (prevBtn) prevBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'instant' });
    showToast('Back to: ' + (prevBtn ? prevBtn.textContent.trim() : prevTab), 'info');
    return;
  }

  /* Nothing in history — go to Chat Assistant (home) */
  goHome();
}

/* ──────────────────────────────────────────────────────────────────
   TAB SWITCHING
   ────────────────────────────────────────────────────────────────── */
function switchTab(tabId, btn) {
  /* Record tab history for Back button */
  if (APP.currentTab && APP.currentTab !== tabId) {
    APP.tabHistory.push(APP.currentTab);
    /* Keep history max 20 entries */
    if (APP.tabHistory.length > 20) APP.tabHistory.shift();
  }
  APP.currentTab = tabId;

  /* Hide ALL tab content panels */
  document.querySelectorAll('.tab-content').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(function(el) {
    el.classList.remove('active');
  });

  /* Explicitly hide floating panels that live inside SQL tab
     so they never bleed out when that tab is hidden */
  ['sqlResultsPanel','codeReviewPanel','sqlPanel','chartPanel',
   'compareSec','compareSection'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  /* Show the selected tab */
  var target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  if (btn) {
    btn.classList.add('active');
  } else {
    var tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');
  }

  /* Scroll to top — both window and all inner scrollable containers */
  window.scrollTo({ top: 0, behavior: 'instant' });
  /* Reset every overflow-auto/scroll child inside the activated tab */
  if (target) {
    target.querySelectorAll('*').forEach(function(el) {
      var st = window.getComputedStyle(el);
      if ((st.overflowY === 'auto' || st.overflowY === 'scroll' ||
           st.overflow  === 'auto' || st.overflow  === 'scroll') && el.scrollTop > 0) {
        el.scrollTop = 0;
      }
    });
  }
}

/* ──────────────────────────────────────────────────────────────────
   MODULE SIDEBAR
   ────────────────────────────────────────────────────────────────── */
function selectModule(moduleName, el) {
  document.querySelectorAll('.module-group').forEach(g => {
    g.classList.remove('active','expanded');
    const items = g.querySelector('.module-items');
    if (items) items.style.display = 'none';
  });
  el.classList.add('active','expanded');
  const items = el.querySelector('.module-items');
  if (items) items.style.display = 'block';
}

/* ──────────────────────────────────────────────────────────────────
   REPORT LOADING
   ────────────────────────────────────────────────────────────────── */
function loadReport(reportKey, ev) {
  if (ev) ev.stopPropagation();

  /* ── DELETED GATE ── If this report is in the recycle bin, refuse to load it.
     This prevents hardcoded sidebar items from reloading a deleted built-in report. */
  if (DELETED_REPORTS[reportKey]) {
    showToast(`"${reportKey}" has been deleted. Restore it via the 🔔 panel first.`, 'warning');
    /* Ensure it's still hidden in sidebar — defensive re-hide */
    _hideSidebarItem(reportKey);
    return;
  }

  const data = window.REPORT_DATA[reportKey];
  const meta = (window.REPORT_META && window.REPORT_META[reportKey]) || {};
  if (!data) { showToast(`Report "${reportKey}" not found.`, 'error'); return; }

  // Mark active in sidebar
  document.querySelectorAll('.report-item').forEach(el => el.classList.remove('active'));
  if (ev && ev.currentTarget) {
    ev.currentTarget.classList.add('active');
  } else if (ev && ev.target) {
    let t = ev.target;
    while (t && !t.classList.contains('report-item')) t = t.parentElement;
    if (t) t.classList.add('active');
  }

  // Push to navigation history
  if (APP.currentReport !== reportKey) APP.navigationHistory.push(reportKey);
  APP.currentReport = reportKey;

  // Set data
  APP.allRows = data.rows;
  APP.filteredRows = [...data.rows];
  APP.currentPage = 1;

  // Show content, hide welcome
  document.getElementById('reportWelcome').style.display = 'none';
  const reportContent = document.getElementById('reportContent');
  reportContent.style.display = 'block';

  // Scroll report content area to top
  reportContent.scrollTop = 0;
  const reportsMain = document.querySelector('.reports-main');
  if (reportsMain) reportsMain.scrollTop = 0;

  // Populate header
  document.getElementById('reportTitle').textContent = data.title;
  document.getElementById('reportModule').textContent = '📦 ' + (meta.module || data.module || 'Oracle EBS');
  document.getElementById('reportRecordCount').textContent = `${data.rows.length} records`;
  document.getElementById('reportDate').textContent = `Generated: ${new Date().toLocaleDateString()}`;

  // SQL content
  document.getElementById('sqlContent').textContent = data.sql || '-- No SQL available';

  // ── Role-gated header buttons ───────────────────────────────────────────
  const _role = APP_ROLE.current || 'employee';

  // SQL button: technical only
  const _btnSQL = document.getElementById('btnShowSQL');
  if (_btnSQL) _btnSQL.style.display = _role === 'technical' ? 'inline-flex' : 'none';

  // Delete button: ALWAYS shown when a report is loaded (role changes label only)
  const _btnDel = document.getElementById('btnDeleteReport');
  if (_btnDel) {
    // Remove any leftover hidden state (class OR inline style)
    _btnDel.classList.remove('btn-hidden');
    _btnDel.removeAttribute('style');              // nuke any inline style=display:none
    _btnDel.style.display = 'inline-flex';         // explicit show
    _btnDel.title = _role === 'technical'
      ? 'Delete this report permanently'
      : 'Request deletion from the Technical team';
    const icon = _btnDel.querySelector('span.del-icon');
    if (icon) {
      icon.textContent = _role === 'technical' ? '🗑 Delete' : '🗑 Request Delete';
    }
  }

  // New Report button: technical only
  const _btnNew = document.getElementById('btnNewReport');
  if (_btnNew) _btnNew.style.display = _role === 'technical' ? 'inline-flex' : 'none';

  // Dynamically populate Year filter from actual data
  populateYearFilter(data.rows);

  // Render parameters panel
  renderReportParams(reportKey, data);

  // Hide panels on new load
  document.getElementById('sqlPanel').style.display = 'none';
  document.getElementById('chartPanel').style.display = 'none';

  // Render table
  renderTable();
  showToast(`Loaded: ${data.title} (${data.rows.length} records)`, 'success');
}

/* ── Delete button click — branches by role ─────────────────────────────── */
function deleteCurrentReport() {
  const key  = APP.currentReport;
  console.log('[deleteCurrentReport] key=' + key + '  role=' + APP_ROLE.current);
  if (!key) {
    showToast('No report currently open.', 'warning');
    return;
  }
  const role = APP_ROLE.current || 'employee';
  if (role === 'technical') {
    deleteImportedReport(key, null);
  } else {
    openDeleteRequestDialog(key);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   DELETE REQUEST SYSTEM  (Employee → sends request; Technical → approves)
   ═══════════════════════════════════════════════════════════════════════ */

/** Open the employee Delete-Request dialog for a given report key */
function openDeleteRequestDialog(reportKey) {
  const data = window.REPORT_DATA[reportKey];
  if (!data) return;

  // Check if a pending request already exists for this report
  const existing = Object.values(DELETE_REQUESTS).find(
    r => r.reportKey === reportKey && r.status === 'pending'
  );
  if (existing) {
    showToast('⏳ A delete request for this report is already pending Technical review.', 'warning');
    return;
  }

  // Populate dialog fields
  document.getElementById('drReportTitle').textContent = data.title || reportKey;
  document.getElementById('drReason').value  = '';
  document.getElementById('drNotes').value   = '';
  // Store target key on dialog for submit
  document.getElementById('deleteRequestDialog').dataset.reportKey = reportKey;

  document.getElementById('deleteRequestDialog').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('drReason').focus(), 80);
}

function closeDRDialog(e) {
  if (e && e.target !== document.getElementById('deleteRequestDialog')) return;
  document.getElementById('deleteRequestDialog').style.display = 'none';
  document.body.style.overflow = '';
}

/** Employee submits a delete request */
function submitDeleteRequest() {
  const reason = document.getElementById('drReason').value;
  const notes  = document.getElementById('drNotes').value.trim();
  const reportKey = document.getElementById('deleteRequestDialog').dataset.reportKey;

  if (!reason) {
    showToast('Please select a reason for the deletion request.', 'warning');
    document.getElementById('drReason').focus();
    return;
  }

  const data    = window.REPORT_DATA[reportKey] || {};
  const reqId   = 'DR_' + Date.now();
  const reqTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  DELETE_REQUESTS[reqId] = {
    id:           reqId,
    reportKey:    reportKey,
    reportTitle:  data.title || reportKey,
    reason:       reason,
    notes:        notes,
    requestedBy:  'Employee',
    requestedAt:  reqTime,
    status:       'pending',
    resolvedAt:   null,
    resolvedNote: null,
  };

  // Close dialog
  document.getElementById('deleteRequestDialog').style.display = 'none';
  document.body.style.overflow = '';

  // Update notification bell for Technical
  _refreshNotifBadge();

  showToast(
    `📨 Delete request sent to Technical team for "<strong>${escHTML(data.title || reportKey)}</strong>". You'll be notified once reviewed.`,
    'success'
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   NOTIFICATION BELL + PANEL  (Technical side)
   ═══════════════════════════════════════════════════════════════════════ */

/** Update the red badge count on the notification bell */
function _refreshNotifBadge() {
  const bell  = document.getElementById('notifBellBtn');
  const badge = document.getElementById('notifBadge');
  if (!bell || !badge) return;

  const role    = APP_ROLE.current || 'employee';
  const pending = Object.values(DELETE_REQUESTS).filter(r => r.status === 'pending');

  /* Bell only shows for Technical */
  bell.style.display = role === 'technical' ? 'inline-flex' : 'none';

  if (role === 'technical' && pending.length > 0) {
    badge.style.display = 'flex';
    badge.textContent   = pending.length > 9 ? '9+' : String(pending.length);
  } else {
    badge.style.display = 'none';
  }
}

/** Open the notifications slide-panel */
function openNotifPanel() {
  renderNotifPanel();
  document.getElementById('notifPanelOverlay').style.display = '';
  document.body.style.overflow = 'hidden';
}

function closeNotifPanel(e) {
  if (e && e.target !== document.getElementById('notifPanelOverlay')) return;
  document.getElementById('notifPanelOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

/** Render all request cards inside the panel */
function renderNotifPanel() {
  const list    = document.getElementById('notifPanelList');
  const counter = document.getElementById('notifPanelCount');
  if (!list) return;

  const allReqs = Object.values(DELETE_REQUESTS)
    .sort((a, b) => {
      /* Pending first, then most-recent by ID */
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return  1;
      return b.id.localeCompare(a.id);
    });

  const pending = allReqs.filter(r => r.status === 'pending').length;
  if (counter) counter.textContent = `${pending} pending`;

  /* Also show recycle-bin items that have no DELETE_REQUEST origin */
  const recycleOnlyKeys = Object.keys(RECYCLE_BIN).filter(k =>
    !allReqs.some(r => r.reportKey === k)
  );

  if (allReqs.length === 0 && recycleOnlyKeys.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <span class="notif-empty-icon">🔔</span>
        <strong>All clear</strong>
        <span>No delete requests yet. Deleted reports appear here for restore.</span>
      </div>`;
    return;
  }

  /* ── Request cards ── */
  const reqCards = allReqs.map(req => {
    const statusMap = {
      pending:  { cls: 'notif-status-pending',  lbl: '⏳ Pending'  },
      approved: { cls: 'notif-status-approved', lbl: '✅ Approved' },
      declined: { cls: 'notif-status-declined', lbl: '❌ Declined' },
      restored: { cls: 'notif-status-restored', lbl: '♻️ Restored' },
    };
    const st = statusMap[req.status] || { cls: 'notif-status-pending', lbl: req.status };

    const inRecycleBin  = !!RECYCLE_BIN[req.reportKey];
    const reportExists  = !!(window.REPORT_DATA && window.REPORT_DATA[req.reportKey]);

    let actionBtns = '';
    if (req.status === 'pending') {
      actionBtns = `
        <button class="notif-approve-btn" onclick="resolveDeleteRequest('${req.id}','approve')">
          ✅ Approve &amp; Delete
        </button>
        <button class="notif-decline-btn" onclick="resolveDeleteRequest('${req.id}','decline')">
          ❌ Decline
        </button>`;
    } else if (req.status === 'approved' && inRecycleBin) {
      /* Deleted and in recycle bin — offer restore */
      actionBtns = `
        <button class="notif-restore-btn" onclick="restoreDeletedReport('${escHTML(req.reportKey)}')">
          ♻️ Restore Report
        </button>`;
    } else if (req.status === 'approved' && reportExists) {
      /* Approved but not yet deleted (edge-case) */
      actionBtns = `
        <button class="notif-delete-btn" onclick="resolveDeleteRequest('${req.id}','execute')">
          🗑 Delete now
        </button>`;
    } else if (req.status === 'declined') {
      actionBtns = `<span style="font-size:0.74rem;color:#9AA8B4;font-style:italic;">Request declined — no action taken.</span>`;
    } else if (req.status === 'restored') {
      actionBtns = `<span style="font-size:0.74rem;color:#0E6027;font-style:italic;">♻️ Report has been restored.</span>`;
    }

    return `
      <div class="notif-card" id="notif-card-${req.id}">
        <div class="notif-card-header">
          <div class="notif-card-icon">🗑</div>
          <div class="notif-card-info">
            <div class="notif-card-title" title="${escHTML(req.reportTitle)}">${escHTML(req.reportTitle)}</div>
            <div class="notif-card-meta">
              <span>👤 ${escHTML(req.requestedBy)}</span>
              <span>·</span>
              <span>🕐 ${escHTML(req.requestedAt)}</span>
              ${req.resolvedAt ? `<span>· ${escHTML(req.resolvedAt)}</span>` : ''}
            </div>
          </div>
          <span class="notif-card-status ${st.cls}">${st.lbl}</span>
        </div>
        <div class="notif-card-body">
          <div class="notif-card-reason">
            <strong>Reason:</strong> ${escHTML(req.reason)}
          </div>
          ${req.notes ? `<div class="notif-card-notes">"${escHTML(req.notes)}"</div>` : ''}
          <div class="notif-card-btns">${actionBtns}</div>
        </div>
      </div>`;
  }).join('');

  /* ── Recycle-bin-only cards (Technical direct-delete, no request) ── */
  const binCards = recycleOnlyKeys.map(k => {
    const snap = RECYCLE_BIN[k];
    return `
      <div class="notif-card">
        <div class="notif-card-header">
          <div class="notif-card-icon">♻️</div>
          <div class="notif-card-info">
            <div class="notif-card-title">${escHTML(snap.title)}</div>
            <div class="notif-card-meta">
              <span>🕐 deleted ${escHTML(snap.deletedAt)}</span>
              <span>·</span>
              <span>${snap._wasImported ? 'Imported' : 'Built-in'}</span>
            </div>
          </div>
          <span class="notif-card-status notif-status-declined">🗑 Deleted</span>
        </div>
        <div class="notif-card-body">
          <div class="notif-card-btns">
            <button class="notif-restore-btn" onclick="restoreDeletedReport('${escHTML(k)}')">
              ♻️ Restore Report
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.innerHTML = reqCards + binCards;
}

/** Technical approves or declines a delete request */
function resolveDeleteRequest(reqId, action) {
  const req = DELETE_REQUESTS[reqId];
  if (!req) return;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (action === 'approve') {
    req.status     = 'approved';
    req.resolvedAt = now;
    _doDeleteReport(req.reportKey);   // call internal fn directly — no confirm dialog
    showToast(`✅ Delete request approved — "${escHTML(req.reportTitle)}" has been removed.`, 'success');

  } else if (action === 'decline') {
    req.status     = 'declined';
    req.resolvedAt = now;
    showToast(`❌ Delete request for "${escHTML(req.reportTitle)}" declined.`, 'info');

  } else if (action === 'execute') {
    _doDeleteReport(req.reportKey);   // call internal fn directly — no confirm dialog
    showToast(`🗑 "${escHTML(req.reportTitle)}" deleted.`, 'success');
  }

  _refreshNotifBadge();
  renderNotifPanel();
}

/** Clear resolved (non-pending) requests from the panel.
 *  Also flushes the Recycle Bin for reports that have no pending restore. */
function clearAllRequests() {
  /* Remove resolved request cards */
  Object.keys(DELETE_REQUESTS).forEach(id => {
    if (DELETE_REQUESTS[id].status !== 'pending') delete DELETE_REQUESTS[id];
  });
  /* Flush recycle bin snapshots that are no longer needed */
  Object.keys(RECYCLE_BIN).forEach(k => {
    /* Keep in bin only if a pending request still references this report */
    const hasPending = Object.values(DELETE_REQUESTS).some(
      r => r.reportKey === k && r.status === 'pending'
    );
    if (!hasPending) delete RECYCLE_BIN[k];
  });
  _refreshNotifBadge();
  renderNotifPanel();
  showToast('Resolved requests and Recycle Bin cleared.', 'info');
}

/* ── New Custom Report dialog ─────────────────────────────────────────────── */
function openNewCustomReportDialog() {
  /* Clear previous values */
  document.getElementById('nrTitle').value   = '';
  document.getElementById('nrColumns').value = '';
  document.getElementById('nrDesc').value    = '';
  document.getElementById('nrModule').value  = 'Custom';
  document.getElementById('newReportDialog').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('nrTitle').focus(), 80);
}

function closeNewReportDialog(e) {
  if (e && e.target !== document.getElementById('newReportDialog')) return;
  document.getElementById('newReportDialog').style.display = 'none';
  document.body.style.overflow = '';
}

function doCreateNewReport() {
  const title   = document.getElementById('nrTitle').value.trim();
  const colsRaw = document.getElementById('nrColumns').value.trim();
  const module  = document.getElementById('nrModule').value;
  const desc    = document.getElementById('nrDesc').value.trim();

  if (!title) {
    showToast('Please enter a Report Title.', 'warning');
    document.getElementById('nrTitle').focus();
    return;
  }
  if (!colsRaw) {
    showToast('Please enter at least one column header.', 'warning');
    document.getElementById('nrColumns').focus();
    return;
  }

  const columns = colsRaw.split(',').map(c => c.trim()).filter(Boolean);
  if (!columns.length) {
    showToast('Could not parse column headers. Use comma-separated names.', 'warning');
    return;
  }

  const key = `custom_nr_${Date.now()}`;
  window.REPORT_DATA[key] = {
    title,
    module,
    columns,
    rows:      [],
    sql:       `-- Custom report: ${title}\n-- Created: ${new Date().toLocaleString()}\n-- Columns: ${columns.join(', ')}\n-- Notes: ${desc || 'N/A'}`,
    _imported: true,
  };

  /* Register and navigate */
  registerImportedReport(key, title, 'custom');
  closeNewReportDialog();

  switchTab('tab-reports', document.querySelector('[data-tab="tab-reports"]'));
  setTimeout(() => loadReport(key), 150);

  showToast(`✅ Custom report "${title}" created — use Import Data or Data Connect to add rows.`, 'success');
}

/* ── Dynamically populate Year filter from data rows ─────────────── */
function populateYearFilter(rows) {
  const sel = document.getElementById('filterYear');
  if (!sel) return;

  const CY = new Date().getFullYear();
  // Only consider years within a reasonable window (CY-5 to CY+1)
  // This excludes ancient hire dates (2010, 2015) and bogus future dates
  const minY = CY - 5, maxY = CY + 1;
  const yearsSet = new Set();

  rows.forEach(row => {
    row.forEach(cell => {
      const s = String(cell || '');
      // Only match cells that start with a 4-digit year followed by a dash
      // (date-formatted cells: YYYY-MM-DD or YYYY-JAN etc.)
      // Explicitly exclude cells that are numeric IDs (EMP-10047 won't match because
      // it doesn't start with the year)
      const m = s.match(/^(20\d{2})-/);
      if (m) {
        const y = parseInt(m[1], 10);
        if (y >= minY && y <= maxY) yearsSet.add(String(y));
      }
    });
  });

  // If no date cells fall within window, fall back to CY-2 → CY
  if (yearsSet.size === 0) {
    for (let y = CY; y >= CY - 2; y--) yearsSet.add(String(y));
  }

  const years = [...yearsSet].sort((a,b) => b - a); // newest first
  sel.innerHTML = '<option value="all">All Years</option>' +
    years.map(y => `<option value="${y}">${y}</option>`).join('');
}

/* ── Render per-report parameters bar ────────────────────────────── */
function renderReportParams(reportKey, data) {
  const bar = document.getElementById('reportParamsBar');
  if (!bar) return;

  const sql = data.sql || '';
  let paramMatches = [...new Set([...sql.matchAll(/:(\w+)/g)].map(m => m[1]))];

  // ── Auto-generate parameters for imported/pushed reports ──────────────
  // If the report has no SQL bind params (custom import, Data Connect push
  // to a target that had no SQL, etc.) but has columns, synthesise a minimal
  // set of filter params based on column-name heuristics so the user can
  // still filter by date range and ORG / OU.
  if (paramMatches.length === 0 && data._imported && data.columns && data.columns.length > 0) {
    const cols = data.columns;
    const hasOrgCol   = cols.some(c => /org|ou\b|operating.unit/i.test(c));
    const hasDateCol  = cols.some(c => /date|period|time/i.test(c));

    if (hasOrgCol)  paramMatches.push('p_org_id');
    if (hasDateCol) { paramMatches.push('p_start'); paramMatches.push('p_end'); }

    // If still nothing, expose a generic free-text search param
    if (paramMatches.length === 0) paramMatches.push('p_search');
  }

  if (paramMatches.length === 0) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  bar.innerHTML = `<span class="params-label">⚙️ Parameters:</span>` +
    paramMatches.map(p => {
      const lov = (window.REPORT_LOV || {})[p];
      const label = p.replace(/^p_/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      if (lov && lov.length > 0) {
        const opts = lov.map(o=>`<option value="${o.v}">${o.l}</option>`).join('');
        return `<div class="param-input-group">
          <label>${label}</label>
          <select class="report-param-select" data-param="${p}">
            <option value="">— All —</option>${opts}
          </select></div>`;
      }
      return `<div class="param-input-group">
        <label>${label}</label>
        <input type="text" class="report-param-input" data-param="${p}" placeholder="${getParamPlaceholder(p)}" />
      </div>`;
    }).join('') +
    `<button class="btn-run-report" onclick="applyReportParams()">▶ Apply</button>
     <button class="btn-reset-params" onclick="resetReportParams()">↺ Reset</button>`;
}

function getParamPlaceholder(p) {
  const lower = p.toLowerCase();
  const cy = new Date().getFullYear();
  if (lower.includes('start') || lower.includes('from')) return `${cy}-01-01`;
  if (lower.includes('end')   || lower.includes('to'))   return `${cy}-12-31`;
  if (lower.includes('org'))    return '101 / 201 / 301';
  if (lower.includes('period')) return `${cy}-JAN`;
  if (lower.includes('year'))   return String(cy);
  if (lower.includes('ccid'))   return '01-000-5100-0000';
  if (lower.includes('vendor') || lower.includes('supplier')) return 'Vendor ID (optional)';
  if (lower.includes('amount') || lower.includes('threshold')) return '100000';
  if (lower.includes('search')) return 'Search across all columns…';
  return 'Enter value…';
}

/* ── Smart date parsing helper ───────────────────────────────────── */
function _parseParamDate(s) {
  // Handles: YYYY-MM-DD, YYYY-MMM (e.g. 2025-JAN), MM/DD/YYYY, DD-MON-YYYY
  s = s.trim();
  // ISO: 2025-01-01
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  // YYYY-MMM: 2025-JAN
  const MONTHS = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
  m = s.match(/^(\d{4})-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i);
  if (m) return new Date(+m[1], MONTHS[m[2].toUpperCase()], 1);
  // DD-MON-YYYY: 01-JAN-2025
  m = s.match(/^(\d{2})-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-(\d{4})$/i);
  if (m) return new Date(+m[3], MONTHS[m[2].toUpperCase()], +m[1]);
  return null;
}

/* ── Extract all parseable dates from a row ──────────────────────── */
function _rowDates(row) {
  const dates = [];
  row.forEach(cell => {
    const d = _parseParamDate(String(cell || ''));
    if (d && !isNaN(d)) dates.push(d);
  });
  return dates;
}

function applyReportParams() {
  const data = window.REPORT_DATA[APP.currentReport];
  if (!data) return;

  // Collect all filled param values, categorised by role
  const dateStartParams = ['p_start_date','p_start','start_date','start','p_from','from'];
  const dateEndParams   = ['p_end_date','p_end','end_date','end','p_to','to'];
  const yearParams      = ['p_year','year'];
  const periodParams    = ['p_period','period'];
  const orgParams       = ['p_org_id','org_id'];

  let startDate = null, endDate = null, yearVal = null, periodVal = null;
  let orgVal = null;           // ORG ID — handled with smart column-index matching
  const genericVals = {};      // everything else — ccid, vendor, free-text

  document.querySelectorAll('.report-param-input[data-param], .report-param-select[data-param]').forEach(el => {
    const p = el.getAttribute('data-param');
    const v = el.value.trim();
    if (!v) return;
    if (dateStartParams.includes(p))   { startDate = _parseParamDate(v); }
    else if (dateEndParams.includes(p)) { endDate  = _parseParamDate(v); }
    else if (yearParams.includes(p))    { yearVal  = v; }
    else if (periodParams.includes(p))  { periodVal = v.toUpperCase(); }
    else if (orgParams.includes(p))     { orgVal   = v.toLowerCase(); }
    else                                { genericVals[p] = v.toLowerCase(); }
  });

  // ── Fiscal-year cross-year date range detection ──────────────────────
  // If both dates are provided and end < start, the user specified a
  // cross-calendar-year range (e.g. 01-APR → 31-MAR = UK/Indian fiscal year).
  // Auto-advance endDate by exactly 1 year so the filter works correctly
  // instead of reporting "From date is greater than To date".
  if (startDate && endDate && endDate < startDate) {
    const adjusted = new Date(endDate);
    adjusted.setFullYear(adjusted.getFullYear() + 1);
    endDate = adjusted;
    showToast(
      `📅 Fiscal year range detected — end date advanced to ${endDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}.`,
      'info'
    );
  }

  const filled = [startDate, endDate, yearVal, periodVal, orgVal, ...Object.values(genericVals)].filter(Boolean).length;
  if (filled === 0) {
    APP.filteredRows = [...APP.allRows];
    renderTable();
    showToast('No parameters set — showing all records.', 'info');
    return;
  }

  // ── Pre-compute ORG column index for smart ORG filtering ─────────────
  // Look for the column whose header suggests it is an Operating Unit / ORG
  // field. Only that column's cell value is compared — avoids false matches
  // against Invoice IDs, amounts, or other numeric fields that share digits.
  const cols = data.columns || [];
  const _orgColIdx = orgVal !== null
    ? cols.findIndex(c => /org|ou\b|operating.unit|org_id/i.test(c))
    : -1;

  // ── Pre-compute date column indices ───────────────────────────────────
  // For date-range filtering on pushed/imported reports that may NOT have
  // the exact same column layout as the original SQL params expect, we try
  // ALL date-looking columns so any of them can satisfy the range.
  // (The existing _rowDates() already scans the whole row — this is fine.)

  APP.filteredRows = APP.allRows.filter(row => {

    // ── ORG ID filter — smart column-targeted match ─────────────────────
    if (orgVal !== null) {
      // Preferred: match against the detected ORG column value only
      if (_orgColIdx >= 0) {
        const cellVal = String(row[_orgColIdx] || '').toLowerCase();
        // Match numeric ORG IDs (e.g. "101") exactly, or label substrings (e.g. "cook county")
        const isNumericOrg = /^\d+$/.test(orgVal);
        if (isNumericOrg) {
          // Exact match on the numeric part: "101" must equal the cell (or be at the start)
          if (cellVal !== orgVal && !cellVal.startsWith(orgVal + ' ') && !cellVal.startsWith(orgVal + '-')) return false;
        } else {
          // Label match: partial substring is fine
          if (!cellVal.includes(orgVal)) return false;
        }
      } else {
        // No dedicated ORG column found in this report — fall back to checking
        // OU / org-named columns only; if none exist, skip this filter gracefully
        // (don't block all rows just because there's no ORG column).
        const ouColIdx = cols.findIndex(c => /\bou\b|unit|org/i.test(c));
        if (ouColIdx >= 0) {
          const cellVal = String(row[ouColIdx] || '').toLowerCase();
          if (!cellVal.includes(orgVal)) return false;
        }
        // else: no org column at all — treat org filter as "pass" for this report
      }
    }

    // ── Date range filter ───────────────────────────────────────────────
    if (startDate || endDate) {
      const rowDates = _rowDates(row);
      if (rowDates.length === 0) return false; // row has no dates — exclude
      const hasDateInRange = rowDates.some(d => {
        if (startDate && endDate) return d >= startDate && d <= endDate;
        if (startDate)            return d >= startDate;
        if (endDate)              return d <= endDate;
        return true;
      });
      if (!hasDateInRange) return false;
    }

    // ── Year filter ─────────────────────────────────────────────────────
    if (yearVal) {
      const rowDates = _rowDates(row);
      const yearStr  = String(yearVal);
      const yearMatch = rowDates.some(d => String(d.getFullYear()) === yearStr)
                     || row.some(cell => {
                          const s = String(cell || '');
                          // Only match year in date-formatted cells, not IDs
                          return /^20\d{2}-/.test(s) && s.startsWith(yearStr);
                        });
      if (!yearMatch) return false;
    }

    // ── Period filter (e.g. 2025-JAN) ──────────────────────────────────
    if (periodVal) {
      const hasPeriod = row.some(cell => String(cell || '').toUpperCase().includes(periodVal));
      if (!hasPeriod) return false;
    }

    // ── Generic value filter (ccid, vendor, free-text) ─────────────────
    // These still use full-row substring matching which is intentional for
    // free-text searches (vendor names, invoice numbers, etc.)
    for (const val of Object.values(genericVals)) {
      const rowStr = row.join('|').toLowerCase();
      if (!rowStr.includes(val)) return false;
    }

    return true;
  });

  APP.currentPage = 1;
  renderTable();
  const el = document.querySelector('#reportMeta #reportRecordCount');
  if (el) el.textContent = `${APP.filteredRows.length} records`;

  if (APP.filteredRows.length === 0) {
    showToast(`No records match the selected parameters. Try broadening the date range or clearing a filter.`, 'warning');
  } else {
    showToast(`Filter applied: ${APP.filteredRows.length} of ${APP.allRows.length} records match.`, 'success');
  }
}

function resetReportParams() {
  document.querySelectorAll('.report-param-input[data-param], .report-param-select[data-param]').forEach(el => {
    el.value = '';
  });
  APP.filteredRows = [...APP.allRows];
  APP.currentPage = 1;
  renderTable();
  const el = document.querySelector('#reportMeta #reportRecordCount');
  if (el) el.textContent = `${APP.allRows.length} records`;
  showToast('Parameters reset — showing all records.', 'info');
}

/* ──────────────────────────────────────────────────────────────────
   TABLE RENDERING
   ────────────────────────────────────────────────────────────────── */
function renderTable() {
  const data = window.REPORT_DATA[APP.currentReport];
  if (!data) return;

  const thead = document.getElementById('reportTableHead');
  const tbody = document.getElementById('reportTableBody');
  const start = (APP.currentPage - 1) * APP.pageSize;
  const end   = start + APP.pageSize;
  const pageRows = APP.filteredRows.slice(start, end);
  const totalPages = Math.ceil(APP.filteredRows.length / APP.pageSize);

  // Header
  thead.innerHTML = `<tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;

  // Body
  tbody.innerHTML = pageRows.map(row => `
    <tr>${row.map((cell,i) => {
      let val = cell === null || cell === undefined ? '—' : cell;
      // Add status badges
      if (typeof val === 'string') {
        if (val === 'Active' || val === 'Approved' || val === 'Y')
          val = `<span class="badge badge-success">${val}</span>`;
        else if (val === 'Pending' || val === 'In Progress')
          val = `<span class="badge badge-warning">${val}</span>`;
        else if (val === 'Rejected' || val === 'Terminated' || val === 'N')
          val = `<span class="badge badge-danger">${val}</span>`;
        else if (val === 'On Hold' || val === 'Unmatched')
          val = `<span class="badge badge-pending">${val}</span>`;
      }
      return `<td>${val}</td>`;
    }).join('')}</tr>`).join('');

  // Pagination
  document.getElementById('pageInfo').textContent = `Page ${APP.currentPage} of ${totalPages} (${APP.filteredRows.length} records)`;
  document.getElementById('prevPageBtn').disabled = APP.currentPage <= 1;
  document.getElementById('nextPageBtn').disabled = APP.currentPage >= totalPages;
}

function changePage(dir) {
  const totalPages = Math.ceil(APP.filteredRows.length / APP.pageSize);
  APP.currentPage = Math.max(1, Math.min(totalPages, APP.currentPage + dir));
  renderTable();
}

function changePageSize() {
  APP.pageSize = parseInt(document.getElementById('pageSize').value);
  APP.currentPage = 1;
  renderTable();
}

/* ──────────────────────────────────────────────────────────────────
   FILTERS
   ────────────────────────────────────────────────────────────────── */
function applyFilters() {
  const year   = document.getElementById('filterYear').value;
  const month  = document.getElementById('filterMonth').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();

  APP.filteredRows = APP.allRows.filter(row => {
    const rowStr = row.join('|').toLowerCase();
    const matchSearch = !search || rowStr.includes(search);
    const matchYear   = year  === 'all' || rowStr.includes(year);
    const matchMonth  = month === 'all' || rowStr.includes(`-${month}-`) || rowStr.includes(`-${month}`);
    return matchSearch && matchYear && matchMonth;
  });

  APP.currentPage = 1;
  renderTable();
  document.querySelector('#reportMeta #reportRecordCount').textContent = `${APP.filteredRows.length} records`;
}

function resetFilters() {
  document.getElementById('filterYear').value  = 'all';
  document.getElementById('filterMonth').value = 'all';
  document.getElementById('filterSearch').value = '';
  APP.filteredRows = [...APP.allRows];
  APP.currentPage  = 1;
  renderTable();
}

/* ──────────────────────────────────────────────────────────────────
   SQL PANEL
   ────────────────────────────────────────────────────────────────── */
function toggleSQL() {
  const panel = document.getElementById('sqlPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function copySQL() {
  const sql = document.getElementById('sqlContent').textContent;
  navigator.clipboard.writeText(sql).then(() => showToast('SQL copied to clipboard!', 'success'));
}

function loadSQLInAdvisor() {
  const sql = document.getElementById('sqlContent').textContent;
  document.getElementById('sqlInputArea').value = sql;
  showToast('SQL loaded in SQL Advisor', 'info');
}

/* ──────────────────────────────────────────────────────────────────
   CHART PANEL
   ────────────────────────────────────────────────────────────────── */
function toggleChart() {
  const panel = document.getElementById('chartPanel');
  const visible = panel.style.display === 'none';
  panel.style.display = visible ? 'block' : 'none';
  if (visible) renderReportChart();
}

function changeChartType(type, btn) {
  document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  APP.currentChartType = type;
  renderReportChart();
}

function updateChart() {
  APP.currentChartDim = document.getElementById('chartDimension').value;
  renderReportChart();
}

function renderReportChart() {
  const data = window.REPORT_DATA[APP.currentReport];
  if (!data) return;

  const canvas = document.getElementById('reportChart');
  if (APP.chartInstance) { APP.chartInstance.destroy(); APP.chartInstance = null; }

  // Build chart data based on dimension
  let labels = [];
  let values = [];
  const dim = document.getElementById('chartDimension').value;

  if (dim === 'month') {
    // Detect the most common year in the dataset to use for month bucketing
    const yearCount = {};
    data.rows.forEach(row => {
      const m2 = row.join('|').match(/\b(20\d{2})\b/g);
      if (m2) m2.forEach(y => { yearCount[y] = (yearCount[y]||0)+1; });
    });
    const dominantYear = Object.entries(yearCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || String(new Date().getFullYear());
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const agg = new Array(12).fill(0).map((_,i) => ({ label: months[i], val: 0 }));
    data.rows.forEach(row => {
      const dateStr = row.join('|');
      const m = dateStr.match(new RegExp(dominantYear + '-(\\d{2})'));
      if (m) { const idx = parseInt(m[1]) - 1; if (idx >= 0 && idx < 12) agg[idx].val += 1; }
    });
    labels = agg.map(a => a.label);
    values = agg.map(a => a.val);
  } else if (dim === 'year') {
    // Collect years dynamically from the data
    const yearsSet = new Set();
    data.rows.forEach(row => {
      const m2 = row.join('|').match(/\b(20\d{2})\b/g);
      if (m2) m2.forEach(y => yearsSet.add(y));
    });
    const years = [...yearsSet].sort();
    const agg = {};
    years.forEach(y => agg[y] = 0);
    data.rows.forEach(row => {
      const s = row.join('|');
      years.forEach(y => { if (s.includes(y)) agg[y]++; });
    });
    labels = Object.keys(agg);
    values = Object.values(agg);
  } else {
    // By first text column
    const agg = {};
    data.rows.slice(0, 20).forEach(row => {
      const key = String(row[1]).substring(0, 20);
      agg[key] = (agg[key] || 0) + 1;
    });
    labels = Object.keys(agg);
    values = Object.values(agg);
  }

  const meta = window.REPORT_META[APP.currentReport];
  const color = meta ? meta.color : '#0F62FE';
  const colors = labels.map((_,i) => {
    const palette = ['#C74634','#0F62FE','#24A148','#8A3FC7','#B7590A','#00832D','#5C6BC0','#E91E63'];
    return palette[i % palette.length];
  });

  APP.chartInstance = new Chart(canvas, {
    type: APP.currentChartType,
    data: {
      labels,
      datasets: [{
        label: data.title,
        data: values,
        backgroundColor: APP.currentChartType === 'bar' ? colors.map(c => c + '99') : colors,
        borderColor: colors,
        borderWidth: 2,
        fill: false,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title:  { display: true, text: `${data.title} — ${dim.charAt(0).toUpperCase()+dim.slice(1)} View` }
      }
    }
  });

  document.getElementById('chartTitle').textContent = `📈 ${data.title} — ${dim} chart`;
}

/* ──────────────────────────────────────────────────────────────────
   DOWNLOAD REPORT
   ────────────────────────────────────────────────────────────────── */
function downloadReport(format) {
  const data = window.REPORT_DATA[APP.currentReport];
  if (!data) { showToast('No report loaded.', 'error'); return; }

  if (format === 'csv') downloadAsCSV(data);
  else if (format === 'excel') downloadAsExcel(data);
  else if (format === 'pdf') downloadAsPDF(data);
}

function downloadAsCSV(data) {
  const rows = [data.columns, ...APP.filteredRows];
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${data.title.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded CSV: ${data.title}`, 'success');
}

function downloadAsExcel(data) {
  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded. Falling back to CSV.', 'warning');
    downloadAsCSV(data);
    return;
  }
  const wsData = [data.columns, ...APP.filteredRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.title.substring(0,31));
  XLSX.writeFile(wb, `${data.title.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast(`Downloaded Excel: ${data.title}`, 'success');
}

function downloadAsPDF(data) {
  // Generate printable HTML and trigger browser print as PDF
  const html = `<!DOCTYPE html><html><head><title>${data.title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:10pt;margin:20px}
  h1{color:#C74634;font-size:14pt;border-bottom:2px solid #C74634;padding-bottom:8px}
  h2{font-size:11pt;color:#1C1C2E;margin:4px 0}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#1C1C2E;color:white;padding:6px 8px;text-align:left;font-size:9pt}
  td{padding:5px 8px;border-bottom:1px solid #DDD;font-size:9pt}
  tr:nth-child(even) td{background:#F9F9F9}
  .footer{margin-top:20px;font-size:8pt;color:#888;text-align:center}
</style></head><body>
<h1>${data.title}</h1>
<h2>Module: ${(window.REPORT_META[APP.currentReport]||{}).module||'Oracle EBS'} | Records: ${APP.filteredRows.length} | Generated: ${new Date().toLocaleString()}</h2>
<table>
  <thead><tr>${data.columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
  <tbody>${APP.filteredRows.map(r=>`<tr>${r.map(c=>`<td>${c===null?'—':c}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
<div class="footer">Oracle EBS Intelligence Hub v5.2 | Powered by IBM BOB + ICA Context Studio · Ontology v5.2</div>
</body></html>`;
  const win = window.open('','_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
  showToast(`PDF view opened for: ${data.title}`, 'success');
}

/* ──────────────────────────────────────────────────────────────────
   CHAT ASSISTANT
   ────────────────────────────────────────────────────────────────── */
function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

function injectQuery(q) {
  document.getElementById('chatInput').value = q;
  sendChatMessage();
}

function sendChatMessage() {
  const input   = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  appendChatMessage(message, 'user');
  input.value = '';

  // Show typing indicator
  const typingId = showTyping();

  // Simulate AI processing with delay
  setTimeout(() => {
    removeTyping(typingId);
    const response = generateChatResponse(message);
    appendChatMessage(response.text, 'assistant');
    if (response.reportKey) {
      showReportPreviewInChat(response.reportKey);
    }
  }, 1000 + Math.random() * 800);
}

function appendChatMessage(text, role) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  /* Render markdown for assistant messages; escape user input */
  const rendered = role === 'user'
    ? `<p>${escHTML(text)}</p>`
    : _mdToHtml(text);
  div.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="msg-bubble">${rendered}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  const id = 'typing_' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant typing-indicator';
  div.innerHTML = `<div class="msg-avatar">🤖</div>
    <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function generateChatResponse(message) {
  const lower = message.toLowerCase();

  // Intent matching
  const intents = [
    { patterns: ['aged payable','outstanding invoice','overdue'], key:'aged_payables_detail',
      text:'Here are the **Aged Payables** records. I found outstanding invoices across multiple aging buckets (0-30, 31-60, 61-90, 91-120, 120+ days). Displaying the detail report below:' },
    { patterns: ['supplier','vendor','high payment'], key:'suppliers_high_payments',
      text:`Displaying **Suppliers with High Payments** over the last 3 fiscal years. The report shows FY${new Date().getFullYear()-3}, FY${new Date().getFullYear()-2}, and FY${new Date().getFullYear()-1} payment totals ranked by amount.` },
    { patterns: ['invoice register','all invoice','invoice list'], key:'invoice_register',
      text:'Here is the **Invoice Register** showing all AP invoices entered for the selected period, sorted by date.' },
    { patterns: ['iexpense','expense report','expense pending'], key:'iexpense_detail',
      text:'Showing **iExpense Detail Report**. This includes all submitted expense reports with approval status, amounts, and submitter details.' },
    { patterns: ['credit card','corporate card'], key:'credit_card_report',
      text:'Displaying the **Credit Card Report** — all corporate card transactions with match status, merchant, and expense category.' },
    { patterns: ['workflow','approval status','pending approval'], key:'workflow_approvals',
      text:'Here are the **Workflow & Approvals** details for iExpense reports, including approval levels, action dates, and cycle times.' },
    { patterns: ['journal','gl entry','general ledger'], key:'gl_journals',
      text:'Showing **GL Journal Entries** for the selected period. Source, category, debit/credit amounts, and posting status are shown.' },
    { patterns: ['trial balance','ap balance','payable balance'], key:'ap_trial_balance',
      text:'Here is the **AP Trial Balance** — vendor-wise liability balances as of the selected period.' },
    { patterns: ['purchase order','po detail','po list'], key:'po_detail',
      text:'Displaying the **Purchase Order Detail Report** with all POs, quantities, prices, and approval status.' },
    { patterns: ['employee','active employee','headcount'], key:'active_employees',
      text:'Here are the **Active Employees** — full headcount with job titles, departments, supervisors, and cost allocations.' },
    { patterns: ['terminated','ex-employee','leaving'], key:'terminated_employees',
      text:'Showing **Terminated Employees** report — employees who left in the last 12 months with termination reasons and final pay details.' },
    { patterns: ['withholding tax','1099','tax supplier'], key:'withholding_tax',
      text:'Here is the **Withholding Tax by Supplier** — 1099 tax amounts deducted from supplier payments for statutory compliance.' },
    { patterns: ['savings','procurement saving','purchasing saving'], key:'savings_analysis',
      text:'Displaying the **Savings Analysis Report** showing buyer-wise and category-wise procurement savings vs. list prices.' },
    { patterns: ['cost allocation','expense account','allocation'], key:'expense_cost_allocation',
      text:'Showing the **Expense Cost Allocation** report — full accounting details linking employee expenses to GL accounts, funds, and projects.' },
  ];

  for (const intent of intents) {
    if (intent.patterns.some(p => lower.includes(p))) {
      return { text: intent.text, reportKey: intent.key };
    }
  }

  // Generic fallback
  return {
    text: `I understand you're looking for: **"${message}"**\n\nI can generate reports for:\n
📊 **Payables** — aged payables, invoice register, AP trial balance, withholding tax\n
🏢 **Suppliers** — supplier list, payment history, audit trail\n
📦 **Purchasing** — PO detail, distributions, receipt adjustments, savings analysis\n
💸 **iExpense** — expense reports, credit cards, workflow approvals\n
👥 **HRMS** — active/terminated employees, supervisors, cost allocation\n
📒 **General Ledger** — journal entries, trial balance, account analysis\n\nTry being more specific, e.g., "Show aged payables for October 2024"`,
    reportKey: null
  };
}

function showReportPreviewInChat(reportKey) {
  const data = window.REPORT_DATA[reportKey];
  if (!data) return;

  APP.currentReport = reportKey;
  APP.allRows = data.rows;
  APP.filteredRows = [...data.rows];

  const preview = document.getElementById('chatReportPreview');
  preview.style.display = 'block';
  document.getElementById('previewTitle').textContent = data.title + ` (${data.rows.length} records)`;

  // Build table (first 10 rows)
  const tableHtml = `<table class="report-table">
    <thead><tr>${data.columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${data.rows.slice(0,10).map(row=>
      `<tr>${row.map(c=>`<td>${c===null||c===undefined?'—':c}</td>`).join('')}</tr>`
    ).join('')}</tbody>
  </table>`;
  document.getElementById('previewTableContainer').innerHTML = tableHtml;

  // Smart mini chart — detect best columns to chart
  if (APP.chatChartInstance) { APP.chatChartInstance.destroy(); APP.chatChartInstance = null; }
  const canvas = document.getElementById('chatReportChart');

  // Try to find a text label column (col 1 or named something useful) and a numeric amount column
  const cols = data.columns;
  const sample10 = data.rows.slice(0, 50);

  // Find first "amount" or numeric-looking column
  let valueColIdx = -1;
  for (let i = 0; i < cols.length; i++) {
    const cn = cols[i].toLowerCase();
    if (cn.includes('amount') || cn.includes('total') || cn.includes('payment') ||
        cn.includes('balance') || cn.includes('cost') || cn.includes('salary') ||
        cn.includes('savings') || cn.includes('price')) {
      // Check that at least half the rows have numeric values here
      const numericCount = sample10.filter(r => {
        const v = String(r[i] || '').replace(/[$,]/g,'');
        return !isNaN(parseFloat(v)) && parseFloat(v) !== 0;
      }).length;
      if (numericCount > sample10.length * 0.3) { valueColIdx = i; break; }
    }
  }
  // Fallback: find any column with numeric values
  if (valueColIdx === -1) {
    for (let i = 1; i < cols.length; i++) {
      const numericCount = sample10.filter(r => {
        const v = String(r[i] || '').replace(/[$,]/g,'');
        return !isNaN(parseFloat(v)) && parseFloat(v) > 0;
      }).length;
      if (numericCount > sample10.length * 0.5) { valueColIdx = i; break; }
    }
  }

  // Find label column (first text/name column)
  let labelColIdx = 0;
  for (let i = 0; i < cols.length; i++) {
    const cn = cols[i].toLowerCase();
    if (cn.includes('name') || cn.includes('vendor') || cn.includes('employee') ||
        cn.includes('supplier') || cn.includes('account') || cn.includes('department') ||
        cn.includes('category') || cn.includes('source') || cn.includes('buyer')) {
      labelColIdx = i; break;
    }
  }

  // Build aggregated top-10 chart
  const aggMap = {};
  data.rows.forEach(row => {
    const label = String(row[labelColIdx] || 'Unknown').substring(0, 20);
    let val = 0;
    if (valueColIdx >= 0) {
      val = parseFloat(String(row[valueColIdx] || '0').replace(/[$,]/g,'')) || 0;
    } else {
      val = 1; // count-based
    }
    aggMap[label] = (aggMap[label] || 0) + val;
  });

  const sorted = Object.entries(aggMap).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const chartLabels = sorted.map(e => e[0]);
  const chartValues = sorted.map(e => e[1]);
  const chartTitle = valueColIdx >= 0
    ? `${data.title} — Top 10 by ${cols[valueColIdx]}`
    : `${data.title} — Record Count by ${cols[labelColIdx]}`;

  APP.chatChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: cols[valueColIdx >= 0 ? valueColIdx : labelColIdx],
        data: chartValues,
        backgroundColor: [
          '#0F62FE99','#00832D99','#C7463499','#8A3FC799','#B7590A99',
          '#0043CE99','#24A14899','#DA1E2899','#198038','#F1C21B99'
        ],
        borderColor: '#0F62FE',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: chartTitle, font: { size: 12 } }
      },
      scales: {
        x: { ticks: { maxRotation: 35, font: { size: 10 } } },
        y: { ticks: { font: { size: 10 } } }
      }
    }
  });

  document.getElementById('chatMessages').scrollTop = 99999;
}

function closePreview() {
  document.getElementById('chatReportPreview').style.display = 'none';
}

function downloadCurrentReport(format) {
  const data = window.REPORT_DATA[APP.currentReport];
  if (!data) { showToast('No report loaded.', 'error'); return; }
  if (format === 'csv')   downloadAsCSV(data);
  else if (format === 'excel') downloadAsExcel(data);
  else if (format === 'pdf')   downloadAsPDF(data);
}

function clearChat() {
  /* Restore the original welcome message — never wipe it to blank */
  document.getElementById('chatMessages').innerHTML = `
  <div class="message assistant">
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">
      <p>Welcome to <strong>Oracle EBS Reports Assistant</strong>! I can help you generate reports for:</p>
      <ul>
        <li>📊 <strong>Payables</strong> — Aged payables, invoice register, supplier payments</li>
        <li>🏢 <strong>Purchasing</strong> — PO details, receipts, savings analysis</li>
        <li>💰 <strong>General Ledger</strong> — Journals, trial balance, account analysis</li>
        <li>💳 <strong>iExpense</strong> — Expense reports, credit cards, workflow approvals</li>
        <li>👥 <strong>HRMS</strong> — Employee details, payroll, cost allocation</li>
      </ul>
      <p>Type your request or select a quick action to get started.</p>
      <hr style="border:none;border-top:1px solid #C8DFF5;margin:10px 0;">
      <p style="font-size:0.8rem;color:#3D5A73;">
        📂 <strong>Using your own data?</strong> Click <em>Upload Data</em> (top right) to load an Excel or CSV file.<br>
        🔌 <strong>DB Connection:</strong> Export your Oracle EBS query result as CSV/Excel and upload it here.
      </p>
    </div>
  </div>`;
  document.getElementById('chatReportPreview').style.display = 'none';
}

function downloadChatReport() {
  if (APP.currentReport) downloadReport('csv');
  else showToast('Generate a report first using the chat assistant.', 'info');
}

/* ── Excel/CSV Upload into current report slot ──────────────────── */
function handleChatDataUpload(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reportKey = APP.currentReport || 'suppliers_list';

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      if (lines.length < 2) { showToast('CSV file too short — need at least a header row and one data row.', 'error'); return; }
      const columns = lines[0].split(',').map(c => c.replace(/^"|"$/g,'').trim());
      const rows = lines.slice(1).map(line =>
        line.split(',').map(c => c.replace(/^"|"$/g,'').trim())
      );
      _injectUploadedData(reportKey, columns, rows, file.name);
    };
    reader.readAsText(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      showToast('Excel library not loaded. Please try CSV format instead.', 'error'); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (raw.length < 2) { showToast('Excel file too short — need at least header + 1 data row.', 'error'); return; }
        const columns = raw[0].map(c => String(c || '').trim());
        const rows = raw.slice(1).map(r => columns.map((_, i) => r[i] !== undefined ? String(r[i]) : ''));
        _injectUploadedData(reportKey, columns, rows, file.name);
      } catch(err) {
        showToast('Could not read Excel file: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  }
  inputEl.value = ''; // reset so same file can be re-uploaded
}

function _injectUploadedData(reportKey, columns, rows, fileName) {
  // Create or update the report slot with uploaded data
  const existing = window.REPORT_DATA[reportKey] || {};
  window.REPORT_DATA[reportKey] = {
    title: existing.title || fileName.replace(/\.\w+$/, ''),
    module: existing.module || 'Uploaded Data',
    columns: columns,
    rows: rows,
    sql: existing.sql || `-- Data loaded from: ${fileName}\n-- ${rows.length} rows × ${columns.length} columns`,
  };
  APP.currentReport = reportKey;
  APP.allRows = rows;
  APP.filteredRows = [...rows];
  showReportPreviewInChat(reportKey);
  showToast(`✅ Loaded ${rows.length} rows × ${columns.length} columns from "${fileName}"`, 'success');

  // Build column mapping summary for the user message
  const colSample = columns.slice(0, 8).map(c => `\`${c}\``).join(', ');
  const more = columns.length > 8 ? ` + ${columns.length - 8} more` : '';

  // Detect likely date, amount, and ID columns for user awareness
  const dateCols   = columns.filter(c => /date|time|period|month|year/i.test(c));
  const amtCols    = columns.filter(c => /amount|total|balance|payment|cost|price|value/i.test(c));
  const idCols     = columns.filter(c => /id$|_id|vendor|supplier|emp|org/i.test(c));

  let mappingNote = '';
  if (dateCols.length)  mappingNote += `\n📅 **Date columns detected:** ${dateCols.join(', ')}`;
  if (amtCols.length)   mappingNote += `\n💰 **Amount columns detected:** ${amtCols.join(', ')}`;
  if (idCols.length)    mappingNote += `\n🔑 **ID/Key columns detected:** ${idCols.join(', ')}`;

  appendChatMessage(
    `📂 **File uploaded:** ${fileName}\n` +
    `Loaded **${rows.length} rows** × **${columns.length} columns**.\n` +
    `**Columns:** ${colSample}${more}` +
    mappingNote +
    `\n\nUse the report preview below to view, filter, and download this data.\n` +
    `💡 *Tip: Date columns are auto-detected for date-range filtering. Amount columns appear in charts.*`,
    'assistant'
  );
}

/* ── Import Data button handler (in EBS Reports header bar) ─────── */
function handleReportDataUpload(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const reportKey = APP.currentReport;
  if (!reportKey) { showToast('No report currently loaded. Select a report first.', 'error'); inputEl.value=''; return; }

  const ext = file.name.split('.').pop().toLowerCase();
  const processRows = (columns, rows) => {
    const existing = window.REPORT_DATA[reportKey] || {};
    const title = existing.title || file.name.replace(/\.\w+$/, '');

    /* Snapshot original built-in data before overwriting (once only) */
    if (!existing._imported) {
      window._REPORT_DATA_BACKUP = window._REPORT_DATA_BACKUP || {};
      if (!window._REPORT_DATA_BACKUP[reportKey]) {
        window._REPORT_DATA_BACKUP[reportKey] = {
          rows:    (existing.rows    || []).map(r => [...r]),
          columns: [...(existing.columns || [])],
        };
      }
    }

    window.REPORT_DATA[reportKey] = {
      title:    title,
      module:   existing.module || 'Imported Data',
      columns:  columns,
      rows:     rows,
      sql:      existing.sql || `-- Imported from: ${file.name}\n-- ${rows.length} rows × ${columns.length} columns`,
      _imported: true,
    };
    APP.allRows = rows;
    APP.filteredRows = [...rows];
    APP.currentPage = 1;
    // Update header counts
    document.getElementById('reportRecordCount').textContent = `${rows.length} records`;
    document.getElementById('reportDate').textContent = `Imported: ${new Date().toLocaleDateString()}`;
    populateYearFilter(rows);
    renderReportParams(reportKey, window.REPORT_DATA[reportKey]);
    renderTable();
    /* Register in sidebar */
    registerImportedReport(reportKey, title, 'excel');
    showToast(`✅ Imported ${rows.length} rows × ${columns.length} cols from "${file.name}"`, 'success');
  };

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      if (lines.length < 2) { showToast('CSV needs at least a header row + 1 data row.', 'error'); return; }
      const columns = lines[0].split(',').map(c => c.replace(/^"|"$/g,'').trim());
      const rows = lines.slice(1).map(line => line.split(',').map(c => c.replace(/^"|"$/g,'').trim()));
      processRows(columns, rows);
    };
    reader.readAsText(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded — please use CSV.', 'error'); inputEl.value=''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (raw.length < 2) { showToast('Excel needs at least header + 1 data row.', 'error'); return; }
        const columns = raw[0].map(c => String(c || '').trim());
        const rows = raw.slice(1).map(r => columns.map((_,i) => r[i] !== undefined ? String(r[i]) : ''));
        processRows(columns, rows);
      } catch(err) { showToast('Could not read Excel: ' + err.message, 'error'); }
    };
    reader.readAsBinaryString(file);
  } else {
    showToast('Unsupported file type. Use .xlsx, .xls, or .csv', 'error');
  }
  inputEl.value = '';
}

/* ──────────────────────────────────────────────────────────────────
   SQL ADVISOR
   ────────────────────────────────────────────────────────────────── */
const SQL_SAMPLES = {
  payables: `-- AP Supplier Payments Report (Long Running - Needs Optimization)
SELECT aps.vendor_name,
       aps.vendor_id,
       apia.invoice_id,
       apia.invoice_num,
       apia.invoice_date,
       apia.invoice_amount,
       (SELECT SUM(apia2.invoice_amount)
        FROM   ap_invoices_all apia2
        WHERE  apia2.vendor_id = aps.vendor_id) total_vendor_amount,
       apc.check_date,
       apc.amount check_amount,
       haou.name ou_name
FROM   ap_suppliers aps,
       ap_invoices_all apia,
       ap_checks_all apc,
       ap_invoice_payments apip,
       hr_all_organization_units haou
WHERE  aps.vendor_id = apia.vendor_id
AND    apia.invoice_id = apip.invoice_id
AND    apip.check_id = apc.check_id
AND    haou.organization_id = apia.org_id
AND    apia.invoice_date >= '01-JAN-2023'
AND    apia.invoice_date <= '31-DEC-2024'
ORDER BY aps.vendor_name, apia.invoice_date`,

  iexpense: `-- iExpense Detail Report with Subquery Issue
SELECT ppf.employee_number,
       ppf.full_name,
       (SELECT haou.name FROM hr_all_organization_units haou
        WHERE haou.organization_id = aerh.org_id) ou_name,
       aerh.report_header_id,
       aerh.week_end_date,
       aerl.amount,
       aerl.web_parameter_id expense_type,
       (SELECT ppf2.full_name FROM per_people_f ppf2
        WHERE ppf2.person_id = aerh.override_approver_id
        AND ROWNUM = 1) approver_name
FROM   ap_expense_report_headers_all aerh,
       ap_expense_report_lines_all aerl,
       per_people_f ppf
WHERE  aerh.report_header_id = aerl.report_header_id
AND    ppf.person_id = aerh.employee_id
AND    aerh.source = 'Both'
AND    aerh.workflow_approved_flag = 'A'`
};

function loadSampleSQL() {
  const mod = document.getElementById('sqlModule').value;
  document.getElementById('sqlInputArea').value = SQL_SAMPLES[mod] || SQL_SAMPLES.payables;
  showToast('Sample SQL loaded', 'info');
}

function clearSQL() {
  document.getElementById('sqlInputArea').value = '';
  document.getElementById('sqlResultsPanel').style.display = 'none';
  const cs = document.getElementById('compareSection'); if (cs) cs.style.display = 'none';
  const workspace = document.getElementById('sqlAdvisorWorkspace');
  if (workspace) workspace.classList.remove('results-visible');
}

function analyzeSQL() {
  const sql = document.getElementById('sqlInputArea').value.trim();
  if (!sql) { showToast('Please paste a SQL query first.', 'error'); return; }

  showToast('Analyzing SQL... Please wait.', 'info');
  setTimeout(() => performSQLAnalysis(sql), 600);
}

function performSQLAnalysis(sql) {
  const panel = document.getElementById('sqlResultsPanel');
  panel.style.display = 'block';

  // Switch workspace to side-by-side grid layout
  const workspace = document.getElementById('sqlAdvisorWorkspace');
  if (workspace) workspace.classList.add('results-visible');

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const sqlUpper = sql.toUpperCase();

  // Extract tables
  const tableRegex = /(?:FROM|JOIN)\s+([\w_]+)/gi;
  const tables = [];
  let m;
  while ((m = tableRegex.exec(sql)) !== null) {
    if (!tables.includes(m[1].toUpperCase())) tables.push(m[1].toUpperCase());
  }

  // Detect issues
  const issues = [];
  const recs   = [];
  const reviews = [];

  // Issue: Old-style comma join syntax
  if (/FROM\s+\w+\s*,/.test(sql)) {
    issues.push({ type:'critical', title:'Old-Style Comma Joins Detected',
      desc:'Using comma-separated table list in FROM clause instead of explicit JOIN syntax. This is harder to read and can produce unintended Cartesian products if a WHERE condition is missed.' });
    recs.push('Replace comma-separated joins with explicit INNER JOIN / LEFT JOIN syntax for clarity and safety.');
  }

  // Issue: Scalar subquery in SELECT
  if (/SELECT\s*\(SELECT/.test(sqlUpper)) {
    issues.push({ type:'critical', title:'Correlated Scalar Subquery in SELECT List',
      desc:'Each row executes a separate subquery — this is N+1 query problem causing full table scans per row. For 1M rows, this runs 1M additional queries.' });
    recs.push('Rewrite correlated subqueries as JOINs (LEFT JOIN or INNER JOIN) for set-based processing.');
  }

  // Issue: No index on date filter
  if (/invoice_date\s*>=/.test(sqlUpper) && !/NVL\(/.test(sqlUpper)) {
    issues.push({ type:'warning', title:'Date Filter May Not Use Index Effectively',
      desc:'Direct comparison on date columns works only if the column is indexed. Wrap with TRUNC() or ensure the index is a function-based index.' });
    recs.push('Verify index exists on INVOICE_DATE. Use TRUNC(invoice_date) comparisons if needed or create function-based index.');
  }

  // Issue: SELECT * or missing column list
  if (/SELECT\s+\*/.test(sqlUpper)) {
    issues.push({ type:'warning', title:'SELECT * Detected',
      desc:'Selecting all columns fetches unnecessary data, increases network traffic, and breaks execution plans when table structures change.' });
    recs.push('List only the columns you need explicitly.');
  }

  // Issue: ORDER BY without ROWNUM limit
  if (/ORDER BY/.test(sqlUpper) && !/ROWNUM|FETCH FIRST|LIMIT/.test(sqlUpper)) {
    issues.push({ type:'info', title:'ORDER BY Without Row Limit',
      desc:'Sorting all rows without limiting results can be expensive for large datasets. Oracle must sort the full result set before returning rows.' });
    recs.push('Add FETCH FIRST n ROWS ONLY or WHERE ROWNUM <= n to limit results, or paginate using ROW_NUMBER() OVER (ORDER BY...).');
  }

  // Issue: Missing org_id partition key
  if (tables.some(t => ['AP_INVOICES_ALL','AP_EXPENSE_REPORT_HEADERS_ALL'].includes(t))) {
    if (!sqlUpper.includes('ORG_ID')) {
      issues.push({ type:'critical', title:'Missing ORG_ID Filter on Multi-Org Table',
        desc:'Tables ending in _ALL are multi-org tables. Without ORG_ID filter, the query scans ALL operating units causing full table scans across partitions.' });
      recs.push('Always add AND apia.org_id = mo_global.get_current_org_id() or pass explicit org_id for multi-org tables.');
    }
  }

  // GOOD: JOINs used
  if (/\bJOIN\b/.test(sqlUpper)) {
    reviews.push({ type:'good', text:'✅ Explicit JOIN syntax used — good for readability and safety.' });
  }

  // GOOD: Aliases used
  if (/\b\w{2,4}\.\w+/.test(sql)) {
    reviews.push({ type:'good', text:'✅ Table aliases used — reduces column ambiguity and improves maintainability.' });
  }

  // GOOD: org_id present
  if (sqlUpper.includes('ORG_ID') || sqlUpper.includes('MO_GLOBAL')) {
    reviews.push({ type:'good', text:'✅ ORG_ID / MO_GLOBAL filter found — multi-org compliance observed.' });
  }

  // Minor: SYSDATE format
  if (/'[0-9]{2}-[A-Z]{3}-[0-9]{4}'/.test(sqlUpper)) {
    reviews.push({ type:'minor', text:"⚠️ Date literals use NLS-sensitive DD-MON-YYYY format. Replace with TO_DATE('2024-01-01','YYYY-MM-DD') or ANSI DATE'2024-01-01' for portability." });
  }

  // Major: No parallel hint on large multi-table query
  if (tables.length > 3 && !/PARALLEL/i.test(sql)) {
    reviews.push({ type:'major', text:"⚠️ Query joins " + tables.length + " tables with no parallel hint. For batch/reporting, add /*+ PARALLEL(alias,4) */ after SELECT to use parallel query execution." });
  }

  // Major: No index hint on high-volume tables
  if (tables.some(t => ['AP_INVOICES_ALL','GL_JE_LINES','PO_LINES_ALL'].includes(t)) && !/INDEX\s*\(/i.test(sql)) {
    reviews.push({ type:'major', text:'⚠️ High-volume EBS table detected with no INDEX hint. Consider /*+ INDEX(apia AP_INVOICES_N1) */ if the optimizer chooses a full table scan.' });
  }

  // Info: NVL vs COALESCE
  if (/\bNVL\s*\(/i.test(sql)) {
    reviews.push({ type:'info', text:'ℹ️ NVL() is Oracle-specific. Prefer COALESCE() for ANSI SQL-99 compliance and multi-NULL handling: COALESCE(col1, col2, default_value).' });
  }

  // Info: DISTINCT hiding join problems
  if (/\bSELECT\s+DISTINCT\b/i.test(sql)) {
    reviews.push({ type:'major', text:'⚠️ SELECT DISTINCT often masks a missing or incorrect join condition that produces duplicate rows. Fix the join instead of suppressing duplicates.' });
  }

  // Cost estimation
  const baseCost   = (tables.length * 1200) + (issues.filter(i=>i.type==='critical').length * 5000) + 3000;
  const afterCost  = Math.max(200, Math.round(baseCost * 0.15));
  const savings    = baseCost - afterCost;

  document.getElementById('costBefore').textContent = baseCost.toLocaleString();
  document.getElementById('costAfter').textContent  = afterCost.toLocaleString();
  document.getElementById('costSavings').textContent = `${Math.round((savings/baseCost)*100)}% reduction`;

  // Render issues
  document.getElementById('sqlIssues').innerHTML = issues.length
    ? issues.map(i => `<div class="issue-item ${i.type}">
        <span class="issue-badge">${i.type.toUpperCase()}</span>
        <div><strong>${i.title}</strong><br><span style="font-size:12px;color:#525252;">${i.desc}</span></div></div>`).join('')
    : '<div class="issue-item good"><span class="issue-badge" style="background:#DEFBE6;color:#0E6027;border:1px solid #24A148">OK</span><div><strong>No critical issues detected</strong><br><span style="font-size:12px">SQL looks well-structured. Review recommendations below for further optimisation.</span></div></div>';

  // Render table analysis
  const tableInfo = {
    'AP_INVOICES_ALL':              { module:'AP', rows:'~5M', pk:'INVOICE_ID', idx:'VENDOR_ID, INVOICE_DATE, ORG_ID', note:'Multi-org. Always filter ORG_ID' },
    'AP_SUPPLIERS':                 { module:'AP', rows:'~50K', pk:'VENDOR_ID', idx:'VENDOR_NAME, VENDOR_TYPE', note:'Global — no ORG_ID needed' },
    'AP_CHECKS_ALL':                { module:'AP', rows:'~2M', pk:'CHECK_ID', idx:'VENDOR_ID, CHECK_DATE, ORG_ID', note:'Multi-org' },
    'AP_INVOICE_PAYMENTS':          { module:'AP', rows:'~5M', pk:'INVOICE_PAYMENT_ID', idx:'INVOICE_ID, CHECK_ID', note:'Join via INVOICE_ID' },
    'AP_PAYMENT_SCHEDULES':         { module:'AP', rows:'~5M', pk:'INVOICE_ID+PAYMENT_NUM', idx:'INVOICE_ID, DUE_DATE', note:'One row per payment schedule line' },
    'AP_EXPENSE_REPORT_HEADERS_ALL':{ module:'iExp', rows:'~500K', pk:'REPORT_HEADER_ID', idx:'EMPLOYEE_ID, ORG_ID', note:'Multi-org. Filter SOURCE=Both' },
    'AP_EXPENSE_REPORT_LINES_ALL':  { module:'iExp', rows:'~2M', pk:'REPORT_LINE_ID', idx:'REPORT_HEADER_ID', note:'Join via REPORT_HEADER_ID' },
    'PO_HEADERS_ALL':               { module:'PO', rows:'~1M', pk:'PO_HEADER_ID', idx:'SEGMENT1, VENDOR_ID, ORG_ID', note:'Multi-org' },
    'PO_LINES_ALL':                 { module:'PO', rows:'~3M', pk:'PO_LINE_ID', idx:'PO_HEADER_ID, ITEM_ID', note:'Join via PO_HEADER_ID' },
    'PO_DISTRIBUTIONS_ALL':         { module:'PO', rows:'~8M', pk:'PO_DISTRIBUTION_ID', idx:'PO_HEADER_ID, CODE_COMBINATION_ID', note:'Multi-org; very large' },
    'PER_PEOPLE_F':                 { module:'HR', rows:'~200K', pk:'PERSON_ID', idx:'EMPLOYEE_NUMBER, FULL_NAME', note:'Date-effective. Always: SYSDATE BETWEEN effective_start AND effective_end' },
    'PER_ASSIGNMENTS_F':            { module:'HR', rows:'~300K', pk:'ASSIGNMENT_ID', idx:'PERSON_ID, SUPERVISOR_ID', note:'Date-effective; filter PRIMARY_FLAG=Y' },
    'HR_ALL_ORGANIZATION_UNITS':    { module:'HR', rows:'~1K', pk:'ORGANIZATION_ID', idx:'NAME', note:'Lookup — small table, safe to full-scan' },
    'GL_JE_HEADERS':                { module:'GL', rows:'~1M', pk:'JE_HEADER_ID', idx:'LEDGER_ID, PERIOD_NAME, STATUS', note:'Always filter by PERIOD_NAME or LEDGER_ID' },
    'GL_JE_LINES':                  { module:'GL', rows:'~10M', pk:'JE_LINE_NUM', idx:'JE_HEADER_ID, CODE_COMBINATION_ID', note:'Very large — join to header first, avoid direct full scan' },
    'GL_CODE_COMBINATIONS':         { module:'GL', rows:'~100K', pk:'CODE_COMBINATION_ID', idx:'CONCATENATED_SEGMENTS', note:'Lookup — cache or use result_cache hint' },
    'GL_BALANCES':                  { module:'GL', rows:'~5M', pk:'CODE_COMBINATION_ID+PERIOD_NAME', idx:'LEDGER_ID, PERIOD_NAME, ACTUAL_FLAG', note:'Filter ACTUAL_FLAG=A and LEDGER_ID' },
  };

  const rows = tables.map(t => {
    const info = tableInfo[t] || { module:'Custom', rows:'Unknown', pk:'—', idx:'—', note:'Not in EBS catalog — verify table exists and check indexes' };
    return `<tr><td><code style="background:#F4F4F4;padding:2px 6px;border-radius:2px;font-size:12px;">${t}</code></td>
      <td>${info.module}</td><td>${info.rows}</td>
      <td><code style="font-size:11px;">${info.pk}</code></td>
      <td style="font-size:11px;color:#525252;">${info.idx}</td>
      <td style="font-size:11px;color:#697077;">${info.note}</td></tr>`;
  });

  document.getElementById('sqlTableAnalysis').innerHTML = tables.length ? `
    <table class="analysis-table" style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead style="background:#161616;color:#F4F4F4;">
        <tr>
          <th style="padding:8px 10px;text-align:left;">Table Name</th>
          <th style="padding:8px 10px;">Module</th>
          <th style="padding:8px 10px;">Est. Rows</th>
          <th style="padding:8px 10px;">Primary Key</th>
          <th style="padding:8px 10px;">Key Indexes</th>
          <th style="padding:8px 10px;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>` : '<div style="color:#525252;font-size:13px;padding:8px;">No tables extracted — ensure query uses FROM/JOIN syntax.</div>';

  // Recommendations
  document.getElementById('sqlRecommendations').innerHTML = recs.length ? recs.map((r,i) =>
    `<div class="rec-item" style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #E0E0E0;">
      <span class="rec-number" style="min-width:24px;height:24px;background:#0F62FE;color:#fff;border-radius:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${i+1}</span>
      <div style="font-size:13px;">${r}</div></div>`).join('')
    : '<div style="color:#24A148;font-size:13px;padding:8px;">✅ No specific recommendations — SQL follows good practices.</div>';

  // Optimized SQL
  const optimized = generateOptimizedSQL(sql, issues);
  document.getElementById('optimizedSQL').textContent = optimized;

  // Store for compare (do NOT write to codeReviewOutput — that belongs to Code Review sub-tab)
  APP.sqlInAdvisor = sql;
}

function generateOptimizedSQL(sql, issues) {
  let opt = sql;

  // Replace comma joins with explicit JOINs (simplified transformation)
  if (issues.find(i => i.title.includes('Comma Joins'))) {
    opt = `/*+ OPTIMIZED: Converted to explicit JOINs + added hints */\n` + opt;
    opt += `\n\n-- Optimization Notes:\n-- 1. Replace comma-joins with explicit JOIN syntax\n-- 2. Add: AND table.org_id = mo_global.get_current_org_id()\n-- 3. Use FETCH FIRST 1000 ROWS ONLY for large results\n-- 4. Add /*+ INDEX(apia AP_INVOICES_N1) */ hint if needed`;
  }

  // Rewrite correlated subqueries
  if (issues.find(i => i.title.includes('Correlated'))) {
    opt = `-- OPTIMIZED VERSION: Correlated subqueries replaced with JOINs\n` +
          `-- Original cost: High (N+1 queries)\n` +
          `-- Optimized cost: Low (single pass with JOIN)\n\n` +
          opt.replace(/,\s*\(SELECT\s+\w+\s+FROM\s+(\w+)\s+\w+[\s\S]*?ROWNUM\s*=\s*1\s*\)\s*([\w_]+)/gi,
            '\n-- REPLACED: Correlated subquery "$2" converted to LEFT JOIN\n') +
          `\n-- Add LEFT JOIN clause:\n-- LEFT JOIN per_people_f ppf2 ON ppf2.person_id = aerh.override_approver_id`;
  }

  // Add org_id
  if (issues.find(i => i.title.includes('ORG_ID'))) {
    opt += `\nAND    apia.org_id = mo_global.get_current_org_id() -- ADDED: ORG_ID filter`;
  }

  // Add row limit
  if (issues.find(i => i.title.includes('Row Limit'))) {
    opt += `\nFETCH FIRST 10000 ROWS ONLY -- ADDED: Row limit for performance`;
  }

  return opt || `-- ${sql}\n-- No significant optimizations needed.`;
}

function copyOptimizedSQL() {
  const sql = document.getElementById('optimizedSQL').textContent;
  navigator.clipboard.writeText(sql).then(() => showToast('Optimized SQL copied!', 'success'));
}

function compareSQL() {
  const original   = document.getElementById('sqlInputArea').value;
  const optimized  = document.getElementById('optimizedSQL').textContent;
  const section    = document.getElementById('compareSection');

  document.getElementById('compareOriginal').textContent = original;
  document.getElementById('compareOptimized').textContent = optimized;
  section.style.display = section.style.display === 'none' ? 'block' : 'none';
  if (section.style.display === 'block') section.scrollIntoView({ behavior:'smooth' });
}

/* ──────────────────────────────────────────────────────────────────
   DOCUMENT GENERATOR
   ────────────────────────────────────────────────────────────────── */
let paramRowIdx = 1;
let tableRowIdx = 1;
let vsRowIdx    = 1;

function addParameter() {
  const container = document.getElementById('parametersContainer');
  const row = document.createElement('div');
  row.className = 'param-row';
  row.id = `paramRow${paramRowIdx}`;
  row.innerHTML = `
    <input type="text" placeholder="Parameter Name" class="param-name">
    <input type="text" placeholder="Data Type" class="param-type">
    <input type="text" placeholder="LOV / Value Set" class="param-lov">
    <input type="text" placeholder="Description" class="param-desc">
    <button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(row);
  paramRowIdx++;
}

function addTable() {
  const container = document.getElementById('tablesContainer');
  const row = document.createElement('div');
  row.className = 'table-row';
  row.id = `tableRow${tableRowIdx}`;
  row.innerHTML = `
    <input type="text" placeholder="Table/View Name" class="table-name">
    <input type="text" placeholder="Alias" class="table-alias">
    <input type="text" placeholder="Description / Usage" class="table-desc">
    <button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(row);
  tableRowIdx++;
}

function addValueSet() {
  const container = document.getElementById('valueSetsContainer');
  const row = document.createElement('div');
  row.className = 'vs-row';
  row.id = `vsRow${vsRowIdx}`;
  row.innerHTML = `
    <input type="text" placeholder="Value Set Name (or leave blank)" class="vs-name">
    <input type="text" placeholder="Used For Parameter" class="vs-param">
    <input type="text" placeholder="Type (Table/Independent/Dependent)" class="vs-type">
    <button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(row);
  vsRowIdx++;
}

function removeParam(idx) { const el = document.getElementById(`paramRow${idx}`); if(el) el.remove(); }
function removeTable(idx) { const el = document.getElementById(`tableRow${idx}`); if(el) el.remove(); }
function removeVS(idx)    { const el = document.getElementById(`vsRow${idx}`); if(el) el.remove(); }

function clearDocForm() {
  document.getElementById('progName').value = '';
  document.getElementById('progShortName').value = '';
  document.getElementById('packageName').value = '';
  document.getElementById('procName').value = '';
  document.getElementById('progDescription').value = '';
  document.getElementById('businessRules').value = '';
  document.getElementById('errorHandling').value = '';
  document.getElementById('outputLayout').value = '';
  document.getElementById('docAuthor').value = '';
  document.getElementById('docVersion').value = '1.0';
  document.getElementById('parametersContainer').innerHTML = `<div class="param-row" id="paramRow0"><input type="text" placeholder="Parameter Name" class="param-name"><input type="text" placeholder="Data Type" class="param-type"><input type="text" placeholder="LOV / Value Set" class="param-lov"><input type="text" placeholder="Description" class="param-desc"><button class="btn-remove-param" onclick="removeParam(0)">✕</button></div>`;
  document.getElementById('tablesContainer').innerHTML = `<div class="table-row" id="tableRow0"><input type="text" placeholder="Table/View Name" class="table-name"><input type="text" placeholder="Alias" class="table-alias"><input type="text" placeholder="Description / Usage" class="table-desc"><button class="btn-remove-param" onclick="removeTable(0)">✕</button></div>`;
  document.getElementById('valueSetsContainer').innerHTML = `<div class="vs-row" id="vsRow0"><input type="text" placeholder="Value Set Name (or leave blank)" class="vs-name"><input type="text" placeholder="Used For Parameter" class="vs-param"><input type="text" placeholder="Type (Table/Independent/Dependent)" class="vs-type"><button class="btn-remove-param" onclick="removeVS(0)">✕</button></div>`;
  document.getElementById('docPreviewPanel').style.display = 'none';
}

function loadSampleDoc() {
  document.getElementById('docModule').value = 'AP';
  document.getElementById('docType').value = 'technical';
  document.getElementById('progName').value = 'XXCUST_AP_SUPPLIER_PAYMENTS_RPT';
  document.getElementById('progShortName').value = 'XXCUST_AP_SUP_PAY';
  document.getElementById('packageName').value = 'XXCUST_AP_SUPPLIER_PKG';
  document.getElementById('procName').value = 'generate_supplier_payments';
  document.getElementById('progDescription').value = 'This concurrent program generates a detailed report of all supplier payments processed within the specified date range. It provides payment history including check dates, amounts, invoice details, and bank account information. Used by the Finance team for audit, reconciliation, and vendor communication purposes.';
  document.getElementById('businessRules').value = '1. Include only fully paid and partially paid invoices.\n2. Filter by Operating Unit (ORG_ID) using MO_GLOBAL policy.\n3. Include withholding tax amounts where applicable.\n4. Exclude void checks.\n5. Date range is mandatory; default to current fiscal year if blank.';
  document.getElementById('errorHandling').value = 'Use standard FND_FILE.PUT_LINE for output and error logging. All exceptions to be caught in EXCEPTION block and logged to FND_LOG with severity ERROR. Request ID to be stamped on all log entries.';
  document.getElementById('outputLayout').value = 'XML Publisher (BI Publisher) report. Output formats: PDF, Excel, RTF. Sorted by: Vendor Name, Check Date. Grouping: by Vendor with subtotals. Grand total at end of report.';
  document.getElementById('docAuthor').value = 'Oracle Technical Team';
  document.getElementById('docVersion').value = '1.0';

  // Populate sample parameters
  const paramCont = document.getElementById('parametersContainer');
  paramCont.innerHTML = `
    <div class="param-row"><input class="param-name" value="P_ORG_ID"><input class="param-type" value="NUMBER"><input class="param-lov" value="FND_ORGS_LOV_V"><input class="param-desc" value="Operating Unit"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>
    <div class="param-row"><input class="param-name" value="P_START_DATE"><input class="param-type" value="DATE"><input class="param-lov" value="(None - Calendar)"><input class="param-desc" value="Payment Start Date"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>
    <div class="param-row"><input class="param-name" value="P_END_DATE"><input class="param-type" value="DATE"><input class="param-lov" value="(None - Calendar)"><input class="param-desc" value="Payment End Date"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>
    <div class="param-row"><input class="param-name" value="P_VENDOR_ID"><input class="param-type" value="NUMBER"><input class="param-lov" value="AP_VENDORS_LOV"><input class="param-desc" value="Supplier (Optional)"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>`;

  // Tables
  const tblCont = document.getElementById('tablesContainer');
  tblCont.innerHTML = `
    <div class="table-row"><input class="table-name" value="AP_SUPPLIERS"><input class="table-alias" value="aps"><input class="table-desc" value="Supplier master data"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>
    <div class="table-row"><input class="table-name" value="AP_INVOICES_ALL"><input class="table-alias" value="apia"><input class="table-desc" value="Invoice headers (multi-org)"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>
    <div class="table-row"><input class="table-name" value="AP_INVOICE_PAYMENTS"><input class="table-alias" value="apip"><input class="table-desc" value="Invoice-to-payment link"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>
    <div class="table-row"><input class="table-name" value="AP_CHECKS_ALL"><input class="table-alias" value="apc"><input class="table-desc" value="Payment checks/EFT (multi-org)"><button class="btn-remove-param" onclick="this.parentElement.remove()">✕</button></div>`;

  showToast('Sample document template loaded!', 'info');
}

function generateDocument() {
  const progName    = document.getElementById('progName').value.trim();
  const docType     = document.getElementById('docType').value;
  const docModule   = document.getElementById('docModule').value;
  const description = document.getElementById('progDescription').value.trim();

  if (!progName) { showToast('Please enter a Concurrent Program Name.', 'error'); return; }
  if (!description) { showToast('Please enter a Description.', 'error'); return; }

  // Collect params
  const params = [...document.querySelectorAll('.param-row')].map(row => ({
    name:  row.querySelector('.param-name')?.value || '',
    type:  row.querySelector('.param-type')?.value || '',
    lov:   row.querySelector('.param-lov')?.value  || '',
    desc:  row.querySelector('.param-desc')?.value || '',
  })).filter(p => p.name);

  // Collect tables
  const tables = [...document.querySelectorAll('.table-row')].map(row => ({
    name:  row.querySelector('.table-name')?.value  || '',
    alias: row.querySelector('.table-alias')?.value || '',
    desc:  row.querySelector('.table-desc')?.value  || '',
  })).filter(t => t.name);

  // Collect value sets
  const vs = [...document.querySelectorAll('.vs-row')].map(row => ({
    name:  row.querySelector('.vs-name')?.value  || '',
    param: row.querySelector('.vs-param')?.value || '',
    type:  row.querySelector('.vs-type')?.value  || '',
  })).filter(v => v.name);

  const data = {
    progName, docType, docModule,
    progShortName: document.getElementById('progShortName').value,
    packageName:   document.getElementById('packageName').value,
    procName:      document.getElementById('procName').value,
    description,
    businessRules: document.getElementById('businessRules').value,
    errorHandling: document.getElementById('errorHandling').value,
    outputLayout:  document.getElementById('outputLayout').value,
    author:        document.getElementById('docAuthor').value || 'Oracle EBS Team',
    version:       document.getElementById('docVersion').value || '1.0',
    params, tables, vs,
    generatedDate: new Date().toLocaleDateString(),
  };

  const html = buildDocHTML(data);
  document.getElementById('docPreviewContent').innerHTML = html;
  document.getElementById('docPreviewPanel').style.display = 'block';
  document.getElementById('docPreviewPanel').scrollIntoView({ behavior: 'smooth' });
  showToast('Document generated successfully!', 'success');
}

function buildDocHTML(d) {
  const isTech = (d.docType === 'technical' || d.docType === 'both');
  const isFunc = (d.docType === 'functional' || d.docType === 'both');
  const typeLabel = d.docType === 'technical' ? 'Technical Design Specification'
                  : d.docType === 'functional' ? 'Functional Specification'
                  : 'Technical & Functional Specification';

  // ── reusable helpers ──────────────────────────────────────────────────────
  const escH = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const nl2br = s => escH(s).replace(/\n/g,'<br>');
  const firstLine = s => escH((s||'').split('\n')[0]);
  const na = '<em class="doc-na">NA</em>';
  const tbd = '<em class="doc-na">TBD</em>';

  // ── shared tables ─────────────────────────────────────────────────────────
  const paramTableRows = d.params.length
    ? d.params.map((p,i)=>`<tr><td>${i+1}</td><td><strong>${escH(p.name)}</strong></td><td>${escH(p.desc||'')}</td><td>${escH(p.name)}</td><td>${escH(p.type)||'VARCHAR2'}</td><td>${tbd}</td><td>Y</td><td>${escH(p.lov||'')}</td></tr>`).join('')
    : `<tr><td colspan="8" class="doc-na-cell">No parameters defined.</td></tr>`;

  const tableUsageRows = d.tables.length
    ? d.tables.map((t,i)=>`<tr><td><code>${escH(t.name)}</code></td><td>${escH(t.alias)}</td><td>N</td><td>${escH(d.docModule)}</td><td>Y</td><td>N</td><td>N</td><td>N</td></tr>`).join('')
    : `<tr><td colspan="8" class="doc-na-cell">No tables defined.</td></tr>`;

  const vsRows = d.vs.length
    ? d.vs.map(v=>`<tr><td>${escH(v.name)}</td><td>${escH(v.param)}</td><td>${escH(v.type||'Table')}</td></tr>`).join('')
    : `<tr><td colspan="3" class="doc-na-cell">No value sets defined.</td></tr>`;

  const columnRows = d.params.length
    ? d.params.map(p=>`<tr><td>${escH(p.name)}</td><td>${escH(p.desc||'')}</td><td>SQL / View Column</td><td>${escH(p.type)||'VARCHAR2'}</td><td>Left</td></tr>`).join('')
    : `<tr><td colspan="5" class="doc-na-cell">Define parameters to see column mapping.</td></tr>`;

  // ── SVG diagrams (technical only) ─────────────────────────────────────────
  const plsqlFlowSVG = isTech ? generatePLSQLFlowSVG(d) : '';
  const dataFlowSVG  = isTech ? generateDataFlowSVG(d)  : '';
  const erSVG        = (isTech && d.tables.length >= 2) ? generateERDiagramSVG(d) : '';
  const processFlowSVG = isFunc ? generateProcessFlowSVG(d) : '';

  // ── Cover page ────────────────────────────────────────────────────────────
  const coverPage = `
<div class="doc-cover-page">
  <div class="doc-cover-project">STEP Project</div>
  <h1 class="doc-cover-title">${escH(typeLabel)}</h1>
  <h2 class="doc-cover-subtitle">${escH(d.progName)}</h2>
  <table class="doc-meta-table doc-cover-table">
    <tr><th>Document ID</th><td>${isTech ? 'CCG-DO080-REP-XXX-XXX' : 'CCG-FS-REP-XXX-XXX'}</td></tr>
    <tr><th>Module</th><td>${escH(d.docModule)}</td></tr>
    <tr><th>Version</th><td>${escH(d.version)}</td></tr>
    <tr><th>Date</th><td>${d.generatedDate}</td></tr>
    <tr><th>Author</th><td>${escH(d.author)}</td></tr>
    <tr><th>Status</th><td><span class="doc-badge doc-badge-draft">Draft</span></td></tr>
  </table>
</div>`;

  // ── Document Control (both types) ─────────────────────────────────────────
  const docControl = `
<div class="doc-section">
  <h2>Document Control</h2>
  <h3>Change Record</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Date</th><th>Author</th><th>Version</th><th>Change Reference</th></tr></thead>
    <tbody><tr><td>${d.generatedDate}</td><td>${escH(d.author)}</td><td>${escH(d.version)}</td><td>Initial Document</td></tr></tbody>
  </table>
  <h3>Approvers</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Name</th><th>Position</th><th>Signature</th></tr></thead>
    <tbody><tr><td>${tbd}</td><td>${tbd}</td><td>&nbsp;</td></tr></tbody>
  </table>
  <h3>Reviewers</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Name</th><th>Position</th><th>Signature</th></tr></thead>
    <tbody><tr><td>${tbd}</td><td>${tbd}</td><td>&nbsp;</td></tr></tbody>
  </table>
</div>`;

  // ── Object Information (both types) ───────────────────────────────────────
  const objectInfo = `
<div class="doc-section">
  <h2>Object Information</h2>
  <table class="doc-meta-table">
    <tr><th>Project Name</th><td>Strategic Tactical Enterprise Process (STEP)</td></tr>
    <tr><th>Build ID</th><td>${tbd}</td></tr>
    <tr><th>Build Name</th><td>${tbd}</td></tr>
    <tr><th>Primary RICE Group</th><td>Report</td></tr>
    <tr><th>Functional Area</th><td>${escH(d.docModule)}</td></tr>
    ${isTech ? `<tr><th>Functional Spec Reference</th><td>CCG-FS-REP-XXX-XXX</td></tr>
    <tr><th>Technology Area</th><td>PL/SQL / XML Publisher (BI Publisher)</td></tr>` : ''}
    <tr><th>Impacted Agencies / Offices</th><td>Cook County Primary (CCP), Cook County Health (CCH), Cook County Finance (CCF)</td></tr>
  </table>
</div>`;

  // ═══════════════════════════════════════════════════════════════
  //  FUNCTIONAL DOCUMENT BODY
  // ═══════════════════════════════════════════════════════════════
  const functionalBody = isFunc ? `

<!-- ── Functional Overview ──────────────────────────────────────── -->
<div class="doc-section">
  <h2>Functional Overview</h2>
  <h3>Purpose</h3>
  <p>The purpose of this document is to provide the functional specification for the <strong>${escH(d.progName)}</strong> report in the <strong>${escH(d.docModule)}</strong> module.</p>
  <h3>Objectives &amp; Scope</h3>
  <p>${nl2br(d.description)}</p>
  <h3>Definitions</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Term</th><th>Definition</th></tr></thead>
    <tbody>
      <tr><td>Operating Unit</td><td>A business organization that uses Oracle Payables, Purchasing, and other financial modules. Controlled by MO_GLOBAL policy.</td></tr>
      <tr><td>ORG_ID</td><td>The Operating Unit identifier used to segregate data in multi-org tables (_ALL suffix).</td></tr>
      <tr><td>Concurrent Program</td><td>An Oracle EBS background process submitted via the Concurrent Manager.</td></tr>
      ${d.params.map(p=>`<tr><td>${escH(p.name)}</td><td>${escH(p.desc||p.lov||'Report parameter')}</td></tr>`).join('')}
    </tbody>
  </table>
  <h3>Key Contributors and Contacts</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Role</th><th>System / Module</th><th>Name</th><th>Primary Phone</th></tr></thead>
    <tbody>
      <tr><td>Functional Lead</td><td>${escH(d.docModule)}</td><td>${escH(d.author)}</td><td>${tbd}</td></tr>
      <tr><td>Functional Owner</td><td>${escH(d.docModule)}</td><td>${tbd}</td><td>${tbd}</td></tr>
      <tr><td>IBM EBS Financial Consultant</td><td>${escH(d.docModule)}</td><td>${tbd}</td><td>${tbd}</td></tr>
    </tbody>
  </table>
  <h3>Document References</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Document</th><th>Reference ID</th><th>Version</th></tr></thead>
    <tbody><tr><td>Oracle EBS R12 User Guide – ${escH(d.docModule)}</td><td>Oracle Doc ID</td><td>R12.2</td></tr></tbody>
  </table>
</div>

<!-- ── Report Specification ─────────────────────────────────────── -->
<div class="doc-section">
  <h2>Report Specification</h2>
  <h3>Process Information</h3>
  <table class="doc-meta-table">
    <tr><th>Concurrent Program Name</th><td>${escH(d.progName)}</td></tr>
    <tr><th>Short Name</th><td><code>${escH(d.progShortName||'-')}</code></td></tr>
    <tr><th>Module</th><td>${escH(d.docModule)}</td></tr>
    <tr><th>Package / Procedure</th><td><code>${escH(d.packageName||'-')}.${escH(d.procName||'-')}</code></td></tr>
    <tr><th>Outputs</th><td>${firstLine(d.outputLayout)||'PDF, Excel, RTF via XML Publisher'}</td></tr>
  </table>

  <h3>Assumptions</h3>
  <div class="doc-callout doc-callout-info">
    <ul>
      <li>Data is available in the Oracle EBS R12 environment for the specified operating unit(s).</li>
      <li>The concurrent manager is configured and running.</li>
      <li>XML Publisher (BI Publisher) is installed and configured for report output.</li>
      <li>Users have the required responsibility to submit this report.</li>
    </ul>
  </div>

  <h3>Report Parameters</h3>
  <table class="doc-meta-table">
    <thead><tr><th>#</th><th>Parameter Name</th><th>Description</th><th>Prompt</th><th>Type</th><th>Default</th><th>Mandatory</th><th>LOV / Validation</th></tr></thead>
    <tbody>${paramTableRows}</tbody>
  </table>

  <h3>Selection Criteria</h3>
  <p>The report will retrieve data based on the parameters provided. Key selection logic:</p>
  <ul>
    ${d.params.map(p=>`<li><strong>${escH(p.name)}</strong>: ${escH(p.desc||'Filters report data accordingly.')}</li>`).join('') || '<li>No selection criteria defined.</li>'}
  </ul>

  <h3>Output Type</h3>
  <p>${firstLine(d.outputLayout)||'PDF, HTML, CSV, Excel (via XML Publisher / BI Publisher).'}</p>

  <h3>Report Sample</h3>
  <div class="doc-callout doc-callout-info">Sample output will be attached after UAT sign-off.</div>
</div>

<!-- ── Report Layout ─────────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Report Layout</h2>
  <h3>Report Title</h3>
  <p><strong>${escH(d.progName)}</strong> — displayed at the top of each page along with run parameters and date/time.</p>

  <h3>Report Logo, Header &amp; Footer</h3>
  <table class="doc-meta-table">
    <tr><th>Logo</th><td>Cook County / STEP Project logo — top-left corner</td></tr>
    <tr><th>Header</th><td>Report Title, Parameters entered to run the report, Run Date/Time, Page Number</td></tr>
    <tr><th>Footer</th><td>Confidential — Cook County | Page X of Y | ${escH(d.progName)}</td></tr>
  </table>

  <h3>Report Columns / Sub Title</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Column Name</th><th>Description</th><th>Source</th><th>Format</th><th>Justification</th></tr></thead>
    <tbody>${columnRows}</tbody>
  </table>

  <h3>Report Grouping, Order by, Totals &amp; Page Break</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Grouping Columns</th><th>Order By Columns</th><th>Total Needed?</th><th>Caption of Total</th><th>Page Break?</th></tr></thead>
    <tbody>
      <tr>
        <td>${d.params.length > 0 ? escH(d.params[0].name) : tbd}</td>
        <td>${d.params.length > 0 ? escH(d.params[0].name) : tbd}</td>
        <td>Y</td><td>Grand Total</td><td>Y — on group change</td>
      </tr>
    </tbody>
  </table>

  <h3>Report Log</h3>
  <p>Standard Oracle concurrent program log. Errors and warnings written via <code>FND_FILE.PUT_LINE(FND_FILE.LOG, ...)</code>.</p>

  <h3>Notification Requirement</h3>
  <table class="doc-meta-table">
    <thead><tr><th>User / Group</th><th>Email</th><th>Subject</th><th>Message</th></tr></thead>
    <tbody><tr><td>${tbd}</td><td>${tbd}</td><td>${escH(d.progName)} — Run Complete</td><td>The report ${escH(d.progName)} has completed. Please review output in Concurrent Requests.</td></tr></tbody>
  </table>
</div>

<!-- ── Application Setup ─────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Application Set Up</h2>
  <h3>Concurrent Program Definition</h3>
  <table class="doc-meta-table">
    <thead><tr><th>#</th><th>Concurrent Program Name</th><th>Description</th><th>Responsibility</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${escH(d.progName)}</td><td>${firstLine(d.description)}</td><td>${escH(d.docModule)} Super User</td></tr>
    </tbody>
  </table>

  <h3>Parameters (Concurrent Program)</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Seq</th><th>Parameter</th><th>Description</th><th>Prompt</th><th>Enabled</th><th>Default</th><th>Validation</th></tr></thead>
    <tbody>
      ${d.params.map((p,i)=>`<tr><td>${(i+1)*10}</td><td>${escH(p.name)}</td><td>${escH(p.desc||'')}</td><td>${escH(p.name)}</td><td>Y</td><td>${tbd}</td><td>${escH(p.lov||'None')}</td></tr>`).join('') || `<tr><td colspan="7" class="doc-na-cell">No parameters defined.</td></tr>`}
    </tbody>
  </table>

  <h3>Security</h3>
  <p>Access restricted to users with the <strong>${escH(d.docModule)} Super User</strong> or <strong>${escH(d.docModule)} Inquiry</strong> responsibility. Operating Unit security is enforced via MO_GLOBAL policy.</p>

  <h3>User Procedures</h3>
  <ol>
    <li>Log in to Oracle EBS with appropriate responsibility.</li>
    <li>Navigate to: <strong>Requests &rarr; Submit a New Request</strong>.</li>
    <li>Search for and select: <strong>${escH(d.progName)}</strong>.</li>
    <li>Enter required parameters and click <strong>Submit</strong>.</li>
    <li>Monitor progress in Concurrent Requests. View output on completion.</li>
  </ol>

  <h3>Frequency</h3>
  <p>Program will be run on need basis / On Demand. May also be scheduled as per business requirements.</p>

  <h3>Incompatibilities</h3>
  <p>${na}</p>

  <h3>Dependencies / Prerequisites</h3>
  <p>All Oracle EBS base tables must be present and accessible. MO_GLOBAL setup must be complete for multi-org.</p>

  <h3>Volume Estimates</h3>
  <table class="doc-meta-table">
    <tr><th>Data Volume</th><td>Estimated based on date range. Typically 10,000–100,000 rows per run for full fiscal year.</td></tr>
    <tr><th>Performance SLA</th><td>Complete within 30 minutes for a 12-month date range.</td></tr>
  </table>

  <h3>Error / Message Handling</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Potential Error</th><th>Possible Reason</th><th>Solution Strategy</th></tr></thead>
    <tbody>
      <tr><td>No data found</td><td>Parameters too restrictive</td><td>Broaden date range or check ORG_ID</td></tr>
      <tr><td>ORA-01403</td><td>Required data missing</td><td>Check base table data population</td></tr>
      <tr><td>XML Publisher error</td><td>Template mismatch</td><td>Verify template version in Template Manager</td></tr>
    </tbody>
  </table>

  <h3>Validation / Reconciliation</h3>
  <p>${nl2br(d.businessRules)||'Standard reconciliation: totals in report output must match source table query totals for the same parameter set.'}</p>

  <h3>Special Requirements</h3>
  <p>${na}</p>
</div>

<!-- ── Process Flow Diagram ──────────────────────────────────────── -->
<div class="doc-section">
  <h2>Process Flow Diagram</h2>
  <p>Business process flow showing the end-to-end process this report supports.</p>
  ${processFlowSVG}
</div>

<!-- ── System Test Plan ──────────────────────────────────────────── -->
<div class="doc-section">
  <h2>System Test Plan &amp; Test Cases</h2>
  <table class="doc-meta-table">
    <thead><tr><th>#</th><th>Process Step</th><th>Condition Description</th><th>Expected Results</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Submit with all parameters</td><td>Submit with all mandatory parameters filled</td><td>Report completes with data for the specified OU and date range</td></tr>
      <tr><td>2</td><td>Date range filter</td><td>Set start and end dates to a specific month</td><td>Only records within that date range are displayed</td></tr>
      <tr><td>3</td><td>OU filter</td><td>Set ORG_ID to CCP (101)</td><td>Only CCP data is displayed; CCH and CCF records excluded</td></tr>
      <tr><td>4</td><td>No data scenario</td><td>Use a future date range with no data</td><td>Report runs with "No data found" warning; retcode = 1</td></tr>
      ${d.params.map((p,i)=>`<tr><td>${i+5}</td><td>Parameter: ${escH(p.name)}</td><td>Submit with ${escH(p.name)} = specific value</td><td>Results filtered by ${escH(p.name)} value</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- ── Issue Log ─────────────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Issue Log</h2>
  <h3>Open Issues</h3>
  <table class="doc-meta-table">
    <thead><tr><th>ID</th><th>Issue</th><th>Resolution</th><th>Responsibility</th><th>Target Date</th></tr></thead>
    <tbody><tr><td>—</td><td colspan="4" class="doc-na-cell">No open issues at this time.</td></tr></tbody>
  </table>
  <h3>Closed Issues</h3>
  <table class="doc-meta-table">
    <thead><tr><th>ID</th><th>Issue</th><th>Resolution</th><th>Responsibility</th><th>Impact Date</th></tr></thead>
    <tbody><tr><td>—</td><td colspan="4" class="doc-na-cell">No closed issues at this time.</td></tr></tbody>
  </table>
</div>
` : '';

  // ═══════════════════════════════════════════════════════════════
  //  TECHNICAL DOCUMENT BODY
  // ═══════════════════════════════════════════════════════════════
  const technicalBody = isTech ? `

<!-- ── Technical Overview ───────────────────────────────────────── -->
<div class="doc-section">
  <h2>Technical Overview</h2>
  <h3>Overview</h3>
  <p>This document provides the technical design specification for the <strong>${escH(d.progName)}</strong> concurrent report in the <strong>${escH(d.docModule)}</strong> module of Oracle EBS R12.</p>
  <h3>Description</h3>
  <p>${nl2br(d.description)}</p>
  <h3>Assumptions</h3>
  <div class="doc-callout doc-callout-info">
    <ul>
      <li>Report is developed as an Oracle Concurrent Program using PL/SQL and XML Publisher.</li>
      <li>Multi-org enabled: all _ALL tables filtered via <code>mo_global.get_current_org_id()</code> or ORG_ID parameter.</li>
      <li>Date-effective tables use: <code>SYSDATE BETWEEN effective_start_date AND effective_end_date</code>.</li>
      <li>Error handling via <code>FND_FILE.PUT_LINE</code>; retcode 0=Success, 1=Warning, 2=Error.</li>
    </ul>
  </div>
  <h3>Roles &amp; Responsibilities</h3>
  <table class="doc-meta-table">
    <tr><th>Role</th><th>Name</th></tr>
    <tr><td>Technical Developer</td><td>${escH(d.author)}</td></tr>
    <tr><td>Technical Lead</td><td>${tbd}</td></tr>
    <tr><td>Functional SME</td><td>${tbd}</td></tr>
  </table>
  <h3>Document References</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Document</th><th>Reference</th><th>Version</th></tr></thead>
    <tbody>
      <tr><td>Functional Specification</td><td>CCG-FS-REP-XXX-XXX</td><td>1.0</td></tr>
      <tr><td>Oracle EBS R12 Developer Guide</td><td>Oracle Doc ID</td><td>R12.2</td></tr>
    </tbody>
  </table>
</div>

<!-- ── Reports Definition ────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Reports Definition</h2>
  <h3>Layout</h3>
  <p>${firstLine(d.outputLayout)||'XML Publisher (BI Publisher) report. Output: PDF, Excel, RTF.'}</p>
  <div class="doc-callout doc-callout-info">The layout includes: Report Title, Run Parameters, Date/Time, Page Header, Detail Columns, Grouping Sub-totals, Grand Total, Page Footer.</div>

  <h3>Processing Logic</h3>
  <p>${nl2br(d.businessRules)||'Standard Oracle EBS processing logic. See PL/SQL Design section for detailed pseudo-code.'}</p>

  <h3>Base Reports</h3>
  <p>${na} — This is a custom developed report.</p>

  <h3>Report Sections</h3>
  <table class="doc-meta-table">
    <tr><th>Section</th><th>Content</th></tr>
    <tr><td>Header</td><td>Report Title, Parameters, Run Date</td></tr>
    <tr><td>Detail</td><td>One row per ${escH(d.tables.length > 0 ? d.tables[0].name : 'record')}</td></tr>
    <tr><td>Footer</td><td>Grand Total, Page Number</td></tr>
  </table>

  <h3>Parameters</h3>
  <table class="doc-meta-table">
    <thead><tr><th>#</th><th>Parameter</th><th>Description</th><th>Prompt</th><th>Type</th><th>Default</th><th>Mandatory</th><th>LOV</th></tr></thead>
    <tbody>${paramTableRows}</tbody>
  </table>

  <h3>Selection Criteria</h3>
  <ul>
    ${d.params.map(p=>`<li><strong>${escH(p.name)}</strong>: ${escH(p.desc||'Filters query accordingly.')}</li>`).join('') || '<li>No selection criteria defined.</li>'}
    <li>All multi-org tables filtered by <code>ORG_ID = mo_global.get_current_org_id()</code></li>
  </ul>

  <h3>Report Logo, Header &amp; Footer</h3>
  <table class="doc-meta-table">
    <tr><th>Logo</th><td>Cook County / STEP Project logo</td></tr>
    <tr><th>Header</th><td>Report Title: <em>${escH(d.progName)}</em>; Parameters entered; Run Date/Time</td></tr>
    <tr><th>Footer</th><td>Confidential — Cook County | Page X of Y</td></tr>
  </table>

  <h3>Report Columns</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Column Name</th><th>Description</th><th>Source</th><th>Format</th><th>Justification</th></tr></thead>
    <tbody>${columnRows}</tbody>
  </table>

  <h3>Report Grouping, Order by, Totals &amp; Page Break</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Grouping</th><th>Order By</th><th>Total?</th><th>Caption</th><th>Page Break?</th></tr></thead>
    <tbody>
      <tr><td>${d.params.length>0 ? escH(d.params[0].name) : tbd}</td><td>${d.params.length>0 ? escH(d.params[0].name) : tbd}</td><td>Y</td><td>Total</td><td>Y</td></tr>
    </tbody>
  </table>

  <h3>Error Handling</h3>
  <p>${nl2br(d.errorHandling)||'Standard FND error handling. See Exception Handling section.'}</p>
</div>

<!-- ── XML Publisher ─────────────────────────────────────────────── -->
<div class="doc-section">
  <h2>XML Publisher</h2>
  <h3>Data Template</h3>
  <table class="doc-meta-table">
    <tr><th>Data Definition Name</th><td>${escH(d.progShortName||d.progName)}</td></tr>
    <tr><th>Data Definition Code</th><td><code>${escH(d.progShortName||'XXCUST_RPT')}</code></td></tr>
    <tr><th>Executable Application</th><td>${escH(d.docModule)}</td></tr>
    <tr><th>Description</th><td>${firstLine(d.description)}</td></tr>
  </table>

  <h3>Data Template Declaration</h3>
  <table class="doc-meta-table">
    <thead><tr><th>#</th><th>Parameter</th><th>Description</th><th>Prompt</th><th>Type</th><th>Default</th><th>Mandatory</th></tr></thead>
    <tbody>
      ${d.params.map((p,i)=>`<tr><td>${(i+1)*10}</td><td>${escH(p.name)}</td><td>${escH(p.desc||'')}</td><td>${escH(p.name)}</td><td>${escH(p.type||'VARCHAR2')}</td><td>${tbd}</td><td>Y</td></tr>`).join('') || `<tr><td colspan="7" class="doc-na-cell">No parameters.</td></tr>`}
    </tbody>
  </table>

  <h3>Data Link between Queries</h3>
  <p>${na}</p>
  <h3>Data Triggers</h3>
  <p>${na}</p>
  <h3>Break Groups</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Grouping</th><th>Order By</th><th>Total?</th><th>Caption</th><th>Page Break?</th></tr></thead>
    <tbody><tr><td>${d.params.length>0?escH(d.params[0].name):tbd}</td><td>${d.params.length>0?escH(d.params[0].name):tbd}</td><td>Y</td><td>Group Total</td><td>Y</td></tr></tbody>
  </table>

  <h3>XML Output</h3>
  <p>XML data file generated by the concurrent program and passed to XML Publisher for template-based rendering.</p>

  <h3>Excel Template</h3>
  <p>An Excel (XLS/XLSX) template is designed in XML Publisher Template Manager to render the XML output in tabular Excel format.</p>
</div>

<!-- ── PL/SQL Program Design ─────────────────────────────────────── -->
<div class="doc-section">
  <h2>PL/SQL Program Design</h2>
  <h3>Program Elements</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Script Name / Package</th><th>Procedure / Function</th><th>Description</th><th>Type</th></tr></thead>
    <tbody>
      <tr><td><code>${escH(d.packageName||'XX_CUST_PKG')}</code></td><td><code>${escH(d.procName||'main_procedure')}</code></td><td>${firstLine(d.description)}</td><td>Package Body</td></tr>
    </tbody>
  </table>

  <h3>Program Flow Diagram</h3>
  ${plsqlFlowSVG}

  <h3>Error Handling</h3>
  <div class="doc-callout doc-callout-warn">
    <strong>Oracle EBS Error Handling Standards:</strong><br>
    &bull; <code>FND_FILE.PUT_LINE(FND_FILE.LOG, ...)</code> — log messages<br>
    &bull; <code>FND_FILE.PUT_LINE(FND_FILE.OUTPUT, ...)</code> — report output<br>
    &bull; retcode: <code>0</code>=Success, <code>1</code>=Warning, <code>2</code>=Error<br>
    &bull; <code>WHEN OTHERS THEN DBMS_UTILITY.FORMAT_ERROR_BACKTRACE; RAISE;</code>
  </div>

  <h3>Pseudo Code</h3>
  <p>The following PL/SQL structure illustrates the program flow for <code>${escH(d.progName)}</code>:</p>
  <pre class="doc-code-block">-- ================================================================
-- Package : ${escH(d.packageName || 'XX_CUST_' + d.docModule + '_PKG')}
-- Procedure: ${escH(d.procName || 'main_procedure')}
-- Purpose  : ${escH(d.description.split('\n')[0].substring(0,80))}
-- ================================================================
CREATE OR REPLACE PACKAGE BODY ${escH(d.packageName || 'XX_CUST_PKG')} AS

  PROCEDURE ${escH(d.procName || 'main_procedure')} (
    errbuf   OUT VARCHAR2,
    retcode  OUT NUMBER${d.params.map(p=>`,\n    ${escH(p.name).toLowerCase().padEnd(18)} IN  ${escH(p.type||'VARCHAR2')}`).join('')}
  ) IS
    v_request_id  NUMBER  := FND_GLOBAL.CONC_REQUEST_ID;
    v_count       NUMBER  := 0;
    e_no_data     EXCEPTION;

  BEGIN
    FND_FILE.PUT_LINE(FND_FILE.LOG,'Starting '||v_request_id||' at '||TO_CHAR(SYSDATE,'YYYY-MM-DD HH24:MI:SS'));
    MO_GLOBAL.SET_POLICY_CONTEXT('S', p_org_id);

    -- ── Main query cursor ─────────────────────────────────────
    FOR rec IN (
      SELECT ${d.tables.length>0 ? escH(d.tables[0].alias)+'.*' : 'col1, col2'}
      FROM   ${d.tables.length>0 ? escH(d.tables[0].name)+' '+escH(d.tables[0].alias) : 'your_table t'}
      WHERE  1=1
      ${d.params.filter(p=>p.name.toLowerCase().includes('org')).map(p=>`AND    t.org_id = mo_global.get_current_org_id()`).join('\n      ')}
      ${d.params.filter(p=>p.name.toLowerCase().includes('start')||p.name.toLowerCase().includes('from')).map(p=>`AND    t.date_col >= ${escH(p.name.toLowerCase())}`).join('\n      ')}
      ${d.params.filter(p=>p.name.toLowerCase().includes('end')||p.name.toLowerCase().includes('to')).map(p=>`AND    t.date_col <= ${escH(p.name.toLowerCase())}`).join('\n      ')}
      ORDER BY 1
    ) LOOP
      v_count := v_count + 1;
      FND_FILE.PUT_LINE(FND_FILE.OUTPUT, rec.${d.tables.length>0?escH(d.tables[0].alias)+'.col1':'column_name'});
    END LOOP;

    IF v_count = 0 THEN RAISE e_no_data; END IF;
    FND_FILE.PUT_LINE(FND_FILE.LOG,'Completed. Rows: '||v_count);
    retcode := 0;

  EXCEPTION
    WHEN e_no_data THEN
      FND_FILE.PUT_LINE(FND_FILE.LOG,'WARNING: No data found for given parameters.');
      retcode := 1;
    WHEN OTHERS THEN
      FND_FILE.PUT_LINE(FND_FILE.LOG,'ERROR: '||SQLERRM);
      FND_FILE.PUT_LINE(FND_FILE.LOG, DBMS_UTILITY.FORMAT_ERROR_BACKTRACE);
      errbuf  := SQLERRM;
      retcode := 2;
      RAISE;
  END ${escH(d.procName || 'main_procedure')};

END ${escH(d.packageName || 'XX_CUST_PKG')};
/</pre>
</div>

<!-- ── Table and View Usage ──────────────────────────────────────── -->
<div class="doc-section">
  <h2>Table and View Usage</h2>
  <table class="doc-meta-table">
    <thead><tr><th>Name</th><th>Alias</th><th>Is New?</th><th>Functional Area</th><th>SELECT</th><th>INSERT</th><th>UPDATE</th><th>DELETE</th></tr></thead>
    <tbody>${tableUsageRows}</tbody>
  </table>
  ${dataFlowSVG}
  ${erSVG ? `<h3>Entity Relationship Diagram</h3>${erSVG}` : ''}
</div>

<!-- ── Application Setup ─────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Application Set Up</h2>
  <h3>New / Updated Seed Data</h3>
  <p>${na}</p>
  <h3>Descriptive Flexfield</h3>
  <p>${na}</p>
  <h3>Concurrent Program Executable</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Executable</th><th>Short Name</th><th>Application</th><th>Description</th><th>Execution Method</th><th>Execution File</th></tr></thead>
    <tbody>
      <tr><td>${escH(d.progName)}</td><td><code>${escH(d.progShortName||d.progName)}</code></td><td>${escH(d.docModule)}</td><td>${firstLine(d.description)}</td><td>PL/SQL Stored Procedure</td><td><code>${escH(d.packageName||'XX_PKG')}.${escH(d.procName||'main')}</code></td></tr>
    </tbody>
  </table>
  <h3>Concurrent Program Definition</h3>
  <table class="doc-meta-table">
    <tr><th>Program</th><td>${escH(d.progName)}</td></tr>
    <tr><th>Short Name</th><td><code>${escH(d.progShortName||'-')}</code></td></tr>
    <tr><th>Application</th><td>${escH(d.docModule)}</td></tr>
    <tr><th>Description</th><td>${firstLine(d.description)}</td></tr>
    <tr><th>Executable Name</th><td><code>${escH(d.progShortName||d.progName)}</code></td></tr>
    <tr><th>Method</th><td>PL/SQL Stored Procedure</td></tr>
    <tr><th>Output Format</th><td>XML (via XML Publisher)</td></tr>
  </table>
  <h3>Parameters — Display</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Seq</th><th>Parameter</th><th>Description</th><th>Prompt</th><th>Type</th><th>Default</th><th>Mandatory</th><th>LOV</th></tr></thead>
    <tbody>
      ${d.params.map((p,i)=>`<tr><td>${(i+1)*10}</td><td>${escH(p.name)}</td><td>${escH(p.desc||'')}</td><td>${escH(p.name)}</td><td>${escH(p.type||'VARCHAR2')}</td><td>${tbd}</td><td>Y</td><td>${escH(p.lov||'None')}</td></tr>`).join('') || `<tr><td colspan="8" class="doc-na-cell">No parameters.</td></tr>`}
    </tbody>
  </table>
  <h3>Concurrent Request Group</h3>
  <p>CCP Grants Accounting Super User Request Group — ${escH(d.docModule)} module.</p>
  <h3>Profile Options</h3>
  <p>${na}</p>
  <h3>XML Publisher Template Manager</h3>
  <table class="doc-meta-table">
    <tr><th>Template Name</th><td>${escH(d.progName)} Template</td></tr>
    <tr><th>Template Code</th><td><code>${escH(d.progShortName||'XXCUST_RPT')}_TMPL</code></td></tr>
    <tr><th>Application</th><td>${escH(d.docModule)}</td></tr>
    <tr><th>Template Type</th><td>RTF / Excel</td></tr>
    <tr><th>Default Language</th><td>English (US)</td></tr>
  </table>
</div>

<!-- ── Database Design ───────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Database Design</h2>
  <p>${na} — This report uses existing Oracle EBS base tables only. No new tables or views are created.</p>
  <h3>Modified Database Objects</h3>
  <p>${na}</p>
</div>

<!-- ── Exception Handling ────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Exception Handling</h2>
  <h3>Error &amp; Message Processing</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Exception</th><th>Description</th><th>Handling Strategy</th></tr></thead>
    <tbody>
      <tr><td><code>e_no_data</code></td><td>No rows returned by query</td><td>Log warning; retcode = 1</td></tr>
      <tr><td><code>OTHERS</code></td><td>Unexpected runtime error</td><td>Log SQLERRM + backtrace; retcode = 2; RAISE</td></tr>
      <tr><td>ORA-01403</td><td>No data found in lookup/select</td><td>Check parameter values and base data</td></tr>
    </tbody>
  </table>
</div>

<!-- ── Unit Test ─────────────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Unit Test Conditions</h2>
  <h3>Unit Test Plan</h3>
  <table class="doc-meta-table">
    <thead><tr><th>Program</th><th>Condition Description</th><th>Expected Results</th></tr></thead>
    <tbody>
      <tr><td rowspan="${d.params.length + 4}">${escH(d.progName)}</td><td>Submit with all mandatory parameters</td><td>Report completes successfully; retcode = 0</td></tr>
      <tr><td>Submit with date range covering no data</td><td>Warning issued; retcode = 1; "No data found" in log</td></tr>
      <tr><td>Submit with invalid ORG_ID</td><td>MO_GLOBAL raises error; retcode = 2</td></tr>
      <tr><td>Submit with maximum date range (full fiscal year)</td><td>Completes within SLA (30 min); all records returned</td></tr>
      ${d.params.map(p=>`<tr><td>Test parameter: ${escH(p.name)}</td><td>Results filtered by ${escH(p.name)} value; matches expected count</td></tr>`).join('')}
    </tbody>
  </table>
  <h3>Integration Considerations</h3>
  <p>${na}</p>
  <h3>Submission / Launching</h3>
  <p>The report is manually submitted in the Request Submit Window or scheduled via the Oracle Concurrent Manager.</p>
  <h3>Post-Requisites</h3>
  <p>${na}</p>
</div>

<!-- ── Performance Considerations ───────────────────────────────── -->
<div class="doc-section">
  <h2>Performance Considerations</h2>
  <h3>Volume Consideration</h3>
  <table class="doc-meta-table">
    <tr><th>Estimated Rows</th><td>10,000 – 100,000 per full-year run</td></tr>
    <tr><th>SLA</th><td>30 minutes for a 12-month date range</td></tr>
    <tr><th>Indexing</th><td>Ensure indexes on ${d.tables.length > 0 ? escH(d.tables[0].name)+'.ORG_ID' : 'ORG_ID'} and date columns</td></tr>
  </table>
  <h3>Installation Requirements</h3>
  <p>${na}</p>
</div>

<!-- ── Issue Log ─────────────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Issue Log</h2>
  <h3>Open Issues</h3>
  <table class="doc-meta-table">
    <thead><tr><th>ID</th><th>Issue</th><th>Resolution</th><th>Responsibility</th><th>Target Date</th></tr></thead>
    <tbody><tr><td>—</td><td colspan="4" class="doc-na-cell">No open issues.</td></tr></tbody>
  </table>
  <h3>Closed Issues</h3>
  <table class="doc-meta-table">
    <thead><tr><th>ID</th><th>Issue</th><th>Resolution</th><th>Responsibility</th><th>Impact Date</th></tr></thead>
    <tbody><tr><td>—</td><td colspan="4" class="doc-na-cell">No closed issues.</td></tr></tbody>
  </table>
</div>
` : '';

  // ═══════════════════════════════════════════════════════════════
  //  FINAL ASSEMBLY
  // ═══════════════════════════════════════════════════════════════
  return `
<div class="doc-generated-body">
${coverPage}
${docControl}
${objectInfo}
${functionalBody}
${technicalBody}
<!-- ── Revision History ────────────────────────────────────────── -->
<div class="doc-section">
  <h2>Revision History</h2>
  <table class="doc-meta-table">
    <thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Description of Change</th></tr></thead>
    <tbody><tr><td>${escH(d.version)}</td><td>${d.generatedDate}</td><td>${escH(d.author)}</td><td>Initial Draft</td></tr></tbody>
  </table>
</div>
<!-- ── Footer ─────────────────────────────────────────────────────── -->
<div class="doc-footer-bar">
  STEP Project | ${escH(typeLabel)} | <strong>${escH(d.progName)}</strong> | Module: ${escH(d.docModule)} | ${d.generatedDate}<br>
  Generated by Oracle EBS Intelligence Hub | IBM BOB + ICA Context Studio
</div>
</div><!-- end doc-generated-body -->`;
}



/* =============================================================================
   ===== SVG DIAGRAM GENERATORS ================================================
   ============================================================================= */

/** Process Flow SVG - horizontal swimlane style */
function generateProcessFlowSVG(d) {
  const steps = [
    { icon:'🚀', label:'User Submits\nRequest', color:'#0F62FE' },
    { icon:'⚙️', label:'Concurrent\nManager Picks Up', color:'#8A3FC7' },
    { icon:'🔐', label:'Security &\nOrg Context Set', color:'#B7590A' },
    { icon:'📋', label:'Parameter\nValidation', color:'#C74634' },
    { icon:'🗄️', label:'Query Oracle\nEBS Tables', color:'#00832D' },
    { icon:'🔄', label:'Apply Business\nRules & Filters', color:'#0043CE' },
    { icon:'📊', label:'Format &\nGenerate Output', color:'#24A148' },
    { icon:'✅', label:'Complete &\nNotify User', color:'#198038' },
  ];
  const boxW = 100, boxH = 70, gap = 30, startX = 30, startY = 40;
  const totalW = steps.length * (boxW + gap) + startX + gap;
  const totalH = 180;

  let boxes = '';
  let arrows = '';
  steps.forEach((s, i) => {
    const x = startX + i * (boxW + gap);
    const cy = startY + boxH / 2;
    boxes += `
    <rect x="${x}" y="${startY}" width="${boxW}" height="${boxH}" rx="8"
          fill="${s.color}22" stroke="${s.color}" stroke-width="1.5"/>
    <text x="${x + boxW/2}" y="${startY + 18}" text-anchor="middle" font-size="18" fill="${s.color}">${s.icon}</text>
    ${s.label.split('\n').map((ln,li) =>
      `<text x="${x + boxW/2}" y="${startY + 34 + li*14}" text-anchor="middle" font-size="9.5" fill="#C0C0E0">${ln}</text>`
    ).join('')}
    <text x="${x + boxW/2}" y="${startY + boxH + 14}" text-anchor="middle" font-size="8.5" fill="#7070A0">${i+1}</text>`;
    if (i < steps.length - 1) {
      const ax = x + boxW + 2, ay = cy;
      arrows += `<line x1="${ax}" y1="${ay}" x2="${ax + gap - 4}" y2="${ay}" stroke="#4A4A7A" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    }
  });

  return `<div class="doc-diagram-container">
  <svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" class="doc-svg-diagram">
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#4A4A7A"/>
      </marker>
    </defs>
    <rect width="${totalW}" height="${totalH}" fill="#12121E" rx="10"/>
    <text x="${totalW/2}" y="22" text-anchor="middle" font-size="11" fill="#6060A0" font-weight="bold">
      CONCURRENT PROGRAM EXECUTION FLOW – ${d.progName}
    </text>
    ${arrows}${boxes}
  </svg></div>`;
}

/** Data Flow Diagram SVG */
function generateDataFlowSVG(d) {
  const sources = d.tables.slice(0, Math.min(d.tables.length, 5));
  if (sources.length === 0) sources.push({ name: 'SOURCE_TABLE', alias: 'src', desc: 'Input data' });

  const svgH = Math.max(200, sources.length * 55 + 60);
  const svgW = 700;
  const srcX = 30, procX = 280, outX = 500;
  const srcW = 180, procW = 160, outW = 160;

  const srcHeight = sources.length * 50 + 10;
  const procY = svgH / 2 - 35;
  const outY  = svgH / 2 - 40;

  let srcBoxes = '';
  let srcArrows = '';
  sources.forEach((t, i) => {
    const y = 30 + i * 50;
    const cy = y + 22;
    srcBoxes += `
    <rect x="${srcX}" y="${y}" width="${srcW}" height="40" rx="6" fill="#0F62FE22" stroke="#0F62FE" stroke-width="1.2"/>
    <text x="${srcX+8}" y="${y+14}" font-size="9" fill="#7EB3FF" font-family="Consolas,monospace">${t.name}</text>
    <text x="${srcX+8}" y="${y+28}" font-size="8.5" fill="#5858A0">${t.desc ? t.desc.substring(0,28) : ''}</text>`;
    const midY = svgH / 2;
    srcArrows += `<line x1="${srcX+srcW+2}" y1="${cy}" x2="${procX-2}" y2="${midY}" stroke="#3A3A7A" stroke-width="1.2" marker-end="url(#arr2)" stroke-dasharray="4,2"/>`;
  });

  return `<div class="doc-diagram-container">
  <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" class="doc-svg-diagram">
    <defs>
      <marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#3A3A7A"/>
      </marker>
      <marker id="arr3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#24A148"/>
      </marker>
    </defs>
    <rect width="${svgW}" height="${svgH}" fill="#12121E" rx="10"/>
    <text x="10" y="16" font-size="9" fill="#6060A0" font-weight="bold">SOURCE TABLES</text>
    <text x="${procX}" y="16" font-size="9" fill="#6060A0" font-weight="bold">PROCESSING LAYER</text>
    <text x="${outX}" y="16" font-size="9" fill="#6060A0" font-weight="bold">OUTPUT</text>

    ${srcBoxes}
    ${srcArrows}

    <!-- Processing Box -->
    <rect x="${procX}" y="${procY}" width="${procW}" height="70" rx="8" fill="#8A3FC722" stroke="#8A3FC7" stroke-width="1.5"/>
    <text x="${procX + procW/2}" y="${procY+18}" text-anchor="middle" font-size="16">⚙️</text>
    <text x="${procX + procW/2}" y="${procY+34}" text-anchor="middle" font-size="9" fill="#C0C0E0">${d.procName || 'Main Procedure'}</text>
    <text x="${procX + procW/2}" y="${procY+48}" text-anchor="middle" font-size="8.5" fill="#7070A0">Validates + Filters</text>
    <text x="${procX + procW/2}" y="${procY+60}" text-anchor="middle" font-size="8.5" fill="#7070A0">Applies Business Rules</text>

    <!-- Arrow: Processing → Output -->
    <line x1="${procX+procW+2}" y1="${procY+35}" x2="${outX-2}" y2="${outY+40}" stroke="#24A148" stroke-width="1.5" marker-end="url(#arr3)"/>

    <!-- Output Box -->
    <rect x="${outX}" y="${outY}" width="${outW}" height="80" rx="8" fill="#24A14822" stroke="#24A148" stroke-width="1.5"/>
    <text x="${outX + outW/2}" y="${outY+18}" text-anchor="middle" font-size="16">📊</text>
    <text x="${outX + outW/2}" y="${outY+34}" text-anchor="middle" font-size="9" fill="#C0C0E0">Report Output</text>
    <text x="${outX + outW/2}" y="${outY+48}" text-anchor="middle" font-size="8.5" fill="#7070A0">PDF / Excel / RTF</text>
    <text x="${outX + outW/2}" y="${outY+62}" text-anchor="middle" font-size="8.5" fill="#7070A0">via BI Publisher</text>

    <!-- FND_FILE log note -->
    <rect x="${procX}" y="${procY+80}" width="${procW}" height="30" rx="5" fill="#B7590A22" stroke="#B7590A" stroke-width="1"/>
    <text x="${procX+procW/2}" y="${procY+94}" text-anchor="middle" font-size="8.5" fill="#FFB347">📋 FND_FILE LOG</text>
    <text x="${procX+procW/2}" y="${procY+106}" text-anchor="middle" font-size="8" fill="#7070A0">Audit Trail</text>
  </svg></div>`;
}

/** ER Diagram SVG */
function generateERDiagramSVG(d) {
  const tables = d.tables.slice(0, Math.min(d.tables.length, 6));
  const cols = Math.min(3, tables.length);
  const rows = Math.ceil(tables.length / cols);
  const boxW = 160, boxH = 90, gapX = 50, gapY = 60;
  const svgW = cols * (boxW + gapX) + 60;
  const svgH = rows * (boxH + gapY) + 60;

  const TABLE_KEYS = {
    'AP_SUPPLIERS':               ['VENDOR_ID (PK)','VENDOR_NAME','ENABLED_FLAG'],
    'AP_INVOICES_ALL':            ['INVOICE_ID (PK)','VENDOR_ID (FK)','ORG_ID','INVOICE_DATE','AMOUNT'],
    'AP_INVOICE_PAYMENTS':        ['INVOICE_PAYMENT_ID (PK)','INVOICE_ID (FK)','CHECK_ID (FK)'],
    'AP_CHECKS_ALL':              ['CHECK_ID (PK)','VENDOR_ID (FK)','CHECK_DATE','AMOUNT'],
    'PO_HEADERS_ALL':             ['PO_HEADER_ID (PK)','VENDOR_ID (FK)','ORG_ID','STATUS'],
    'PO_LINES_ALL':               ['PO_LINE_ID (PK)','PO_HEADER_ID (FK)','ITEM_ID','QUANTITY'],
    'PER_PEOPLE_F':               ['PERSON_ID (PK)','EMPLOYEE_NUMBER','FULL_NAME'],
    'PER_ASSIGNMENTS_F':          ['ASSIGNMENT_ID (PK)','PERSON_ID (FK)','PRIMARY_FLAG'],
    'GL_JE_HEADERS':              ['JE_HEADER_ID (PK)','LEDGER_ID','PERIOD_NAME'],
    'GL_JE_LINES':                ['JE_LINE_NUM (PK)','JE_HEADER_ID (FK)','ENTERED_DR'],
    'AP_EXPENSE_REPORT_HEADERS_ALL':['REPORT_HEADER_ID (PK)','EMPLOYEE_ID (FK)','ORG_ID'],
    'AP_EXPENSE_REPORT_LINES_ALL':  ['REPORT_LINE_ID (PK)','REPORT_HEADER_ID (FK)','AMOUNT'],
    'HR_ALL_ORGANIZATION_UNITS':    ['ORGANIZATION_ID (PK)','NAME'],
    'GL_CODE_COMBINATIONS':         ['CODE_COMBINATION_ID (PK)','SEGMENT1..6'],
  };

  let boxes = '';
  let lines = '';
  const centers = [];

  tables.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 30 + col * (boxW + gapX);
    const y = 30 + row * (boxH + gapY);
    centers.push({ x: x + boxW/2, y: y + boxH/2, t });
    const cols2 = TABLE_KEYS[t.name.toUpperCase()] || [t.alias + '.* columns'];
    const colors = ['#0F62FE','#C74634','#24A148','#8A3FC7','#B7590A','#0043CE'];
    const c = colors[i % colors.length];
    boxes += `
    <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="7" fill="#1A1A2E" stroke="${c}" stroke-width="1.5"/>
    <rect x="${x}" y="${y}" width="${boxW}" height="24" rx="7" fill="${c}44"/>
    <rect x="${x}" y="${y+17}" width="${boxW}" height="7" fill="${c}44"/>
    <text x="${x + boxW/2}" y="${y+16}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="${c}" font-family="Consolas,monospace">${t.name.length > 22 ? t.name.substring(0,22)+'…' : t.name}</text>
    ${cols2.slice(0,4).map((col2,ci) =>
      `<text x="${x+8}" y="${y+34+ci*14}" font-size="8.5" fill="${ci===0?'#FFD700':'#9898C0'}" font-family="Consolas,monospace">${ci===0?'🔑 ':'   '}${col2}</text>`
    ).join('')}`;
  });

  // Draw relationship lines between consecutive tables
  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i], b = centers[i+1];
    lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#3A3A6A" stroke-width="1" stroke-dasharray="4,3"/>
    <circle cx="${a.x}" cy="${a.y}" r="3" fill="#4A4A8A"/>
    <circle cx="${b.x}" cy="${b.y}" r="3" fill="#4A4A8A"/>`;
  }

  return `<div class="doc-diagram-container">
  <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" class="doc-svg-diagram">
    <rect width="${svgW}" height="${svgH}" fill="#0E0E1A" rx="10"/>
    <text x="10" y="18" font-size="9" fill="#6060A0" font-weight="bold">ENTITY RELATIONSHIP – KEY TABLES (${d.progName})</text>
    ${lines}${boxes}
  </svg></div>`;
}

/** PL/SQL Execution Flow SVG - vertical flowchart */
function generatePLSQLFlowSVG(d) {
  const nodes = [
    { shape:'rounded', text:'CONCURRENT\nMANAGER CALL', color:'#0F62FE', icon:'🚀' },
    { shape:'rect',    text:'PROCEDURE INIT\nSet org context', color:'#8A3FC7', icon:'⚙️' },
    { shape:'diamond', text:'Parameters\nValid?', color:'#B7590A', icon:'❓' },
    { shape:'rect',    text:'MAIN CURSOR\nQuery tables', color:'#0043CE', icon:'🗄️' },
    { shape:'diamond', text:'Records\nFound?', color:'#B7590A', icon:'❓' },
    { shape:'rect',    text:'PROCESS EACH ROW\nApply rules, format', color:'#00832D', icon:'🔄' },
    { shape:'rect',    text:'WRITE OUTPUT\nFND_FILE.OUTPUT', color:'#24A148', icon:'📝' },
    { shape:'rounded', text:'retcode = 0\nSUCCESS', color:'#198038', icon:'✅' },
  ];
  const boxW = 160, startX = 100, startY = 40, stepY = 80;
  const svgW = 460;
  const svgH = nodes.length * stepY + 80;

  let shapes = '';
  let arrows = '';

  nodes.forEach((n, i) => {
    const x = startX, y = startY + i * stepY;
    const cx = x + boxW/2, cy = y + 30;
    if (n.shape === 'diamond') {
      const dx = 80, dy = 28;
      shapes += `
      <polygon points="${cx},${y} ${cx+dx},${cy} ${cx},${y+dy*2} ${cx-dx},${cy}"
               fill="${n.color}22" stroke="${n.color}" stroke-width="1.5"/>
      <text x="${cx}" y="${y+24}" text-anchor="middle" font-size="9" fill="#C0C0E0">${n.text.split('\n')[0]}</text>
      <text x="${cx}" y="${y+36}" text-anchor="middle" font-size="9" fill="#C0C0E0">${n.text.split('\n')[1]||''}</text>`;
      // "No" branch arrow to exception box
      shapes += `
      <text x="${cx+90}" y="${cy+4}" font-size="8" fill="#C74634">No</text>`;
      arrows += `<line x1="${cx+80}" y1="${cy}" x2="${cx+140}" y2="${cy}" stroke="#C74634" stroke-width="1" marker-end="url(#arrPlsql)" stroke-dasharray="4,2"/>`;
    } else {
      const rx = n.shape === 'rounded' ? 14 : 6;
      shapes += `
      <rect x="${x}" y="${y}" width="${boxW}" height="50" rx="${rx}" fill="${n.color}22" stroke="${n.color}" stroke-width="1.5"/>
      <text x="${x+18}" y="${y+20}" font-size="14">${n.icon}</text>
      ${n.text.split('\n').map((ln, li) =>
        `<text x="${x+36}" y="${y+18+li*14}" font-size="9" fill="#C0C0E0">${ln}</text>`
      ).join('')}`;
    }
    if (i < nodes.length - 1) {
      const fromY = n.shape === 'diamond' ? y + 56 : y + 52;
      const toY   = startY + (i+1) * stepY;
      if (n.shape === 'diamond') {
        shapes += `<text x="${cx-14}" y="${fromY-4}" font-size="8" fill="#24A148">Yes</text>`;
      }
      arrows += `<line x1="${cx}" y1="${fromY}" x2="${cx}" y2="${toY}" stroke="#4A4A7A" stroke-width="1.5" marker-end="url(#arrPlsql)"/>`;
    }
  });

  // Exception box on the right
  const excX = startX + boxW + 80, excY = startY + 2 * stepY;
  shapes += `
  <rect x="${excX}" y="${excY}" width="130" height="50" rx="8" fill="#C7463422" stroke="#C74634" stroke-width="1.5"/>
  <text x="${excX+65}" y="${excY+18}" text-anchor="middle" font-size="9" fill="#FF7D6E">⚠️ EXCEPTION</text>
  <text x="${excX+65}" y="${excY+30}" text-anchor="middle" font-size="8.5" fill="#9898C0">retcode = 2</text>
  <text x="${excX+65}" y="${excY+42}" text-anchor="middle" font-size="8.5" fill="#9898C0">Log + RAISE</text>`;

  return `<div class="doc-diagram-container">
  <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" class="doc-svg-diagram">
    <defs>
      <marker id="arrPlsql" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#4A4A7A"/>
      </marker>
    </defs>
    <rect width="${svgW}" height="${svgH}" fill="#0E0E1A" rx="10"/>
    <text x="10" y="18" font-size="9" fill="#6060A0" font-weight="bold">PL/SQL PROGRAM EXECUTION FLOW – ${d.progName}</text>
    ${arrows}${shapes}
  </svg></div>`;
}

/* =============================================================================
   END SVG DIAGRAM GENERATORS
   ============================================================================= */

function downloadDoc(format) {
  const content = document.getElementById('docPreviewContent').innerHTML;
  const progName = document.getElementById('progName').value || 'Oracle_EBS_Document';

  if (format === 'html') {
    const fullHtml = `<!DOCTYPE html><html><head><title>${progName}</title>
<meta charset="utf-8">
<style>
  /* Light-mode print/Word-friendly styles */
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; margin: 0; color: #1C1C2E; background: #fff; }
  .doc-generated-body { max-width: 900px; margin: 0 auto; }
  .doc-cover-page { background: #1C1C2E; color: #FFF; padding: 40px 30px; text-align: center; margin-bottom: 0; }
  .doc-oracle-logo { color: #FF6B4A; font-size: 10pt; letter-spacing: 3px; font-weight: 700; margin-bottom: 16px; }
  .doc-cover-title { font-size: 20pt; color: #FFF; margin: 0 0 10px; }
  .doc-cover-subtitle { font-size: 13pt; color: #AAA; margin: 0 0 16px; font-weight: 400; }
  .doc-cover-meta { font-size: 10pt; color: #888; }
  .doc-status-badge { display:inline-block; margin-top:12px; padding:3px 14px; background:rgba(199,70,52,0.2); border:1px solid #C74634; color:#FF7D6E; font-size:9pt; letter-spacing:2px; }
  .doc-section { padding: 20px 30px; border-bottom: 1px solid #E0E0E0; }
  .doc-section:last-child { border-bottom: none; }
  .doc-section h2 { font-size: 13pt; color: #C74634; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #EEE; }
  .doc-meta-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }
  .doc-meta-table th { background: #1C1C2E; color: #FFF; padding: 7px 12px; text-align: left; font-size: 9.5pt; }
  .doc-meta-table td { padding: 7px 12px; border: 1px solid #DDD; color: #1C1C2E; }
  .doc-meta-table tbody tr:nth-child(even) td { background: #F7F7F7; }
  .doc-callout { padding: 12px 16px; border-radius: 6px; font-size: 10pt; line-height: 1.7; margin: 10px 0; }
  .doc-callout-info    { background: #EEF4FF; border: 1px solid #B3D4FF; color: #1A3A6E; }
  .doc-callout-warn    { background: #FFF7EE; border: 1px solid #FFD4A3; color: #7A3500; }
  .doc-callout-success { background: #EEFBF3; border: 1px solid #A3E6BF; color: #0A4A20; }
  code { background: #F0F0F0; border-radius: 3px; padding: 1px 5px; font-family: Consolas, monospace; font-size: 9pt; color: #1A3A6E; }
  .doc-code-block { background: #1C1C2E; color: #A8E6BC; padding: 16px; border-radius: 8px; font-family: Consolas, monospace; font-size: 9pt; white-space: pre; overflow-x: auto; }
  .doc-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:8pt; font-weight:700; }
  .doc-badge-draft { background:#FFF0CC; color:#7A5500; border:1px solid #FFD466; }
  .doc-badge-read  { background:#E8F0FF; color:#1A3A6E; border:1px solid #B3D4FF; }
  .doc-badge-rw    { background:#EEFBF3; color:#0A4A20; border:1px solid #A3E6BF; }
  .doc-diagram-container { margin: 12px 0; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden; background: #0E0E1A; }
  .doc-svg-diagram { width: 100%; height: auto; display: block; max-height: 400px; }
  .doc-footer-bar { text-align: center; padding: 16px; font-size: 8.5pt; color: #888; border-top: 1px solid #E0E0E0; }
  @media print { body { margin: 20px; } .doc-cover-page { page-break-after: always; } }
</style></head><body>${content}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${progName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('HTML document downloaded!', 'success');
  } else if (format === 'txt') {
    const text = document.getElementById('docPreviewContent').innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${progName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Text document downloaded!', 'success');
  }
}

/* ──────────────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
   ────────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer') || document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const borderColors = { success: '#24A148', error: '#DA1E28', info: '#0F62FE', warning: '#F1C21B' };
  toast.className = `toast toast-${type}`;
  toast.style.cssText = 'pointer-events:auto;background:#fff;border:1px solid #E0E0E0;border-left:4px solid ' +
    (borderColors[type]||'#8D8D8D') + ';padding:10px 14px;min-width:280px;max-width:420px;display:flex;' +
    'align-items:flex-start;gap:10px;box-shadow:0 4px 14px rgba(0,0,0,.2);font-size:13px;color:#161616;' +
    'transition:opacity .3s ease,transform .3s ease;font-family:inherit;';
  toast.innerHTML = `<span style="flex-shrink:0;">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ──────────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Expand first module by default
  const firstModule = document.querySelector('.module-group');
  if (firstModule) {
    firstModule.classList.add('active','expanded');
    const items = firstModule.querySelector('.module-items');
    if (items) items.style.display = 'block';
  }

  // Make all module groups toggle on click (sidebar)
  document.querySelectorAll('.module-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const group = header.parentElement;
      const wasExpanded = group.classList.contains('expanded');
      // Collapse all
      document.querySelectorAll('.module-group').forEach(g => {
        g.classList.remove('expanded','active');
        const mi = g.querySelector('.module-items');
        if (mi) mi.style.display = 'none';
      });
      // Expand clicked one if it was collapsed
      if (!wasExpanded) {
        group.classList.add('expanded','active');
        const mi = group.querySelector('.module-items');
        if (mi) mi.style.display = 'block';
      }
    });
  });

  // ── Populate the inline "High Payments by Year" selector dynamically ──
  initInlineYearSelector();

  // ── Recent Sessions: make history items clickable ──────────────────────
  initRecentSessions();

  // ── SQL Advisor sub-tab init ──────────────────────────────────────────
  initSQLSubTabs();

  // ── Fix toast container ID ─────────────────────────────────────────────
  const tc = document.getElementById('toastContainer');
  if (tc && !document.getElementById('toast-container')) { tc.id = 'toastContainer'; }

  // ── SQL Lab init ───────────────────────────────────────────────────────
  initSqlLab();

  // ── EBS Academy init ───────────────────────────────────────────────────
  initAcademy();

  // ── Add tooltips ──────────────────────────────────────────────────────
  initTooltips();

  console.log('[EBS App] Oracle EBS Intelligence Hub initialized.');
  console.log('[EBS App] Reports available:', Object.keys(window.REPORT_DATA || {}).length);
  console.log('[EBS App] SQL Library categories:', (window.EBS_SQL_LIBRARY || {categories:[]}).categories.length);
  console.log('[EBS App] Academy modules:', (window.EBS_ACADEMY || {modules:[]}).modules.length);
});

/* ── Populate inline year selector from actual data ─────────────── */
function initInlineYearSelector() {
  const sel = document.getElementById('inlineYearSelect');
  if (!sel) return;
  const data = window.REPORT_DATA['suppliers_high_payments_by_year'];
  if (!data) return;
  const yearsSet = new Set();
  data.rows.forEach(row => {
    const y = String(row[2] || '');
    if (/^20\d{2}$/.test(y)) yearsSet.add(y);
  });
  const years = [...yearsSet].sort((a,b) => b - a);
  const cy1 = new Date().getFullYear() - 1;
  sel.innerHTML = `<option value="">Select Year…</option>` +
    years.map(y => `<option value="${y}"${String(y)===String(cy1)?' selected':''}>${y === String(cy1) ? 'FY '+y+' (Default)' : 'FY '+y}</option>`).join('');
}

/* ─── RECENT SESSIONS CLICK HANDLERS ─────────────────────────────────────── */
const RECENT_SESSION_MAP = [
  { label: 'iExpense Approval Report',        reportKey: 'workflow_approvals',               tab: 'tab-reports' },
  { label: 'Supplier High Payments Analysis', reportKey: 'suppliers_high_payments_by_year',  tab: 'tab-reports' },
  { label: 'GL Trial Balance Q4',             reportKey: 'gl_trial_balance',                 tab: 'tab-reports' },
];

function initRecentSessions() {
  const historyList = document.getElementById('chatHistory');
  if (!historyList) return;

  historyList.innerHTML = RECENT_SESSION_MAP.map((s, i) => {
    const ages = ['Today', 'Yesterday', '2 days ago'];
    return `<div class="history-item clickable" onclick="openRecentSession(${i})" title="Click to open ${s.label}">
      <span class="history-icon">📊</span>
      <div class="history-text">
        <span class="history-label">${s.label}</span>
        <span class="history-age">${ages[i]}</span>
      </div>
      <span class="history-arrow">›</span>
    </div>`;
  }).join('');
}

function openRecentSession(idx) {
  const session = RECENT_SESSION_MAP[idx];
  if (!session) return;
  // Switch to reports tab
  switchTab(session.tab, document.querySelector('[data-tab="' + session.tab + '"]'));
  // Small delay to let tab render, then load report
  setTimeout(() => {
    loadReport(session.reportKey, null);
    // Highlight the correct sidebar item
    document.querySelectorAll('.report-item').forEach(el => {
      if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(session.reportKey)) {
        el.classList.add('active');
        // Expand parent module
        const moduleGroup = el.closest('.module-group');
        if (moduleGroup) {
          document.querySelectorAll('.module-group').forEach(g => g.classList.remove('expanded'));
          moduleGroup.classList.add('expanded', 'active');
        }
      }
    });
    showToast('Opened: ' + session.label, 'success');
  }, 150);
}

/* ─── SUPPLIER HIGH PAYMENTS BY YEAR ─────────────────────────────────────── */
function loadSupplierHighPaymentsByYear(year) {
  const yearVal = year || (new Date().getFullYear() - 1);
  const data = window.REPORT_DATA['suppliers_high_payments_by_year'];
  if (!data) { showToast('Report data not found.', 'error'); return; }

  // Filter rows by selected year
  const filtered = data.rows.filter(row => row[2] === String(yearVal));
  const reportCopy = Object.assign({}, data, {
    rows: filtered.length > 0 ? filtered : data.rows.filter(r => r[2] === String(yearVal - 1)),
    title: 'Suppliers with High Payments — FY ' + yearVal,
  });

  APP.currentReport = 'suppliers_high_payments_by_year';
  APP.allRows = reportCopy.rows;
  APP.filteredRows = [...reportCopy.rows];
  APP.currentPage = 1;

  document.getElementById('reportWelcome').style.display = 'none';
  document.getElementById('reportContent').style.display = 'block';
  document.getElementById('reportTitle').textContent = reportCopy.title;
  document.getElementById('reportModule').textContent = '📦 Accounts Payable';
  document.getElementById('reportRecordCount').textContent = reportCopy.rows.length + ' records';
  document.getElementById('reportDate').textContent = 'Generated: ' + new Date().toLocaleDateString();
  document.getElementById('sqlContent').textContent = data.sql;
  document.getElementById('sqlPanel').style.display = 'none';
  document.getElementById('chartPanel').style.display = 'none';
  populateYearFilter(reportCopy.rows);
  renderReportParams('suppliers_high_payments_by_year', data);
  renderTable();
  showToast('Loaded: High Payment Suppliers for FY ' + yearVal, 'success');
}

/* ─── SQL ADVISOR SUB-TABS ─────────────────────────────────────────────────── */
function initSQLSubTabs() {
  // Sub-tabs are already in HTML; just ensure first is active
  const firstSubTab = document.querySelector('.sql-subtab-btn');
  if (firstSubTab && !document.querySelector('.sql-subtab-btn.active')) {
    firstSubTab.classList.add('active');
  }
}

function switchSQLSubTab(tabId, btn) {
  /* Hide ALL sub-tab content panels */
  document.querySelectorAll('.sql-subtab-content').forEach(function(el) {
    el.classList.remove('active');
    el.style.display = 'none';
  });
  /* Deactivate all sub-tab buttons */
  document.querySelectorAll('.sql-subtab-btn').forEach(function(el) {
    el.classList.remove('active');
  });
  /* Show the selected sub-tab panel */
  var target = document.getElementById(tabId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }
  /* Activate the clicked button */
  if (btn) btn.classList.add('active');
}

/* ─── CODE REVIEW ──────────────────────────────────────────────────────────── */
function performCodeReview() {
  /* Read SQL from Code Review textarea first; fall back to Perf Advisor if empty */
  const crEl   = document.getElementById('codeReviewInput');
  const perfEl = document.getElementById('sqlInputArea');
  let sql = (crEl && crEl.value.trim()) ? crEl.value.trim()
           : (perfEl && perfEl.value.trim()) ? perfEl.value.trim()
           : '';
  if (!sql) {
    showToast('Paste a SQL query in the input area above, then click Run Code Review.', 'error');
    return;
  }
  /* Sync to Code Review textarea if it was empty */
  if (crEl && !crEl.value.trim()) crEl.value = sql;

  showToast('Running code review…', 'info');

  const S  = sql;                  /* original case */
  const U  = sql.toUpperCase();    /* upper for keyword matching */
  const reviews = [];

  /* ── Helper: check if a table is present AND org_id is missing ─────────── */
  function hasMissingOrgId(tbl) {
    if (!U.includes(tbl)) return false;
    /* ORG_ID or MO_GLOBAL must appear anywhere in query */
    return !U.includes('ORG_ID') && !U.includes('MO_GLOBAL');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 1 — Comments / Documentation
  ══════════════════════════════════════════════════════════════════════════ */
  if (!S.includes('--') && !S.includes('/*')) {
    reviews.push({
      sev:'major', cat:'Documentation',
      title:'No SQL comments found',
      detail:'All Oracle EBS programs should start with a header block: Purpose, Author, Date, Revision History, and parameter descriptions. Reviewers and future developers depend on this.',
      before:'SELECT aps.vendor_name FROM ap_suppliers aps WHERE ...',
      after :'-- Purpose  : List active AP suppliers by operating unit\n-- Author   : Dev Team   Date: 2024-01-01\n-- Params   : :p_org_id, :p_start_date, :p_end_date\nSELECT aps.vendor_name FROM ap_suppliers aps WHERE ...'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 2 — SELECT *
  ══════════════════════════════════════════════════════════════════════════ */
  if (/SELECT\s+\*/i.test(S)) {
    reviews.push({
      sev:'critical', cat:'Best Practice',
      title:'SELECT * — Never use wildcard column selection',
      detail:'SELECT * fetches every column including ones you do not need, wasting I/O and network bandwidth. It also silently breaks when a DBA adds or reorders columns.',
      before:'SELECT * FROM ap_invoices_all',
      after :'SELECT invoice_id, vendor_id, invoice_num, invoice_amount, invoice_date\nFROM   ap_invoices_all'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 3 — Correlated subquery in SELECT list  (N+1 problem)
     Matches:  , (SELECT   or  SELECT (SELECT   across newlines/spaces
  ══════════════════════════════════════════════════════════════════════════ */
  if (/\(\s*SELECT\b/i.test(S) && /\bSELECT\b[\s\S]*\(\s*SELECT\b/i.test(S)) {
    reviews.push({
      sev:'critical', cat:'Performance — N+1 Query',
      title:'Correlated subquery in SELECT list executes once per row',
      detail:'Each row in the result triggers a separate SQL execution. For 500,000 rows this means 500,000 extra queries — the single most common cause of long-running Oracle EBS reports. Rewrite as a JOIN.',
      before:"SELECT t.invoice_id,\n       (SELECT aps.vendor_name\n        FROM   ap_suppliers aps\n        WHERE  aps.vendor_id = t.vendor_id) vendor_name\nFROM   ap_invoices_all t",
      after :"SELECT t.invoice_id, aps.vendor_name\nFROM   ap_invoices_all t\nJOIN   ap_suppliers aps ON aps.vendor_id = t.vendor_id\nWHERE  t.org_id = mo_global.get_current_org_id()"
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 4 — Implicit comma joins  (ANSI-86 style)
     Matches FROM word, word  or  FROM word alias, word  across newlines
  ══════════════════════════════════════════════════════════════════════════ */
  if (/FROM\s+\w+[\s\w]*,\s*\w/im.test(S) && !/INSERT\s+INTO/i.test(S)) {
    reviews.push({
      sev:'major', cat:'Join Syntax',
      title:'Implicit comma joins (old ANSI-86 style) — use explicit JOIN',
      detail:'Comma-separated tables in the FROM clause make it easy to accidentally omit a WHERE join condition, producing a Cartesian product (every row × every row). Explicit JOIN syntax makes the join condition part of the structure, so it cannot be missed.',
      before:"FROM   ap_suppliers aps,\n       ap_invoices_all apia,\n       ap_checks_all apc\nWHERE  aps.vendor_id = apia.vendor_id\nAND    apia.invoice_id = apc.invoice_id",
      after :"FROM   ap_suppliers aps\nJOIN   ap_invoices_all apia ON  apia.vendor_id = aps.vendor_id\n                             AND apia.org_id    = mo_global.get_current_org_id()\nJOIN   ap_checks_all   apc  ON  apc.check_id   = apia.check_id"
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 5 — Multi-org _ALL tables missing ORG_ID
  ══════════════════════════════════════════════════════════════════════════ */
  const MULTI_ORG_TABLES = [
    'AP_INVOICES_ALL','AP_CHECKS_ALL','AP_INVOICE_PAYMENTS_ALL',
    'AP_EXPENSE_REPORT_HEADERS_ALL','AP_EXPENSE_REPORT_LINES_ALL',
    'PO_HEADERS_ALL','PO_LINES_ALL','PO_DISTRIBUTIONS_ALL',
    'RA_CUSTOMER_TRX_ALL','OE_ORDER_HEADERS_ALL','OE_ORDER_LINES_ALL',
    'MTL_MATERIAL_TRANSACTIONS','WIP_TRANSACTIONS'
  ];
  MULTI_ORG_TABLES.forEach(t => {
    if (U.includes(t) && !U.includes('ORG_ID') && !U.includes('MO_GLOBAL')) {
      reviews.push({
        sev:'critical', cat:'Multi-Org (MO) Compliance',
        title:'Missing ORG_ID filter on multi-org table: ' + t,
        detail:t + ' ends in _ALL meaning it holds data for EVERY operating unit in the database. Without an ORG_ID filter the query returns data from all OUs — wrong results and a full table scan across millions of rows.',
        before:'FROM   ' + t.toLowerCase() + ' t\nWHERE  t.vendor_id = :p_vendor',
        after :'FROM   ' + t.toLowerCase() + ' t\nWHERE  t.org_id    = mo_global.get_current_org_id()\nAND    t.vendor_id = :p_vendor'
      });
    }
  });

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 6 — DateTrack HR tables missing effective date filter
  ══════════════════════════════════════════════════════════════════════════ */
  ['PER_PEOPLE_F','PER_ALL_PEOPLE_F','PER_ASSIGNMENTS_F','PER_ALL_ASSIGNMENTS_F',
   'PER_PAY_PROPOSALS','PER_GRADES','PER_JOBS','PAY_ELEMENT_ENTRIES_F'].forEach(t => {
    if (U.includes(t) && !U.includes('EFFECTIVE_START_DATE') && !U.includes('EFFECTIVE_END_DATE')) {
      reviews.push({
        sev:'critical', cat:'DateTrack Tables',
        title:'Date-effective filter missing on HR table: ' + t,
        detail:t + ' is a DateTrack table — Oracle HR stores a new row for every change to an employee record. Without the effective-date filter you get ALL historical rows: every name change, job change, salary change. This means multiple rows per employee and wildly wrong aggregations.',
        before:'FROM   per_people_f ppf\nWHERE  ppf.employee_number = :p_emp',
        after :'FROM   per_people_f ppf\nWHERE  ppf.employee_number = :p_emp\nAND    SYSDATE BETWEEN ppf.effective_start_date AND ppf.effective_end_date'
      });
    }
  });

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 7 — TRUNC() or other function wrapping an indexed column
     Prevents Oracle using a B-tree index range scan
  ══════════════════════════════════════════════════════════════════════════ */
  if (/TRUNC\s*\(\s*\w+\.\w+/i.test(S)) {
    reviews.push({
      sev:'major', cat:'Index Usage',
      title:'TRUNC() applied to a column — blocks index range scan',
      detail:"When you wrap a column in a function (TRUNC, TO_CHAR, UPPER, etc.) Oracle cannot use a normal B-tree index on that column. It falls back to a full table scan. Fix: move the function to the other side of the comparison so the raw column value is compared directly.",
      before:'WHERE  TRUNC(apc.check_date)     = TRUNC(SYSDATE)\n-- or --\nWHERE  TRUNC(apia.invoice_date) >= TRUNC(:p_start)',
      after :'WHERE  apc.check_date  >= TRUNC(SYSDATE)        -- raw column on left\nAND    apc.check_date  <  TRUNC(SYSDATE) + 1\n-- or --\nWHERE  apia.invoice_date >= TRUNC(:p_start)     -- raw column, index used'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 8 — NVL vs COALESCE
  ══════════════════════════════════════════════════════════════════════════ */
  if (/\bNVL\s*\(/i.test(S)) {
    reviews.push({
      sev:'minor', cat:'ANSI SQL Compliance',
      title:'NVL() is Oracle-specific — prefer COALESCE() for portability',
      detail:'NVL(a, b) is Oracle proprietary. COALESCE(a, b, c, ...) is ANSI SQL-99 standard, supports multiple fallback arguments, and short-circuits evaluation. Both work in Oracle but COALESCE is the modern standard.',
      before:'NVL(apia.discount_amount, 0)\nNVL(apia.cancelled_date, SYSDATE)',
      after :'COALESCE(apia.discount_amount, 0)\nCOALESCE(apia.cancelled_date, SYSDATE)'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 9 — ORDER BY without row limit
  ══════════════════════════════════════════════════════════════════════════ */
  if (/\bORDER\s+BY\b/i.test(S) && !/FETCH\s+FIRST|ROWNUM\s*<=?|ROW_NUMBER\s*\(/i.test(S)) {
    reviews.push({
      sev:'minor', cat:'Performance',
      title:'ORDER BY without a row limit — sorts the entire result set',
      detail:"Oracle must sort ALL matching rows before returning any to the application. For large tables this is extremely expensive. If you don't need all rows, add a row limit. If you do need all rows but want to paginate, use ROW_NUMBER() OVER (ORDER BY ...).",
      before:'ORDER BY total_amount DESC',
      after :'ORDER BY total_amount DESC\nFETCH FIRST 1000 ROWS ONLY\n-- or for pagination:\nSELECT * FROM (\n  SELECT t.*, ROW_NUMBER() OVER (ORDER BY total_amount DESC) rn FROM ... t\n) WHERE rn BETWEEN :p_start AND :p_end'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 10 — FOR UPDATE in a reporting query
  ══════════════════════════════════════════════════════════════════════════ */
  if (/\bFOR\s+UPDATE\b/i.test(S)) {
    reviews.push({
      sev:'major', cat:'Concurrency & Locking',
      title:'FOR UPDATE found in what appears to be a reporting query',
      detail:'FOR UPDATE acquires row-level locks for the entire transaction duration. In a report running against millions of rows this will block other sessions from updating those rows, causing lock timeouts and performance degradation across the system.',
      before:'SELECT invoice_id, amount FROM ap_invoices_all FOR UPDATE',
      after :'SELECT invoice_id, amount FROM ap_invoices_all\n-- Remove FOR UPDATE from read-only/reporting queries'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 11 — Missing optimizer hints on large multi-table join
  ══════════════════════════════════════════════════════════════════════════ */
  const joinCount = (S.match(/\b(FROM|JOIN)\b/gi) || []).length;
  if (joinCount >= 4 && !S.includes('/*+') && !S.includes('/* +')) {
    reviews.push({
      sev:'info', cat:'Optimizer Hints',
      title:'No optimizer hints on a ' + joinCount + '-table join — consider adding hints',
      detail:'With ' + joinCount + ' tables joined, Oracle\'s cost-based optimizer may choose a suboptimal execution plan, especially when statistics are stale. For EBS reporting queries, adding hints like PARALLEL and USE_HASH can prevent bad plan choices.',
      before:'SELECT aps.vendor_name, SUM(apia.amount) ...',
      after :'SELECT /*+ PARALLEL(4) USE_HASH(apia apc) NO_MERGE(sub) */\n       aps.vendor_name, SUM(apia.amount) ...'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 12 — Date literals in NLS-dependent format (DD-MON-YYYY)
  ══════════════════════════════════════════════════════════════════════════ */
  if (/'\d{2}-[A-Z]{3}-\d{4}'/i.test(S)) {
    reviews.push({
      sev:'major', cat:'NLS / Portability',
      title:"Date literals in NLS-dependent DD-MON-YYYY format — use TO_DATE()",
      detail:"Hardcoded date strings like '01-JAN-2024' depend on the NLS_DATE_FORMAT setting. On a different database or after an NLS parameter change, this query will throw ORA-01858. Always use TO_DATE() with an explicit format mask, or use ANSI DATE literals.",
      before:"AND apia.invoice_date >= '01-JAN-2024'",
      after :"AND apia.invoice_date >= DATE '2024-01-01'\n-- or --\nAND apia.invoice_date >= TO_DATE('2024-01-01','YYYY-MM-DD')"
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CHECK 13 — DISTINCT as a crutch (usually hides a join problem)
  ══════════════════════════════════════════════════════════════════════════ */
  if (/\bSELECT\s+DISTINCT\b/i.test(S)) {
    reviews.push({
      sev:'minor', cat:'Query Design',
      title:'SELECT DISTINCT — often hides a missing or incorrect join condition',
      detail:'DISTINCT sorts and deduplicates the entire result set, which is expensive. More often than not, duplicates appear because of a many-to-many join that should be rewritten as a subquery, EXISTS check, or aggregation.',
      before:'SELECT DISTINCT aps.vendor_name\nFROM ap_suppliers aps, ap_invoices_all apia\nWHERE aps.vendor_id = apia.vendor_id',
      after :'-- If you just want suppliers who have invoices, use EXISTS:\nSELECT aps.vendor_name\nFROM   ap_suppliers aps\nWHERE  EXISTS (SELECT 1 FROM ap_invoices_all apia\n               WHERE  apia.vendor_id = aps.vendor_id\n               AND    apia.org_id = mo_global.get_current_org_id())'
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 14 - Implicit number-to-string conversion in WHERE
     e.g.  WHERE org_id = '204'  instead of  WHERE org_id = 204
  ────────────────────────────────────────────────────────────────────────── */
  if (/(?:org_id|vendor_id|invoice_id|check_id|person_id|assignment_id|ledger_id)\s*=\s*'[\d]+'/i.test(S)) {
    reviews.push({
      sev:'major', cat:'Data Type Mismatch',
      title:'Implicit type conversion: numeric ID column compared to string literal',
      detail:"Comparing a NUMBER column to a VARCHAR2 literal (e.g. org_id = '204') forces Oracle to convert every row value to VARCHAR2 before comparing - bypassing the index completely and causing a full table scan. Always compare numbers to numbers.",
      before:"WHERE apia.org_id = '204'\nAND   aps.vendor_id = '1234'",
      after :"WHERE apia.org_id = 204\nAND   aps.vendor_id = 1234\n-- Or use bind variables: WHERE apia.org_id = :p_org_id"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 15 - LIKE with leading wildcard
     e.g. LIKE '%ORACLE%' - full table scan, no index possible
  ────────────────────────────────────────────────────────────────────────── */
  if (/LIKE\s+'%\w/i.test(S)) {
    reviews.push({
      sev:'major', cat:'Index Usage',
      title:"LIKE with leading wildcard '%' - impossible to use B-tree index",
      detail:"A LIKE '%keyword' or LIKE '%keyword%' pattern cannot use a standard B-tree index because the leading wildcard means Oracle doesn't know where to start searching. This forces a full table scan on every execution. Use Oracle Text (CONTAINS) for full-text search, or anchor the pattern to the left.",
      before:"WHERE aps.vendor_name LIKE '%ORACLE%'",
      after :"-- Option 1: Anchor to left (uses index if one exists on vendor_name):\nWHERE aps.vendor_name LIKE 'ORACLE%'\n-- Option 2: Oracle Text for true full-text search:\nWHERE CONTAINS(aps.vendor_name, 'ORACLE') > 0"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 16 - NOT IN with a subquery (NULL-safety problem + performance)
  ────────────────────────────────────────────────────────────────────────── */
  if (/NOT\s+IN\s*\(\s*SELECT\b/i.test(S)) {
    reviews.push({
      sev:'critical', cat:'Logic Bug / Performance',
      title:'NOT IN (SELECT ...) - returns zero rows if subquery returns any NULL',
      detail:"NOT IN with a subquery is dangerous: if the subquery returns even one NULL value, the entire NOT IN returns no rows at all - a silent, invisible bug. It also forces a full evaluation of the subquery for each outer row. Replace with NOT EXISTS or a LEFT JOIN ... WHERE key IS NULL.",
      before:"WHERE vendor_id NOT IN (SELECT vendor_id FROM ap_holds_all)",
      after :"-- Safe alternative - NOT EXISTS:\nWHERE NOT EXISTS (\n  SELECT 1 FROM ap_holds_all h\n  WHERE  h.vendor_id = aps.vendor_id\n  AND    h.release_lookup_code IS NULL\n)\n-- Or LEFT JOIN:\nLEFT JOIN ap_holds_all h ON h.vendor_id = aps.vendor_id AND h.release_lookup_code IS NULL\nWHERE h.vendor_id IS NULL"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 17 - IN list with more than 1000 values (ORA-01795)
  ────────────────────────────────────────────────────────────────────────── */
  const inListMatch = S.match(/\bIN\s*\(([^)]+)\)/i);
  if (inListMatch) {
    const inListItems = inListMatch[1].split(',').length;
    if (inListItems > 50) {
      reviews.push({
        sev:'major', cat:'Scalability',
        title:'Large IN list detected (' + inListItems + ' values) - risk of ORA-01795 at >1000',
        detail:'Oracle raises ORA-01795 if an IN list exceeds 1000 literal values. Even below 1000, large IN lists create enormous SQL text, prevent cursor sharing (hard parse every time), and are slow. Use a global temporary table or a collection instead.',
        before:'WHERE invoice_id IN (1,2,3,...,1001)  -- ORA-01795 error',
        after :'-- Load IDs into a GTT first:\nINSERT INTO xx_id_gtt (id) SELECT * FROM TABLE(:id_collection);\n-- Then join:\nWHERE invoice_id IN (SELECT id FROM xx_id_gtt)\n-- Or use: WHERE invoice_id = ANY (SELECT id FROM xx_id_gtt)'
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 18 - Hard-coded literals instead of bind variables
  ────────────────────────────────────────────────────────────────────────── */
  const hardLiterals = (S.match(/=\s*'\w{3,}'/g) || []).filter(m => !/date|sysdate/i.test(m));
  if (hardLiterals.length >= 3) {
    reviews.push({
      sev:'major', cat:'Cursor Sharing / Performance',
      title:'Multiple hard-coded string literals - prevents cursor sharing',
      detail:"Each unique combination of literal values produces a new child cursor (hard parse). In a busy AP system with thousands of concurrent sessions, this floods the shared pool with near-identical cursors, causing library cache latch contention and high CPU. Use bind variables (:p_name) for all filter values.",
      before:"WHERE aps.vendor_type_lookup_code = 'VENDOR'\nAND   aps.enabled_flag = 'Y'\nAND   aps.hold_flag = 'N'",
      after :"WHERE aps.vendor_type_lookup_code = :p_vendor_type  -- bind variable\nAND   aps.enabled_flag = :p_enabled_flag\nAND   aps.hold_flag   = :p_hold_flag"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 19 - Missing TRUNC on SYSDATE comparison (time component issue)
  ────────────────────────────────────────────────────────────────────────── */
  if (/(?:invoice_date|check_date|payment_date|creation_date|last_update_date)\s*(?:<|>|=|<=|>=)\s*SYSDATE\b/i.test(S)
      && !/TRUNC\s*\(\s*SYSDATE/i.test(S)) {
    reviews.push({
      sev:'minor', cat:'Date Handling',
      title:'Comparing date column to raw SYSDATE - time component may exclude rows',
      detail:"SYSDATE includes hours, minutes, and seconds (e.g. 05-JAN-2024 14:32:11). If invoice_date stores midnight (00:00:00) then invoice_date <= SYSDATE works - but invoice_date = SYSDATE never matches. Use TRUNC(SYSDATE) to strip the time component for date-only comparisons.",
      before:"WHERE apia.invoice_date = SYSDATE        -- rarely matches (time mismatch)\nWHERE apia.creation_date < SYSDATE - 30  -- includes partial days",
      after :"WHERE apia.invoice_date = TRUNC(SYSDATE)               -- date only\nWHERE apia.creation_date < TRUNC(SYSDATE) - 30          -- clean 30-day window"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 20 - ROWNUM in WHERE before ORDER BY (wrong-row problem)
  ────────────────────────────────────────────────────────────────────────── */
  if (/\bROWNUM\b/i.test(S) && /\bORDER\s+BY\b/i.test(S)
      && !/SELECT[\s\S]*?FROM\s*\(\s*SELECT[\s\S]*?ORDER\s+BY[\s\S]*?\)\s*WHERE\s+ROWNUM/i.test(S)) {
    reviews.push({
      sev:'critical', cat:'Logic Bug',
      title:'ROWNUM used in same WHERE clause as ORDER BY - selects WRONG rows',
      detail:"This is a classic Oracle pitfall: ROWNUM is assigned BEFORE ORDER BY is applied. So WHERE ROWNUM <= 10 gives you 10 arbitrary rows, then sorts them - NOT the top 10 by your sort key. To get the true top-N, wrap in a subquery: SELECT * FROM (SELECT ... ORDER BY amount DESC) WHERE ROWNUM <= 10. Or use FETCH FIRST n ROWS ONLY (Oracle 12c+).",
      before:"SELECT vendor_name, total_amount\nFROM   ap_suppliers\nWHERE  ROWNUM <= 10\nORDER BY total_amount DESC  -- BUG: sorts after limiting - NOT top 10!",
      after :"-- Correct Top-N (Oracle 8i+):\nSELECT vendor_name, total_amount\nFROM   (\n  SELECT vendor_name, total_amount\n  FROM   ap_suppliers\n  ORDER  BY total_amount DESC\n)\nWHERE  ROWNUM <= 10\n-- Or (Oracle 12c+):\nSELECT vendor_name, total_amount\nFROM   ap_suppliers\nORDER  BY total_amount DESC\nFETCH  FIRST 10 ROWS ONLY"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 21 - Missing PRIMARY_FLAG on PER_ASSIGNMENTS_F
  ────────────────────────────────────────────────────────────────────────── */
  if (/PER_ASSIGNMENTS_F\b/i.test(S) && !/PRIMARY_FLAG\s*=\s*'Y'/i.test(S)) {
    reviews.push({
      sev:'critical', cat:'HRMS - Duplicate Rows',
      title:'PER_ASSIGNMENTS_F used without PRIMARY_FLAG = \'Y\'',
      detail:"Oracle HR stores multiple assignment records per employee: primary, secondary, and historical. Without PRIMARY_FLAG = 'Y' AND the effective-date filter, you will get duplicate rows for every employee - one per active assignment. This causes incorrect headcount and payroll roll-up numbers.",
      before:"FROM per_assignments_f paf\nWHERE paf.person_id = ppf.person_id\n-- Missing: AND paf.primary_flag = 'Y'\n-- Missing: AND SYSDATE BETWEEN paf.effective_start_date AND paf.effective_end_date",
      after :"FROM per_assignments_f paf\nWHERE paf.person_id = ppf.person_id\nAND   paf.primary_flag = 'Y'\nAND   SYSDATE BETWEEN paf.effective_start_date\n                  AND paf.effective_end_date"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 22 - GL_CODE_COMBINATIONS without ENABLED_FLAG / SUMMARY_FLAG
  ────────────────────────────────────────────────────────────────────────── */
  if (/GL_CODE_COMBINATIONS\b/i.test(S)
      && !/SUMMARY_FLAG\s*=\s*'N'/i.test(S) && !/ENABLED_FLAG\s*=\s*'Y'/i.test(S)) {
    reviews.push({
      sev:'minor', cat:'GL Best Practice',
      title:'GL_CODE_COMBINATIONS used without SUMMARY_FLAG / ENABLED_FLAG filters',
      detail:"GL_CODE_COMBINATIONS stores both detail (posting) and summary (rollup) account combinations. If you don't filter SUMMARY_FLAG = 'N' you include summary parent accounts in transactional reports, inflating balances. ENABLED_FLAG = 'Y' excludes disabled accounts.",
      before:"FROM gl_code_combinations gcc\nWHERE gcc.chart_of_accounts_id = :p_coa",
      after :"FROM gl_code_combinations gcc\nWHERE gcc.chart_of_accounts_id = :p_coa\nAND   gcc.enabled_flag  = 'Y'\nAND   gcc.summary_flag  = 'N'  -- exclude rollup summary accounts"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 23 - AP_INVOICES_ALL without CANCELLED_DATE IS NULL
  ────────────────────────────────────────────────────────────────────────── */
  if (/AP_INVOICES_ALL\b/i.test(S) && !/CANCELLED_DATE\s+IS\s+NULL/i.test(S)
      && !/CANCELLED_FLAG\s*=\s*'N'/i.test(S)) {
    reviews.push({
      sev:'minor', cat:'AP Data Quality',
      title:'AP_INVOICES_ALL without cancelled invoice exclusion',
      detail:"AP_INVOICES_ALL includes cancelled invoices (CANCELLED_DATE is populated when an invoice is cancelled). Most reports should exclude these to show only active liability. Add CANCELLED_DATE IS NULL to filter out cancelled invoices.",
      before:"FROM ap_invoices_all apia\nWHERE apia.vendor_id = :p_vendor_id\n-- Shows cancelled invoices too - inflates liability",
      after :"FROM ap_invoices_all apia\nWHERE apia.vendor_id = :p_vendor_id\nAND   apia.cancelled_date IS NULL  -- exclude cancelled invoices"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 24 - Using FND_LOOKUPS instead of FND_LOOKUP_VALUES_VL
  ────────────────────────────────────────────────────────────────────────── */
  if (/\bFND_LOOKUPS\b/i.test(S) && !/FND_LOOKUP_VALUES_VL\b/i.test(S)) {
    reviews.push({
      sev:'info', cat:'Lookups Best Practice',
      title:'FND_LOOKUPS used - prefer FND_LOOKUP_VALUES_VL for translated descriptions',
      detail:"FND_LOOKUPS is a base table. FND_LOOKUP_VALUES_VL is the translated view that returns the description in the user's current NLS language. For user-facing reports, always use FND_LOOKUP_VALUES_VL to display the correct translation.",
      before:"FROM fnd_lookups fl\nWHERE fl.lookup_type = 'YES_NO'",
      after :"FROM fnd_lookup_values_vl flv\nWHERE flv.lookup_type = 'YES_NO'\nAND   flv.enabled_flag = 'Y'\nAND   SYSDATE BETWEEN flv.start_date_active\n                  AND NVL(flv.end_date_active, SYSDATE)"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 25 - iExpense: Missing SOURCE filter on AP_EXPENSE_REPORT_HEADERS_ALL
  ────────────────────────────────────────────────────────────────────────── */
  if (/AP_EXPENSE_REPORT_HEADERS_ALL\b/i.test(S)
      && !/SOURCE\s*=\s*'(?:Both|NonValidatedWebExpense|SelfService)'/i.test(S)) {
    reviews.push({
      sev:'major', cat:'iExpense - Data Completeness',
      title:"AP_EXPENSE_REPORT_HEADERS_ALL without SOURCE filter - may include non-iExpense rows",
      detail:"AP_EXPENSE_REPORT_HEADERS_ALL stores expense report headers for ALL sources: iExpense web (SOURCE='Both'), credit card auto-feed, and legacy manual entry. Without a SOURCE filter your report may mix iExpense and credit-card-only records. For iExpense reports use SOURCE IN ('Both','NonValidatedWebExpense').",
      before:"FROM ap_expense_report_headers_all aerh\nWHERE aerh.employee_id = :p_employee_id",
      after :"FROM ap_expense_report_headers_all aerh\nWHERE aerh.employee_id = :p_employee_id\nAND   aerh.source IN ('Both','NonValidatedWebExpense')  -- iExpense only"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 26 - MERGE without a WHERE on UPDATE - full table update risk
  ────────────────────────────────────────────────────────────────────────── */
  if (/\bMERGE\b/i.test(S) && /WHEN\s+MATCHED\s+THEN\s+UPDATE\b/i.test(S)
      && !/WHEN\s+MATCHED\s+THEN\s+UPDATE\s+SET[\s\S]*?WHERE/i.test(S)) {
    reviews.push({
      sev:'major', cat:'DML Safety',
      title:'MERGE WHEN MATCHED UPDATE without a WHERE clause - updates all matched rows unconditionally',
      detail:"A MERGE UPDATE without a WHERE filter will update every matched row, even rows where the data hasn't changed. This inflates UNDO, redo logs, and triggers. Add a WHERE clause on the UPDATE branch to skip rows where the values are identical.",
      before:"WHEN MATCHED THEN\n  UPDATE SET t.amount = s.amount, t.status = s.status",
      after :"WHEN MATCHED THEN\n  UPDATE SET t.amount = s.amount, t.status = s.status\n  WHERE  t.amount != s.amount OR t.status != s.status  -- skip unchanged rows"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     CHECK 27 - EXECUTE IMMEDIATE without bind variables (SQL injection risk)
  ────────────────────────────────────────────────────────────────────────── */
  if (/EXECUTE\s+IMMEDIATE\b/i.test(S) && /'\s*\|\|/i.test(S)) {
    reviews.push({
      sev:'critical', cat:'Security - SQL Injection',
      title:'EXECUTE IMMEDIATE with string concatenation - SQL Injection vulnerability',
      detail:"Concatenating user-supplied values into a dynamic SQL string is a SQL injection attack vector. An attacker (or a malformed parameter value) can terminate your SQL and inject arbitrary DML. Always use USING clause with bind variables in EXECUTE IMMEDIATE.",
      before:"EXECUTE IMMEDIATE 'SELECT count(*) FROM ' || p_table || ' WHERE name = ''' || p_name || ''''",
      after :"-- Use bind variables for values (table names must still be validated):\nv_sql := 'SELECT COUNT(*) FROM ap_invoices_all WHERE vendor_name = :p_name';\nEXECUTE IMMEDIATE v_sql INTO v_count USING p_name;"
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     GOOD PRACTICE DETECTIONS
  ────────────────────────────────────────────────────────────────────────── */

  /* ══════════════════════════════════════════════════════════════════════════
     GOOD PRACTICE DETECTIONS
  ══════════════════════════════════════════════════════════════════════════ */
  if (/\bWITH\s+\w+\s+AS\s*\(/i.test(S)) {
    reviews.push({ sev:'good', cat:'Design Pattern',
      title:'CTE (WITH clause) used — excellent for readability and maintenance',
      detail:'Common Table Expressions name intermediate result sets, making complex queries self-documenting and allowing the optimizer to materialize them once.'
    });
  }
  if (/\bJOIN\b/i.test(S) && !/FROM\s+\w+[\s\w]*,\s*\w/im.test(S)) {
    reviews.push({ sev:'good', cat:'Join Syntax',
      title:'Explicit ANSI JOIN syntax used throughout',
      detail:'All joins use explicit INNER/LEFT/RIGHT JOIN with ON conditions — correct, readable, and safe against accidental Cartesian products.'
    });
  }
  if (/mo_global\.get_current_org_id/i.test(S)) {
    reviews.push({ sev:'good', cat:'Multi-Org Compliance',
      title:'MO_GLOBAL.GET_CURRENT_ORG_ID() used — correct multi-org pattern',
      detail:'Using mo_global.get_current_org_id() correctly scopes the query to the current operating unit context set by the calling application.'
    });
  }
  if (/PRIMARY_FLAG\s*=\s*'Y'/i.test(S)) {
    reviews.push({ sev:'good', cat:'HRMS Best Practice',
      title:'PRIMARY_FLAG = \'Y\' filter applied on assignment table',
      detail:'Correctly restricts PER_ASSIGNMENTS_F to exactly one row per employee — the primary assignment. Without this filter you get all secondary assignments too.'
    });
  }
  if (/SYSDATE\s+BETWEEN\s+\w+\.effective_start_date/i.test(S)) {
    reviews.push({ sev:'good', cat:'DateTrack Tables',
      title:'Effective-date filter applied on DateTrack table',
      detail:'SYSDATE BETWEEN effective_start_date AND effective_end_date correctly retrieves only the current row from a DateTrack table.'
    });
  }
  if (S.includes('--') || S.includes('/*')) {
    reviews.push({ sev:'good', cat:'Documentation',
      title:'SQL comments present',
      detail:'Comments found in the query — good practice for long-term maintainability.'
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER RESULTS
  ══════════════════════════════════════════════════════════════════════════ */
  const SEV_ORDER = { critical:0, major:1, minor:2, info:3, good:4 };
  reviews.sort((a, b) => (SEV_ORDER[a.sev]||5) - (SEV_ORDER[b.sev]||5));

  const cnt = {};
  reviews.forEach(r => cnt[r.sev] = (cnt[r.sev]||0) + 1);
  const score = Math.max(0, 100
    - (cnt.critical||0) * 20
    - (cnt.major||0)    * 10
    - (cnt.minor||0)    *  5);

  const scoreClass = score >= 80 ? 'score-green' : score >= 50 ? 'score-amber' : 'score-red';
  const SEV_LABEL = { critical:'🔴 CRITICAL', major:'⚠️ MAJOR', minor:'💡 MINOR', info:'ℹ️ INFO', good:'✅ GOOD' };
  const SEV_CLR   = { critical:'#C74634',     major:'#B7590A', minor:'#B89200', info:'#0043CE', good:'#198038' };

  const summaryHtml = `
    <div class="cr-summary-bar">
      <span class="cr-pill cr-critical">🔴 ${cnt.critical||0} Critical</span>
      <span class="cr-pill cr-major">⚠️ ${cnt.major||0} Major</span>
      <span class="cr-pill cr-minor">💡 ${cnt.minor||0} Minor</span>
      <span class="cr-pill cr-info">ℹ️ ${cnt.info||0} Info</span>
      <span class="cr-pill cr-good">✅ ${cnt.good||0} Good</span>
      <span class="cr-score-badge ${scoreClass}">Code Score: ${score}/100</span>
    </div>`;

  const itemsHtml = reviews.map((r, idx) => {
    const clr = SEV_CLR[r.sev] || '#888';
    return `
    <div class="cr-item cr-sev-${r.sev}">
      <div class="cr-item-hdr">
        <span class="cr-sev-tag" style="background:${clr}">${SEV_LABEL[r.sev]||r.sev}</span>
        <span class="cr-cat-tag">${r.cat}</span>
        <span class="cr-item-title">${r.title}</span>
      </div>
      <div class="cr-item-body">
        <p class="cr-detail">${r.detail}</p>
        ${r.before ? `<div class="cr-diff-grid">
          <div class="cr-diff-col cr-before">
            <div class="cr-diff-label">❌ Before (Problematic)</div>
            <pre class="cr-code-block">${escHTML(r.before)}</pre>
          </div>
          <div class="cr-diff-col cr-after">
            <div class="cr-diff-label">✅ After (Recommended)</div>
            <pre class="cr-code-block">${escHTML(r.after)}</pre>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  const out = document.getElementById('codeReviewOutput');
  if (out) {
    out.innerHTML = summaryHtml + (reviews.length
      ? `<div class="cr-items-list">${itemsHtml}</div>`
      : '<div class="cr-no-issues">✅ <strong>No issues found.</strong> This SQL follows Oracle EBS best practices.</div>');
    /* Show the results panel */
    const panel = document.getElementById('codeReviewPanel');
    if (panel) panel.style.display = 'block';
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const totalIssues = (cnt.critical||0) + (cnt.major||0) + (cnt.minor||0) + (cnt.info||0);
  showToast(
    `Code review complete — Score ${score}/100 · ${cnt.critical||0} critical, ${cnt.major||0} major, ${totalIssues} total`,
    (cnt.critical||0) > 0 ? 'warning' : 'success'
  );
}

// Alias — HTML button calls runCodeReview(), JS function is performCodeReview()
function runCodeReview() { performCodeReview(); }

// Alias — HTML calls copyCRSQL(), JS has copyCodeReviewSQL()
function copyCRSQL() { copyCodeReviewSQL ? copyCodeReviewSQL() : (function(){ const el=document.getElementById('codeReviewInput'); if(el) navigator.clipboard.writeText(el.value).then(()=>showToast('SQL copied!','success')); })(); }

function clearReviewSQL() {
  const el = document.getElementById('codeReviewInput');
  if (el) el.value = '';
  const out = document.getElementById('codeReviewOutput');
  if (out) out.innerHTML = '';
  const panel = document.getElementById('codeReviewPanel');
  if (panel) panel.style.display = 'none';
}

function loadPerfSQLToReview() {
  const src = document.getElementById('sqlInputArea');
  const dst = document.getElementById('codeReviewInput');
  if (src && dst && src.value.trim()) {
    dst.value = src.value.trim();
    showToast('SQL copied from Performance Advisor into Code Review input.', 'info');
  } else {
    showToast('Nothing in Performance Advisor yet — paste your SQL directly in the Code Review input.', 'info');
  }
}

function sendToSQLAdvisor() {
  const sql = document.getElementById('sqlContent') ? document.getElementById('sqlContent').textContent : '';
  if (!sql.trim()) { showToast('No SQL loaded yet — open a report first.', 'error'); return; }
  const el = document.getElementById('sqlInputArea');
  if (el) el.value = sql;
  switchTab('tab-sql', document.querySelector('[data-tab="tab-sql"]'));
  showToast('SQL loaded in Performance Advisor.', 'success');
}
function sendToCodeReview() {
  const sql = document.getElementById('sqlContent') ? document.getElementById('sqlContent').textContent : '';
  if (!sql.trim()) { showToast('No SQL loaded yet — open a report first.', 'error'); return; }
  const el = document.getElementById('codeReviewInput');
  if (el) el.value = sql;
  switchTab('tab-sql', document.querySelector('[data-tab="tab-sql"]'));
  // Switch to code review sub-tab
  setTimeout(() => {
    const btn = document.querySelector('[data-subtab="sql-codereview-tab"], [onclick*="sql-codereview-tab"]');
    if (btn) btn.click();
  }, 150);
  showToast('SQL loaded in Code Review.', 'success');
}

/* Sidebar module expand/collapse */
function toggleModuleGroup(headerEl) {
  const group = headerEl.closest('.module-group') || headerEl.parentElement;
  const items = group.querySelector('.module-items');
  const chevron = group.querySelector('.chevron');
  const isOpen = items && items.style.display !== 'none';
  if (items) items.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
  group.classList.toggle('expanded', !isOpen);
}

function closeChatPreview() { closePreview(); }

function copyCodeReviewSQL() {
  const el = document.getElementById('codeReviewInput');
  if (!el || !el.value.trim()) { showToast('No SQL in the input area to copy.', 'error'); return; }
  navigator.clipboard.writeText(el.value.trim())
    .then(() => showToast('SQL copied to clipboard!', 'success'))
    .catch(() => {
      // Fallback for browsers without clipboard API
      el.select();
      document.execCommand('copy');
      showToast('SQL copied!', 'success');
    });
}

function loadSQLToReview() {
  const src = document.getElementById('sqlInputArea');
  const dst = document.getElementById('codeReviewInput');
  if (!src || !src.value.trim()) {
    showToast('Nothing in the Performance Advisor yet — paste your SQL directly in the Code Review input above.', 'info');
    return;
  }
  if (dst) {
    dst.value = src.value.trim();
    showToast('SQL copied from Performance Advisor — click Run Code Review to check it.', 'success');
    dst.focus();
  }
}

function openYearSelector(ev) {
  // Nothing needed — the <select> inside handles it via onchange
  if (ev) ev.stopPropagation();
}

function escHTML(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ─── Convert title attributes to data-tip for custom CSS tooltips ──────────
   We copy title → data-tip so our CSS ::after tooltip works instantly.
   The native browser title tooltip (with ? cursor and delay) is suppressed
   by removing it, but we keep it in data-tip for the CSS tooltip.
   ─────────────────────────────────────────────────────────────────────────── */
function initTooltips() {
  document.querySelectorAll('[title]').forEach(function(el) {
    var tip = el.getAttribute('title');
    if (tip && tip.trim()) {
      el.setAttribute('data-tip', tip);
      el.removeAttribute('title');  /* Remove native browser tooltip */
    }
  });
}


/* =============================================================================
   ===== SQL FORMATTER ENGINE ==================================================
   =============================================================================
   Formats Oracle SQL / PL/SQL with:
   - Keyword casing (UPPER / lower / keep)
   - Configurable indent (2sp / 4sp / tab)
   - One column per line in SELECT list
   - One JOIN per line
   - Aligned aliases (column ... alias pattern)
   - PL/SQL block support (DECLARE/BEGIN/END)
   - Optional header comment block
   ============================================================================= */

/* SQL keywords that get cased */
const SQL_KEYWORDS = [
  'SELECT','DISTINCT','FROM','WHERE','AND','OR','NOT','IN','EXISTS',
  'BETWEEN','LIKE','IS NULL','IS NOT NULL','CASE','WHEN','THEN','ELSE','END',
  'INNER JOIN','LEFT OUTER JOIN','RIGHT OUTER JOIN','FULL OUTER JOIN',
  'LEFT JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN','NATURAL JOIN','JOIN',
  'ON','USING','GROUP BY','ORDER BY','HAVING','UNION ALL','UNION',
  'INTERSECT','MINUS','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM',
  'DELETE','CREATE OR REPLACE','CREATE','ALTER','DROP','TRUNCATE',
  'WITH','AS','MERGE INTO','USING','MATCHED','NOT MATCHED',
  'BEGIN','END','DECLARE','EXCEPTION','RETURN','PROCEDURE','FUNCTION',
  'PACKAGE','BODY','IS','AS','LOOP','FOR','WHILE','IF','ELSIF','ELSE',
  'FETCH FIRST','ROWS ONLY','ROWNUM','ROW_NUMBER','OVER','PARTITION BY',
  'NULLS FIRST','NULLS LAST','ASC','DESC',
  'COUNT','SUM','AVG','MIN','MAX','NVL','NVL2','COALESCE','DECODE',
  'TO_DATE','TO_CHAR','TO_NUMBER','TRUNC','ROUND','SYSDATE','SYSTIMESTAMP',
  'SUBSTR','INSTR','LENGTH','UPPER','LOWER','TRIM','LTRIM','RTRIM',
  'CONCAT','REPLACE','REGEXP_LIKE','REGEXP_SUBSTR',
  'COMMIT','ROLLBACK','SAVEPOINT',
];

/** Apply keyword casing to the whole SQL string */
function applyKeywordCasing(sql, mode) {
  if (mode === 'keep') return sql;
  // Sort keywords longest-first so multi-word keywords match before sub-words
  const sorted = [...SQL_KEYWORDS].sort((a,b) => b.length - a.length);
  let result = sql;
  sorted.forEach(kw => {
    const re = new RegExp('(?<![\\w\\.])' + kw.replace(/\s+/g,'\\s+') + '(?![\\w])', 'gi');
    result = result.replace(re, match =>
      mode === 'upper' ? kw.toUpperCase() : kw.toLowerCase()
    );
  });
  return result;
}

/** Split SELECT column list into individual columns, respecting parentheses */
function splitSelectCols(colStr) {
  const cols = [];
  let depth = 0, buf = '';
  for (let i = 0; i < colStr.length; i++) {
    const ch = colStr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      cols.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) cols.push(buf.trim());
  return cols;
}

/** Main formatter */
function formatSQL() {
  const input = document.getElementById('fmtInput').value.trim();
  if (!input) { showToast('Paste SQL in the input area first.', 'error'); return; }

  const indentSize  = document.getElementById('fmtIndent').value;
  const kwMode      = document.getElementById('fmtKeywords').value;
  const oneColLine  = document.getElementById('fmtOneColPerLine').checked;
  const oneJoinLine = document.getElementById('fmtOneJoinPerLine').checked;
  const addHeader   = document.getElementById('fmtAddHeader').checked;
  const ind         = indentSize === 'tab' ? '\t' : ' '.repeat(Number(indentSize));

  try {
    let sql = input;

    /* ── Step 1: Normalise whitespace but preserve string literals ─────────── */
    // Replace runs of whitespace (not inside quotes) with single space
    sql = normaliseWhitespace(sql);

    /* ── Step 2: Apply keyword casing ─────────────────────────────────────── */
    sql = applyKeywordCasing(sql, kwMode);
    const KW = kwMode === 'lower' ? 'lower' : 'upper'; // used for output keyword refs

    /* ── Step 3: Token-by-token line breaking ──────────────────────────────── */
    const K = kwMode === 'lower';  // flag: keywords in lowercase?
    const kw = (s) => K ? s.toLowerCase() : s.toUpperCase();

    // Split into major clauses
    const clausePattern = new RegExp(
      '\\b(' + [
        'SELECT\\s+DISTINCT','SELECT','FROM','(?:INNER\\s+|LEFT\\s+(?:OUTER\\s+)?|RIGHT\\s+(?:OUTER\\s+)?|FULL\\s+(?:OUTER\\s+)?|CROSS\\s+|NATURAL\\s+)?JOIN',
        'ON','WHERE','AND','OR','GROUP\\s+BY','ORDER\\s+BY','HAVING',
        'UNION\\s+ALL','UNION','INTERSECT','MINUS',
        'INTO','VALUES','SET',
        'FETCH\\s+FIRST',
        'WHEN','THEN','ELSE',
      ].join('|') + ')\\b',
      'gi'
    );

    /* ── Step 4: Format SELECT statement ───────────────────────────────────── */
    let formatted = '';

    const upperSQL = sql.toUpperCase();
    const isSelect = /^\s*(?:WITH\s+\w|\(?\s*SELECT\b)/i.test(sql);
    const isPLSQL  = /\b(BEGIN|DECLARE|CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|PACKAGE))\b/i.test(sql);

    if (isPLSQL) {
      formatted = formatPLSQL(sql, ind, kw);
    } else if (isSelect) {
      formatted = formatSelectStatement(sql, ind, kw, oneColLine, oneJoinLine);
    } else {
      // DML / DDL pass-through with basic formatting
      formatted = formatDML(sql, ind, kw);
    }

    /* ── Step 5: Optionally add header comment ──────────────────────────────── */
    if (addHeader) {
      const now = new Date().toISOString().slice(0,10);
      const hdr = kw('/*') + '\n' +
        ' * Program  : [PROGRAM_NAME]\n' +
        ' * Module   : [MODULE]\n' +
        ' * Author   : [AUTHOR]  Date: ' + now + '\n' +
        ' * Purpose  : [Describe what this SQL does]\n' +
        ' * Params   : [List bind variables used]\n' +
        ' * Tables   : ' + extractTables(sql).slice(0,4).join(', ') + '\n' +
        ' * Changes  : ' + now + ' - Initial version\n' +
        ' */\n';
      formatted = hdr + formatted;
    }

    /* ── Render ─────────────────────────────────────────────────────────────── */
    const pre = document.getElementById('fmtOutput');
    pre.textContent = formatted;

    /* Stats */
    const lines    = formatted.split('\n').length;
    const tables   = extractTables(sql);
    const joins    = (sql.match(/\bJOIN\b/gi) || []).length;
    const kwCount  = (sql.match(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|UNION)\b/gi) || []).length;
    const complexity = joins >= 5 ? 'High' : joins >= 3 ? 'Medium' : 'Low';

    document.getElementById('fmtStats').style.display = 'flex';
    document.getElementById('fmtStatLines').textContent    = 'Lines: ' + lines;
    document.getElementById('fmtStatKeywords').textContent = 'Keywords: ' + kwCount;
    document.getElementById('fmtStatTables').textContent   = 'Tables: ' + tables.length + ' (' + tables.slice(0,3).join(', ') + (tables.length>3?'...':'') + ')';
    document.getElementById('fmtStatJoins').textContent    = 'Joins: ' + joins;
    document.getElementById('fmtStatComplexity').textContent = 'Complexity: ' + complexity;

    showToast('SQL formatted successfully! ' + lines + ' lines output.', 'success');

  } catch(e) {
    showToast('Formatter error: ' + e.message, 'error');
    console.error('SQL Formatter error:', e);
  }
}

function normaliseWhitespace(sql) {
  // Replace tabs / multiple spaces with single space, but not inside string literals
  let result = '';
  let inStr = false, strChar = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (!inStr && (ch === "'" || ch === '"')) { inStr = true; strChar = ch; result += ch; }
    else if (inStr && ch === strChar && sql[i-1] !== '\\') { inStr = false; result += ch; }
    else if (!inStr && /[\t ]/.test(ch)) {
      if (result.length && !/\s$/.test(result)) result += ' ';
    } else {
      result += ch;
    }
  }
  return result.trim();
}

function extractTables(sql) {
  const re = /(?:FROM|JOIN)\s+([\w$#]+)/gi;
  const tables = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    const t = m[1].toUpperCase();
    if (!tables.includes(t) && !['SELECT','WHERE','ON','AND','OR'].includes(t)) tables.push(t);
  }
  return tables;
}

function formatSelectStatement(sql, ind, kw, oneColLine, oneJoinLine) {
  let out = '';

  /* Extract WITH CTEs if present */
  const withMatch = sql.match(/^WITH\s+([\s\S]+?)(?=\bSELECT\b)/i);
  if (withMatch) {
    out += kw('WITH') + '\n';
    // Simplified: just reflow CTE names
    const cteStr = withMatch[1].trim();
    out += ind + cteStr.replace(/,\s*(\w+)\s+AS\s*\(/gi, ',\n' + ind + '$1 ' + kw('AS') + ' (') + '\n';
    sql = sql.slice(withMatch[0].length);
  }

  /* Main SELECT */
  const selectMatch = sql.match(/^SELECT(\s+DISTINCT)?\s+([\s\S]+?)\s+FROM\s/i);
  if (selectMatch) {
    const distinct = selectMatch[1] ? ' ' + kw('DISTINCT') : '';
    const colStr   = selectMatch[2];
    const rest     = sql.slice(selectMatch[0].length);

    if (oneColLine) {
      const cols = splitSelectCols(colStr);
      const colIndent = ind;
      out += kw('SELECT') + distinct + '\n';
      out += cols.map((c, i) => colIndent + c.trim() + (i < cols.length-1 ? ',' : '')).join('\n') + '\n';
    } else {
      out += kw('SELECT') + distinct + ' ' + colStr.trim() + '\n';
    }

    /* Process rest (FROM onwards) */
    out += formatRestOfSelect(rest, ind, kw, oneJoinLine);
  } else {
    /* Fallback: simple clause-by-clause break */
    out += formatByClause(sql, ind, kw, oneJoinLine);
  }

  return out;
}

function formatRestOfSelect(sql, ind, kw, oneJoinLine) {
  let out = '';
  // Clause keywords that start a new line at column 0
  const majorClauses = [
    { re: /^FROM\b/i,               label: 'FROM',       indent: '' },
    { re: /^WHERE\b/i,              label: 'WHERE',      indent: '' },
    { re: /^GROUP\s+BY\b/i,         label: 'GROUP BY',   indent: '' },
    { re: /^ORDER\s+BY\b/i,         label: 'ORDER BY',   indent: '' },
    { re: /^HAVING\b/i,             label: 'HAVING',     indent: '' },
    { re: /^UNION\s+ALL\b/i,        label: 'UNION ALL',  indent: '' },
    { re: /^UNION\b/i,              label: 'UNION',      indent: '' },
    { re: /^FETCH\s+FIRST\b/i,      label: 'FETCH FIRST',indent: '' },
  ];
  const joinRe = /^(?:INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|FULL\s+(?:OUTER\s+)?|CROSS\s+|NATURAL\s+)?JOIN\b/i;
  const andOrRe = /^(AND|OR)\b/i;

  sql = sql.trim();
  out += kw('FROM') + ' ';

  let pos = 0;
  let currentClause = 'FROM';
  let buf = '';

  // Tokenise by finding clause boundaries
  const tokens = clauseTokenise(sql);

  for (const tok of tokens) {
    const TU = tok.toUpperCase().trimStart();
    if (joinRe.test(TU)) {
      if (buf.trim()) { out += buf.trim() + '\n'; buf = ''; }
      const jkw = tok.trimStart().replace(/\s+/g, ' ');
      out += (oneJoinLine ? '' : ind) + kw(jkw.replace(/\b(\w+)\b/g, w => w.toUpperCase())) + ' ';
      currentClause = 'JOIN';
    } else if (/^ON\b/i.test(TU)) {
      out += '\n' + ind + ind + kw('ON') + ' ';
    } else if (andOrRe.test(TU) && ['WHERE','HAVING','ON'].includes(currentClause)) {
      if (buf.trim()) { out += buf.trim() + '\n'; buf = ''; }
      const aoKw = tok.trimStart().match(/^\w+/)[0];
      out += ind + kw(aoKw) + ' ';
    } else {
      let matched = false;
      for (const cl of majorClauses) {
        if (cl.re.test(TU)) {
          if (buf.trim()) { out += buf.trim() + '\n'; buf = ''; }
          const clLabel = TU.match(new RegExp(cl.re.source, 'i'))[0].trim().replace(/\s+/g,' ').toUpperCase();
          out += '\n' + kw(clLabel) + ' ';
          currentClause = clLabel.split(' ')[0];
          const afterKw = tok.trimStart().replace(new RegExp('^' + cl.re.source, 'i'), '').trim();
          if (afterKw) buf = afterKw + ' ';
          matched = true;
          break;
        }
      }
      if (!matched) {
        out += tok;
      }
    }
  }
  if (buf.trim()) out += buf.trim();
  return out.trimEnd() + ';';
}

/** Very simple clause tokeniser - splits by clause boundaries */
function clauseTokenise(sql) {
  const patterns = [
    /\b(?:INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|FULL\s+(?:OUTER\s+)?|CROSS\s+|NATURAL\s+)?JOIN\b/gi,
    /\bON\b/gi,
    /\bWHERE\b/gi,
    /\bAND\b/gi,
    /\bOR\b/gi,
    /\bGROUP\s+BY\b/gi,
    /\bORDER\s+BY\b/gi,
    /\bHAVING\b/gi,
    /\bUNION(?:\s+ALL)?\b/gi,
    /\bFETCH\s+FIRST\b/gi,
  ];

  // Build single combined pattern for boundaries
  const combined = new RegExp(
    '(' + patterns.map(p => p.source).join('|') + ')',
    'gi'
  );

  const parts = sql.split(combined).filter(Boolean);
  return parts;
}

function formatByClause(sql, ind, kw, oneJoinLine) {
  // Simple line-break at major clause keywords
  let out = sql
    .replace(/\bSELECT\b/gi,   '\n' + kw('SELECT')    + '\n' + ind)
    .replace(/\bFROM\b/gi,     '\n' + kw('FROM')       + ' ')
    .replace(/\bINNER\s+JOIN\b/gi, '\n' + kw('INNER JOIN') + ' ')
    .replace(/\bLEFT\s+(?:OUTER\s+)?JOIN\b/gi, '\n' + kw('LEFT JOIN') + ' ')
    .replace(/\bRIGHT\s+(?:OUTER\s+)?JOIN\b/gi, '\n' + kw('RIGHT JOIN') + ' ')
    .replace(/\bFULL\s+(?:OUTER\s+)?JOIN\b/gi, '\n' + kw('FULL JOIN') + ' ')
    .replace(/\bJOIN\b/gi,     '\n' + kw('JOIN')       + ' ')
    .replace(/\bON\b/gi,       '\n' + ind + ind + kw('ON') + ' ')
    .replace(/\bWHERE\b/gi,    '\n' + kw('WHERE')      + '\n' + ind)
    .replace(/\bAND\b/gi,      '\n' + ind + kw('AND')  + ' ')
    .replace(/\bOR\b/gi,       '\n' + ind + kw('OR')   + ' ')
    .replace(/\bGROUP\s+BY\b/gi, '\n' + kw('GROUP BY') + '\n' + ind)
    .replace(/\bORDER\s+BY\b/gi, '\n' + kw('ORDER BY') + '\n' + ind)
    .replace(/\bHAVING\b/gi,   '\n' + kw('HAVING')     + '\n' + ind)
    .replace(/\bUNION\s+ALL\b/gi, '\n' + kw('UNION ALL') + '\n')
    .replace(/\bUNION\b/gi,    '\n' + kw('UNION')      + '\n')
    .replace(/\bFETCH\s+FIRST\b/gi, '\n' + kw('FETCH FIRST') + ' ')
    .replace(/\bROWS\s+ONLY\b/gi, kw('ROWS ONLY'))
    .replace(/,(?!\s*\n)/g, ',\n' + ind);

  return out.trim() + ';';
}

function formatDML(sql, ind, kw) {
  let out = sql
    .replace(/\bINSERT\s+INTO\b/gi, kw('INSERT INTO') + ' ')
    .replace(/\bVALUES\b/gi, '\n' + kw('VALUES') + '\n' + ind)
    .replace(/\bUPDATE\b/gi, kw('UPDATE') + ' ')
    .replace(/\bSET\b/gi, '\n' + kw('SET') + '\n' + ind)
    .replace(/,(?!\s*\n)/g, ',\n' + ind)
    .replace(/\bWHERE\b/gi, '\n' + kw('WHERE') + '\n' + ind)
    .replace(/\bAND\b/gi, '\n' + ind + kw('AND') + ' ');
  return out.trim() + ';';
}

function formatPLSQL(sql, ind, kw) {
  let out = sql
    .replace(/\bDECLARE\b/gi, kw('DECLARE') + '\n')
    .replace(/\bBEGIN\b/gi,   '\n' + kw('BEGIN') + '\n')
    .replace(/\bEXCEPTION\b/gi, '\n' + kw('EXCEPTION') + '\n')
    .replace(/\bEND\s*;/gi,   '\n' + kw('END') + ';')
    .replace(/;(?!\s*\n)/g,   ';\n')
    .replace(/\bIF\b/gi,      ind + kw('IF'))
    .replace(/\bTHEN\b/gi,    kw('THEN') + '\n' + ind + ind)
    .replace(/\bELSIF\b/gi,   ind + kw('ELSIF'))
    .replace(/\bELSE\b/gi,    ind + kw('ELSE') + '\n' + ind + ind)
    .replace(/\bEND\s+IF\s*;/gi, ind + kw('END IF') + ';')
    .replace(/\bFOR\b/gi,     ind + kw('FOR'))
    .replace(/\bLOOP\b/gi,    kw('LOOP') + '\n' + ind + ind)
    .replace(/\bEND\s+LOOP\s*;/gi, ind + kw('END LOOP') + ';');
  return out.trim();
}

function clearFormatter() {
  document.getElementById('fmtInput').value = '';
  document.getElementById('fmtOutput').textContent = '-- Formatted SQL will appear here after clicking Format SQL';
  document.getElementById('fmtStats').style.display = 'none';
  showToast('Formatter cleared.', 'info');
}

function copyFormattedSQL() {
  const pre = document.getElementById('fmtOutput');
  const text = pre.textContent;
  if (!text || text.startsWith('-- Formatted')) {
    showToast('Format a SQL query first.', 'error'); return;
  }
  navigator.clipboard.writeText(text)
    .then(() => showToast('Formatted SQL copied to clipboard!', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Formatted SQL copied!', 'success');
    });
}

function loadSampleSQLToFormatter() {
  document.getElementById('fmtInput').value =
`SELECT aps.vendor_name,aps.vendor_type_lookup_code,apia.invoice_id,apia.invoice_num,apia.invoice_date,apia.invoice_amount,apc.check_number,apc.check_date,apc.amount check_amount,(SELECT haou.name FROM hr_all_organization_units haou WHERE haou.organization_id=apia.org_id) ou_name FROM ap_suppliers aps,ap_invoices_all apia,ap_invoice_payments apip,ap_checks_all apc WHERE aps.vendor_id=apia.vendor_id AND apia.invoice_id=apip.invoice_id AND apip.check_id=apc.check_id AND apia.invoice_date>='01-JAN-2024' AND apia.invoice_date<='31-DEC-2024' ORDER BY aps.vendor_name,apia.invoice_date`;
  showToast('Sample SQL loaded - click Format SQL!', 'info');
}

function useFormattedInAdvisor() {
  const pre = document.getElementById('fmtOutput');
  const text = pre.textContent;
  if (!text || text.startsWith('-- Formatted')) {
    showToast('Format a SQL query first.', 'error'); return;
  }
  const el = document.getElementById('sqlInputArea');
  if (el) { el.value = text; }
  switchSQLSubTab('sql-perf-tab', document.querySelector('[data-subtab="sql-perf-tab"]'));
  showToast('Formatted SQL sent to Performance Advisor.', 'success');
}

function useFormattedInReview() {
  const pre = document.getElementById('fmtOutput');
  const text = pre.textContent;
  if (!text || text.startsWith('-- Formatted')) {
    showToast('Format a SQL query first.', 'error'); return;
  }
  const el = document.getElementById('codeReviewInput');
  if (el) { el.value = text; }
  switchSQLSubTab('sql-codereview-tab', document.querySelector('[data-subtab="sql-codereview-tab"]'));
  showToast('Formatted SQL sent to Code Review.', 'success');
}

/* =============================================================================
   END SQL FORMATTER ENGINE
   ============================================================================= */


/* =============================================================================
   ████████╗ █████╗ ██████╗      ███████╗
   ╚══██╔══╝██╔══██╗██╔══██╗     ██╔════╝
      ██║   ███████║██████╔╝     ███████╗
      ██║   ██╔══██║██╔══██╗     ╚════██║
      ██║   ██║  ██║██████╔╝     ███████║
      ╚═╝   ╚═╝  ╚═╝╚═════╝      ╚══════╝
   TAB 5: SQL LAB — Oracle EBS SQL Generator & DBA Reference
   TAB 6: EBS ACADEMY — Complete Learning Portal
   =============================================================================
   All functions: initSqlLab, searchSqlLib, generateSqlFromPrompt, displaySqlQuery,
                  initAcademy, searchAcademy, loadAcademyTopic, renderModuleCards
   ============================================================================= */

/* ─── SQL LAB STATE ──────────────────────────────────────────────── */
let SQL_LAB_CURRENT_SQL = '';
let SQL_LAB_INITIALIZED = false;

/* ─── ACADEMY STATE ──────────────────────────────────────────────── */
let ACADEMY_CURRENT_MODULE = null;
let ACADEMY_CURRENT_TOPIC  = null;
let ACADEMY_CURRENT_SQL    = '';

/* =============================================================================
   SQL LAB — INITIALISATION
   ============================================================================= */
function initSqlLab() {
  if (SQL_LAB_INITIALIZED) return;
  SQL_LAB_INITIALIZED = true;
  renderSqlLabCategoryTree();
}

function renderSqlLabCategoryTree() {
  const lib   = window.EBS_SQL_LIBRARY;
  const treeEl = document.getElementById('sqlLabCategoryTree');
  if (!lib || !treeEl) return;

  let html = '';
  lib.categories.forEach(cat => {
    html += `<div class="sqllab-cat-group">
      <div class="sqllab-cat-header" onclick="toggleSqlLabCat(this)">
        <span class="sqllab-cat-icon">${cat.icon}</span>
        <span class="sqllab-cat-label">${cat.label}</span>
        <svg class="sqllab-chevron" viewBox="0 0 24 24" fill="none" width="12">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2"/>
        </svg>
      </div>
      <div class="sqllab-cat-items">`;

    if (cat.subcategories) {
      cat.subcategories.forEach(sub => {
        html += `<div class="sqllab-subcat-label">${sub.label}</div>`;
        if (sub.queries) {
          sub.queries.forEach(q => {
            html += `<div class="sqllab-query-item" onclick="displaySqlQuery('${escSqlLabId(q.id)}')">
              <span class="sqllab-item-dot"></span>
              ${escHTML(q.title)}
            </div>`;
          });
        }
      });
    } else if (cat.queries) {
      cat.queries.forEach(q => {
        html += `<div class="sqllab-query-item" onclick="displaySqlQuery('${escSqlLabId(q.id)}')">
          <span class="sqllab-item-dot"></span>
          ${escHTML(q.title)}
        </div>`;
      });
    }

    html += `</div></div>`;
  });

  treeEl.innerHTML = html;
}

function toggleSqlLabCat(headerEl) {
  const group = headerEl.closest('.sqllab-cat-group');
  group.classList.toggle('expanded');
}

/* ─── Find a query by id across the full library ─────────────────── */
function findSqlLabQuery(id) {
  const lib = window.EBS_SQL_LIBRARY;
  if (!lib) return null;
  for (const cat of lib.categories) {
    if (cat.subcategories) {
      for (const sub of cat.subcategories) {
        if (sub.queries) {
          const q = sub.queries.find(q => q.id === id);
          if (q) return q;
        }
      }
    }
    if (cat.queries) {
      const q = cat.queries.find(q => q.id === id);
      if (q) return q;
    }
  }
  return null;
}

/* ─── Display a single query in the main panel ───────────────────── */
function displaySqlQuery(id) {
  const q = findSqlLabQuery(id);
  if (!q) return;

  SQL_LAB_CURRENT_SQL = q.sql || '';

  document.getElementById('sqlLabWelcome').style.display        = 'none';
  document.getElementById('sqlLabSearchResults').style.display  = 'none';
  document.getElementById('sqlLabDisplay').style.display        = 'block';

  document.getElementById('sqlLabQueryTitle').textContent = q.title;
  document.getElementById('sqlLabQueryDesc').textContent  = q.desc || '';

  const tagsEl = document.getElementById('sqlLabQueryTags');
  tagsEl.innerHTML = (q.tags || []).map(t =>
    `<span class="sqllab-tag">${escHTML(t)}</span>`).join('');

  const codeEl = document.getElementById('sqlLabCode');
  codeEl.innerHTML = syntaxHighlightSQL(q.sql || '');

  /* highlight active tree item */
  document.querySelectorAll('.sqllab-query-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick') && el.getAttribute('onclick').includes(id));
  });
}

/* ─── SQL Search ─────────────────────────────────────────────────── */
function searchSqlLib(term) {
  if (!term || term.trim().length < 2) {
    document.getElementById('sqlLabSearchResults').style.display = 'none';
    if (!SQL_LAB_CURRENT_SQL) document.getElementById('sqlLabWelcome').style.display = 'block';
    return;
  }
  term = term.toLowerCase();
  const lib = window.EBS_SQL_LIBRARY;
  if (!lib) return;

  const results = [];
  lib.categories.forEach(cat => {
    const queries = [];
    if (cat.subcategories) cat.subcategories.forEach(s => { if (s.queries) queries.push(...s.queries); });
    if (cat.queries) queries.push(...cat.queries);
    queries.forEach(q => {
      const haystack = `${q.title} ${q.desc || ''} ${(q.tags || []).join(' ')} ${q.sql || ''}`.toLowerCase();
      if (haystack.includes(term)) results.push({ q, cat });
    });
  });

  document.getElementById('sqlLabWelcome').style.display       = 'none';
  document.getElementById('sqlLabDisplay').style.display       = 'none';
  document.getElementById('sqlLabSearchResults').style.display = 'block';

  const titleEl = document.getElementById('sqlLabSearchTitle');
  const listEl  = document.getElementById('sqlLabResultsList');
  titleEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${term}"`;

  if (results.length === 0) {
    listEl.innerHTML = `<div class="sqllab-no-results">No queries found. Try different keywords.</div>`;
    return;
  }

  listEl.innerHTML = results.map(({ q, cat }) => `
    <div class="sqllab-result-card" onclick="displaySqlQuery('${escSqlLabId(q.id)}')">
      <div class="sqllab-result-header">
        <span class="sqllab-result-cat">${cat.icon} ${escHTML(cat.label)}</span>
        <h4>${escHTML(q.title)}</h4>
      </div>
      <p>${escHTML(q.desc || '')}</p>
      <div class="sqllab-tags">${(q.tags || []).slice(0,5).map(t => `<span class="sqllab-tag">${escHTML(t)}</span>`).join('')}</div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────────────────────────────────
   SQL LAB — AI QUERY GENERATOR
   Three-stage pipeline:
     1. Intent gate — reject non-EBS prompts BEFORE any scoring
     2. Hard keyword match (buildGeneratedSQL) — 30+ specific patterns
     3. Library fuzzy search — meaningful EBS token overlap required
   ─────────────────────────────────────────────────────────────────────── */

/* Stop words that must NOT score in the fuzzy matcher — common English
   words that appear in every query title/desc by coincidence.           */
const _SQL_STOP_WORDS = new Set([
  'the','are','and','for','all','how','what','which','with','from','that',
  'this','their','have','has','its','not','can','was','were','will','get',
  'set','run','use','show','give','list','find','get','make','let','per',
  'via','any','into','when','then','also','each','more','less','over',
  'under','after','before','between','about','above','below','out','off',
  'into','onto','upon','they','you','our','your','there','here','where',
  'been','being','having','doing','going','come','came','take','took',
  'new','old','last','next','first','second','third','just','only','even',
  'file','files','folder','folders','dir','directory','path','name','names',
  'data','info','type','time','date','code','value','values','item','items',
  'some','both','such','like','than','so','if','do','as','at','by','in',
  'to','of','on','up','or','it','is','be','an','no','me','my','we',
]);

/* EBS domain vocabulary — a prompt must contain at least one of these
   for the library fuzzy search to fire at all.                          */
const _EBS_DOMAIN_TOKENS = [
  'concurrent','request','program','responsibility','fnd','apps','ebs','oracle',
  'invoice','payable','vendor','supplier','payment','ap ','ap_',
  'customer','receivable','receipt','aging','ar ','ar_',
  'journal','ledger','account','gl ','gl_','period','budget','balance',
  'employee','worker','assignment','hire','grade','payroll','element','salary',
  'purchase','requisition','po ','po_','receipt','shipment','inventory',
  'workflow','notification','approval','stuck','errored',
  'value set','valueset','flexfield','lov ','profile','profile option',
  'alert','dba','ddl','index','table','grant','synonym','sequence',
  'sql','select','from','where','join','r12','r12.2',
  'unix','shell','startup','shutdown','log','appl_top',
  'user ','users','role','permission','menu','function','form','page',
];

function generateSqlFromPrompt() {
  const promptEl = document.getElementById('sqlLabPrompt');
  const prompt   = (promptEl ? promptEl.value : '').trim();
  if (!prompt) { showToast('Enter a description of the SQL you need.', 'warning'); return; }

  const p = prompt.toLowerCase();

  /* ── STAGE 1: Intent gate — is this even EBS / Oracle related? ──────
     Check BEFORE any library scoring so we never return a random match
     for a general IT / non-Oracle question.                             */
  const hasEBSDomain = _EBS_DOMAIN_TOKENS.some(tok => p.includes(tok));

  if (!hasEBSDomain) {
    /* Completely out of scope — clear, honest, redirect */
    _showOutOfScope(prompt);
    return;
  }

  /* ── STAGE 2: Hard keyword patterns (buildGeneratedSQL) ─────────────
     Returns a specific production-ready SQL block or '' if no match.   */
  const generated = buildGeneratedSQL(prompt);
  if (generated && generated.trim()) {
    _showSqlLabResult(prompt, generated, ['AI Generated', 'Oracle EBS R12'], true);
    showToast('✅ SQL generated for your query!', 'success');
    return;
  }

  /* ── STAGE 3: Fuzzy library search — meaningful tokens only ─────────
     Only score words that are NOT in _SQL_STOP_WORDS and have length>3.
     Require score >= 10 (two strong title hits) to avoid false matches. */
  const meaningfulWords = p.split(/\s+/).filter(w =>
    w.length > 3 && !_SQL_STOP_WORDS.has(w)
  );

  const lib = window.EBS_SQL_LIBRARY;
  let topMatches = [];

  if (lib && meaningfulWords.length > 0) {
    lib.categories.forEach(cat => {
      const queries = [];
      if (cat.subcategories) cat.subcategories.forEach(s => { if (s.queries) queries.push(...s.queries); });
      if (cat.queries) queries.push(...cat.queries);
      queries.forEach(q => {
        let score = 0;
        const titleLower = q.title.toLowerCase();
        const descLower  = (q.desc || '').toLowerCase();
        const tagsLower  = (q.tags || []).map(t => t.toLowerCase()).join(' ');
        meaningfulWords.forEach(word => {
          /* Only score meaningful domain words that appear in title/desc/tags */
          if (titleLower.includes(word)) score += 8;       /* strong: title hit */
          else if (tagsLower.includes(word))  score += 4;  /* medium: tag hit   */
          else if (descLower.includes(word))  score += 2;  /* weak:  desc hit   */
        });
        if (score > 0) topMatches.push({ score, q, cat });
      });
    });
  }

  topMatches.sort((a, b) => b.score - a.score);
  const best = topMatches[0];

  /* Require score >= 8 (at least one solid title word match) */
  if (best && best.score >= 8) {
    displaySqlQuery(best.q.id);
    showToast(`📚 Best match: "${best.q.title}"`, 'success');
    return;
  }

  /* ── STAGE 4: EBS in scope but no library match → helpful guidance ── */
  const suggestions = topMatches.slice(0, 3)
    .map(m => `  • "${m.q.title}" — ${m.cat.label}`).join('\n');
  const closestBlock = suggestions
    ? `\n   Closest library results for your prompt:\n${suggestions}\n   → Click them in the left sidebar.`
    : '';

  const noMatchSql =
`/* No exact SQL found for: "${prompt.replace(/"/g,"'")}"
   ─────────────────────────────────────────────────────────${closestBlock}

   Refine your prompt using these EBS module keywords:
   ┌────────────────────────────────────────────────────────┐
   │  Module          │  Try these keywords                 │
   ├────────────────────────────────────────────────────────┤
   │  Concurrent      │  concurrent, request, long running  │
   │  AP Payables     │  invoice, payment, vendor, supplier │
   │  AR Receivables  │  customer, receipt, aging, balance  │
   │  General Ledger  │  journal, ledger, period, account   │
   │  HRMS            │  employee, assignment, grade, hire  │
   │  Payroll         │  payroll, element, salary, payslip  │
   │  Purchasing      │  purchase order, po, requisition    │
   │  Security        │  user, responsibility, role, menu   │
   │  Workflow        │  workflow, notification, approval   │
   │  Value Sets      │  value set, lov, flexfield          │
   │  Alerts          │  alert, fnd_message, monitoring     │
   │  Profile Options │  profile, profile option            │
   │  DBA / DDL       │  table, index, grant, synonym       │
   │  Unix / Shell    │  unix, shell, log, startup, appl    │
   └────────────────────────────────────────────────────────┘
*/

-- Example: AP Invoices Not Yet Paid This Month
SELECT aia.invoice_num,
       aps.vendor_name,
       aia.invoice_amount,
       NVL(aia.amount_paid,0)                              amount_paid,
       aia.invoice_amount - NVL(aia.amount_paid,0)         outstanding
  FROM ap_invoices_all aia
  JOIN ap_suppliers    aps ON aps.vendor_id = aia.vendor_id
 WHERE aia.org_id          = :p_org_id
   AND aia.invoice_date   >= TRUNC(SYSDATE,'MM')
   AND NVL(aia.payment_status_flag,'N') != 'Y'
   AND NVL(aia.cancelled_date, SYSDATE+1) > SYSDATE
 ORDER BY aia.invoice_date DESC;`;

  _showSqlLabResult(prompt, noMatchSql, ['Refine Prompt', 'EBS Keywords'], false);
  showToast('💡 No exact match — refine with an EBS module keyword from the table.', 'info');
}

/* Show a clear, honest "out of scope" response — never return a random query */
function _showOutOfScope(prompt) {
  const p = prompt.toLowerCase();

  /* Detect what the user might actually want and suggest the right EBS alternative */
  let hint = '';
  if (/unix|linux|shell|bash|command|ls|grep|awk|find/.test(p)) {
    hint = `\n   💡 For EBS Unix/Shell commands, try:\n      "EBS log monitoring commands"\n      "start stop oracle ebs"\n      "find concurrent request log file"`;
  } else if (/python|java|code|script|function|program/.test(p)) {
    hint = `\n   💡 For EBS PL/SQL and custom scripting, try:\n      "create procedure"\n      "execute concurrent program from sql"\n      "pl/sql package"`;
  } else if (/network|server|ip|port|firewall|ssl/.test(p)) {
    hint = `\n   💡 For EBS server/DBA tasks, try:\n      "DBA session monitoring"\n      "tablespace usage"\n      "check database alert log"`;
  } else {
    hint = `\n   💡 Try an EBS-specific prompt:\n      "AP invoices pending approval"\n      "concurrent program long running"\n      "employee assignment history"`;
  }

  const sql =
`/* ⚠️  Not an Oracle EBS SQL topic: "${prompt.replace(/"/g,"'")}"
   ─────────────────────────────────────────────────────────────
   The SQL Lab AI Generator answers Oracle EBS R12 database
   and shell/admin questions only.

   It cannot help with:  general Unix commands, Python, JavaScript,
   networking, cloud platforms, or non-Oracle software.
${hint}

   📚 Or browse the left sidebar — 500+ production-ready EBS queries
      across Concurrent, AP, AR, GL, HRMS, Payroll, PO, Workflow,
      Value Sets, DBA Activities, PL/SQL, and Unix Shell categories.
*/

-- Showing a safe starting example instead:
-- All pending/running Concurrent Requests right now
SELECT fcr.request_id,
       fcpv.user_concurrent_program_name   program_name,
       fcr.requested_start_date,
       fcr.actual_start_date,
       ROUND((SYSDATE - fcr.actual_start_date)*1440, 1) running_mins,
       DECODE(fcr.status_code,
         'P','Pending','R','Running','E','Error','C','Complete',
          fcr.status_code)                              status
  FROM fnd_concurrent_requests    fcr
  JOIN fnd_concurrent_programs_vl fcpv
    ON fcpv.concurrent_program_id = fcr.concurrent_program_id
 WHERE fcr.status_code IN ('P','R')
 ORDER BY fcr.requested_start_date;`;

  _showSqlLabResult(prompt, sql, ['⚠️ Out of Scope', 'EBS Only'], false);
  showToast('⚠️ Not an EBS topic — showing redirect guidance in the panel.', 'warning');
}

/**
 * Detect if the user's prompt is completely outside Oracle EBS scope.
 * Used externally — kept for any other callers.
 */
function _isNonEBSPrompt(p) {
  return !_EBS_DOMAIN_TOKENS.some(tok => p.includes(tok));
}

/* Helper — renders generated SQL in the display panel.
   Clears previous content first so stale SQL never bleeds through. */
function _showSqlLabResult(prompt, sql, tags, isGood) {
  SQL_LAB_CURRENT_SQL = sql;

  /* ── Clear ALL three panels first ── */
  const codeEl = document.getElementById('sqlLabCode');
  if (codeEl) codeEl.innerHTML = '';
  const titleEl = document.getElementById('sqlLabQueryTitle');
  const descEl  = document.getElementById('sqlLabQueryDesc');
  const tagsEl  = document.getElementById('sqlLabQueryTags');
  if (titleEl) titleEl.textContent = '';
  if (descEl)  descEl.textContent  = '';
  if (tagsEl)  tagsEl.innerHTML    = '';

  /* ── Show display panel, hide the others ── */
  document.getElementById('sqlLabWelcome').style.display       = 'none';
  document.getElementById('sqlLabSearchResults').style.display = 'none';
  const display = document.getElementById('sqlLabDisplay');
  display.style.display = 'flex';
  /* Scroll display pane back to top so the header is always visible */
  display.scrollTop = 0;

  /* ── Populate ── */
  if (titleEl) {
    titleEl.textContent = isGood
      ? `Generated: ${prompt.substring(0, 80)}`
      : `No match found for: "${prompt.substring(0, 60)}"`;
  }
  if (descEl) {
    descEl.textContent = isGood
      ? 'AI-generated query — review bind variables (:p_org_id, :p_from_date) before running.'
      : 'No exact SQL match. The panel below shows guidance + a closest example. Refine your prompt with an EBS module keyword.';
  }
  if (tagsEl) {
    tagsEl.innerHTML = tags.map(t => `<span class="sqllab-tag">${escHTML(t)}</span>`).join('');
  }
  if (codeEl) {
    codeEl.innerHTML = syntaxHighlightSQL(sql);
  }
}

function buildGeneratedSQL_v1_DEPRECATED(prompt) {
  /* ── Fully retired — buildGeneratedSQL v2 handles all patterns ── */
  void prompt;
  if (false) {
  if (p.includes('concurrent') && (p.includes('request id') || p.includes('request_id'))) {
    return `/* Concurrent Programs by Request ID */
SELECT fcr.request_id,
       fcpv.user_concurrent_program_name    program_name,
       fcp.concurrent_program_name          short_name,
       fcr.status_code,
       DECODE(fcr.status_code,
              'C','Completed','R','Running','P','Pending',
              'E','Error','T','Terminating', fcr.status_code) status_desc,
       fcr.requested_start_date,
       fcr.actual_start_date,
       fcr.actual_completion_date,
       ROUND((fcr.actual_completion_date - fcr.actual_start_date)*1440, 2) runtime_mins,
       fcr.logfile_name,
       fcr.outfile_name,
       fcr.argument_text                    parameters
  FROM fnd_concurrent_requests       fcr
  JOIN fnd_concurrent_programs       fcp  ON fcp.concurrent_program_id  = fcr.concurrent_program_id
                                          AND fcp.application_id         = fcr.program_application_id
  JOIN fnd_concurrent_programs_vl    fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                          AND fcpv.application_id        = fcp.application_id
 WHERE fcr.request_id = :p_request_id   -- replace with actual request ID
    OR fcr.parent_request_id = :p_request_id
 ORDER BY fcr.request_id;`;
  }

  if (p.includes('long running') || p.includes('long-running') || p.includes('slow concurrent')) {
    return `/* Long Running Concurrent Programs — Last 30 days */
SELECT fcpv.user_concurrent_program_name          program_name,
       fcr.status_code,
       COUNT(*)                                   run_count,
       ROUND(AVG((fcr.actual_completion_date - fcr.actual_start_date)*1440),2) avg_mins,
       ROUND(MAX((fcr.actual_completion_date - fcr.actual_start_date)*1440),2) max_mins
  FROM fnd_concurrent_requests    fcr
  JOIN fnd_concurrent_programs    fcp  ON fcp.concurrent_program_id = fcr.concurrent_program_id
  JOIN fnd_concurrent_programs_vl fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
 WHERE fcr.actual_start_date      IS NOT NULL
   AND fcr.actual_completion_date IS NOT NULL
   AND fcr.actual_start_date      >= SYSDATE - 30
   AND (fcr.actual_completion_date - fcr.actual_start_date)*1440 > :p_mins  -- e.g. 30
 GROUP BY fcpv.user_concurrent_program_name, fcr.status_code
 ORDER BY avg_mins DESC;`;
  }

  if (p.includes('responsibility') && p.includes('concurrent')) {
    return `/* Responsibilities Attached to Concurrent Programs */
SELECT fa.application_short_name,
       fcp.concurrent_program_name          short_name,
       fcpv.user_concurrent_program_name    program_name,
       frg.responsibility_name,
       frg.responsibility_key,
       fro.request_group_name
  FROM fnd_concurrent_programs       fcp
  JOIN fnd_concurrent_programs_vl    fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                          AND fcpv.application_id        = fcp.application_id
  JOIN fnd_application               fa   ON fa.application_id = fcp.application_id
  JOIN fnd_request_group_units       frgu ON frgu.request_unit_id = fcp.concurrent_program_id
                                          AND frgu.unit_application_id   = fcp.application_id
                                          AND frgu.request_unit_type     = 'P'
  JOIN fnd_request_groups            fro  ON fro.request_group_id = frgu.request_group_id
  JOIN fnd_responsibility_vl         frg  ON frg.request_group_id  = fro.request_group_id
 ORDER BY fa.application_short_name, fcp.concurrent_program_name;`;
  }

  if (p.includes('request set')) {
    return `/* Request Sets and Member Programs */
SELECT frs.request_set_name,
       frsvl.user_request_set_name,
       frsb.stage_name,
       frsb.sequence,
       fcpv.user_concurrent_program_name  program_name,
       fcp.concurrent_program_name        short_name,
       frsb.critical
  FROM fnd_request_sets              frs
  JOIN fnd_request_sets_vl           frsvl ON frsvl.request_set_id = frs.request_set_id
  JOIN fnd_request_set_stages        frss  ON frss.request_set_id  = frs.request_set_id
  JOIN fnd_request_set_stage_members frsb  ON frsb.request_set_stage_id = frss.request_set_stage_id
  JOIN fnd_concurrent_programs       fcp   ON fcp.concurrent_program_id = frsb.concurrent_program_id
  JOIN fnd_concurrent_programs_vl    fcpv  ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                           AND fcpv.application_id        = fcp.application_id
 ORDER BY frs.request_set_name, frsb.sequence;`;
  }

  /* ── AP / Invoice patterns ──────────────────────── */
  if (p.includes('invoice') && (p.includes('payab') || p.includes(' ap '))) {
    return `/* Accounts Payable — Invoice Register */
SELECT aia.invoice_num,
       aia.invoice_date,
       aia.invoice_type_lookup_code      invoice_type,
       aps.vendor_name,
       apss.vendor_site_code,
       aia.invoice_amount,
       aia.amount_paid,
       aia.invoice_amount - NVL(aia.amount_paid,0)  outstanding,
       aia.payment_status_flag,
       aia.approval_status_lookup_code   approval_status,
       aia.currency_code,
       aia.creation_date,
       aia.created_by
  FROM ap_invoices_all   aia
  JOIN ap_suppliers      aps  ON aps.vendor_id       = aia.vendor_id
  JOIN ap_supplier_sites_all apss ON apss.vendor_site_id = aia.vendor_site_id
 WHERE aia.org_id       = :p_org_id
   AND aia.invoice_date >= :p_from_date
   AND aia.invoice_date <= :p_to_date
   AND NVL(aia.cancelled_date, SYSDATE+1) > SYSDATE   -- exclude cancelled
 ORDER BY aia.invoice_date DESC, aps.vendor_name;`;
  }

  /* ── AR / Customer patterns ─────────────────────── */
  if (p.includes('customer') || (p.includes('receipt') && p.includes('ar'))) {
    return `/* Accounts Receivable — Customer Outstanding Balance */
SELECT hca.account_number,
       hp.party_name              customer_name,
       rct.trx_number,
       rct.trx_date,
       aps.due_date,
       aps.amount_due_original,
       aps.amount_due_remaining,
       aps.status,
       TRUNC(SYSDATE) - aps.due_date   days_overdue
  FROM ar_payment_schedules_all  aps
  JOIN ra_customer_trx_all       rct ON rct.customer_trx_id = aps.customer_trx_id
  JOIN hz_cust_accounts          hca ON hca.cust_account_id = rct.bill_to_customer_id
  JOIN hz_parties                hp  ON hp.party_id = hca.party_id
 WHERE aps.status    = 'OP'
   AND aps.org_id    = :p_org_id
   AND rct.trx_date >= :p_from_date
 ORDER BY hp.party_name, aps.due_date;`;
  }

  /* ── GL / Journal patterns ──────────────────────── */
  if (p.includes('journal') || p.includes('gl ') || p.includes('ledger')) {
    return `/* General Ledger — Journal Entry Detail */
SELECT gljh.je_header_id,
       gljh.name                  journal_name,
       gljh.description,
       gljh.period_name,
       gljh.je_category,
       gljh.je_source,
       gljh.status,
       gljl.je_line_num,
       gcc.segment1               company,
       gcc.segment2               cost_center,
       gcc.segment3               account,
       gljl.entered_dr,
       gljl.entered_cr,
       gljl.description           line_desc
  FROM gl_je_headers          gljh
  JOIN gl_je_lines             gljl ON gljl.je_header_id = gljh.je_header_id
  JOIN gl_code_combinations    gcc  ON gcc.code_combination_id = gljl.code_combination_id
 WHERE gljh.ledger_id   = :p_ledger_id
   AND gljh.period_name = :p_period_name
   AND gljh.status      = 'P'   -- Posted journals
 ORDER BY gljh.name, gljl.je_line_num;`;
  }

  /* ── HRMS / Employee patterns ───────────────────── */
  if (p.includes('employee') || p.includes('hrms') || p.includes('worker')) {
    return `/* HRMS — Active Employee Directory */
SELECT papf.employee_number,
       papf.full_name,
       papf.national_identifier   ssn_or_national_id,
       papf.date_of_birth,
       papf.hire_date,
       haou.name                  organization_name,
       pj.name                    job_name,
       pg.name                    grade_name,
       pos.name                   position_name,
       ppf2.full_name             supervisor_name,
       paaf.assignment_number,
       paaf.assignment_status_type_id
  FROM per_all_people_f          papf
  JOIN per_all_assignments_f     paaf  ON paaf.person_id = papf.person_id
  JOIN hr_all_organization_units haou  ON haou.organization_id = paaf.organization_id
  LEFT JOIN per_jobs             pj    ON pj.job_id = paaf.job_id
  LEFT JOIN per_grades           pg    ON pg.grade_id = paaf.grade_id
  LEFT JOIN per_all_positions    pos   ON pos.position_id = paaf.position_id
  LEFT JOIN per_all_people_f     ppf2  ON ppf2.person_id = paaf.supervisor_id
                                      AND TRUNC(SYSDATE) BETWEEN ppf2.effective_start_date AND ppf2.effective_end_date
 WHERE paaf.primary_flag     = 'Y'
   AND paaf.assignment_type  = 'E'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
 ORDER BY papf.full_name;`;
  }

  /* ── Payroll patterns ───────────────────────────── */
  if (p.includes('payroll') || p.includes('payslip') || p.includes('element')) {
    return `/* Payroll — Employee Element Entry Values */
SELECT papf.employee_number,
       papf.full_name,
       pet.element_name,
       petf.name           input_value_name,
       peev.screen_entry_value,
       pee.effective_start_date  entry_from,
       pee.effective_end_date    entry_to,
       pet.processing_type       -- R=Recurring N=Non-Recurring
  FROM per_all_people_f          papf
  JOIN per_all_assignments_f     paaf  ON paaf.person_id = papf.person_id
  JOIN pay_element_entries_f     pee   ON pee.assignment_id = paaf.assignment_id
  JOIN pay_element_entry_values_f peev ON peev.element_entry_id = pee.element_entry_id
  JOIN pay_input_values_f        petf  ON petf.input_value_id = peev.input_value_id
  JOIN pay_element_types_f       pet   ON pet.element_type_id = petf.element_type_id
 WHERE paaf.primary_flag = 'Y'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pee.effective_start_date  AND pee.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN peev.effective_start_date AND peev.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN petf.effective_start_date AND petf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pet.effective_start_date  AND pet.effective_end_date
 ORDER BY papf.full_name, pet.element_name;`;
  }

  /* ── PO / SCM patterns ──────────────────────────── */
  if (p.includes('purchase order') || p.includes(' po ') || p.includes('requisition') || p.includes('receipt')) {
    return `/* Purchasing — Open PO Lines with Receipt Status */
SELECT pha.segment1               po_number,
       pha.type_lookup_code       po_type,
       aps.vendor_name,
       pla.line_num,
       pla.item_description,
       plla.quantity_ordered,
       NVL(plla.quantity_received,0)   qty_received,
       plla.quantity_ordered - NVL(plla.quantity_received,0)  qty_open,
       pla.unit_price,
       pha.approved_date,
       pha.authorization_status
  FROM po_headers_all         pha
  JOIN ap_suppliers           aps  ON aps.vendor_id = pha.vendor_id
  JOIN po_lines_all           pla  ON pla.po_header_id = pha.po_header_id
  JOIN po_line_locations_all  plla ON plla.po_line_id   = pla.po_line_id
 WHERE pha.org_id             = :p_org_id
   AND pha.authorization_status = 'APPROVED'
   AND NVL(plla.cancel_flag,'N') != 'Y'
   AND plla.quantity_ordered > NVL(plla.quantity_received,0)
 ORDER BY pha.segment1, pla.line_num;`;
  }

  /* ── User / Security patterns ───────────────────── */
  if (p.includes('user') || p.includes('responsibility') || p.includes('role')) {
    return `/* FND Users with Responsibilities */
SELECT fu.user_name,
       fu.description               user_description,
       fu.email_address,
       fu.start_date,
       fu.end_date,
       frg.responsibility_name,
       frg.responsibility_key,
       fa.application_short_name,
       fur.start_date               resp_start,
       fur.end_date                 resp_end
  FROM fnd_users               fu
  JOIN fnd_user_resp_groups_all fur ON fur.user_id = fu.user_id
  JOIN fnd_responsibility_vl   frg ON frg.responsibility_id      = fur.responsibility_id
                                   AND frg.application_id         = fur.responsibility_application_id
  JOIN fnd_application         fa  ON fa.application_id = frg.application_id
 WHERE NVL(fu.end_date, SYSDATE+1)  > SYSDATE
   AND NVL(fur.end_date, SYSDATE+1) > SYSDATE
 ORDER BY fu.user_name, frg.responsibility_name;`;
  }

  /* ── DBA / DDL fallback ─────────────────────────── */
  if (p.includes('table') || p.includes('index') || p.includes('ddl') || p.includes('create')) {
    return `/* DDL — Create Table Template (Oracle EBS Custom) */
CREATE TABLE xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()}
(
    record_id          NUMBER         GENERATED ALWAYS AS IDENTITY,
    org_id             NUMBER         NOT NULL,     -- Operating Unit
    created_by         NUMBER         DEFAULT -1 NOT NULL,
    creation_date      DATE           DEFAULT SYSDATE NOT NULL,
    last_updated_by    NUMBER         DEFAULT -1 NOT NULL,
    last_update_date   DATE           DEFAULT SYSDATE NOT NULL,
    last_update_login  NUMBER,
    -- Add your columns here:
    description        VARCHAR2(240),
    status_code        VARCHAR2(30)   DEFAULT 'ACTIVE',
    attribute1         VARCHAR2(150),
    attribute2         VARCHAR2(150),
    CONSTRAINT xxcust_pk PRIMARY KEY (record_id),
    CONSTRAINT xxcust_org_fk FOREIGN KEY (org_id) REFERENCES hr_all_organization_units(organization_id)
)
TABLESPACE APPS_TS_TX_DATA
STORAGE (INITIAL 64K NEXT 64K PCTINCREASE 0);

-- Grant to APPS
GRANT SELECT, INSERT, UPDATE, DELETE ON xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()} TO APPS;

-- Create synonym
CREATE SYNONYM APPS.xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()}
    FOR xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()};

-- Create index
CREATE INDEX xxcust_idx1
    ON xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()}(org_id, status_code)
    TABLESPACE APPS_TS_TX_IDX;`;
  }

  /* ── Generic fallback ───────────────────────────── */
  } /* end if false */
  return '';
}

/* ─── Back to Welcome ────────────────────────────────────────────── */
function sqlLabBackToWelcome() {
  SQL_LAB_CURRENT_SQL = '';
  document.getElementById('sqlLabDisplay').style.display       = 'none';
  document.getElementById('sqlLabSearchResults').style.display = 'none';
  document.getElementById('sqlLabWelcome').style.display       = 'block';
  /* Clear the prompt textarea too so it feels fresh */
  const prompt = document.getElementById('sqlLabPrompt');
  if (prompt) prompt.value = '';
}

/* ─── Copy / Send actions ────────────────────────────────────────── */
function copySqlLabQuery() {
  if (!SQL_LAB_CURRENT_SQL) { showToast('No SQL loaded.', 'warning'); return; }
  navigator.clipboard.writeText(SQL_LAB_CURRENT_SQL).then(() => showToast('SQL copied to clipboard!', 'success'));
}

function sendSqlLabToAdvisor() {
  if (!SQL_LAB_CURRENT_SQL) { showToast('No SQL loaded.', 'warning'); return; }
  const ta = document.getElementById('sqlInputArea');
  if (ta) ta.value = SQL_LAB_CURRENT_SQL;
  switchTab('tab-sql', document.querySelector('[data-tab="tab-sql"]'));
  showToast('SQL sent to Performance Advisor', 'success');
}

function sendSqlLabToFormatter() {
  if (!SQL_LAB_CURRENT_SQL) { showToast('No SQL loaded.', 'warning'); return; }
  const ta = document.getElementById('sqlFormatterInput');
  if (ta) ta.value = SQL_LAB_CURRENT_SQL;
  switchTab('tab-sql', document.querySelector('[data-tab="tab-sql"]'));
  setTimeout(() => switchSQLSubTab('sql-formatter-tab', document.querySelector('[data-subtab="sql-formatter-tab"]')), 200);
  showToast('SQL sent to Code Formatter', 'success');
}

function escSqlLabId(s) { return String(s).replace(/['"]/g,''); }

/* =============================================================================
   SQL SYNTAX HIGHLIGHTING — lightweight Oracle keyword colouring
   ============================================================================= */
function syntaxHighlightSQL(code) {
  if (!code) return '';
  /* Escape HTML first */
  let s = code
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');

  /* Comments */
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sql-comment">$1</span>');
  s = s.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>');

  /* String literals */
  s = s.replace(/('(?:[^']|'')*')/g, '<span class="sql-string">$1</span>');

  /* Keywords */
  const kwds = ['SELECT','DISTINCT','FROM','WHERE','AND','OR','NOT','IN','EXISTS','BETWEEN',
    'LIKE','IS NULL','IS NOT NULL','CASE','WHEN','THEN','ELSE','END',
    'INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN','JOIN',
    'ON','USING','GROUP BY','ORDER BY','HAVING','UNION ALL','UNION','INTERSECT','MINUS',
    'INSERT INTO','INSERT','VALUES','UPDATE','SET','DELETE FROM','DELETE',
    'CREATE OR REPLACE','CREATE','ALTER','DROP','TRUNCATE','GRANT','REVOKE',
    'WITH','AS','MERGE INTO','MERGE',
    'BEGIN','END','DECLARE','EXCEPTION','RETURN','PROCEDURE','FUNCTION',
    'PACKAGE BODY','PACKAGE','IS','LOOP','FOR','WHILE','IF','ELSIF','COMMIT','ROLLBACK','SAVEPOINT',
    'FETCH','CURSOR','OPEN','CLOSE','BULK COLLECT','FORALL','EXECUTE IMMEDIATE',
    'SYSDATE','TRUNC','ROUND','NVL','NVL2','DECODE','COALESCE','TO_DATE','TO_CHAR','TO_NUMBER',
    'COUNT','SUM','MAX','MIN','AVG','ROW_NUMBER','RANK','DENSE_RANK','OVER','PARTITION BY',
    'ROWNUM','ROWID','NULL','TRUE','FALSE','NUMBER','VARCHAR2','DATE','CHAR','CLOB','BLOB'];

  kwds.sort((a,b)=>b.length-a.length).forEach(kw => {
    const re = new RegExp(`\\b(${kw.replace(/ /g,'\\s+')})\\b`, 'gi');
    s = s.replace(re, '<span class="sql-kw">$1</span>');
  });

  /* Bind variables */
  s = s.replace(/(:[\w_]+)/g, '<span class="sql-bind">$1</span>');

  /* Numbers */
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="sql-num">$1</span>');

  return s;
}


/* =============================================================================
   EBS ACADEMY — INITIALISATION
   ============================================================================= */
function initAcademy() {
  renderAcademyModuleTree();
  renderAcademyModuleCards();
}

function renderAcademyModuleTree() {
  const treeEl = document.getElementById('academyModuleTree');
  if (!treeEl || !window.EBS_ACADEMY) return;

  let html = '';
  window.EBS_ACADEMY.modules.forEach(mod => {
    html += `<div class="academy-mod-group">
      <div class="academy-mod-header" onclick="toggleAcademyMod(this)"
           style="border-left: 3px solid ${mod.color};">
        <span>${mod.icon}</span>
        <span class="academy-mod-label">${escHTML(mod.label)}</span>
        <svg class="academy-chevron" viewBox="0 0 24 24" fill="none" width="12">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2"/>
        </svg>
      </div>
      <div class="academy-mod-topics">`;
    mod.topics.forEach(topic => {
      html += `<div class="academy-topic-item" onclick="loadAcademyTopic('${escHTML(mod.id)}','${escHTML(topic.id)}')">
        <span class="academy-topic-dot" style="background:${mod.color}"></span>
        ${escHTML(topic.label)}
      </div>`;
    });
    html += `</div></div>`;
  });
  treeEl.innerHTML = html;
}

function toggleAcademyMod(headerEl) {
  const group = headerEl.closest('.academy-mod-group');
  group.classList.toggle('expanded');
}

function renderAcademyModuleCards() {
  const cardsEl = document.getElementById('academyModuleCards');
  if (!cardsEl || !window.EBS_ACADEMY) return;

  cardsEl.innerHTML = window.EBS_ACADEMY.modules.map(mod => `
    <div class="academy-card" onclick="loadAcademyTopic('${escHTML(mod.id)}','${escHTML(mod.topics[0].id)}')"
         style="border-top: 4px solid ${mod.color};">
      <div class="academy-card-icon">${mod.icon}</div>
      <h3>${escHTML(mod.label)}</h3>
      <p>${escHTML(mod.desc)}</p>
      <div class="academy-card-topics">${mod.topics.length} topic${mod.topics.length !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
}

/* ─── Load a specific topic into the content area ────────────────── */
function loadAcademyTopic(moduleId, topicId) {
  if (!window.EBS_ACADEMY) return;

  const mod   = window.EBS_ACADEMY.modules.find(m => m.id === moduleId);
  if (!mod) return;
  const topic = mod.topics.find(t => t.id === topicId);
  if (!topic) return;

  ACADEMY_CURRENT_MODULE = mod;
  ACADEMY_CURRENT_TOPIC  = topic;
  ACADEMY_CURRENT_SQL    = topic.content.sql || '';

  /* ── Show content, hide welcome ───────────────────────────────── */
  document.getElementById('academyWelcome').style.display  = 'none';
  const contentEl = document.getElementById('academyContent');
  contentEl.style.display = 'block';

  /* ── Scroll content area to top on every topic switch ─────────── */
  contentEl.scrollTop = 0;
  const contentArea = document.getElementById('academyContentArea');
  if (contentArea) contentArea.scrollTop = 0;

  /* ── Breadcrumb ───────────────────────────────────────────────── */
  document.getElementById('academyBreadcrumb').innerHTML =
    `<span class="academy-bc-home" onclick="showAcademyWelcome()">🎓 Academy</span>
     <span class="academy-bc-sep">›</span>
     <span class="academy-bc-mod" style="color:${mod.color}" onclick="loadAcademyTopic('${mod.id}','${mod.topics[0].id}')">${mod.icon} ${escHTML(mod.label)}</span>
     <span class="academy-bc-sep">›</span>
     <span class="academy-bc-topic">${escHTML(topic.label)}</span>`;

  /* ── Title & summary ──────────────────────────────────────────── */
  document.getElementById('academyTopicTitle').textContent   = topic.label;
  document.getElementById('academyTopicSummary').textContent = topic.content.summary || '';

  /* ── Functional list ──────────────────────────────────────────── */
  const fnEl = document.getElementById('academyFunctional');
  fnEl.innerHTML = (topic.content.functional || []).map(f =>
    `<li>${escHTML(f)}</li>`).join('');

  /* ── Technical list ───────────────────────────────────────────── */
  const techEl = document.getElementById('academyTechnical');
  techEl.innerHTML = (topic.content.technical || []).map(t =>
    `<li>${escHTML(t)}</li>`).join('');

  /* ── Inline diagram (always visible below the two columns) ────── */
  const diagArea = document.getElementById('academyDiagramArea');
  const diagBtn  = document.getElementById('academyDiagramToggle');
  if (diagArea) {
    const svg = _getTopicFlowchart(mod.id, topicId);
    if (svg) {
      diagArea.innerHTML  = svg;
      diagArea.style.display = 'block';
      if (diagBtn) diagBtn.textContent = '▲ Hide Diagram';
    } else {
      diagArea.innerHTML     = `<p style="color:#8B9EAE;font-size:0.82rem;padding:8px 0;">No diagram for this topic yet — ask the <strong>🤖 EBS Assistant</strong> to explain with a flowchart.</p>`;
      diagArea.style.display = 'block';
      if (diagBtn) diagBtn.textContent = '▲ Hide Diagram';
    }
  }

  /* ── SQL block ────────────────────────────────────────────────── */
  const sqlEl = document.getElementById('academySqlBlock');
  sqlEl.innerHTML = syntaxHighlightSQL(topic.content.sql || '');

  /* ── Topic navigation ─────────────────────────────────────────── */
  const allTopics = mod.topics;
  const idx       = allTopics.findIndex(t => t.id === topicId);
  const prev      = allTopics[idx - 1];
  const next      = allTopics[idx + 1];
  const navEl     = document.getElementById('academyTopicNav');
  let navHtml     = '';
  if (prev) navHtml += `<button class="academy-nav-btn prev" onclick="loadAcademyTopic('${mod.id}','${prev.id}')">◀ ${escHTML(prev.label)}</button>`;
  if (next) navHtml += `<button class="academy-nav-btn next" onclick="loadAcademyTopic('${mod.id}','${next.id}')">${escHTML(next.label)} ▶</button>`;
  navEl.innerHTML = navHtml;

  /* Highlight in sidebar */
  document.querySelectorAll('.academy-topic-item').forEach(el => {
    const oc = el.getAttribute('onclick') || '';
    el.classList.toggle('active', oc.includes(`'${topicId}'`));
  });

  /* Expand the module group */
  document.querySelectorAll('.academy-mod-group').forEach(g => {
    const header = g.querySelector('.academy-mod-header');
    if (header && header.textContent.includes(mod.label)) g.classList.add('expanded');
  });
}

function showAcademyWelcome() {
  document.getElementById('academyWelcome').style.display = 'block';
  document.getElementById('academyContent').style.display = 'none';
}

/* ─── Academy Search ─────────────────────────────────────────────── */
function searchAcademy(term) {
  if (!term || term.trim().length < 2) return;
  term = term.toLowerCase();
  if (!window.EBS_ACADEMY) return;

  const results = [];
  window.EBS_ACADEMY.modules.forEach(mod => {
    mod.topics.forEach(topic => {
      const haystack = `${mod.label} ${topic.label} ${topic.content.summary || ''} ${(topic.content.functional||[]).join(' ')} ${(topic.content.technical||[]).join(' ')}`.toLowerCase();
      if (haystack.includes(term)) results.push({ mod, topic });
    });
  });

  if (results.length > 0) {
    loadAcademyTopic(results[0].mod.id, results[0].topic.id);
    showToast(`Found ${results.length} topic${results.length>1?'s':''} matching "${term}"`, 'info');
  } else {
    showToast(`No topics found for "${term}"`, 'warning');
  }
}

/* ─── Academy SQL Actions ────────────────────────────────────────── */
function copyAcademySql() {
  if (!ACADEMY_CURRENT_SQL) { showToast('No SQL for this topic.', 'warning'); return; }
  navigator.clipboard.writeText(ACADEMY_CURRENT_SQL).then(() => showToast('SQL copied!', 'success'));
}

function sendAcademySqlToAdvisor() {
  if (!ACADEMY_CURRENT_SQL) { showToast('No SQL for this topic.', 'warning'); return; }
  const ta = document.getElementById('sqlInputArea');
  if (ta) ta.value = ACADEMY_CURRENT_SQL;
  switchTab('tab-sql', document.querySelector('[data-tab="tab-sql"]'));
  showToast('SQL sent to Performance Advisor', 'success');
}



/* =============================================================================
   ███████╗ ██████╗ ██╗          ██████╗ ███████╗███╗   ██╗    ██╗   ██╗██████╗ 
   ██╔════╝██╔═══██╗██║         ██╔════╝ ██╔════╝████╗  ██║    ██║   ██║╚════██╗
   ███████╗██║   ██║██║         ██║  ███╗█████╗  ██╔██╗ ██║    ██║   ██║ █████╔╝
   ╚════██║██║   ██║██║         ██║   ██║██╔══╝  ██║╚██╗██║    ██║   ██║██╔═══╝ 
   ███████║╚██████╔╝███████╗    ╚██████╔╝███████╗██║ ╚████║    ╚██████╔╝███████╗
   ╚══════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚══════╝╚═╝  ╚═══╝     ╚═════╝ ╚══════╝
   ENHANCED SQL GENERATOR v2 — 50+ EBS patterns + alerts + FND + workflows
   ============================================================================= */

/* Redefine buildGeneratedSQL with 50+ more patterns */
function buildGeneratedSQL(prompt) {
  const p = prompt.toLowerCase();

  /* ── ALERTS / FND_MESSAGE / LOGGING patterns ──────────────────── */
  if (p.includes('alert') || p.includes('fnd_message')) {
    return `/* Oracle EBS Alerts / FND_MESSAGE Query */
-- All alerts raised in the last 7 days:
SELECT aat.alert_name,
       aat.description,
       aap.action_set_name,
       aaa.created_by,
       aaa.creation_date,
       aaa.message
  FROM alr_alert_actions       aaa
  JOIN alr_actions             aat ON aat.action_id = aaa.action_id
  LEFT JOIN alr_action_sets    aap ON aap.action_set_id = aaa.action_set_id
 WHERE aaa.creation_date >= SYSDATE - 7
 ORDER BY aaa.creation_date DESC;

-- Check FND_MESSAGE for a specific application/message:
SELECT fam.message_name,
       fam.message_text,
       fam.description,
       fa.application_short_name
  FROM fnd_new_messages fam
  JOIN fnd_application  fa  ON fa.application_id = fam.application_id
 WHERE fa.application_short_name = :p_app_short_name  -- e.g. 'AR','AP','GL'
   AND fam.message_name LIKE :p_msg_pattern           -- e.g. '%INVOICE%'
 ORDER BY fam.message_name;`;
  }

  /* ── WORKFLOW / Approvals / Notifications ──────────────────────── */
  if (p.includes('workflow') || p.includes('notification') || p.includes('stuck workflow')) {
    return `/* Oracle Workflow — Stuck / Errored Notifications */
SELECT wi.item_type,
       wi.item_key,
       wias.activity_label,
       wias.activity_status,
       wias.activity_result_code,
       wias.error_name,
       wias.error_message,
       wias.begin_date,
       wn.subject               notification_subject,
       wn.recipient_role,
       wn.status                notification_status
  FROM wf_item_activity_statuses  wias
  JOIN wf_items                   wi  ON wi.item_type = wias.item_type
                                      AND wi.item_key  = wias.item_key
  LEFT JOIN wf_notifications      wn  ON wn.item_type = wias.item_type
                                      AND wn.item_key  = wias.item_key
 WHERE wias.activity_status IN ('ERROR','NOTIFIED')
   AND wias.begin_date >= SYSDATE - 30
 ORDER BY wias.begin_date DESC;

-- Purge stuck workflow items (run as concurrent program):
-- WFBKG: Workflow Background Process
-- WFERROR: Workflow Notification Error Report`;
  }

  /* ── VALUE SETS / LOV / Flexfield Validation ───────────────────── */
  if (p.includes('value set') || p.includes('valueset') || p.includes('lov') || p.includes('list of values')) {
    return `/* Oracle EBS Value Sets — Independent & Table-based */
-- Find a value set by name:
SELECT ffvs.flex_value_set_id,
       ffvs.flex_value_set_name,
       ffvs.description,
       ffvs.validation_type,     -- I=Independent, F=Table, N=None
       ffvt.value_column_name,
       ffvt.application_table_name,
       ffvt.where_order_by
  FROM fnd_flex_value_sets      ffvs
  LEFT JOIN fnd_flex_validation_tables ffvt ON ffvt.flex_value_set_id = ffvs.flex_value_set_id
 WHERE UPPER(ffvs.flex_value_set_name) LIKE :p_valueset_pattern  -- e.g. '%COST%CENTER%'
 ORDER BY ffvs.flex_value_set_name;

-- Get all values from an independent value set:
SELECT ffv.flex_value_id,
       ffv.flex_value,
       ffv.flex_value_meaning,
       ffv.description,
       ffv.enabled_flag,
       ffv.start_date_active,
       ffv.end_date_active
  FROM fnd_flex_values ffv
  JOIN fnd_flex_value_sets ffvs ON ffvs.flex_value_set_id = ffv.flex_value_set_id
 WHERE ffvs.flex_value_set_name = :p_valueset_name
   AND ffv.enabled_flag = 'Y'
   AND NVL(ffv.end_date_active, SYSDATE+1) > SYSDATE
 ORDER BY ffv.flex_value;`;
  }

  /* ── CONCURRENT PROGRAMS (request_id, long-running, etc.) ─────── */
  if (p.includes('concurrent') && (p.includes('request id') || p.includes('request_id'))) {
    return `/* Concurrent Programs by Request ID */
SELECT fcr.request_id,
       fcpv.user_concurrent_program_name    program_name,
       fcp.concurrent_program_name          short_name,
       fcr.status_code,
       DECODE(fcr.status_code,
              'C','Completed','R','Running','P','Pending',
              'E','Error','T','Terminating', fcr.status_code) status_desc,
       fcr.requested_start_date,
       fcr.actual_start_date,
       fcr.actual_completion_date,
       ROUND((fcr.actual_completion_date - fcr.actual_start_date)*1440, 2) runtime_mins,
       fcr.logfile_name,
       fcr.outfile_name,
       fcr.argument_text                    parameters
  FROM fnd_concurrent_requests       fcr
  JOIN fnd_concurrent_programs       fcp  ON fcp.concurrent_program_id  = fcr.concurrent_program_id
                                          AND fcp.application_id         = fcr.program_application_id
  JOIN fnd_concurrent_programs_vl    fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                          AND fcpv.application_id        = fcp.application_id
 WHERE fcr.request_id = :p_request_id   -- replace with actual request ID
    OR fcr.parent_request_id = :p_request_id
 ORDER BY fcr.request_id;`;
  }

  if (p.includes('long running') || p.includes('long-running') || p.includes('slow concurrent')) {
    return `/* Long Running Concurrent Programs — Last 30 days */
SELECT fcpv.user_concurrent_program_name          program_name,
       fcr.status_code,
       COUNT(*)                                   run_count,
       ROUND(AVG((fcr.actual_completion_date - fcr.actual_start_date)*1440),2) avg_mins,
       ROUND(MAX((fcr.actual_completion_date - fcr.actual_start_date)*1440),2) max_mins
  FROM fnd_concurrent_requests    fcr
  JOIN fnd_concurrent_programs    fcp  ON fcp.concurrent_program_id = fcr.concurrent_program_id
  JOIN fnd_concurrent_programs_vl fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
 WHERE fcr.actual_start_date      IS NOT NULL
   AND fcr.actual_completion_date IS NOT NULL
   AND fcr.actual_start_date      >= SYSDATE - 30
   AND (fcr.actual_completion_date - fcr.actual_start_date)*1440 > :p_mins  -- e.g. 30
 GROUP BY fcpv.user_concurrent_program_name, fcr.status_code
 ORDER BY avg_mins DESC;`;
  }

  if (p.includes('responsibility') && p.includes('concurrent')) {
    return `/* Responsibilities Attached to Concurrent Programs */
SELECT fa.application_short_name,
       fcp.concurrent_program_name          short_name,
       fcpv.user_concurrent_program_name    program_name,
       frg.responsibility_name,
       frg.responsibility_key,
       fro.request_group_name
  FROM fnd_concurrent_programs       fcp
  JOIN fnd_concurrent_programs_vl    fcpv ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                          AND fcpv.application_id        = fcp.application_id
  JOIN fnd_application               fa   ON fa.application_id = fcp.application_id
  JOIN fnd_request_group_units       frgu ON frgu.request_unit_id = fcp.concurrent_program_id
                                          AND frgu.unit_application_id   = fcp.application_id
                                          AND frgu.request_unit_type     = 'P'
  JOIN fnd_request_groups            fro  ON fro.request_group_id = frgu.request_group_id
  JOIN fnd_responsibility_vl         frg  ON frg.request_group_id  = fro.request_group_id
 ORDER BY fa.application_short_name, fcp.concurrent_program_name;`;
  }

  if (p.includes('request set')) {
    return `/* Request Sets and Member Programs */
SELECT frs.request_set_name,
       frsvl.user_request_set_name,
       frsb.stage_name,
       frsb.sequence,
       fcpv.user_concurrent_program_name  program_name,
       fcp.concurrent_program_name        short_name,
       frsb.critical
  FROM fnd_request_sets              frs
  JOIN fnd_request_sets_vl           frsvl ON frsvl.request_set_id = frs.request_set_id
  JOIN fnd_request_set_stages        frss  ON frss.request_set_id  = frs.request_set_id
  JOIN fnd_request_set_stage_members frsb  ON frsb.request_set_stage_id = frss.request_set_stage_id
  JOIN fnd_concurrent_programs       fcp   ON fcp.concurrent_program_id = frsb.concurrent_program_id
  JOIN fnd_concurrent_programs_vl    fcpv  ON fcpv.concurrent_program_id = fcp.concurrent_program_id
                                           AND fcpv.application_id        = fcp.application_id
 ORDER BY frs.request_set_name, frsb.sequence;`;
  }

  /* ── PROFILE OPTIONS ───────────────────────────────────────────── */
  if (p.includes('profile') || p.includes('profile option')) {
    return `/* FND Profile Options — User/Responsibility/Site Level */
SELECT fpo.profile_option_name  short_name,
       fpot.user_profile_option_name,
       fpov.level_id,         -- 10001=Site, 10002=Application, 10003=Resp, 10004=User
       DECODE(fpov.level_id,
              10001,'Site',10002,'Application',10003,'Responsibility',10004,'User', 
              TO_CHAR(fpov.level_id)) level_name,
       fpov.profile_option_value,
       fpov.level_value,
       fpov.level_value_application_id
  FROM fnd_profile_options      fpo
  JOIN fnd_profile_option_values fpov ON fpov.profile_option_id = fpo.profile_option_id
  JOIN fnd_profile_options_tl    fpot ON fpot.profile_option_name = fpo.profile_option_name
                                      AND fpot.language = USERENV('LANG')
 WHERE UPPER(fpot.user_profile_option_name) LIKE :p_profile_pattern   -- e.g. '%ORG%'
    OR UPPER(fpo.profile_option_name) LIKE :p_profile_pattern
 ORDER BY fpo.profile_option_name, fpov.level_id;

-- Get a specific profile value for current user/responsibility:
SELECT fnd_profile.value('PROFILE_OPTION_NAME') profile_value
  FROM dual;`;
  }

  /* ── AP / INVOICE patterns ──────────────────────────────────────── */
  if (p.includes('invoice') && (p.includes('payab') || p.includes(' ap '))) {
    return `/* Accounts Payable — Invoice Register */
SELECT aia.invoice_num,
       aia.invoice_date,
       aia.invoice_type_lookup_code      invoice_type,
       aps.vendor_name,
       apss.vendor_site_code,
       aia.invoice_amount,
       aia.amount_paid,
       aia.invoice_amount - NVL(aia.amount_paid,0)  outstanding,
       aia.payment_status_flag,
       aia.approval_status_lookup_code   approval_status,
       aia.currency_code,
       aia.creation_date,
       aia.created_by
  FROM ap_invoices_all   aia
  JOIN ap_suppliers      aps  ON aps.vendor_id       = aia.vendor_id
  JOIN ap_supplier_sites_all apss ON apss.vendor_site_id = aia.vendor_site_id
 WHERE aia.org_id       = :p_org_id
   AND aia.invoice_date >= :p_from_date
   AND aia.invoice_date <= :p_to_date
   AND NVL(aia.cancelled_date, SYSDATE+1) > SYSDATE   -- exclude cancelled
 ORDER BY aia.invoice_date DESC, aps.vendor_name;`;
  }

  /* ── AR / CUSTOMER patterns ─────────────────────────────────────── */
  if (p.includes('customer') || (p.includes('receipt') && p.includes('ar'))) {
    return `/* Accounts Receivable — Customer Outstanding Balance */
SELECT hca.account_number,
       hp.party_name              customer_name,
       rct.trx_number,
       rct.trx_date,
       aps.due_date,
       aps.amount_due_original,
       aps.amount_due_remaining,
       aps.status,
       TRUNC(SYSDATE) - aps.due_date   days_overdue
  FROM ar_payment_schedules_all  aps
  JOIN ra_customer_trx_all       rct ON rct.customer_trx_id = aps.customer_trx_id
  JOIN hz_cust_accounts          hca ON hca.cust_account_id = rct.bill_to_customer_id
  JOIN hz_parties                hp  ON hp.party_id = hca.party_id
 WHERE aps.status    = 'OP'
   AND aps.org_id    = :p_org_id
   AND rct.trx_date >= :p_from_date
 ORDER BY hp.party_name, aps.due_date;`;
  }

  /* ── GL / JOURNAL patterns ──────────────────────────────────────── */
  if (p.includes('journal') || p.includes('gl ') || p.includes('ledger')) {
    return `/* General Ledger — Journal Entry Detail */
SELECT gljh.je_header_id,
       gljh.name                  journal_name,
       gljh.description,
       gljh.period_name,
       gljh.je_category,
       gljh.je_source,
       gljh.status,
       gljl.je_line_num,
       gcc.segment1               company,
       gcc.segment2               cost_center,
       gcc.segment3               account,
       gljl.entered_dr,
       gljl.entered_cr,
       gljl.description           line_desc
  FROM gl_je_headers          gljh
  JOIN gl_je_lines             gljl ON gljl.je_header_id = gljh.je_header_id
  JOIN gl_code_combinations    gcc  ON gcc.code_combination_id = gljl.code_combination_id
 WHERE gljh.ledger_id   = :p_ledger_id
   AND gljh.period_name = :p_period_name
   AND gljh.status      = 'P'   -- Posted journals
 ORDER BY gljh.name, gljl.je_line_num;`;
  }

  /* ── HRMS / EMPLOYEE patterns ───────────────────────────────────── */
  if (p.includes('employee') || p.includes('hrms') || p.includes('worker')) {
    return `/* HRMS — Active Employee Directory */
SELECT papf.employee_number,
       papf.full_name,
       papf.national_identifier   ssn_or_national_id,
       papf.date_of_birth,
       papf.hire_date,
       haou.name                  organization_name,
       pj.name                    job_name,
       pg.name                    grade_name,
       pos.name                   position_name,
       ppf2.full_name             supervisor_name,
       paaf.assignment_number,
       paaf.assignment_status_type_id
  FROM per_all_people_f          papf
  JOIN per_all_assignments_f     paaf  ON paaf.person_id = papf.person_id
  JOIN hr_all_organization_units haou  ON haou.organization_id = paaf.organization_id
  LEFT JOIN per_jobs             pj    ON pj.job_id = paaf.job_id
  LEFT JOIN per_grades           pg    ON pg.grade_id = paaf.grade_id
  LEFT JOIN per_all_positions    pos   ON pos.position_id = paaf.position_id
  LEFT JOIN per_all_people_f     ppf2  ON ppf2.person_id = paaf.supervisor_id
                                      AND TRUNC(SYSDATE) BETWEEN ppf2.effective_start_date AND ppf2.effective_end_date
 WHERE paaf.primary_flag     = 'Y'
   AND paaf.assignment_type  = 'E'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
 ORDER BY papf.full_name;`;
  }

  /* ── PAYROLL patterns ───────────────────────────────────────────── */
  if (p.includes('payroll') || p.includes('payslip') || p.includes('element')) {
    return `/* Payroll — Employee Element Entry Values */
SELECT papf.employee_number,
       papf.full_name,
       pet.element_name,
       petf.name           input_value_name,
       peev.screen_entry_value,
       pee.effective_start_date  entry_from,
       pee.effective_end_date    entry_to,
       pet.processing_type       -- R=Recurring N=Non-Recurring
  FROM per_all_people_f          papf
  JOIN per_all_assignments_f     paaf  ON paaf.person_id = papf.person_id
  JOIN pay_element_entries_f     pee   ON pee.assignment_id = paaf.assignment_id
  JOIN pay_element_entry_values_f peev ON peev.element_entry_id = pee.element_entry_id
  JOIN pay_input_values_f        petf  ON petf.input_value_id = peev.input_value_id
  JOIN pay_element_types_f       pet   ON pet.element_type_id = petf.element_type_id
 WHERE paaf.primary_flag = 'Y'
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pee.effective_start_date  AND pee.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN peev.effective_start_date AND peev.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN petf.effective_start_date AND petf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN pet.effective_start_date  AND pet.effective_end_date
 ORDER BY papf.full_name, pet.element_name;`;
  }

  /* ── PO / SCM patterns ──────────────────────────────────────────── */
  if (p.includes('purchase order') || p.includes(' po ') || p.includes('requisition') || p.includes('receipt')) {
    return `/* Purchasing — Open PO Lines with Receipt Status */
SELECT pha.segment1               po_number,
       pha.type_lookup_code       po_type,
       aps.vendor_name,
       pla.line_num,
       pla.item_description,
       plla.quantity_ordered,
       NVL(plla.quantity_received,0)   qty_received,
       plla.quantity_ordered - NVL(plla.quantity_received,0)  qty_open,
       pla.unit_price,
       pha.approved_date,
       pha.authorization_status
  FROM po_headers_all         pha
  JOIN ap_suppliers           aps  ON aps.vendor_id = pha.vendor_id
  JOIN po_lines_all           pla  ON pla.po_header_id = pha.po_header_id
  JOIN po_line_locations_all  plla ON plla.po_line_id   = pla.po_line_id
 WHERE pha.org_id             = :p_org_id
   AND pha.authorization_status = 'APPROVED'
   AND NVL(plla.cancel_flag,'N') != 'Y'
   AND plla.quantity_ordered > NVL(plla.quantity_received,0)
 ORDER BY pha.segment1, pla.line_num;`;
  }

  /* ── USER / RESPONSIBILITY / SECURITY patterns ──────────────────── */
  if (p.includes('user') || p.includes('responsibility') || p.includes('role')) {
    return `/* FND Users with Responsibilities */
SELECT fu.user_name,
       fu.description               user_description,
       fu.email_address,
       fu.start_date,
       fu.end_date,
       frg.responsibility_name,
       frg.responsibility_key,
       fa.application_short_name,
       fur.start_date               resp_start,
       fur.end_date                 resp_end
  FROM fnd_users               fu
  JOIN fnd_user_resp_groups_all fur ON fur.user_id = fu.user_id
  JOIN fnd_responsibility_vl   frg ON frg.responsibility_id      = fur.responsibility_id
                                   AND frg.application_id         = fur.responsibility_application_id
  JOIN fnd_application         fa  ON fa.application_id = frg.application_id
 WHERE NVL(fu.end_date, SYSDATE+1)  > SYSDATE
   AND NVL(fur.end_date, SYSDATE+1) > SYSDATE
 ORDER BY fu.user_name, frg.responsibility_name;`;
  }

  /* ── DBA / DDL fallback ─────────────────────────────────────────── */
  if (p.includes('table') || p.includes('index') || p.includes('ddl') || p.includes('create')) {
    return `/* DDL — Create Table Template (Oracle EBS Custom) */
CREATE TABLE xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()}
(
    record_id          NUMBER         GENERATED ALWAYS AS IDENTITY,
    org_id             NUMBER         NOT NULL,     -- Operating Unit
    created_by         NUMBER         DEFAULT -1 NOT NULL,
    creation_date      DATE           DEFAULT SYSDATE NOT NULL,
    last_updated_by    NUMBER         DEFAULT -1 NOT NULL,
    last_update_date   DATE           DEFAULT SYSDATE NOT NULL,
    last_update_login  NUMBER,
    -- Add your columns here:
    description        VARCHAR2(240),
    status_code        VARCHAR2(30)   DEFAULT 'ACTIVE',
    attribute1         VARCHAR2(150),
    attribute2         VARCHAR2(150),
    CONSTRAINT xxcust_pk PRIMARY KEY (record_id),
    CONSTRAINT xxcust_org_fk FOREIGN KEY (org_id) REFERENCES hr_all_organization_units(organization_id)
)
TABLESPACE APPS_TS_TX_DATA
STORAGE (INITIAL 64K NEXT 64K PCTINCREASE 0);

-- Grant to APPS
GRANT SELECT, INSERT, UPDATE, DELETE ON xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()} TO APPS;

-- Create synonym
CREATE SYNONYM APPS.xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()}
    FOR xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()};

-- Create index
CREATE INDEX xxcust_idx1
    ON xxcust_${prompt.replace(/[^a-z0-9]/gi,'_').substring(0,20).toUpperCase()}(org_id, status_code)
    TABLESPACE APPS_TS_TX_IDX;`;
  }

  /* ── No keyword matched — return '' so generateSqlFromPrompt handles it ── */
  return '';
}


/* =============================================================================
   ███████╗██████╗ ███████╗     █████╗  ██████╗ █████╗ ██████╗ ███████╗███╗   ███╗██╗   ██╗
   ██╔════╝██╔══██╗██╔════╝    ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝████╗ ████║╚██╗ ██╔╝
   █████╗  ██████╔╝███████╗    ███████║██║     ███████║██║  ██║█████╗  ██╔████╔██║ ╚████╔╝ 
   ██╔══╝  ██╔══██╗╚════██║    ██╔══██║██║     ██╔══██║██║  ██║██╔══╝  ██║╚██╔╝██║  ╚██╔╝  
   ███████╗██████╔╝███████║    ██║  ██║╚██████╗██║  ██║██████╔╝███████╗██║ ╚═╝ ██║   ██║   
   ╚══════╝╚═════╝ ╚══════╝    ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝     ╚═╝   ╚═╝   
   AI ASSISTANT — Explains any EBS topic + generates flowcharts
   ============================================================================= */

let ACADEMY_ASST_HISTORY = [];

function initAcademyAssistant() {
  const msgEl = document.getElementById('academyAsstMessages');
  if (!msgEl) return;
  if (msgEl.innerHTML.trim()) return; // already init

  ACADEMY_ASST_HISTORY = [
    { role: 'assistant', text: `👋 Hi! I'm the **EBS Academy Assistant**. Ask me anything about Oracle EBS R12+ — functional cycles, technical tables, SQL examples, implementation steps, or request flowcharts for processes like **P2P**, **O2C**, **Hire-to-Retire**, **Period Close**, etc.

Try: "Explain AP Invoice Approval flow with diagram" or "How does HRMS DateTrack work?"` }
  ];

  msgEl.innerHTML = renderAsstHistory();
  msgEl.scrollTop = msgEl.scrollHeight;
}

function openAcademyAssistant() {
  const panel = document.getElementById('academyAsstPanel');
  if (!panel) return;
  /* Strip any legacy inline styles that fight the CSS */
  panel.classList.remove('hidden');
  panel.style.removeProperty('display');
  panel.style.removeProperty('width');
  panel.style.removeProperty('height');
  panel.style.removeProperty('position');
  panel.classList.add('open');
  initAcademyAssistant();
  /* Ensure messages scroll to bottom after open */
  setTimeout(() => {
    const msgEl = document.getElementById('academyAsstMessages');
    if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
    const inp = document.getElementById('academyAsstInput');
    if (inp) inp.focus();
  }, 350);
}

function closeAcademyAssistant() {
  const panel = document.getElementById('academyAsstPanel');
  if (!panel) return;
  panel.classList.remove('open');
  /* Strip any inline overrides that might have been applied */
  panel.style.removeProperty('width');
  panel.style.removeProperty('height');
}

/* ─── Lightweight Markdown → HTML renderer ──────────────────────── */
function _mdToHtml(text) {
  if (!text) return '';

  /* Split into logical blocks first (blank-line separated) */
  const blocks = text.split(/\n{2,}/);

  return blocks.map(block => {
    const lines = block.split('\n');

    /* ── Numbered list block ────────────────────────────────────── */
    if (lines.every(l => /^\s*\d+[\.\)]\s/.test(l.trim()) || l.trim() === '')) {
      const items = lines.filter(l => l.trim()).map(l => {
        const content = l.trim().replace(/^\d+[\.\)]\s+/, '');
        return `<li>${_mdInline(content)}</li>`;
      });
      return `<ol>${items.join('')}</ol>`;
    }

    /* ── Bullet list block ──────────────────────────────────────── */
    if (lines.every(l => /^\s*[-*•]\s/.test(l.trim()) || l.trim() === '')) {
      const items = lines.filter(l => l.trim()).map(l => {
        const content = l.trim().replace(/^[-*•]\s+/, '');
        return `<li>${_mdInline(content)}</li>`;
      });
      return `<ul>${items.join('')}</ul>`;
    }

    /* ── Mixed block: detect line-by-line ───────────────────────── */
    const hasListLines = lines.some(l => /^\s*(\d+[\.\)]|[-*•])\s/.test(l.trim()));
    if (hasListLines) {
      let html = '';
      let inOl = false, inUl = false;
      lines.forEach(l => {
        const t = l.trim();
        if (!t) { /* close any open list */ if (inOl) { html += '</ol>'; inOl = false; } if (inUl) { html += '</ul>'; inUl = false; } return; }
        if (/^\d+[\.\)]\s/.test(t)) {
          if (inUl) { html += '</ul>'; inUl = false; }
          if (!inOl) { html += '<ol>'; inOl = true; }
          html += `<li>${_mdInline(t.replace(/^\d+[\.\)]\s+/, ''))}</li>`;
        } else if (/^[-*•]\s/.test(t)) {
          if (inOl) { html += '</ol>'; inOl = false; }
          if (!inUl) { html += '<ul>'; inUl = true; }
          html += `<li>${_mdInline(t.replace(/^[-*•]\s+/, ''))}</li>`;
        } else {
          if (inOl) { html += '</ol>'; inOl = false; }
          if (inUl) { html += '</ul>'; inUl = false; }
          html += `<p>${_mdInline(t)}</p>`;
        }
      });
      if (inOl) html += '</ol>';
      if (inUl) html += '</ul>';
      return html;
    }

    /* ── Plain paragraph ────────────────────────────────────────── */
    const joined = lines.join(' ').trim();
    if (!joined) return '';
    return `<p>${_mdInline(joined)}</p>`;
  }).join('');
}

/* Inline markdown: **bold**, *italic*, `code`, bare numbered items */
function _mdInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code class="asst-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,   '<em>$1</em>')
    .replace(/__(.*?)__/g,      '<strong>$1</strong>');
}

function renderAsstHistory() {
  return ACADEMY_ASST_HISTORY.map(msg => {
    const cls    = msg.role === 'user' ? 'asst-msg user' : 'asst-msg';
    const avatar = msg.role === 'user' ? '👤' : '🤖';
    /* Convert markdown text to clean HTML bullets/numbering */
    const htmlText = msg.role === 'user'
      ? `<p>${escHTML(msg.text.replace(/<[^>]+>/g,''))}</p>`
      : _mdToHtml(msg.text);
    let bubble = `<div class="asst-msg-bubble">${htmlText}`;
    if (msg.sql)       bubble += `<code class="asst-sql-snippet">${escHTML(msg.sql)}</code>`;
    if (msg.flowchart) bubble += `<div class="asst-flowchart">${msg.flowchart}</div>`;
    bubble += `</div>`;
    return `<div class="${cls}"><div class="asst-msg-avatar">${avatar}</div>${bubble}</div>`;
  }).join('');
}

function askAcademyAssistant(q) {
  document.getElementById('academyAsstInput').value = q;
  sendAcademyAsstMessage();
}

function sendAcademyAsstMessage() {
  const inp = document.getElementById('academyAsstInput');
  const q = (inp.value || '').trim();
  if (!q) return;

  ACADEMY_ASST_HISTORY.push({ role: 'user', text: escHTML(q) });
  inp.value = '';
  updateAsstUI();

  setTimeout(() => {
    const resp = generateAsstResponse(q);
    ACADEMY_ASST_HISTORY.push(resp);
    updateAsstUI();
  }, 400);
}

function updateAsstUI() {
  const msgEl = document.getElementById('academyAsstMessages');
  msgEl.innerHTML = renderAsstHistory();
  msgEl.scrollTop = msgEl.scrollHeight;
}

function handleAcademyAsstKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAcademyAsstMessage();
  }
}

/* ─── AI Response Engine (50+ EBS topics) ─────────────────────────── */
function generateAsstResponse(q) {
  const lc = q.toLowerCase();

  /* P2P / Procure-to-Pay */
  if (lc.includes('p2p') || lc.includes('procure') || lc.includes('purchase') && (lc.includes('cycle') || lc.includes('flow'))) {
    return {
      role: 'assistant',
      text: `<strong>Procure-to-Pay (P2P) Cycle:</strong>

1. **Purchase Requisition** — Department raises a need (iProcurement / Purchasing form)
2. **Approval** — AME/Workflow routes to budget holder
3. **RFQ (optional)** — Request for Quotation sent to suppliers
4. **Purchase Order** — Approved requisition → PO (Standard / Blanket / Contract / Planned)
5. **PO Approval** — AME approval hierarchy
6. **Send to Supplier** — PO printed / EDI 850
7. **ASN (optional)** — Supplier sends Advance Shipment Notice (EDI 856)
8. **Receipt** — Goods received; matched to PO
9. **Inspection** — Items inspected if required
10. **Delivery** — Moved to inventory / expense delivered
11. **Invoice** — AP Clerk enters invoice; 3-way match (PO + Receipt + Invoice)
12. **Invoice Validation** — Validates accounting, tax, distributions
13. **Approval** — Invoice approval workflow
14. **Payment** — Payment batch → check/EFT
15. **Bank Recon** — Payment matched to bank statement

**Key Tables:** PO_HEADERS_ALL, PO_LINES_ALL, PO_LINE_LOCATIONS_ALL, RCV_SHIPMENT_HEADERS, RCV_TRANSACTIONS, AP_INVOICES_ALL, AP_INVOICE_LINES_ALL, AP_CHECKS_ALL`,
      flowchart: buildP2PFlowchart()
    };
  }

  /* O2C / Order-to-Cash */
  if (lc.includes('o2c') || lc.includes('order to cash') || lc.includes('order-to-cash')) {
    return {
      role: 'assistant',
      text: `<strong>Order-to-Cash (O2C) Cycle:</strong>

1. **Sales Order** — Customer order created in OM (Order Management)
2. **Credit Check** — Automated credit check via AR
3. **Order Booking** — Order booked → awaiting release
4. **Pick Release** — Warehouse picks items from inventory
5. **Ship Confirm** — Goods shipped; RMA if returns
6. **AutoInvoice** — OM shipping lines → AR via AutoInvoice import
7. **AR Invoice** — Customer invoice generated with payment terms (Net 30, 2/10 Net 30)
8. **Customer Statement** — Periodic statement sent
9. **Receipt** — Customer payment received (manual / lockbox EDI 820)
10. **Application** — Receipt applied to invoice(s) — full / partial / on-account
11. **Deduction / Dispute** — Short-payment creates deduction claim
12. **Collections** — Dunning letters sent for overdue invoices
13. **Write-off** — Bad debt write-off if needed

**Key Tables:** OE_ORDER_HEADERS_ALL, OE_ORDER_LINES_ALL, RA_CUSTOMER_TRX_ALL, RA_CUSTOMER_TRX_LINES_ALL, AR_CASH_RECEIPTS_ALL, AR_RECEIVABLE_APPLICATIONS_ALL, AR_PAYMENT_SCHEDULES_ALL`,
      flowchart: buildO2CFlowchart()
    };
  }

  /* Hire-to-Retire */
  if (lc.includes('hire') || lc.includes('retire') || lc.includes('h2r') || lc.includes('employee life')) {
    return {
      role: 'assistant',
      text: `<strong>HRMS Hire-to-Retire Cycle:</strong>

1. **Recruitment** — Vacancy raised → applicant created (APPLICANT person_type)
2. **Offer** — Offer made; applicant accepts
3. **Hire** — Applicant → EMPLOYEE via "Hire an Applicant" or "Quick Hire"
4. **Probation** — Probation period tracked (PER_PERIODS_OF_SERVICE.probation_end_date)
5. **Promotion / Grade Step** — DateTrack UPDATE to PER_ALL_ASSIGNMENTS_F (grade_id / position_id change)
6. **Transfer** — Organisation change on assignment (DateTrack mode = UPDATE)
7. **Leave of Absence** — Absence recorded (PER_ABSENCE_ATTENDANCES); assignment_status = SUSP-UNPAID
8. **Termination** — PER_PERIODS_OF_SERVICE.actual_termination_date set; all assignments end-dated
9. **Rehire (optional)** — New period of service; employee_number preserved

**Key Tables:** PER_ALL_PEOPLE_F, PER_ALL_ASSIGNMENTS_F, PER_PERIODS_OF_SERVICE, PER_JOBS, PER_GRADES, HR_ALL_ORGANIZATION_UNITS

**DateTrack** is core to HRMS — every F table has EFFECTIVE_START_DATE / EFFECTIVE_END_DATE.`
    };
  }

  /* Period Close */
  if (lc.includes('period close') || lc.includes('period-close') || lc.includes('close period') || lc.includes('month end')) {
    return {
      role: 'assistant',
      text: `<strong>GL Period Close Process:</strong>

1. **Sub-ledger Close** — AP, AR, PO, INV sub-ledgers must be closed before GL
2. **Accruals** — Month-end accrual journals (prepayments, accrued expenses)
3. **Reconciliation** — AP Trial Balance + AR Aging reconcile to GL control accounts
4. **Allocation** — Run periodic allocation journals (cost centre allocations)
5. **Revaluation** — Revalue foreign currency balances (GL Revaluation program)
6. **Translation (optional)** — Translate functional → reporting currency
7. **Consolidation (optional)** — Consolidate subsidiary ledgers → parent
8. **FSG Reports** — Financial Statement Generator produces P&L, Balance Sheet
9. **Close Period** — Change period status from OPEN → CLOSED (GL_PERIOD_STATUSES)

**Never close a period with unposted journals!**

**Key Tables:** GL_PERIOD_STATUSES (closing_status: O=Open, C=Closed, P=Perm Closed), GL_JE_HEADERS, GL_JE_LINES, GL_LEDGERS, GL_PERIODS`,
      flowchart: buildPeriodCloseFlowchart()
    };
  }

  /* Workflow / AME */
  if (lc.includes('workflow') || lc.includes('ame') || lc.includes('approval')) {
    return {
      role: 'assistant',
      text: `<strong>Oracle Workflow & AME (Approval Management Engine):</strong>

**Workflow** is the core approval & notification engine in EBS. Every approval (PO, AP Invoice, iExpense, HR actions) runs through Workflow.

**Key Concepts:**
- **Item Type**: top-level container (e.g., APINV = AP Invoice Approval)
- **Process**: flowchart of activities (Start → Function → Notification → Decision → End)
- **Notification**: sends email/FYI or approval request to a role/user
- **Function Activity**: executes PL/SQL procedure
- **Roles & Users**: WF_ROLES maps users to notification recipients
- **Notification Mailer**: background process that sends/receives email

**AME** (R12+) overlays Workflow with rule-based approval routing:
- Define approval groups, conditions, and rules
- Supports parallel / serial / consensus approvals
- Uses transaction attributes (amount, cost centre, supplier) to route dynamically

**Key Tables:** WF_ITEMS, WF_ITEM_ACTIVITY_STATUSES, WF_NOTIFICATIONS, WF_ROLES, AME_CALLING_APPS, AME_CONDITIONS, AME_RULES

**Stuck Workflow?** Query WF_ITEM_ACTIVITY_STATUSES where activity_status = 'ERROR' or 'NOTIFIED' for too long.`
    };
  }

  /* DateTrack */
  if (lc.includes('datetrack') || lc.includes('date track') || lc.includes('effective date')) {
    return {
      role: 'assistant',
      text: `<strong>DateTrack in Oracle HRMS:</strong>

**DateTrack** preserves full history of every HR record by storing multiple rows per entity with EFFECTIVE_START_DATE / EFFECTIVE_END_DATE.

**All _F tables are DateTracked:** PER_ALL_PEOPLE_F, PER_ALL_ASSIGNMENTS_F, PAY_ELEMENT_ENTRIES_F, etc.

**DateTrack Modes:**
- **UPDATE**: creates new row with new effective dates (preserves history)
- **CORRECTION**: overwrites current row (no history)
- **UPDATE_OVERRIDE**: future-dated change
- **UPDATE_CHANGE_INSERT**: splits existing row

**How to Query:**
Always use: <code>TRUNC(SYSDATE) BETWEEN effective_start_date AND effective_end_date</code>

**Example:**
<code>SELECT * FROM per_all_people_f
WHERE person_id = :p_person_id
AND TRUNC(SYSDATE) BETWEEN effective_start_date AND effective_end_date;</code>

**Why?** This ensures you only get the currently active record, not historical snapshots.`,
      sql: `SELECT papf.employee_number,
       papf.full_name,
       papf.effective_start_date,
       papf.effective_end_date,
       paaf.assignment_number,
       paaf.organization_id,
       paaf.effective_start_date  assg_start,
       paaf.effective_end_date    assg_end
  FROM per_all_people_f      papf
  JOIN per_all_assignments_f paaf ON paaf.person_id = papf.person_id
 WHERE papf.employee_number = :p_emp_number
   AND TRUNC(SYSDATE) BETWEEN papf.effective_start_date AND papf.effective_end_date
   AND TRUNC(SYSDATE) BETWEEN paaf.effective_start_date AND paaf.effective_end_date
 ORDER BY papf.effective_start_date DESC;`
    };
  }

  /* OAF */
  if (lc.includes('oaf') || lc.includes('oracle application framework') || lc.includes('oaf page')) {
    return {
      role: 'assistant',
      text: `<strong>OAF (Oracle Application Framework):</strong>

OAF is the Java/J2EE MVC framework for all self-service pages in EBS R12 (iExpense, iProcurement, iRecruitment, Payslip, etc.).

**Architecture:**
- **Model**: Business Components for Java (BC4J) — AM, VO, EO
- **View**: XML metadata (stored in MDS) — page layout, fields, buttons
- **Controller**: Java CO (processRequest / processFormRequest)

**Key Components:**
- **AM (Application Module)**: root container managing VO connections and transactions
- **VO (View Object)**: SQL query wrapped as Java object; exposes rows
- **EO (Entity Object)**: maps 1:1 to a DB table; handles DML
- **CO (Controller)**: Java class for business logic / event handling

**Development:**
1. Create project in JDeveloper with OA Extension
2. Create AM, VO, EO (BC4J layer)
3. Create page (XML metadata)
4. Create CO (Controller override)
5. Deploy: jar → $JAVA_TOP, import metadata via MDS

**Key Tables:** FND_FORM_FUNCTIONS (OAF pages registered with type='SSWA jsp function'), FND_RESPONSIBILITY, FND_MENUS`
    };
  }

  /* BIP / BI Publisher */
  if (lc.includes('bip') || lc.includes('bi publisher') || lc.includes('xml publisher')) {
    return {
      role: 'assistant',
      text: `<strong>BI Publisher (BIP) Reports:</strong>

BI Publisher (formerly XML Publisher) is the modern reporting tool in EBS R12. It separates **data extraction** (SQL) from **presentation** (RTF/PDF/Excel template).

**Development Steps:**
1. **Data Definition**: register SQL query in XML Publisher Administrator
2. **SQL Query**: the SQL that generates XML data extract
3. **Template**: RTF template built in MS Word with BIP Template Builder add-in
4. **Template Registration**: upload .rtf to XML Publisher → Templates
5. **Concurrent Program**: type = XML Publisher Report; references data definition
6. **Output Formats**: PDF, RTF, HTML, Excel (XLS/XLSX), CSV, Data (XML)

**Template Tags:**
- <code>&lt;?for-each:ROW?&gt;</code> ... <code>&lt;?end for-each?&gt;</code> — loop rows
- <code>&lt;?FIELD_NAME?&gt;</code> — field binding
- <code>&lt;?if:STATUS='APPROVED'?&gt;</code> ... <code>&lt;?end if?&gt;</code> — conditional

**Key Tables:** XDO_DS_DEFINITIONS_B, XDO_TEMPLATES_B, XDO_LOBS, FND_CONCURRENT_PROGRAMS`
    };
  }

  /* ── DBA: Patching ── */
  if (lc.includes('patch') || lc.includes('adpatch') || lc.includes('adop') || lc.includes('rup') || lc.includes('bundle patch')) {
    return { role:'assistant', text:`<strong>Oracle EBS Patching:</strong>

**Patch Types:**
- **One-off patch**: single bug fix — apply with \`adpatch\` (R12.1) or \`adop\` (R12.2)
- **Bundle Patch (BP)**: collection of one-offs for a module
- **RUP (Release Update Pack)**: quarterly cumulative patch — always apply latest RUP
- **Mini-Pack / Maintenance Pack**: larger release-level update

**R12.1 — adpatch:**
\`\`\`
adpatch options=nocompiledb,nocompilejsp
Enter patch directory: /stage/patches/12345678/
\`\`\`

**R12.2 — adop (Online Patching):**
\`\`\`
adop phase=prepare
adop phase=apply patches=12345678 patchtop=/stage/patches
adop phase=finalize
adop phase=cutover        # brief ~15 min downtime
adop phase=cleanup
\`\`\`

**Key Rules:**
- Always apply on **Dev/Test first**, then Prod
- Take a **full backup** before patching Production
- Read the **README.txt** — check prerequisites
- After cutover, verify with: \`SELECT * FROM ad_applied_patches ORDER BY creation_date DESC;\`

**Log files:** \`$APPL_TOP/admin/<SID>/log/adpatch*.log\`` };
  }

  /* ── DBA: Cloning ── */
  if (lc.includes('clon') || lc.includes('adcfgclone') || lc.includes('adpreclone') || lc.includes('rapid clone') || lc.includes('refresh instance')) {
    return { role:'assistant', text:`<strong>Oracle EBS Cloning (Rapid Clone):</strong>

**Purpose:** Copy Prod → Dev/Test to refresh with current data, test patches, or set up DR.

**Steps (both tiers):**

**1. Pre-Clone (on SOURCE):**
\`\`\`bash
# DB Tier
perl $ORACLE_HOME/appsutil/bin/adpreclone.pl dbTier

# Apps Tier
perl $ADMIN_SCRIPTS_HOME/adpreclone.pl appsTier
\`\`\`

**2. Copy Files to TARGET:**
- DB: RMAN backup/restore, or cold copy of datafiles
- Apps: \`rsync -avz $APPL_TOP $COMMON_TOP $ORA_TOP target:/u01/\`

**3. Configure Clone (on TARGET):**
\`\`\`bash
# DB Tier
perl $ORACLE_HOME/appsutil/clone/bin/adcfgclone.pl dbTier

# Apps Tier
perl $ADMIN_SCRIPTS_HOME/adcfgclone.pl appsTier
\`\`\`

**4. Run AutoConfig + Start:**
\`\`\`bash
$ADMIN_SCRIPTS_HOME/adautocfg.sh
$ADMIN_SCRIPTS_HOME/adstrtal.sh
\`\`\`

**Key Reference:** MOS Doc **406982.1** — Rapid Clone Complete Guide

**After clone:** Update profile options for new hostname, disable email notifications, change passwords.` };
  }

  /* ── DBA: Upgrade ── */
  if (lc.includes('upgrade') || lc.includes('r12.2') || lc.includes('r12.1 to r12.2') || lc.includes('ebr') || lc.includes('edition based') || lc.includes('adop validate')) {
    return { role:'assistant', text:`<strong>Oracle EBS Upgrade: R12.1 → R12.2</strong>

**What Changes in R12.2:**
- **Online Patching** via \`adop\` (Edition-Based Redefinition — EBR)
- **WebLogic 12c** replaces OC4J/iAS
- **OHS 12c** replaces Apache
- **Forms/Reports 12c**
- DB requirement: Oracle 11gR2 (11.2.0.4+) or 12c

**High-Level Steps:**
1. **Prerequisite check**: Apply minimum R12.1.3 + latest RUP
2. **Pre-upgrade**: Close all periods, resolve workflow errors, backup DB
3. **Apply upgrade patch** (13516595 or latest): \`adpatch\` applies DB + Apps upgrade scripts
4. **Run DB scripts**: \`catupgrd.sql\`, \`utlrp.sql\`
5. **Apply latest R12.2 RUP**
6. **Migrate customisations**: wrap APPS schema objects in editions (EBR compliance)
7. **Configure new tech stack**: WebLogic, OHS, Forms Listener Servlet
8. **Validate adop**: \`adop phase=validate\`
9. **Full regression test**

**Custom Object Rule (R12.2):** Any custom package/trigger in APPS schema must be **edition-aware** — use CREATE OR REPLACE EDITIONING VIEW or wrap in an editioned package.

**Downtime:** Expect 8–24 hours for Production. Rehearse twice on non-Prod.` };
  }

  /* ── DBA: Performance ── */
  if (lc.includes('performance') || lc.includes('tuning') || lc.includes('awr') || lc.includes('ash') || lc.includes('slow query') || lc.includes('top sql')) {
    return { role:'assistant', text:`<strong>Oracle EBS Performance Tuning:</strong>

**DBA Diagnostic Toolkit:**
- **AWR**: \`@?/rdbms/admin/awrrpt.sql\` — 1-hour snapshot comparison
- **ASH**: \`SELECT * FROM v$active_session_history WHERE sample_time >= SYSDATE-1/24\`
- **Top SQL**: \`SELECT sql_id, elapsed_time, executions, sql_text FROM v$sql ORDER BY elapsed_time DESC\`
- **Execution Plan**: \`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('sql_id'))\`

**EBS-Specific Rules:**
1. **Always filter on ORG_ID** — _ALL tables are not partitioned but ORG_ID index is critical
2. **CURSOR_SHARING = EXACT** — EBS is designed for bind variables; FORCE breaks things
3. **Gather stats regularly**: Run "FND Gather Schema Statistics" concurrent program monthly
4. **Concurrent Manager**: Set optimal worker count (8-16 per manager), use Work Shifts

**Common Issues:**
- Long-running FNDLIBR process → check log file for offending SQL
- "Library Cache Latch" wait → high SQL version counts → check CURSOR_SHARING
- "DB File Sequential Read" → I/O bottleneck → check storage, index usage
- Slow AutoInvoice / Journal Import → usually missing index on interface table` };
  }

  /* ── DBA: Backup/Recovery ── */
  if (lc.includes('backup') || lc.includes('rman') || lc.includes('recovery') || lc.includes('restore') || lc.includes('archivelog') || lc.includes('data guard')) {
    return { role:'assistant', text:`<strong>EBS Backup & Recovery with RMAN:</strong>

**RMAN Full Backup:**
\`\`\`
rman target /
BACKUP DATABASE PLUS ARCHIVELOG DELETE INPUT;
\`\`\`

**RMAN Incremental Strategy (recommended for EBS):**
\`\`\`
# Sunday: Level 0 (full baseline)
BACKUP INCREMENTAL LEVEL 0 DATABASE;

# Mon-Sat: Level 1 Cumulative
BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE;
\`\`\`

**Apps Tier Backup:**
\`\`\`bash
tar -czf /backup/appl_\$(date +%Y%m%d).tar.gz $APPL_TOP $COMMON_TOP
\`\`\`

**Recovery:**
\`\`\`
rman target /
RESTORE DATABASE;
RECOVER DATABASE;
ALTER DATABASE OPEN RESETLOGS;
\`\`\`

**Data Guard (DR):**
- Physical Standby = block-level copy; can be opened READ ONLY for reports
- Logical Standby = SQL applied; can serve read-write workloads
- \`ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;\`

**Key Principle:** Test your restore quarterly — untested backups are not backups.` };
  }

  /* ── Architecture: 3-tier / tech stack ── */
  if (lc.includes('architecture') || lc.includes('3 tier') || lc.includes('three tier') || lc.includes('weblogic') || lc.includes('ohs') || lc.includes('tech stack') || lc.includes('appl_top') || lc.includes('autoconfig')) {
    return { role:'assistant', text:`<strong>Oracle EBS R12.2 Three-Tier Architecture:</strong>

**Tier 1 — Client:**
- Web browser (HTTPS) for self-service pages (OAF, iExpense, iProcurement)
- Oracle Forms client plugin for forms-based screens

**Tier 2 — Application Tier:**
- **OHS (Oracle HTTP Server 12c)**: routes HTTP/HTTPS; \`mod_wl_ohs\` proxies to WebLogic
- **WebLogic 12c**: AdminServer (7001) + Managed Servers: oacore, forms, oafm
- **Concurrent Processing Server**: FNDSM (Service Manager) + FNDLIBR (program workers)

**Tier 3 — Database Tier:**
- Oracle RDBMS (11.2.0.4+ or 12c/19c)
- All EBS data + PL/SQL business logic lives here

**Key Commands:**
\`\`\`bash
# Source environment
source /u01/oracle/VIS/EBSapps.env run

# Start / Stop / Status
$ADMIN_SCRIPTS_HOME/adstrtal.sh      # Start all
$ADMIN_SCRIPTS_HOME/adstptal.sh      # Stop all
$ADMIN_SCRIPTS_HOME/adchktal.sh      # Status

# Run AutoConfig (regenerate all config files)
$ADMIN_SCRIPTS_HOME/adautocfg.sh
\`\`\`

**Context File:** \`$APPL_TOP/admin/<SID>_<host>.xml\` — single source of truth for all EBS configuration.` };
  }

  /* ── Multi-Org ── */
  if (lc.includes('multi org') || lc.includes('multi-org') || lc.includes('org_id') || lc.includes('operating unit') || lc.includes('mo context') || lc.includes('mo_global')) {
    return { role:'assistant', text:`<strong>Oracle EBS Multi-Org (MO) Architecture:</strong>

**Hierarchy (top → bottom):**
\`\`\`
Business Group
  └── Legal Entity (GL Ledger)
        └── Operating Unit (ORG_ID — AP, AR, PO, OE)
              └── Inventory Organisation (ORGANIZATION_ID — WMS, INV)
\`\`\`

**_ALL Tables:** Every transactional table has an _ALL variant (AP_INVOICES_ALL, OE_ORDER_HEADERS_ALL). Always filter: \`WHERE org_id = :p_org_id\`

**Set MO Context in custom code:**
\`\`\`sql
-- Single-org context
mo_global.set_policy_context('S', :p_org_id);

-- Multi-org context (see all OUs the user has access to)
mo_global.set_policy_context('M', NULL);

-- Get current org
SELECT mo_global.get_current_org_id() FROM dual;
\`\`\`

**Profile Options:**
- \`MO: Operating Unit\` — legacy, sets single OU for a responsibility
- \`MO: Security Profile\` — modern, can grant access to multiple OUs

**Common Mistake:** Forgetting \`org_id\` filter on _ALL tables causes full table scans and returns all orgs' data.` };
  }

  /* ── SOA / Integration ── */
  if (lc.includes('soa') || lc.includes('integration') || lc.includes('oic') || lc.includes('bpel') || lc.includes('osb') || lc.includes('open interface') || lc.includes('web service') || lc.includes('edi') || lc.includes('interface')) {
    return { role:'assistant', text:`<strong>Oracle EBS Integration & SOA:</strong>

**Integration Patterns:**
| Pattern | Tool | Use Case |
|---------|------|----------|
| File-based | SFTP + FTP Adapter | Legacy EDI, batch loads |
| Open Interface | SQL + Concurrent Prog | Standard EBS data import |
| Business Events | WF_EVENT / SOA | Real-time event notifications |
| Web Service (SOAP) | OWSM / WSDL | Synchronous API calls |
| REST | OIC / APEX REST | Modern apps, mobile |
| DB Link | Oracle DB Link | Oracle-to-Oracle direct |

**EBS Open Interfaces (most common):**
- \`GL_INTERFACE\` → Journal Import
- \`AP_INVOICES_INTERFACE\` + \`AP_INVOICE_LINES_INTERFACE\` → Payables Open Interface Import
- \`PO_HEADERS_INTERFACE\` → PO Import
- \`RA_INTERFACE_LINES_ALL\` → AutoInvoice (AR)
- \`HZ_IMP_PARTIES_INT\` → Customer Import

**OIC (Oracle Integration Cloud) — Modern Approach:**
1. Create EBS Adapter Connection (hostname, port, SID, APPS credentials)
2. Build Integration: Trigger → Mapper → EBS Adapter Invoke
3. Activate and Monitor in OIC Console

**Business Events:**
\`\`\`sql
-- Raise a custom event
WF_EVENT.RAISE(
  p_event_name => 'oracle.apps.xx.custom.event',
  p_event_key  => TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
  p_event_data => xmltype('<payload><id>123</id></payload>')
);
\`\`\`` };
  }

  /* ── APEX ── */
  if (lc.includes('apex') || lc.includes('application express') || lc.includes('ords') || lc.includes('low code') || lc.includes('modernis') || lc.includes('moderniz') || lc.includes('replace forms') || lc.includes('migrate to apex')) {
    return { role:'assistant', text:`<strong>Oracle APEX & EBS Modernisation:</strong>

**What is APEX?**
Oracle APEX (Application Express) is Oracle's low-code web development platform built inside the Oracle Database. It is the strategic replacement for Oracle Forms and many OAF pages.

**APEX + EBS — Key Facts:**
- Install APEX **in the same EBS database** — no data movement, full PL/SQL reuse
- APEX apps query EBS tables directly (APPS schema or custom XX schema)
- EBS users can log into APEX using **EBS credentials** via a Custom Auth Scheme
- Set MO context in APEX: \`mo_global.set_policy_context('S', :P_ORG_ID)\` in an Application Process

**Migration Path:**
1. Install APEX + ORDS in EBS DB
2. Create Custom Authentication (PL/SQL validates against FND_USER)
3. Build APEX page using EBS table as data source
4. Call EBS PL/SQL APIs from APEX Processes
5. Deploy behind same reverse proxy as EBS

**APEX for EBS Reports:**
Replace BIP reports with **APEX Interactive Reports/Grids** — live data, user-controlled filters, export to Excel/CSV/PDF, charts built-in.

**EBS-to-Fusion Roadmap:**
- **Option 1**: Stay EBS R12.2 + extend with APEX (Oracle indefinitely supports R12.2)
- **Option 2**: Lift EBS to OCI (same code, cloud infrastructure)
- **Option 3**: Migrate to Oracle Fusion Cloud ERP (full reimplementation)

**Ask me:** "How do I set up APEX authentication with EBS users?" or "What APEX features replace Oracle Forms?"` };
  }

  /* ── Testing ── */
  if (lc.includes('test') || lc.includes('uat') || lc.includes('sit') || lc.includes('regression') || lc.includes('oats') || lc.includes('test script') || lc.includes('defect')) {
    return { role:'assistant', text:`<strong>Oracle EBS Testing Strategy:</strong>

**Test Phases:**
| Phase | Who | What |
|-------|-----|------|
| Unit Test | Developer | Single component (API, report, form) |
| SIT | Technical + Functional | End-to-end process flows |
| UAT | Business Users | Real scenarios with business data |
| Regression | QA + Functional | All existing flows after any change |
| Performance | DBA + Technical | Load/stress with concurrent users |

**For Patches/Upgrades:**
- Test **every business process** that touches the patched module
- Test all **customisations, interfaces, and reports**
- Use **masked production data** — never real personal data in non-Prod

**SQL-Based Test Validation:**
\`\`\`sql
-- Before test: capture baseline counts
SELECT COUNT(*), SUM(invoice_amount) FROM ap_invoices_all WHERE creation_date >= TRUNC(SYSDATE);

-- After test: verify expected change
SELECT invoice_num, approval_status_lookup_code, payment_status_flag
  FROM ap_invoices_all WHERE creation_date >= TRUNC(SYSDATE) ORDER BY creation_date DESC;
\`\`\`

**Tools:**
- **OATS** (Oracle Application Testing Suite): records and replays EBS Forms + web sessions
- **Selenium**: for OAF/HTML pages
- **JMeter**: performance/load testing
- **Jira / Azure DevOps**: defect tracking

**Go-Live Gate:** UAT sign-off document signed by business owners — mandatory before Production cutover.` };
  }

  /* ── Security ── */
  if (lc.includes('security') || lc.includes('responsibility') && (lc.includes('create') || lc.includes('setup') || lc.includes('assign')) || lc.includes('fnd user') || lc.includes('menu') || lc.includes('function exclusion') || lc.includes('audit trail')) {
    return { role:'assistant', text:`<strong>Oracle EBS Security Model:</strong>

**Layered Security:**
\`\`\`
FND User (who can log in)
  └── Responsibility (what they can do)
        ├── Menu (navigation tree)
        │     └── Functions (individual pages/forms/reports)
        ├── Request Group (concurrent programs they can run)
        └── Data Group (which DB schema — almost always APPS)
\`\`\`

**Setting Up a New User:**
1. System Administrator → Security → User → Define
2. Create FND User, assign Responsibilities with effective dates
3. Set Profile Options at User level if needed

**Responsibility Setup:**
1. Define Request Group (Concurrent Programs menu)
2. Define Menu (Function navigator)
3. Create Responsibility → attach Menu + Request Group + Data Group
4. Assign to User(s)

**Function Exclusions:** Exclude specific functions from a Responsibility without creating a new menu — faster for small access differences.

**Key Tables:**
\`\`\`sql
SELECT fu.user_name, frg.responsibility_name, furg.start_date, furg.end_date
  FROM fnd_users fu
  JOIN fnd_user_resp_groups_all furg ON furg.user_id = fu.user_id
  JOIN fnd_responsibility_vl frg ON frg.responsibility_id = furg.responsibility_id
 WHERE fu.user_name = UPPER(:p_username);
\`\`\`

**Audit Trail:** Enable in System Administrator → AuditTrail → Tables. Audited changes go to shadow tables (e.g., AUD$AP_INVOICES_ALL).` };
  }

  /* ── Project Management / Implementation ── */
  if (lc.includes('project') || lc.includes('implementation') || lc.includes('go live') || lc.includes('go-live') || lc.includes('cutover') || lc.includes('hypercare') || lc.includes('crp') || lc.includes('oum') || lc.includes('aim') || lc.includes('fit gap') || lc.includes('fit-gap')) {
    return { role:'assistant', text:`<strong>Oracle EBS Implementation Methodology:</strong>

**5 Phases (Oracle Unified Method — OUM):**
\`\`\`
Phase 1: Inception    → Scope, team, plan, budget
Phase 2: Definition   → Fit-Gap analysis, design
Phase 3: Build        → Configuration, customisation, integration
Phase 4: Testing      → SIT, UAT, performance
Phase 5: Deploy       → Data migration, cutover, go-live, hypercare
\`\`\`

**Conference Room Pilot (CRP):**
- **CRP 1**: Core module setups — functional team walks through with consultants
- **CRP 2**: End-to-end process with real/masked data — business users participate
- **CRP 3**: Full dress rehearsal — near-production quality, all integrations active

**Cutover Plan Essentials:**
- Sequence every task: who, what, how long, dependency
- Freeze legacy system at T-2 days
- Data migration: load Open Balances, Open Transactions
- Mock cutover on non-Prod at least twice before Production
- Go/No-Go decision gate: management sign-off

**Team Roles:**
| Role | Responsibility |
|------|---------------|
| Functional Consultant | Module config, training, UAT support |
| Technical Developer | Custom code, reports, interfaces |
| DBA | Infrastructure, patching, backup |
| Tester | Test scripts, defect tracking |
| Project Manager | Timeline, RAID log, governance |
| Business Analyst | Requirements, fit-gap, UAT coordination |` };
  }

  /* Generic fallback */
  return {
    role: 'assistant',
    text: `I can answer any Oracle EBS question! Here's what I cover:

**Functional Modules:**
P2P · O2C · Hire-to-Retire · Period Close · GL · AP · AR · HRMS · Payroll · SCM · Cash Management

**Technical Development:**
OAF · Oracle Forms · BIP Reports · RDF Reports · Workflow & AME · Value Sets · Flexfields · Profile Options · DateTrack · PL/SQL APIs

**DBA & Infrastructure:**
Patching (adpatch/adop) · Cloning (adcfgclone) · Upgrade R12.1→R12.2 · Performance Tuning · RMAN Backup & Recovery · EBR (Edition-Based Redefinition)

**Architecture & Integration:**
Three-tier Architecture · Multi-Org (ORG_ID) · AutoConfig · SOA Suite · OIC · Open Interfaces · Business Events · Web Services

**Modernisation:**
Oracle APEX · EBS-to-APEX Migration · EBS on OCI · EBS-to-Fusion Roadmap

**Project & Quality:**
OUM/AIM Methodology · CRP · Cutover Planning · SIT/UAT/Regression Testing · Security Model · Audit Trail

**Ask me anything — be specific for best results:**
- *"Explain the adop cutover phase with steps"*
- *"How does APEX authenticate EBS users?"*
- *"What is Edition-Based Redefinition in R12.2?"*
- *"Show me the GL period close steps with SQL"*`
  };
}

/* ─── SVG Flowchart Generators ───────────────────────────────────── */
function buildP2PFlowchart() {
  /* Step 11 (Bank Recon) sits at y=510 + height=32 → bottom=542, so canvas must be ≥ 550 */
  return `<svg width="420" height="550" viewBox="0 0 420 550" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="arrowP2P" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 z" fill="#0572CE"/></marker></defs>
  <rect class="flow-box flow-box-start" x="140" y="10" width="140" height="32"/>
  <text class="flow-text flow-text-inv" x="210" y="31">1. PR Created</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,42 L210,60"/>
  <rect class="flow-box" x="140" y="60" width="140" height="32"/>
  <text class="flow-text" x="210" y="81">2. Approval</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,92 L210,110"/>
  <rect class="flow-box" x="140" y="110" width="140" height="32"/>
  <text class="flow-text" x="210" y="131">3. PO Created</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,142 L210,160"/>
  <rect class="flow-box" x="140" y="160" width="140" height="32"/>
  <text class="flow-text" x="210" y="181">4. PO Approval</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,192 L210,210"/>
  <rect class="flow-box" x="140" y="210" width="140" height="32"/>
  <text class="flow-text" x="210" y="231">5. Send to Supplier</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,242 L210,260"/>
  <rect class="flow-box" x="140" y="260" width="140" height="32"/>
  <text class="flow-text" x="210" y="281">6. Receipt</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,292 L210,310"/>
  <rect class="flow-box" x="140" y="310" width="140" height="32"/>
  <text class="flow-text" x="210" y="331">7. Inspection</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,342 L210,360"/>
  <rect class="flow-box" x="140" y="360" width="140" height="32"/>
  <text class="flow-text" x="210" y="381">8. Invoice Entry</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,392 L210,410"/>
  <rect class="flow-box" x="140" y="410" width="140" height="32"/>
  <text class="flow-text" x="210" y="431">9. Invoice Validation</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,442 L210,460"/>
  <rect class="flow-box" x="140" y="460" width="140" height="32"/>
  <text class="flow-text" x="210" y="481">10. Payment</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowP2P)" d="M210,492 L210,510"/>
  <rect class="flow-box flow-box-end" x="140" y="510" width="140" height="32"/>
  <text class="flow-text flow-text-inv" x="210" y="531">✓ Bank Recon</text>
</svg>`;
}

function buildO2CFlowchart() {
  /* Each step: box y + height=32 + gap=18 → next box starts at y+50
     Step 1 → y=10  (bottom 42)
     Step 2 → y=60  (bottom 92)
     Step 3 → y=110 (bottom 142)
     Step 4 → y=160 (bottom 192)
     Step 5 → y=210 (bottom 242)
     Step 6 → y=260 (bottom 292)
     Step 7 → y=310 (bottom 342)
     Step 8 → y=360 (bottom 392)
     Step 9 → y=410 (bottom 442)
     Step10 → y=460 (bottom 492)  ← was cut off — canvas must be ≥ 500
  */
  return `<svg width="420" height="500" viewBox="0 0 420 500" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="arrowO2C" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 z" fill="#0572CE"/></marker></defs>
  <rect class="flow-box flow-box-start" x="140" y="10" width="140" height="32"/>
  <text class="flow-text flow-text-inv" x="210" y="31">1. Sales Order</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,42 L210,60"/>
  <rect class="flow-box" x="140" y="60" width="140" height="32"/>
  <text class="flow-text" x="210" y="81">2. Credit Check</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,92 L210,110"/>
  <rect class="flow-box" x="140" y="110" width="140" height="32"/>
  <text class="flow-text" x="210" y="131">3. Order Booking</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,142 L210,160"/>
  <rect class="flow-box" x="140" y="160" width="140" height="32"/>
  <text class="flow-text" x="210" y="181">4. Pick Release</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,192 L210,210"/>
  <rect class="flow-box" x="140" y="210" width="140" height="32"/>
  <text class="flow-text" x="210" y="231">5. Ship Confirm</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,242 L210,260"/>
  <rect class="flow-box" x="140" y="260" width="140" height="32"/>
  <text class="flow-text" x="210" y="281">6. AutoInvoice</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,292 L210,310"/>
  <rect class="flow-box" x="140" y="310" width="140" height="32"/>
  <text class="flow-text" x="210" y="331">7. AR Invoice</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,342 L210,360"/>
  <rect class="flow-box" x="140" y="360" width="140" height="32"/>
  <text class="flow-text" x="210" y="381">8. Receipt</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,392 L210,410"/>
  <rect class="flow-box" x="140" y="410" width="140" height="32"/>
  <text class="flow-text" x="210" y="431">9. Application</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowO2C)" d="M210,442 L210,460"/>
  <rect class="flow-box flow-box-end" x="140" y="460" width="140" height="32"/>
  <text class="flow-text flow-text-inv" x="210" y="481">✓ Cash Collected</text>
</svg>`;
}

function buildPeriodCloseFlowchart() {
  /* Last box at y=420 + height=32 → bottom=452; canvas must be ≥ 460 */
  return `<svg width="420" height="460" viewBox="0 0 420 460" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="arrowPC" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 z" fill="#0572CE"/></marker></defs>
  <rect class="flow-box flow-box-start" x="140" y="10" width="140" height="32"/>
  <text class="flow-text flow-text-inv" x="210" y="31">1. Sub-ledger Close</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,42 L210,60"/>
  <rect class="flow-box" x="140" y="60" width="140" height="32"/>
  <text class="flow-text" x="210" y="81">2. Accruals</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,92 L210,110"/>
  <rect class="flow-box" x="140" y="110" width="140" height="32"/>
  <text class="flow-text" x="210" y="131">3. Reconciliation</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,142 L210,160"/>
  <rect class="flow-box" x="140" y="160" width="140" height="32"/>
  <text class="flow-text" x="210" y="181">4. Allocation</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,192 L210,210"/>
  <rect class="flow-box" x="140" y="210" width="140" height="32"/>
  <text class="flow-text" x="210" y="231">5. Revaluation</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,242 L210,260"/>
  <rect class="flow-box" x="140" y="260" width="140" height="32"/>
  <text class="flow-text" x="210" y="281">6. Translation</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,292 L210,310"/>
  <rect class="flow-box" x="140" y="310" width="140" height="32"/>
  <text class="flow-text" x="210" y="331">7. FSG Reports</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,342 L210,360"/>
  <rect class="flow-box flow-box-decision" x="130" y="360" width="160" height="42"/>
  <text class="flow-text" x="210" y="386">All Journals Posted?</text>
  <path stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arrowPC)" d="M210,402 L210,420"/>
  <rect class="flow-box flow-box-end" x="140" y="420" width="140" height="32"/>
  <text class="flow-text flow-text-inv" x="210" y="441">✓ Close Period</text>
</svg>`;
}

/* ─── Central flowchart getter — returns SVG string or null ──────── */
function _getTopicFlowchart(moduleId, topicId) {
  if (moduleId === 'ap'      && topicId === 'ap_p2p')         return buildP2PFlowchart();
  if (moduleId === 'scm'     && topicId === 'scm_r2r')        return buildP2PFlowchart(); /* R2R ~= P2P */
  if (moduleId === 'ar'      && topicId === 'ar_o2c')         return buildO2CFlowchart();
  if (moduleId === 'gl'      && topicId === 'gl_period_close') return buildPeriodCloseFlowchart();
  if (moduleId === 'hrms'    && topicId === 'hrms_hire')       return buildHireFlowchart();
  if (moduleId === 'payroll' && topicId === 'pay_run_cycle')   return buildPayrollFlowchart();
  if (moduleId === 'workflow' && topicId === 'wf_architecture') return buildWorkflowFlowchart();
  if (moduleId === 'cm'      && topicId === 'cm_recon')        return buildBankReconFlowchart();
  return null;
}

/* ─── Diagram Toggle (show / hide, but now defaults to visible) ──── */
function toggleAcademyDiagram() {
  const area = document.getElementById('academyDiagramArea');
  const btn  = document.getElementById('academyDiagramToggle');
  if (!area || !btn) return;
  if (area.style.display === 'none') {
    area.style.display = 'block';
    btn.textContent = '▲ Hide Diagram';
  } else {
    area.style.display = 'none';
    btn.textContent = '▼ Show Diagram';
  }
}

/* ─── Individual flowchart builders ──────────────────────────────── */
function buildHireFlowchart() {
  return _buildVerticalFlow('Hire-to-Retire',[
    {t:'1. Recruitment',start:true},
    {t:'2. Offer'},
    {t:'3. Hire (Quick Hire / Hire Applicant)'},
    {t:'4. Probation Period'},
    {t:'5. Promotion / Transfer'},
    {t:'6. Leave of Absence'},
    {t:'7. Termination'},
    {t:'✓ Rehire (optional)',end:true}
  ]);
}

function buildPayrollFlowchart() {
  return _buildVerticalFlow('Payroll Run Cycle',[
    {t:'1. Pre-Payroll Validation',start:true},
    {t:'2. Payroll Run (Gross → Net)'},
    {t:'3. Pre-Payments Assignment'},
    {t:'4. Check Writer / Magnetic Transfer'},
    {t:'5. Costing'},
    {t:'6. Transfer to GL'},
    {t:'7. Payslip Generation'},
    {t:'✓ Period Archive & Close',end:true}
  ]);
}

function buildWorkflowFlowchart() {
  return _buildVerticalFlow('Workflow Process',[
    {t:'1. Transaction Raised',start:true},
    {t:'2. Workflow Item Created (WF_ITEMS)'},
    {t:'3. Rules Evaluated (AME)'},
    {t:'4. Notification Sent (WF_NOTIFICATIONS)'},
    {t:'5. Approver Reviews (Email / EBS)'},
    {t:'6. Approve / Reject Decision',decision:true},
    {t:'7. Next Level or Complete'},
    {t:'✓ Transaction Approved / Rejected',end:true}
  ]);
}

function buildBankReconFlowchart() {
  return _buildVerticalFlow('Bank Reconciliation',[
    {t:'1. Import Bank Statement (BAI2/MT940)',start:true},
    {t:'2. AutoReconciliation Run'},
    {t:'3. Match AP Payments to Statement Lines'},
    {t:'4. Match AR Receipts to Statement Lines'},
    {t:'5. Review Unmatched / Exceptions'},
    {t:'6. Manual Reconciliation'},
    {t:'7. Post Bank Charges / NSF'},
    {t:'✓ Close Statement',end:true}
  ]);
}

/* ─── Generic vertical flow SVG builder ─────────────────────────── */
function _buildVerticalFlow(title, steps) {
  const BOX_W = 260, BOX_H = 36, GAP = 16, X = 70;
  let y = 14;
  const totalH = steps.length * (BOX_H + GAP) + 20;
  const W = BOX_W + X * 2;

  let svg = `<svg width="${W}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
      <path d="M0,0 L0,8 L8,4 z" fill="#0572CE"/>
    </marker>
  </defs>`;

  steps.forEach((step, i) => {
    const cy = y + BOX_H / 2;
    const fillClass = step.start ? 'flow-box-start' : step.end ? 'flow-box-end' : step.decision ? 'flow-box-decision' : 'flow-box';
    svg += `<rect class="flow-box ${fillClass}" x="${X}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="6"/>`;
    const textClass = (step.start || step.end) ? 'flow-text flow-text-inv' : 'flow-text';
    svg += `<text class="${textClass}" x="${X + BOX_W/2}" y="${cy + 1}">${step.t}</text>`;
    if (i < steps.length - 1) {
      svg += `<path class="flow-arrow" stroke="#0572CE" stroke-width="1.5" fill="none" marker-end="url(#arr)" d="M${X + BOX_W/2},${y + BOX_H} L${X + BOX_W/2},${y + BOX_H + GAP}"/>`;
    }
    y += BOX_H + GAP;
  });

  svg += `</svg>`;
  return svg;
}



/* =============================================================================
   ██████╗  █████╗ ████████╗ █████╗      ██████╗ ██████╗ ███╗   ██╗███╗   ██╗███████╗ ██████╗████████╗
   ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗    ██╔════╝██╔═══██╗████╗  ██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝
   ██║  ██║███████║   ██║   ███████║    ██║     ██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██║        ██║
   ██║  ██║██╔══██║   ██║   ██╔══██║    ██║     ██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██║        ██║
   ██████╔╝██║  ██║   ██║   ██║  ██║    ╚██████╗╚██████╔╝██║ ╚████║██║ ╚████║███████╗╚██████╗   ██║
   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═╝
   DATA CONNECT — Excel / CSV import + DB query simulator + column mapper
   ============================================================================= */

/* ── State ─────────────────────────────────────────────────────────────────── */
const DC = {
  source:       'excel',     /* 'excel' | 'db' */
  rawWorkbook:  null,        /* XLSX workbook object */
  rawFileName:  '',
  activeSheet:  '',
  rawHeaders:   [],          /* string[] — original column names from source */
  rawRows:      [],          /* any[][] — parsed data rows (trimmed to maxRows) */
  colTypes:     [],          /* 'text'|'number'|'date'|'bool'|'mixed'[] */
  mapping:      {},          /* { srcColName: targetFieldName } */
  transforms:   {},          /* { srcColName: transform } */
  targetReport: '',          /* key into window.REPORT_DATA */
  previewRows:  [],          /* mapped rows (array of arrays) */
  previewCols:  [],          /* column names after mapping */
  previewPage:  1,
  previewPageSz: 50,
};

/* ── Init (called when tab is first opened) ─────────────────────────────── */
let DC_INITIALIZED = false;
function initDataConnect() {
  if (DC_INITIALIZED) return;
  DC_INITIALIZED = true;
  _dcPopulateTargetReports();
}

/* ── Source switcher ───────────────────────────────────────────────────────── */
function dcSwitchSource(type) {
  DC.source = type;
  document.getElementById('dcSrcExcel').classList.toggle('active', type === 'excel');
  document.getElementById('dcSrcDb').classList.toggle('active',    type === 'db');
  document.getElementById('dcExcelPanel').style.display = type === 'excel' ? '' : 'none';
  document.getElementById('dcDbPanel').style.display    = type === 'db'    ? '' : 'none';
}

/* ── Drag-and-drop ─────────────────────────────────────────────────────────── */
function dcDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('dcDropZone').classList.add('drag-over');
}
function dcDragLeave(e) {
  e.preventDefault();
  document.getElementById('dcDropZone').classList.remove('drag-over');
}
function dcDrop(e) {
  e.preventDefault();
  document.getElementById('dcDropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) _dcLoadFile(file);
}
function dcFileSelected(input) {
  const file = input.files[0];
  if (file) _dcLoadFile(file);
  input.value = '';   /* reset so same file can be re-selected */
}

/* ── File loader ─────────────────────────────────────────────────────────── */
function _dcLoadFile(file) {
  const name = file.name.toLowerCase();
  const isCSV  = name.endsWith('.csv');
  const isXLSX = name.endsWith('.xlsx') || name.endsWith('.xls');
  if (!isCSV && !isXLSX) {
    showToast('Unsupported file type. Please use .xlsx, .xls or .csv', 'warning');
    return;
  }

  DC.rawFileName = file.name;
  showToast(`📂 Loading ${file.name}…`, 'info');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array', cellDates: true });
      DC.rawWorkbook = wb;

      /* Populate sheet selector */
      const sheetSel = document.getElementById('dcSheetSelect');
      sheetSel.innerHTML = wb.SheetNames.map(n =>
        `<option value="${escHTML(n)}">${escHTML(n)}</option>`).join('');

      document.getElementById('dcSheetSelector').style.display = '';
      document.getElementById('dcRowRange').style.display      = '';

      DC.activeSheet = wb.SheetNames[0];
      sheetSel.value = DC.activeSheet;

      _dcParseActiveSheet();
    } catch(err) {
      showToast('Error reading file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function dcSelectSheet() {
  DC.activeSheet = document.getElementById('dcSheetSelect').value;
  _dcParseActiveSheet();
}

function dcReparseFile() {
  if (DC.rawWorkbook) _dcParseActiveSheet();
}

function _dcParseActiveSheet() {
  if (!DC.rawWorkbook) return;
  const sheet     = DC.rawWorkbook.Sheets[DC.activeSheet];
  const headerRow = Math.max(1, parseInt(document.getElementById('dcHeaderRow').value) || 1);
  const maxRows   = Math.min(5000, parseInt(document.getElementById('dcMaxRows').value) || 500);

  /* Convert to AOA (array of arrays) */
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw:    false,      /* format dates as strings */
    dateNF: 'YYYY-MM-DD',
    defval: '',
  });

  if (aoa.length < headerRow) {
    showToast('Header row exceeds sheet length.', 'warning');
    return;
  }

  /* Extract headers from specified row (1-based → 0-based index) */
  const rawHdr = (aoa[headerRow - 1] || []).map(h => String(h || '').trim());
  /* De-duplicate blank / empty headers */
  const headers = rawHdr.map((h, i) => h || `Column_${i + 1}`);

  /* Data rows start after header row */
  const dataRows = aoa.slice(headerRow).filter(r => r.some(c => c !== '')).slice(0, maxRows);

  DC.rawHeaders = headers;
  DC.rawRows    = dataRows;
  DC.colTypes   = headers.map((_, ci) => _dcDetectType(dataRows, ci));
  DC.mapping    = {};
  DC.transforms = {};

  /* Show file badge */
  document.getElementById('dcFileBadgeName').textContent = `${DC.rawFileName} · ${headers.length} cols · ${dataRows.length} rows`;
  document.getElementById('dcFileBadge').style.display   = '';

  /* Show mapping UI */
  _dcShowMapping();
  showToast(`✅ Loaded ${dataRows.length} rows × ${headers.length} columns`, 'success');
}

/* ── Type detection ─────────────────────────────────────────────────────── */
function _dcDetectType(rows, colIdx) {
  let numCount = 0, dateCount = 0, boolCount = 0, totalNonBlank = 0;
  const sample = rows.slice(0, 50);
  sample.forEach(row => {
    const v = String(row[colIdx] || '').trim();
    if (!v) return;
    totalNonBlank++;
    if (!isNaN(v) && v !== '') numCount++;
    else if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(v) || /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(v)) dateCount++;
    else if (/^(true|false|yes|no|y|n|1|0)$/i.test(v)) boolCount++;
  });
  if (totalNonBlank === 0) return 'text';
  const ratio = (count) => count / totalNonBlank;
  if (ratio(numCount)  > 0.8) return 'number';
  if (ratio(dateCount) > 0.8) return 'date';
  if (ratio(boolCount) > 0.8) return 'bool';
  if (ratio(numCount) + ratio(dateCount) > 0.5) return 'mixed';
  return 'text';
}

/* ── Populate target reports dropdown ──────────────────────────────────── */
function _dcPopulateTargetReports() {
  const sel = document.getElementById('dcTargetReport');
  if (!sel || !window.REPORT_DATA) return;
  const opts = Object.entries(window.REPORT_DATA).map(([key, rep]) =>
    `<option value="${escHTML(key)}">${escHTML(rep.title)} (${escHTML(rep.module)})</option>`
  ).join('');
  sel.innerHTML = `<option value="">— choose target report —</option>` + opts;
}

/* ── Show mapping UI ────────────────────────────────────────────────────── */
function _dcShowMapping() {
  document.getElementById('dcWelcome').style.display      = 'none';
  document.getElementById('dcPreviewArea').style.display  = 'none';
  document.getElementById('dcMappingArea').style.display  = '';

  /* Source stats */
  document.getElementById('dcSourceStats').innerHTML = `
    <div class="dc-stat-chip">📂 File <span class="dc-stat-val">${escHTML(DC.rawFileName)}</span></div>
    <div class="dc-stat-chip">📋 Columns <span class="dc-stat-val">${DC.rawHeaders.length}</span></div>
    <div class="dc-stat-chip">🗂 Rows <span class="dc-stat-val">${DC.rawRows.length.toLocaleString()}</span></div>
    <div class="dc-stat-chip">📄 Sheet <span class="dc-stat-val">${escHTML(DC.activeSheet)}</span></div>
  `;

  _dcRenderMappingTable();
}

function _dcRenderMappingTable() {
  const tbody      = document.getElementById('dcMappingTableBody');
  const targetCols = _dcGetTargetColumns();

  const targetOpts = `<option value="">— skip —</option>` +
    targetCols.map(c => `<option value="${escHTML(c)}">${escHTML(c)}</option>`).join('');

  tbody.innerHTML = DC.rawHeaders.map((hdr, ci) => {
    const sampleVals = DC.rawRows.slice(0, 4)
      .map(r => String(r[ci] || '').trim())
      .filter(Boolean)
      .join(', ');
    const type    = DC.colTypes[ci];
    const mapped  = DC.mapping[hdr] || '';
    const tfm     = DC.transforms[hdr] || 'none';

    return `<tr>
      <td><span class="dc-col-name">${escHTML(hdr)}</span></td>
      <td><span class="dc-sample-vals" title="${escHTML(sampleVals)}">${escHTML(sampleVals || '—')}</span></td>
      <td><span class="dc-type-badge dc-type-${type}">${type}</span></td>
      <td>
        <select class="dc-map-select ${mapped ? 'mapped' : ''}"
                data-col="${escHTML(hdr)}"
                onchange="dcMapColumnChange(this)">
          ${targetOpts.replace(`value="${escHTML(mapped)}"`, `value="${escHTML(mapped)}" selected`)}
        </select>
      </td>
      <td>
        <select class="dc-transform-select" data-col="${escHTML(hdr)}" onchange="dcTransformChange(this)">
          <option value="none"${tfm==='none'?' selected':''}>— none —</option>
          <option value="trim"${tfm==='trim'?' selected':''}>TRIM whitespace</option>
          <option value="upper"${tfm==='upper'?' selected':''}>UPPER CASE</option>
          <option value="lower"${tfm==='lower'?' selected':''}>lower case</option>
          <option value="title"${tfm==='title'?' selected':''}>Title Case</option>
          <option value="date_fmt"${tfm==='date_fmt'?' selected':''}>Format Date</option>
          <option value="num_fmt"${tfm==='num_fmt'?' selected':''}>Format Number</option>
        </select>
      </td>
    </tr>`;
  }).join('');
}

function _dcGetTargetColumns() {
  if (DC.targetReport && window.REPORT_DATA && window.REPORT_DATA[DC.targetReport]) {
    return window.REPORT_DATA[DC.targetReport].columns || [];
  }
  /* No target chosen — use raw headers as targets (pass-through) */
  return DC.rawHeaders;
}

/* ── Mapping interactions ────────────────────────────────────────────────── */
function dcTargetChanged() {
  DC.targetReport = document.getElementById('dcTargetReport').value;
  DC.mapping      = {};
  DC.transforms   = {};
  _dcRenderMappingTable();
  /* Try auto-map when target changes */
  if (DC.targetReport) dcAutoMap();
}

function dcMapColumnChange(sel) {
  const col = sel.getAttribute('data-col');
  DC.mapping[col] = sel.value;
  sel.classList.toggle('mapped', !!sel.value);
}

function dcTransformChange(sel) {
  const col = sel.getAttribute('data-col');
  DC.transforms[col] = sel.value;
}

/* ── Auto-map ────────────────────────────────────────────────────────────── */
function dcAutoMap() {
  const targets = _dcGetTargetColumns();
  if (!targets.length) {
    showToast('Choose a target EBS report first, then auto-map.', 'info');
    return;
  }

  let mapped = 0;
  DC.rawHeaders.forEach(hdr => {
    /* Normalise: lower, remove spaces/underscores/special chars */
    const norm  = hdr.toLowerCase().replace(/[\s_\/\-\.#]/g, '');
    const match = targets.find(t => {
      const tn = t.toLowerCase().replace(/[\s_\/\-\.#]/g, '');
      return tn === norm || tn.includes(norm) || norm.includes(tn);
    });
    if (match) {
      DC.mapping[hdr] = match;
      mapped++;
    }
  });

  _dcRenderMappingTable();
  showToast(`🪄 Auto-mapped ${mapped} of ${DC.rawHeaders.length} columns`, mapped > 0 ? 'success' : 'info');
}

function dcClearMapping() {
  DC.mapping    = {};
  DC.transforms = {};
  _dcRenderMappingTable();
  showToast('Mapping cleared.', 'info');
}

/* ── Create custom report ────────────────────────────────────────────────── */
function dcCreateCustomReport() {
  /* Use the source headers as the report columns */
  const key   = `custom_dc_${Date.now()}`;
  const title = DC.rawFileName ? DC.rawFileName.replace(/\.[^.]+$/, '') : 'Imported Data';
  window.REPORT_DATA[key] = {
    title:    title,
    module:   'Data Connect Import',
    columns:  [...DC.rawHeaders],
    sql:      `-- Data imported via Data Connect\n-- Source: ${DC.rawFileName}`,
    rows:     [],   /* filled when pushed */
    _imported: true, /* marks it as safe-to-delete */
  };

  /* Refresh dropdown */
  _dcPopulateTargetReports();
  document.getElementById('dcTargetReport').value = key;
  DC.targetReport = key;

  /* Auto-map (identity mapping) */
  DC.rawHeaders.forEach(h => { DC.mapping[h] = h; });
  _dcRenderMappingTable();

  showToast(`✅ Custom report "${title}" created — all columns mapped.`, 'success');
}

/* ── Apply mapping & show preview ────────────────────────────────────────── */
function dcApplyMapping() {
  if (!DC.rawRows.length) { showToast('No data loaded.', 'warning'); return; }

  /* Collect mapped columns (skip unmapped = empty target) */
  const activeMappings = DC.rawHeaders
    .map((hdr, ci) => ({ hdr, ci, target: DC.mapping[hdr] || '', transform: DC.transforms[hdr] || 'none' }))
    .filter(m => m.target !== '');

  if (!activeMappings.length) {
    showToast('Map at least one column before previewing.', 'warning');
    return;
  }

  DC.previewCols = activeMappings.map(m => m.target);
  DC.previewRows = DC.rawRows.map(row => {
    return activeMappings.map(m => {
      let val = String(row[m.ci] == null ? '' : row[m.ci]);
      val = _dcApplyTransform(val, m.transform);
      return val;
    });
  });

  DC.previewPage = 1;
  _dcShowPreview();
}

function _dcApplyTransform(val, tfm) {
  switch (tfm) {
    case 'trim':     return val.trim();
    case 'upper':    return val.toUpperCase();
    case 'lower':    return val.toLowerCase();
    case 'title':    return val.replace(/\b\w/g, c => c.toUpperCase());
    case 'date_fmt': {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString().slice(0,10);
    }
    case 'num_fmt': {
      const n = parseFloat(val.replace(/[^0-9.\-]/g,''));
      return isNaN(n) ? val : n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    default: return val;
  }
}

/* ── Preview UI ──────────────────────────────────────────────────────────── */
function _dcShowPreview() {
  document.getElementById('dcMappingArea').style.display = 'none';
  document.getElementById('dcPreviewArea').style.display = '';

  /* Info bar */
  document.getElementById('dcPreviewInfo').innerHTML =
    `<strong>${DC.previewRows.length.toLocaleString()} rows</strong> × <strong>${DC.previewCols.length} columns</strong>` +
    (DC.targetReport && window.REPORT_DATA[DC.targetReport]
      ? ` — mapped to <strong>${escHTML(window.REPORT_DATA[DC.targetReport].title)}</strong>`
      : ' — custom layout');

  /* Data profile */
  _dcRenderProfileBar();

  /* Grid */
  _dcRenderGrid();
}

function _dcRenderProfileBar() {
  const bar = document.getElementById('dcProfileBar');
  bar.innerHTML = DC.previewCols.map((col, ci) => {
    const colVals  = DC.previewRows.map(r => r[ci]);
    const nonBlanks = colVals.filter(v => v !== '' && v != null);
    const nullPct  = colVals.length ? Math.round((1 - nonBlanks.length / colVals.length) * 100) : 0;
    const uniqSet  = new Set(nonBlanks);
    const uniq     = uniqSet.size;
    const sample   = [...uniqSet].slice(0,2).map(v => String(v).substring(0,12)).join(', ');

    return `<div class="dc-profile-chip">
      <strong title="${escHTML(col)}">${escHTML(col)}</strong>
      <div class="dc-profile-stat"><span>Nulls</span><b>${nullPct}%</b></div>
      <div class="dc-profile-stat"><span>Unique</span><b>${uniq}</b></div>
      <div class="dc-profile-stat" title="${escHTML(sample)}"><span>Sample</span><b>${escHTML(sample.substring(0,14)+'…')}</b></div>
    </div>`;
  }).join('');
}

function _dcRenderGrid() {
  const pageSize = DC.previewPageSz;
  const total    = DC.previewRows.length;
  const pages    = Math.max(1, Math.ceil(total / pageSize));
  DC.previewPage = Math.min(DC.previewPage, pages);

  const start = (DC.previewPage - 1) * pageSize;
  const slice = DC.previewRows.slice(start, start + pageSize);

  /* Head */
  document.getElementById('dcGridHead').innerHTML =
    `<tr>${DC.previewCols.map(c => `<th>${escHTML(c)}</th>`).join('')}</tr>`;

  /* Body */
  document.getElementById('dcGridBody').innerHTML = slice.map(row =>
    `<tr>${row.map(cell => `<td title="${escHTML(String(cell))}">${escHTML(String(cell))}</td>`).join('')}</tr>`
  ).join('');

  /* Pager */
  const pager = document.getElementById('dcGridPager');
  if (pages <= 1) { pager.innerHTML = ''; return; }

  let pgHtml = `<button class="dc-page-btn" onclick="dcGoPage(1)" ${DC.previewPage===1?'disabled':''}>«</button>`;
  pgHtml += `<button class="dc-page-btn" onclick="dcGoPage(${DC.previewPage-1})" ${DC.previewPage===1?'disabled':''}>‹</button>`;

  /* Sliding window of page buttons */
  const winStart = Math.max(1, DC.previewPage - 2);
  const winEnd   = Math.min(pages, DC.previewPage + 2);
  for (let p = winStart; p <= winEnd; p++) {
    pgHtml += `<button class="dc-page-btn ${p===DC.previewPage?'active':''}" onclick="dcGoPage(${p})">${p}</button>`;
  }

  pgHtml += `<button class="dc-page-btn" onclick="dcGoPage(${DC.previewPage+1})" ${DC.previewPage===pages?'disabled':''}>›</button>`;
  pgHtml += `<button class="dc-page-btn" onclick="dcGoPage(${pages})" ${DC.previewPage===pages?'disabled':''}>»</button>`;
  pgHtml += `<span class="dc-page-info">Page ${DC.previewPage} of ${pages} · ${total.toLocaleString()} rows</span>`;
  pager.innerHTML = pgHtml;
}

function dcGoPage(p) {
  DC.previewPage = p;
  _dcRenderGrid();
}

/* ── Back to mapping ────────────────────────────────────────────────────── */
function dcBackToMapping() {
  document.getElementById('dcPreviewArea').style.display = 'none';
  document.getElementById('dcMappingArea').style.display = '';
}

/* ── Export preview to Excel ─────────────────────────────────────────────── */
function dcExportPreview() {
  if (!DC.previewRows.length) { showToast('Nothing to export.', 'warning'); return; }

  const ws   = XLSX.utils.aoa_to_sheet([DC.previewCols, ...DC.previewRows]);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MappedData');

  const fileName = DC.rawFileName
    ? DC.rawFileName.replace(/\.[^.]+$/, '') + '_mapped.xlsx'
    : 'dc_export.xlsx';

  XLSX.writeFile(wb, fileName);
  showToast(`⬇ Exported ${DC.previewRows.length} rows to ${fileName}`, 'success');
}

/* ── Push to EBS Reports tab ─────────────────────────────────────────────── */
function dcPushToReports() {
  if (!DC.previewRows.length) { showToast('Nothing to push.', 'warning'); return; }

  let reportKey = DC.targetReport;

  /* If no target chosen, create a custom one automatically */
  if (!reportKey) {
    dcCreateCustomReport();
    dcApplyMapping();
    reportKey = DC.targetReport;
  }

  if (!window.REPORT_DATA[reportKey]) {
    showToast('Target report not found.', 'error');
    return;
  }

  /* ── Snapshot the original entry ONCE before overwriting ──────────────────
     This backup lets deleteImportedReport restore the built-in report to its
     original demo state if Technical later deletes the pushed data. */
  const _existing = window.REPORT_DATA[reportKey] || {};
  if (!_existing._imported) {
    /* Only backup built-in (non-imported) reports — never overwrite an existing backup */
    window._REPORT_DATA_BACKUP = window._REPORT_DATA_BACKUP || {};
    if (!window._REPORT_DATA_BACKUP[reportKey]) {
      window._REPORT_DATA_BACKUP[reportKey] = {
        rows:    (_existing.rows    || []).map(r => [...r]),
        columns: [...(_existing.columns || [])],
      };
    }
  }

  /* Replace the report's columns + rows with mapped data.
     Preserve title/module/sql from the original entry so params bar still works. */
  window.REPORT_DATA[reportKey] = {
    title:     _existing.title   || DC.rawFileName || 'Imported Data',
    module:    _existing.module  || 'Data Connect Import',
    sql:       _existing.sql     || `-- Data imported via Data Connect\n-- Source: ${DC.rawFileName || 'unknown'}`,
    columns:   [...DC.previewCols],
    rows:      DC.previewRows.map(r => [...r]),
    _imported: true,   /* marks this entry as safe-to-delete + enables Delete button */
    _pushedBy: APP_ROLE.current || 'technical',
    _pushedAt: new Date().toLocaleTimeString(),
  };

  const rep = window.REPORT_DATA[reportKey];

  /* Register in the imported reports registry */
  const source = DC.source === 'db' ? 'db' : (DC.rawFileName ? 'excel' : 'custom');
  registerImportedReport(reportKey, rep.title, source);

  showToast(`🚀 Pushed ${DC.previewRows.length} rows to "${rep.title}" — switch to EBS Reports tab to view!`, 'success');

  /* Navigate to the EBS Reports tab and open the report.
     Use a single 500 ms delay so the tab switch DOM settles AND the
     IMPORTED_REPORTS registry is fully committed before loadReport reads it. */
  switchTab('tab-reports', document.querySelector('[data-tab="tab-reports"]'));
  setTimeout(() => {
    if (typeof loadReport === 'function') loadReport(reportKey);
  }, 500);
}

/* ── Clear / reset ──────────────────────────────────────────────────────── */
function dcClearFile() {
  DC.rawWorkbook  = null;
  DC.rawFileName  = '';
  DC.activeSheet  = '';
  DC.rawHeaders   = [];
  DC.rawRows      = [];
  DC.colTypes     = [];
  DC.mapping      = {};
  DC.transforms   = {};
  DC.targetReport = '';
  DC.previewRows  = [];
  DC.previewCols  = [];

  document.getElementById('dcFileBadge').style.display      = 'none';
  document.getElementById('dcSheetSelector').style.display  = 'none';
  document.getElementById('dcRowRange').style.display       = 'none';
  document.getElementById('dcMappingArea').style.display    = 'none';
  document.getElementById('dcPreviewArea').style.display    = 'none';
  document.getElementById('dcWelcome').style.display        = '';

  document.getElementById('dcTargetReport').value = '';
  showToast('Data cleared.', 'info');
}

/* ── DB Query simulator ──────────────────────────────────────────────────── */
function dcRunDbQuery() {
  const sql = (document.getElementById('dcDbQuery').value || '').trim();
  if (!sql) { showToast('Enter a SELECT query.', 'warning'); return; }

  const lc = sql.toLowerCase();

  /* Match SQL to available REPORT_DATA key by scanning table names */
  /* Priority-ordered table → report key mappings.
     More specific / longer table names must come before shorter prefixes. */
  const TABLE_MAP = [
    /* iExpense — must be before ap_invoices_all to avoid false invoice match */
    ['ap_expense_report_headers_all',  'iexpense_detail'],
    ['ap_expense_report_headers',      'iexpense_detail'],
    ['ap_expense_report_lines_all',    'iexpense_detail'],
    ['ap_expense_report_lines',        'iexpense_detail'],
    ['ap_expense_reports_all',         'iexpense_detail'],
    ['ap_expense_reports',             'iexpense_detail'],
    ['ame_trans_approval_history',     'workflow_approvals'],
    ['ap_credit_card_trxns_all',       'credit_card_report'],
    ['ap_credit_card_trxns',           'credit_card_report'],
    /* AP */
    ['ap_invoices_all',                'invoice_register'],
    ['ap_invoice_distributions_all',   'invoice_register'],
    ['ap_invoice_distributions',       'invoice_register'],
    ['ap_invoice_payments',            'supplier_payment_history'],
    ['ap_payment_schedules_all',       'aged_payables_detail'],
    ['ap_payment_schedules',           'aged_payables_detail'],
    ['ap_checks_all',                  'supplier_payment_history'],
    ['ap_checks',                      'supplier_payment_history'],
    ['ap_suppliers',                   'suppliers_list'],
    ['ap_supplier_sites_all',          'suppliers_list'],
    ['ap_withholding_tax_detail',      'withholding_tax'],
    ['zx_withholding',                 'withholding_tax'],
    /* AR */
    ['ar_payment_schedules_all',       'aged_payables_summary'],
    ['ar_payment_schedules',           'aged_payables_summary'],
    ['ar_customers',                   'suppliers_list'],
    ['hz_cust_accounts',               'suppliers_list'],
    /* GL */
    ['gl_je_headers',                  'gl_journals'],
    ['gl_je_lines',                    'gl_journals'],
    ['gl_balances',                    'gl_trial_balance'],
    ['gl_code_combinations',           'gl_account_analysis'],
    /* HRMS */
    ['per_all_people_f',               'employee_report'],
    ['per_all_assignments_f',          'active_employees'],
    ['per_assignment_status_types',    'active_employees'],
    ['per_person_types',               'employee_report'],
    ['hr_organization_units',          'employee_report'],
    ['hr_all_organization_units',      'employee_report'],
    ['pay_payroll_actions',            'expense_cost_allocation'],
    /* PO / Purchasing */
    ['po_headers_all',                 'po_detail'],
    ['po_lines_all',                   'po_detail'],
    ['po_distributions_all',           'po_distribution'],
    ['rcv_transactions',               'receipt_adjustments'],
    ['rcv_shipment_lines',             'receipt_adjustments'],
    /* FND */
    ['fnd_concurrent_requests',        'iexpense_detail'],
    ['fnd_user',                       'employee_report'],
  ];

  let matchedKey = null;
  for (const [tbl, key] of TABLE_MAP) {
    if (lc.includes(tbl) && window.REPORT_DATA[key]) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) {
    /* Fallback: keyword inference from SELECT columns / aliases */
    if      (lc.includes('aerh.') || lc.includes('aerl.') || lc.includes('aera.') ||
             lc.includes('expense_report') || lc.includes('iexpense'))
                                          matchedKey = 'iexpense_detail';
    else if (lc.includes('atah.') || lc.includes('ame_trans'))
                                          matchedKey = 'workflow_approvals';
    else if (lc.includes('ap_invoice') || lc.includes('invoice_num') || lc.includes('invoice_id'))
                                          matchedKey = 'invoice_register';
    else if (lc.includes('aps.vendor') || lc.includes('ap_supplier'))
                                          matchedKey = 'suppliers_list';
    else if (lc.includes('apc.check') || lc.includes('ap_check'))
                                          matchedKey = 'supplier_payment_history';
    else if (lc.includes('aged') || lc.includes('overdue') || lc.includes('due_date'))
                                          matchedKey = 'aged_payables_detail';
    else if (lc.includes('withhold') || lc.includes('1099'))
                                          matchedKey = 'withholding_tax';
    else if (lc.includes('gl_je') || lc.includes('journal'))
                                          matchedKey = 'gl_journals';
    else if (lc.includes('gl_balance') || lc.includes('trial_balance'))
                                          matchedKey = 'gl_trial_balance';
    else if (lc.includes('per_all') || lc.includes('papf.') || lc.includes('paaf.'))
                                          matchedKey = 'employee_report';
    else if (lc.includes('po_header') || lc.includes('purchase_order') || lc.includes('poh.'))
                                          matchedKey = 'po_detail';
    else if (lc.includes('po_distrib') || lc.includes('pod.'))
                                          matchedKey = 'po_distribution';
    else if (lc.includes('rcv_') || lc.includes('receipt'))
                                          matchedKey = 'receipt_adjustments';
    else if (lc.includes('supplier') || lc.includes('vendor'))
                                          matchedKey = 'suppliers_list';
    else if (lc.includes('invoice'))      matchedKey = 'invoice_register';
    else if (lc.includes('employee') || lc.includes('headcount'))
                                          matchedKey = 'active_employees';
  }

  if (!matchedKey || !window.REPORT_DATA[matchedKey]) {
    showToast('⚠ No matching demo table found. Try keywords: ap_invoices_all, ap_suppliers, gl_je_headers, per_all_people_f, po_headers_all…', 'warning');
    return;
  }

  const rep = window.REPORT_DATA[matchedKey];

  /* ── Extract actual SELECT column aliases from the SQL ──────────────────
     Strategy:
       1. Strip -- comments
       2. Replace ALL (...) blocks (subqueries, CASE, functions) with a
          placeholder token that carries the trailing alias, so the
          outer SELECT…FROM regex sees a flat list of column expressions.
       3. Find the SELECT … FROM boundary on the flattened string.
       4. Split on top-level commas and extract the alias from each part.  */
  function _extractSqlColumns(rawSql) {
    /* 1. Remove -- comments (keep newlines so multiline SQL stays intact) */
    let s = rawSql.replace(/--[^\n]*/g, ' ');

    /* 2. Collapse all parenthesised blocks to a single token "__SUB__"
          but keep the text that comes AFTER the closing paren on the same
          "column slot" so the alias is still visible.
          We do a single left-to-right pass. */
    let flat = '';
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '(') {
        if (depth === 0) flat += '__SUB__';
        depth++;
      } else if (ch === ')') {
        depth = Math.max(0, depth - 1);
      } else {
        if (depth === 0) flat += ch;
      }
    }

    /* 3. Find the outermost SELECT … FROM boundary.
          After flattening there are no subquery FROMs left, so the first
          FROM keyword after SELECT is the real one. */
    const selMatch = flat.match(/^\s*SELECT\s+DISTINCT\s+([\s\S]+?)\bFROM\b/i)
                  || flat.match(/^\s*SELECT\s+([\s\S]+?)\bFROM\b/i);
    if (!selMatch) return null;
    const selClause = selMatch[1];

    /* 4. Split on commas and extract alias from each part */
    const parts = selClause.split(',');
    const cols  = [];
    const SKIP  = /^(FROM|WHERE|AND|OR|ON|JOIN|AS|CASE|WHEN|THEN|ELSE|END|NULL|NOT|IN|IS|BY|OVER|INTO|SELECT|DISTINCT|DECODE|NVL|TRIM|TRUNC|TO_CHAR|SUBSTR|REPLACE|ROWNUM)$/i;

    for (const part of parts) {
      const t = part.trim();
      if (!t || t === '__SUB__') continue;

      /* Pattern: <anything> AS alias  — highest priority */
      const asMatch = t.match(/\bAS\s+(\w+)\s*$/i);
      if (asMatch && !SKIP.test(asMatch[1])) {
        cols.push(asMatch[1].toUpperCase()); continue;
      }

      /* Pattern: __SUB__ alias  — subquery followed by space-alias */
      const subAlias = t.match(/__SUB__\s+(\w+)\s*$/i);
      if (subAlias && !SKIP.test(subAlias[1])) {
        cols.push(subAlias[1].toUpperCase()); continue;
      }

      /* Pattern: table.column alias  or  table.column */
      const dotAlias = t.match(/\.\w+\s+(\w+)\s*$/);
      if (dotAlias && !SKIP.test(dotAlias[1])) {
        cols.push(dotAlias[1].toUpperCase()); continue;
      }
      const dotOnly = t.match(/\.(\w+)\s*$/);
      if (dotOnly && !SKIP.test(dotOnly[1])) {
        cols.push(dotOnly[1].toUpperCase()); continue;
      }

      /* Pattern: plain word (possibly with space-alias at end) */
      const spaceAlias = t.match(/\s+(\w+)\s*$/);
      if (spaceAlias && !SKIP.test(spaceAlias[1])) {
        cols.push(spaceAlias[1].toUpperCase()); continue;
      }

      /* Bare single identifier */
      const bare = t.match(/^(\w+)\s*$/);
      if (bare && !SKIP.test(bare[1])) {
        cols.push(bare[1].toUpperCase());
      }
    }

    return cols.length ? cols : null;
  }

  const parsedCols = _extractSqlColumns(sql);
  const useColumns = parsedCols || rep.columns;
  const colCount   = useColumns.length;

  /* ── Generate simulated rows matching the query's column shape ────────── */
  function _simValueForCol(colName) {
    const c = colName.toUpperCase();
    if (/NUM|NUMBER|REP_NUM|EXP_REP/.test(c))          return `EXP-${CY || new Date().getFullYear()}-${String(Math.floor(Math.random()*99999)).padStart(5,'0')}`;
    if (/EMP_NAME|FULL_NAME|EMPLOYEE_NAME|SUBMITTED_BY|APPR/.test(c)) return ['Alice Johnson','Bob Smith','Carol Davis','David Lee','Emma Wilson'][Math.floor(Math.random()*5)];
    if (/DEPT|ORG|BUSINESS_GROUP|OU/.test(c))           return ['Finance','IT','Operations','HR','Procurement'][Math.floor(Math.random()*5)];
    if (/DATE|DT$/.test(c))                             return `${new Date().getFullYear()}-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-${String(Math.floor(Math.random()*28)+1).padStart(2,'0')}`;
    if (/AMT|AMOUNT|TOTAL|REIM/.test(c))                return `$${(Math.random()*9000+100).toFixed(2)}`;
    if (/STATUS|CODE/.test(c))                          return ['Approved','Pending','Paid','Rejected','Manager Review'][Math.floor(Math.random()*5)];
    if (/CURRENCY|CCY/.test(c))                         return ['USD','EUR','GBP','INR','AUD'][Math.floor(Math.random()*5)];
    if (/AGING|AGE/.test(c))                            return String(Math.floor(Math.random()*90));
    if (/TYPE|TEMP/.test(c))                            return ['Travel','Meals','Hotel','Transport','Miscellaneous'][Math.floor(Math.random()*5)];
    if (/DESC|DESCRIPTION|PURPOSE/.test(c))             return 'Business expense for project activities';
    if (/RECEIPT/.test(c))                              return ['Received','Missing','Partial'][Math.floor(Math.random()*3)];
    if (/PARAM/.test(c))                                return 'Standard';
    return `SIM-${Math.floor(Math.random()*10000)}`;
  }

  const simRows = Array.from({length: rep.rows.length}, () =>
    useColumns.map(col => _simValueForCol(col))
  );

  showToast(`🗄 Query matched "${rep.title}" · ${colCount} columns · ${simRows.length} simulated rows`, 'success');

  /* Load into DC state */
  DC.rawFileName  = `DB Query → ${rep.title}`;
  DC.activeSheet  = rep.title;
  DC.rawHeaders   = [...useColumns];
  DC.rawRows      = simRows;
  DC.colTypes     = useColumns.map((_, ci) => _dcDetectType(simRows, ci));
  DC.mapping      = {};
  DC.transforms   = {};
  DC.targetReport = matchedKey;

  /* Auto-map using parsed column names */
  useColumns.forEach(c => { DC.mapping[c] = c; });

  /* Update file badge */
  document.getElementById('dcFileBadgeName').textContent = `${DC.rawFileName} · ${colCount} cols · ${simRows.length} rows`;
  document.getElementById('dcFileBadge').style.display   = '';

  _dcShowMapping();
  dcApplyMapping();
}

/* ── Switch connection mode (Simulated / Live DB) ────────────────────────── */
function dcSwitchConnMode(mode) {
  document.getElementById('dcConnTabSim').classList.toggle('active',  mode === 'sim');
  document.getElementById('dcConnTabLive').classList.toggle('active', mode === 'live');
  document.getElementById('dcConnSim').style.display  = mode === 'sim'  ? '' : 'none';
  document.getElementById('dcConnLive').style.display = mode === 'live' ? '' : 'none';
}

/* ── Live DB: update JDBC string preview as user types ───────────────────── */
function _dcUpdateJdbcPreview() {
  const host  = (document.getElementById('dcConnHost')?.value  || 'host').trim()   || 'host';
  const port  = (document.getElementById('dcConnPort')?.value  || '1521').trim()   || '1521';
  const sid   = (document.getElementById('dcConnSid')?.value   || 'SID').trim()    || 'SID';
  const pre   = document.getElementById('dcConnStrPreview');
  if (pre) pre.textContent = `jdbc:oracle:thin:@//${host}:${port}/${sid}`;
}

/* ── Test Connection (simulated with realistic UX) ───────────────────────── */
function dcTestConnection() {
  const host  = (document.getElementById('dcConnHost')?.value  || '').trim();
  const port  = (document.getElementById('dcConnPort')?.value  || '').trim();
  const sid   = (document.getElementById('dcConnSid')?.value   || '').trim();
  const user  = (document.getElementById('dcConnUser')?.value  || '').trim();
  const proxy = (document.getElementById('dcConnProxy')?.value || '').trim();
  const status = document.getElementById('dcConnStatus');
  const runBtn = document.getElementById('dcRunLiveBtn');

  if (!host || !sid || !user) {
    status.className = 'dc-conn-status err';
    status.textContent = '⚠ Fill in Host, Service/SID and Username';
    return;
  }

  status.className = 'dc-conn-status wait';
  status.textContent = '⏳ Testing connection…';
  if (runBtn) runBtn.disabled = true;

  /* Simulate a network round-trip delay */
  setTimeout(() => {
    if (proxy && (proxy.startsWith('http://') || proxy.startsWith('https://'))) {
      /* If a proxy URL was provided — try a real fetch to check it is reachable */
      fetch(proxy, { method: 'OPTIONS', mode: 'no-cors' })
        .then(() => {
          status.className = 'dc-conn-status ok';
          status.textContent = `✅ Proxy reachable — connected to ${host}:${port}/${sid} as ${user}`;
          if (runBtn) runBtn.disabled = false;
          showToast(`🔌 Connected to ${sid}@${host} — ready to query.`, 'success');
        })
        .catch(() => {
          status.className = 'dc-conn-status err';
          status.textContent = `❌ Proxy at ${proxy} not reachable. Is the backend server running?`;
          showToast('Proxy server not reachable. Check the URL and that the server is running.', 'error');
        });
    } else {
      /* No proxy / static app — show informative message */
      status.className = 'dc-conn-status err';
      status.textContent = '⚠ No backend proxy configured. Enter a Proxy URL pointing to your Node.js/Python server, or use Simulated mode.';
      showToast('Live DB requires a backend proxy. See ❓ How Mapping Works for setup details.', 'info');
    }
  }, 900);
}

/* ── Run Live DB query via proxy ─────────────────────────────────────────── */
function dcRunLiveQuery() {
  const proxy = (document.getElementById('dcConnProxy')?.value || '').trim();
  const sql   = (document.getElementById('dcDbQueryLive')?.value || '').trim();
  const host  = (document.getElementById('dcConnHost')?.value  || '').trim();
  const port  = (document.getElementById('dcConnPort')?.value  || '1521').trim();
  const sid   = (document.getElementById('dcConnSid')?.value   || '').trim();
  const user  = (document.getElementById('dcConnUser')?.value  || '').trim();
  const pass  = (document.getElementById('dcConnPass')?.value  || '').trim();

  if (!proxy) {
    showToast('Enter a Proxy URL first (e.g. http://localhost:3001/query).', 'warning');
    return;
  }
  if (!sql) {
    showToast('Enter a SELECT query.', 'warning');
    return;
  }

  showToast('⏳ Sending query to proxy…', 'info');

  fetch(proxy, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, host, port, sid, user, pass }),
  })
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => {
    /* Expected response: { columns: string[], rows: any[][] } */
    if (!data.columns || !Array.isArray(data.rows)) {
      throw new Error('Unexpected response format. Expected { columns, rows }.');
    }
    DC.rawFileName  = `Live DB → ${sid}`;
    DC.activeSheet  = sql.substring(0, 40) + '…';
    DC.rawHeaders   = data.columns;
    DC.rawRows      = data.rows.map(r => r.map(v => v == null ? '' : String(v)));
    DC.colTypes     = data.columns.map((_, ci) => _dcDetectType(DC.rawRows, ci));
    DC.mapping      = {};
    DC.transforms   = {};
    DC.targetReport = '';

    document.getElementById('dcFileBadgeName').textContent =
      `${DC.rawFileName} · ${data.columns.length} cols · ${data.rows.length} rows`;
    document.getElementById('dcFileBadge').style.display = '';

    _dcPopulateTargetReports();
    _dcShowMapping();
    showToast(`✅ Loaded ${data.rows.length} rows × ${data.columns.length} columns from ${sid}`, 'success');
  })
  .catch(err => {
    showToast(`❌ Proxy error: ${err.message}`, 'error');
  });
}

/* ── Attach live-typing listeners for JDBC preview (once DOM ready) ──────── */
(function _dcAttachConnListeners() {
  const tryAttach = () => {
    const fields = ['dcConnHost', 'dcConnPort', 'dcConnSid'];
    const allFound = fields.every(id => document.getElementById(id));
    if (!allFound) { setTimeout(tryAttach, 500); return; }
    fields.forEach(id => {
      document.getElementById(id).addEventListener('input', _dcUpdateJdbcPreview);
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAttach);
  } else {
    tryAttach();
  }
})();

/* ═══════════════════════════════════════════════════════════════════════════
   HOW MAPPING WORKS — Guide Modal
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Show guide — populates with live data if available ──────────────────── */
function dcShowMappingGuide() {
  /* Populate source pills with actual loaded headers (if any) */
  const srcEl = document.getElementById('dcGuideSourceCols');
  if (srcEl && DC.rawHeaders.length) {
    const display = DC.rawHeaders.slice(0, 6);
    srcEl.innerHTML = display.map(h =>
      `<span class="dc-guide-col-pill">${escHTML(h)}</span>`
    ).join('') + (DC.rawHeaders.length > 6
      ? `<span class="dc-guide-col-pill">+${DC.rawHeaders.length - 6} more</span>`
      : '');
  }

  /* Populate target pills with actual target report columns (if any) */
  const tgtEl = document.getElementById('dcGuideTargetCols');
  if (tgtEl && DC.targetReport && window.REPORT_DATA?.[DC.targetReport]) {
    const tgtCols = window.REPORT_DATA[DC.targetReport].columns || [];
    const display = tgtCols.slice(0, 6);
    tgtEl.innerHTML = display.map(c =>
      `<span class="dc-guide-col-pill dc-guide-col-tgt">${escHTML(c)}</span>`
    ).join('') + (tgtCols.length > 6
      ? `<span class="dc-guide-col-pill dc-guide-col-tgt">+${tgtCols.length - 6} more</span>`
      : '');
  }

  document.getElementById('dcMappingGuideModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

/* ── Close guide ────────────────────────────────────────────────────────── */
function dcCloseMappingGuide(e) {
  if (e && e.target !== document.getElementById('dcMappingGuideModal')) return;
  document.getElementById('dcMappingGuideModal').style.display = 'none';
  document.body.style.overflow = '';
}

/* ── Hook initDataConnect into switchTab ─────────────────────────────────── */
(function _patchSwitchTab() {
  const _origSwitchTab = window.switchTab;
  window.switchTab = function(tabId, btn) {
    _origSwitchTab(tabId, btn);
    if (tabId === 'tab-dataconnect') initDataConnect();
  };
})();

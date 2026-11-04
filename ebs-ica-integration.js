/* Oracle EBS Intelligence Hub — ICA Integration Layer */
'use strict';
const ICA_BACKEND_URL = 'http://localhost:8000';
const ICA_HEALTH_URL  = ICA_BACKEND_URL + '/health';
const ICA_CHAT_URL    = ICA_BACKEND_URL + '/api/chat';
/* ── Report Intent Detection ─────────────────────────────────
   If message matches a report pattern → use local response
   If message is a question → use ICA Agent                  */
function _isReportIntent(msg) {
  var lower = msg.toLowerCase();
  var patterns = [
    /* AP Reports */
    'aged payable','outstanding invoice','overdue',
    'invoice register','all invoice','invoice list',
    'trial balance','ap balance','payable balance',
    'withholding tax','1099','tax supplier',
    /* Supplier */
    'supplier','vendor','high payment',
    /* PO */
    'purchase order','po detail','po list',
    'savings','procurement saving',
    /* iExpense */
    'iexpense','expense report','expense pending',
    'credit card','corporate card',
    'workflow','approval status','pending approval',
    /* GL */
    'journal','gl entry','general ledger',
    /* HRMS */
    'active employee','headcount',
    'terminated','ex-employee',
    'cost allocation','expense account','allocation',
    /* Generic report triggers */
    'show report','load report','run report',
    'display report','open report'
  ];
  return patterns.some(function(p){
    return lower.includes(p);
  });
}
/* ── ICA Service ─────────────────────────────────────────── */
window.icaService = {
  online:    false,
  sessionId: 'ebs-' + Date.now(),
  checkHealth: function() {
    fetch(ICA_HEALTH_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ping:true})
    })
    .then(function(r){ return r.json(); })
    .then(function(){
      var wasOnline = window.icaService.online;
      window.icaService.online = true;
      if (!wasOnline) {
        console.info('[ICA] ✅ Backend connected');
        window.icaService._updateBadge(true);
      }
    })
    .catch(function(){
      var wasOnline = window.icaService.online;
      window.icaService.online = false;
      if (wasOnline) {
        window.icaService._updateBadge(false);
      }
    });
  },
  icaWorkflowChat: function(message) {
    return fetch(ICA_CHAT_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        message:    message,
        session_id: window.icaService.sessionId
      })
    })
    .then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data){
      return (data && data.success && data.message)
        ? data.message : null;
    })
    .catch(function(e){
      console.warn('[ICA] Chat error:', e.message);
      return null;
    });
  },
  _updateBadge: function(online) {
    var badge = document.getElementById('icaStatusBadge');
    if (!badge) return;
    if (online) {
      badge.textContent      = '● ICA Live';
      badge.style.color      = '#24A148';
      badge.style.background = '#DEFBE6';
      badge.style.border     = '1px solid #24A148';
      badge.style.animation  = 'none';
    } else {
      badge.textContent      = '○ ICA Offline';
      badge.style.color      = '#DA1E28';
      badge.style.background = '#FFF1F1';
      badge.style.border     = '1px solid #DA1E28';
    }
  }
};
/* ── Health Polling ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    window.icaService.checkHealth();
  }, 800);
  setInterval(function(){
    window.icaService.checkHealth();
  }, 30000);
});
/* ── Chat Patch ──────────────────────────────────────────── */
(function _patchChat(){
  function _tryHook(){
    if (typeof window.sendChatMessage !== 'function'){
      setTimeout(_tryHook, 300);
      return;
    }
    if (window.sendChatMessage._ica_patched) return;
    var _orig = window.sendChatMessage;
    window.sendChatMessage = function(){
      var inputEl = document.getElementById('chatInput');
      var msg = inputEl ? inputEl.value.trim() : '';
      /* ── ROUTING DECISION ──────────────────────────────
         Report intent   → local generateChatResponse
         Question/query  → ICA Agent
         ICA offline     → local generateChatResponse    */
      var icaReady = (
        msg &&
        window.icaService &&
        window.icaService.online
      );
      /* Route to local if report intent detected */
      if (!icaReady || _isReportIntent(msg)) {
        console.info('[ICA] 📊 Report intent — using local');
        return _orig.apply(this, arguments);
      }
      /* Route to ICA Agent for questions */
      console.info('[ICA] 🤖 Question intent — using ICA Agent');
      /* 1. Add user bubble */
      var msgs = document.getElementById('chatMessages');
      var userDiv = document.createElement('div');
      userDiv.className = 'message user';
      userDiv.innerHTML =
        '<div class="msg-avatar">👤</div>' +
        '<div class="msg-bubble"><p>' +
          msg.replace(/&/g,'&amp;')
             .replace(/</g,'&lt;')
             .replace(/>/g,'&gt;') +
        '</p></div>';
      msgs.appendChild(userDiv);
      if (inputEl) inputEl.value = '';
      /* 2. Show ICA typing bubble */
      var icaDiv = document.createElement('div');
      icaDiv.className = 'message assistant';
      var bubbleId = 'ica-bubble-' + Date.now();
      icaDiv.innerHTML =
        '<div class="msg-avatar" style="' +
          'background:#0F62FE;color:#fff;' +
          'font-size:0.7rem;font-weight:700;' +
          'min-width:32px;height:32px;' +
          'border-radius:50%;' +
          'display:flex;align-items:center;' +
          'justify-content:center;">' +
          'ICA' +
        '</div>' +
        '<div class="msg-bubble" id="' + bubbleId + '" style="' +
          'background:#EDF5FF;' +
          'border:1.5px solid #0F62FE;' +
          'border-radius:8px;' +
          'padding:12px;max-width:82%;">' +
          '<div style="font-size:0.68rem;' +
            'color:#0F62FE;font-weight:700;' +
            'margin-bottom:8px;">' +
                        '🤖 ICA Agent — Retrieving from Context Studio...' +
          '</div>' +
          '<div style="display:flex;gap:6px;' +
            'align-items:center;padding:6px 0;">' +
            '<span style="width:8px;height:8px;' +
              'border-radius:50%;background:#0F62FE;' +
              'opacity:0.4;' +
              'animation:icaDot 1.2s 0.0s infinite;">'+
            '</span>' +
            '<span style="width:8px;height:8px;' +
              'border-radius:50%;background:#0F62FE;' +
              'opacity:0.4;' +
              'animation:icaDot 1.2s 0.4s infinite;">'+
            '</span>' +
            '<span style="width:8px;height:8px;' +
              'border-radius:50%;background:#0F62FE;' +
              'opacity:0.4;' +
              'animation:icaDot 1.2s 0.8s infinite;">'+
            '</span>' +
          '</div>' +
        '</div>';
      msgs.appendChild(icaDiv);
      msgs.scrollTop = msgs.scrollHeight;
      /* 3. Call ICA Agent */
      window.icaService.icaWorkflowChat(msg)
        .then(function(icaReply){
          var bubble = document.getElementById(bubbleId);
          if (!bubble) return;
          if (!icaReply || icaReply.trim().length < 10){
            /* ICA failed — remove bubble and use local */
            icaDiv.remove();
            if (inputEl) inputEl.value = msg;
            _orig.apply(this, []);
            return;
          }
          /* 4. Format reply */
          var formatted = icaReply
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/\*\*(.*?)\*\*/g,
              '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g,
              '<em>$1</em>')
            .replace(/### (.*?)(\n|$)/g,
              '<h4 style="margin:6px 0 3px;' +
              'font-size:0.85rem;color:#161616;">$1</h4>')
            .replace(/## (.*?)(\n|$)/g,
              '<h3 style="margin:8px 0 4px;' +
              'font-size:0.9rem;color:#161616;">$1</h3>')
            .replace(/^- (.*?)(\n|$)/gm,
              '<div style="margin:3px 0 3px 8px;">' +
              '• $1</div>')
            .replace(/\n/g,'<br>');
          /* 5. Replace typing dots with response */
          bubble.innerHTML =
            '<div style="' +
              'font-size:0.68rem;' +
              'color:#0F62FE;' +
              'font-weight:700;' +
              'margin-bottom:8px;' +
              'letter-spacing:0.5px;">' +
              '🤖 ICA Agent — Live Grounded Response' +
            '</div>' +
            '<div style="' +
              'font-size:0.85rem;' +
              'line-height:1.6;' +
              'color:#161616;">' +
              formatted +
            '</div>' +
            '<div style="' +
              'font-size:0.65rem;' +
              'color:#0F62FE;' +
              'margin-top:8px;' +
              'opacity:0.7;' +
              'border-top:1px solid #C8DFF5;' +
              'padding-top:4px;">' +
              '● ICA Live · EBS Context Studio · ' +
              new Date().toLocaleTimeString() +
            '</div>';
          msgs.scrollTop = msgs.scrollHeight;
          console.info('[ICA] ✅ Agent response rendered');
        })
        .catch(function(e){
          console.warn('[ICA] Error:', e.message);
          icaDiv.remove();
        });
      /* Intercepted — do NOT call _orig */
      return;
    };
    window.sendChatMessage._ica_patched = true;
    console.info('[ICA] ✅ Chat patched — smart routing active');
  }
  _tryHook();
})();
/* ── Dot Animation CSS ───────────────────────────────────── */
(function _addStyles(){
  var style = document.createElement('style');
  style.textContent =
    '@keyframes icaDot {' +
      '0%,100%{ opacity:0.2; transform:scale(0.8); }' +
      '50%    { opacity:1.0; transform:scale(1.2); }' +
    '}';
  document.head.appendChild(style);
})();
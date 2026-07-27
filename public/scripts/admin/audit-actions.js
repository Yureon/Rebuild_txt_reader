(function(global){
  'use strict';
  var PASS = 'v416-admin-audit-actions-split-pass';
  function auditParams(ctx){ var auditMod = global.AdminAudit || {}; if (auditMod.buildParams) return auditMod.buildParams(function(id){ var el = ctx.$(id); return el && ('value' in el) ? el.value : ''; }); return 'limit=100'; }
  function fmtAuditEvent(e){ var auditMod = global.AdminAudit || {}; return auditMod.formatAuditEvent ? auditMod.formatAuditEvent(e) : JSON.stringify(e); }
  function loadAuditLog(ctx){ return ctx.jf('/api/admin/audit-log?' + auditParams(ctx)).then(function(d){ var box = ctx.$('audit-log-output'); var rows = (d.events || []).map(fmtAuditEvent); if (box) box.textContent = 'pass: ' + (d.pass || '') + '\ncount: ' + d.count + ' / scanned: ' + d.scanned + ' / malformed: ' + d.malformed + '\n\n' + (rows.join('\n\n') || '표시할 감사 로그가 없습니다.'); return d; }); }
  function downloadAuditLog(ctx){ global.open('/api/admin/audit-log/export?' + auditParams(ctx), '_blank', 'noopener'); }
  function bindAuditActions(ctx){ var $ = ctx.$; if ($('admin-audit-log-btn')) $('admin-audit-log-btn').onclick = function(){ if (ctx.showAdminSection) ctx.showAdminSection('audit'); loadAuditLog(ctx).catch(ctx.log); }; if ($('audit-load-btn')) $('audit-load-btn').onclick = function(){ loadAuditLog(ctx).catch(ctx.log); }; if ($('audit-export-btn')) $('audit-export-btn').onclick = function(){ downloadAuditLog(ctx); }; }
  global.AdminAuditActions = { PASS:PASS, auditParams:auditParams, loadAuditLog:loadAuditLog, downloadAuditLog:downloadAuditLog, bindAuditActions:bindAuditActions };
})(window);

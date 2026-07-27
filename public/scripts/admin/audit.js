(function(global){
  'use strict';
  var PASS = 'v417-admin-audit-split-pass';
  function buildParams(get){
    var q = [];
    var type = (get('audit-event-type') || '').trim();
    var user = (get('audit-user-filter') || '').trim();
    var query = (get('audit-query') || '').trim();
    var limit = (get('audit-limit') || '100').trim();
    if (type) q.push('eventType=' + encodeURIComponent(type));
    if (user) q.push('userId=' + encodeURIComponent(user));
    if (query) q.push('q=' + encodeURIComponent(query));
    q.push('limit=' + encodeURIComponent(limit || '100'));
    return q.join('&');
  }
  function formatAuditEvent(e){
    return '[' + (e.ts || '') + '] ' + (e.eventType || '') + ' actor=' + (e.actorUserId || '-') + ' target=' + (e.targetUserId || '-') + '\n' + JSON.stringify(e.details || {}, null, 2);
  }
  global.AdminAudit = { PASS:PASS, buildParams:buildParams, formatAuditEvent:formatAuditEvent };
})(window);

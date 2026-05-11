const express = require('express');
// v411-admin-diagnostics-grade-pass
const { TXT_READER_MULTI_ADMIN_DIAGNOSTICS_PASS } = require('../services/admin-diagnostics-service');
const { TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS } = require('../services/audit-log-service');

function createDiagnosticsRouter({ setNoStore, now = () => Date.now(), requireOwnerSession = null, adminDiagnosticsService = null, auditLogService = null, searchPerformanceService = null } = {}) {
  if (typeof setNoStore !== 'function') throw new Error('setNoStore is required');

  const router = express.Router();

  router.get('/time', (req, res) => {
    setNoStore(res);
    res.json({ ts: now() });
  });


  if (searchPerformanceService && typeof searchPerformanceService.getProfile === 'function') {
    router.get('/search-performance-profile', (req, res) => {
      setNoStore(res);
      try {
        return res.json(searchPerformanceService.getProfile());
      } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, error: 'search_performance_profile_failed', message: error && error.message || 'search performance profile failed' });
      }
    });
  }

  if (typeof requireOwnerSession === 'function' && adminDiagnosticsService && typeof adminDiagnosticsService.buildDiagnostics === 'function') {
    router.get('/admin/diagnostics', requireOwnerSession, (req, res) => {
      setNoStore(res);
      try {
        return res.json(adminDiagnosticsService.buildDiagnostics(req));
      } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, pass: TXT_READER_MULTI_ADMIN_DIAGNOSTICS_PASS, error: 'admin_diagnostics_failed', message: error && error.message || 'diagnostics failed' });
      }
    });
  }


  if (typeof requireOwnerSession === 'function' && auditLogService && typeof auditLogService.readEvents === 'function') {
    router.get('/admin/audit-log', requireOwnerSession, (req, res) => {
      setNoStore(res);
      try {
        const payload = auditLogService.readEvents(req.query || {});
        if (!payload.ok) return res.status(500).json({ ...payload, error: payload.error || 'audit_log_query_failed' });
        return res.json(payload);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, pass: TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, error: 'audit_log_query_failed', message: error && error.message || 'audit log query failed' });
      }
    });

    router.get('/admin/audit-log/export', requireOwnerSession, (req, res) => {
      setNoStore(res);
      try {
        const payload = typeof auditLogService.exportEvents === 'function'
          ? auditLogService.exportEvents(req.query || {})
          : { ok: false, pass: TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, error: 'audit_log_export_unavailable', jsonl: '' };
        if (!payload.ok) return res.status(500).json({ ...payload, error: payload.error || 'audit_log_export_failed' });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="txt-reader-audit-${stamp}.jsonl"`);
        return res.send(payload.jsonl || '');
      } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, pass: TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, error: 'audit_log_export_failed', message: error && error.message || 'audit log export failed' });
      }
    });
  }

  return router;
}

module.exports = { createDiagnosticsRouter };

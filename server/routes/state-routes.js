const express = require('express');

function sendStateError(res, err, fallbackMessage) {
  const status = err && Number.isFinite(Number(err.statusCode || err.status)) ? Number(err.statusCode || err.status) : 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: err && err.message || fallbackMessage || 'state request failed' });
}

function createStateRouter(options = {}) {
  const {
    setNoStore,
    requireSameOrigin,
    requireCsrf,
    checkApiWriteLimit,
    stateWriteService,
    resolveStateWriteService,
    requireUserSession = (req, res, next) => next(),
    filterStateResponse
  } = options;
  const required = { setNoStore, requireSameOrigin, requireCsrf, checkApiWriteLimit };
  Object.keys(required).forEach((key) => { if (!required[key]) throw new Error(`createStateRouter missing dependency: ${key}`); });
  if (!stateWriteService && typeof resolveStateWriteService !== 'function') throw new Error('createStateRouter missing dependency: stateWriteService or resolveStateWriteService');
  function serviceFor(req) { return typeof resolveStateWriteService === 'function' ? resolveStateWriteService(req) : stateWriteService; }
  function filterFor(req, response) { return typeof filterStateResponse === 'function' ? filterStateResponse(req, response) : response; }
  const router = express.Router();
  router.get('/user-state', requireUserSession, (req, res) => { setNoStore(res); try { return res.json(filterFor(req, serviceFor(req).getUserStateResponse(req))); } catch (err) { return sendStateError(res, err, 'state read failed'); } });
  router.put('/user-state/shared', requireUserSession, requireSameOrigin, requireCsrf, (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-shared', 120, 60 * 1000)) return res.status(429).json({ error: 'too many shared state writes' }); return res.json(filterFor(req, serviceFor(req).saveSharedState(req.body))); } catch (err) { return sendStateError(res, err, 'shared state save failed'); } });
  router.put('/user-state/progress', requireUserSession, requireSameOrigin, requireCsrf, (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-progress', 240, 60 * 1000)) return res.status(429).json({ error: 'too many progress writes' }); return res.json(filterFor(req, serviceFor(req).saveProgressState(req.body))); } catch (err) { return sendStateError(res, err, 'progress state save failed'); } });
  router.put('/user-state/device', requireUserSession, requireSameOrigin, requireCsrf, (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-device', 90, 60 * 1000)) return res.status(429).json({ error: 'too many device state writes' }); return res.json(filterFor(req, serviceFor(req).saveDeviceState(req, req.body))); } catch (err) { return sendStateError(res, err, 'device state save failed'); } });
  router.get('/sync', requireUserSession, (req, res) => { setNoStore(res); try { return res.json(serviceFor(req).getLegacySyncState()); } catch (err) { return sendStateError(res, err, 'legacy sync read failed'); } });
  router.post('/sync', requireUserSession, requireSameOrigin, requireCsrf, (req, res) => { setNoStore(res); return res.status(410).json({ error: 'legacy sync api disabled', message: '/api/user-state/shared 또는 /api/user-state/device 를 사용하세요.' }); });
  return router;
}
module.exports = { createStateRouter };

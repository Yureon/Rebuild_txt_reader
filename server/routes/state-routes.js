const { createAsyncSafeRouter, getPublicApiError } = require('../utils/async-route');

function sendStateError(res, err, fallbackMessage) {
  const publicError = getPublicApiError(err, {
    fallbackCode:'state_request_failed',
    fallbackMessage:fallbackMessage || 'state request failed'
  });
  if (publicError.status >= 500) console.error(err);
  return res.status(publicError.status).json({ error:publicError.error, message:publicError.message });
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
    filterStateResponse,
    filterStateInput
  } = options;
  const required = { setNoStore, requireSameOrigin, requireCsrf, checkApiWriteLimit };
  Object.keys(required).forEach((key) => { if (!required[key]) throw new Error(`createStateRouter missing dependency: ${key}`); });
  if (!stateWriteService && typeof resolveStateWriteService !== 'function') throw new Error('createStateRouter missing dependency: stateWriteService or resolveStateWriteService');
  function serviceFor(req) { return typeof resolveStateWriteService === 'function' ? resolveStateWriteService(req) : stateWriteService; }
  async function filterFor(req, response) { return typeof filterStateResponse === 'function' ? filterStateResponse(req, response) : response; }
  async function filterInputFor(req, kind, body) { return typeof filterStateInput === 'function' ? filterStateInput(req, kind, body) : body; }
  const router = createAsyncSafeRouter();
  router.get('/user-state', requireUserSession, async (req, res) => { setNoStore(res); try { return res.json(await filterFor(req, serviceFor(req).getUserStateResponse(req))); } catch (err) { return sendStateError(res, err, 'state read failed'); } });
  router.put('/user-state/shared', requireUserSession, requireSameOrigin, requireCsrf, async (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-shared', 120, 60 * 1000)) return res.status(429).json({ error: 'too many shared state writes' }); return res.json(await filterFor(req, (serviceFor(req).saveSharedStateAsync ? serviceFor(req).saveSharedStateAsync(await filterInputFor(req, 'shared', req.body)) : serviceFor(req).saveSharedState(await filterInputFor(req, 'shared', req.body))))); } catch (err) { return sendStateError(res, err, 'shared state save failed'); } });
  router.put('/user-state/progress', requireUserSession, requireSameOrigin, requireCsrf, async (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-progress', 240, 60 * 1000)) return res.status(429).json({ error: 'too many progress writes' }); return res.json(await filterFor(req, (serviceFor(req).saveProgressStateAsync ? serviceFor(req).saveProgressStateAsync(await filterInputFor(req, 'progress', req.body)) : serviceFor(req).saveProgressState(await filterInputFor(req, 'progress', req.body))))); } catch (err) { return sendStateError(res, err, 'progress state save failed'); } });
  router.patch('/user-state/progress/:novelId', requireUserSession, requireSameOrigin, requireCsrf, async (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-progress-delta', 300, 60 * 1000)) return res.status(429).json({ error: 'too many progress writes' }); const body = await filterInputFor(req, 'progress-delta', req.body); const service = serviceFor(req); return res.json(await filterFor(req, service.saveProgressDeltaAsync ? service.saveProgressDeltaAsync(body, req.params.novelId) : service.saveProgressDelta(body, req.params.novelId))); } catch (err) { return sendStateError(res, err, 'progress state save failed'); } });
  router.put('/user-state/device', requireUserSession, requireSameOrigin, requireCsrf, async (req, res) => { setNoStore(res); try { if (!checkApiWriteLimit(req, 'user-state-device', 90, 60 * 1000)) return res.status(429).json({ error: 'too many device state writes' }); return res.json(await filterFor(req, (serviceFor(req).saveDeviceStateAsync ? serviceFor(req).saveDeviceStateAsync(req, await filterInputFor(req, 'device', req.body)) : serviceFor(req).saveDeviceState(req, await filterInputFor(req, 'device', req.body))))); } catch (err) { return sendStateError(res, err, 'device state save failed'); } });
  router.get('/sync', requireUserSession, (req, res) => { setNoStore(res); return res.status(410).json({ error:'legacy sync api disabled', message:'/api/user-state 를 사용하세요.' }); });
  router.post('/sync', requireUserSession, requireSameOrigin, requireCsrf, (req, res) => { setNoStore(res); return res.status(410).json({ error: 'legacy sync api disabled', message: '/api/user-state/shared 또는 /api/user-state/device 를 사용하세요.' }); });
  return router;
}
module.exports = { createStateRouter };

const { createAsyncSafeRouter } = require('../utils/async-route');

function createRecoveryRouter({ recoveryService, setNoStore, requireOwnerSession = (req, res, next) => next() } = {}) {
  if (!recoveryService) throw new Error('recoveryService is required');
  if (typeof setNoStore !== 'function') throw new Error('setNoStore is required');
  if (typeof requireOwnerSession !== 'function') throw new Error('requireOwnerSession is required');

  const router = createAsyncSafeRouter();

  router.get('/recovery-status', requireOwnerSession, async (req, res) => {
    setNoStore(res);
    try {
      const status = typeof recoveryService.getRecoveryStatusAsync === 'function'
        ? await recoveryService.getRecoveryStatusAsync()
        : recoveryService.getRecoveryStatus();
      return res.json(status);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ ok:false, error:'internal_server_error', message:'recovery status failed' });
    }
  });

  return router;
}

module.exports = { createRecoveryRouter };

const express = require('express');

function createRecoveryRouter({ recoveryService, setNoStore, requireOwnerSession = (req, res, next) => next() } = {}) {
  if (!recoveryService) throw new Error('recoveryService is required');
  if (typeof setNoStore !== 'function') throw new Error('setNoStore is required');
  if (typeof requireOwnerSession !== 'function') throw new Error('requireOwnerSession is required');

  const router = express.Router();

  router.get('/recovery-status', requireOwnerSession, (req, res) => {
    setNoStore(res);
    res.json(recoveryService.getRecoveryStatus());
  });

  return router;
}

module.exports = { createRecoveryRouter };

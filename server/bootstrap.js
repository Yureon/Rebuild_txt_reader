const { start, stop } = require('./app');

const GRACEFUL_SHUTDOWN_PASS = 'v592-graceful-shutdown-flush-pass';
const GRACEFUL_SHUTDOWN_DRAIN_PASS = 'v605-graceful-shutdown-drain-pass';

function boundedMs(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  const resolved = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(resolved)));
}

const SHUTDOWN_GRACE_MS = boundedMs(process.env.SHUTDOWN_GRACE_MS, 45000, 5000, 300000);
const SHUTDOWN_HTTP_DRAIN_MS = boundedMs(process.env.SHUTDOWN_HTTP_DRAIN_MS, 10000, 1000, Math.max(1000, SHUTDOWN_GRACE_MS - 1000));
const server = start();
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  const forceTimer = setTimeout(() => {
    try { server.closeAllConnections?.(); } catch {}
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceTimer.unref?.();

  let drainTimer = null;
  const closePromise = new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    try { server.closeIdleConnections?.(); } catch {}
    drainTimer = setTimeout(() => {
      try { server.closeIdleConnections?.(); } catch {}
      try { server.closeAllConnections?.(); } catch {}
    }, SHUTDOWN_HTTP_DRAIN_MS);
    drainTimer.unref?.();
  });

  try {
    let closeError = null;
    try { await closePromise; } catch (error) { closeError = error; }
    if (drainTimer) clearTimeout(drainTimer);
    await stop();
    if (closeError) throw closeError;
    clearTimeout(forceTimer);
    process.exit(0);
  } catch (error) {
    if (drainTimer) clearTimeout(drainTimer);
    clearTimeout(forceTimer);
    console.error(`[shutdown:${signal}]`, error);
    process.exit(1);
  }
}
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

module.exports = { GRACEFUL_SHUTDOWN_PASS, GRACEFUL_SHUTDOWN_DRAIN_PASS, SHUTDOWN_GRACE_MS, SHUTDOWN_HTTP_DRAIN_MS, boundedMs, shutdown };

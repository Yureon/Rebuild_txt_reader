const SHUTDOWN_ALL_SETTLED_PASS = 'v610-shutdown-all-settled-pass';

function settleShutdownOperations(operations) {
  const list = Array.isArray(operations) ? operations : [];
  return Promise.allSettled(list.map(operation => Promise.resolve().then(() => operation())));
}

module.exports = {
  SHUTDOWN_ALL_SETTLED_PASS,
  settleShutdownOperations
};

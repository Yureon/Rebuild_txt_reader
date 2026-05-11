const FRONTEND_CHECK_STEP_RUNNER_PASS = 'v242-frontend-check-step-runner-pass';
const FRONTEND_CHECK_SLOW_STEP_WARNING_PASS = 'v243-frontend-check-slow-step-warning-pass';
const FRONTEND_CHECK_SLOW_SMOKE_GROUP_WATCHDOG_PASS = 'v256-frontend-check-slow-smoke-group-watchdog-pass';
const FRONTEND_CHECK_SLOW_SMOKE_QUARANTINE_REPORT_PASS = 'v257-frontend-check-slow-smoke-quarantine-report-pass';
const FRONTEND_CHECK_CLEAN_EXIT_SUMMARY_PASS = 'v258-frontend-check-clean-exit-summary-pass';
const stepTimings = [];

async function runFrontendCheckStep(label, fn) {
  const name = String(label || 'unnamed frontend check');
  const startedAt = Date.now();
  if (process.env.FRONTEND_CHECK_TRACE === '1') console.log('Frontend check step start:', name);
  try {
    const result = typeof fn === 'function' ? fn() : undefined;
    const resolved = await result;
    const elapsedMs = Date.now() - startedAt;
    stepTimings.push({ label: name, elapsedMs });
    if (process.env.FRONTEND_CHECK_TRACE === '1') console.log('Frontend check step done:', name, elapsedMs + 'ms');
    return { pass: FRONTEND_CHECK_STEP_RUNNER_PASS, label: name, elapsedMs, result: resolved };
  } catch (error) {
    error.message = `[${name}] ${error && error.message || error}`;
    throw error;
  }
}

function getFrontendCheckStepTimings() {
  return stepTimings.slice();
}

function resolveSlowStepThreshold(options = {}) {
  const cliArg = Array.isArray(process.argv) ? process.argv.find(arg => String(arg).startsWith('--slow-step-ms=')) : '';
  const raw = options.slowThresholdMs ?? (cliArg ? cliArg.split('=')[1] : process.env.FRONTEND_CHECK_SLOW_STEP_MS);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 500;
}

function summarizeFrontendCheckTimings(options = {}) {
  const rows = getFrontendCheckStepTimings();
  const total = rows.reduce((sum, row) => sum + row.elapsedMs, 0);
  const worst = rows.reduce((max, row) => !max || row.elapsedMs > max.elapsedMs ? row : max, null);
  const thresholdMs = resolveSlowStepThreshold(options);
  const slow = rows.filter(row => row.elapsedMs >= thresholdMs).sort((a, b) => b.elapsedMs - a.elapsedMs);
  return { pass: FRONTEND_CHECK_SLOW_STEP_WARNING_PASS, total, thresholdMs, worst, slow, rows };
}


function summarizeSlowSmokeGroupWatchdog(options = {}) {
  const rows = getFrontendCheckStepTimings();
  const thresholdMs = resolveSlowStepThreshold(options);
  const smokeRows = rows.filter(row => /smoke|guard/i.test(row.label));
  const slowSmokeRows = smokeRows.filter(row => row.elapsedMs >= thresholdMs).sort((a, b) => b.elapsedMs - a.elapsedMs);
  const groupTotals = smokeRows.reduce((acc, row) => {
    const group = /server/i.test(row.label) ? 'server' : /recovery/i.test(row.label) ? 'recovery' : /reader|search/i.test(row.label) ? 'reader-search' : /css|shell/i.test(row.label) ? 'css-shell' : 'other';
    acc[group] = (acc[group] || 0) + row.elapsedMs;
    return acc;
  }, {});
  const quarantineLabels = slowSmokeRows.map(row => ({ label: row.label, elapsedMs: row.elapsedMs, quarantine: 'report-only', blocksFailure: false }));
  return {
    pass: FRONTEND_CHECK_SLOW_SMOKE_GROUP_WATCHDOG_PASS,
    cleanExitSummaryPass: FRONTEND_CHECK_CLEAN_EXIT_SUMMARY_PASS,
    quarantineReportPass: FRONTEND_CHECK_SLOW_SMOKE_QUARANTINE_REPORT_PASS,
    thresholdMs,
    smokeSteps: smokeRows.length,
    slowSmokeSteps: slowSmokeRows.length,
    slowSmokeRows,
    quarantineLabels,
    groupTotals
  };
}

function printSlowSmokeGroupWatchdog(options = {}) {
  const enabled = options.enabled === true || process.env.FRONTEND_CHECK_SMOKE_WATCHDOG === '1';
  const summary = summarizeSlowSmokeGroupWatchdog(options);
  if (!enabled) return summary;
  console.log('Frontend check slow smoke watchdog:');
  console.log(`- pass: ${summary.pass}`);
  console.log(`- smoke steps: ${summary.smokeSteps}`);
  console.log(`- slow smoke steps: ${summary.slowSmokeSteps}`);
  console.log(`- quarantine report pass: ${summary.quarantineReportPass}`);
  console.log(`- clean exit summary pass: ${summary.cleanExitSummaryPass}`);
  if (summary.quarantineLabels.length) summary.quarantineLabels.forEach(row => console.log(`- report-only quarantine: ${row.label} ${row.elapsedMs}ms`));
  Object.entries(summary.groupTotals).forEach(([group, total]) => console.log(`- ${group}: ${total}ms`));
  return summary;
}

function printFrontendCheckTimingReport(options = {}) {
  const enabled = options.enabled === true || process.env.FRONTEND_CHECK_TIMING === '1';
  if (!enabled) return;
  const summary = summarizeFrontendCheckTimings(options);
  console.log('Frontend check timing report:');
  summary.rows.forEach(row => console.log(`- ${row.label}: ${row.elapsedMs}ms`));
  console.log(`Frontend check timing total: ${summary.total}ms`);
  if (summary.worst) console.log(`Frontend check worst step: ${summary.worst.label} (${summary.worst.elapsedMs}ms)`);
  if (summary.slow.length) {
    console.warn(`Frontend check slow-step warning (${summary.thresholdMs}ms+): ${summary.slow.map(row => `${row.label}:${row.elapsedMs}ms`).join(', ')}`);
  } else {
    console.log(`Frontend check slow-step warning: none over ${summary.thresholdMs}ms`);
  }
}

module.exports = {
  FRONTEND_CHECK_STEP_RUNNER_PASS,
  FRONTEND_CHECK_SLOW_STEP_WARNING_PASS,
  FRONTEND_CHECK_SLOW_SMOKE_GROUP_WATCHDOG_PASS,
  FRONTEND_CHECK_SLOW_SMOKE_QUARANTINE_REPORT_PASS,
  FRONTEND_CHECK_CLEAN_EXIT_SUMMARY_PASS,
  runFrontendCheckStep,
  getFrontendCheckStepTimings,
  summarizeFrontendCheckTimings,
  summarizeSlowSmokeGroupWatchdog,
  printSlowSmokeGroupWatchdog,
  printFrontendCheckTimingReport
};

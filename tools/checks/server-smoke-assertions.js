const fs = require('fs');
const path = require('path');
const { requireAllMarkers } = require('./check-utils.js');

const SERVER_SMOKE_ASSERTIONS_PASS = 'v223-server-smoke-assertions-helper-pass';

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function requireRoute(source, route, context) {
  assertCondition(source.includes(route), `${context} missing route: ${route}`);
}

function requireRoutes(source, routes, context) {
  routes.forEach(route => requireRoute(source, route, context));
}

function requireSourceWindowMarkers(source, index, length, markers, context) {
  assertCondition(index >= 0, `${context} missing source window anchor`);
  requireAllMarkers(source.slice(index, index + length), markers, context);
}

function requireRouteWindowMarkers(source, route, length, markers, context) {
  requireSourceWindowMarkers(source, source.indexOf(route), length, markers, context || route);
}

function requireHeader(res, header, message) {
  assertCondition(!!res.getHeader(header), message || `missing header: ${header}`);
}

function requireStatus(res, statusCode, message) {
  assertCondition(res.statusCode === statusCode, message || `expected status ${statusCode}`);
}

function requireNextCalled(value, message) {
  assertCondition(!!value, message || 'expected middleware next() to be called');
}

module.exports = {
  SERVER_SMOKE_ASSERTIONS_PASS,
  assertCondition,
  readText,
  requireHeader,
  requireNextCalled,
  requireRoute,
  requireRouteWindowMarkers,
  requireRoutes,
  requireSourceWindowMarkers,
  requireStatus
};

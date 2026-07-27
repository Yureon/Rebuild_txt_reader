const express = require('express');

const ASYNC_ROUTE_ERROR_PASS = 'v610-async-route-error-pass';

function wrapAsyncHandler(handler) {
  if (Array.isArray(handler)) return handler.map(wrapAsyncHandler);
  if (typeof handler !== 'function' || handler.length === 4 || handler.__asyncRouteWrapped) return handler;
  function asyncRouteHandler(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') result.catch(next);
      return result;
    } catch (error) {
      return next(error);
    }
  }
  asyncRouteHandler.__asyncRouteWrapped = true;
  return asyncRouteHandler;
}

function createAsyncSafeRouter(...args) {
  const router = express.Router(...args);
  const routeMethods = ['all', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  [...routeMethods, 'use', 'param'].forEach((method) => {
    if (typeof router[method] !== 'function') return;
    const original = router[method].bind(router);
    router[method] = (...values) => original(...values.map(wrapAsyncHandler));
  });
  if (typeof router.route === 'function') {
    const originalRoute = router.route.bind(router);
    router.route = (path) => {
      const route = originalRoute(path);
      routeMethods.forEach((method) => {
        if (typeof route[method] !== 'function') return;
        const original = route[method].bind(route);
        route[method] = (...handlers) => original(...handlers.map(wrapAsyncHandler));
      });
      return route;
    };
  }
  return router;
}

function normalizeApiErrorStatus(error, fallbackStatus = 500) {
  const requested = Number(error && (error.statusCode || error.status));
  if (Number.isInteger(requested) && requested >= 400 && requested <= 599) return requested;
  const fallback = Number(fallbackStatus);
  return Number.isInteger(fallback) && fallback >= 400 && fallback <= 599 ? fallback : 500;
}

function getPublicApiError(error, options = {}) {
  const status = normalizeApiErrorStatus(error, options.status || options.fallbackStatus || 500);
  const code = String(error && error.code || '');
  const libraryRetryable = status === 503 && ['LIBRARY_COLD_BUILD_PENDING','LIBRARY_COLD_BUILD_BACKOFF','LIBRARY_COLD_BUILD_FAILED','LIBRARY_SYNC_COLD_BUILD_DISABLED','LIBRARY_SHELF_BUSY'].includes(code);
  if (libraryRetryable) {
    return {
      status:503,
      error:code === 'LIBRARY_SHELF_BUSY' ? 'library_busy' : 'library_warming',
      message:code === 'LIBRARY_SHELF_BUSY'
        ? '서재 목록 처리 요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        : '서재 저장소가 준비 중이거나 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.',
      retryAfterSeconds:Math.max(1, Number(error && error.retryAfterSeconds) || 1),
      pass:String(error && error.pass || '')
    };
  }
  const internal = status >= 500;
  return {
    status,
    error: internal
      ? String(options.internalCode || 'internal_server_error')
      : String(error && error.code || options.fallbackCode || 'request_failed'),
    message: internal
      ? String(options.internalMessage || options.fallbackMessage || 'Internal server error.')
      : String(error && error.message || options.fallbackMessage || 'Request failed.')
  };
}

function createApiErrorMiddleware({ logger = console } = {}) {
  return function apiErrorMiddleware(error, req, res, next) {
    if (res.headersSent) return next(error);
    const publicError = getPublicApiError(error);
    if (publicError.retryAfterSeconds) res.setHeader('Retry-After', String(publicError.retryAfterSeconds));
    if (publicError.status >= 500 && !publicError.retryAfterSeconds) logger?.error?.('Unhandled API request error:', error);
    return res.status(publicError.status).json({
      ok: false,
      error: publicError.error,
      message: publicError.message,
      retryAfterSeconds:publicError.retryAfterSeconds || undefined,
      pass: publicError.pass || ASYNC_ROUTE_ERROR_PASS
    });
  };
}

module.exports = {
  ASYNC_ROUTE_ERROR_PASS,
  wrapAsyncHandler,
  createAsyncSafeRouter,
  normalizeApiErrorStatus,
  getPublicApiError,
  createApiErrorMiddleware
};

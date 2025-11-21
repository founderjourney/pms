/**
 * Monitoring Configuration - Production Grade
 * Sentry Error Tracking + Health Checks + Performance Monitoring
 */

const Sentry = require('@sentry/node');

/**
 * Initialize Sentry Error Tracking
 */
const initSentry = (app) => {
  const sentryDSN = process.env.SENTRY_DSN;

  if (sentryDSN && process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: sentryDSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      integrations: [
        // Automatically instrument Node.js libraries and frameworks
        ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      ],
    });

    // Request handler must be the first middleware
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());

    console.log(' Sentry error tracking initialized');
  } else {
    console.log('9  Sentry not configured (set SENTRY_DSN in .env for production)');
  }
};

/**
 * Error Handler (must be before any other error middleware)
 */
const sentryErrorHandler = (req, res, next) => {
  // Only use Sentry handler if Sentry is configured
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    return Sentry.Handlers.errorHandler()(req, res, next);
  }
  next();
};

/**
 * Health Check Endpoint Handler
 */
const healthCheck = async (db) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../../package.json').version,
    checks: {},
  };

  try {
    // Check database connection
    const dbStart = Date.now();
    await db.get('SELECT 1 as test');
    health.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%',
  };

  // Overall response time
  health.responseTime = Date.now() - startTime;

  return health;
};

/**
 * Performance Monitoring Middleware
 */
const performanceMonitoring = (logger) => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    // Override res.end
    res.end = function (...args) {
      const duration = Date.now() - startTime;

      // Log slow requests (>1 second)
      if (duration > 1000) {
        logger.warn('Slow request detected: ' + req.method + ' ' + req.originalUrl + ' - ' + duration + 'ms');
      }

      // Track performance metrics
      if (global.performanceMetrics) {
        global.performanceMetrics.push({
          method: req.method,
          url: req.originalUrl,
          duration,
          status: res.statusCode,
          timestamp: new Date(),
        });

        // Keep only last 1000 entries
        if (global.performanceMetrics.length > 1000) {
          global.performanceMetrics.shift();
        }
      }

      // Call original end
      originalEnd.apply(res, args);
    };

    next();
  };
};

/**
 * Initialize performance metrics storage
 */
const initPerformanceMetrics = () => {
  global.performanceMetrics = [];
  console.log(' Performance monitoring initialized');
};

/**
 * Get performance stats
 */
const getPerformanceStats = () => {
  if (!global.performanceMetrics || global.performanceMetrics.length === 0) {
    return { message: 'No performance data available' };
  }

  const metrics = global.performanceMetrics;
  const durations = metrics.map(m => m.duration);

  return {
    totalRequests: metrics.length,
    averageResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    minResponseTime: Math.min(...durations),
    maxResponseTime: Math.max(...durations),
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    slowRequests: metrics.filter(m => m.duration > 1000).length,
    errorRequests: metrics.filter(m => m.status >= 400).length,
  };
};

/**
 * Calculate percentile
 */
const percentile = (arr, p) => {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[index];
};

module.exports = {
  initSentry,
  sentryErrorHandler,
  healthCheck,
  performanceMonitoring,
  initPerformanceMetrics,
  getPerformanceStats,
};

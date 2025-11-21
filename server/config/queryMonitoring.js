/**
 * Query Performance Monitoring
 *
 * Tracks database query performance and logs slow queries
 * Helps identify bottlenecks and optimization opportunities
 */

const logger = require('./logger');

// Configuration
const SLOW_QUERY_THRESHOLD_MS = 100; // Log queries slower than 100ms
const VERY_SLOW_QUERY_THRESHOLD_MS = 500; // Warn for queries slower than 500ms
const MAX_QUERY_LOG_LENGTH = 200; // Truncate long queries in logs

// Query statistics
const queryStats = {
  total: 0,
  slow: 0,
  verySlow: 0,
  avgDuration: 0,
  maxDuration: 0,
  minDuration: Infinity,
  queries: [], // Recent queries for analysis
  maxQueriesStored: 100
};

/**
 * Wrap database adapter to monitor query performance
 */
class QueryMonitor {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.originalQuery = dbAdapter.query.bind(dbAdapter);
    this.originalGet = dbAdapter.get.bind(dbAdapter);
    this.originalRun = dbAdapter.run.bind(dbAdapter);

    // Wrap methods to monitor performance
    this.wrapMethods();
  }

  wrapMethods() {
    // Wrap query method
    this.db.query = async (sql, params = []) => {
      return await this.monitorQuery('query', sql, params, this.originalQuery);
    };

    // Wrap get method
    this.db.get = async (sql, params = []) => {
      return await this.monitorQuery('get', sql, params, this.originalGet);
    };

    // Wrap run method
    this.db.run = async (sql, params = []) => {
      return await this.monitorQuery('run', sql, params, this.originalRun);
    };
  }

  async monitorQuery(method, sql, params, originalMethod) {
    const startTime = Date.now();
    let error = null;
    let result = null;

    try {
      result = await originalMethod(sql, params);
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      this.recordQuery(method, sql, params, duration, error, result);
    }
  }

  recordQuery(method, sql, params, duration, error, result) {
    // Update statistics
    queryStats.total++;
    queryStats.avgDuration =
      (queryStats.avgDuration * (queryStats.total - 1) + duration) / queryStats.total;
    queryStats.maxDuration = Math.max(queryStats.maxDuration, duration);
    queryStats.minDuration = Math.min(queryStats.minDuration, duration);

    // Track slow queries
    if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      queryStats.slow++;
    }

    if (duration >= VERY_SLOW_QUERY_THRESHOLD_MS) {
      queryStats.verySlow++;
    }

    // Store query for analysis
    const queryInfo = {
      method,
      sql: this.truncateSQL(sql),
      params: params.length,
      duration,
      timestamp: new Date().toISOString(),
      error: error ? error.message : null,
      rowCount: this.getRowCount(result)
    };

    queryStats.queries.push(queryInfo);

    // Keep only recent queries
    if (queryStats.queries.length > queryStats.maxQueriesStored) {
      queryStats.queries.shift();
    }

    // Log slow queries
    if (duration >= VERY_SLOW_QUERY_THRESHOLD_MS) {
      logger.warn('Very slow query detected', {
        duration: `${duration}ms`,
        method,
        sql: this.truncateSQL(sql),
        params: params.length
      });
    } else if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      logger.info('Slow query detected', {
        duration: `${duration}ms`,
        method,
        sql: this.truncateSQL(sql)
      });
    }

    // Log errors
    if (error) {
      logger.error('Query failed', {
        error: error.message,
        duration: `${duration}ms`,
        method,
        sql: this.truncateSQL(sql)
      });
    }
  }

  truncateSQL(sql) {
    const cleaned = sql.replace(/\s+/g, ' ').trim();
    return cleaned.length > MAX_QUERY_LOG_LENGTH
      ? cleaned.substring(0, MAX_QUERY_LOG_LENGTH) + '...'
      : cleaned;
  }

  getRowCount(result) {
    if (!result) return 0;
    if (Array.isArray(result)) return result.length;
    if (result.changes !== undefined) return result.changes;
    return 1;
  }

  getStats() {
    return {
      ...queryStats,
      avgDuration: Math.round(queryStats.avgDuration * 100) / 100,
      slowQueryPercentage: queryStats.total > 0
        ? Math.round((queryStats.slow / queryStats.total) * 10000) / 100
        : 0,
      verySlowQueryPercentage: queryStats.total > 0
        ? Math.round((queryStats.verySlow / queryStats.total) * 10000) / 100
        : 0
    };
  }

  getRecentSlowQueries(limit = 10) {
    return queryStats.queries
      .filter(q => q.duration >= SLOW_QUERY_THRESHOLD_MS)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  resetStats() {
    queryStats.total = 0;
    queryStats.slow = 0;
    queryStats.verySlow = 0;
    queryStats.avgDuration = 0;
    queryStats.maxDuration = 0;
    queryStats.minDuration = Infinity;
    queryStats.queries = [];
  }
}

/**
 * Express middleware to expose query stats
 */
function queryStatsMiddleware(monitor) {
  return (req, res, next) => {
    req.queryStats = monitor.getStats();
    req.slowQueries = monitor.getRecentSlowQueries();
    next();
  };
}

/**
 * Query stats endpoint handler
 */
function getQueryStatsHandler(monitor) {
  return (req, res) => {
    const stats = monitor.getStats();
    const slowQueries = monitor.getRecentSlowQueries(20);

    res.json({
      statistics: {
        total_queries: stats.total,
        slow_queries: stats.slow,
        very_slow_queries: stats.verySlow,
        avg_duration_ms: stats.avgDuration,
        max_duration_ms: stats.maxDuration,
        min_duration_ms: stats.minDuration === Infinity ? 0 : stats.minDuration,
        slow_query_percentage: stats.slowQueryPercentage,
        very_slow_query_percentage: stats.verySlowQueryPercentage
      },
      thresholds: {
        slow_query_ms: SLOW_QUERY_THRESHOLD_MS,
        very_slow_query_ms: VERY_SLOW_QUERY_THRESHOLD_MS
      },
      recent_slow_queries: slowQueries,
      recommendations: getRecommendations(stats, slowQueries)
    });
  };
}

/**
 * Generate optimization recommendations
 */
function getRecommendations(stats, slowQueries) {
  const recommendations = [];

  if (stats.verySlowQueryPercentage > 5) {
    recommendations.push({
      severity: 'high',
      message: `${stats.verySlowQueryPercentage}% of queries are very slow (>${VERY_SLOW_QUERY_THRESHOLD_MS}ms)`,
      action: 'Review slow queries and add missing indexes'
    });
  }

  if (stats.slowQueryPercentage > 20) {
    recommendations.push({
      severity: 'medium',
      message: `${stats.slowQueryPercentage}% of queries are slow (>${SLOW_QUERY_THRESHOLD_MS}ms)`,
      action: 'Consider query optimization and index tuning'
    });
  }

  if (stats.avgDuration > 50) {
    recommendations.push({
      severity: 'medium',
      message: `Average query duration is ${stats.avgDuration}ms`,
      action: 'Consider connection pooling and query caching'
    });
  }

  // Analyze slow query patterns
  const tableUsage = {};
  slowQueries.forEach(q => {
    const tables = q.sql.match(/FROM\s+(\w+)/gi) || [];
    tables.forEach(t => {
      const tableName = t.replace(/FROM\s+/i, '');
      tableUsage[tableName] = (tableUsage[tableName] || 0) + 1;
    });
  });

  const topSlowTable = Object.entries(tableUsage)
    .sort((a, b) => b[1] - a[1])[0];

  if (topSlowTable && topSlowTable[1] >= 3) {
    recommendations.push({
      severity: 'high',
      message: `Table '${topSlowTable[0]}' appears in ${topSlowTable[1]} slow queries`,
      action: `Add indexes to ${topSlowTable[0]} table on frequently queried columns`
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'info',
      message: 'Query performance is healthy',
      action: 'Continue monitoring for changes'
    });
  }

  return recommendations;
}

module.exports = {
  QueryMonitor,
  queryStatsMiddleware,
  getQueryStatsHandler,
  SLOW_QUERY_THRESHOLD_MS,
  VERY_SLOW_QUERY_THRESHOLD_MS
};

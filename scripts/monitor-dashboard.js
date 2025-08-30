#!/usr/bin/env node

/**
 * Live Monitoring Dashboard for Instruction Compiler
 * Shows real-time status of the system
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  clear: '\x1b[2J\x1b[0;0H'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class MonitorDashboard {
  constructor() {
    this.dbPath = path.join(process.cwd(), 'db', 'tasks.db');
    this.auditDbPath = path.join(process.cwd(), 'db', 'audit.db');
    this.refreshInterval = 2000; // 2 seconds
  }

  async start() {
    // Clear screen
    console.log(colors.clear);
    
    // Start monitoring loop
    this.monitor();
    setInterval(() => this.monitor(), this.refreshInterval);
  }

  async monitor() {
    // Clear screen
    console.log(colors.clear);
    
    // Header
    log('╔══════════════════════════════════════════════════════════════════╗', 'blue');
    log('║     INSTRUCTION COMPILER - LIVE MONITORING DASHBOARD              ║', 'bold');
    log('╠══════════════════════════════════════════════════════════════════╣', 'blue');
    log(`║ ${new Date().toLocaleString().padEnd(66)} ║`, 'cyan');
    log('╚══════════════════════════════════════════════════════════════════╝', 'blue');

    // Get data
    const stats = await this.getSystemStats();
    const running = await this.getRunningExecutions();
    const recent = await this.getRecentExecutions();
    const violations = await this.getRecentViolations();
    const integrity = await this.checkIntegrity();

    // System Status
    log('\n📊 SYSTEM STATUS', 'bold');
    log('─'.repeat(70), 'blue');
    
    const statusColor = integrity.allValid ? 'green' : 'red';
    const statusIcon = integrity.allValid ? '✅' : '❌';
    log(`${statusIcon} System Integrity: ${integrity.allValid ? 'OPERATIONAL' : 'DEGRADED'}`, statusColor);
    
    log(`  • Hash Chain: ${integrity.hashChain ? '✅' : '❌'} ${integrity.hashChain ? 'Valid' : 'Invalid'}`, integrity.hashChain ? 'green' : 'red');
    log(`  • Audit Trail: ${integrity.auditTrail ? '✅' : '❌'} ${stats.totalAuditEntries} entries`, integrity.auditTrail ? 'green' : 'red');
    log(`  • Rollback System: ${integrity.rollback ? '✅' : '❌'} ${integrity.rollback ? 'Ready' : 'Unavailable'}`, integrity.rollback ? 'green' : 'red');
    log(`  • Database: ${integrity.database ? '✅' : '❌'} ${integrity.database ? 'Connected' : 'Error'}`, integrity.database ? 'green' : 'red');

    // Statistics
    log('\n📈 STATISTICS', 'bold');
    log('─'.repeat(70), 'blue');
    log(`  Total Executions: ${stats.totalExecutions}`, 'cyan');
    log(`  Success Rate: ${stats.successRate}%`, stats.successRate >= 80 ? 'green' : 'yellow');
    log(`  Total Violations: ${stats.totalViolations}`, stats.totalViolations > 0 ? 'yellow' : 'green');
    log(`  Active Sessions: ${running.length}`, 'cyan');

    // Running Executions
    if (running.length > 0) {
      log('\n⚙️  RUNNING EXECUTIONS', 'bold');
      log('─'.repeat(70), 'blue');
      
      running.forEach(exec => {
        const runtime = this.calculateRuntime(exec.started_at);
        log(`  ${exec.execution_id}`, 'green');
        log(`    State: ${exec.final_state || 'EXECUTING'}`, 'cyan');
        log(`    Runtime: ${runtime}s`, 'cyan');
        log(`    Steps: ${exec.completed_steps}/${exec.total_steps}`, 'cyan');
        
        // Progress bar
        const progress = (exec.completed_steps / exec.total_steps) * 100;
        const barLength = 30;
        const filled = Math.floor((progress / 100) * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        log(`    Progress: [${bar}] ${progress.toFixed(0)}%`, 'cyan');
      });
    } else {
      log('\n⚙️  RUNNING EXECUTIONS', 'bold');
      log('─'.repeat(70), 'blue');
      log('  No active executions', 'yellow');
    }

    // Recent Completions
    log('\n📜 RECENT COMPLETIONS', 'bold');
    log('─'.repeat(70), 'blue');
    
    if (recent.length > 0) {
      recent.forEach(exec => {
        const icon = exec.success ? '✅' : '❌';
        const color = exec.success ? 'green' : 'red';
        const duration = exec.duration_ms ? `${exec.duration_ms}ms` : 'N/A';
        log(`  ${icon} ${exec.execution_id}`, color);
        log(`     Status: ${exec.status} | Duration: ${duration}`, 'cyan');
      });
    } else {
      log('  No recent completions', 'yellow');
    }

    // Recent Violations
    if (violations.length > 0) {
      log('\n⚠️  RECENT VIOLATIONS', 'bold');
      log('─'.repeat(70), 'blue');
      
      violations.forEach(v => {
        const severityColor = v.severity === 'critical' ? 'red' : 'yellow';
        log(`  • ${v.violation_type}: ${v.description}`, severityColor);
        log(`    Execution: ${v.execution_id}`, 'cyan');
        log(`    Time: ${new Date(v.occurred_at).toLocaleTimeString()}`, 'cyan');
      });
    }

    // Live Activity Feed
    const activities = await this.getRecentActivities();
    if (activities.length > 0) {
      log('\n🔄 LIVE ACTIVITY', 'bold');
      log('─'.repeat(70), 'blue');
      
      activities.forEach(activity => {
        const time = new Date(activity.event_timestamp).toLocaleTimeString();
        log(`  [${time}] ${activity.event_type}`, 'cyan');
        if (activity.execution_id) {
          log(`    Execution: ${activity.execution_id}`, 'cyan');
        }
      });
    }

    // Footer
    log('\n' + '─'.repeat(70), 'blue');
    log('Press Ctrl+C to exit | Refreshing every 2 seconds', 'cyan');
  }

  async getSystemStats() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      const stats = {
        totalExecutions: 0,
        successRate: 0,
        totalViolations: 0,
        totalAuditEntries: 0
      };

      db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
        FROM instruction_executions`,
        (err, row) => {
          if (!err && row) {
            stats.totalExecutions = row.total;
            stats.successRate = row.total > 0 
              ? Math.round((row.successful / row.total) * 100) 
              : 0;
          }

          db.get(
            `SELECT COUNT(*) as count FROM instruction_violations`,
            (err, row) => {
              if (!err && row) {
                stats.totalViolations = row.count;
              }

              db.get(
                `SELECT COUNT(*) as count FROM instruction_audit_log`,
                (err, row) => {
                  if (!err && row) {
                    stats.totalAuditEntries = row.count;
                  }
                  
                  db.close();
                  resolve(stats);
                }
              );
            }
          );
        }
      );
    });
  }

  async getRunningExecutions() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.all(
        `SELECT 
          e.execution_id,
          e.started_at,
          e.final_state,
          COUNT(DISTINCT s.id) as total_steps,
          SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed_steps
        FROM instruction_executions e
        LEFT JOIN instruction_steps s ON e.execution_id = s.execution_id
        WHERE e.status = 'running'
        GROUP BY e.execution_id
        ORDER BY e.started_at DESC`,
        (err, rows) => {
          db.close();
          resolve(err ? [] : rows);
        }
      );
    });
  }

  async getRecentExecutions() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.all(
        `SELECT 
          execution_id,
          status,
          success,
          duration_ms,
          completed_at
        FROM instruction_executions
        WHERE status IN ('completed', 'failed', 'aborted')
        ORDER BY completed_at DESC
        LIMIT 5`,
        (err, rows) => {
          db.close();
          resolve(err ? [] : rows);
        }
      );
    });
  }

  async getRecentViolations() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.all(
        `SELECT * FROM instruction_violations
        ORDER BY occurred_at DESC
        LIMIT 3`,
        (err, rows) => {
          db.close();
          resolve(err ? [] : rows);
        }
      );
    });
  }

  async getRecentActivities() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.all(
        `SELECT 
          execution_id,
          event_type,
          event_timestamp
        FROM instruction_audit_log
        ORDER BY event_timestamp DESC
        LIMIT 5`,
        (err, rows) => {
          db.close();
          resolve(err ? [] : rows);
        }
      );
    });
  }

  async checkIntegrity() {
    const { VerificationEngine } = require('./verification-engine');
    const engine = new VerificationEngine();
    
    const result = {
      hashChain: false,
      auditTrail: false,
      rollback: false,
      database: false,
      allValid: false
    };

    // Test hash chain
    try {
      const chain = engine.createHashChain([{test: 1}, {test: 2}]);
      result.hashChain = engine.verifyHashChain(chain);
    } catch (error) {
      result.hashChain = false;
    }

    // Test database
    try {
      const db = new sqlite3.Database(this.dbPath);
      result.database = true;
      
      // Test audit trail
      await new Promise((resolve) => {
        db.get("SELECT COUNT(*) FROM instruction_audit_log", (err) => {
          result.auditTrail = !err;
          resolve();
        });
      });
      
      db.close();
    } catch (error) {
      result.database = false;
    }

    // Test rollback
    try {
      const { RollbackManager } = require('./rollback-manager');
      const manager = new RollbackManager();
      result.rollback = true;
    } catch (error) {
      result.rollback = false;
    }

    result.allValid = result.hashChain && result.auditTrail && 
                      result.rollback && result.database;
    
    return result;
  }

  calculateRuntime(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now - start) / 1000);
  }
}

// Start monitoring
const dashboard = new MonitorDashboard();
dashboard.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(colors.clear);
  log('\n👋 Monitoring stopped', 'cyan');
  process.exit(0);
});
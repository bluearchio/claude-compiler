#!/usr/bin/env node

/**
 * Complete Task Tracking System
 * 
 * TRACKS EVERYTHING: Sessions → Decisions → Tasks → Agents → Results → Learning
 * This is the COMPLETE VISIBILITY system for all Claude Code operations
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

class TaskTracker {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'db', 'tasks.db');
    this.initializeTables();
  }

  /**
   * Initialize all tracking tables
   */
  async initializeTables() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.exec(`
        -- Agent Performance Tracking
        CREATE TABLE IF NOT EXISTS agent_performance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          primary_agent TEXT NOT NULL,
          secondary_agents TEXT, -- JSON array
          success BOOLEAN NOT NULL,
          execution_time_ms INTEGER,
          quality_score REAL DEFAULT 0.0,
          timestamp TEXT NOT NULL
        );

        -- Decision History
        CREATE TABLE IF NOT EXISTS decision_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL UNIQUE,
          prompt TEXT NOT NULL,
          decision_data TEXT NOT NULL, -- JSON
          timestamp TEXT NOT NULL
        );

        -- Session Tracking (Enhanced)
        CREATE TABLE IF NOT EXISTS session_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL UNIQUE,
          status TEXT CHECK(status IN ('active', 'completed', 'failed', 'aborted')),
          started_at TEXT NOT NULL,
          completed_at TEXT,
          agent_chain TEXT, -- JSON array
          current_phase INTEGER DEFAULT 1,
          total_phases INTEGER DEFAULT 1,
          current_agent TEXT,
          progress_percentage REAL DEFAULT 0.0,
          user_prompt TEXT,
          final_result TEXT -- JSON
        );

        -- Real-time Task Status
        CREATE TABLE IF NOT EXISTS task_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          phase INTEGER NOT NULL,
          agent TEXT NOT NULL,
          status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
          started_at TEXT,
          completed_at TEXT,
          result TEXT, -- JSON
          error_message TEXT,
          UNIQUE(session_id, task_id)
        );

        -- Agent Learning Data
        CREATE TABLE IF NOT EXISTS agent_learning (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          prompt_pattern TEXT NOT NULL,
          success_rate REAL NOT NULL,
          avg_execution_time REAL,
          common_failures TEXT, -- JSON array
          improvement_suggestions TEXT, -- JSON array
          last_updated TEXT NOT NULL
        );

        -- Complete Visibility Log
        CREATE TABLE IF NOT EXISTS visibility_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_data TEXT NOT NULL, -- JSON
          agent TEXT,
          phase INTEGER,
          criticality TEXT CHECK(criticality IN ('low', 'medium', 'high', 'critical'))
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_session_tracking_status ON session_tracking(status);
        CREATE INDEX IF NOT EXISTS idx_task_status_session ON task_status(session_id);
        CREATE INDEX IF NOT EXISTS idx_visibility_log_session ON visibility_log(session_id);
        CREATE INDEX IF NOT EXISTS idx_agent_performance_agent ON agent_performance(primary_agent);
      `, (err) => {
        if (err) {
          log(`Error initializing tables: ${err.message}`, 'red');
        }
        db.close();
        resolve();
      });
    });
  }

  /**
   * Start tracking a new session
   */
  async startSession(sessionId, userPrompt, agentChain) {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO session_tracking 
        (session_id, status, started_at, agent_chain, total_phases, user_prompt, current_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId,
        'active',
        new Date().toISOString(),
        JSON.stringify(agentChain),
        agentChain.length,
        userPrompt,
        agentChain[0] || 'unknown'
      ], (err) => {
        if (err) reject(err);
        else {
          this.logEvent(sessionId, 'SESSION_STARTED', {
            prompt: userPrompt,
            agentChain,
            totalPhases: agentChain.length
          });
          resolve();
        }
        db.close();
      });
    });
  }

  /**
   * Update session progress
   */
  async updateSessionProgress(sessionId, currentPhase, currentAgent, progress) {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.run(`
        UPDATE session_tracking 
        SET current_phase = ?, current_agent = ?, progress_percentage = ?
        WHERE session_id = ?
      `, [currentPhase, currentAgent, progress, sessionId], (err) => {
        if (!err) {
          this.logEvent(sessionId, 'PROGRESS_UPDATE', {
            phase: currentPhase,
            agent: currentAgent,
            progress: `${progress}%`
          });
        }
        db.close();
        resolve();
      });
    });
  }

  /**
   * Update session with selected agent chain
   */
  async updateSessionAgents(sessionId, agentChain) {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.run(`
        UPDATE session_tracking 
        SET agent_chain = ?, total_phases = ?, current_agent = ?
        WHERE session_id = ?
      `, [JSON.stringify(agentChain), agentChain.length, agentChain[0] || 'unknown', sessionId], (err) => {
        if (!err) {
          this.logEvent(sessionId, 'AGENTS_UPDATED', {
            agentChain,
            totalPhases: agentChain.length
          });
        }
        db.close();
        resolve();
      });
    });
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId, status, finalResult) {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.run(`
        UPDATE session_tracking 
        SET status = ?, completed_at = ?, final_result = ?, progress_percentage = 100.0
        WHERE session_id = ?
      `, [status, new Date().toISOString(), JSON.stringify(finalResult), sessionId], (err) => {
        if (!err) {
          this.logEvent(sessionId, 'SESSION_COMPLETED', {
            status,
            success: status === 'completed',
            result: finalResult
          });
        }
        db.close();
        resolve();
      });
    });
  }

  /**
   * Track task execution
   */
  async trackTask(sessionId, taskId, phase, agent, status, result = null, error = null) {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      const now = new Date().toISOString();
      const startedAt = status === 'in_progress' ? now : null;
      const completedAt = ['completed', 'failed'].includes(status) ? now : null;

      db.run(`
        INSERT OR REPLACE INTO task_status 
        (session_id, task_id, phase, agent, status, started_at, completed_at, result, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId, taskId, phase, agent, status, startedAt, completedAt,
        result ? JSON.stringify(result) : null, error
      ], (err) => {
        if (!err) {
          this.logEvent(sessionId, 'TASK_UPDATE', {
            taskId, phase, agent, status, hasError: !!error
          }, agent, phase, error ? 'high' : 'low');
        }
        db.close();
        resolve();
      });
    });
  }

  /**
   * Log any event for complete visibility
   */
  async logEvent(sessionId, eventType, eventData, agent = null, phase = null, criticality = 'medium') {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      db.run(`
        INSERT INTO visibility_log 
        (session_id, timestamp, event_type, event_data, agent, phase, criticality)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId,
        new Date().toISOString(),
        eventType,
        JSON.stringify(eventData),
        agent,
        phase,
        criticality
      ], (err) => {
        db.close();
        resolve();
      });
    });
  }

  /**
   * Get complete session overview
   */
  async getSessionOverview(sessionId) {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      // Get session info
      db.get(`
        SELECT * FROM session_tracking WHERE session_id = ?
      `, [sessionId], (err, session) => {
        if (err || !session) {
          db.close();
          resolve(null);
          return;
        }

        // Get all tasks for this session
        db.all(`
          SELECT * FROM task_status WHERE session_id = ? ORDER BY phase, id
        `, [sessionId], (err, tasks) => {
          // Get all events for this session
          db.all(`
            SELECT * FROM visibility_log WHERE session_id = ? ORDER BY timestamp DESC
          `, [sessionId], (err, events) => {
            db.close();
            resolve({
              session: {
                ...session,
                agent_chain: JSON.parse(session.agent_chain || '[]'),
                final_result: session.final_result ? JSON.parse(session.final_result) : null
              },
              tasks: tasks || [],
              events: events.map(event => ({
                ...event,
                event_data: JSON.parse(event.event_data)
              }))
            });
          });
        });
      });
    });
  }

  /**
   * Get current system status
   */
  async getSystemStatus() {
    const db = new sqlite3.Database(this.dbPath);
    
    return new Promise((resolve) => {
      // Get active sessions
      db.all(`
        SELECT s.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
               SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks
        FROM session_tracking s
        LEFT JOIN task_status t ON s.session_id = t.session_id
        WHERE s.status = 'active'
        GROUP BY s.session_id
      `, (err, activeSessions) => {
        
        // Get recent completions
        db.all(`
          SELECT * FROM session_tracking 
          WHERE status IN ('completed', 'failed', 'aborted')
          ORDER BY completed_at DESC LIMIT 10
        `, (err, recentSessions) => {
          
          // Get agent performance summary
          db.all(`
            SELECT primary_agent, 
                   COUNT(*) as total_uses,
                   AVG(CASE WHEN success THEN 100.0 ELSE 0.0 END) as success_rate,
                   AVG(execution_time_ms) as avg_time
            FROM agent_performance 
            GROUP BY primary_agent
            ORDER BY success_rate DESC
          `, (err, agentStats) => {
            
            db.close();
            resolve({
              activeSessions: activeSessions || [],
              recentSessions: recentSessions || [],
              agentStats: agentStats || [],
              timestamp: new Date().toISOString()
            });
          });
        });
      });
    });
  }

  /**
   * Generate complete flow visualization
   */
  async generateFlowVisualization(sessionId) {
    const overview = await this.getSessionOverview(sessionId);
    if (!overview) return null;

    const { session, tasks, events } = overview;
    
    console.log(colors.clear);
    log('╔════════════════════════════════════════════════════════════════════╗', 'blue');
    log('║                    CLAUDE CODE DECISION FLOW                        ║', 'bold');
    log('╠════════════════════════════════════════════════════════════════════╣', 'blue');
    log(`║ Session: ${sessionId.padEnd(58)} ║`, 'cyan');
    log(`║ Status: ${session.status.toUpperCase().padEnd(59)} ║`, session.status === 'completed' ? 'green' : 'yellow');
    log('╚════════════════════════════════════════════════════════════════════╝', 'blue');

    // Show prompt
    log('\n💭 USER PROMPT:', 'bold');
    log(`"${session.user_prompt}"`, 'cyan');

    // Show agent chain
    log('\n🔗 AGENT CHAIN:', 'bold');
    const agentChain = session.agent_chain;
    const chainDisplay = agentChain.map((agent, i) => {
      const status = this.getAgentStatus(agent, tasks);
      const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : status === 'in_progress' ? '⏳' : '⏸️';
      return `${icon} ${agent}`;
    }).join(' → ');
    log(chainDisplay, 'cyan');

    // Show phase progress
    log('\n📊 EXECUTION PHASES:', 'bold');
    const phases = {};
    tasks.forEach(task => {
      if (!phases[task.phase]) phases[task.phase] = [];
      phases[task.phase].push(task);
    });

    Object.entries(phases).forEach(([phase, phaseTasks]) => {
      const completed = phaseTasks.filter(t => t.status === 'completed').length;
      const total = phaseTasks.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      log(`  Phase ${phase}: [${this.generateProgressBar(progress)}] ${progress}%`, 'cyan');
      phaseTasks.forEach(task => {
        const icon = this.getTaskIcon(task.status);
        log(`    ${icon} ${task.task_id} (${task.agent})`, this.getTaskColor(task.status));
      });
    });

    // Show timeline
    log('\n⏰ EXECUTION TIMELINE:', 'bold');
    const timeline = events.slice(0, 10).reverse();
    timeline.forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const criticality = event.criticality === 'high' ? '🔴' : 
                         event.criticality === 'medium' ? '🟡' : '🟢';
      log(`  ${time} ${criticality} ${event.event_type}`, 'cyan');
      if (event.agent) log(`           Agent: ${event.agent}`, 'cyan');
    });

    // Show final result
    if (session.final_result) {
      log('\n🎯 FINAL RESULT:', 'bold');
      const result = session.final_result;
      if (result.success) {
        log('✅ EXECUTION SUCCESSFUL', 'green');
        if (result.hashChain) {
          log(`   Verification Hash: ${result.hashChain[result.hashChain.length - 1]}`, 'cyan');
        }
      } else {
        log('❌ EXECUTION FAILED', 'red');
        if (result.error) {
          log(`   Error: ${result.error}`, 'red');
        }
      }
    }

    return overview;
  }

  /**
   * Real-time monitoring display
   */
  async startRealTimeMonitoring() {
    const monitor = async () => {
      console.log(colors.clear);
      
      const status = await this.getSystemStatus();
      
      log('╔══════════════════════════════════════════════════════════════════╗', 'blue');
      log('║               CLAUDE CODE REAL-TIME MONITORING                    ║', 'bold');
      log('╠══════════════════════════════════════════════════════════════════╣', 'blue');
      log(`║ ${new Date().toLocaleString().padEnd(66)} ║`, 'cyan');
      log('╚══════════════════════════════════════════════════════════════════╝', 'blue');

      // Active sessions
      log('\n🔄 ACTIVE SESSIONS:', 'bold');
      if (status.activeSessions.length === 0) {
        log('  No active sessions', 'yellow');
      } else {
        status.activeSessions.forEach(session => {
          const progress = session.total_tasks > 0 
            ? Math.round((session.completed_tasks / session.total_tasks) * 100)
            : 0;
          log(`  📍 ${session.session_id}`, 'cyan');
          log(`     Phase: ${session.current_phase}/${session.total_phases} | Agent: ${session.current_agent}`, 'cyan');
          log(`     Progress: [${this.generateProgressBar(progress)}] ${progress}%`, 'cyan');
        });
      }

      // Agent performance
      log('\n🤖 AGENT PERFORMANCE:', 'bold');
      status.agentStats.slice(0, 5).forEach(stat => {
        const rate = Math.round(stat.success_rate);
        const rateColor = rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red';
        log(`  ${stat.primary_agent}: ${rate}% success (${stat.total_uses} uses)`, rateColor);
      });

      // Recent activity
      log('\n📜 RECENT ACTIVITY:', 'bold');
      status.recentSessions.slice(0, 3).forEach(session => {
        const icon = session.status === 'completed' ? '✅' : '❌';
        const time = new Date(session.completed_at).toLocaleTimeString();
        log(`  ${icon} [${time}] ${session.session_id}`, 'cyan');
      });

      log('\n─'.repeat(70), 'blue');
      log('Press Ctrl+C to exit | Refreshing every 3 seconds', 'cyan');
    };

    // Initial display
    await monitor();
    
    // Refresh every 3 seconds
    const interval = setInterval(monitor, 3000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(colors.clear);
      log('\n👋 Monitoring stopped', 'cyan');
      process.exit(0);
    });
  }

  /**
   * Helper methods for display
   */
  getAgentStatus(agent, tasks) {
    const agentTasks = tasks.filter(t => t.agent === agent);
    if (agentTasks.length === 0) return 'pending';
    
    const completed = agentTasks.filter(t => t.status === 'completed').length;
    const failed = agentTasks.filter(t => t.status === 'failed').length;
    const inProgress = agentTasks.filter(t => t.status === 'in_progress').length;
    
    if (failed > 0) return 'failed';
    if (inProgress > 0) return 'in_progress';
    if (completed === agentTasks.length) return 'completed';
    return 'pending';
  }

  getTaskIcon(status) {
    const icons = {
      pending: '⏸️',
      in_progress: '⏳',
      completed: '✅',
      failed: '❌'
    };
    return icons[status] || '❓';
  }

  getTaskColor(status) {
    const colors = {
      pending: 'yellow',
      in_progress: 'cyan',
      completed: 'green',
      failed: 'red'
    };
    return colors[status] || 'reset';
  }

  generateProgressBar(percentage, length = 20) {
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}

// Export for use in other modules
module.exports = { TaskTracker };

// CLI interface
if (require.main === module) {
  const tracker = new TaskTracker();
  const command = process.argv[2];
  
  if (command === 'monitor') {
    log('\n🔍 Starting real-time monitoring...', 'cyan');
    tracker.startRealTimeMonitoring();
  } else if (command === 'status') {
    tracker.getSystemStatus().then(status => {
      log('\n📊 System Status:', 'bold');
      log(`Active Sessions: ${status.activeSessions.length}`, 'cyan');
      log(`Recent Completions: ${status.recentSessions.length}`, 'cyan');
      log(`Tracked Agents: ${status.agentStats.length}`, 'cyan');
    });
  } else if (command === 'session' && process.argv[3]) {
    const sessionId = process.argv[3];
    tracker.generateFlowVisualization(sessionId);
  } else {
    log('\nUsage:', 'cyan');
    log('  node task-tracker.js monitor              # Real-time monitoring', 'cyan');
    log('  node task-tracker.js status               # System status', 'cyan');
    log('  node task-tracker.js session <session-id> # Session flow', 'cyan');
  }
}
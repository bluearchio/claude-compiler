#!/usr/bin/env node

/**
 * CLAUDE CODE SESSION PUBLISHER
 * 
 * Publishes session data according to the defined format specification
 * Maintains audit trails and provides real-time session tracking
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class SessionPublisher {
  constructor() {
    this.compilerDir = path.join(process.cwd(), 'claude-compiler');
    this.sessionDataDir = path.join(this.compilerDir, 'session-data');
    this.dbPath = path.join(this.compilerDir, 'db', 'tasks.db');
    this.format = this.loadSessionFormat();
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Load session data format specification
   */
  loadSessionFormat() {
    try {
      const formatPath = path.join(this.compilerDir, 'session-data-format.json');
      return JSON.parse(fs.readFileSync(formatPath, 'utf8'));
    } catch (error) {
      log(`⚠️  Could not load session format: ${error.message}`, 'yellow');
      return this.getDefaultFormat();
    }
  }

  /**
   * Get default format if file not found
   */
  getDefaultFormat() {
    return {
      sessionDataFormat: {
        outputLocation: {
          directory: "./claude-compiler/session-data",
          filename: "{sessionId}.json"
        },
        auditLevels: {
          basic: { includeFields: ["sessionMetadata", "taskAnalysis", "agentSelection"] },
          standard: { includeFields: ["sessionMetadata", "taskAnalysis", "agentSelection", "compilerDecision"] },
          detailed: { includeFields: ["*"] }
        }
      },
      publishingOptions: {
        realTime: true,
        formats: {
          json: { enabled: true, pretty: true },
          database: { enabled: true }
        }
      }
    };
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = [
      this.sessionDataDir,
      path.join(this.sessionDataDir, 'backup'),
      path.join(this.compilerDir, 'db')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Create session data structure
   */
  createSessionData(sessionInfo) {
    const timestamp = new Date().toISOString();
    
    const sessionData = {
      sessionMetadata: {
        sessionId: sessionInfo.sessionId || `session-${Date.now()}`,
        timestamp: timestamp,
        claudeCodeVersion: sessionInfo.claudeCodeVersion || "unknown",
        workingDirectory: process.cwd()
      },
      taskAnalysis: {
        userPrompt: sessionInfo.userPrompt || "",
        classification: {
          complexity: sessionInfo.complexity || "moderate",
          wordCount: sessionInfo.wordCount || 0,
          estimatedSteps: sessionInfo.estimatedSteps || 1,
          riskLevel: sessionInfo.riskLevel || "LOW"
        },
        triggerWords: sessionInfo.triggerWords || [],
        domainClassification: sessionInfo.domain || "general"
      },
      agentSelection: {
        selectedAgent: sessionInfo.selectedAgent || "general-purpose",
        selectionReasoning: {
          domainScore: sessionInfo.domainScore || 0,
          complexityScore: sessionInfo.complexityScore || 0,
          triggerScore: sessionInfo.triggerScore || 0,
          riskScore: sessionInfo.riskScore || 0,
          totalScore: sessionInfo.totalScore || 0
        },
        agentChain: sessionInfo.agentChain || [sessionInfo.selectedAgent || "general-purpose"],
        alternativeAgents: sessionInfo.alternativeAgents || []
      },
      compilerDecision: {
        requiresCompiler: sessionInfo.requiresCompiler || false,
        reason: sessionInfo.compilerReason || "Task analysis complete",
        compilerMode: sessionInfo.compilerMode || "tracking"
      },
      executionPlan: {
        approach: sessionInfo.approach || "direct",
        estimatedDuration: sessionInfo.estimatedDuration || "unknown",
        phases: sessionInfo.phases || []
      },
      publishedAt: timestamp,
      version: "1.0.0"
    };

    return sessionData;
  }

  /**
   * Filter session data based on audit level
   */
  filterByAuditLevel(sessionData, auditLevel = 'standard') {
    const levelConfig = this.format.sessionDataFormat.auditLevels[auditLevel];
    if (!levelConfig || levelConfig.includeFields.includes('*')) {
      return sessionData;
    }

    const filtered = {};
    levelConfig.includeFields.forEach(field => {
      if (sessionData[field]) {
        filtered[field] = sessionData[field];
      }
    });

    return filtered;
  }

  /**
   * Publish session data to JSON file
   */
  async publishToJson(sessionData, auditLevel = 'standard') {
    try {
      const filteredData = this.filterByAuditLevel(sessionData, auditLevel);
      const filename = this.format.sessionDataFormat.outputLocation.filename
        .replace('{sessionId}', sessionData.sessionMetadata.sessionId);
      
      const filepath = path.join(this.sessionDataDir, filename);
      
      const jsonContent = this.format.publishingOptions.formats.json.pretty ?
        JSON.stringify(filteredData, null, 2) :
        JSON.stringify(filteredData);

      fs.writeFileSync(filepath, jsonContent, 'utf8');
      
      log(`✅ Published to JSON: ${filepath}`, 'green');
      return filepath;
    } catch (error) {
      log(`❌ Failed to publish JSON: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * Publish session data to database
   */
  async publishToDatabase(sessionData) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Ensure session_tracking table exists
      db.run(`
        CREATE TABLE IF NOT EXISTS session_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          user_prompt TEXT NOT NULL,
          selected_agent TEXT NOT NULL,
          requires_compiler BOOLEAN NOT NULL,
          complexity TEXT NOT NULL,
          domain_classification TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          trigger_words TEXT,
          agent_chain TEXT,
          total_score INTEGER DEFAULT 0,
          compiler_reason TEXT,
          started_at TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          published_at TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          log(`⚠️  Could not create table: ${err.message}`, 'yellow');
        }
      });

      // Insert session data
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO session_tracking 
        (session_id, user_prompt, selected_agent, requires_compiler, complexity, 
         domain_classification, risk_level, trigger_words, agent_chain, total_score,
         compiler_reason, started_at, status, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        sessionData.sessionMetadata.sessionId,
        sessionData.taskAnalysis.userPrompt,
        sessionData.agentSelection.selectedAgent,
        sessionData.compilerDecision.requiresCompiler ? 1 : 0,
        sessionData.taskAnalysis.classification.complexity,
        sessionData.taskAnalysis.domainClassification,
        sessionData.taskAnalysis.classification.riskLevel,
        JSON.stringify(sessionData.taskAnalysis.triggerWords),
        JSON.stringify(sessionData.agentSelection.agentChain),
        sessionData.agentSelection.selectionReasoning.totalScore,
        sessionData.compilerDecision.reason,
        sessionData.sessionMetadata.timestamp,
        'published',
        sessionData.publishedAt
      ], function(err) {
        if (err) {
          log(`❌ Failed to publish to database: ${err.message}`, 'red');
          reject(err);
        } else {
          log(`✅ Published to database: session ${sessionData.sessionMetadata.sessionId}`, 'green');
          resolve(this.lastID);
        }
        
        stmt.finalize();
        db.close();
      });
    });
  }

  /**
   * Create backup of session data
   */
  async createBackup(sessionData) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const backupDir = path.join(this.sessionDataDir, 'backup', date);
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const filename = `${sessionData.sessionMetadata.sessionId}.json`;
      const backupPath = path.join(backupDir, filename);
      
      fs.writeFileSync(backupPath, JSON.stringify(sessionData, null, 2), 'utf8');
      log(`✅ Backup created: ${backupPath}`, 'green');
      
      return backupPath;
    } catch (error) {
      log(`⚠️  Backup failed: ${error.message}`, 'yellow');
      return null;
    }
  }

  /**
   * Publish complete session data
   */
  async publishSession(sessionInfo, auditLevel = 'standard') {
    log('📊 Publishing session data...', 'cyan');
    
    try {
      // Create structured session data
      const sessionData = this.createSessionData(sessionInfo);
      
      // Results tracking
      const results = {
        sessionId: sessionData.sessionMetadata.sessionId,
        success: true,
        publishedTo: [],
        errors: []
      };

      // Publish to JSON if enabled
      if (this.format.publishingOptions.formats.json.enabled) {
        try {
          const jsonPath = await this.publishToJson(sessionData, auditLevel);
          results.publishedTo.push(`JSON: ${jsonPath}`);
        } catch (error) {
          results.errors.push(`JSON: ${error.message}`);
        }
      }

      // Publish to database if enabled
      if (this.format.publishingOptions.formats.database.enabled) {
        try {
          await this.publishToDatabase(sessionData);
          results.publishedTo.push(`Database: ${this.dbPath}`);
        } catch (error) {
          results.errors.push(`Database: ${error.message}`);
        }
      }

      // Create backup
      await this.createBackup(sessionData);

      // Log results
      if (results.errors.length > 0) {
        log(`⚠️  Publishing completed with errors:`, 'yellow');
        results.errors.forEach(error => log(`   ${error}`, 'yellow'));
        results.success = false;
      } else {
        log('✅ Session data published successfully!', 'green');
      }

      results.publishedTo.forEach(location => {
        log(`   ${location}`, 'cyan');
      });

      return results;
      
    } catch (error) {
      log(`❌ Failed to publish session: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory(limit = 10) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.all(`
        SELECT session_id, user_prompt, selected_agent, requires_compiler, 
               complexity, risk_level, started_at, status
        FROM session_tracking 
        ORDER BY started_at DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
        db.close();
      });
    });
  }

  /**
   * Display publishing statistics
   */
  async displayStats() {
    try {
      const history = await this.getSessionHistory(100);
      const totalSessions = history.length;
      const compilerSessions = history.filter(s => s.requires_compiler === 1).length;
      const complexityCounts = {};
      
      history.forEach(session => {
        complexityCounts[session.complexity] = (complexityCounts[session.complexity] || 0) + 1;
      });

      log('\n📊 SESSION PUBLISHING STATISTICS', 'bold');
      log('=' .repeat(40), 'blue');
      log(`Total Sessions: ${totalSessions}`, 'cyan');
      log(`Compiler Required: ${compilerSessions} (${Math.round(compilerSessions/totalSessions*100)}%)`, 'cyan');
      log('\nComplexity Breakdown:', 'bold');
      
      Object.entries(complexityCounts).forEach(([complexity, count]) => {
        const percentage = Math.round(count/totalSessions*100);
        log(`  ${complexity}: ${count} (${percentage}%)`, 'cyan');
      });
      
    } catch (error) {
      log(`⚠️  Could not display stats: ${error.message}`, 'yellow');
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    log('📖 Claude Code Session Publisher', 'bold');
    log('Usage:', 'cyan');
    log('  node session-publisher.js publish <sessionInfo>', 'cyan');
    log('  node session-publisher.js stats', 'cyan');
    log('  node session-publisher.js history', 'cyan');
    return;
  }

  const publisher = new SessionPublisher();
  
  try {
    switch (command) {
      case 'publish':
        // Example session data for testing
        const testSession = {
          sessionId: `test-session-${Date.now()}`,
          userPrompt: args.slice(1).join(' ') || "test task",
          complexity: 'moderate',
          selectedAgent: 'workflow-orchestrator',
          requiresCompiler: true,
          domain: 'general',
          riskLevel: 'LOW',
          triggerWords: ['workflow'],
          agentChain: ['workflow-orchestrator'],
          totalScore: 75,
          compilerReason: 'Complex task requires orchestration'
        };
        
        const result = await publisher.publishSession(testSession);
        console.log('\nPublishing Result:', JSON.stringify(result, null, 2));
        break;
        
      case 'stats':
        await publisher.displayStats();
        break;
        
      case 'history':
        const history = await publisher.getSessionHistory(10);
        log('\n📋 Recent Sessions:', 'bold');
        history.forEach(session => {
          log(`${session.session_id}: ${session.user_prompt.substring(0, 50)}... (${session.complexity})`, 'cyan');
        });
        break;
        
      default:
        log(`❌ Unknown command: ${command}`, 'red');
        process.exit(1);
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SessionPublisher };
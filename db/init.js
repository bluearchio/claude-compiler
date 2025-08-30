#!/usr/bin/env node

/**
 * Initialize Claude Compiler Database
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function initDatabase() {
  log('\n🔧 INITIALIZING CLAUDE COMPILER DATABASE', 'bold');
  log('=' .repeat(50), 'blue');

  // Ensure db directory exists
  const dbDir = path.join(__dirname);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'tasks.db');
  const auditDbPath = path.join(dbDir, 'audit.db');

  // Create main database
  log('\n📊 Creating main database...', 'cyan');
  const db = new sqlite3.Database(dbPath);
  
  // Apply migration
  const migrationPath = path.join(__dirname, 'migrations', 'add-instruction-audit.sql');
  if (fs.existsSync(migrationPath)) {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      db.exec(migration, (err) => {
        if (err) {
          log(`❌ Migration failed: ${err.message}`, 'red');
          reject(err);
        } else {
          log('✅ Migration applied successfully', 'green');
          
          // Create audit database  
          log('\n📋 Creating audit database...', 'cyan');
          const auditDb = new sqlite3.Database(auditDbPath);
          
          auditDb.exec(`
            CREATE TABLE IF NOT EXISTS instruction_audit (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              instruction_id TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              state TEXT NOT NULL,
              event TEXT NOT NULL,
              data TEXT NOT NULL,
              hash TEXT NOT NULL,
              hash_chain TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_audit_instruction ON instruction_audit(instruction_id);
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON instruction_audit(timestamp);
          `, (err) => {
            if (err) {
              log(`❌ Audit database failed: ${err.message}`, 'red');
            } else {
              log('✅ Audit database created', 'green');
            }
            
            auditDb.close();
            db.close();
            
            log('\n📈 INITIALIZATION COMPLETE', 'bold');
            log('=' .repeat(50), 'blue');
            log('\nDatabases ready:', 'cyan');
            log(`  • Main: ${dbPath}`, 'cyan');
            log(`  • Audit: ${auditDbPath}`, 'cyan');
            log('\nNext steps:', 'yellow');
            log('  • Run tests: npm test', 'yellow');
            log('  • Start CLI: npm start', 'yellow');
            log('  • Monitor: npm run monitor', 'yellow');
            
            resolve();
          });
        }
      });
    });
  } else {
    log(`❌ Migration file not found: ${migrationPath}`, 'red');
    db.close();
    process.exit(1);
  }
}

// Run initialization
initDatabase().catch(error => {
  log(`\n❌ Initialization failed: ${error.message}`, 'red');
  process.exit(1);
});
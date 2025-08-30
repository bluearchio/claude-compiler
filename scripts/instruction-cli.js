#!/usr/bin/env node

/**
 * Interactive CLI for Instruction Verification Compiler
 * Makes it easy to create, execute, and monitor instructions
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { InstructionStateMachine } = require('./instruction-compiler');
const { VerificationEngine } = require('./verification-engine');
const { RollbackManager } = require('./rollback-manager');
const sqlite3 = require('sqlite3').verbose();
const { execSync } = require('child_process');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class InstructionCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.dbPath = path.join(process.cwd(), 'db', 'tasks.db');
  }

  async start() {
    log('\n🔐 INSTRUCTION VERIFICATION COMPILER', 'bold');
    log('Interactive Command Line Interface\n', 'cyan');
    
    this.showMenu();
  }

  showMenu() {
    log('\n📋 MAIN MENU', 'blue');
    log('=' .repeat(50), 'blue');
    log('1. Create new instruction', 'cyan');
    log('2. Execute instruction file', 'cyan');
    log('3. Monitor running executions', 'cyan');
    log('4. View execution history', 'cyan');
    log('5. Check system integrity', 'cyan');
    log('6. View audit trail', 'cyan');
    log('7. Test with example', 'cyan');
    log('8. Help', 'cyan');
    log('9. Exit', 'cyan');
    log('=' .repeat(50), 'blue');

    this.rl.question('\nSelect option (1-9): ', (answer) => {
      this.handleMenuChoice(answer);
    });
  }

  async handleMenuChoice(choice) {
    switch(choice) {
      case '1':
        await this.createInstruction();
        break;
      case '2':
        await this.executeInstruction();
        break;
      case '3':
        await this.monitorExecutions();
        break;
      case '4':
        await this.viewHistory();
        break;
      case '5':
        await this.checkIntegrity();
        break;
      case '6':
        await this.viewAuditTrail();
        break;
      case '7':
        await this.runExample();
        break;
      case '8':
        this.showHelp();
        break;
      case '9':
        this.exit();
        break;
      default:
        log('Invalid option', 'red');
        this.showMenu();
    }
  }

  async createInstruction() {
    log('\n📝 CREATE NEW INSTRUCTION', 'bold');
    log('=' .repeat(50), 'blue');

    const instruction = {
      id: `instruction-${Date.now()}`,
      description: '',
      steps: [],
      constraints: [],
      resources: { files: [] }
    };

    // Get description
    instruction.description = await this.prompt('Description: ');

    // Add steps
    log('\nAdd steps (type "done" when finished):', 'cyan');
    let stepCount = 1;
    while (true) {
      const stepId = await this.prompt(`Step ${stepCount} ID (or 'done'): `);
      if (stepId.toLowerCase() === 'done') break;

      const step = {
        id: stepId,
        description: await this.prompt('  Description: '),
        action: {},
        verification: {},
        dependencies: []
      };

      // Get action type
      const actionType = await this.prompt('  Action type (command/file_write/file_read): ');
      step.action.type = actionType;

      if (actionType === 'command') {
        step.action.command = await this.prompt('  Command: ');
      } else if (actionType === 'file_write') {
        step.action.path = await this.prompt('  File path: ');
        step.action.content = await this.prompt('  Content: ');
      } else if (actionType === 'file_read') {
        step.action.path = await this.prompt('  File path: ');
      }

      // Get verification
      const verificationType = await this.prompt('  Verification type (file_exists/contains/none): ');
      if (verificationType !== 'none') {
        step.verification.type = verificationType;
        if (verificationType === 'file_exists') {
          step.verification.path = await this.prompt('  File to check: ');
        } else if (verificationType === 'contains') {
          step.verification.text = await this.prompt('  Text to find: ');
        }
      }

      // Get dependencies
      const deps = await this.prompt('  Dependencies (comma-separated step IDs, or none): ');
      if (deps && deps !== 'none') {
        step.dependencies = deps.split(',').map(d => d.trim());
      }

      instruction.steps.push(step);
      stepCount++;
    }

    // Add constraints
    log('\nAdd constraints (type "done" when finished):', 'cyan');
    while (true) {
      const constraintType = await this.prompt('Constraint type (file_exists/no_errors/done): ');
      if (constraintType === 'done') break;

      const constraint = { type: constraintType };
      if (constraintType === 'file_exists') {
        constraint.path = await this.prompt('  File path: ');
        constraint.description = await this.prompt('  Description: ');
      } else {
        constraint.description = await this.prompt('  Description: ');
      }
      instruction.constraints.push(constraint);
    }

    // Save instruction
    const filename = `${instruction.id}.json`;
    fs.writeFileSync(filename, JSON.stringify(instruction, null, 2));
    log(`\n✅ Instruction saved to ${filename}`, 'green');

    // Ask to execute
    const execute = await this.prompt('\nExecute now? (y/n): ');
    if (execute.toLowerCase() === 'y') {
      await this.executeInstructionFile(filename);
    } else {
      this.showMenu();
    }
  }

  async executeInstruction() {
    const file = await this.prompt('\nInstruction file path: ');
    await this.executeInstructionFile(file);
  }

  async executeInstructionFile(file) {
    if (!fs.existsSync(file)) {
      log(`❌ File not found: ${file}`, 'red');
      this.showMenu();
      return;
    }

    log(`\n⚙️  EXECUTING: ${file}`, 'bold');
    log('=' .repeat(50), 'blue');

    try {
      const instruction = JSON.parse(fs.readFileSync(file, 'utf8'));
      const machine = new InstructionStateMachine(instruction);
      
      // Execute with real-time feedback
      const result = await machine.execute();
      
      if (result.success) {
        log('\n✅ EXECUTION SUCCESSFUL', 'green');
        log(`Hash chain: ${result.hashChain[result.hashChain.length - 1]}`, 'cyan');
        log(`Audit entries: ${result.auditLog.length}`, 'cyan');
      }
    } catch (error) {
      if (error.message.includes('aborted')) {
        log(`\n⚠️  EXECUTION ABORTED`, 'yellow');
        log(`Reason: ${error.message}`, 'yellow');
      } else {
        log(`\n❌ ERROR: ${error.message}`, 'red');
      }
    }

    this.showMenu();
  }

  async monitorExecutions() {
    log('\n📊 MONITORING EXECUTIONS', 'bold');
    log('=' .repeat(50), 'blue');

    const db = new sqlite3.Database(this.dbPath);
    
    const query = `
      SELECT 
        execution_id,
        instruction_id,
        status,
        started_at,
        final_state
      FROM instruction_executions
      WHERE status IN ('running', 'pending')
      ORDER BY started_at DESC
    `;

    db.all(query, (err, rows) => {
      if (err) {
        log(`Error: ${err.message}`, 'red');
      } else if (rows.length === 0) {
        log('No running executions', 'yellow');
      } else {
        log(`\nFound ${rows.length} active execution(s):`, 'cyan');
        rows.forEach(row => {
          const statusColor = row.status === 'running' ? 'green' : 'yellow';
          log(`\n  ID: ${row.execution_id}`, 'cyan');
          log(`  Instruction: ${row.instruction_id}`, 'cyan');
          log(`  Status: ${row.status}`, statusColor);
          log(`  State: ${row.final_state || 'IN_PROGRESS'}`, 'cyan');
          log(`  Started: ${row.started_at}`, 'cyan');
        });
      }
      db.close();
      this.showMenu();
    });
  }

  async viewHistory() {
    log('\n📜 EXECUTION HISTORY', 'bold');
    log('=' .repeat(50), 'blue');

    const db = new sqlite3.Database(this.dbPath);
    
    const query = `
      SELECT 
        execution_id,
        instruction_id,
        status,
        success,
        started_at,
        completed_at,
        duration_ms
      FROM instruction_executions
      ORDER BY started_at DESC
      LIMIT 10
    `;

    db.all(query, (err, rows) => {
      if (err) {
        log(`Error: ${err.message}`, 'red');
      } else if (rows.length === 0) {
        log('No execution history', 'yellow');
      } else {
        log(`\nLast ${rows.length} executions:`, 'cyan');
        rows.forEach(row => {
          const statusColor = row.success ? 'green' : 'red';
          log(`\n  ${row.execution_id}`, 'bold');
          log(`    Status: ${row.status}`, statusColor);
          log(`    Duration: ${row.duration_ms || 'N/A'}ms`, 'cyan');
          log(`    Started: ${row.started_at}`, 'cyan');
        });
      }
      db.close();
      this.showMenu();
    });
  }

  async checkIntegrity() {
    log('\n🔍 CHECKING SYSTEM INTEGRITY', 'bold');
    log('=' .repeat(50), 'blue');

    const engine = new VerificationEngine();
    
    // Test hash chain
    log('\nTesting hash chain...', 'cyan');
    const ops = [
      { action: 'test1' },
      { action: 'test2' },
      { action: 'test3' }
    ];
    
    const chain = engine.createHashChain(ops);
    const valid = engine.verifyHashChain(chain);
    
    if (valid) {
      log('✅ Hash chain integrity: VALID', 'green');
    } else {
      log('❌ Hash chain integrity: INVALID', 'red');
    }

    // Check database
    log('\nChecking database...', 'cyan');
    const db = new sqlite3.Database(this.dbPath);
    
    db.get("SELECT COUNT(*) as count FROM instruction_audit_log", (err, row) => {
      if (err) {
        log('❌ Database check: FAILED', 'red');
      } else {
        log(`✅ Database check: OK (${row.count} audit entries)`, 'green');
      }
      db.close();
      
      // Check rollback manager
      log('\nChecking rollback system...', 'cyan');
      const manager = new RollbackManager();
      const testFile = '.integrity-test.tmp';
      fs.writeFileSync(testFile, 'test');
      
      manager.createSnapshot('test', { files: [testFile] }).then(snapshot => {
        fs.unlinkSync(testFile);
        log('✅ Rollback system: OPERATIONAL', 'green');
        log(`   Snapshot created: ${snapshot.hash}`, 'cyan');
        
        this.showMenu();
      });
    });
  }

  async viewAuditTrail() {
    const executionId = await this.prompt('\nExecution ID (or "latest"): ');
    
    const db = new sqlite3.Database(this.dbPath);
    
    let query;
    if (executionId === 'latest') {
      query = `
        SELECT * FROM instruction_audit_log 
        WHERE execution_id = (
          SELECT execution_id FROM instruction_executions 
          ORDER BY started_at DESC LIMIT 1
        )
        ORDER BY event_timestamp DESC
        LIMIT 20
      `;
    } else {
      query = `
        SELECT * FROM instruction_audit_log 
        WHERE execution_id = '${executionId}'
        ORDER BY event_timestamp DESC
        LIMIT 20
      `;
    }

    db.all(query, (err, rows) => {
      if (err) {
        log(`Error: ${err.message}`, 'red');
      } else if (rows.length === 0) {
        log('No audit entries found', 'yellow');
      } else {
        log(`\n📋 AUDIT TRAIL (${rows.length} entries)`, 'bold');
        log('=' .repeat(50), 'blue');
        rows.forEach(row => {
          log(`\n  ${row.event_timestamp}`, 'cyan');
          log(`    Event: ${row.event_type}`, 'cyan');
          log(`    Hash: ${row.event_hash.substring(0, 16)}...`, 'cyan');
        });
      }
      db.close();
      this.showMenu();
    });
  }

  async runExample() {
    log('\n🧪 RUNNING EXAMPLE', 'bold');
    log('=' .repeat(50), 'blue');

    const example = {
      id: 'example-test',
      description: 'Example to demonstrate the system',
      steps: [
        {
          id: 'create-file',
          description: 'Create a test file',
          action: {
            type: 'file_write',
            path: 'example-test.txt',
            content: 'This is a test file created by the instruction compiler'
          },
          verification: {
            type: 'file_exists',
            path: 'example-test.txt'
          },
          dependencies: []
        },
        {
          id: 'verify-content',
          description: 'Verify file content',
          action: {
            type: 'file_read',
            path: 'example-test.txt'
          },
          verification: {
            type: 'contains',
            text: 'test file'
          },
          dependencies: ['create-file']
        },
        {
          id: 'cleanup',
          description: 'Remove test file',
          action: {
            type: 'command',
            command: 'rm example-test.txt'
          },
          verification: {
            type: 'file_exists',
            path: 'example-test.txt'
          },
          dependencies: ['verify-content']
        }
      ],
      constraints: [
        {
          type: 'no_errors',
          description: 'No errors allowed'
        }
      ],
      resources: {
        files: ['example-test.txt']
      }
    };

    log('\nExecuting example instruction...', 'cyan');
    log('This will:', 'cyan');
    log('  1. Create a test file', 'cyan');
    log('  2. Verify its content', 'cyan');
    log('  3. Clean up the file', 'cyan');

    const machine = new InstructionStateMachine(example);
    
    try {
      const result = await machine.execute();
      log('\n✅ Example completed successfully!', 'green');
      log('Check the audit trail to see the complete execution log', 'cyan');
    } catch (error) {
      log(`\n⚠️  Example execution: ${error.message}`, 'yellow');
    }

    this.showMenu();
  }

  showHelp() {
    log('\n📚 HELP', 'bold');
    log('=' .repeat(50), 'blue');
    
    log('\nWhat is this system?', 'cyan');
    log('A deterministic instruction execution system with:', 'reset');
    log('  • Immutable state transitions', 'reset');
    log('  • Cryptographic verification', 'reset');
    log('  • Automatic rollback on failure', 'reset');
    log('  • Complete audit trail', 'reset');
    
    log('\nHow it works:', 'cyan');
    log('1. Define instructions in JSON format', 'reset');
    log('2. System validates and creates execution plan', 'reset');
    log('3. Each step is executed and verified', 'reset');
    log('4. Any failure triggers immediate abort', 'reset');
    log('5. All actions are logged with hash chains', 'reset');
    
    log('\nKey features:', 'cyan');
    log('  • Cannot skip steps (enforced by state machine)', 'reset');
    log('  • Cannot tamper with logs (cryptographic hashes)', 'reset');
    log('  • Cannot ignore errors (immediate abort)', 'reset');
    log('  • Can recover from failures (rollback system)', 'reset');
    
    log('\nUseful commands:', 'cyan');
    log('  Create: Design new instructions interactively', 'reset');
    log('  Execute: Run instruction files', 'reset');
    log('  Monitor: Watch running executions', 'reset');
    log('  History: Review past executions', 'reset');
    log('  Integrity: Verify system is working', 'reset');
    
    this.showMenu();
  }

  async prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  exit() {
    log('\n👋 Goodbye!', 'cyan');
    this.rl.close();
    process.exit(0);
  }
}

// Run CLI
const cli = new InstructionCLI();
cli.start();
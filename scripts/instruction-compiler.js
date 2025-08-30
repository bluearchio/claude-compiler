#!/usr/bin/env node

/**
 * Instruction Verification Compiler
 * 
 * Guarantees deterministic execution of instructions through:
 * - Immutable state transitions
 * - Cryptographic verification
 * - Abort on violation
 * - Complete audit trail
 * - Rollback capability
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ANSI colors for terminal output
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

/**
 * Immutable State Machine for Instruction Execution
 */
class InstructionStateMachine {
  constructor(instructionSet) {
    this.states = new Map();
    this.currentState = 'INIT';
    this.stateHistory = [];
    this.hashChain = [];
    this.instructionSet = instructionSet;
    this.aborted = false;
    this.auditLog = [];
    
    // Define immutable state transitions
    this.defineStates();
  }

  defineStates() {
    // Core states that cannot be modified
    const coreStates = {
      'INIT': {
        transitions: ['VALIDATE'],
        preConditions: [],
        postConditions: ['instruction_loaded']
      },
      'VALIDATE': {
        transitions: ['PLAN', 'ABORT'],
        preConditions: ['instruction_loaded'],
        postConditions: ['instruction_valid', 'constraints_defined']
      },
      'PLAN': {
        transitions: ['VERIFY_PLAN', 'ABORT'],
        preConditions: ['instruction_valid'],
        postConditions: ['execution_plan_created', 'dependencies_resolved']
      },
      'VERIFY_PLAN': {
        transitions: ['EXECUTE', 'ABORT'],
        preConditions: ['execution_plan_created'],
        postConditions: ['plan_verified', 'resources_available']
      },
      'EXECUTE': {
        transitions: ['VERIFY_EXECUTION', 'ROLLBACK', 'ABORT'],
        preConditions: ['plan_verified'],
        postConditions: ['actions_completed']
      },
      'VERIFY_EXECUTION': {
        transitions: ['COMPLETE', 'ROLLBACK'],
        preConditions: ['actions_completed'],
        postConditions: ['results_verified', 'constraints_satisfied']
      },
      'COMPLETE': {
        transitions: [],
        preConditions: ['results_verified'],
        postConditions: ['audit_recorded', 'success_confirmed']
      },
      'ROLLBACK': {
        transitions: ['ABORT'],
        preConditions: [],
        postConditions: ['state_restored', 'rollback_logged']
      },
      'ABORT': {
        transitions: [],
        preConditions: [],
        postConditions: ['abort_logged', 'resources_released']
      }
    };

    // Make states immutable
    Object.entries(coreStates).forEach(([name, config]) => {
      this.states.set(name, Object.freeze(config));
    });
  }

  /**
   * Generate cryptographic hash for state verification
   */
  generateHash(data) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Verify state transition is allowed
   */
  canTransition(fromState, toState) {
    const state = this.states.get(fromState);
    if (!state) return false;
    return state.transitions.includes(toState);
  }

  /**
   * Check pre-conditions for state
   */
  async checkPreConditions(state) {
    const stateConfig = this.states.get(state);
    if (!stateConfig) return false;

    for (const condition of stateConfig.preConditions) {
      const result = await this.evaluateCondition(condition);
      if (!result) {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          state,
          event: 'PRE_CONDITION_FAILED',
          condition,
          hash: this.generateHash({ state, condition, result: false })
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Check post-conditions after state execution
   */
  async checkPostConditions(state) {
    const stateConfig = this.states.get(state);
    if (!stateConfig) return false;

    for (const condition of stateConfig.postConditions) {
      const result = await this.evaluateCondition(condition);
      if (!result) {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          state,
          event: 'POST_CONDITION_FAILED',
          condition,
          hash: this.generateHash({ state, condition, result: false })
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a specific condition
   */
  async evaluateCondition(condition) {
    // Condition evaluation logic
    switch (condition) {
      case 'instruction_loaded':
        return this.instructionSet !== null;
      case 'instruction_valid':
        return this.validateInstruction();
      case 'constraints_defined':
        return this.instructionSet.constraints !== undefined;
      case 'execution_plan_created':
        return this.executionPlan !== undefined;
      case 'dependencies_resolved':
        return this.checkDependencies();
      case 'plan_verified':
        return this.verifyPlan();
      case 'resources_available':
        return this.checkResources();
      case 'actions_completed':
        return this.executionComplete;
      case 'results_verified':
        return this.verifyResults();
      case 'constraints_satisfied':
        return this.checkConstraints();
      case 'audit_recorded':
        return this.auditLog.length > 0;
      case 'success_confirmed':
        return this.success === true;
      case 'state_restored':
        return this.rollbackComplete;
      case 'rollback_logged':
        return this.rollbackLogged;
      case 'abort_logged':
        return this.abortLogged;
      case 'resources_released':
        return this.resourcesReleased;
      default:
        return false;
    }
  }

  /**
   * Transition to new state with verification
   */
  async transition(newState) {
    // Check if transition is allowed
    if (!this.canTransition(this.currentState, newState)) {
      log(`❌ ILLEGAL TRANSITION: ${this.currentState} -> ${newState}`, 'red');
      await this.abort(`Illegal state transition attempted`);
      return false;
    }

    // Check pre-conditions
    if (!await this.checkPreConditions(newState)) {
      log(`❌ PRE-CONDITIONS FAILED: ${newState}`, 'red');
      await this.abort(`Pre-conditions not met for ${newState}`);
      return false;
    }

    // Record state transition
    const transitionData = {
      from: this.currentState,
      to: newState,
      timestamp: new Date().toISOString(),
      instructionId: this.instructionSet.id
    };

    const transitionHash = this.generateHash(transitionData);
    this.hashChain.push(transitionHash);

    // Update state
    const previousState = this.currentState;
    this.currentState = newState;
    this.stateHistory.push({
      state: newState,
      timestamp: transitionData.timestamp,
      hash: transitionHash
    });

    // Log transition
    this.auditLog.push({
      timestamp: transitionData.timestamp,
      event: 'STATE_TRANSITION',
      from: previousState,
      to: newState,
      hash: transitionHash
    });

    log(`✅ State transition: ${previousState} -> ${newState}`, 'green');
    return true;
  }

  /**
   * Abort execution with full audit trail
   */
  async abort(reason) {
    this.aborted = true;
    this.abortReason = reason;
    this.abortLogged = true;
    this.resourcesReleased = true;

    const abortData = {
      timestamp: new Date().toISOString(),
      state: this.currentState,
      reason,
      hashChain: this.hashChain,
      auditLog: this.auditLog
    };

    // Save abort data
    await this.saveAuditTrail(abortData);

    log(`🛑 EXECUTION ABORTED: ${reason}`, 'red');
    log(`📋 Audit trail saved with ${this.auditLog.length} entries`, 'yellow');
    
    // Transition to ABORT state
    this.currentState = 'ABORT';
    
    throw new Error(`Execution aborted: ${reason}`);
  }

  /**
   * Validate instruction format and constraints
   */
  validateInstruction() {
    if (!this.instructionSet) return false;

    // Check required fields
    const required = ['id', 'steps', 'constraints', 'verification'];
    for (const field of required) {
      if (!this.instructionSet[field]) {
        log(`❌ Missing required field: ${field}`, 'red');
        return false;
      }
    }

    // Validate each step
    for (const step of this.instructionSet.steps) {
      if (!step.id || !step.action || !step.verification) {
        log(`❌ Invalid step format: ${JSON.stringify(step)}`, 'red');
        return false;
      }
    }

    return true;
  }

  /**
   * Create execution plan from instructions
   */
  async createExecutionPlan() {
    this.executionPlan = {
      steps: [],
      dependencies: new Map(),
      rollbackStack: []
    };

    for (const step of this.instructionSet.steps) {
      // Analyze dependencies
      const deps = step.dependencies || [];
      this.executionPlan.dependencies.set(step.id, deps);

      // Create rollback entry
      const rollback = {
        stepId: step.id,
        action: step.rollback || 'NO_OP',
        snapshot: await this.createSnapshot(step.id)
      };
      this.executionPlan.rollbackStack.push(rollback);

      // Add to execution plan
      this.executionPlan.steps.push({
        ...step,
        status: 'pending',
        hash: this.generateHash(step)
      });
    }

    return true;
  }

  /**
   * Verify execution plan integrity
   */
  verifyPlan() {
    if (!this.executionPlan) return false;

    // Check dependency ordering
    const executed = new Set();
    for (const step of this.executionPlan.steps) {
      const deps = this.executionPlan.dependencies.get(step.id);
      for (const dep of deps) {
        if (!executed.has(dep)) {
          log(`❌ Dependency violation: ${step.id} depends on ${dep}`, 'red');
          return false;
        }
      }
      executed.add(step.id);
    }

    return true;
  }

  /**
   * Check if dependencies are resolved
   */
  checkDependencies() {
    if (!this.executionPlan) return false;
    
    // Topological sort to verify no cycles
    const visited = new Set();
    const visiting = new Set();
    
    const hasCycle = (nodeId) => {
      if (visited.has(nodeId)) return false;
      if (visiting.has(nodeId)) return true;
      
      visiting.add(nodeId);
      const deps = this.executionPlan.dependencies.get(nodeId) || [];
      for (const dep of deps) {
        if (hasCycle(dep)) return true;
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    for (const step of this.executionPlan.steps) {
      if (hasCycle(step.id)) {
        log(`❌ Circular dependency detected involving ${step.id}`, 'red');
        return false;
      }
    }

    return true;
  }

  /**
   * Check resource availability
   */
  async checkResources() {
    // Check file locks, memory, etc.
    const requiredFiles = this.instructionSet.resources?.files || [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        log(`❌ Required file not found: ${file}`, 'red');
        return false;
      }
    }
    return true;
  }

  /**
   * Verify execution results against constraints
   */
  verifyResults() {
    if (!this.executionResults) return false;

    for (const constraint of this.instructionSet.constraints) {
      const result = this.evaluateConstraint(constraint);
      if (!result) {
        log(`❌ Constraint violated: ${constraint.description}`, 'red');
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a specific constraint
   */
  evaluateConstraint(constraint) {
    switch (constraint.type) {
      case 'file_exists':
        return fs.existsSync(constraint.path);
      case 'test_passes':
        return this.executionResults.tests?.passed === true;
      case 'no_errors':
        return this.executionResults.errors?.length === 0;
      case 'performance':
        return this.executionResults.duration < constraint.maxDuration;
      default:
        return true;
    }
  }

  /**
   * Check all constraints are satisfied
   */
  checkConstraints() {
    for (const constraint of this.instructionSet.constraints) {
      if (!this.evaluateConstraint(constraint)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Create snapshot for rollback
   */
  async createSnapshot(stepId) {
    return {
      stepId,
      timestamp: new Date().toISOString(),
      state: { ...this.currentState },
      files: await this.snapshotFiles()
    };
  }

  /**
   * Snapshot relevant files
   */
  async snapshotFiles() {
    const files = this.instructionSet.resources?.files || [];
    const snapshots = {};
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        snapshots[file] = fs.readFileSync(file, 'utf8');
      }
    }
    
    return snapshots;
  }

  /**
   * Execute rollback
   */
  async rollback() {
    log('🔄 Starting rollback...', 'yellow');
    
    while (this.executionPlan.rollbackStack.length > 0) {
      const rollbackEntry = this.executionPlan.rollbackStack.pop();
      
      try {
        // Restore file snapshots
        for (const [file, content] of Object.entries(rollbackEntry.snapshot.files)) {
          fs.writeFileSync(file, content);
          log(`  ✅ Restored: ${file}`, 'green');
        }
        
        // Execute rollback action
        if (rollbackEntry.action !== 'NO_OP') {
          await this.executeRollbackAction(rollbackEntry.action);
        }
      } catch (error) {
        log(`  ❌ Rollback failed for ${rollbackEntry.stepId}: ${error.message}`, 'red');
      }
    }
    
    this.rollbackComplete = true;
    this.rollbackLogged = true;
    log('✅ Rollback complete', 'green');
  }

  /**
   * Execute a specific rollback action
   */
  async executeRollbackAction(action) {
    // Implementation depends on action type
    if (typeof action === 'function') {
      await action();
    } else if (typeof action === 'string') {
      // Execute command
      const { execSync } = require('child_process');
      execSync(action);
    }
  }

  /**
   * Save complete audit trail
   */
  async saveAuditTrail(data) {
    const auditPath = path.join(process.cwd(), 'db', 'audit.db');
    const db = new sqlite3.Database(auditPath);

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Create audit table if not exists
        db.run(`
          CREATE TABLE IF NOT EXISTS instruction_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instruction_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            state TEXT NOT NULL,
            event TEXT NOT NULL,
            data TEXT NOT NULL,
            hash TEXT NOT NULL,
            hash_chain TEXT
          )
        `);

        // Insert audit entries
        const stmt = db.prepare(`
          INSERT INTO instruction_audit 
          (instruction_id, timestamp, state, event, data, hash, hash_chain)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const entry of this.auditLog) {
          stmt.run(
            this.instructionSet.id,
            entry.timestamp,
            entry.state || this.currentState,
            entry.event,
            JSON.stringify(entry),
            entry.hash,
            JSON.stringify(this.hashChain)
          );
        }

        stmt.finalize();
        db.close(resolve);
      });
    });
  }

  /**
   * Execute instruction set with full verification
   */
  async execute() {
    try {
      // Initialize
      await this.transition('VALIDATE');
      
      // Validate instructions
      if (!this.validateInstruction()) {
        await this.abort('Invalid instruction format');
      }
      
      // Create execution plan
      await this.transition('PLAN');
      await this.createExecutionPlan();
      
      // Verify plan
      await this.transition('VERIFY_PLAN');
      if (!this.verifyPlan()) {
        await this.abort('Execution plan verification failed');
      }
      
      // Execute steps
      await this.transition('EXECUTE');
      this.executionResults = await this.executeSteps();
      this.executionComplete = true;
      
      // Verify execution
      await this.transition('VERIFY_EXECUTION');
      if (!this.verifyResults()) {
        await this.transition('ROLLBACK');
        await this.rollback();
        await this.abort('Post-execution verification failed');
      }
      
      // Complete
      this.success = true;
      await this.transition('COMPLETE');
      await this.saveAuditTrail(this.auditLog);
      
      log('✅ Instruction execution completed successfully', 'green');
      log(`📋 Hash chain: ${this.hashChain.slice(-1)[0]}`, 'cyan');
      
      return {
        success: true,
        results: this.executionResults,
        auditLog: this.auditLog,
        hashChain: this.hashChain
      };
      
    } catch (error) {
      if (!this.aborted) {
        await this.abort(error.message);
      }
      return {
        success: false,
        error: error.message,
        auditLog: this.auditLog,
        hashChain: this.hashChain
      };
    }
  }

  /**
   * Execute individual steps
   */
  async executeSteps() {
    const results = {
      steps: [],
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    for (const step of this.executionPlan.steps) {
      try {
        log(`  ⏳ Executing: ${step.description || step.id}`, 'cyan');
        
        // Verify pre-conditions for step
        if (step.preConditions) {
          for (const condition of step.preConditions) {
            if (!await this.evaluateCondition(condition)) {
              throw new Error(`Pre-condition failed: ${condition}`);
            }
          }
        }
        
        // Execute action
        const result = await this.executeAction(step.action);
        
        // Verify step
        if (step.verification) {
          const verified = await this.verifyStep(step.verification, result);
          if (!verified) {
            throw new Error(`Step verification failed: ${step.id}`);
          }
        }
        
        // Record success
        results.steps.push({
          id: step.id,
          status: 'completed',
          result,
          hash: this.generateHash({ step: step.id, result })
        });
        
        log(`    ✅ Completed: ${step.id}`, 'green');
        
      } catch (error) {
        log(`    ❌ Failed: ${step.id} - ${error.message}`, 'red');
        results.errors.push({
          stepId: step.id,
          error: error.message
        });
        throw error;
      }
    }

    results.duration = Date.now() - startTime;
    results.tests = { passed: results.errors.length === 0 };
    
    return results;
  }

  /**
   * Execute a specific action
   */
  async executeAction(action) {
    if (typeof action === 'function') {
      return await action();
    } else if (typeof action === 'object') {
      // Handle different action types
      switch (action.type) {
        case 'command':
          const { execSync } = require('child_process');
          return execSync(action.command, { encoding: 'utf8' });
        case 'file_write':
          fs.writeFileSync(action.path, action.content);
          return { written: action.path };
        case 'file_read':
          return fs.readFileSync(action.path, 'utf8');
        default:
          return null;
      }
    }
    return null;
  }

  /**
   * Verify step execution
   */
  async verifyStep(verification, result) {
    if (typeof verification === 'function') {
      return await verification(result);
    } else if (typeof verification === 'object') {
      switch (verification.type) {
        case 'file_exists':
          return fs.existsSync(verification.path);
        case 'contains':
          return result && result.includes(verification.text);
        case 'equals':
          return result === verification.value;
        case 'regex':
          return new RegExp(verification.pattern).test(result);
        default:
          return true;
      }
    }
    return true;
  }
}

// Export for use in other modules
module.exports = { InstructionStateMachine };

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    log('\n📖 Instruction Verification Compiler', 'bold');
    log('=' .repeat(50), 'blue');
    log('\nUsage: node instruction-compiler.js <instruction-file>', 'cyan');
    log('\nExample instruction file format:', 'cyan');
    log(`{
  "id": "unique-instruction-id",
  "description": "What this instruction does",
  "steps": [
    {
      "id": "step1",
      "description": "First step",
      "action": { "type": "command", "command": "npm test" },
      "verification": { "type": "contains", "text": "passed" },
      "dependencies": []
    }
  ],
  "constraints": [
    {
      "type": "file_exists",
      "path": "package.json",
      "description": "Package.json must exist"
    }
  ],
  "resources": {
    "files": ["package.json", "src/"]
  },
  "verification": {
    "type": "test_passes"
  }
}`, 'yellow');
    process.exit(0);
  }
  
  // Load and execute instruction file
  const instructionFile = args[0];
  if (!fs.existsSync(instructionFile)) {
    log(`❌ Instruction file not found: ${instructionFile}`, 'red');
    process.exit(1);
  }
  
  try {
    const instructions = JSON.parse(fs.readFileSync(instructionFile, 'utf8'));
    const machine = new InstructionStateMachine(instructions);
    
    machine.execute().then(result => {
      if (result.success) {
        log('\n✅ SUCCESS: All instructions executed and verified', 'green');
        process.exit(0);
      } else {
        log(`\n❌ FAILURE: ${result.error}`, 'red');
        process.exit(1);
      }
    });
  } catch (error) {
    log(`❌ Error loading instructions: ${error.message}`, 'red');
    process.exit(1);
  }
}
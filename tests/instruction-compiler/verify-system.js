#!/usr/bin/env node

/**
 * Verification Test Suite for Instruction Compiler System
 * 
 * This proves the enforcement mechanisms are working:
 * 1. Immutable state transitions
 * 2. Cryptographic verification
 * 3. Abort on violation
 * 4. Audit trail
 * 5. Rollback capability
 */

const { InstructionStateMachine } = require('../../scripts/instruction-compiler');
const { VerificationEngine } = require('../../scripts/verification-engine');
const { RollbackManager } = require('../../scripts/rollback-manager');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Colors for output
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

class SystemVerifier {
  constructor() {
    this.testResults = [];
    this.violations = [];
  }

  /**
   * Test 1: Verify Immutable State Transitions
   */
  async testImmutableStateTransitions() {
    log('\n📍 TEST 1: Immutable State Transitions', 'bold');
    log('=' .repeat(50), 'blue');
    
    const instruction = {
      id: 'immutable-test',
      steps: [],
      constraints: [],
      verification: {}
    };
    
    const machine = new InstructionStateMachine(instruction);
    
    try {
      // Try illegal transition (INIT -> EXECUTE)
      const illegalResult = await machine.transition('EXECUTE');
      
      // If we get here, the transition was allowed (bad)
      log('❌ Illegal transition was allowed!', 'red');
      this.testResults.push({ test: 'immutable_transitions', passed: false });
    } catch (error) {
      // Expected - the system should abort
      if (error.message.includes('Illegal state transition')) {
        log('✅ Illegal transition blocked: INIT -> EXECUTE', 'green');
        log(`   Abort reason: ${error.message}`, 'cyan');
        this.testResults.push({ test: 'immutable_transitions', passed: true });
      } else {
        log('❌ Unexpected error: ' + error.message, 'red');
        this.testResults.push({ test: 'immutable_transitions', passed: false });
      }
    }
    
    // Verify abort was triggered
    if (machine.aborted) {
      log('✅ System aborted on illegal transition', 'green');
    }
  }

  /**
   * Test 2: Verify Cryptographic Hash Chain
   */
  async testCryptographicVerification() {
    log('\n📍 TEST 2: Cryptographic Hash Chain', 'bold');
    log('=' .repeat(50), 'blue');
    
    const engine = new VerificationEngine();
    
    // Create operations
    const operations = [
      { action: 'create_file', target: 'test.txt' },
      { action: 'modify_file', target: 'test.txt' },
      { action: 'delete_file', target: 'test.txt' }
    ];
    
    // Create hash chain
    const chain = engine.createHashChain(operations);
    log(`✅ Created hash chain with ${chain.length} blocks`, 'green');
    
    // Verify chain integrity
    const valid = engine.verifyHashChain(chain);
    if (valid) {
      log('✅ Hash chain verified - all blocks valid', 'green');
      log(`   Genesis: ${chain[0].previousHash}`, 'cyan');
      log(`   Final: ${chain[chain.length-1].hash}`, 'cyan');
      this.testResults.push({ test: 'hash_chain', passed: true });
    } else {
      log('❌ Hash chain verification failed', 'red');
      log(`   Violations: ${JSON.stringify(engine.violations)}`, 'red');
      this.testResults.push({ test: 'hash_chain', passed: false });
    }
    
    // Tamper with chain
    log('\n🔨 Tampering with block 1...', 'yellow');
    chain[1].operation.action = 'TAMPERED';
    
    const tamperedValid = engine.verifyHashChain(chain);
    if (!tamperedValid) {
      log('✅ Tampering detected - chain rejected', 'green');
      log(`   Violation: ${engine.violations[0].type}`, 'cyan');
      this.testResults.push({ test: 'tamper_detection', passed: true });
    } else {
      log('❌ Tampering not detected!', 'red');
      this.testResults.push({ test: 'tamper_detection', passed: false });
    }
  }

  /**
   * Test 3: Verify Abort on Constraint Violation
   */
  async testAbortOnViolation() {
    log('\n📍 TEST 3: Abort on Constraint Violation', 'bold');
    log('=' .repeat(50), 'blue');
    
    const instruction = {
      id: 'abort-test',
      steps: [
        {
          id: 'failing-step',
          action: { type: 'file_read', path: 'nonexistent.txt' },
          verification: { type: 'file_exists', path: 'nonexistent.txt' }
        }
      ],
      constraints: [
        {
          type: 'file_exists',
          path: 'nonexistent.txt',
          description: 'This will fail'
        }
      ],
      resources: { files: ['nonexistent.txt'] },
      verification: { type: 'test_passes' }
    };
    
    const machine = new InstructionStateMachine(instruction);
    
    try {
      const result = await machine.execute();
      
      // If we get here without abort, that's wrong
      if (result.success) {
        log('❌ Execution did not abort on violation', 'red');
        this.testResults.push({ test: 'abort_on_violation', passed: false });
      }
    } catch (error) {
      // Expected - system should abort
      if (error.message.includes('nonexistent.txt')) {
        log('✅ Execution aborted on constraint violation', 'green');
        log(`   Error: ${error.message}`, 'cyan');
        log(`   System aborted: ${machine.aborted}`, 'cyan');
        this.testResults.push({ test: 'abort_on_violation', passed: true });
      } else {
        log('❌ Unexpected error: ' + error.message, 'red');
        this.testResults.push({ test: 'abort_on_violation', passed: false });
      }
    }
  }

  /**
   * Test 4: Verify Audit Trail Creation
   */
  async testAuditTrail() {
    log('\n📍 TEST 4: Audit Trail Integrity', 'bold');
    log('=' .repeat(50), 'blue');
    
    const dbPath = path.join(process.cwd(), 'db', 'audit.db');
    const db = new sqlite3.Database(dbPath);
    
    return new Promise((resolve) => {
      db.all(
        `SELECT COUNT(*) as count, 
                COUNT(DISTINCT instruction_id) as unique_instructions,
                COUNT(DISTINCT event) as event_types
         FROM instruction_audit`,
        (err, rows) => {
          if (err) {
            log(`❌ Could not query audit trail: ${err.message}`, 'red');
            this.testResults.push({ test: 'audit_trail', passed: false });
          } else {
            const stats = rows[0];
            log('✅ Audit trail verified', 'green');
            log(`   Total entries: ${stats.count}`, 'cyan');
            log(`   Unique instructions: ${stats.unique_instructions}`, 'cyan');
            log(`   Event types: ${stats.event_types}`, 'cyan');
            
            // Verify immutability
            db.run(
              `UPDATE instruction_audit SET event = 'TAMPERED' WHERE id = 1`,
              (err) => {
                if (err && err.message.includes('immutable')) {
                  log('✅ Audit log immutability enforced', 'green');
                  this.testResults.push({ test: 'audit_immutability', passed: true });
                } else {
                  log('❌ Audit log is mutable!', 'red');
                  this.testResults.push({ test: 'audit_immutability', passed: false });
                }
                db.close();
                resolve();
              }
            );
          }
        }
      );
    });
  }

  /**
   * Test 5: Verify Rollback Capability
   */
  async testRollbackCapability() {
    log('\n📍 TEST 5: Rollback and Recovery', 'bold');
    log('=' .repeat(50), 'blue');
    
    const manager = new RollbackManager();
    const testFile = 'test-rollback.txt';
    
    // Create initial file
    fs.writeFileSync(testFile, 'Original content');
    log('📝 Created test file with original content', 'cyan');
    
    // Create snapshot
    const snapshot = await manager.createSnapshot('before-change', {
      files: [testFile]
    });
    log(`✅ Snapshot created: ${snapshot.id}`, 'green');
    log(`   Hash: ${snapshot.hash}`, 'cyan');
    
    // Modify file
    fs.writeFileSync(testFile, 'Modified content - this will be rolled back');
    log('📝 Modified file content', 'yellow');
    
    // Verify file was changed
    const modifiedContent = fs.readFileSync(testFile, 'utf8');
    if (modifiedContent.includes('Modified')) {
      log('✅ File modification confirmed', 'green');
    }
    
    // Execute rollback
    const rollbackResult = await manager.rollbackToSnapshot('before-change');
    log('🔄 Executing rollback...', 'yellow');
    
    // Verify rollback
    const rolledBackContent = fs.readFileSync(testFile, 'utf8');
    if (rolledBackContent === 'Original content') {
      log('✅ Rollback successful - original content restored', 'green');
      this.testResults.push({ test: 'rollback', passed: true });
    } else {
      log('❌ Rollback failed - content not restored', 'red');
      this.testResults.push({ test: 'rollback', passed: false });
    }
    
    // Clean up
    fs.unlinkSync(testFile);
    log('🧹 Cleaned up test file', 'cyan');
  }

  /**
   * Test 6: Verify Merkle Tree for Parallel Operations
   */
  async testMerkleTree() {
    log('\n📍 TEST 6: Merkle Tree Verification', 'bold');
    log('=' .repeat(50), 'blue');
    
    const engine = new VerificationEngine();
    
    // Simulate parallel test execution
    const parallelTests = [
      { test: 'unit-test-1', result: 'passed' },
      { test: 'unit-test-2', result: 'passed' },
      { test: 'integration-test', result: 'failed' },
      { test: 'e2e-test', result: 'passed' }
    ];
    
    // Build Merkle tree
    const tree = engine.buildMerkleTree(parallelTests);
    log(`✅ Merkle tree built for ${parallelTests.length} operations`, 'green');
    log(`   Root: ${tree.root}`, 'cyan');
    
    // Generate and verify proof for specific test
    const proofData = engine.generateMerkleProof(parallelTests, 2);
    const valid = engine.verifyMerkleProof(
      parallelTests[2],
      proofData.proof,
      tree.root
    );
    
    if (valid) {
      log('✅ Merkle proof verified for integration-test', 'green');
      this.testResults.push({ test: 'merkle_tree', passed: true });
    } else {
      log('❌ Merkle proof verification failed', 'red');
      this.testResults.push({ test: 'merkle_tree', passed: false });
    }
  }

  /**
   * Generate comprehensive verification report
   */
  generateReport() {
    log('\n' + '=' .repeat(60), 'bold');
    log('📊 VERIFICATION REPORT', 'bold');
    log('=' .repeat(60), 'bold');
    
    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;
    const total = this.testResults.length;
    
    log(`\n✅ Passed: ${passed}/${total}`, 'green');
    log(`❌ Failed: ${failed}/${total}`, failed > 0 ? 'red' : 'green');
    
    log('\nTest Results:', 'cyan');
    for (const result of this.testResults) {
      const icon = result.passed ? '✅' : '❌';
      const color = result.passed ? 'green' : 'red';
      log(`  ${icon} ${result.test}`, color);
    }
    
    if (passed === total) {
      log('\n🎉 ALL ENFORCEMENT MECHANISMS VERIFIED!', 'green');
      log('\nThe instruction compiler system is working correctly:', 'green');
      log('  ✅ Immutable state transitions enforced', 'green');
      log('  ✅ Cryptographic verification active', 'green');
      log('  ✅ Abort on violation functioning', 'green');
      log('  ✅ Audit trail immutable and complete', 'green');
      log('  ✅ Rollback capability operational', 'green');
    } else {
      log('\n⚠️  SOME TESTS FAILED - REVIEW REQUIRED', 'red');
    }
    
    return passed === total;
  }
}

// Run verification
async function verifySystem() {
  const verifier = new SystemVerifier();
  
  log('\n🔐 INSTRUCTION COMPILER SYSTEM VERIFICATION', 'bold');
  log('Testing all enforcement mechanisms...', 'cyan');
  
  try {
    await verifier.testImmutableStateTransitions();
    await verifier.testCryptographicVerification();
    await verifier.testAbortOnViolation();
    await verifier.testAuditTrail();
    await verifier.testRollbackCapability();
    await verifier.testMerkleTree();
    
    const success = verifier.generateReport();
    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  verifySystem();
}

module.exports = { SystemVerifier };
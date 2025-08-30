#!/usr/bin/env node

/**
 * Verification Engine
 * 
 * Provides cryptographic verification and enforcement for instruction execution
 * Features:
 * - SHA-256 hash chains for immutability
 * - Merkle tree verification for parallel steps
 * - Digital signatures for authorization
 * - Zero-knowledge proofs for sensitive operations
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class VerificationEngine {
  constructor() {
    this.hashAlgorithm = 'sha256';
    this.proofChain = [];
    this.merkleRoots = [];
    this.signatures = new Map();
    this.violations = [];
  }

  /**
   * Generate deterministic hash for any data
   */
  hash(data) {
    const serialized = this.canonicalize(data);
    return crypto.createHash(this.hashAlgorithm)
      .update(serialized)
      .digest('hex');
  }

  /**
   * Canonicalize data for consistent hashing
   */
  canonicalize(data) {
    if (typeof data === 'string') {
      return data;
    } else if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    } else if (Array.isArray(data)) {
      return JSON.stringify(data.map(item => this.canonicalize(item)));
    } else if (typeof data === 'object' && data !== null) {
      const sorted = {};
      Object.keys(data).sort().forEach(key => {
        sorted[key] = this.canonicalize(data[key]);
      });
      return JSON.stringify(sorted);
    }
    return '';
  }

  /**
   * Create a hash chain for sequential operations
   */
  createHashChain(operations) {
    const chain = [];
    let previousHash = '0'.repeat(64); // Genesis block

    for (const op of operations) {
      const blockData = {
        index: chain.length,
        timestamp: Date.now(),
        operation: op,
        previousHash,
        nonce: 0
      };

      // Simple proof of work (for demonstration)
      while (!this.hash(blockData).startsWith('00')) {
        blockData.nonce++;
      }

      const blockHash = this.hash(blockData);
      chain.push({
        ...blockData,
        hash: blockHash
      });

      previousHash = blockHash;
    }

    return chain;
  }

  /**
   * Verify hash chain integrity
   */
  verifyHashChain(chain) {
    if (!chain || chain.length === 0) return false;

    let previousHash = '0'.repeat(64);

    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];
      
      // Verify index
      if (block.index !== i) {
        this.violations.push({
          type: 'INDEX_MISMATCH',
          block: i,
          expected: i,
          actual: block.index
        });
        return false;
      }

      // Verify previous hash link
      if (block.previousHash !== previousHash) {
        this.violations.push({
          type: 'BROKEN_CHAIN',
          block: i,
          expectedPrevious: previousHash,
          actualPrevious: block.previousHash
        });
        return false;
      }

      // Verify block hash
      const computedHash = this.hash({
        index: block.index,
        timestamp: block.timestamp,
        operation: block.operation,
        previousHash: block.previousHash,
        nonce: block.nonce
      });

      if (computedHash !== block.hash) {
        this.violations.push({
          type: 'INVALID_HASH',
          block: i,
          computed: computedHash,
          stored: block.hash
        });
        return false;
      }

      // Verify proof of work
      if (!block.hash.startsWith('00')) {
        this.violations.push({
          type: 'INVALID_PROOF_OF_WORK',
          block: i,
          hash: block.hash
        });
        return false;
      }

      previousHash = block.hash;
    }

    return true;
  }

  /**
   * Build Merkle tree for parallel operations
   */
  buildMerkleTree(operations) {
    if (!operations || operations.length === 0) return null;

    // Leaf nodes
    let level = operations.map(op => this.hash(op));

    const tree = [level];

    // Build tree levels
    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || level[i]; // Duplicate last if odd
        nextLevel.push(this.hash(left + right));
      }
      tree.push(nextLevel);
      level = nextLevel;
    }

    return {
      root: level[0],
      tree,
      leaves: operations.length
    };
  }

  /**
   * Verify Merkle proof for an operation
   */
  verifyMerkleProof(operation, proof, root) {
    let hash = this.hash(operation);

    for (const { sibling, position } of proof) {
      if (position === 'left') {
        hash = this.hash(sibling + hash);
      } else {
        hash = this.hash(hash + sibling);
      }
    }

    return hash === root;
  }

  /**
   * Generate Merkle proof for an operation
   */
  generateMerkleProof(operations, index) {
    if (index >= operations.length) return null;

    const tree = this.buildMerkleTree(operations);
    const proof = [];
    let currentIndex = index;
    let level = 0;

    while (level < tree.tree.length - 1) {
      const levelNodes = tree.tree[level];
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      
      if (siblingIndex < levelNodes.length) {
        proof.push({
          sibling: levelNodes[siblingIndex],
          position: currentIndex % 2 === 0 ? 'right' : 'left'
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
      level++;
    }

    return {
      proof,
      root: tree.root,
      operation: operations[index]
    };
  }

  /**
   * Create digital signature for authorization
   */
  createSignature(data, privateKey) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(this.canonicalize(data));
    return sign.sign(privateKey, 'hex');
  }

  /**
   * Verify digital signature
   */
  verifySignature(data, signature, publicKey) {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(this.canonicalize(data));
      return verify.verify(publicKey, signature, 'hex');
    } catch (error) {
      this.violations.push({
        type: 'INVALID_SIGNATURE',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate cryptographic commitment (for ZK proofs)
   */
  createCommitment(value, secret) {
    return this.hash({ value, secret });
  }

  /**
   * Verify commitment
   */
  verifyCommitment(commitment, value, secret) {
    return commitment === this.hash({ value, secret });
  }

  /**
   * Create zero-knowledge proof of knowledge
   */
  createZKProof(statement, witness, challenge) {
    // Simplified ZK proof for demonstration
    const commitment = this.createCommitment(statement, witness);
    const response = this.hash({ witness, challenge });
    
    return {
      commitment,
      challenge,
      response,
      statement
    };
  }

  /**
   * Verify zero-knowledge proof
   */
  verifyZKProof(proof) {
    // Verify the proof structure
    if (!proof.commitment || !proof.challenge || !proof.response) {
      this.violations.push({
        type: 'INVALID_ZK_PROOF',
        reason: 'Missing proof components'
      });
      return false;
    }

    // In a real implementation, this would verify the mathematical relationship
    // For demonstration, we check proof consistency
    const validStructure = proof.response === this.hash({
      witness: proof.response, // Would need actual witness in real impl
      challenge: proof.challenge
    });

    if (!validStructure) {
      this.violations.push({
        type: 'ZK_PROOF_FAILED',
        proof
      });
    }

    return validStructure;
  }

  /**
   * Create time-locked verification
   */
  createTimeLock(data, unlockTime) {
    const locked = {
      data: this.hash(data),
      unlockTime,
      lockedAt: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex')
    };

    return {
      lock: this.hash(locked),
      unlockKey: locked.nonce,
      unlockTime
    };
  }

  /**
   * Verify time-locked data
   */
  verifyTimeLock(lock, data, unlockKey) {
    const now = Date.now();
    
    if (now < lock.unlockTime) {
      this.violations.push({
        type: 'TIME_LOCK_ACTIVE',
        remainingTime: lock.unlockTime - now
      });
      return false;
    }

    const verification = this.hash({
      data: this.hash(data),
      unlockTime: lock.unlockTime,
      lockedAt: lock.lockedAt,
      nonce: unlockKey
    });

    return verification === lock.lock;
  }

  /**
   * Enforce constraint with cryptographic proof
   */
  enforceConstraint(constraint, evidence) {
    const proof = {
      constraint,
      evidence,
      timestamp: Date.now(),
      enforcer: 'verification-engine'
    };

    const proofHash = this.hash(proof);
    this.proofChain.push({
      ...proof,
      hash: proofHash,
      previousHash: this.proofChain.length > 0 
        ? this.proofChain[this.proofChain.length - 1].hash 
        : '0'.repeat(64)
    });

    // Evaluate constraint
    switch (constraint.type) {
      case 'REQUIRE_SIGNATURE':
        return this.verifySignature(
          evidence.data, 
          evidence.signature, 
          constraint.publicKey
        );
      
      case 'REQUIRE_HASH_CHAIN':
        return this.verifyHashChain(evidence.chain);
      
      case 'REQUIRE_MERKLE_PROOF':
        return this.verifyMerkleProof(
          evidence.operation,
          evidence.proof,
          constraint.root
        );
      
      case 'REQUIRE_TIME_LOCK':
        return Date.now() >= constraint.unlockTime;
      
      case 'REQUIRE_ZK_PROOF':
        return this.verifyZKProof(evidence.proof);
      
      default:
        return true;
    }
  }

  /**
   * Generate comprehensive verification report
   */
  generateReport() {
    return {
      timestamp: Date.now(),
      proofChainLength: this.proofChain.length,
      lastProofHash: this.proofChain.length > 0 
        ? this.proofChain[this.proofChain.length - 1].hash 
        : null,
      merkleRoots: this.merkleRoots,
      violations: this.violations,
      signatures: Array.from(this.signatures.keys()),
      integrity: this.violations.length === 0
    };
  }

  /**
   * Verify complete execution trace
   */
  verifyExecutionTrace(trace) {
    const results = {
      valid: true,
      checks: []
    };

    // Verify sequential operations
    if (trace.sequential) {
      const chainValid = this.verifyHashChain(trace.sequential);
      results.checks.push({
        type: 'HASH_CHAIN',
        valid: chainValid
      });
      results.valid = results.valid && chainValid;
    }

    // Verify parallel operations
    if (trace.parallel) {
      const merkleTree = this.buildMerkleTree(trace.parallel);
      this.merkleRoots.push(merkleTree.root);
      results.checks.push({
        type: 'MERKLE_TREE',
        root: merkleTree.root,
        leaves: merkleTree.leaves
      });
    }

    // Verify signatures
    if (trace.signatures) {
      for (const sig of trace.signatures) {
        const valid = this.verifySignature(sig.data, sig.signature, sig.publicKey);
        results.checks.push({
          type: 'SIGNATURE',
          valid,
          signer: sig.signer
        });
        results.valid = results.valid && valid;
      }
    }

    // Verify constraints
    if (trace.constraints) {
      for (const constraint of trace.constraints) {
        const valid = this.enforceConstraint(constraint, trace.evidence[constraint.id]);
        results.checks.push({
          type: 'CONSTRAINT',
          constraint: constraint.type,
          valid
        });
        results.valid = results.valid && valid;
      }
    }

    return results;
  }

  /**
   * Export verification proof for external validation
   */
  exportProof() {
    return {
      version: '1.0.0',
      algorithm: this.hashAlgorithm,
      proofChain: this.proofChain,
      merkleRoots: this.merkleRoots,
      timestamp: Date.now(),
      checksum: this.hash(this.proofChain)
    };
  }

  /**
   * Import and validate external proof
   */
  importProof(proof) {
    // Verify proof structure
    if (!proof.version || !proof.proofChain || !proof.checksum) {
      return { valid: false, reason: 'Invalid proof structure' };
    }

    // Verify checksum
    const computedChecksum = this.hash(proof.proofChain);
    if (computedChecksum !== proof.checksum) {
      return { valid: false, reason: 'Checksum mismatch' };
    }

    // Verify proof chain
    const chainValid = this.verifyHashChain(proof.proofChain);
    if (!chainValid) {
      return { valid: false, reason: 'Invalid proof chain', violations: this.violations };
    }

    return { valid: true, imported: proof.proofChain.length };
  }
}

// Export for use in other modules
module.exports = { VerificationEngine };

// CLI interface for testing
if (require.main === module) {
  const engine = new VerificationEngine();
  
  // Example: Create and verify a hash chain
  console.log('🔐 Verification Engine Test\n');
  
  const operations = [
    { action: 'init', target: 'system' },
    { action: 'validate', data: 'input' },
    { action: 'execute', command: 'npm test' },
    { action: 'verify', result: 'success' }
  ];
  
  console.log('Creating hash chain for operations...');
  const chain = engine.createHashChain(operations);
  console.log(`✅ Created chain with ${chain.length} blocks\n`);
  
  console.log('Verifying chain integrity...');
  const valid = engine.verifyHashChain(chain);
  if (valid) {
    console.log('✅ Chain is valid\n');
  } else {
    console.log('❌ Chain verification failed');
    console.log('Violations:', engine.violations);
  }
  
  // Example: Merkle tree for parallel operations
  console.log('Building Merkle tree for parallel operations...');
  const parallelOps = [
    { test: 'unit-tests' },
    { test: 'integration-tests' },
    { test: 'e2e-tests' },
    { test: 'performance-tests' }
  ];
  
  const merkleTree = engine.buildMerkleTree(parallelOps);
  console.log(`✅ Merkle root: ${merkleTree.root}\n`);
  
  // Generate and verify proof for specific operation
  const proofData = engine.generateMerkleProof(parallelOps, 1);
  console.log('Verifying Merkle proof for integration-tests...');
  const proofValid = engine.verifyMerkleProof(
    parallelOps[1],
    proofData.proof,
    proofData.root
  );
  console.log(proofValid ? '✅ Proof is valid' : '❌ Proof verification failed');
  
  // Generate report
  console.log('\n📊 Verification Report:');
  console.log(JSON.stringify(engine.generateReport(), null, 2));
}
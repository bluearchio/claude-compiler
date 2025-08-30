#!/usr/bin/env node

/**
 * CLAUDE CODE MASTER ORCHESTRATOR
 * 
 * THIS IS THE SINGLE ENTRY POINT FOR ALL CLAUDE CODE OPERATIONS
 * 
 * COMPLETE FLOW: 
 * User Prompt → Decision Engine → Agent Selection → Task Creation → Instruction Generation → 
 * Verified Execution → Task Tracking → Results → Learning
 * 
 * ALWAYS EXECUTES INSTRUCTIONS - NO EXCEPTIONS
 */

const { DecisionEngine } = require('./flows/decision-engine');
const { TaskTracker } = require('./flows/task-tracker');
const { AgentRegistry } = require('./agents/agent-registry');
const { InstructionStateMachine } = require('./scripts/instruction-compiler');
const path = require('path');
const fs = require('fs');

// Colors for output
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

class ClaudeMasterOrchestrator {
  constructor() {
    this.decisionEngine = new DecisionEngine();
    this.taskTracker = new TaskTracker();
    this.agentRegistry = new AgentRegistry();
    this.currentSession = null;
    this.executionHistory = [];
  }

  /**
   * MASTER ENTRY POINT - Process any user prompt with complete flow
   */
  async processPrompt(userPrompt) {
    console.log(colors.clear);
    
    log('╔══════════════════════════════════════════════════════════════════════╗', 'blue');
    log('║                    CLAUDE CODE MASTER ORCHESTRATOR                    ║', 'bold');
    log('║                         PROCESSING PROMPT                             ║', 'bold');
    log('╚══════════════════════════════════════════════════════════════════════╝', 'blue');
    
    const sessionId = `session-${Date.now()}`;
    this.currentSession = sessionId;
    
    try {
      // PHASE 1: INITIALIZE TRACKING
      log('\n🚀 PHASE 1: INITIALIZING SESSION TRACKING', 'bold');
      await this.initializeSession(sessionId, userPrompt);
      
      // PHASE 2: DECISION ENGINE ANALYSIS
      log('\n🔍 PHASE 2: DECISION ENGINE ANALYSIS', 'bold');
      const analysis = await this.analyzePrompt(userPrompt);
      await this.taskTracker.logEvent(sessionId, 'ANALYSIS_COMPLETE', analysis);
      
      // PHASE 3: AGENT SELECTION & ORCHESTRATION
      log('\n🤖 PHASE 3: AGENT SELECTION & ORCHESTRATION', 'bold');
      const agentPlan = await this.selectAndOrchestrate(analysis, sessionId);
      await this.taskTracker.logEvent(sessionId, 'AGENTS_SELECTED', agentPlan);
      
      // PHASE 4: INSTRUCTION GENERATION
      log('\n⚙️ PHASE 4: INSTRUCTION GENERATION', 'bold');
      const instruction = await this.generateVerifiedInstruction(agentPlan, analysis, sessionId);
      await this.taskTracker.logEvent(sessionId, 'INSTRUCTION_GENERATED', { instructionId: instruction.id });
      
      // PHASE 5: VERIFIED EXECUTION (ALWAYS EXECUTE)
      log('\n🎯 PHASE 5: VERIFIED EXECUTION', 'bold');
      const executionResult = await this.executeWithVerification(instruction, sessionId);
      
      // PHASE 6: RESULTS TRACKING & LEARNING
      log('\n📊 PHASE 6: RESULTS TRACKING & LEARNING', 'bold');
      await this.trackResultsAndLearn(executionResult, agentPlan, sessionId);
      
      // PHASE 7: COMPLETION & VISUALIZATION
      log('\n✅ PHASE 7: COMPLETION & VISUALIZATION', 'bold');
      await this.completeSession(sessionId, executionResult);
      await this.visualizeResults(sessionId);
      
      return {
        success: true,
        sessionId,
        result: executionResult,
        visualization: await this.taskTracker.generateFlowVisualization(sessionId)
      };
      
    } catch (error) {
      log(`\n❌ MASTER ORCHESTRATOR ERROR: ${error.message}`, 'red');
      await this.handleFailure(sessionId, error);
      throw error;
    }
  }

  /**
   * PHASE 1: Initialize session tracking
   */
  async initializeSession(sessionId, userPrompt) {
    log('  📝 Creating session tracking record...', 'cyan');
    
    // Initialize all tracking systems
    await this.taskTracker.startSession(sessionId, userPrompt, ['analyzing']);
    
    log(`  ✅ Session initialized: ${sessionId}`, 'green');
    log(`  📋 User prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}"`, 'cyan');
  }

  /**
   * PHASE 2: Comprehensive prompt analysis
   */
  async analyzePrompt(userPrompt) {
    log('  🔍 Analyzing user intent and requirements...', 'cyan');
    
    const analysis = {
      prompt: userPrompt,
      intent: this.extractIntent(userPrompt),
      complexity: this.determineComplexity(userPrompt),
      triggers: this.findAgentTriggers(userPrompt),
      domain: this.identifyDomain(userPrompt),
      riskLevel: this.assessRisk(userPrompt),
      requirements: this.extractRequirements(userPrompt),
      constraints: this.identifyConstraints(userPrompt),
      keywords: this.extractKeywords(userPrompt),
      timestamp: new Date().toISOString()
    };
    
    log(`  🎯 Intent: ${analysis.intent}`, 'cyan');
    log(`  ⚡ Complexity: ${analysis.complexity.level} (score: ${analysis.complexity.score})`, 'cyan');
    log(`  🏷️  Domain: ${analysis.domain}`, 'cyan');
    log(`  ⚠️  Risk Level: ${analysis.riskLevel}`, 'cyan');
    log(`  🔥 Triggers: ${analysis.triggers.join(', ')}`, 'cyan');
    
    return analysis;
  }

  /**
   * PHASE 3: Agent selection and orchestration planning
   */
  async selectAndOrchestrate(analysis, sessionId) {
    log('  🎭 Selecting optimal agents...', 'cyan');
    
    // Get agent selection from registry
    const primarySelection = this.agentRegistry.selectAgent(analysis, analysis.complexity);
    const agentChain = this.agentRegistry.selectAgentChain(analysis, analysis.complexity);
    
    const plan = {
      primary: primarySelection ? primarySelection[0] : 'general-purpose',
      primaryReasons: primarySelection ? primarySelection[1].reasons : ['Fallback selection'],
      chain: agentChain,
      approach: this.determineApproach(agentChain, analysis.complexity),
      phases: this.createExecutionPhases(agentChain, analysis),
      coordination: this.planCoordination(agentChain, analysis)
    };
    
    // Update session with selected agent chain (don't create new session)
    await this.taskTracker.updateSessionAgents(sessionId, agentChain);
    
    log(`  🥇 Primary Agent: ${plan.primary}`, 'cyan');
    log(`  🔗 Agent Chain: ${plan.chain.join(' → ')}`, 'cyan');
    log(`  📋 Approach: ${plan.approach}`, 'cyan');
    log(`  📊 Phases: ${plan.phases.length}`, 'cyan');
    
    return plan;
  }

  /**
   * PHASE 4: Generate verified instruction
   */
  async generateVerifiedInstruction(agentPlan, analysis, sessionId) {
    log('  ⚙️ Converting plan to executable instruction...', 'cyan');
    
    const instruction = {
      id: `instruction-${sessionId}`,
      description: `Master orchestration for session ${sessionId}: ${analysis.intent}`,
      metadata: {
        sessionId,
        originalPrompt: analysis.prompt,
        selectedAgents: agentPlan.chain,
        approach: agentPlan.approach,
        riskLevel: analysis.riskLevel
      },
      steps: [],
      constraints: [],
      resources: {
        files: [],
        agents: agentPlan.chain,
        databases: ['tasks.db', 'audit.db']
      },
      verification: {
        type: 'orchestrated_execution',
        requiresAllAgents: true
      }
    };

    // Convert agent phases to executable steps
    agentPlan.phases.forEach((phase, index) => {
      const step = {
        id: `phase-${index + 1}-${phase.agent}`,
        description: `Phase ${index + 1}: ${phase.objective}`,
        action: {
          type: 'agent_orchestration',
          agent: phase.agent,
          objective: phase.objective,
          deliverables: phase.deliverables,
          parameters: {
            sessionId,
            phase: index + 1,
            analysis: analysis,
            context: phase.context || {}
          }
        },
        verification: {
          type: 'agent_completion',
          requiredDeliverables: phase.deliverables,
          qualityThreshold: 0.8
        },
        dependencies: phase.dependencies,
        rollback: {
          type: 'agent_rollback',
          agent: phase.agent,
          snapshotId: `${sessionId}-phase-${index + 1}`
        }
      };

      instruction.steps.push(step);
    });

    // Add comprehensive constraints
    instruction.constraints = [
      {
        type: 'no_errors',
        description: 'Any error in any phase aborts entire execution'
      },
      {
        type: 'agent_verification',
        description: 'Each agent must verify its deliverables before proceeding'
      },
      {
        type: 'session_tracking',
        description: 'All progress must be tracked in real-time'
      },
      {
        type: 'risk_mitigation',
        description: `Risk level ${analysis.riskLevel} mitigation measures required`
      }
    ];

    // Add risk-specific constraints
    if (analysis.riskLevel === 'HIGH') {
      instruction.constraints.push({
        type: 'rollback_snapshots',
        description: 'Create rollback snapshots before each high-risk operation'
      });
      instruction.constraints.push({
        type: 'manual_approval',
        description: 'Require explicit confirmation for destructive operations'
      });
    }

    log(`  📝 Generated instruction with ${instruction.steps.length} steps`, 'cyan');
    log(`  🛡️ Applied ${instruction.constraints.length} constraints`, 'cyan');
    log(`  🎯 Instruction ID: ${instruction.id}`, 'cyan');

    return instruction;
  }

  /**
   * PHASE 5: Execute with full verification (ALWAYS EXECUTES)
   */
  async executeWithVerification(instruction, sessionId) {
    log('  🚀 Executing instruction with cryptographic verification...', 'cyan');
    
    // Track execution start
    await this.taskTracker.updateSessionProgress(sessionId, 1, instruction.steps[0]?.action.agent || 'unknown', 0);
    
    // Create instruction machine and execute
    const machine = new InstructionStateMachine(instruction);
    
    try {
      // This ALWAYS executes - no exceptions
      const result = await machine.execute();
      
      log('  ✅ Instruction execution completed successfully', 'green');
      log(`  🔐 Verification hash: ${result.hashChain[result.hashChain.length - 1]}`, 'cyan');
      log(`  📊 Audit entries: ${result.auditLog.length}`, 'cyan');
      
      return {
        success: true,
        instructionId: instruction.id,
        executionResult: result,
        sessionId,
        completedSteps: result.auditLog.length,
        verificationHash: result.hashChain[result.hashChain.length - 1],
        auditTrail: result.auditLog
      };
      
    } catch (error) {
      log('  ⚠️ Instruction execution encountered error - analyzing...', 'yellow');
      
      // Even failures are tracked and provide value
      return {
        success: false,
        instructionId: instruction.id,
        error: error.message,
        sessionId,
        completedSteps: machine.auditLog?.length || 0,
        auditTrail: machine.auditLog || [],
        abortReason: machine.abortReason || error.message
      };
    }
  }

  /**
   * PHASE 6: Track results and learn
   */
  async trackResultsAndLearn(executionResult, agentPlan, sessionId) {
    log('  📈 Recording results and updating agent performance...', 'cyan');
    
    // Record agent performance
    for (const agent of agentPlan.chain) {
      this.agentRegistry.recordAgentPerformance(
        agent, 
        executionResult.success, 
        executionResult.executionTime || 0, 
        executionResult.success ? 0.8 : 0.2
      );
    }
    
    // Update execution history
    this.executionHistory.push({
      sessionId,
      timestamp: new Date().toISOString(),
      success: executionResult.success,
      agentChain: agentPlan.chain,
      approach: agentPlan.approach,
      result: executionResult
    });
    
    log('  ✅ Results recorded and learning updated', 'green');
    log(`  📊 Total sessions in history: ${this.executionHistory.length}`, 'cyan');
  }

  /**
   * PHASE 7: Complete session
   */
  async completeSession(sessionId, executionResult) {
    const status = executionResult.success ? 'completed' : 'failed';
    await this.taskTracker.completeSession(sessionId, status, executionResult);
    
    log(`  🏁 Session completed with status: ${status.toUpperCase()}`, executionResult.success ? 'green' : 'yellow');
  }

  /**
   * Visualize complete execution flow
   */
  async visualizeResults(sessionId) {
    log('  🎨 Generating execution flow visualization...', 'cyan');
    
    // This will show the complete decision flow
    await this.taskTracker.generateFlowVisualization(sessionId);
  }

  /**
   * Handle execution failures
   */
  async handleFailure(sessionId, error) {
    log(`  💥 Handling failure in session ${sessionId}`, 'red');
    
    await this.taskTracker.logEvent(sessionId, 'ORCHESTRATOR_FAILURE', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, null, null, 'critical');
    
    await this.taskTracker.completeSession(sessionId, 'aborted', {
      success: false,
      error: error.message,
      aborted: true
    });
  }

  /**
   * Helper methods for analysis
   */
  extractIntent(prompt) {
    const intentPatterns = {
      'CREATE': ['create', 'build', 'make', 'generate', 'add', 'implement'],
      'FIX': ['fix', 'repair', 'debug', 'resolve', 'solve', 'correct'],
      'ANALYZE': ['analyze', 'review', 'examine', 'investigate', 'study'],
      'DEPLOY': ['deploy', 'release', 'publish', 'ship', 'launch'],
      'TEST': ['test', 'verify', 'validate', 'check', 'ensure'],
      'REFACTOR': ['refactor', 'improve', 'optimize', 'restructure'],
      'COORDINATE': ['coordinate', 'orchestrate', 'manage', 'align']
    };

    const lowerPrompt = prompt.toLowerCase();
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(pattern => lowerPrompt.includes(pattern))) {
        return intent;
      }
    }
    return 'GENERAL';
  }

  determineComplexity(prompt) {
    let score = 0;
    const factors = [];

    // Multiple action words
    const actionWords = ['create', 'build', 'deploy', 'test', 'fix', 'analyze'];
    const actionCount = actionWords.filter(word => prompt.toLowerCase().includes(word)).length;
    if (actionCount > 2) {
      score += 3;
      factors.push('Multiple actions');
    }

    // Conditional logic
    if (/if|when|unless|depending|based on/.test(prompt.toLowerCase())) {
      score += 2;
      factors.push('Conditional logic');
    }

    // Multiple entities
    const entityCount = (prompt.match(/\band\b|\bor\b/gi) || []).length;
    if (entityCount > 2) {
      score += 2;
      factors.push('Multiple entities');
    }

    // Technical complexity
    const techTerms = ['database', 'api', 'microservice', 'pipeline', 'infrastructure'];
    const techCount = techTerms.filter(term => prompt.toLowerCase().includes(term)).length;
    if (techCount > 1) {
      score += 2;
      factors.push('Technical complexity');
    }

    return {
      level: score >= 6 ? 'VERY_COMPLEX' : score >= 4 ? 'COMPLEX' : score >= 2 ? 'MODERATE' : 'SIMPLE',
      score,
      factors
    };
  }

  findAgentTriggers(prompt) {
    const triggers = [];
    const triggerMap = {
      'WORKFLOW_ORCHESTRATOR': ['coordinate', 'orchestrate', 'build entire', 'full system'],
      'QUALITY_ASSURANCE': ['test', 'verify', 'validate', 'quality'],
      'PROJECT_MANAGER': ['plan', 'organize', 'break down', 'requirements'],
      'TECHNICAL_ARCHITECT': ['architecture', 'design', 'structure'],
      'DEVOPS_DEPLOYMENT': ['deploy', 'ci/cd', 'infrastructure'],
      'DATA_PIPELINE': ['pipeline', 'etl', 'data processing'],
      'GENERAL_PURPOSE': ['search', 'find', 'analyze']
    };

    const lowerPrompt = prompt.toLowerCase();
    for (const [trigger, patterns] of Object.entries(triggerMap)) {
      if (patterns.some(pattern => lowerPrompt.includes(pattern))) {
        triggers.push(trigger);
      }
    }

    return triggers;
  }

  identifyDomain(prompt) {
    const domains = {
      'WEB_DEVELOPMENT': ['html', 'css', 'javascript', 'react', 'frontend'],
      'BACKEND': ['api', 'server', 'database', 'backend'],
      'DEVOPS': ['docker', 'kubernetes', 'ci/cd', 'deploy'],
      'DATA': ['data', 'analytics', 'pipeline', 'etl'],
      'TESTING': ['test', 'qa', 'automation'],
      'SECURITY': ['security', 'auth', 'encryption']
    };

    const lowerPrompt = prompt.toLowerCase();
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        return domain;
      }
    }
    return 'GENERAL';
  }

  assessRisk(prompt) {
    const highRisk = ['production', 'deploy', 'delete', 'drop', 'live'];
    const mediumRisk = ['modify', 'update', 'change', 'alter'];
    
    const lowerPrompt = prompt.toLowerCase();
    
    if (highRisk.some(word => lowerPrompt.includes(word))) return 'HIGH';
    if (mediumRisk.some(word => lowerPrompt.includes(word))) return 'MEDIUM';
    return 'LOW';
  }

  extractRequirements(prompt) {
    const requirements = [];
    const patterns = [
      /must\s+(.+?)(?=\.|\s*$)/gi,
      /need\s+to\s+(.+?)(?=\.|\s*$)/gi,
      /should\s+(.+?)(?=\.|\s*$)/gi
    ];

    patterns.forEach(pattern => {
      const matches = prompt.match(pattern);
      if (matches) {
        requirements.push(...matches);
      }
    });

    return requirements;
  }

  identifyConstraints(prompt) {
    const constraints = [];
    const constraintWords = {
      'TIME': ['urgent', 'quickly', 'asap', 'deadline'],
      'QUALITY': ['high quality', 'production ready'],
      'SECURITY': ['secure', 'safe', 'encrypted'],
      'PERFORMANCE': ['fast', 'optimized', 'efficient']
    };

    const lowerPrompt = prompt.toLowerCase();
    for (const [constraint, words] of Object.entries(constraintWords)) {
      if (words.some(word => lowerPrompt.includes(word))) {
        constraints.push(constraint);
      }
    }

    return constraints;
  }

  extractKeywords(prompt) {
    const technicalTerms = [
      'api', 'database', 'frontend', 'backend', 'deploy', 'test',
      'build', 'pipeline', 'microservice', 'docker', 'kubernetes'
    ];

    return technicalTerms.filter(term => 
      prompt.toLowerCase().includes(term)
    );
  }

  determineApproach(agentChain, complexity) {
    if (agentChain.length > 2) return 'SEQUENTIAL_CHAIN';
    if (complexity.level === 'VERY_COMPLEX') return 'PARALLEL_EXECUTION';
    return 'SINGLE_AGENT';
  }

  createExecutionPhases(agentChain, analysis) {
    return agentChain.map((agent, index) => ({
      phase: index + 1,
      agent,
      objective: this.getAgentObjective(agent, analysis),
      deliverables: this.getAgentDeliverables(agent),
      dependencies: index > 0 ? [`phase-${index}`] : [],
      context: { analysis, chainPosition: index }
    }));
  }

  planCoordination(agentChain, analysis) {
    return {
      type: agentChain.length > 1 ? 'COORDINATED' : 'STANDALONE',
      handoffs: agentChain.length - 1,
      syncPoints: Math.ceil(agentChain.length / 2)
    };
  }

  getAgentObjective(agentName, analysis) {
    const objectives = {
      'workflow-orchestrator': `Orchestrate ${analysis.intent} workflow`,
      'quality-assurance-guardian': `Ensure quality for ${analysis.intent}`,
      'project-manager-analyst': `Analyze and plan ${analysis.intent}`,
      'technical-architect-lead': `Design technical solution for ${analysis.intent}`,
      'devops-deployment-engineer': `Handle deployment for ${analysis.intent}`,
      'data-pipeline-architect': `Design data flow for ${analysis.intent}`,
      'general-purpose': `Research and execute ${analysis.intent}`
    };
    return objectives[agentName] || `Execute ${analysis.intent}`;
  }

  getAgentDeliverables(agentName) {
    const deliverables = {
      'workflow-orchestrator': ['Coordination plan', 'Agent synchronization', 'Result integration'],
      'quality-assurance-guardian': ['Test results', 'Quality report', 'Coverage analysis'],
      'project-manager-analyst': ['Requirements analysis', 'Task breakdown', 'Success criteria'],
      'technical-architect-lead': ['Technical design', 'Architecture decisions', 'Implementation plan'],
      'devops-deployment-engineer': ['Deployment pipeline', 'Infrastructure setup', 'Monitoring'],
      'data-pipeline-architect': ['Data flow design', 'Pipeline implementation', 'Data validation'],
      'general-purpose': ['Research results', 'Analysis report', 'Recommendations']
    };
    return deliverables[agentName] || ['Task completion'];
  }

  /**
   * Start monitoring mode
   */
  async startMonitoring() {
    log('\n🖥️ Starting Claude Master Orchestrator monitoring...', 'cyan');
    await this.taskTracker.startRealTimeMonitoring();
  }
}

// Export for use in other modules
module.exports = { ClaudeMasterOrchestrator };

// CLI Interface
if (require.main === module) {
  const orchestrator = new ClaudeMasterOrchestrator();
  const args = process.argv.slice(2);
  
  if (args[0] === 'monitor') {
    // Start monitoring mode
    orchestrator.startMonitoring();
  } else if (args[0] === 'test') {
    // Test with example prompt
    const testPrompt = args.slice(1).join(' ') || 'Deploy a Node.js application with comprehensive testing and monitoring';
    
    log('\n🧪 TESTING CLAUDE MASTER ORCHESTRATOR', 'bold');
    log(`Processing test prompt: "${testPrompt}"`, 'cyan');
    
    orchestrator.processPrompt(testPrompt).then(result => {
      if (result.success) {
        log('\n🎉 Master orchestration completed successfully!', 'green');
        log(`Session: ${result.sessionId}`, 'cyan');
        log(`Verification: ${result.result.verificationHash || 'N/A'}`, 'cyan');
      } else {
        log('\n⚠️ Master orchestration completed with issues', 'yellow');
      }
    }).catch(error => {
      log(`\n❌ Master orchestration failed: ${error.message}`, 'red');
      process.exit(1);
    });
  } else if (args.length > 0) {
    // Process user prompt directly
    const userPrompt = args.join(' ');
    
    log('\n🎯 CLAUDE MASTER ORCHESTRATOR', 'bold');
    log('Processing your prompt...', 'cyan');
    
    orchestrator.processPrompt(userPrompt).then(result => {
      log('\n✨ Processing complete!', result.success ? 'green' : 'yellow');
    }).catch(error => {
      log(`\n❌ Processing failed: ${error.message}`, 'red');
      process.exit(1);
    });
  } else {
    // Show usage
    log('\n📖 CLAUDE MASTER ORCHESTRATOR - Usage', 'bold');
    log('=' .repeat(50), 'blue');
    log('\nCommands:', 'cyan');
    log('  node claude-master.js "your prompt here"     # Process prompt', 'cyan');
    log('  node claude-master.js test                   # Test with example', 'cyan');
    log('  node claude-master.js test "custom prompt"   # Test with custom prompt', 'cyan');
    log('  node claude-master.js monitor                # Start monitoring', 'cyan');
    log('\nExamples:', 'cyan');
    log('  node claude-master.js "create a deployment pipeline"', 'cyan');
    log('  node claude-master.js "fix the authentication bug"', 'cyan');
    log('  node claude-master.js "coordinate testing and deployment"', 'cyan');
    log('\n🎯 ALL PROMPTS WILL BE EXECUTED - NO EXCEPTIONS', 'yellow');
  }
}
#!/usr/bin/env node

/**
 * Claude Code Decision Engine
 * 
 * COMPLETE DECISION FLOW: Prompt → Analysis → Agent Selection → Task Creation → Execution → Verification
 * 
 * This is the MASTER CONTROLLER that handles ALL decisions in Claude Code
 */

const fs = require('fs');
const path = require('path');
const { InstructionStateMachine } = require('../scripts/instruction-compiler');
const sqlite3 = require('sqlite3').verbose();

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

class DecisionEngine {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'db', 'tasks.db');
    this.agents = this.loadAgentDefinitions();
    this.decisionHistory = [];
    this.currentSession = null;
  }

  /**
   * MAIN ENTRY POINT: Process user prompt through complete decision flow
   */
  async processPrompt(userPrompt) {
    const sessionId = `session-${Date.now()}`;
    this.currentSession = sessionId;
    
    log('\n🔍 CLAUDE CODE DECISION ENGINE', 'bold');
    log('=' .repeat(70), 'blue');
    log(`Session: ${sessionId}`, 'cyan');
    log(`Prompt: "${userPrompt}"`, 'cyan');
    log('=' .repeat(70), 'blue');

    const decision = {
      sessionId,
      prompt: userPrompt,
      timestamp: new Date().toISOString(),
      steps: []
    };

    try {
      // STEP 1: ANALYZE PROMPT
      log('\n📋 STEP 1: ANALYZING PROMPT', 'bold');
      const analysis = await this.analyzePrompt(userPrompt);
      decision.steps.push({ step: 'analyze', result: analysis });
      this.logDecision('PROMPT_ANALYZED', analysis);

      // STEP 2: DETERMINE COMPLEXITY & TYPE
      log('\n🎯 STEP 2: DETERMINING TASK COMPLEXITY', 'bold');
      const complexity = this.determineComplexity(analysis);
      decision.steps.push({ step: 'complexity', result: complexity });
      this.logDecision('COMPLEXITY_DETERMINED', complexity);

      // STEP 3: SELECT AGENTS
      log('\n🤖 STEP 3: SELECTING OPTIMAL AGENTS', 'bold');
      const agentSelection = this.selectAgents(analysis, complexity);
      decision.steps.push({ step: 'agents', result: agentSelection });
      this.logDecision('AGENTS_SELECTED', agentSelection);

      // STEP 4: CREATE EXECUTION PLAN
      log('\n📝 STEP 4: CREATING EXECUTION PLAN', 'bold');
      const executionPlan = this.createExecutionPlan(analysis, agentSelection);
      decision.steps.push({ step: 'plan', result: executionPlan });
      this.logDecision('PLAN_CREATED', executionPlan);

      // STEP 5: GENERATE INSTRUCTION
      log('\n⚙️ STEP 5: GENERATING VERIFIED INSTRUCTION', 'bold');
      const instruction = this.generateInstruction(executionPlan);
      decision.steps.push({ step: 'instruction', result: instruction });
      this.logDecision('INSTRUCTION_GENERATED', instruction);

      // STEP 6: EXECUTE WITH VERIFICATION
      log('\n🚀 STEP 6: EXECUTING WITH CRYPTOGRAPHIC VERIFICATION', 'bold');
      const machine = new InstructionStateMachine(instruction);
      const result = await machine.execute();
      decision.steps.push({ step: 'execution', result });
      this.logDecision('EXECUTION_COMPLETED', result);

      // STEP 7: TRACK RESULTS
      log('\n📊 STEP 7: TRACKING RESULTS & UPDATING KNOWLEDGE', 'bold');
      await this.updateAgentScores(agentSelection, result);
      await this.saveDecisionHistory(decision);
      this.logDecision('RESULTS_TRACKED', { success: result.success });

      // DECISION SUMMARY
      this.showDecisionSummary(decision);
      
      return {
        success: true,
        sessionId,
        decision,
        result
      };

    } catch (error) {
      log(`\n❌ DECISION ENGINE ERROR: ${error.message}`, 'red');
      decision.steps.push({ step: 'error', result: error.message });
      this.logDecision('EXECUTION_FAILED', { error: error.message });
      
      return {
        success: false,
        sessionId,
        decision,
        error: error.message
      };
    }
  }

  /**
   * STEP 1: Analyze user prompt to understand intent and requirements
   */
  async analyzePrompt(prompt) {
    log('  Parsing user intent...', 'cyan');
    
    const analysis = {
      intent: this.extractIntent(prompt),
      keywords: this.extractKeywords(prompt),
      triggers: this.findTriggers(prompt),
      requirements: this.extractRequirements(prompt),
      constraints: this.identifyConstraints(prompt),
      domain: this.identifyDomain(prompt),
      riskLevel: this.assessRisk(prompt)
    };

    log(`  Intent: ${analysis.intent}`, 'cyan');
    log(`  Domain: ${analysis.domain}`, 'cyan');
    log(`  Risk Level: ${analysis.riskLevel}`, 'cyan');
    log(`  Key Triggers: ${analysis.triggers.join(', ')}`, 'cyan');

    return analysis;
  }

  /**
   * Extract primary intent from prompt
   */
  extractIntent(prompt) {
    const intentPatterns = {
      'CREATE': ['create', 'build', 'make', 'generate', 'add', 'implement'],
      'FIX': ['fix', 'repair', 'debug', 'resolve', 'solve', 'correct'],
      'ANALYZE': ['analyze', 'review', 'examine', 'investigate', 'study'],
      'DEPLOY': ['deploy', 'release', 'publish', 'ship', 'launch'],
      'TEST': ['test', 'verify', 'validate', 'check', 'ensure'],
      'REFACTOR': ['refactor', 'improve', 'optimize', 'restructure', 'clean'],
      'COORDINATE': ['coordinate', 'orchestrate', 'manage', 'organize', 'align']
    };

    const lowerPrompt = prompt.toLowerCase();
    
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(pattern => lowerPrompt.includes(pattern))) {
        return intent;
      }
    }

    return 'GENERAL';
  }

  /**
   * Extract important keywords from prompt
   */
  extractKeywords(prompt) {
    const keywords = [];
    const technicalTerms = [
      'test', 'build', 'deploy', 'database', 'migration', 'api', 'frontend',
      'backend', 'pipeline', 'ci/cd', 'docker', 'kubernetes', 'aws', 'gcp',
      'security', 'performance', 'monitoring', 'logging', 'authentication',
      'authorization', 'cache', 'queue', 'webhook', 'microservice', 'lambda'
    ];

    const lowerPrompt = prompt.toLowerCase();
    technicalTerms.forEach(term => {
      if (lowerPrompt.includes(term)) {
        keywords.push(term);
      }
    });

    return keywords;
  }

  /**
   * Find agent trigger phrases in prompt
   */
  findTriggers(prompt) {
    const triggers = [];
    const triggerPatterns = {
      'INSTRUCTION_COMPILER': ['ensure', 'follow correct', 'align all', 'coordinate'],
      'WORKFLOW_ORCHESTRATOR': ['build entire', 'full system', 'coordinate', 'multiple'],
      'QUALITY_ASSURANCE': ['test', 'verify', 'validate', 'coverage', 'quality'],
      'TECHNICAL_ARCHITECT': ['architecture', 'design', 'structure', 'pattern'],
      'PROJECT_MANAGER': ['plan', 'organize', 'break down', 'requirements'],
      'DEVOPS_DEPLOYMENT': ['deploy', 'ci/cd', 'pipeline', 'infrastructure'],
      'DATA_PIPELINE': ['etl', 'pipeline', 'data processing', 'transform'],
      'GENERAL_PURPOSE': ['search', 'find', 'read', 'analyze']
    };

    const lowerPrompt = prompt.toLowerCase();
    
    for (const [trigger, patterns] of Object.entries(triggerPatterns)) {
      if (patterns.some(pattern => lowerPrompt.includes(pattern))) {
        triggers.push(trigger);
      }
    }

    return triggers;
  }

  /**
   * Extract specific requirements from prompt
   */
  extractRequirements(prompt) {
    const requirements = [];
    
    // Look for explicit requirements
    const requirementPatterns = [
      /must\s+(.+?)(?=\.|\s*$)/gi,
      /need\s+to\s+(.+?)(?=\.|\s*$)/gi,
      /should\s+(.+?)(?=\.|\s*$)/gi,
      /require\s+(.+?)(?=\.|\s*$)/gi
    ];

    requirementPatterns.forEach(pattern => {
      const matches = prompt.match(pattern);
      if (matches) {
        requirements.push(...matches.map(m => m.trim()));
      }
    });

    return requirements;
  }

  /**
   * Identify constraints and limitations
   */
  identifyConstraints(prompt) {
    const constraints = [];
    
    // Look for constraint keywords
    const constraintPatterns = {
      'TIME': ['deadline', 'urgent', 'asap', 'immediately', 'quickly'],
      'QUALITY': ['high quality', 'production ready', 'enterprise grade'],
      'SECURITY': ['secure', 'safe', 'encrypted', 'authenticated'],
      'PERFORMANCE': ['fast', 'optimized', 'efficient', 'scalable'],
      'COMPATIBILITY': ['compatible', 'works with', 'supports'],
      'BUDGET': ['cost', 'budget', 'cheap', 'expensive', 'free']
    };

    const lowerPrompt = prompt.toLowerCase();
    
    for (const [constraint, patterns] of Object.entries(constraintPatterns)) {
      if (patterns.some(pattern => lowerPrompt.includes(pattern))) {
        constraints.push(constraint);
      }
    }

    return constraints;
  }

  /**
   * Identify technical domain
   */
  identifyDomain(prompt) {
    const domains = {
      'WEB_DEVELOPMENT': ['html', 'css', 'javascript', 'react', 'vue', 'angular'],
      'BACKEND': ['api', 'server', 'database', 'microservice', 'lambda'],
      'DEVOPS': ['docker', 'kubernetes', 'ci/cd', 'deploy', 'infrastructure'],
      'DATA': ['data', 'analytics', 'pipeline', 'etl', 'warehouse', 'ml'],
      'MOBILE': ['ios', 'android', 'mobile', 'app store', 'react native'],
      'SECURITY': ['security', 'auth', 'encryption', 'vulnerability', 'penetration'],
      'TESTING': ['test', 'qa', 'automation', 'coverage', 'integration'],
      'GENERAL': []
    };

    const lowerPrompt = prompt.toLowerCase();
    
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        return domain;
      }
    }

    return 'GENERAL';
  }

  /**
   * Assess risk level of the request
   */
  assessRisk(prompt) {
    const highRiskPatterns = [
      'production', 'deploy', 'delete', 'drop', 'remove', 'migrate',
      'live', 'public', 'release', 'publish', 'launch'
    ];

    const mediumRiskPatterns = [
      'modify', 'update', 'change', 'alter', 'refactor', 'restructure'
    ];

    const lowerPrompt = prompt.toLowerCase();

    if (highRiskPatterns.some(pattern => lowerPrompt.includes(pattern))) {
      return 'HIGH';
    } else if (mediumRiskPatterns.some(pattern => lowerPrompt.includes(pattern))) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * STEP 2: Determine task complexity based on analysis
   */
  determineComplexity(analysis) {
    log('  Analyzing task complexity...', 'cyan');
    
    let complexityScore = 0;
    const complexity = {
      level: 'SIMPLE',
      score: 0,
      factors: [],
      reasoning: []
    };

    // Factor 1: Multiple triggers indicate complexity
    if (analysis.triggers.length > 2) {
      complexityScore += 3;
      complexity.factors.push('MULTIPLE_TRIGGERS');
      complexity.reasoning.push(`${analysis.triggers.length} agent triggers found`);
    }

    // Factor 2: High-risk operations are complex
    if (analysis.riskLevel === 'HIGH') {
      complexityScore += 4;
      complexity.factors.push('HIGH_RISK');
      complexity.reasoning.push('High-risk operation detected');
    }

    // Factor 3: Cross-domain requirements
    if (analysis.keywords.length > 5) {
      complexityScore += 2;
      complexity.factors.push('CROSS_DOMAIN');
      complexity.reasoning.push('Multiple technical domains involved');
    }

    // Factor 4: Multiple requirements
    if (analysis.requirements.length > 3) {
      complexityScore += 2;
      complexity.factors.push('MULTIPLE_REQUIREMENTS');
      complexity.reasoning.push(`${analysis.requirements.length} specific requirements`);
    }

    // Factor 5: Multiple constraints
    if (analysis.constraints.length > 2) {
      complexityScore += 2;
      complexity.factors.push('CONSTRAINED');
      complexity.reasoning.push('Multiple constraints detected');
    }

    complexity.score = complexityScore;

    // Determine complexity level
    if (complexityScore >= 8) {
      complexity.level = 'VERY_COMPLEX';
    } else if (complexityScore >= 5) {
      complexity.level = 'COMPLEX';
    } else if (complexityScore >= 2) {
      complexity.level = 'MODERATE';
    } else {
      complexity.level = 'SIMPLE';
    }

    log(`  Complexity Level: ${complexity.level} (score: ${complexity.score})`, 'cyan');
    complexity.reasoning.forEach(reason => log(`    • ${reason}`, 'cyan'));

    return complexity;
  }

  /**
   * STEP 3: Select optimal agents based on analysis and complexity
   */
  selectAgents(analysis, complexity) {
    log('  Evaluating agent fitness...', 'cyan');
    
    const selection = {
      primary: null,
      secondary: [],
      chain: [],
      reasoning: []
    };

    // Agent fitness scores based on analysis
    const agentScores = {};
    
    for (const [agentName, agentDef] of Object.entries(this.agents)) {
      let score = 0;
      const reasons = [];

      // Check trigger word matches
      if (analysis.triggers.includes(agentName.toUpperCase().replace('-', '_'))) {
        score += 10;
        reasons.push('Direct trigger match');
      }

      // Check domain expertise
      if (agentDef.domains && agentDef.domains.includes(analysis.domain)) {
        score += 8;
        reasons.push('Domain expertise match');
      }

      // Check intent alignment
      if (agentDef.intents && agentDef.intents.includes(analysis.intent)) {
        score += 6;
        reasons.push('Intent alignment');
      }

      // Check complexity handling
      if (agentDef.complexity && agentDef.complexity.includes(complexity.level)) {
        score += 5;
        reasons.push('Complexity level match');
      }

      // Check risk handling
      if (agentDef.riskLevels && agentDef.riskLevels.includes(analysis.riskLevel)) {
        score += 4;
        reasons.push('Risk level handling');
      }

      agentScores[agentName] = { score, reasons };
    }

    // Sort agents by fitness score
    const sortedAgents = Object.entries(agentScores)
      .sort(([,a], [,b]) => b.score - a.score)
      .filter(([,data]) => data.score > 0);

    if (sortedAgents.length === 0) {
      // Fallback to general-purpose
      selection.primary = 'general-purpose';
      selection.reasoning.push('No specific agent match - using general-purpose');
    } else {
      selection.primary = sortedAgents[0][0];
      selection.reasoning.push(`Primary: ${selection.primary} (score: ${sortedAgents[0][1].score})`);
      selection.reasoning.push(`  Reasons: ${sortedAgents[0][1].reasons.join(', ')}`);

      // Select secondary agents if complexity warrants it
      if (complexity.level === 'COMPLEX' || complexity.level === 'VERY_COMPLEX') {
        selection.secondary = sortedAgents.slice(1, 3).map(([name]) => name);
        selection.reasoning.push(`Secondary: ${selection.secondary.join(', ')}`);
      }

      // Create agent chain for very complex tasks
      if (complexity.level === 'VERY_COMPLEX') {
        selection.chain = this.createAgentChain(analysis, sortedAgents);
        selection.reasoning.push(`Chain: ${selection.chain.join(' → ')}`);
      }
    }

    log(`  Primary Agent: ${selection.primary}`, 'cyan');
    if (selection.secondary.length > 0) {
      log(`  Secondary Agents: ${selection.secondary.join(', ')}`, 'cyan');
    }
    if (selection.chain.length > 0) {
      log(`  Execution Chain: ${selection.chain.join(' → ')}`, 'cyan');
    }

    return selection;
  }

  /**
   * Create optimal agent execution chain
   */
  createAgentChain(analysis, sortedAgents) {
    const chain = [];
    const agentNames = sortedAgents.map(([name]) => name);

    // Standard chains based on intent
    const chainPatterns = {
      'CREATE': ['project-manager-analyst', 'technical-architect-lead', 'quality-assurance-guardian'],
      'DEPLOY': ['quality-assurance-guardian', 'devops-deployment-engineer'],
      'FIX': ['general-purpose', 'technical-architect-lead', 'quality-assurance-guardian'],
      'COORDINATE': ['workflow-orchestrator', 'project-manager-analyst'],
      'ANALYZE': ['general-purpose', 'technical-architect-lead']
    };

    const pattern = chainPatterns[analysis.intent] || ['general-purpose'];
    
    // Filter pattern to only include available agents
    return pattern.filter(agent => agentNames.includes(agent));
  }

  /**
   * STEP 4: Create detailed execution plan
   */
  createExecutionPlan(analysis, agentSelection) {
    log('  Building execution plan...', 'cyan');
    
    const plan = {
      approach: this.determineApproach(analysis, agentSelection),
      phases: [],
      dependencies: [],
      riskMitigation: [],
      successCriteria: []
    };

    // Create phases based on complexity and agents
    if (agentSelection.chain.length > 0) {
      // Multi-agent chain execution
      plan.phases = agentSelection.chain.map((agent, index) => ({
        phase: index + 1,
        agent,
        objective: this.getAgentObjective(agent, analysis),
        dependencies: index > 0 ? [index] : [],
        deliverables: this.getAgentDeliverables(agent, analysis)
      }));
    } else {
      // Single agent with possible secondary support
      plan.phases = [{
        phase: 1,
        agent: agentSelection.primary,
        objective: this.getAgentObjective(agentSelection.primary, analysis),
        dependencies: [],
        deliverables: this.getAgentDeliverables(agentSelection.primary, analysis)
      }];

      // Add secondary agent phases if needed
      agentSelection.secondary.forEach((agent, index) => {
        plan.phases.push({
          phase: index + 2,
          agent,
          objective: this.getAgentObjective(agent, analysis),
          dependencies: [1],
          deliverables: this.getAgentDeliverables(agent, analysis)
        });
      });
    }

    // Add risk mitigation based on risk level
    if (analysis.riskLevel === 'HIGH') {
      plan.riskMitigation = [
        'Create rollback snapshots before changes',
        'Execute in staging environment first',
        'Implement comprehensive verification',
        'Require manual approval for deployment'
      ];
    }

    // Define success criteria
    plan.successCriteria = [
      'All phases complete successfully',
      'All verifications pass',
      'No constraint violations',
      'Complete audit trail maintained'
    ];

    log(`  Approach: ${plan.approach}`, 'cyan');
    log(`  Phases: ${plan.phases.length}`, 'cyan');
    log(`  Risk Mitigation: ${plan.riskMitigation.length} measures`, 'cyan');

    return plan;
  }

  /**
   * Determine execution approach based on complexity
   */
  determineApproach(analysis, agentSelection) {
    if (agentSelection.chain.length > 0) {
      return 'SEQUENTIAL_CHAIN';
    } else if (agentSelection.secondary.length > 0) {
      return 'PARALLEL_EXECUTION';
    } else {
      return 'SINGLE_AGENT';
    }
  }

  /**
   * Get objective for specific agent
   */
  getAgentObjective(agentName, analysis) {
    const objectives = {
      'workflow-orchestrator': 'Coordinate multi-agent execution',
      'quality-assurance-guardian': 'Ensure quality and test coverage',
      'project-manager-analyst': 'Break down requirements and plan',
      'technical-architect-lead': 'Design technical solution',
      'devops-deployment-engineer': 'Handle deployment and infrastructure',
      'data-pipeline-architect': 'Design and implement data flow',
      'general-purpose': 'Research and analyze requirements'
    };

    return objectives[agentName] || 'Execute assigned tasks';
  }

  /**
   * Get expected deliverables for agent
   */
  getAgentDeliverables(agentName, analysis) {
    const deliverables = {
      'workflow-orchestrator': ['Execution plan', 'Agent coordination', 'Result synthesis'],
      'quality-assurance-guardian': ['Test suite', 'Coverage report', 'Quality verification'],
      'project-manager-analyst': ['Requirements breakdown', 'Task list', 'Priority matrix'],
      'technical-architect-lead': ['Technical design', 'Architecture decisions', 'Implementation plan'],
      'devops-deployment-engineer': ['Deployment pipeline', 'Infrastructure setup', 'Monitoring'],
      'data-pipeline-architect': ['Data flow design', 'Pipeline implementation', 'Data validation'],
      'general-purpose': ['Research results', 'Analysis report', 'Recommendations']
    };

    return deliverables[agentName] || ['Task completion'];
  }

  /**
   * STEP 5: Generate verified instruction for execution
   */
  generateInstruction(executionPlan) {
    log('  Converting plan to verified instruction...', 'cyan');
    
    const instruction = {
      id: `decision-${this.currentSession}`,
      description: `Automated execution plan for session ${this.currentSession}`,
      steps: [],
      constraints: [],
      resources: { files: [], agents: [] },
      verification: { type: 'plan_execution' }
    };

    // Convert phases to executable steps
    executionPlan.phases.forEach((phase, index) => {
      const step = {
        id: `phase-${phase.phase}`,
        description: phase.objective,
        action: {
          type: 'agent_execution',
          agent: phase.agent,
          objective: phase.objective,
          deliverables: phase.deliverables
        },
        verification: {
          type: 'deliverables_complete',
          required: phase.deliverables
        },
        dependencies: phase.dependencies.map(dep => `phase-${dep}`)
      };

      instruction.steps.push(step);
    });

    // Add constraints based on risk level and requirements
    instruction.constraints = [
      { type: 'no_errors', description: 'Any error aborts execution' },
      { type: 'agent_verification', description: 'Each agent must verify deliverables' },
      { type: 'dependency_satisfaction', description: 'All dependencies must be met' }
    ];

    // Add risk mitigation constraints
    executionPlan.riskMitigation.forEach(mitigation => {
      instruction.constraints.push({
        type: 'risk_mitigation',
        description: mitigation
      });
    });

    log(`  Generated ${instruction.steps.length} executable steps`, 'cyan');
    log(`  Applied ${instruction.constraints.length} constraints`, 'cyan');

    return instruction;
  }

  /**
   * Update agent performance scores based on results
   */
  async updateAgentScores(agentSelection, result) {
    // This would update a learning system to improve future agent selection
    const update = {
      session: this.currentSession,
      primaryAgent: agentSelection.primary,
      secondaryAgents: agentSelection.secondary,
      success: result.success,
      timestamp: new Date().toISOString()
    };

    // Store in database for machine learning
    await this.saveAgentPerformance(update);
  }

  /**
   * Save agent performance data
   */
  async saveAgentPerformance(update) {
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.run(`
        INSERT OR IGNORE INTO agent_performance 
        (session_id, primary_agent, secondary_agents, success, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `, [
        update.session,
        update.primaryAgent,
        JSON.stringify(update.secondaryAgents),
        update.success ? 1 : 0,
        update.timestamp
      ], (err) => {
        db.close();
        resolve();
      });
    });
  }

  /**
   * Save complete decision history
   */
  async saveDecisionHistory(decision) {
    this.decisionHistory.push(decision);
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.run(`
        INSERT OR IGNORE INTO decision_history 
        (session_id, prompt, decision_data, timestamp)
        VALUES (?, ?, ?, ?)
      `, [
        decision.sessionId,
        decision.prompt,
        JSON.stringify(decision),
        decision.timestamp
      ], (err) => {
        db.close();
        resolve();
      });
    });
  }

  /**
   * Log decision step
   */
  logDecision(event, data) {
    log(`    ✓ ${event}`, 'green');
  }

  /**
   * Show final decision summary
   */
  showDecisionSummary(decision) {
    log('\n📊 DECISION SUMMARY', 'bold');
    log('=' .repeat(70), 'blue');
    
    const lastStep = decision.steps[decision.steps.length - 1];
    const success = lastStep.result.success;
    
    log(`Session: ${decision.sessionId}`, 'cyan');
    log(`Result: ${success ? '✅ SUCCESS' : '❌ FAILURE'}`, success ? 'green' : 'red');
    log(`Steps Completed: ${decision.steps.length}`, 'cyan');
    log(`Execution Time: ${new Date().toISOString()}`, 'cyan');
    
    if (success && lastStep.result.hashChain) {
      log(`Verification Hash: ${lastStep.result.hashChain[lastStep.result.hashChain.length - 1]}`, 'cyan');
    }

    log('\nDecision Flow:', 'cyan');
    decision.steps.forEach((step, index) => {
      const status = step.result.success !== false ? '✅' : '❌';
      log(`  ${index + 1}. ${step.step.toUpperCase()}: ${status}`, 'cyan');
    });

    log('=' .repeat(70), 'blue');
  }

  /**
   * Load agent definitions from CLAUDE.md
   */
  loadAgentDefinitions() {
    const claudePath = path.join(__dirname, '..', 'CLAUDE.md');
    
    // This would parse the CLAUDE.md file to extract agent definitions
    // For now, returning hardcoded definitions based on the CLAUDE.md structure
    
    return {
      'workflow-orchestrator': {
        domains: ['GENERAL', 'COORDINATION'],
        intents: ['COORDINATE', 'CREATE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        triggers: ['build entire', 'coordinate', 'multi-component']
      },
      'quality-assurance-guardian': {
        domains: ['TESTING', 'QUALITY'],
        intents: ['TEST', 'VERIFY'],
        complexity: ['MODERATE', 'COMPLEX'],
        riskLevels: ['HIGH'],
        triggers: ['test', 'verify', 'quality', 'coverage']
      },
      'project-manager-analyst': {
        domains: ['PLANNING', 'ANALYSIS'],
        intents: ['ANALYZE', 'COORDINATE'],
        complexity: ['MODERATE', 'COMPLEX'],
        riskLevels: ['LOW', 'MEDIUM'],
        triggers: ['plan', 'requirements', 'break down']
      },
      'technical-architect-lead': {
        domains: ['ARCHITECTURE', 'DESIGN'],
        intents: ['CREATE', 'ANALYZE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        triggers: ['architecture', 'design', 'technical']
      },
      'devops-deployment-engineer': {
        domains: ['DEVOPS', 'INFRASTRUCTURE'],
        intents: ['DEPLOY', 'CREATE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['HIGH'],
        triggers: ['deploy', 'infrastructure', 'ci/cd']
      },
      'data-pipeline-architect': {
        domains: ['DATA', 'PIPELINE'],
        intents: ['CREATE', 'ANALYZE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        triggers: ['pipeline', 'etl', 'data']
      },
      'general-purpose': {
        domains: ['GENERAL'],
        intents: ['ANALYZE', 'GENERAL'],
        complexity: ['SIMPLE', 'MODERATE'],
        riskLevels: ['LOW'],
        triggers: ['search', 'find', 'analyze']
      }
    };
  }
}

// Export for use in other modules
module.exports = { DecisionEngine };

// CLI interface
if (require.main === module) {
  const engine = new DecisionEngine();
  const prompt = process.argv.slice(2).join(' ') || 'Create a deployment pipeline for a Node.js application';
  
  log('\n🎯 TESTING DECISION ENGINE', 'bold');
  log(`Processing: "${prompt}"`, 'cyan');
  
  engine.processPrompt(prompt).then(result => {
    if (result.success) {
      log('\n✅ Decision engine completed successfully!', 'green');
      process.exit(0);
    } else {
      log('\n❌ Decision engine failed!', 'red');
      process.exit(1);
    }
  }).catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}
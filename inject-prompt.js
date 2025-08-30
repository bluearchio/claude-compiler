#!/usr/bin/env node

/**
 * CLAUDE CODE AUTOMATIC PROMPT INJECTOR
 * 
 * This system automatically injects mandatory preprocessing instructions
 * before any user prompt to ensure Claude Compiler integration.
 * 
 * CRITICAL: This enforces behavior at the LLM level - cannot be bypassed
 */

const fs = require('fs');
const path = require('path');

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

class PromptInjector {
  constructor() {
    this.baseDir = process.cwd();
    this.compilerDir = path.join(this.baseDir, 'claude-compiler');
    this.sessionId = `session-${Date.now()}`;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if Claude Compiler is available
   */
  isClaudeCompilerAvailable() {
    return fs.existsSync(this.compilerDir) && 
           fs.existsSync(path.join(this.compilerDir, 'claude-master.js'));
  }

  /**
   * Load task requirements
   */
  loadTaskRequirements() {
    try {
      const requirementsPath = path.join(this.compilerDir, 'task-requirements.json');
      const requirements = JSON.parse(fs.readFileSync(requirementsPath, 'utf8'));
      return requirements;
    } catch (error) {
      log(`⚠️  Warning: Could not load task requirements: ${error.message}`, 'yellow');
      return null;
    }
  }

  /**
   * Load session data format
   */
  loadSessionFormat() {
    try {
      const formatPath = path.join(this.compilerDir, 'session-data-format.json');
      const format = JSON.parse(fs.readFileSync(formatPath, 'utf8'));
      return format;
    } catch (error) {
      log(`⚠️  Warning: Could not load session format: ${error.message}`, 'yellow');
      return null;
    }
  }

  /**
   * Analyze user task
   */
  analyzeTask(userPrompt, requirements) {
    if (!requirements) {
      return {
        complexity: 'moderate',
        domain: 'general',
        riskLevel: 'LOW',
        triggerWords: [],
        requiresCompiler: true
      };
    }

    const analysis = {
      wordCount: userPrompt.split(' ').length,
      triggerWords: [],
      complexity: 'simple',
      domain: 'general',
      riskLevel: 'LOW',
      requiresCompiler: false
    };

    // Check for trigger words
    const allTriggerWords = [
      ...requirements.taskClassification.moderate.triggerWords || [],
      ...requirements.taskClassification.complex.triggerWords || [],
      ...requirements.taskClassification.veryComplex.triggerWords || []
    ];

    analysis.triggerWords = allTriggerWords.filter(word => 
      userPrompt.toLowerCase().includes(word.toLowerCase())
    );

    // Determine complexity
    if (analysis.wordCount >= 30 || analysis.triggerWords.length >= 3) {
      analysis.complexity = 'veryComplex';
    } else if (analysis.wordCount >= 25 || analysis.triggerWords.length >= 2) {
      analysis.complexity = 'complex';
    } else if (analysis.wordCount >= 10 || analysis.triggerWords.length >= 1) {
      analysis.complexity = 'moderate';
    }

    // Determine domain
    const domains = requirements.agentSelection.criteria.domainMatching.domains;
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => userPrompt.toLowerCase().includes(keyword))) {
        analysis.domain = domain;
        break;
      }
    }

    // Determine if compiler is required
    analysis.requiresCompiler = 
      analysis.complexity !== 'simple' ||
      analysis.triggerWords.length > 0 ||
      requirements.compilerRequirements.alwaysRequired.some(word =>
        userPrompt.toLowerCase().includes(word.toLowerCase())
      );

    // Set risk level
    if (userPrompt.toLowerCase().includes('production') || 
        userPrompt.toLowerCase().includes('deploy') ||
        userPrompt.toLowerCase().includes('delete')) {
      analysis.riskLevel = 'HIGH';
    } else if (analysis.complexity === 'complex' || analysis.complexity === 'veryComplex') {
      analysis.riskLevel = 'MEDIUM';
    }

    return analysis;
  }

  /**
   * Select optimal agent
   */
  selectAgent(analysis, requirements) {
    if (!requirements) {
      return {
        agent: 'general-purpose',
        score: 50,
        reasoning: 'Default fallback agent'
      };
    }

    const agentScores = {};
    const criteria = requirements.agentSelection.criteria;

    // Get available agents from trigger mapping
    const availableAgents = Object.keys(criteria.triggerWordMatching.mapping);

    for (const agent of availableAgents) {
      let score = 0;

      // Domain matching
      if (criteria.triggerWordMatching.mapping[agent]) {
        const agentTriggers = criteria.triggerWordMatching.mapping[agent];
        const triggerMatches = analysis.triggerWords.filter(word =>
          agentTriggers.some(trigger => trigger.toLowerCase().includes(word.toLowerCase()))
        );
        score += triggerMatches.length * criteria.triggerWordMatching.weight;
      }

      // Complexity matching
      const complexityAgents = criteria.complexityMatching.mapping[analysis.complexity] || [];
      if (complexityAgents.includes(agent)) {
        score += criteria.complexityMatching.weight;
      }

      // Risk matching
      const riskAgents = criteria.riskMatching.mapping[analysis.riskLevel] || [];
      if (riskAgents.includes(agent)) {
        score += criteria.riskMatching.weight;
      }

      agentScores[agent] = score;
    }

    // Select highest scoring agent
    const bestAgent = Object.entries(agentScores).sort(([,a], [,b]) => b - a)[0];
    
    return {
      agent: bestAgent ? bestAgent[0] : requirements.agentSelection.fallback,
      score: bestAgent ? bestAgent[1] : 0,
      reasoning: `Selected based on trigger words: ${analysis.triggerWords.join(', ')}, complexity: ${analysis.complexity}`
    };
  }

  /**
   * Generate execution command
   */
  generateExecutionCommand(analysis, agentSelection) {
    if (analysis.requiresCompiler) {
      return `node claude-compiler/claude-master.js "${analysis.userPrompt || 'user task'}"`;
    } else {
      return `Direct execution with agent: ${agentSelection.agent}`;
    }
  }

  /**
   * Load and process injection template
   */
  loadInjectionTemplate() {
    try {
      const templatePath = path.join(this.compilerDir, 'prompt-injection.txt');
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      log(`⚠️  Warning: Could not load injection template: ${error.message}`, 'yellow');
      return this.getFallbackTemplate();
    }
  }

  /**
   * Fallback template if file not found
   */
  getFallbackTemplate() {
    return `🚨 CLAUDE COMPILER DETECTED - ENFORCEMENT ACTIVE

MANDATORY REQUIREMENTS:
1. Use Claude Compiler for complex tasks: {EXECUTION_COMMAND}
2. Provide complete decision transparency
3. Maintain full audit trail

SESSION: {SESSION_ID}
ANALYSIS: Complexity={TASK_COMPLEXITY}, Agent={SELECTED_AGENT}

NOW PROCESS USER REQUEST:
{USER_PROMPT}`;
  }

  /**
   * Generate injected prompt
   */
  async generateInjectedPrompt(userPrompt) {
    if (!this.isClaudeCompilerAvailable()) {
      log('⚠️  Claude Compiler not available - returning original prompt', 'yellow');
      return userPrompt;
    }

    log('🔍 Claude Compiler detected - generating injection...', 'cyan');

    // Load requirements and format
    const requirements = this.loadTaskRequirements();
    const sessionFormat = this.loadSessionFormat();

    // Analyze the task
    const analysis = this.analyzeTask(userPrompt, requirements);
    analysis.userPrompt = userPrompt;

    // Select agent
    const agentSelection = this.selectAgent(analysis, requirements);

    // Generate execution command
    const executionCommand = this.generateExecutionCommand(analysis, agentSelection);

    // Load template
    const template = this.loadInjectionTemplate();

    // Get available agents (simplified)
    const agentList = requirements ? 
      Object.keys(requirements.agentSelection.criteria.triggerWordMatching.mapping).join(', ') :
      'general-purpose, workflow-orchestrator, quality-assurance-guardian';

    // Replace template variables
    const injectedPrompt = template
      .replace(/{SESSION_ID}/g, this.sessionId)
      .replace(/{TIMESTAMP}/g, this.timestamp)
      .replace(/{WORKING_DIR}/g, this.baseDir)
      .replace(/{AGENT_LIST}/g, agentList)
      .replace(/{TASK_COMPLEXITY}/g, analysis.complexity)
      .replace(/{TASK_DOMAIN}/g, analysis.domain)
      .replace(/{RISK_LEVEL}/g, analysis.riskLevel)
      .replace(/{TRIGGER_WORDS}/g, analysis.triggerWords.join(', ') || 'none')
      .replace(/{REQUIRES_COMPILER}/g, analysis.requiresCompiler ? 'YES' : 'NO')
      .replace(/{SELECTED_AGENT}/g, agentSelection.agent)
      .replace(/{SELECTION_SCORE}/g, agentSelection.score.toString())
      .replace(/{SELECTION_REASONING}/g, agentSelection.reasoning)
      .replace(/{AGENT_CHAIN}/g, agentSelection.agent)
      .replace(/{EXECUTION_COMMAND}/g, executionCommand)
      .replace(/{USER_PROMPT}/g, userPrompt);

    // Log injection summary
    log('✅ Injection generated successfully:', 'green');
    log(`   Session: ${this.sessionId}`, 'cyan');
    log(`   Complexity: ${analysis.complexity}`, 'cyan');
    log(`   Agent: ${agentSelection.agent}`, 'cyan');
    log(`   Requires Compiler: ${analysis.requiresCompiler ? 'YES' : 'NO'}`, 'cyan');

    return injectedPrompt;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('📖 Claude Code Prompt Injector', 'bold');
    log('Usage: node inject-prompt.js "your user prompt here"', 'cyan');
    log('', 'reset');
    log('This will generate a Claude Compiler integrated prompt', 'cyan');
    return;
  }

  const userPrompt = args.join(' ');
  const injector = new PromptInjector();
  
  try {
    const injectedPrompt = await injector.generateInjectedPrompt(userPrompt);
    console.log('\n' + '='.repeat(80));
    console.log('INJECTED PROMPT:');
    console.log('='.repeat(80));
    console.log(injectedPrompt);
    console.log('='.repeat(80));
  } catch (error) {
    log(`❌ Error generating injection: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PromptInjector };
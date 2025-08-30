#!/usr/bin/env node

/**
 * CLAUDE CODE AUTOMATIC AGENT SELECTOR
 * 
 * Intelligently selects the optimal agent based on task analysis
 * and predefined criteria. Works with the prompt injection system.
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

class AgentAutoSelector {
  constructor() {
    this.compilerDir = path.join(process.cwd(), 'claude-compiler');
    this.requirements = this.loadRequirements();
    this.availableAgents = this.discoverAvailableAgents();
  }

  /**
   * Load task requirements
   */
  loadRequirements() {
    try {
      const requirementsPath = path.join(this.compilerDir, 'task-requirements.json');
      return JSON.parse(fs.readFileSync(requirementsPath, 'utf8'));
    } catch (error) {
      log(`⚠️  Could not load requirements: ${error.message}`, 'yellow');
      return this.getDefaultRequirements();
    }
  }

  /**
   * Discover available agents
   */
  discoverAvailableAgents() {
    const agentsDir = path.join(this.compilerDir, 'agents');
    const agents = ['general-purpose']; // Always available

    try {
      if (fs.existsSync(agentsDir)) {
        const agentFiles = fs.readdirSync(agentsDir)
          .filter(file => file.endsWith('.js'))
          .map(file => path.basename(file, '.js'));
        agents.push(...agentFiles);
      }

      // Add known agents from requirements
      if (this.requirements && this.requirements.agentSelection) {
        const requiredAgents = Object.keys(
          this.requirements.agentSelection.criteria.triggerWordMatching.mapping
        );
        requiredAgents.forEach(agent => {
          if (!agents.includes(agent)) {
            agents.push(agent);
          }
        });
      }
    } catch (error) {
      log(`⚠️  Could not discover agents: ${error.message}`, 'yellow');
    }

    return agents;
  }

  /**
   * Get default requirements if file not found
   */
  getDefaultRequirements() {
    return {
      agentSelection: {
        criteria: {
          domainMatching: {
            weight: 30,
            domains: {
              web_development: ['html', 'css', 'javascript', 'react'],
              backend: ['api', 'server', 'database'],
              devops: ['deploy', 'docker', 'infrastructure'],
              testing: ['test', 'qa', 'verify'],
              data: ['pipeline', 'etl', 'analytics']
            }
          },
          triggerWordMatching: {
            weight: 35,
            mapping: {
              'workflow-orchestrator': ['coordinate', 'orchestrate', 'workflow'],
              'quality-assurance-guardian': ['test', 'verify', 'validate'],
              'technical-architect-lead': ['architecture', 'design', 'structure'],
              'devops-deployment-engineer': ['deploy', 'infrastructure', 'production'],
              'data-pipeline-architect': ['pipeline', 'etl', 'data'],
              'general-purpose': ['analyze', 'search', 'find']
            }
          },
          complexityMatching: {
            weight: 25,
            mapping: {
              simple: ['general-purpose'],
              moderate: ['workflow-orchestrator', 'quality-assurance-guardian'],
              complex: ['workflow-orchestrator', 'technical-architect-lead'],
              veryComplex: ['technical-architect-lead', 'devops-deployment-engineer']
            }
          },
          riskMatching: {
            weight: 10,
            mapping: {
              LOW: ['general-purpose', 'quality-assurance-guardian'],
              MEDIUM: ['workflow-orchestrator', 'technical-architect-lead'],
              HIGH: ['technical-architect-lead', 'devops-deployment-engineer']
            }
          }
        },
        fallback: 'general-purpose'
      }
    };
  }

  /**
   * Analyze task to extract characteristics
   */
  analyzeTask(userPrompt) {
    const words = userPrompt.toLowerCase().split(/\s+/);
    const wordCount = words.length;

    // Extract trigger words
    const allTriggers = new Set();
    if (this.requirements.agentSelection) {
      Object.values(this.requirements.agentSelection.criteria.triggerWordMatching.mapping)
        .flat()
        .forEach(trigger => allTriggers.add(trigger.toLowerCase()));
    }

    const triggerWords = words.filter(word => allTriggers.has(word));

    // Determine complexity
    let complexity = 'simple';
    if (wordCount > 30 || triggerWords.length >= 3) {
      complexity = 'veryComplex';
    } else if (wordCount > 25 || triggerWords.length >= 2) {
      complexity = 'complex';
    } else if (wordCount > 10 || triggerWords.length >= 1) {
      complexity = 'moderate';
    }

    // Determine domain
    let domain = 'general';
    const domains = this.requirements.agentSelection.criteria.domainMatching.domains;
    for (const [domainName, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => userPrompt.toLowerCase().includes(keyword))) {
        domain = domainName;
        break;
      }
    }

    // Determine risk level
    let riskLevel = 'LOW';
    const highRiskWords = ['production', 'deploy', 'delete', 'drop', 'remove'];
    const mediumRiskWords = ['modify', 'update', 'change', 'alter', 'migrate'];
    
    if (highRiskWords.some(word => userPrompt.toLowerCase().includes(word))) {
      riskLevel = 'HIGH';
    } else if (mediumRiskWords.some(word => userPrompt.toLowerCase().includes(word))) {
      riskLevel = 'MEDIUM';
    }

    return {
      userPrompt,
      wordCount,
      triggerWords,
      complexity,
      domain,
      riskLevel
    };
  }

  /**
   * Calculate agent fitness scores
   */
  calculateAgentScores(analysis) {
    const scores = {};
    const criteria = this.requirements.agentSelection.criteria;

    for (const agent of this.availableAgents) {
      let score = 0;
      const breakdown = {
        domain: 0,
        triggers: 0,
        complexity: 0,
        risk: 0
      };

      // Domain matching score
      if (criteria.domainMatching.domains[analysis.domain]) {
        const domainKeywords = criteria.domainMatching.domains[analysis.domain];
        const domainMatches = domainKeywords.filter(keyword =>
          analysis.userPrompt.toLowerCase().includes(keyword)
        ).length;
        if (domainMatches > 0) {
          breakdown.domain = domainMatches * (criteria.domainMatching.weight / domainKeywords.length);
        }
      }

      // Trigger word matching score
      if (criteria.triggerWordMatching.mapping[agent]) {
        const agentTriggers = criteria.triggerWordMatching.mapping[agent];
        const triggerMatches = analysis.triggerWords.filter(word =>
          agentTriggers.some(trigger => trigger.toLowerCase().includes(word.toLowerCase()))
        ).length;
        if (triggerMatches > 0) {
          breakdown.triggers = triggerMatches * (criteria.triggerWordMatching.weight / agentTriggers.length);
        }
      }

      // Complexity matching score
      const complexityAgents = criteria.complexityMatching.mapping[analysis.complexity] || [];
      if (complexityAgents.includes(agent)) {
        breakdown.complexity = criteria.complexityMatching.weight;
      }

      // Risk matching score
      const riskAgents = criteria.riskMatching.mapping[analysis.riskLevel] || [];
      if (riskAgents.includes(agent)) {
        breakdown.risk = criteria.riskMatching.weight;
      }

      score = breakdown.domain + breakdown.triggers + breakdown.complexity + breakdown.risk;
      scores[agent] = { score, breakdown };
    }

    return scores;
  }

  /**
   * Select optimal agent with reasoning
   */
  selectOptimalAgent(userPrompt) {
    log('🔍 Analyzing task for optimal agent selection...', 'cyan');

    const analysis = this.analyzeTask(userPrompt);
    const scores = this.calculateAgentScores(analysis);

    // Sort agents by score
    const rankedAgents = Object.entries(scores)
      .sort(([,a], [,b]) => b.score - a.score);

    const topAgent = rankedAgents[0];
    const selectedAgent = topAgent[0];
    const agentScore = topAgent[1];

    // Generate reasoning
    const reasoning = this.generateSelectionReasoning(analysis, selectedAgent, agentScore, rankedAgents);

    // Check if multi-agent chain is needed
    const needsMultiAgent = this.assessMultiAgentNeed(analysis, scores);

    const result = {
      analysis,
      selectedAgent,
      score: agentScore.score,
      breakdown: agentScore.breakdown,
      reasoning,
      alternativeAgents: rankedAgents.slice(1, 4).map(([name, data]) => ({
        agent: name,
        score: data.score,
        breakdown: data.breakdown
      })),
      multiAgent: needsMultiAgent,
      agentChain: needsMultiAgent ? this.generateAgentChain(analysis, rankedAgents) : [selectedAgent]
    };

    return result;
  }

  /**
   * Generate human-readable selection reasoning
   */
  generateSelectionReasoning(analysis, selectedAgent, agentScore, rankedAgents) {
    const reasons = [];

    if (agentScore.breakdown.triggers > 0) {
      reasons.push(`Strong trigger word match (${agentScore.breakdown.triggers} points)`);
    }

    if (agentScore.breakdown.domain > 0) {
      reasons.push(`Domain expertise in ${analysis.domain} (${agentScore.breakdown.domain} points)`);
    }

    if (agentScore.breakdown.complexity > 0) {
      reasons.push(`Suitable for ${analysis.complexity} complexity (${agentScore.breakdown.complexity} points)`);
    }

    if (agentScore.breakdown.risk > 0) {
      reasons.push(`Appropriate for ${analysis.riskLevel} risk level (${agentScore.breakdown.risk} points)`);
    }

    if (reasons.length === 0) {
      reasons.push('Fallback selection - no strong matches found');
    }

    return reasons.join('; ');
  }

  /**
   * Assess if multi-agent coordination is needed
   */
  assessMultiAgentNeed(analysis, scores) {
    const threshold = this.requirements.agentSelection.multiAgentThreshold;
    
    return analysis.complexity === 'veryComplex' ||
           analysis.complexity === 'complex' ||
           analysis.wordCount > threshold.wordCount ||
           analysis.triggerWords.length >= threshold.triggerCount;
  }

  /**
   * Generate multi-agent chain
   */
  generateAgentChain(analysis, rankedAgents) {
    const chain = [];
    const topAgents = rankedAgents.slice(0, 3);

    // Always start with primary agent
    chain.push(topAgents[0][0]);

    // Add quality assurance for complex tasks
    if (analysis.complexity !== 'simple' && 
        this.availableAgents.includes('quality-assurance-guardian')) {
      chain.push('quality-assurance-guardian');
    }

    // Add orchestrator for very complex tasks
    if (analysis.complexity === 'veryComplex' && 
        this.availableAgents.includes('workflow-orchestrator')) {
      if (!chain.includes('workflow-orchestrator')) {
        chain.unshift('workflow-orchestrator'); // Add at beginning
      }
    }

    return chain;
  }

  /**
   * Display selection results
   */
  displayResults(result) {
    log('\n📊 AGENT SELECTION RESULTS', 'bold');
    log('=' .repeat(50), 'blue');
    log(`Selected Agent: ${result.selectedAgent}`, 'green');
    log(`Selection Score: ${result.score}`, 'cyan');
    log(`Reasoning: ${result.reasoning}`, 'cyan');
    
    if (result.multiAgent) {
      log(`Agent Chain: ${result.agentChain.join(' → ')}`, 'yellow');
    }

    log('\n📋 Task Analysis:', 'bold');
    log(`  Complexity: ${result.analysis.complexity}`, 'cyan');
    log(`  Domain: ${result.analysis.domain}`, 'cyan');
    log(`  Risk Level: ${result.analysis.riskLevel}`, 'cyan');
    log(`  Trigger Words: ${result.analysis.triggerWords.join(', ') || 'none'}`, 'cyan');

    log('\n🎯 Score Breakdown:', 'bold');
    log(`  Domain Match: ${result.breakdown.domain}`, 'cyan');
    log(`  Trigger Words: ${result.breakdown.triggers}`, 'cyan');
    log(`  Complexity: ${result.breakdown.complexity}`, 'cyan');
    log(`  Risk Level: ${result.breakdown.risk}`, 'cyan');

    if (result.alternativeAgents.length > 0) {
      log('\n🔄 Alternative Agents:', 'bold');
      result.alternativeAgents.forEach(alt => {
        log(`  ${alt.agent}: ${alt.score} points`, 'yellow');
      });
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('📖 Claude Code Agent Auto-Selector', 'bold');
    log('Usage: node auto-select-agent.js "your task description here"', 'cyan');
    log('\nThis will analyze the task and select the optimal agent', 'cyan');
    return;
  }

  const userPrompt = args.join(' ');
  const selector = new AgentAutoSelector();
  
  try {
    const result = selector.selectOptimalAgent(userPrompt);
    selector.displayResults(result);
    
    // Return result as JSON for programmatic use
    if (process.env.OUTPUT_JSON === 'true') {
      console.log('\nJSON_OUTPUT:');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    log(`❌ Error selecting agent: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { AgentAutoSelector };
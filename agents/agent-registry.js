#!/usr/bin/env node

/**
 * Agent Registry - Complete Agent Management System
 * 
 * MANAGES ALL AGENTS: Loading, Selection, Execution, Performance Tracking
 * This is the SINGLE SOURCE OF TRUTH for all agent definitions and capabilities
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.agentPerformance = new Map();
    this.loadAgentDefinitions();
  }

  /**
   * Load all agent definitions from CLAUDE.md
   */
  loadAgentDefinitions() {
    const claudePath = path.join(__dirname, '..', 'CLAUDE.md');
    
    // Parse CLAUDE.md to extract agent definitions
    if (fs.existsSync(claudePath)) {
      const content = fs.readFileSync(claudePath, 'utf8');
      this.parseAgentDefinitions(content);
    }

    // Fallback to hardcoded definitions if parsing fails
    if (this.agents.size === 0) {
      this.loadFallbackDefinitions();
    }

    console.log(`✅ Loaded ${this.agents.size} agents`);
  }

  /**
   * Parse CLAUDE.md file to extract agent definitions
   */
  parseAgentDefinitions(content) {
    const lines = content.split('\n');
    let currentAgent = null;
    let inAgentSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect agent section start
      if (line.includes('#### `') && line.includes('`')) {
        const match = line.match(/#### `([^`]+)`/);
        if (match) {
          currentAgent = {
            name: match[1],
            description: '',
            argumentativeStance: '',
            chainExample: '',
            triggers: [],
            domains: [],
            intents: [],
            complexity: [],
            riskLevels: [],
            tools: ['*'], // Default to all tools
            proactiveUse: false
          };
          inAgentSection = true;
        }
      }

      // Parse agent details
      if (inAgentSection && currentAgent) {
        if (line.startsWith('**Description**:')) {
          currentAgent.description = line.replace('**Description**:', '').trim();
        } else if (line.startsWith('**Argumentative Stance**:')) {
          currentAgent.argumentativeStance = line.replace('**Argumentative Stance**:', '').trim();
        } else if (line.startsWith('**Chain Example**:')) {
          currentAgent.chainExample = line.replace('**Chain Example**:', '').trim();
        } else if (line.startsWith('**Triggers**:')) {
          const triggers = line.replace('**Triggers**:', '').trim();
          currentAgent.triggers = triggers.split(',').map(t => t.trim().replace(/"/g, ''));
        } else if (line.includes('PROACTIVE') || line.includes('MUST BE USED')) {
          currentAgent.proactiveUse = true;
        }

        // End of agent section
        if (line.startsWith('#### ') && !line.includes(currentAgent.name)) {
          this.agents.set(currentAgent.name, currentAgent);
          currentAgent = null;
          inAgentSection = false;
        }
      }
    }

    // Add last agent if exists
    if (currentAgent) {
      this.agents.set(currentAgent.name, currentAgent);
    }

    // Enhance with additional metadata
    this.enhanceAgentDefinitions();
  }

  /**
   * Enhance agent definitions with additional metadata
   */
  enhanceAgentDefinitions() {
    const enhancements = {
      'workflow-orchestrator': {
        domains: ['COORDINATION', 'ORCHESTRATION', 'MULTI_AGENT'],
        intents: ['COORDINATE', 'ORCHESTRATE', 'MANAGE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        priority: 10
      },
      'quality-assurance-guardian': {
        domains: ['TESTING', 'QUALITY', 'VERIFICATION'],
        intents: ['TEST', 'VERIFY', 'VALIDATE'],
        complexity: ['MODERATE', 'COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['HIGH'],
        priority: 9
      },
      'project-manager-analyst': {
        domains: ['PLANNING', 'ANALYSIS', 'REQUIREMENTS'],
        intents: ['ANALYZE', 'PLAN', 'ORGANIZE'],
        complexity: ['MODERATE', 'COMPLEX'],
        riskLevels: ['LOW', 'MEDIUM'],
        priority: 8
      },
      'technical-architect-lead': {
        domains: ['ARCHITECTURE', 'DESIGN', 'TECHNICAL'],
        intents: ['DESIGN', 'ARCHITECT', 'CREATE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        priority: 8
      },
      'devops-deployment-engineer': {
        domains: ['DEVOPS', 'DEPLOYMENT', 'INFRASTRUCTURE'],
        intents: ['DEPLOY', 'RELEASE', 'INFRASTRUCTURE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['HIGH'],
        priority: 7
      },
      'data-pipeline-architect': {
        domains: ['DATA', 'PIPELINE', 'ETL'],
        intents: ['CREATE', 'TRANSFORM', 'PROCESS'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        priority: 6
      },
      'general-purpose': {
        domains: ['GENERAL', 'RESEARCH', 'SEARCH'],
        intents: ['SEARCH', 'ANALYZE', 'RESEARCH'],
        complexity: ['SIMPLE', 'MODERATE'],
        riskLevels: ['LOW'],
        priority: 3
      }
    };

    for (const [agentName, enhancement] of Object.entries(enhancements)) {
      const agent = this.agents.get(agentName);
      if (agent) {
        Object.assign(agent, enhancement);
      }
    }
  }

  /**
   * Load fallback agent definitions
   */
  loadFallbackDefinitions() {
    const fallbackAgents = {
      'workflow-orchestrator': {
        name: 'workflow-orchestrator',
        description: 'Coordinates multi-component tasks requiring multiple agents',
        argumentativeStance: 'Will reject poorly defined workflows and demand clear acceptance criteria',
        triggers: ['build entire', 'full system', 'coordinate', 'orchestrate'],
        domains: ['COORDINATION', 'ORCHESTRATION'],
        intents: ['COORDINATE', 'CREATE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        proactiveUse: true,
        priority: 10
      },
      'quality-assurance-guardian': {
        name: 'quality-assurance-guardian',
        description: 'Handles testing, verification, and quality assurance',
        argumentativeStance: 'Will refuse to approve code with <80% coverage or security vulnerabilities',
        triggers: ['test', 'verify', 'validate', 'quality', 'coverage'],
        domains: ['TESTING', 'QUALITY'],
        intents: ['TEST', 'VERIFY'],
        complexity: ['MODERATE', 'COMPLEX'],
        riskLevels: ['HIGH'],
        proactiveUse: true,
        priority: 9
      },
      'project-manager-analyst': {
        name: 'project-manager-analyst',
        description: 'Breaks down requirements into actionable tasks',
        argumentativeStance: 'Will challenge vague requirements and demand specific success criteria',
        triggers: ['plan', 'organize', 'break down', 'requirements'],
        domains: ['PLANNING', 'ANALYSIS'],
        intents: ['ANALYZE', 'PLAN'],
        complexity: ['MODERATE', 'COMPLEX'],
        riskLevels: ['LOW', 'MEDIUM'],
        proactiveUse: true,
        priority: 8
      },
      'technical-architect-lead': {
        name: 'technical-architect-lead',
        description: 'Handles system design and architecture decisions',
        argumentativeStance: 'Will strongly oppose quick fixes that increase technical debt',
        triggers: ['architecture', 'design', 'structure', 'technical'],
        domains: ['ARCHITECTURE', 'DESIGN'],
        intents: ['DESIGN', 'CREATE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        proactiveUse: true,
        priority: 8
      },
      'devops-deployment-engineer': {
        name: 'devops-deployment-engineer',
        description: 'Handles deployment, CI/CD, and infrastructure',
        argumentativeStance: 'Will refuse deployments without passing tests and proper rollback plans',
        triggers: ['deploy', 'release', 'ci/cd', 'infrastructure'],
        domains: ['DEVOPS', 'DEPLOYMENT'],
        intents: ['DEPLOY', 'RELEASE'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['HIGH'],
        proactiveUse: true,
        priority: 7
      },
      'data-pipeline-architect': {
        name: 'data-pipeline-architect',
        description: 'Designs and reviews data pipelines and ETL processes',
        argumentativeStance: 'Will challenge designs lacking error handling and data validation',
        triggers: ['pipeline', 'etl', 'data processing', 'transform'],
        domains: ['DATA', 'PIPELINE'],
        intents: ['CREATE', 'PROCESS'],
        complexity: ['COMPLEX', 'VERY_COMPLEX'],
        riskLevels: ['MEDIUM', 'HIGH'],
        proactiveUse: true,
        priority: 6
      },
      'general-purpose': {
        name: 'general-purpose',
        description: 'Handles code search and research tasks',
        argumentativeStance: 'Will question search requests that are too broad or poorly defined',
        triggers: ['search', 'find', 'research', 'analyze'],
        domains: ['GENERAL', 'RESEARCH'],
        intents: ['SEARCH', 'ANALYZE'],
        complexity: ['SIMPLE', 'MODERATE'],
        riskLevels: ['LOW'],
        proactiveUse: false,
        priority: 3
      }
    };

    for (const [name, definition] of Object.entries(fallbackAgents)) {
      this.agents.set(name, definition);
    }
  }

  /**
   * Get agent by name
   */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Select best agent based on criteria
   */
  selectAgent(analysis, complexity) {
    const scores = new Map();

    for (const [name, agent] of this.agents) {
      let score = 0;
      const reasons = [];

      // Direct trigger matches (highest priority)
      if (analysis.triggers) {
        const triggerMatches = agent.triggers.filter(trigger => 
          analysis.triggers.some(t => t.toLowerCase().includes(trigger.toLowerCase()))
        );
        if (triggerMatches.length > 0) {
          score += triggerMatches.length * 10;
          reasons.push(`Trigger match: ${triggerMatches.join(', ')}`);
        }
      }

      // Domain expertise
      if (analysis.domain && agent.domains.includes(analysis.domain)) {
        score += 8;
        reasons.push(`Domain expertise: ${analysis.domain}`);
      }

      // Intent alignment
      if (analysis.intent && agent.intents.includes(analysis.intent)) {
        score += 6;
        reasons.push(`Intent alignment: ${analysis.intent}`);
      }

      // Complexity handling
      if (complexity.level && agent.complexity.includes(complexity.level)) {
        score += 5;
        reasons.push(`Complexity match: ${complexity.level}`);
      }

      // Risk level handling
      if (analysis.riskLevel && agent.riskLevels.includes(analysis.riskLevel)) {
        score += 4;
        reasons.push(`Risk level: ${analysis.riskLevel}`);
      }

      // Priority bonus for proactive agents
      if (agent.proactiveUse) {
        score += agent.priority || 1;
        reasons.push(`Proactive priority: ${agent.priority}`);
      }

      // Historical performance bonus
      const performance = this.getAgentPerformance(name);
      if (performance.successRate > 0.8) {
        score += 3;
        reasons.push(`High success rate: ${Math.round(performance.successRate * 100)}%`);
      }

      scores.set(name, { score, reasons, agent });
    }

    // Sort by score and return top candidate
    const sortedCandidates = Array.from(scores.entries())
      .sort(([,a], [,b]) => b.score - a.score)
      .filter(([,data]) => data.score > 0);

    return sortedCandidates.length > 0 ? sortedCandidates[0] : null;
  }

  /**
   * Select multiple agents for complex workflows
   */
  selectAgentChain(analysis, complexity) {
    const chain = [];
    
    // For very complex tasks, use proven chains
    if (complexity.level === 'VERY_COMPLEX') {
      const chainPatterns = {
        'CREATE': ['project-manager-analyst', 'technical-architect-lead', 'quality-assurance-guardian'],
        'DEPLOY': ['quality-assurance-guardian', 'devops-deployment-engineer'],
        'COORDINATE': ['workflow-orchestrator', 'project-manager-analyst'],
        'FIX': ['general-purpose', 'technical-architect-lead', 'quality-assurance-guardian']
      };

      const pattern = chainPatterns[analysis.intent];
      if (pattern) {
        return pattern.filter(agentName => this.agents.has(agentName));
      }
    }

    // For complex tasks, select primary + supporting agents
    if (complexity.level === 'COMPLEX') {
      const primary = this.selectAgent(analysis, complexity);
      if (primary) {
        chain.push(primary[0]);
        
        // Add quality assurance for high-risk operations
        if (analysis.riskLevel === 'HIGH' && !chain.includes('quality-assurance-guardian')) {
          chain.push('quality-assurance-guardian');
        }
      }
    }

    // Single agent for simple/moderate tasks
    if (complexity.level === 'SIMPLE' || complexity.level === 'MODERATE') {
      const primary = this.selectAgent(analysis, complexity);
      if (primary) {
        chain.push(primary[0]);
      }
    }

    return chain.length > 0 ? chain : ['general-purpose'];
  }

  /**
   * Execute agent with specified parameters
   */
  async executeAgent(agentName, task, parameters = {}) {
    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    const startTime = Date.now();
    
    try {
      // For now, we'll simulate agent execution
      // In a real implementation, this would call actual agent code
      
      const result = await this.simulateAgentExecution(agent, task, parameters);
      const executionTime = Date.now() - startTime;
      
      // Record performance
      this.recordAgentPerformance(agentName, true, executionTime, result.quality || 0.8);
      
      return {
        success: true,
        agent: agentName,
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record failure
      this.recordAgentPerformance(agentName, false, executionTime, 0);
      
      return {
        success: false,
        agent: agentName,
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * Simulate agent execution (placeholder for real implementation)
   */
  async simulateAgentExecution(agent, task, parameters) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Simulate success/failure based on agent capabilities
    const successProbability = this.calculateSuccessProbability(agent, task);
    
    if (Math.random() < successProbability) {
      return {
        deliverables: agent.getAgentDeliverables ? agent.getAgentDeliverables() : ['Task completed'],
        quality: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
        insights: [`${agent.name} successfully completed the task`],
        recommendations: ['Consider following up with quality assurance']
      };
    } else {
      throw new Error(`${agent.name} failed to complete the task: Simulated failure`);
    }
  }

  /**
   * Calculate success probability based on agent fit
   */
  calculateSuccessProbability(agent, task) {
    let probability = 0.5; // Base probability
    
    // Increase probability for matching domains
    if (task.domain && agent.domains.includes(task.domain)) {
      probability += 0.2;
    }
    
    // Increase for matching complexity
    if (task.complexity && agent.complexity.includes(task.complexity)) {
      probability += 0.15;
    }
    
    // Factor in historical performance
    const performance = this.getAgentPerformance(agent.name);
    probability += performance.successRate * 0.3;
    
    return Math.min(probability, 0.95); // Cap at 95%
  }

  /**
   * Record agent performance for learning
   */
  recordAgentPerformance(agentName, success, executionTime, quality) {
    if (!this.agentPerformance.has(agentName)) {
      this.agentPerformance.set(agentName, {
        totalExecutions: 0,
        successes: 0,
        totalTime: 0,
        averageQuality: 0,
        recentResults: []
      });
    }

    const performance = this.agentPerformance.get(agentName);
    performance.totalExecutions++;
    if (success) performance.successes++;
    performance.totalTime += executionTime;
    
    // Update quality (weighted average)
    const currentQuality = performance.averageQuality;
    performance.averageQuality = (currentQuality * (performance.totalExecutions - 1) + quality) / performance.totalExecutions;
    
    // Keep recent results for trend analysis
    performance.recentResults.push({ success, executionTime, quality, timestamp: Date.now() });
    if (performance.recentResults.length > 10) {
      performance.recentResults.shift();
    }
  }

  /**
   * Get agent performance metrics
   */
  getAgentPerformance(agentName) {
    const performance = this.agentPerformance.get(agentName);
    
    if (!performance) {
      return {
        successRate: 0.5,
        averageTime: 1000,
        averageQuality: 0.5,
        totalExecutions: 0
      };
    }

    return {
      successRate: performance.successes / performance.totalExecutions,
      averageTime: performance.totalTime / performance.totalExecutions,
      averageQuality: performance.averageQuality,
      totalExecutions: performance.totalExecutions
    };
  }

  /**
   * Get agent statistics
   */
  getAgentStatistics() {
    const stats = [];
    
    for (const [name, agent] of this.agents) {
      const performance = this.getAgentPerformance(name);
      stats.push({
        name,
        description: agent.description,
        successRate: Math.round(performance.successRate * 100),
        averageTime: Math.round(performance.averageTime),
        totalExecutions: performance.totalExecutions,
        priority: agent.priority || 0,
        proactive: agent.proactiveUse
      });
    }

    return stats.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Generate agent report
   */
  generateReport() {
    console.log('\n📊 AGENT REGISTRY REPORT');
    console.log('=' .repeat(60));
    
    const stats = this.getAgentStatistics();
    
    console.log(`\nTotal Agents: ${stats.length}`);
    console.log(`Proactive Agents: ${stats.filter(s => s.proactive).length}`);
    console.log(`Total Executions: ${stats.reduce((sum, s) => sum + s.totalExecutions, 0)}`);
    
    console.log('\nAgent Performance:');
    stats.forEach(stat => {
      const successIcon = stat.successRate >= 80 ? '✅' : stat.successRate >= 60 ? '⚠️' : '❌';
      console.log(`  ${successIcon} ${stat.name}: ${stat.successRate}% (${stat.totalExecutions} runs)`);
    });
    
    console.log('\nTop Performers:');
    stats.slice(0, 3).forEach((stat, index) => {
      console.log(`  ${index + 1}. ${stat.name} - ${stat.successRate}% success rate`);
    });
  }
}

// Export for use in other modules
module.exports = { AgentRegistry };

// CLI interface
if (require.main === module) {
  const registry = new AgentRegistry();
  const command = process.argv[2];
  
  if (command === 'list') {
    console.log('\n🤖 Available Agents:');
    registry.getAllAgents().forEach(agent => {
      console.log(`  • ${agent.name}: ${agent.description}`);
    });
  } else if (command === 'stats') {
    registry.generateReport();
  } else if (command === 'test') {
    // Test agent selection
    const testAnalysis = {
      intent: 'DEPLOY',
      domain: 'DEVOPS',
      riskLevel: 'HIGH',
      triggers: ['deploy', 'production']
    };
    const testComplexity = { level: 'COMPLEX' };
    
    console.log('\n🧪 Testing agent selection...');
    console.log('Analysis:', testAnalysis);
    console.log('Complexity:', testComplexity);
    
    const selected = registry.selectAgent(testAnalysis, testComplexity);
    console.log('\nSelected Agent:', selected ? selected[0] : 'None');
    if (selected) {
      console.log('Reasons:', selected[1].reasons);
    }
    
    const chain = registry.selectAgentChain(testAnalysis, testComplexity);
    console.log('Agent Chain:', chain);
  } else {
    console.log('\nUsage:');
    console.log('  node agent-registry.js list   # List all agents');
    console.log('  node agent-registry.js stats  # Show performance stats');
    console.log('  node agent-registry.js test   # Test agent selection');
  }
}
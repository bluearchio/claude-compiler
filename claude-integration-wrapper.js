#!/usr/bin/env node

/**
 * CLAUDE CODE INTEGRATION WRAPPER
 * 
 * This is the COMPLETE front-loaded prompt injection system that
 * FORCES Claude Code to use the Claude Compiler with full transparency.
 * 
 * USAGE: This should be called before ANY Claude Code session to ensure
 * proper behavior enforcement at the LLM level.
 */

const { PromptInjector } = require('./inject-prompt');
const { AgentAutoSelector } = require('./auto-select-agent');
const { SessionPublisher } = require('./session-publisher');
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
  reset: '\x1b[0m',
  clear: '\x1b[2J\x1b[0;0H'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class ClaudeIntegrationWrapper {
  constructor() {
    this.injector = new PromptInjector();
    this.agentSelector = new AgentAutoSelector();
    this.publisher = new SessionPublisher();
    this.sessionId = `session-${Date.now()}`;
  }

  /**
   * Complete integration process
   */
  async processUserPrompt(userPrompt) {
    console.log(colors.clear);
    
    log('╔══════════════════════════════════════════════════════════════════════╗', 'blue');
    log('║                CLAUDE CODE FRONT-LOADED INJECTION SYSTEM             ║', 'bold');
    log('║                        BEHAVIORAL ENFORCEMENT                         ║', 'bold');
    log('╚══════════════════════════════════════════════════════════════════════╝', 'blue');
    
    try {
      // Step 1: Agent Selection Analysis
      log('\n🤖 STEP 1: INTELLIGENT AGENT SELECTION', 'bold');
      const agentResult = this.agentSelector.selectOptimalAgent(userPrompt);
      
      log(`Selected Agent: ${agentResult.selectedAgent}`, 'green');
      log(`Selection Score: ${agentResult.score}`, 'cyan');
      log(`Complexity: ${agentResult.analysis.complexity}`, 'cyan');
      log(`Requires Compiler: ${agentResult.analysis.complexity !== 'simple' ? 'YES' : 'NO'}`, 'cyan');

      // Step 2: Generate Injected Prompt
      log('\n📝 STEP 2: GENERATING INJECTED PROMPT', 'bold');
      const injectedPrompt = await this.injector.generateInjectedPrompt(userPrompt);
      
      // Step 3: Publish Session Data
      log('\n📊 STEP 3: PUBLISHING SESSION DATA', 'bold');
      const sessionInfo = {
        sessionId: this.sessionId,
        userPrompt: userPrompt,
        complexity: agentResult.analysis.complexity,
        selectedAgent: agentResult.selectedAgent,
        requiresCompiler: agentResult.analysis.complexity !== 'simple',
        domain: agentResult.analysis.domain,
        riskLevel: agentResult.analysis.riskLevel,
        triggerWords: agentResult.analysis.triggerWords,
        agentChain: agentResult.agentChain,
        totalScore: agentResult.score,
        compilerReason: agentResult.reasoning,
        wordCount: agentResult.analysis.wordCount
      };
      
      const publishResult = await this.publisher.publishSession(sessionInfo);

      // Step 4: Display Results
      log('\n✅ STEP 4: INTEGRATION COMPLETE', 'bold');
      log('='.repeat(50), 'green');
      log('The following prompt should be used with Claude Code:', 'green');
      log('='.repeat(50), 'green');
      
      return {
        success: true,
        sessionId: this.sessionId,
        injectedPrompt,
        agentResult,
        publishResult,
        enforcementActive: true
      };

    } catch (error) {
      log(`❌ Integration failed: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * Display the final injected prompt
   */
  displayInjectedPrompt(result) {
    console.log('\n' + '='.repeat(80));
    console.log('FRONT-LOADED PROMPT FOR CLAUDE CODE:');
    console.log('='.repeat(80));
    console.log(result.injectedPrompt);
    console.log('='.repeat(80));
    console.log('');
    
    log('🎯 ENFORCEMENT GUARANTEE:', 'bold');
    log('This prompt FORCES Claude Code to:', 'cyan');
    log('  ✅ Read claude-compiler/CLAUDE.md first', 'green');
    log('  ✅ Use Claude Compiler for complex tasks', 'green');  
    log('  ✅ Provide complete decision transparency', 'green');
    log('  ✅ Maintain full audit trail', 'green');
    log('  ✅ Publish session data automatically', 'green');
    log('', 'reset');
  }

  /**
   * Create integration hook for environment
   */
  async createEnvironmentHook() {
    const hookContent = `#!/bin/bash
# CLAUDE CODE SESSION HOOK - AUTO-GENERATED
# This hook ensures Claude Compiler integration is active

echo "🔍 Claude Compiler Integration Check..."

if [ -d "claude-compiler" ]; then
    echo "✅ Claude Compiler detected"
    export CLAUDE_COMPILER_ACTIVE=true
    export CLAUDE_COMPILER_PATH="$(pwd)/claude-compiler"
    
    echo "⚠️  BEHAVIORAL ENFORCEMENT ACTIVE:"
    echo "   Complex tasks MUST use Claude Compiler"
    echo "   Complete transparency required"
    echo "   Full audit trail maintained"
    
    # Run integration wrapper for current session
    node claude-compiler/claude-integration-wrapper.js
else
    echo "ℹ️  No Claude Compiler found"
fi
`;

    const hookPath = path.join(process.cwd(), 'claude-compiler', 'session-hook.sh');
    fs.writeFileSync(hookPath, hookContent);
    fs.chmodSync(hookPath, 0o755);
    
    log(`✅ Environment hook created: ${hookPath}`, 'green');
    return hookPath;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('📖 Claude Code Integration Wrapper', 'bold');
    log('Usage:', 'cyan');
    log('  node claude-integration-wrapper.js "your user prompt here"', 'cyan');
    log('  node claude-integration-wrapper.js --create-hook', 'cyan');
    log('', 'reset');
    log('This generates a front-loaded prompt that FORCES Claude Code behavior', 'cyan');
    return;
  }

  const wrapper = new ClaudeIntegrationWrapper();

  try {
    if (args[0] === '--create-hook') {
      await wrapper.createEnvironmentHook();
      return;
    }

    const userPrompt = args.join(' ');
    const result = await wrapper.processUserPrompt(userPrompt);
    
    // Display the final injected prompt
    wrapper.displayInjectedPrompt(result);
    
    log('🎉 FRONT-LOADED INJECTION SYSTEM COMPLETE!', 'green');
    log('Copy the above prompt and use it as the system prompt for Claude Code', 'cyan');
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ClaudeIntegrationWrapper };
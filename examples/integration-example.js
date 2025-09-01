/**
 * Example: Using Claude Compiler in an External Project
 * 
 * This example shows how to integrate Claude Compiler into your project
 * for session tracking, task management, and front-loaded prompts.
 */

const ClaudeCompiler = require('../index');

async function main() {
    // Create a new compiler instance
    const compiler = new ClaudeCompiler({
        dbPath: './my-project-db',  // Custom database location
        frontLoadedFile: './my-front-prompt.txt'
    });

    try {
        // 1. Start a new session for your project
        console.log('Starting session...');
        const session = await compiler.startSession('my-awesome-project', {
            workingDirectory: process.cwd(),
            type: 'api',
            frontLoadedPrompt: `You are an expert Node.js developer.
Always follow best practices and write clean, maintainable code.
Use ES6+ features and async/await patterns.`
        });
        
        console.log(`Session started: ${session.sessionId}`);

        // 2. Create tasks to track work
        console.log('\nCreating tasks...');
        const task1 = await compiler.createTask(
            'Implement user authentication',
            2,  // High priority
            {
                category: 'feature',
                description: 'Add JWT-based auth with refresh tokens'
            }
        );
        
        const task2 = await compiler.createTask(
            'Write unit tests for auth module',
            3,  // Medium priority
            {
                category: 'testing',
                description: 'Achieve 80% code coverage'
            }
        );

        console.log(`Created tasks: ${task1.id}, ${task2.id}`);

        // 3. Execute Claude with tracking
        console.log('\nExecuting Claude for task 1...');
        await compiler.updateTask(task1.id, { status: 'in_progress' });
        
        const result = await compiler.executeWithFrontLoad(
            'Create a JWT authentication service with login and refresh token endpoints',
            {
                taskId: task1.id,
                outputFormat: 'text'
            }
        );

        console.log('Claude response received');
        console.log(`Execution time: ${result.executionTime}ms`);

        // 4. Record file changes
        await compiler.recordFileChange(
            'src/services/auth.js',
            'created',
            { 
                metadata: { 
                    linesAdded: 150,
                    taskId: task1.id 
                }
            }
        );

        // 5. Complete the task
        await compiler.updateTask(task1.id, { status: 'completed' });
        console.log('Task 1 completed');

        // 6. Check for conflicts with other sessions
        const conflicts = await compiler.getActiveConflicts();
        if (conflicts.length > 0) {
            console.log('\nWarning: Conflicts detected with other sessions:');
            conflicts.forEach(conflict => {
                console.log(`  - ${conflict.conflict_type}: ${conflict.conflict_details}`);
            });
        }

        // 7. Get session statistics
        const status = await compiler.getSessionStatus();
        console.log('\nSession Statistics:');
        console.log(`  Prompts executed: ${status.statistics.prompt_count || 0}`);
        console.log(`  Tasks completed: 1/${status.statistics.task_count || 0}`);
        console.log(`  Files changed: ${status.statistics.files_changed || 0}`);

        // 8. Check for messages from other sessions
        const messages = await compiler.checkMessages();
        if (messages.length > 0) {
            console.log('\nMessages from other sessions:');
            messages.forEach(msg => {
                console.log(`  [${msg.message_type}] ${msg.message}`);
            });
        }

        // 9. Get remaining tasks
        const activeTasks = await compiler.getTasks({
            sessionId: session.sessionId
        });
        
        console.log('\nRemaining tasks:');
        activeTasks.forEach(task => {
            console.log(`  - [${task.priority}] ${task.task} (${task.status})`);
        });

        // 10. End the session
        console.log('\nEnding session...');
        await compiler.endSession();
        console.log('Session ended successfully');

        // 11. Get overall statistics
        const stats = await compiler.getStatistics();
        console.log('\nOverall Statistics:');
        console.log('  Total tasks:', stats.tasks.total);
        console.log('  By status:', stats.tasks.byStatus);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Always close database connections
        compiler.close();
    }
}

// Run the example
if (require.main === module) {
    main().catch(console.error);
}

module.exports = main;
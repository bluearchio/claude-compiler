/**
 * TODO Service Module for Claude Compiler
 * Manages all task-related database operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class TodoService {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '..', 'todo.db');
        this.db = null;
        this.initPromise = this.initialize();
    }

    /**
     * Initialize database and create tables if needed
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            // Ensure directory exists
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Load and execute schema
                const schemaPath = path.join(__dirname, '..', 'schemas', 'todo-schema.sql');
                const schema = fs.readFileSync(schemaPath, 'utf8');
                
                this.db.exec(schema, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Ensure database is initialized before operations
     */
    async ensureInitialized() {
        await this.initPromise;
    }

    /**
     * Create a new task
     */
    async createTask(task, options = {}) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const {
                description = null,
                priority = 3,
                category = null,
                assigned_to = null,
                parent_task_id = null,
                metadata = null
            } = options;

            const sql = `
                INSERT INTO todos (task, description, priority, category, assigned_to, parent_task_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                task,
                description,
                priority,
                category,
                assigned_to,
                parent_task_id,
                metadata ? JSON.stringify(metadata) : null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, task, ...options });
                }
            });
        });
    }

    /**
     * Update task status
     */
    async updateTaskStatus(taskId, status, blockedReason = null) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            let sql, params;
            
            if (status === 'blocked' && blockedReason) {
                sql = `UPDATE todos SET status = ?, blocked_reason = ? WHERE id = ?`;
                params = [status, blockedReason, taskId];
            } else {
                sql = `UPDATE todos SET status = ? WHERE id = ?`;
                params = [status, taskId];
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ taskId, status, changes: this.changes });
                }
            });
        });
    }

    /**
     * Assign task to a session
     */
    async assignTask(taskId, sessionId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE todos SET assigned_to = ? WHERE id = ?`;
            
            this.db.run(sql, [sessionId, taskId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ taskId, sessionId, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get active tasks (open or in_progress)
     */
    async getActiveTasks(filters = {}) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT id, task, description, status, priority, category, 
                       assigned_to, created_at, updated_at, parent_task_id, metadata
                FROM todos
                WHERE status IN ('open', 'in_progress')
            `;
            const params = [];

            if (filters.category) {
                sql += ` AND category = ?`;
                params.push(filters.category);
            }

            if (filters.assigned_to) {
                sql += ` AND assigned_to = ?`;
                params.push(filters.assigned_to);
            }

            if (filters.priority) {
                sql += ` AND priority = ?`;
                params.push(filters.priority);
            }

            sql += ` ORDER BY priority ASC, created_at DESC`;

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : null
                    })));
                }
            });
        });
    }

    /**
     * Get tasks by session
     */
    async getTasksBySession(sessionId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, task, description, status, priority, category,
                       created_at, updated_at, completed_at, blocked_at, blocked_reason,
                       parent_task_id, metadata
                FROM todos
                WHERE assigned_to = ?
                ORDER BY priority ASC, created_at DESC
            `;

            this.db.all(sql, [sessionId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : null
                    })));
                }
            });
        });
    }

    /**
     * Complete a task
     */
    async completeTask(taskId) {
        return this.updateTaskStatus(taskId, 'completed');
    }

    /**
     * Get task by ID
     */
    async getTask(taskId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, task, description, status, priority, category,
                       assigned_to, created_at, updated_at, completed_at,
                       blocked_at, blocked_reason, parent_task_id, metadata
                FROM todos
                WHERE id = ?
            `;

            this.db.get(sql, [taskId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : null
                    });
                }
            });
        });
    }

    /**
     * Add task dependency
     */
    async addDependency(taskId, dependsOnTaskId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO task_dependencies (task_id, depends_on_task_id)
                VALUES (?, ?)
            `;

            this.db.run(sql, [taskId, dependsOnTaskId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, taskId, dependsOnTaskId });
                }
            });
        });
    }

    /**
     * Add comment to task
     */
    async addComment(taskId, comment, sessionId = null) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO task_comments (task_id, session_id, comment)
                VALUES (?, ?, ?)
            `;

            this.db.run(sql, [taskId, sessionId, comment], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, taskId, comment, sessionId });
                }
            });
        });
    }

    /**
     * Get task history
     */
    async getTaskHistory(taskId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT field_name, old_value, new_value, changed_by, changed_at
                FROM task_history
                WHERE task_id = ?
                ORDER BY changed_at DESC
            `;

            this.db.all(sql, [taskId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get task statistics
     */
    async getStatistics() {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(CASE 
                        WHEN completed_at IS NOT NULL 
                        THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
                        ELSE NULL 
                    END) as avg_completion_time_seconds
                FROM todos
                GROUP BY status
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = {
                        byStatus: {},
                        total: 0
                    };
                    
                    rows.forEach(row => {
                        stats.byStatus[row.status] = {
                            count: row.count,
                            avgCompletionTime: row.avg_completion_time_seconds
                        };
                        stats.total += row.count;
                    });
                    
                    resolve(stats);
                }
            });
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = TodoService;
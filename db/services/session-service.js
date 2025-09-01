/**
 * SESSION Service Module for Claude Compiler
 * Manages all session-related database operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class SessionService {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '..', 'session.db');
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
                const schemaPath = path.join(__dirname, '..', 'schemas', 'session-schema.sql');
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
     * Register a new session
     */
    async registerSession(type, hostProject, workingDirectory, options = {}) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sessionId = uuidv4();
            const {
                name = `Session ${new Date().toISOString()}`,
                metadata = {}
            } = options;

            const sql = `
                INSERT INTO sessions (session_id, type, name, host_project, working_directory, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                sessionId,
                type,
                name,
                hostProject,
                workingDirectory,
                JSON.stringify(metadata)
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        sessionId,
                        type,
                        name,
                        hostProject,
                        workingDirectory,
                        metadata
                    });
                }
            });
        });
    }

    /**
     * Update session activity
     */
    async updateSessionActivity(sessionId, activity, data = null) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO session_activities (session_id, activity, data)
                VALUES (?, ?, ?)
            `;

            this.db.run(sql, [
                sessionId,
                activity,
                data ? JSON.stringify(data) : null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, sessionId, activity });
                }
            });
        });
    }

    /**
     * Record a prompt and response
     */
    async recordPrompt(sessionId, promptType, promptText, responseText = null, options = {}) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const {
                executionTimeMs = null,
                tokensUsed = null,
                metadata = null
            } = options;

            const sql = `
                INSERT INTO session_prompts 
                (session_id, prompt_type, prompt_text, response_text, execution_time_ms, tokens_used, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                sessionId,
                promptType,
                promptText,
                responseText,
                executionTimeMs,
                tokensUsed,
                metadata ? JSON.stringify(metadata) : null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Check for active sessions
     */
    async checkActiveSessions() {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT session_id, type, name, host_project, working_directory, 
                       started_at, last_activity, metadata
                FROM sessions
                WHERE status = 'active'
                ORDER BY last_activity DESC
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : {}
                    })));
                }
            });
        });
    }

    /**
     * Detect conflicts with other sessions
     */
    async detectConflicts(sessionId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            // Check for unresolved conflicts involving this session
            const sql = `
                SELECT * FROM session_conflicts
                WHERE (session1_id = ? OR session2_id = ?)
                  AND resolved_at IS NULL
                ORDER BY detected_at DESC
            `;

            this.db.all(sql, [sessionId, sessionId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        conflict_details: row.conflict_details ? JSON.parse(row.conflict_details) : {}
                    })));
                }
            });
        });
    }

    /**
     * Record file change
     */
    async recordFileChange(sessionId, filePath, changeType, options = {}) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const {
                oldContentHash = null,
                newContentHash = null,
                metadata = null
            } = options;

            const sql = `
                INSERT INTO session_file_changes 
                (session_id, file_path, change_type, old_content_hash, new_content_hash, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                sessionId,
                filePath,
                changeType,
                oldContentHash,
                newContentHash,
                metadata ? JSON.stringify(metadata) : null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Mark session as dormant
     */
    async markSessionDormant(sessionId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE sessions SET status = 'dormant' WHERE session_id = ?`;
            
            this.db.run(sql, [sessionId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ sessionId, changes: this.changes });
                }
            });
        });
    }

    /**
     * Close session
     */
    async closeSession(sessionId, status = 'completed') {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE sessions 
                SET status = ?, ended_at = CURRENT_TIMESTAMP 
                WHERE session_id = ?
            `;
            
            this.db.run(sql, [status, sessionId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ sessionId, status, changes: this.changes });
                }
            });
        });
    }

    /**
     * Link task to session
     */
    async linkTaskToSession(sessionId, taskId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO session_tasks (session_id, task_id)
                VALUES (?, ?)
            `;

            this.db.run(sql, [sessionId, taskId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, sessionId, taskId });
                }
            });
        });
    }

    /**
     * Complete task in session
     */
    async completeSessionTask(sessionId, taskId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE session_tasks 
                SET completed_at = CURRENT_TIMESTAMP
                WHERE session_id = ? AND task_id = ?
            `;

            this.db.run(sql, [sessionId, taskId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ sessionId, taskId, changes: this.changes });
                }
            });
        });
    }

    /**
     * Send message to another session
     */
    async sendMessage(toSessionId, messageType, message, fromSessionId = null, metadata = null) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO session_messages (from_session_id, to_session_id, message_type, message, metadata)
                VALUES (?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                fromSessionId,
                toSessionId,
                messageType,
                message,
                metadata ? JSON.stringify(metadata) : null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Get unread messages for session
     */
    async getUnreadMessages(sessionId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM session_messages
                WHERE to_session_id = ? AND read_at IS NULL
                ORDER BY timestamp ASC
            `;

            this.db.all(sql, [sessionId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Mark messages as read
                    const updateSql = `
                        UPDATE session_messages 
                        SET read_at = CURRENT_TIMESTAMP 
                        WHERE to_session_id = ? AND read_at IS NULL
                    `;
                    this.db.run(updateSql, [sessionId]);
                    
                    resolve(rows.map(row => ({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : null
                    })));
                }
            });
        });
    }

    /**
     * Get session details
     */
    async getSession(sessionId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM sessions WHERE session_id = ?
            `;

            this.db.get(sql, [sessionId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : {}
                    });
                }
            });
        });
    }

    /**
     * Get session statistics
     */
    async getStatistics(sessionId = null) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            let sql;
            let params = [];

            if (sessionId) {
                sql = `
                    SELECT 
                        COUNT(DISTINCT sa.id) as activity_count,
                        COUNT(DISTINCT sp.id) as prompt_count,
                        COUNT(DISTINCT st.task_id) as task_count,
                        COUNT(DISTINCT sfc.file_path) as files_changed,
                        AVG(sp.execution_time_ms) as avg_execution_time,
                        SUM(sp.tokens_used) as total_tokens
                    FROM sessions s
                    LEFT JOIN session_activities sa ON s.session_id = sa.session_id
                    LEFT JOIN session_prompts sp ON s.session_id = sp.session_id
                    LEFT JOIN session_tasks st ON s.session_id = st.session_id
                    LEFT JOIN session_file_changes sfc ON s.session_id = sfc.session_id
                    WHERE s.session_id = ?
                `;
                params = [sessionId];
            } else {
                sql = `
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM sessions
                    GROUP BY status
                `;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(sessionId ? rows[0] : rows);
                }
            });
        });
    }

    /**
     * Cleanup dormant sessions
     */
    async cleanupDormantSessions(olderThanMinutes = 30) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE sessions 
                SET status = 'completed', ended_at = CURRENT_TIMESTAMP
                WHERE status = 'dormant' 
                  AND last_activity < datetime('now', '-${olderThanMinutes} minutes')
            `;

            this.db.run(sql, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ cleanedUp: this.changes });
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

module.exports = SessionService;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'bot.db'));
        this.init();
    }

    init() {
        // Таблица каналов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT UNIQUE NOT NULL,
                channel_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица администраторов каналов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS channel_admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                is_super_admin BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (channel_id) REFERENCES channels(channel_id)
            )
        `);

        // Таблица постов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT NOT NULL,
                message_text TEXT NOT NULL,
                success_text TEXT NOT NULL,
                fail_text TEXT DEFAULT 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                button_text TEXT DEFAULT 'Проверить подписку',
                photo_file_id TEXT,
                message_id TEXT,
                created_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (channel_id) REFERENCES channels(channel_id)
            )
        `);

        // Добавляем новые столбцы к существующим таблицам (миграция)
        this.db.run(`
            ALTER TABLE posts ADD COLUMN fail_text TEXT DEFAULT 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.'
        `, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.log('Столбец fail_text уже существует или другая ошибка:', err.message);
            } else if (!err) {
                console.log('Добавлен новый столбец fail_text');
            }
        });

        this.db.run(`
            ALTER TABLE posts ADD COLUMN photo_file_id TEXT
        `, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.log('Столбец photo_file_id уже существует или другая ошибка:', err.message);
            } else if (!err) {
                console.log('Добавлен новый столбец photo_file_id');
            }
        });

        console.log('База данных инициализирована');
    }

    // Методы для работы с каналами
    addChannel(channelId, channelName) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO channels (channel_id, channel_name) VALUES (?, ?)',
                [channelId, channelName],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    getChannels() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM channels', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Методы для работы с администраторами
    addChannelAdmin(userId, channelId, isSuperAdmin = false) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO channel_admins (user_id, channel_id, is_super_admin) VALUES (?, ?, ?)',
                [userId, channelId, isSuperAdmin],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    isChannelAdmin(userId, channelId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM channel_admins WHERE user_id = ? AND channel_id = ?',
                [userId, channelId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    getUserChannels(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT c.* FROM channels c
                JOIN channel_admins ca ON c.channel_id = ca.channel_id
                WHERE ca.user_id = ?
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Методы для работы с постами
    addPost(channelId, messageText, successText, failText, buttonText, createdBy, photoFileId = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO posts (channel_id, message_text, success_text, fail_text, button_text, photo_file_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [channelId, messageText, successText, failText, buttonText, photoFileId, createdBy],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    updatePostMessageId(postId, messageId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET message_id = ? WHERE id = ?',
                [messageId, postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    getPost(postId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    getChannelPosts(channelId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM posts WHERE channel_id = ? ORDER BY created_at DESC', [channelId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Методы для редактирования постов
    updatePostMessage(postId, messageText) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET message_text = ? WHERE id = ?',
                [messageText, postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    updatePostPhoto(postId, photoFileId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET photo_file_id = ? WHERE id = ?',
                [photoFileId, postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    updatePostSuccessText(postId, successText) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET success_text = ? WHERE id = ?',
                [successText, postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    updatePostFailText(postId, failText) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET fail_text = ? WHERE id = ?',
                [failText, postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    updatePostButtonText(postId, buttonText) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET button_text = ? WHERE id = ?',
                [buttonText, postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    removePostPhoto(postId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE posts SET photo_file_id = NULL WHERE id = ?',
                [postId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
}

module.exports = Database; 
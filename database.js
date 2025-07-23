const { Pool } = require('pg');

class Database {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'subscription_bot',
            password: process.env.DB_PASSWORD || 'password',
            port: process.env.DB_PORT || 5432,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            max: 20, // максимальное количество соединений в пуле
            idleTimeoutMillis: 30000, // время ожидания перед закрытием неактивного соединения
            connectionTimeoutMillis: 2000, // время ожидания при подключении
        });
        
        this.pool.on('connect', () => {
            console.log('✅ Подключение к PostgreSQL установлено');
        });
        
        this.pool.on('error', (err) => {
            console.error('❌ Ошибка подключения к PostgreSQL:', err);
        });
        
        this.init();
    }

    async init() {
        try {
            // Создание таблицы каналов
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS channels (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT UNIQUE NOT NULL,
                    channel_name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Таблица администраторов каналов
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS channel_admins (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    user_id BIGINT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
                )
            `);

            // Таблица постов
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    message_text TEXT NOT NULL,
                    success_text TEXT NOT NULL,
                    fail_text TEXT DEFAULT 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                    button_text TEXT NOT NULL,
                    photo_file_id TEXT DEFAULT NULL,
                    message_id INTEGER DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
                )
            `);

            console.log('✅ Таблицы PostgreSQL инициализированы');
        } catch (error) {
            console.error('❌ Ошибка при инициализации таблиц:', error);
            throw error;
        }
    }

    // Проверка подключения к базе данных
    async testConnection() {
        try {
            const result = await this.pool.query('SELECT NOW()');
            console.log('✅ Соединение с PostgreSQL работает:', result.rows[0].now);
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения к PostgreSQL:', error);
            return false;
        }
    }

    // Добавление канала
    async addChannel(channelId, channelName) {
        try {
            const query = 'INSERT INTO channels (channel_id, channel_name) VALUES ($1, $2) ON CONFLICT (channel_id) DO NOTHING RETURNING id';
            const result = await this.pool.query(query, [channelId, channelName]);
            return result.rows[0]?.id || null;
        } catch (error) {
            console.error('Ошибка при добавлении канала:', error);
            throw error;
        }
    }

    // Получение канала по ID
    async getChannel(channelId) {
        try {
            const query = 'SELECT * FROM channels WHERE channel_id = $1';
            const result = await this.pool.query(query, [channelId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Ошибка при получении канала:', error);
            throw error;
        }
    }

    // Получение всех каналов пользователя
    async getUserChannels(userId) {
        try {
            const query = `
                SELECT DISTINCT c.* FROM channels c
                JOIN channel_admins ca ON c.channel_id = ca.channel_id
                WHERE ca.user_id = $1
                ORDER BY c.created_at DESC
            `;
            const result = await this.pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении каналов пользователя:', error);
            throw error;
        }
    }

    // Добавление администратора канала
    async addChannelAdmin(channelId, userId) {
        try {
            const query = `
                INSERT INTO channel_admins (channel_id, user_id) 
                VALUES ($1, $2) 
                ON CONFLICT DO NOTHING 
                RETURNING id
            `;
            const result = await this.pool.query(query, [channelId, userId]);
            return result.rows[0]?.id || null;
        } catch (error) {
            console.error('Ошибка при добавлении админа канала:', error);
            throw error;
        }
    }

    // Проверка является ли пользователь администратором канала
    async isChannelAdmin(userId, channelId) {
        try {
            const query = 'SELECT 1 FROM channel_admins WHERE user_id = $1 AND channel_id = $2';
            const result = await this.pool.query(query, [userId, channelId]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Ошибка при проверке прав админа:', error);
            throw error;
        }
    }

    // Создание поста
    async createPost(channelId, messageText, successText, failText, buttonText, photoFileId = null) {
        try {
            const query = `
                INSERT INTO posts (channel_id, message_text, success_text, fail_text, button_text, photo_file_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `;
            const result = await this.pool.query(query, [channelId, messageText, successText, failText, buttonText, photoFileId]);
            return result.rows[0].id;
        } catch (error) {
            console.error('Ошибка при создании поста:', error);
            throw error;
        }
    }

    // Получение поста по ID
    async getPost(postId) {
        try {
            const query = 'SELECT * FROM posts WHERE id = $1';
            const result = await this.pool.query(query, [postId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Ошибка при получении поста:', error);
            throw error;
        }
    }

    // Получение всех постов канала
    async getChannelPosts(channelId) {
        try {
            const query = 'SELECT * FROM posts WHERE channel_id = $1 ORDER BY created_at DESC';
            const result = await this.pool.query(query, [channelId]);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении постов канала:', error);
            throw error;
        }
    }

    // Обновление ID сообщения поста
    async updatePostMessageId(postId, messageId) {
        try {
            const query = 'UPDATE posts SET message_id = $1 WHERE id = $2';
            await this.pool.query(query, [messageId, postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении ID сообщения:', error);
            throw error;
        }
    }

    // Обновление текста поста
    async updatePostMessage(postId, messageText) {
        try {
            const query = 'UPDATE posts SET message_text = $1 WHERE id = $2';
            await this.pool.query(query, [messageText, postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении текста поста:', error);
            throw error;
        }
    }

    // Обновление изображения поста
    async updatePostPhoto(postId, photoFileId) {
        try {
            const query = 'UPDATE posts SET photo_file_id = $1 WHERE id = $2';
            await this.pool.query(query, [photoFileId, postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении изображения поста:', error);
            throw error;
        }
    }

    // Удаление изображения поста
    async removePostPhoto(postId) {
        try {
            const query = 'UPDATE posts SET photo_file_id = NULL WHERE id = $1';
            await this.pool.query(query, [postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при удалении изображения поста:', error);
            throw error;
        }
    }

    // Обновление текста успешной проверки
    async updatePostSuccessText(postId, successText) {
        try {
            const query = 'UPDATE posts SET success_text = $1 WHERE id = $2';
            await this.pool.query(query, [successText, postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении текста успеха:', error);
            throw error;
        }
    }

    // Обновление текста неудачной проверки
    async updatePostFailText(postId, failText) {
        try {
            const query = 'UPDATE posts SET fail_text = $1 WHERE id = $2';
            await this.pool.query(query, [failText, postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении текста неудачи:', error);
            throw error;
        }
    }

    // Обновление текста кнопки
    async updatePostButtonText(postId, buttonText) {
        try {
            const query = 'UPDATE posts SET button_text = $1 WHERE id = $2';
            await this.pool.query(query, [buttonText, postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении текста кнопки:', error);
            throw error;
        }
    }

    // Удаление поста
    async deletePost(postId) {
        try {
            const query = 'DELETE FROM posts WHERE id = $1';
            await this.pool.query(query, [postId]);
            return true;
        } catch (error) {
            console.error('Ошибка при удалении поста:', error);
            throw error;
        }
    }

    // Удаление канала и всех связанных данных
    async deleteChannel(channelId) {
        try {
            const query = 'DELETE FROM channels WHERE channel_id = $1';
            await this.pool.query(query, [channelId]);
            return true;
        } catch (error) {
            console.error('Ошибка при удалении канала:', error);
            throw error;
        }
    }

    // Получение статистики
    async getStats() {
        try {
            const channelsQuery = 'SELECT COUNT(*) as count FROM channels';
            const postsQuery = 'SELECT COUNT(*) as count FROM posts';
            const adminsQuery = 'SELECT COUNT(*) as count FROM channel_admins';

            const [channelsResult, postsResult, adminsResult] = await Promise.all([
                this.pool.query(channelsQuery),
                this.pool.query(postsQuery),
                this.pool.query(adminsQuery)
            ]);

            return {
                channels: parseInt(channelsResult.rows[0].count),
                posts: parseInt(postsResult.rows[0].count),
                admins: parseInt(adminsResult.rows[0].count)
            };
        } catch (error) {
            console.error('Ошибка при получении статистики:', error);
            throw error;
        }
    }

    // Закрытие соединения с базой данных
    async close() {
        try {
            await this.pool.end();
            console.log('🔐 Соединение с PostgreSQL закрыто');
        } catch (error) {
            console.error('Ошибка при закрытии соединения:', error);
        }
    }
}

module.exports = Database; 
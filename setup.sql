-- 🗄️ SQL скрипт для настройки PostgreSQL базы данных
-- Выполните этот скрипт от имени администратора PostgreSQL

-- 1. Создание базы данных (если не существует)
CREATE DATABASE subscription_bot;

-- 2. Создание пользователя для бота (замените пароль на безопасный)
CREATE USER botuser WITH ENCRYPTED PASSWORD 'secure_password_2024';

-- 3. Предоставление прав на базу данных
GRANT ALL PRIVILEGES ON DATABASE subscription_bot TO botuser;

-- 4. Подключение к базе данных subscription_bot
\c subscription_bot;

-- 5. Предоставление прав на схему public
GRANT ALL ON SCHEMA public TO botuser;
GRANT CREATE ON SCHEMA public TO botuser;

-- 6. Создание таблиц
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    channel_id TEXT UNIQUE NOT NULL,
    channel_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_admins (
    id SERIAL PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
);

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
);

-- 7. Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_channel_admins_user_id ON channel_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_admins_channel_id ON channel_admins(channel_id);
CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON posts(channel_id);

-- 8. Предоставление всех прав пользователю бота
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO botuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO botuser;

-- 9. Предоставление прав на будущие таблицы
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO botuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO botuser;

-- 10. Проверка созданных таблиц
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 11. Проверка прав пользователя
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'botuser';

COMMIT; 
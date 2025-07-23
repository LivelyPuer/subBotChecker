#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

// Цвета для консоли
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Конфигурация подключения к PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function setupTables() {
    try {
        log('🚀 Создание таблиц для Subscription Bot...', 'blue');
        log('=' .repeat(50), 'blue');

        // 1. Тест подключения
        log('\n1️⃣ Проверка подключения...', 'yellow');
        const testResult = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
        log(`✅ Подключение успешно к БД: ${testResult.rows[0].db_name}`, 'green');
        log(`   Время сервера: ${testResult.rows[0].current_time}`, 'blue');

        // 2. Проверка существующих таблиц
        log('\n2️⃣ Проверка существующих таблиц...', 'yellow');
        const existingTables = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('channels', 'channel_admins', 'posts')
        `);
        
        if (existingTables.rows.length > 0) {
            log('⚠️ Найдены существующие таблицы:', 'yellow');
            existingTables.rows.forEach(row => {
                log(`   • ${row.tablename}`, 'yellow');
            });
            log('   Таблицы будут обновлены при необходимости', 'blue');
        }

        // 3. Создание таблиц
        log('\n3️⃣ Создание/обновление таблиц...', 'yellow');
        
        // Таблица каналов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS channels (
                id SERIAL PRIMARY KEY,
                channel_id TEXT UNIQUE NOT NULL,
                channel_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        log('✅ Таблица channels готова', 'green');

        // Таблица администраторов каналов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS channel_admins (
                id SERIAL PRIMARY KEY,
                channel_id TEXT NOT NULL,
                user_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
            )
        `);
        log('✅ Таблица channel_admins готова', 'green');

        // Таблица постов
        await pool.query(`
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
        log('✅ Таблица posts готова', 'green');

        // 4. Создание индексов
        log('\n4️⃣ Создание индексов...', 'yellow');
        
        await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_admins_user_id ON channel_admins(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_admins_channel_id ON channel_admins(channel_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON posts(channel_id)');
        
        log('✅ Индексы созданы', 'green');

        // 5. Проверка финального состояния
        log('\n5️⃣ Проверка результата...', 'yellow');
        
        const finalTables = await pool.query(`
            SELECT 
                tablename,
                tableowner
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename IN ('channels', 'channel_admins', 'posts')
            ORDER BY tablename
        `);
        
        log('📋 Созданные таблицы:', 'blue');
        finalTables.rows.forEach(row => {
            log(`   • ${row.tablename} (владелец: ${row.tableowner})`, 'green');
        });

        // Проверка количества записей
        const tables = ['channels', 'channel_admins', 'posts'];
        log('\n📊 Статистика таблиц:', 'blue');
        
        for (const table of tables) {
            try {
                const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
                log(`   • ${table}: ${count.rows[0].count} записей`, 'green');
            } catch (error) {
                log(`   • ${table}: ошибка чтения (проверьте права доступа)`, 'red');
            }
        }

        log('\n✅ Таблицы успешно настроены!', 'green');
        log('🎉 Теперь вы можете запустить бота: node bot.js', 'green');

    } catch (error) {
        log(`\n❌ Ошибка: ${error.message}`, 'red');
        
        if (error.message.includes('permission denied')) {
            log('\n🔧 Решение проблемы с правами:', 'yellow');
            log('1. Обратитесь к администратору PostgreSQL', 'blue');
            log('2. Предоставьте файл setup.sql для выполнения', 'blue');  
            log('3. Или выполните команды:', 'blue');
            log(`   GRANT ALL ON SCHEMA public TO ${process.env.DB_USER};`, 'blue');
            log(`   GRANT CREATE ON SCHEMA public TO ${process.env.DB_USER};`, 'blue');
        }
        
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Проверяем переменные окружения
const requiredEnv = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
    log('❌ Отсутствуют переменные окружения:', 'red');
    missingEnv.forEach(env => log(`   • ${env}`, 'red'));
    log('\n📝 Настройте файл .env', 'yellow');
    process.exit(1);
}

log('🔧 Настройка таблиц PostgreSQL', 'blue');
setupTables(); 
#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
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
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const targetDbName = process.env.DB_NAME || 'subscription_bot';
const botUser = process.env.DB_USER || 'botuser';
const botPassword = process.env.DB_PASSWORD || 'secure_password_2024';

async function setupDatabase() {
    let adminPool;
    let botPool;
    
    try {
        log('🚀 Начинаем настройку PostgreSQL базы данных...', 'blue');
        
        // 1. Подключаемся к PostgreSQL как администратор
        log('\n1️⃣ Подключение к PostgreSQL...', 'yellow');
        adminPool = new Pool({
            ...dbConfig,
            database: 'postgres' // Подключаемся к системной БД
        });
        
        await testConnection(adminPool, 'PostgreSQL (системная БД)');
        await adminPool.end();
        
        // 4. Подключаемся к базе данных
        log('\n4️⃣ Подключение к базе данных...', 'yellow');
        botPool = new Pool({
            ...dbConfig,
            database: targetDbName
        });
        
        await testConnection(botPool, 'База данных');
        
        // 5. Создаем таблицы
        log('\n5️⃣ Создание таблиц...', 'yellow');
        await createTables(botPool);
        
        // 6. Проверяем созданные таблицы
        log('\n6️⃣ Проверка таблиц...', 'yellow');
        await checkTables(botPool);
        
        log('\n✅ База данных успешно настроена!', 'green');
        log('🎉 Теперь вы можете запустить бота: node bot.js', 'green');
        
    } catch (error) {
        log(`\n❌ Ошибка настройки базы данных: ${error.message}`, 'red');
        log('📝 Проверьте конфигурацию в .env файле', 'yellow');
        process.exit(1);
    } finally {
        if (adminPool) await adminPool.end().catch(() => {});
        if (botPool) await botPool.end().catch(() => {});
    }
}

async function testConnection(pool, description) {
    try {
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        log(`✅ ${description}: подключение успешно`, 'green');
        log(`   Время: ${result.rows[0].current_time}`, 'blue');
        log(`   Версия: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`, 'blue');
    } catch (error) {
        throw new Error(`Не удалось подключиться к ${description}: ${error.message}`);
    }
}

async function createTables(pool) {
    try {
        // Создание таблицы каналов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS channels (
                id SERIAL PRIMARY KEY,
                channel_id TEXT UNIQUE NOT NULL,
                channel_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        log('✅ Таблица channels создана', 'green');

        // Создание таблицы администраторов каналов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS channel_admins (
                id SERIAL PRIMARY KEY,
                channel_id TEXT NOT NULL,
                user_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
            )
        `);
        log('✅ Таблица channel_admins создана', 'green');

        // Создание таблицы постов
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
        log('✅ Таблица posts создана', 'green');

        // Создание индексов для производительности
        await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_admins_user_id ON channel_admins(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_admins_channel_id ON channel_admins(channel_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON posts(channel_id)');
        log('✅ Индексы созданы', 'green');

        // Пытаемся предоставить права (может не сработать на удаленном сервере)
        try {
            await pool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${process.env.DB_USER}`);
            await pool.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${process.env.DB_USER}`);
            log('✅ Права на таблицы предоставлены', 'green');
        } catch (error) {
            log('⚠️ Не удалось предоставить права автоматически', 'yellow');
            log('📝 Запросите у администратора БД выполнение команд из setup.sql', 'yellow');
        }

    } catch (error) {
        throw new Error(`Ошибка создания таблиц: ${error.message}`);
    }
}

async function checkTables(pool) {
    try {
        const result = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                tableowner
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        log('📋 Созданные таблицы:', 'blue');
        result.rows.forEach(row => {
            log(`   • ${row.tablename} (владелец: ${row.tableowner})`, 'green');
        });

        // Проверяем количество записей в каждой таблице
        const tables = ['channels', 'channel_admins', 'posts'];
        log('\n📊 Статистика таблиц:', 'blue');
        
        for (const table of tables) {
            try {
                const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
                log(`   • ${table}: ${count.rows[0].count} записей`, 'green');
            } catch (error) {
                log(`   • ${table}: ошибка чтения (${error.message})`, 'red');
            }
        }
        
    } catch (error) {
        throw new Error(`Ошибка проверки таблиц: ${error.message}`);
    }
}

// Проверяем наличие .env файла
if (!fs.existsSync('.env')) {
    log('❌ Файл .env не найден!', 'red');
    log('📝 Создайте файл .env на основе .env.example', 'yellow');
    process.exit(1);
}

// Запускаем настройку
log('🔧 Настройка PostgreSQL для Subscription Bot', 'blue');
log('=' .repeat(50), 'blue');

setupDatabase(); 
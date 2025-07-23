# 🔄 Миграция с SQLite на PostgreSQL

Эта инструкция поможет вам мигрировать существующий бот с SQLite на PostgreSQL.

## 📋 Подготовка к миграции

### 1. Резервное копирование данных SQLite
```bash
# Создайте резервную копию вашей SQLite базы
cp bot_database.db bot_database_backup.db
cp .env .env.backup
```

### 2. Установка PostgreSQL
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Запуск PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Создание базы данных и пользователя
```bash
sudo -u postgres psql << EOF
CREATE DATABASE subscription_bot;
CREATE USER botuser WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE subscription_bot TO botuser;
\q
EOF
```

## 🔄 Миграция данных

### Скрипт автоматической миграции
Создайте файл `migrate.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');

// Конфигурация PostgreSQL
const pgPool = new Pool({
    user: 'botuser',
    host: 'localhost',
    database: 'subscription_bot',
    password: 'your_secure_password',
    port: 5432,
});

// Подключение к SQLite
const sqliteDb = new sqlite3.Database('./bot_database.db');

async function migrateData() {
    try {
        console.log('🚀 Начинаем миграцию данных...');

        // Создание таблиц в PostgreSQL
        await createTables();
        
        // Миграция каналов
        await migrateChannels();
        
        // Миграция администраторов
        await migrateAdmins();
        
        // Миграция постов
        await migratePosts();
        
        console.log('✅ Миграция завершена успешно!');
        
        // Показать статистику
        await showStats();
        
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
}

async function createTables() {
    console.log('📋 Создание таблиц PostgreSQL...');
    
    // Таблица каналов
    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS channels (
            id SERIAL PRIMARY KEY,
            channel_id TEXT UNIQUE NOT NULL,
            channel_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица администраторов
    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS channel_admins (
            id SERIAL PRIMARY KEY,
            channel_id TEXT NOT NULL,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
        )
    `);
    
    // Таблица постов
    await pgPool.query(`
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
    
    console.log('✅ Таблицы созданы');
}

async function migrateChannels() {
    return new Promise((resolve, reject) => {
        console.log('📂 Миграция каналов...');
        
        sqliteDb.all('SELECT * FROM channels', async (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            for (const row of rows) {
                try {
                    await pgPool.query(
                        'INSERT INTO channels (channel_id, channel_name, created_at) VALUES ($1, $2, $3) ON CONFLICT (channel_id) DO NOTHING',
                        [row.channel_id, row.channel_name || row.name, row.created_at || row.added_at]
                    );
                } catch (error) {
                    console.error('Ошибка при миграции канала:', row.channel_id, error);
                }
            }
            
            console.log(`✅ Мигрировано каналов: ${rows.length}`);
            resolve();
        });
    });
}

async function migrateAdmins() {
    return new Promise((resolve, reject) => {
        console.log('👥 Миграция администраторов...');
        
        sqliteDb.all('SELECT * FROM channel_admins', async (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            for (const row of rows) {
                try {
                    await pgPool.query(
                        'INSERT INTO channel_admins (channel_id, user_id, created_at) VALUES ($1, $2, $3)',
                        [row.channel_id, parseInt(row.user_id), row.created_at]
                    );
                } catch (error) {
                    console.error('Ошибка при миграции админа:', row.user_id, error);
                }
            }
            
            console.log(`✅ Мигрировано администраторов: ${rows.length}`);
            resolve();
        });
    });
}

async function migratePosts() {
    return new Promise((resolve, reject) => {
        console.log('📝 Миграция постов...');
        
        sqliteDb.all('SELECT * FROM posts', async (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            for (const row of rows) {
                try {
                    await pgPool.query(
                        `INSERT INTO posts (channel_id, message_text, success_text, fail_text, button_text, photo_file_id, message_id, created_at) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            row.channel_id,
                            row.message_text,
                            row.success_text,
                            row.fail_text || 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                            row.button_text || 'Проверить подписку',
                            row.photo_file_id,
                            row.message_id ? parseInt(row.message_id) : null,
                            row.created_at
                        ]
                    );
                } catch (error) {
                    console.error('Ошибка при миграции поста:', row.id, error);
                }
            }
            
            console.log(`✅ Мигрировано постов: ${rows.length}`);
            resolve();
        });
    });
}

async function showStats() {
    console.log('\n📊 Статистика после миграции:');
    
    const channelsCount = await pgPool.query('SELECT COUNT(*) FROM channels');
    const adminsCount = await pgPool.query('SELECT COUNT(*) FROM channel_admins');
    const postsCount = await pgPool.query('SELECT COUNT(*) FROM posts');
    
    console.log(`- Каналов: ${channelsCount.rows[0].count}`);
    console.log(`- Администраторов: ${adminsCount.rows[0].count}`);
    console.log(`- Постов: ${postsCount.rows[0].count}`);
}

// Запуск миграции
migrateData();
```

### Запуск миграции
```bash
# Установите старую зависимость SQLite (временно)
npm install sqlite3

# Запустите миграцию
node migrate.js

# Удалите SQLite зависимость
npm uninstall sqlite3
```

## ⚙️ Обновление конфигурации

### 1. Обновите .env файл
```env
# Старая конфигурация SQLite (удалите)
# DATABASE_PATH=./bot_database.db

# Новая конфигурация PostgreSQL
BOT_TOKEN=your_telegram_bot_token_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=subscription_bot
DB_USER=botuser
DB_PASSWORD=your_secure_password
DB_SSL=false
NODE_ENV=production
```

### 2. Обновите package.json
```json
{
  "dependencies": {
    "telegraf": "^4.15.6",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  }
}
```

### 3. Установите новые зависимости
```bash
npm install
```

## 🧪 Тестирование

### 1. Проверка подключения
```bash
# Создайте тестовый файл test-connection.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Подключение к PostgreSQL работает:', result.rows[0].now);
        
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM channels) as channels,
                (SELECT COUNT(*) FROM channel_admins) as admins,
                (SELECT COUNT(*) FROM posts) as posts
        `);
        
        console.log('📊 Статистика базы данных:', stats.rows[0]);
    } catch (error) {
        console.error('❌ Ошибка подключения:', error);
    } finally {
        await pool.end();
    }
}

testConnection();
```

```bash
# Запустите тест
node test-connection.js
```

### 2. Запуск бота
```bash
# Запустите бота для проверки
node bot.js
```

## 🗑️ Очистка

После успешной миграции и тестирования:

```bash
# Переместите старые файлы в архив
mkdir old_sqlite_backup
mv bot_database.db old_sqlite_backup/
mv bot_database_backup.db old_sqlite_backup/
mv migrate.js old_sqlite_backup/
mv test-connection.js old_sqlite_backup/

# Удалите временные файлы
rm -f *.db-journal
```

## 🚀 Production развертывание

Для production окружения рекомендуется:

### 1. Использовать SSL соединение
```env
DB_SSL=true
```

### 2. Настроить пул соединений
```javascript
// В database.js
const pool = new Pool({
    // ... другие параметры
    max: 20, // максимум соединений
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
```

### 3. Настроить резервное копирование
```bash
# Добавить в crontab
0 2 * * * /usr/bin/pg_dump -h localhost -U botuser subscription_bot > /backup/subscription_bot_$(date +\%Y\%m\%d).sql
```

## 🆘 Решение проблем

### Ошибка подключения
```bash
# Проверьте статус PostgreSQL
sudo systemctl status postgresql

# Проверьте подключение
psql -h localhost -U botuser -d subscription_bot
```

### Ошибки прав доступа
```sql
-- Войдите как postgres
sudo -u postgres psql

-- Дайте права пользователю
GRANT ALL PRIVILEGES ON DATABASE subscription_bot TO botuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO botuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO botuser;
```

### Откат на SQLite
Если что-то пошло не так, вы можете вернуться к SQLite:
```bash
# Восстановите файлы
cp bot_database_backup.db bot_database.db
cp .env.backup .env

# Переустановите зависимости
npm uninstall pg
npm install sqlite3
```

---

**🎉 Поздравляем! Миграция на PostgreSQL завершена!**

Теперь ваш бот использует более мощную и масштабируемую базу данных PostgreSQL. 
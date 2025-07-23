# 🌐 Настройка удаленной PostgreSQL базы данных

Эта инструкция поможет настроить бота для работы с удаленным PostgreSQL сервером.

## 📋 Требования

- ✅ **Удаленный PostgreSQL сервер** (версия 12+)
- ✅ **Данные для подключения** (хост, порт, логин, пароль)
- ✅ **Права доступа** к базе данных
- ✅ **Node.js** с установленными зависимостями

## ⚙️ Настройка конфигурации

### 1. Настройте файл `.env`

```env
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token_here

# Remote PostgreSQL Database
DB_HOST=your-remote-server.com
DB_PORT=5432
DB_NAME=subscription_bot
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true

# Application
NODE_ENV=production
```

### 2. Важно для удаленного сервера
- Установите `DB_SSL=true` для безопасного соединения
- Убедитесь, что порт `5432` открыт для подключений
- Проверьте, что ваш IP разрешен в настройках сервера

## 🔧 Варианты настройки базы данных

### Вариант 1: Автоматическая настройка (рекомендуется)

```bash
# Установите зависимости
npm install

# Запустите скрипт создания таблиц
node setup-tables-only.js
```

### Вариант 2: Ручная настройка через SQL

Если у вас ограниченные права или автоматическая настройка не работает:

1. **Отправьте администратору БД файл `setup.sql`**
2. **Попросите выполнить его на сервере**
3. **Проверьте создание таблиц:**

```bash
node setup-tables-only.js
```

### Вариант 3: Настройка через веб-интерфейс

Многие хостинги предоставляют phpPgAdmin или Adminer:

1. **Войдите в веб-интерфейс вашей БД**
2. **Создайте базу данных `subscription_bot`**
3. **Выполните SQL команды из файла `setup.sql`**
4. **Проверьте результат скриптом:**

```bash
node setup-tables-only.js
```

## 🧪 Проверка подключения

### Тест подключения
```bash
node -e "
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.log('❌ Ошибка:', err.message);
    } else {
        console.log('✅ Подключение успешно:', res.rows[0].now);
    }
    pool.end();
});
"
```

### Проверка таблиц
```bash
node -e "
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.query(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public'\", (err, res) => {
    if (err) {
        console.log('❌ Ошибка:', err.message);
    } else {
        console.log('📋 Таблицы:', res.rows.map(r => r.tablename));
    }
    pool.end();
});
"
```

## 🚀 Запуск бота

После успешной настройки БД:

```bash
# Разработка
npm run dev

# Продакшн
npm start

# Или через PM2
pm2 start ecosystem.config.js
```

## ❌ Решение проблем

### 1. "Connection refused"
```
❌ Проблема: Сервер недоступен или порт закрыт
✅ Решение: 
   - Проверьте хост и порт в .env
   - Убедитесь что сервер запущен
   - Проверьте файрвол/правила безопасности
```

### 2. "Authentication failed"
```
❌ Проблема: Неверные данные для входа
✅ Решение:
   - Проверьте DB_USER и DB_PASSWORD в .env
   - Убедитесь что пользователь существует
   - Проверьте права пользователя
```

### 3. "Permission denied for schema public"
```
❌ Проблема: Недостаточно прав для создания таблиц
✅ Решение:
   - Обратитесь к админу БД
   - Предоставьте файл setup.sql
   - Или выполните команды:
     GRANT ALL ON SCHEMA public TO your_user;
     GRANT CREATE ON SCHEMA public TO your_user;
```

### 4. "SSL connection required"
```
❌ Проблема: Сервер требует SSL соединение
✅ Решение:
   - Установите DB_SSL=true в .env
   - Если проблемы с сертификатом:
     DB_SSL=true и добавьте rejectUnauthorized: false
```

### 5. "Database does not exist"
```
❌ Проблема: База данных не создана
✅ Решение:
   - Создайте БД через админ панель
   - Или попросите админа выполнить:
     CREATE DATABASE subscription_bot;
```

## 🔒 Безопасность

### Рекомендации для production:

1. **Используйте SSL соединения**
   ```env
   DB_SSL=true
   ```

2. **Создайте отдельного пользователя для бота**
   ```sql
   CREATE USER subscription_bot_user WITH ENCRYPTED PASSWORD 'strong_password';
   GRANT CONNECT ON DATABASE subscription_bot TO subscription_bot_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO subscription_bot_user;
   ```

3. **Ограничьте доступ по IP**
   - Настройте `pg_hba.conf` для разрешения подключений только с нужных IP

4. **Используйте переменные окружения**
   - Никогда не храните пароли в коде
   - Используйте `.env` файл

5. **Регулярные бэкапы**
   ```bash
   # Настройте автоматический бэкап
   pg_dump -h your-host -U your-user subscription_bot > backup.sql
   ```

## 🌍 Популярные хостинги PostgreSQL

### 1. **Heroku Postgres**
```env
DB_HOST=ec2-xxx-xxx-xxx-xxx.compute-1.amazonaws.com
DB_PORT=5432
DB_SSL=true
```

### 2. **Digital Ocean Managed Database**
```env
DB_HOST=your-cluster-xxx.db.ondigitalocean.com
DB_PORT=25060
DB_SSL=true
```

### 3. **Amazon RDS**
```env
DB_HOST=your-instance.xxx.rds.amazonaws.com
DB_PORT=5432
DB_SSL=true
```

### 4. **Google Cloud SQL**
```env
DB_HOST=xxx.xxx.xxx.xxx
DB_PORT=5432
DB_SSL=true
```

### 5. **Railway**
```env
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=6543
DB_SSL=false
```

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте файл `bot.js` - там может быть детальная информация об ошибке
2. Запустите `node setup-tables-only.js` для диагностики
3. Убедитесь что все переменные в `.env` заданы правильно

**🎉 Удачи с настройкой вашего бота!** 
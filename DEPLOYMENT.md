# 🚀 Инструкция по развертыванию Subscription Checker Bot

## 📋 Требования системы

- **Node.js** версии 14.x или выше
- **npm** или **yarn**
- **PM2** (Process Manager 2)
- **Git** для клонирования репозитория

## 🛠 Шаг 1: Подготовка сервера

### Обновление системы (Ubuntu/Debian):
```bash
sudo apt update && sudo apt upgrade -y
```

### Установка Node.js:
```bash
# Установка Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка версии
node --version
npm --version
```

### Установка PM2 глобально:
```bash
sudo npm install -g pm2
```

## 📥 Шаг 2: Клонирование и настройка проекта

### Клонирование репозитория:
```bash
cd /opt
sudo git clone https://github.com/your-username/subBotChecker.git
cd subBotChecker
```

### Установка зависимостей:
```bash
sudo npm install
```

### Настройка переменных окружения:
```bash
# Создание файла .env
sudo nano .env
```

Добавьте в файл `.env`:
```env
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
DATABASE_PATH=./bot_database.db
NODE_ENV=production
```

### Установка прав доступа:
```bash
# Создание пользователя для бота
sudo useradd -r -s /bin/false botuser

# Изменение владельца папки
sudo chown -R botuser:botuser /opt/subBotChecker

# Установка прав доступа
sudo chmod -R 755 /opt/subBotChecker
sudo chmod 600 /opt/subBotChecker/.env
```

## ⚙️ Шаг 3: Создание конфигурации PM2

### Создание файла конфигурации:
```bash
sudo nano /opt/subBotChecker/ecosystem.config.js
```

Содержимое файла `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'subscription-checker-bot',
    script: './bot.js',
    cwd: '/opt/subBotChecker',
    user: 'botuser',
    instances: 1,
    exec_mode: 'fork',
    
    // Переменные окружения
    env: {
      NODE_ENV: 'production',
      DATABASE_PATH: './bot_database.db'
    },
    
    // Настройки автоперезапуска
    watch: false,
    max_memory_restart: '200M',
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Логирование
    log_file: '/var/log/pm2/subscription-bot.log',
    out_file: '/var/log/pm2/subscription-bot-out.log',
    error_file: '/var/log/pm2/subscription-bot-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Дополнительные настройки
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
};
```

### Создание директории для логов:
```bash
sudo mkdir -p /var/log/pm2
sudo chown -R botuser:botuser /var/log/pm2
```

## 🚀 Шаг 4: Запуск приложения

### Запуск бота через PM2:
```bash
# Переход в директорию проекта
cd /opt/subBotChecker

# Запуск приложения
sudo -u botuser pm2 start ecosystem.config.js

# Проверка статуса
sudo -u botuser pm2 status
```

### Полезные команды PM2:
```bash
# Просмотр статуса всех процессов
sudo -u botuser pm2 list

# Просмотр логов
sudo -u botuser pm2 logs subscription-checker-bot

# Перезапуск приложения
sudo -u botuser pm2 restart subscription-checker-bot

# Остановка приложения
sudo -u botuser pm2 stop subscription-checker-bot

# Удаление из PM2
sudo -u botuser pm2 delete subscription-checker-bot

# Мониторинг в реальном времени
sudo -u botuser pm2 monit
```

## 🔄 Шаг 5: Настройка автозапуска

### Генерация startup скрипта:
```bash
# Генерация скрипта автозапуска
sudo pm2 startup systemd -u botuser --hp /home/botuser

# Следуйте инструкциям, которые покажет PM2
# Обычно нужно выполнить команду вида:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u botuser --hp /home/botuser
```

### Сохранение текущих процессов:
```bash
# Переключение на пользователя botuser
sudo -u botuser pm2 save

# Проверка автозапуска
sudo systemctl status pm2-botuser
```

### Проверка автозапуска:
```bash
# Перезагрузка сервера для проверки
sudo reboot

# После перезагрузки проверьте:
sudo -u botuser pm2 list
```

## 📊 Шаг 6: Настройка мониторинга

### Создание скрипта для проверки здоровья:
```bash
sudo nano /opt/subBotChecker/health-check.sh
```

Содержимое `health-check.sh`:
```bash
#!/bin/bash

BOT_STATUS=$(sudo -u botuser pm2 jlist | jq -r '.[] | select(.name=="subscription-checker-bot") | .pm2_env.status')

if [ "$BOT_STATUS" != "online" ]; then
    echo "$(date): Bot is $BOT_STATUS, restarting..." >> /var/log/bot-health.log
    sudo -u botuser pm2 restart subscription-checker-bot
    
    # Отправка уведомления (опционально)
    # curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    #      -d "chat_id=YOUR_ADMIN_CHAT_ID" \
    #      -d "text=🚨 Bot was restarted due to health check failure"
fi
```

### Добавление в crontab:
```bash
sudo chmod +x /opt/subBotChecker/health-check.sh

# Редактирование crontab
sudo crontab -e

# Добавьте строку для проверки каждые 5 минут:
*/5 * * * * /opt/subBotChecker/health-check.sh
```

## 🔒 Шаг 7: Безопасность

### Настройка файрвола (UFW):
```bash
# Включение файрвола
sudo ufw enable

# Разрешение SSH
sudo ufw allow ssh

# Разрешение исходящих соединений для Telegram API
sudo ufw allow out 443
sudo ufw allow out 80

# Проверка статуса
sudo ufw status
```

### Настройка logrotate:
```bash
sudo nano /etc/logrotate.d/subscription-bot
```

Содержимое файла logrotate:
```
/var/log/pm2/subscription-bot*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        sudo -u botuser pm2 reloadLogs
    endscript
}
```

## 🆕 Шаг 8: Обновление приложения

### Создание скрипта обновления:
```bash
sudo nano /opt/subBotChecker/update.sh
```

Содержимое `update.sh`:
```bash
#!/bin/bash

cd /opt/subBotChecker

echo "🔄 Updating Subscription Checker Bot..."

# Резервная копия базы данных
cp bot_database.db bot_database.db.backup.$(date +%Y%m%d_%H%M%S)

# Остановка приложения
sudo -u botuser pm2 stop subscription-checker-bot

# Обновление кода
sudo git pull origin main

# Установка новых зависимостей
sudo npm install

# Запуск приложения
sudo -u botuser pm2 start subscription-checker-bot

echo "✅ Update completed!"
```

### Использование скрипта обновления:
```bash
sudo chmod +x /opt/subBotChecker/update.sh
sudo /opt/subBotChecker/update.sh
```

## 📈 Полезные команды для администрирования

### Просмотр ресурсов:
```bash
# Использование памяти и CPU
sudo -u botuser pm2 monit

# Детальная информация о процессе
sudo -u botuser pm2 show subscription-checker-bot

# Просмотр логов в реальном времени
sudo -u botuser pm2 logs --lines 100
```

### Резервное копирование:
```bash
# Создание резервной копии
sudo tar -czf /backup/subbot-$(date +%Y%m%d).tar.gz /opt/subBotChecker

# Автоматическое резервное копирование (добавить в crontab)
0 2 * * * tar -czf /backup/subbot-$(date +\%Y\%m\%d).tar.gz /opt/subBotChecker
```

## 🐛 Решение проблем

### Проверка статуса:
```bash
# Статус PM2 процессов
sudo -u botuser pm2 status

# Проверка системных логов
sudo journalctl -u pm2-botuser -f

# Проверка файлов лога бота
sudo tail -f /var/log/pm2/subscription-bot-error.log
```

### Перезапуск всех служб:
```bash
# Полный перезапуск PM2
sudo systemctl restart pm2-botuser
sudo -u botuser pm2 resurrect
```

## ✅ Проверка развертывания

После выполнения всех шагов проверьте:

1. **Статус процесса:** `sudo -u botuser pm2 status`
2. **Логи без ошибок:** `sudo -u botuser pm2 logs --lines 20`
3. **Автозапуск:** `sudo systemctl status pm2-botuser`
4. **Работоспособность бота:** отправьте команду `/start` в Telegram

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `sudo -u botuser pm2 logs`
2. Убедитесь в правильности токена бота
3. Проверьте доступ к интернету
4. Убедитесь в наличии прав доступа к файлам

---

**🎉 Поздравляем! Ваш Subscription Checker Bot успешно развернут и готов к работе!** 
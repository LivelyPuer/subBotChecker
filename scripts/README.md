# 📁 Скрипты автоматизации

Эта папка содержит скрипты для автоматизации развертывания и обслуживания Subscription Checker Bot.

## 📄 Доступные скрипты

### 🚀 `deploy.sh`
**Автоматическое развертывание бота**

Полностью автоматизированный скрипт для развертывания бота на production сервере.

```bash
# Запуск с правами администратора
sudo bash scripts/deploy.sh
```

**Что делает:**
- ✅ Проверяет и устанавливает Node.js 18.x LTS
- ✅ Устанавливает PM2 глобально
- ✅ Создает пользователя `botuser`
- ✅ Настраивает проект в `/opt/subBotChecker`
- ✅ Устанавливает зависимости
- ✅ Запускает бота через PM2
- ✅ Настраивает автозапуск при перезагрузке
- ✅ Создает скрипты обслуживания
- ✅ Настраивает мониторинг

### 🔍 `health-check.sh`
**Мониторинг здоровья бота**

Проверяет состояние бота и автоматически перезапускает при необходимости.

```bash
# Ручной запуск
bash scripts/health-check.sh

# Автоматический запуск (настраивается в cron)
*/5 * * * * /opt/subBotChecker/health-check.sh
```

**Проверки:**
- 🔄 Статус PM2 процесса
- 💾 Использование памяти (перезапуск при >500MB)
- ⏱️ Время работы (предупреждение о частых перезапусках)
- 💽 Доступность базы данных
- 📂 Использование дискового пространства
- 📞 Отправка уведомлений в Telegram (опционально)

### 💾 `backup.sh`
**Резервное копирование**

Создает резервные копии базы данных и конфигурации бота.

```bash
# Создать резервную копию
bash scripts/backup.sh

# Очистить старые копии (старше 7 дней)
bash scripts/backup.sh cleanup

# Показать статистику
bash scripts/backup.sh stats

# Восстановление (в разработке)
bash scripts/backup.sh restore backup_file.tar.gz
```

**Что включается в резервную копию:**
- 🗃️ База данных SQLite (`bot_database.db`)
- ⚙️ Конфигурационные файлы (`.env`, `ecosystem.config.js`)
- 📦 Файлы пакетов (`package.json`, `package-lock.json`)
- 📝 Последние логи (1000 строк)

## 🔧 Настройка автоматизации

### Автоматическое резервное копирование
```bash
# Добавить в crontab для ежедневного резервного копирования в 2:00
echo "0 2 * * * /opt/subBotChecker/scripts/backup.sh" | sudo crontab -
```

### Мониторинг здоровья
```bash
# Добавить в crontab для проверки каждые 5 минут
echo "*/5 * * * * /opt/subBotChecker/scripts/health-check.sh" | sudo crontab -
```

### Автоматические обновления
```bash
# Еженедельное обновление в воскресенье в 3:00
echo "0 3 * * 0 /opt/subBotChecker/update.sh" | sudo crontab -
```

## 📊 Логирование

### Расположение логов:
- **PM2 логи:** `/opt/subBotChecker/logs/`
- **Health check:** `/var/log/bot-health.log`
- **Резервные копии:** `/backup/subBotChecker/`

### Просмотр логов:
```bash
# PM2 логи в реальном времени
sudo -u botuser pm2 logs subscription-checker-bot

# Логи мониторинга
tail -f /var/log/bot-health.log

# Статус всех процессов
sudo -u botuser pm2 status
```

## 🚨 Устранение неполадок

### Проблема: Бот не запускается
```bash
# Проверить статус
sudo -u botuser pm2 status

# Посмотреть ошибки
sudo -u botuser pm2 logs subscription-checker-bot --err

# Перезапустить
sudo -u botuser pm2 restart subscription-checker-bot
```

### Проблема: Высокое использование памяти
```bash
# Проверить использование ресурсов
sudo -u botuser pm2 monit

# Перезапустить процесс
sudo -u botuser pm2 restart subscription-checker-bot
```

### Проблема: База данных недоступна
```bash
# Проверить права доступа
ls -la /opt/subBotChecker/bot_database.db

# Исправить права
sudo chown botuser:botuser /opt/subBotChecker/bot_database.db
sudo chmod 644 /opt/subBotChecker/bot_database.db
```

## 📞 Поддержка

При возникновении проблем со скриптами:

1. **Проверьте логи:** `tail -f /var/log/bot-health.log`
2. **Убедитесь в правах доступа:** скрипты должны быть исполняемыми
3. **Проверьте переменные окружения:** файл `.env` должен быть настроен
4. **Запустите с отладкой:** добавьте `set -x` в начало скрипта

---

**💡 Совет:** Для максимальной надежности рекомендуется настроить все три скрипта для автоматической работы через cron. 
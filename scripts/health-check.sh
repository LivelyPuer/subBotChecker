#!/bin/bash

# 🔍 Скрипт проверки здоровья Subscription Checker Bot
# Проверяет статус бота и перезапускает при необходимости

LOG_FILE="/var/log/bot-health.log"
PROJECT_DIR="/opt/subBotChecker"

# Функция логирования
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

# Проверка статуса PM2 процесса
check_pm2_status() {
    local status=$(sudo -u botuser pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="subscription-checker-bot") | .pm2_env.status' 2>/dev/null)
    echo $status
}

# Проверка использования памяти
check_memory_usage() {
    local memory=$(sudo -u botuser pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="subscription-checker-bot") | .monit.memory' 2>/dev/null)
    if [[ "$memory" =~ ^[0-9]+$ ]]; then
        # Конвертируем в MB
        local memory_mb=$((memory / 1024 / 1024))
        echo $memory_mb
    else
        echo "0"
    fi
}

# Проверка времени работы
check_uptime() {
    local uptime=$(sudo -u botuser pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="subscription-checker-bot") | .pm2_env.pm_uptime' 2>/dev/null)
    if [[ "$uptime" =~ ^[0-9]+$ ]]; then
        local current_time=$(date +%s000)  # Время в миллисекундах
        local uptime_seconds=$(( (current_time - uptime) / 1000 ))
        echo $uptime_seconds
    else
        echo "0"
    fi
}

# Проверка доступности базы данных
check_database() {
    if [[ -f "$PROJECT_DIR/bot_database.db" ]]; then
        if [[ -r "$PROJECT_DIR/bot_database.db" ]]; then
            echo "ok"
        else
            echo "not_readable"
        fi
    else
        echo "not_found"
    fi
}

# Отправка уведомления в Telegram (опционально)
send_telegram_notification() {
    local message="$1"
    
    # Загружаем переменные окружения
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        source $PROJECT_DIR/.env
        
        # Если настроены токен и chat_id для уведомлений
        if [[ -n "$BOT_TOKEN" && -n "$ADMIN_CHAT_ID" ]]; then
            curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
                 -d "chat_id=$ADMIN_CHAT_ID" \
                 -d "text=🤖 $message" \
                 -d "parse_mode=Markdown" >/dev/null 2>&1
        fi
    fi
}

# Основная проверка
main_check() {
    local bot_status=$(check_pm2_status)
    local memory_usage=$(check_memory_usage)
    local uptime=$(check_uptime)
    local db_status=$(check_database)
    
    log_message "Health check - Status: $bot_status, Memory: ${memory_usage}MB, Uptime: ${uptime}s, DB: $db_status"
    
    # Проверка статуса процесса
    if [[ "$bot_status" != "online" ]]; then
        log_message "Bot is $bot_status, attempting restart..."
        sudo -u botuser pm2 restart subscription-checker-bot
        
        # Ждем 10 секунд и проверяем снова
        sleep 10
        local new_status=$(check_pm2_status)
        
        if [[ "$new_status" == "online" ]]; then
            log_message "Bot successfully restarted"
            send_telegram_notification "🔄 Bot was restarted due to status: $bot_status"
        else
            log_message "Failed to restart bot, status: $new_status"
            send_telegram_notification "🚨 Failed to restart bot! Status: $new_status"
        fi
        return
    fi
    
    # Проверка использования памяти (если больше 500MB)
    if [[ $memory_usage -gt 500 ]]; then
        log_message "High memory usage detected: ${memory_usage}MB, restarting bot..."
        sudo -u botuser pm2 restart subscription-checker-bot
        send_telegram_notification "🔄 Bot restarted due to high memory usage: ${memory_usage}MB"
        return
    fi
    
    # Проверка времени работы (если меньше 30 секунд, возможно частые перезапуски)
    if [[ $uptime -lt 30 && $uptime -gt 0 ]]; then
        log_message "Bot uptime is very low: ${uptime}s, possible restart loop"
        send_telegram_notification "⚠️ Bot uptime is very low: ${uptime}s"
    fi
    
    # Проверка базы данных
    if [[ "$db_status" != "ok" ]]; then
        log_message "Database issue detected: $db_status"
        
        if [[ "$db_status" == "not_found" ]]; then
            log_message "Database file not found, this might be a serious issue"
            send_telegram_notification "🚨 Database file not found!"
        elif [[ "$db_status" == "not_readable" ]]; then
            log_message "Database file is not readable, fixing permissions..."
            chown botuser:botuser $PROJECT_DIR/bot_database.db
            chmod 644 $PROJECT_DIR/bot_database.db
        fi
    fi
    
    # Проверка дискового пространства
    local disk_usage=$(df $PROJECT_DIR | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        log_message "High disk usage detected: ${disk_usage}%"
        send_telegram_notification "⚠️ High disk usage: ${disk_usage}%"
    fi
}

# Создание лог файла если его нет
if [[ ! -f "$LOG_FILE" ]]; then
    touch $LOG_FILE
    chmod 644 $LOG_FILE
fi

# Ротация логов (оставляем последние 1000 строк)
if [[ -f "$LOG_FILE" ]]; then
    local line_count=$(wc -l < $LOG_FILE)
    if [[ $line_count -gt 1000 ]]; then
        tail -n 500 $LOG_FILE > ${LOG_FILE}.tmp
        mv ${LOG_FILE}.tmp $LOG_FILE
        log_message "Log file rotated"
    fi
fi

# Запуск основной проверки
main_check 
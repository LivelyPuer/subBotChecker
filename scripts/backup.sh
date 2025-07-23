#!/bin/bash

# 💾 Скрипт резервного копирования Subscription Checker Bot
# Создает резервные копии базы данных и конфигурации

PROJECT_DIR="/opt/subBotChecker"
BACKUP_DIR="/backup/subBotChecker"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="subbot_backup_$DATE"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Создание директории для резервных копий
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        print_status "Создана директория для резервных копий: $BACKUP_DIR"
    fi
}

# Проверка существования проекта
check_project() {
    if [[ ! -d "$PROJECT_DIR" ]]; then
        print_error "Директория проекта не найдена: $PROJECT_DIR"
        exit 1
    fi
}

# Создание резервной копии
create_backup() {
    local backup_path="$BACKUP_DIR/$BACKUP_NAME"
    
    print_status "Создание резервной копии в: $backup_path"
    
    # Создание временной директории
    local temp_dir="/tmp/$BACKUP_NAME"
    mkdir -p "$temp_dir"
    
    # Копирование важных файлов
    print_status "Копирование файлов..."
    
    # База данных
    if [[ -f "$PROJECT_DIR/bot_database.db" ]]; then
        cp "$PROJECT_DIR/bot_database.db" "$temp_dir/"
        print_status "✓ База данных скопирована"
    else
        print_error "База данных не найдена"
    fi
    
    # Конфигурационные файлы
    cp "$PROJECT_DIR/.env" "$temp_dir/" 2>/dev/null || print_error "Файл .env не найден"
    cp "$PROJECT_DIR/ecosystem.config.js" "$temp_dir/" 2>/dev/null || print_error "Файл ecosystem.config.js не найден"
    cp "$PROJECT_DIR/package.json" "$temp_dir/" 2>/dev/null
    cp "$PROJECT_DIR/package-lock.json" "$temp_dir/" 2>/dev/null
    
    # Логи (последние 1000 строк)
    if [[ -d "$PROJECT_DIR/logs" ]]; then
        mkdir -p "$temp_dir/logs"
        for log_file in "$PROJECT_DIR/logs"/*.log; do
            if [[ -f "$log_file" ]]; then
                tail -n 1000 "$log_file" > "$temp_dir/logs/$(basename "$log_file")" 2>/dev/null
            fi
        done
        print_status "✓ Логи скопированы"
    fi
    
    # Создание архива
    print_status "Создание архива..."
    cd /tmp
    tar -czf "$backup_path.tar.gz" "$BACKUP_NAME"
    
    # Удаление временной директории
    rm -rf "$temp_dir"
    
    if [[ -f "$backup_path.tar.gz" ]]; then
        local size=$(du -h "$backup_path.tar.gz" | cut -f1)
        print_success "Резервная копия создана: $backup_path.tar.gz ($size)"
        
        # Создание информационного файла
        cat > "$backup_path.info" << EOF
Backup Information
==================
Date: $(date)
Project Directory: $PROJECT_DIR
Backup Size: $size
Files Included:
- Database (bot_database.db)
- Configuration (.env, ecosystem.config.js)
- Package files (package.json, package-lock.json)
- Recent logs (last 1000 lines)

Restore Instructions:
1. Extract: tar -xzf $BACKUP_NAME.tar.gz
2. Copy files to project directory
3. Restart bot: sudo -u botuser pm2 restart subscription-checker-bot
EOF
        print_status "✓ Информационный файл создан"
    else
        print_error "Ошибка при создании архива"
        exit 1
    fi
}

# Очистка старых резервных копий
cleanup_old_backups() {
    local keep_days=${1:-7}  # По умолчанию храним 7 дней
    
    print_status "Очистка резервных копий старше $keep_days дней..."
    
    find "$BACKUP_DIR" -name "subbot_backup_*.tar.gz" -mtime +$keep_days -delete 2>/dev/null
    find "$BACKUP_DIR" -name "subbot_backup_*.info" -mtime +$keep_days -delete 2>/dev/null
    
    local remaining=$(find "$BACKUP_DIR" -name "subbot_backup_*.tar.gz" | wc -l)
    print_status "✓ Осталось резервных копий: $remaining"
}

# Проверка целостности резервной копии
verify_backup() {
    local backup_file="$BACKUP_DIR/$BACKUP_NAME.tar.gz"
    
    print_status "Проверка целостности резервной копии..."
    
    if tar -tzf "$backup_file" >/dev/null 2>&1; then
        print_success "✓ Резервная копия прошла проверку целостности"
    else
        print_error "✗ Резервная копия повреждена"
        exit 1
    fi
}

# Отправка уведомления
send_notification() {
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        source "$PROJECT_DIR/.env"
        
        if [[ -n "$BOT_TOKEN" && -n "$ADMIN_CHAT_ID" ]]; then
            local backup_size=$(du -h "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)
            local message="💾 *Backup completed*%0A%0ADate: $(date)%0ASize: $backup_size%0ALocation: $BACKUP_DIR"
            
            curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
                 -d "chat_id=$ADMIN_CHAT_ID" \
                 -d "text=$message" \
                 -d "parse_mode=Markdown" >/dev/null 2>&1
        fi
    fi
}

# Показ статистики резервных копий
show_backup_stats() {
    print_status "Статистика резервных копий:"
    
    local total_backups=$(find "$BACKUP_DIR" -name "subbot_backup_*.tar.gz" 2>/dev/null | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    
    echo "  Всего резервных копий: $total_backups"
    echo "  Общий размер: $total_size"
    
    if [[ $total_backups -gt 0 ]]; then
        echo "  Последние резервные копии:"
        find "$BACKUP_DIR" -name "subbot_backup_*.tar.gz" -printf "    %f (%TY-%Tm-%Td %TH:%TM)\n" 2>/dev/null | sort -r | head -5
    fi
}

# Основная функция
main() {
    print_success "💾 Начинаем создание резервной копии"
    
    check_project
    create_backup_dir
    create_backup
    verify_backup
    cleanup_old_backups 7
    send_notification
    show_backup_stats
    
    print_success "🎉 Резервное копирование завершено успешно!"
}

# Обработка параметров командной строки
case "${1:-backup}" in
    "backup")
        main
        ;;
    "cleanup")
        create_backup_dir
        cleanup_old_backups ${2:-7}
        ;;
    "stats")
        create_backup_dir
        show_backup_stats
        ;;
    "restore")
        if [[ -z "$2" ]]; then
            print_error "Укажите файл резервной копии для восстановления"
            echo "Использование: $0 restore <backup_file.tar.gz>"
            exit 1
        fi
        
        print_status "Восстановление из резервной копии: $2"
        # Здесь можно добавить логику восстановления
        print_error "Функция восстановления еще не реализована"
        ;;
    *)
        echo "Использование: $0 [backup|cleanup|stats|restore]"
        echo "  backup  - Создать резервную копию (по умолчанию)"
        echo "  cleanup - Очистить старые резервные копии"
        echo "  stats   - Показать статистику резервных копий"
        echo "  restore - Восстановить из резервной копии"
        exit 1
        ;;
esac 
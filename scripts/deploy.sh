#!/bin/bash

# 🚀 Скрипт автоматического развертывания Subscription Checker Bot
# Версия: 1.0

set -e  # Остановка при первой ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода цветного текста
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав администратора
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Этот скрипт должен запускаться с правами администратора (sudo)"
        exit 1
    fi
}

# Проверка системы
check_system() {
    print_status "Проверка операционной системы..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        print_success "Операционная система: $OS"
    else
        print_error "Не удалось определить операционную систему"
        exit 1
    fi
}

# Установка Node.js
install_nodejs() {
    print_status "Проверка Node.js..."
    
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js уже установлен: $NODE_VERSION"
    else
        print_status "Установка Node.js 18.x LTS..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        print_success "Node.js установлен: $(node --version)"
    fi
}

# Установка PM2
install_pm2() {
    print_status "Проверка PM2..."
    
    if command -v pm2 >/dev/null 2>&1; then
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 уже установлен: $PM2_VERSION"
    else
        print_status "Установка PM2..."
        npm install -g pm2
        print_success "PM2 установлен: $(pm2 --version)"
    fi
}

# Создание пользователя
create_user() {
    print_status "Создание пользователя для бота..."
    
    if id "botuser" &>/dev/null; then
        print_warning "Пользователь botuser уже существует"
    else
        useradd -r -m -s /bin/bash botuser
        print_success "Пользователь botuser создан"
    fi
}

# Настройка проекта
setup_project() {
    PROJECT_DIR="/opt/subBotChecker"
    
    print_status "Настройка проекта в $PROJECT_DIR..."
    
    # Создание директории проекта
    mkdir -p $PROJECT_DIR
    mkdir -p $PROJECT_DIR/logs
    
    # Копирование файлов (если запускается из директории проекта)
    if [[ -f "./package.json" ]]; then
        print_status "Копирование файлов проекта..."
        cp -r ./* $PROJECT_DIR/
        
        # Установка зависимостей
        cd $PROJECT_DIR
        npm install --production
        print_success "Зависимости установлены"
    else
        print_warning "Файлы проекта не найдены в текущей директории"
        print_status "Пожалуйста, скопируйте файлы проекта в $PROJECT_DIR вручную"
    fi
    
    # Установка прав доступа
    chown -R botuser:botuser $PROJECT_DIR
    chmod -R 755 $PROJECT_DIR
    
    # Создание файла .env если его нет
    if [[ ! -f "$PROJECT_DIR/.env" ]]; then
        print_status "Создание файла .env..."
        cat > $PROJECT_DIR/.env << EOF
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
DATABASE_PATH=./bot_database.db
NODE_ENV=production
EOF
        chmod 600 $PROJECT_DIR/.env
        chown botuser:botuser $PROJECT_DIR/.env
        print_warning "Не забудьте отредактировать файл $PROJECT_DIR/.env и добавить токен бота!"
    fi
    
    print_success "Проект настроен в $PROJECT_DIR"
}

# Запуск бота
start_bot() {
    PROJECT_DIR="/opt/subBotChecker"
    
    print_status "Запуск бота через PM2..."
    
    cd $PROJECT_DIR
    
    # Запуск от имени пользователя botuser
    sudo -u botuser pm2 start ecosystem.config.js
    
    # Настройка автозапуска
    print_status "Настройка автозапуска..."
    pm2 startup systemd -u botuser --hp /home/botuser
    sudo -u botuser pm2 save
    
    print_success "Бот запущен и добавлен в автозапуск"
}

# Создание скрипта обновления
create_update_script() {
    PROJECT_DIR="/opt/subBotChecker"
    
    print_status "Создание скрипта обновления..."
    
    cat > $PROJECT_DIR/update.sh << 'EOF'
#!/bin/bash

cd /opt/subBotChecker

echo "🔄 Updating Subscription Checker Bot..."

# Резервная копия базы данных
if [[ -f "bot_database.db" ]]; then
    cp bot_database.db bot_database.db.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Database backup created"
fi

# Остановка приложения
sudo -u botuser pm2 stop subscription-checker-bot
echo "🛑 Bot stopped"

# Обновление зависимостей
npm install --production
echo "📦 Dependencies updated"

# Запуск приложения
sudo -u botuser pm2 start subscription-checker-bot
echo "🚀 Bot started"

echo "✅ Update completed!"
EOF

    chmod +x $PROJECT_DIR/update.sh
    chown botuser:botuser $PROJECT_DIR/update.sh
    
    print_success "Скрипт обновления создан: $PROJECT_DIR/update.sh"
}

# Настройка мониторинга
setup_monitoring() {
    print_status "Настройка мониторинга..."
    
    # Установка jq для парсинга JSON
    if ! command -v jq >/dev/null 2>&1; then
        apt-get update
        apt-get install -y jq
    fi
    
    # Создание скрипта проверки здоровья
    cat > /opt/subBotChecker/health-check.sh << 'EOF'
#!/bin/bash

BOT_STATUS=$(sudo -u botuser pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="subscription-checker-bot") | .pm2_env.status' 2>/dev/null)

if [ "$BOT_STATUS" != "online" ]; then
    echo "$(date): Bot is $BOT_STATUS, restarting..." >> /var/log/bot-health.log
    sudo -u botuser pm2 restart subscription-checker-bot
fi
EOF

    chmod +x /opt/subBotChecker/health-check.sh
    
    # Добавление в crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/subBotChecker/health-check.sh") | crontab -
    
    print_success "Мониторинг настроен (проверка каждые 5 минут)"
}

# Показ статуса
show_status() {
    print_status "Проверка статуса бота..."
    
    echo -e "\n${BLUE}=== Статус PM2 ===${NC}"
    sudo -u botuser pm2 status
    
    echo -e "\n${BLUE}=== Последние логи ===${NC}"
    sudo -u botuser pm2 logs subscription-checker-bot --lines 10 --nostream
    
    echo -e "\n${GREEN}=== Развертывание завершено ===${NC}"
    echo -e "• Проект: /opt/subBotChecker"
    echo -e "• Логи: /opt/subBotChecker/logs/"
    echo -e "• Конфигурация: /opt/subBotChecker/.env"
    echo -e "• Обновление: /opt/subBotChecker/update.sh"
    echo -e "\n${YELLOW}Не забудьте настроить токен бота в файле .env!${NC}"
}

# Основная функция
main() {
    print_success "🚀 Начинаем развертывание Subscription Checker Bot"
    
    check_root
    check_system
    
    print_status "Обновление системы..."
    apt-get update && apt-get upgrade -y
    
    install_nodejs
    install_pm2
    create_user
    setup_project
    start_bot
    create_update_script
    setup_monitoring
    
    show_status
    
    print_success "🎉 Развертывание завершено успешно!"
}

# Запуск основной функции
main "$@" 
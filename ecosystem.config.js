module.exports = {
  apps: [{
    name: 'subscription-checker-bot',
    script: './bot.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Переменные окружения
    env: {
      NODE_ENV: 'production'
    },
    
    // Настройки автоперезапуска
    watch: false,
    max_memory_restart: '200M',
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Логирование
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Дополнительные настройки
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Настройки для разработки (закомментированы)
    // watch: true,
    // watch_delay: 1000,
    // ignore_watch: ['node_modules', 'logs', '*.db'],
    
    // Настройки для кластера (если нужно)
    // instances: 'max',
    // exec_mode: 'cluster'
  }]
}; 
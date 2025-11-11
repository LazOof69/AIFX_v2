/**
 * PM2 Ecosystem Configuration for Discord Bot
 * CRITICAL: Only 1 instance must run at a time
 */

module.exports = {
  apps: [{
    name: 'discord-bot',
    script: './bot.js',
    instances: 1,              // CRITICAL: Only 1 instance
    exec_mode: 'fork',         // Not cluster mode (cluster causes race conditions)
    watch: false,              // No auto-restart on file changes (use pm2 reload)
    max_restarts: 10,          // Max restart attempts
    min_uptime: '10s',         // Min uptime before considered stable
    restart_delay: 5000,       // Wait 5s before restart
    autorestart: true,         // Auto restart on crash
    max_memory_restart: '500M', // Restart if memory exceeds 500MB
    error_file: './logs/error.log',
    out_file: './logs/combined.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug'
    }
  }]
};

/**
 * PM2 Ecosystem Configuration
 * For production deployment with PM2 process manager
 */

module.exports = {
  apps: [
    {
      name: 'line-bot',
      script: 'bot.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Restart delay
      restart_delay: 4000,
      // Min uptime before considering app stable
      min_uptime: '10s',
      // Max restarts within min_uptime before giving up
      max_restarts: 10
    }
  ]
};

/**
 * PM2 Ecosystem — Mount Olympus
 * Start:   pm2 start /Users/zeus/olympus/ecosystem.config.cjs
 * Reload:  pm2 reload all
 * Logs:    pm2 logs
 *
 * NOTE: PM2 is the primary process manager for the Zeus framework.
 * LaunchAgent plists at ~/Library/LaunchAgents/ are DISABLED — do not use.
 * Restart framework: pm2 restart olympus-framework
 * View logs: pm2 logs olympus-framework --lines 100
 * Or: tail -f ~/.olympus/logs/framework-out.log
 */

const NODE = '/Users/zeus/.local/share/fnm/node-versions/v22.22.0/installation/bin/node';
const LOG_DIR = '/Users/zeus/.olympus/logs';

module.exports = {
  apps: [
    {
      name:          'olympus-framework',
      script:        'server.js',
      cwd:           '/Users/zeus/olympus/framework',
      interpreter:   NODE,
      autorestart:   true,
      restart_delay: 2000,
      max_restarts:  20,
      kill_timeout:  5000,
      out_file:      `${LOG_DIR}/framework-out.log`,
      error_file:    `${LOG_DIR}/framework-err.log`,
      merge_logs:    true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name:          'olympus-dashboard',
      script:        '/Users/zeus/olympus/dashboard/node_modules/.bin/vite',
      args:          'preview --host',
      cwd:           '/Users/zeus/olympus/dashboard',
      interpreter:   NODE,
      autorestart:   true,
      restart_delay: 2000,
      max_restarts:  20,
      out_file:      `${LOG_DIR}/dashboard-out.log`,
      error_file:    `${LOG_DIR}/dashboard-err.log`,
      merge_logs:    true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name:          'olympus-flywheel-coordinator',
      script:        'flywheel-coordinator.js',
      cwd:           '/Users/zeus/olympus/framework/flywheel',
      interpreter:   NODE,
      autorestart:   true,
      restart_delay: 2000,
      max_restarts:  20,
      kill_timeout:  5000,
      out_file:      `${LOG_DIR}/flywheel-coordinator-out.log`,
      error_file:    `${LOG_DIR}/flywheel-coordinator-err.log`,
      merge_logs:    true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      // @olympusforge_bot — Telegram build bot for flywheel
      // Token loaded from ~/olympus/framework/.env via dotenv/config in build-bot.js
      name:          'olympus-build-bot',
      script:        'build-bot.js',
      cwd:           '/Users/zeus/olympus/framework/flywheel',
      interpreter:   NODE,
      autorestart:   true,
      restart_delay: 2000,
      max_restarts:  10,
      kill_timeout:  5000,
      out_file:      `${LOG_DIR}/build-bot-out.log`,
      error_file:    `${LOG_DIR}/build-bot-err.log`,
      merge_logs:    true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

/**
 * PM2 Ecosystem — Mount Olympus
 * Start:   pm2 start /Users/zeus/olympus/ecosystem.config.cjs
 * Reload:  pm2 reload all
 * Logs:    pm2 logs
 */

const NODE = '/Users/zeus/.local/share/fnm/node-versions/v22.22.0/installation/bin/node';

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
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'aufmass-api',
      cwd: './server',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      env_file: './server/.env'
    }
  ]
};

module.exports = {
  apps: [
    {
      name: "janicka-shop",
      script: ".next/standalone/server.js",
      cwd: "/opt/janicka-shop",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 10,
      kill_timeout: 5000,
      listen_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
      out_file: "/var/log/pm2/janicka-shop-out.log",
      error_file: "/var/log/pm2/janicka-shop-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};

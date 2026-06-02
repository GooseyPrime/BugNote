module.exports = {
  apps: [
    {
      name: "bugnote-api",
      script: "apps/server/dist/index.js",
      cwd: "/home/bugnote/bugnote",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: "/var/log/bugnote/api.error.log",
      out_file: "/var/log/bugnote/api.out.log",
      time: true,
    },
    {
      name: "bugnote-worker",
      script: "apps/server/dist/worker.js",
      cwd: "/home/bugnote/bugnote",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "768M",
      env: { NODE_ENV: "production" },
      error_file: "/var/log/bugnote/worker.error.log",
      out_file: "/var/log/bugnote/worker.out.log",
      time: true,
    },
  ],
};

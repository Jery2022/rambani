module.exports = {
  apps: [
    {
      name: "node-chat-app",
      script: "./server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: true,
      env_development: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};

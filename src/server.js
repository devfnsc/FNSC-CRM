require("dotenv").config();

const { startServer } = require("./start");
const { createApp } = require("./app");

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp };

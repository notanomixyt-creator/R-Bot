"use strict";

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { client } = require("./config/client");
const { TOKEN } = require("./config/constants");
const { registerEvents } = require("./events");

registerEvents();

client.login(TOKEN).catch((error) => {
  console.error("Discord login failed:", error);
  process.exit(1);
});

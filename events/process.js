"use strict";

const { client } = require("../config/client");
const { clearPresenceTimer } = require("./ready");

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down...`);

  clearPresenceTimer();

  try { client.destroy(); } catch (error) { console.error("Client destroy failed:", error); }
  process.exit(signal === "UNCAUGHT_EXCEPTION" ? 1 : 0);
}

function registerProcessHandlers() {
  process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason));
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    shutdown("UNCAUGHT_EXCEPTION");
  });
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = { shutdown, registerProcessHandlers };

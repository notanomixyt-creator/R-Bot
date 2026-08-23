"use strict";

const { registerInteractionCreate } = require("./interactionCreate");
const { registerReady } = require("./ready");
const { registerProcessHandlers } = require("./process");

function registerEvents() {
  registerInteractionCreate();
  registerReady();
  registerProcessHandlers();
}

module.exports = { registerEvents };

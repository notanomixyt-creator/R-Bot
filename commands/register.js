"use strict";

const { Routes } = require("discord.js");
const { rest } = require("../config/client");
const { CLIENT_ID, SUPPORT_SERVER_ID } = require("../config/constants");
const { commands, FEMALE_COMMAND } = require("./definitions");

async function registerCommands() {
  await Promise.all([
    rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }),
    rest.put(Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID), { body: [FEMALE_COMMAND] }),
  ]);
}

module.exports = { registerCommands };

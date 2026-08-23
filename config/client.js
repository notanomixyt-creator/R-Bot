"use strict";

const {
  Client,
  GatewayIntentBits,
  REST,
} = require("discord.js");
const { TOKEN } = require("./constants");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: "10" }).setToken(TOKEN);

module.exports = { client, rest };

"use strict";

const { Events, ActivityType } = require("discord.js");
const { client } = require("../config/client");
const { registerCommands } = require("../commands/register");

const presenceMessages = ["Over Your Conversation", "YouTube"];
let presenceIndex = 0;
let presenceTimer = null;

function updatePresence() {
  if (!client.user) return;
  try {
    client.user.setPresence({
      status: "dnd",
      activities: [{
        name: presenceMessages[presenceIndex],
        type: ActivityType.Watching,
      }],
    });
    presenceIndex = (presenceIndex + 1) % presenceMessages.length;
  } catch (error) {
    console.error("Presence update failed:", error);
  }
}

function startPresence() {
  updatePresence();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(updatePresence, 5000);
  presenceTimer.unref?.();
}

async function onReady(bot) {
  console.log(`Logged in as ${bot.user.tag}`);
  try {
    await registerCommands();
    console.log("Application commands registered.");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
  startPresence();
}

function registerReady() {
  client.once(Events.ClientReady, onReady);
}

function clearPresenceTimer() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
}

module.exports = { onReady, registerReady, startPresence, updatePresence, clearPresenceTimer };

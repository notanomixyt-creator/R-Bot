"use strict";

const { Events } = require("discord.js");
const { client } = require("../config/client");
const { tosData } = require("../data/storage");
const { isBlacklisted, isSupportMember, accessDenied, tosPrompt } = require("../functions/access");
const { safeReply } = require("../functions/interaction");
const { panel } = require("../ui/builders");
const { handleCommand } = require("../commands/handler");
const { handleModerationButton, handleActionButton } = require("./buttons");

async function onInteractionCreate(interaction) {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    if (interaction.isButton() && (
      interaction.customId.startsWith("blacklist:") ||
      interaction.customId.startsWith("unblacklist:")
    )) {
      await handleModerationButton(interaction);
      return;
    }

    const userId = interaction.user.id;

    if (isBlacklisted(userId)) {
      await safeReply(interaction, panel("Blocked", "You are permanently blacklisted from using this bot."));
      return;
    }

    if (interaction.isButton() && (interaction.customId === "tos:accept" || interaction.customId === "tos:decline")) {
      await handleActionButton(interaction);
      return;
    }

    if (!(await isSupportMember(userId))) {
      await safeReply(interaction, accessDenied());
      return;
    }

    if (!tosData[userId]) {
      if (interaction.isButton() && interaction.customId === "tos:accept") {
        await handleActionButton(interaction);
      } else {
        await safeReply(interaction, tosPrompt());
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }

    if (interaction.isButton()) await handleActionButton(interaction);
  } catch (error) {
    console.error("Interaction handler error:", error);
    await safeReply(interaction, panel("Error", "Something went wrong while processing that action."));
  }
}

function registerInteractionCreate() {
  client.on(Events.InteractionCreate, onInteractionCreate);
}

module.exports = { onInteractionCreate, registerInteractionCreate };

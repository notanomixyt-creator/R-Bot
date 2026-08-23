"use strict";

const { MessageFlags } = require("discord.js");
const { V2, EPHEMERAL_V2 } = require("../ui/builders");

function isInteractionExpired(error) {
  return error?.code === 10062 || error?.code === 40060 || error?.code === 10015;
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (error) {
    if (!isInteractionExpired(error)) console.error("Reply failed:", error);
    return null;
  }
}

async function safeUpdate(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) return await interaction.editReply(payload);
    return await interaction.update(payload);
  } catch (error) {
    if (!isInteractionExpired(error)) console.error("Update failed:", error);
    return null;
  }
}

async function safeDeferUpdate(interaction) {
  try {
    if (interaction.replied || interaction.deferred) return true;
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    if (!isInteractionExpired(error)) console.error("deferUpdate failed:", error);
    return false;
  }
}

async function safeDeferEphemeral(interaction) {
  try {
    if (interaction.replied || interaction.deferred) return true;
    await interaction.deferReply({ flags: EPHEMERAL_V2 });
    return true;
  } catch (error) {
    if (!isInteractionExpired(error)) console.error("deferReply failed:", error);
    return false;
  }
}

module.exports = { V2, MessageFlags, isInteractionExpired, safeReply, safeUpdate, safeDeferUpdate, safeDeferEphemeral };

"use strict";

const { getSupportMember, isSupportMember, hasPremiumRole, isSupportServer, canUseFemale, isBlacklisted, isAdministrator } = require("./access");
const { panel } = require("../ui/builders");
const { accessDenied, supportRestricted } = require("./access");

async function ensureCommandAccess(interaction) {
  if (!(await isSupportMember(interaction.user.id))) {
    await require("./interaction").safeReply(interaction, accessDenied());
    return false;
  }

  if (isSupportServer(interaction)) {
    const allowed = interaction.commandName === "female";
    if (!allowed) {
      await require("./interaction").safeReply(interaction, supportRestricted());
      return false;
    }
  }

  if (isBlacklisted(interaction.user.id)) {
    await require("./interaction").safeReply(interaction, panel("Blocked", "You are permanently blacklisted from using this bot."));
    return false;
  }

  return true;
}

module.exports = { getSupportMember, isSupportMember, hasPremiumRole, isSupportServer, canUseFemale, isBlacklisted, isAdministrator, ensureCommandAccess };

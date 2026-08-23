"use strict";

const { PermissionsBitField } = require("discord.js");
const { client } = require("../config/client");
const { SUPPORT_SERVER_ID, SUPPORT_SERVER_INVITE, SUPPORT_FEMALE_CHANNEL_ID, PREMIUM_ROLE_ID, SUPPORT_CACHE_TTL_MS } = require("../config/constants");
const { blacklistedUsers } = require("../data/storage");
const { supportMemberCache } = require("./state");
const { buttonPanel, panel, neutralButton, linkButton } = require("../ui/builders");

function tosPrompt() {
  return buttonPanel(
    "Terms of Service",
    [
      "## Terms of Service",
      "By using this bot, you agree to our Terms of Service.",
      "",
      "Sending **NSFW**, **CSAM**, **gore**, or any other prohibited content is strictly forbidden and may result in being **permanently blacklisted**.",
    ].join("\n"),
    [neutralButton("tos:accept", "Accept"), neutralButton("tos:decline", "Decline")]
  );
}

function accessDenied() {
  return buttonPanel(
    "Access Denied",
    `You must be a member of the Larpify support server to use this bot.\n\n**Support Server:** ${SUPPORT_SERVER_INVITE}`,
    [linkButton("Join Server", SUPPORT_SERVER_INVITE)]
  );
}

function premiumRequired() {
  return buttonPanel(
    "Premium Required",
    "You don't have premium to use this command.\n\n**Boost Larpify Discord server to use this command.**",
    [linkButton("Larpify Server", SUPPORT_SERVER_INVITE)]
  );
}

function supportRestricted() {
  return panel("Restricted", "Commands are disabled in the support server.");
}

async function getSupportGuild() {
  return client.guilds.fetch(SUPPORT_SERVER_ID).catch(() => null);
}

async function getSupportMember(userId) {
  const cached = supportMemberCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.member;

  const guild = await getSupportGuild();
  if (!guild) return null;

  const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
  supportMemberCache.set(userId, {
    member,
    expiresAt: Date.now() + SUPPORT_CACHE_TTL_MS,
  });
  return member;
}

async function isSupportMember(userId) {
  return Boolean(await getSupportMember(userId));
}

async function hasPremiumRole(userId) {
  const member = await getSupportMember(userId);
  return Boolean(member?.roles?.cache?.has(PREMIUM_ROLE_ID));
}

function isSupportServer(interaction) {
  return interaction.guildId === SUPPORT_SERVER_ID;
}

function canUseFemale(interaction) {
  return isSupportServer(interaction) && interaction.channelId === SUPPORT_FEMALE_CHANNEL_ID;
}

function isBlacklisted(userId) {
  return blacklistedUsers.has(String(userId));
}

function isAdministrator(interaction) {
  return Boolean(
    interaction.inGuild() &&
    interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)
  );
}

module.exports = {
  tosPrompt,
  accessDenied,
  premiumRequired,
  supportRestricted,
  getSupportGuild,
  getSupportMember,
  isSupportMember,
  hasPremiumRole,
  isSupportServer,
  canUseFemale,
  isBlacklisted,
  isAdministrator,
};

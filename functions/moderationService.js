"use strict";

const { blacklistedUsers, saveBlacklist } = require("../data/storage");
const { findBadWord, extractLinks } = require("./moderation");
const { sendAutomodLog, sendLinkLog } = require("./logging");
const { safeReply } = require("./interaction");
const { panel } = require("../ui/builders");

async function autoBlacklistUser(interaction, matched, source) {
  const id = interaction.user.id;
  const wasBlacklisted = blacklistedUsers.has(id);
  blacklistedUsers.add(id);

  const persisted = saveBlacklist();
  void sendAutomodLog(interaction, matched, source, persisted);

  return {
    newlyBlacklisted: !wasBlacklisted,
    persisted,
    matched,
  };
}

async function moderateText(interaction, content, source) {
  const matched = findBadWord(content);
  if (matched) {
    await autoBlacklistUser(interaction, matched, source);
    await safeReply(
      interaction,
      panel(
        "Blocked",
        "Your message was blocked.",
        "Prohibited content was detected and your account has been blacklisted."
      )
    );
    return { blocked: true, links: [] };
  }

  const links = extractLinks(content);
  if (links.length) void sendLinkLog(interaction, links);
  return { blocked: false, links };
}

module.exports = { autoBlacklistUser, moderateText };

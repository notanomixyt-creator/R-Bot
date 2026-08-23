"use strict";

const { ActionRowBuilder } = require("discord.js");
const { client } = require("../config/client");
const { LAG_MESSAGES, SPAM_TEMPLATE, CUSTOM_SESSION_TTL_MS, SUPPORT_SERVER_ID, ALLOWED_MENTIONS_ALL, ALLOWED_MENTIONS_NONE } = require("../config/constants");
const { tosData, blacklistedUsers, saveTos, saveBlacklist } = require("../data/storage");
const { customSpamSessions, cleanupSessions } = require("../functions/state");
const { hasPremiumRole, isSupportMember, isSupportServer, isAdministrator, isBlacklisted } = require("../functions/access");
const { accessDenied, premiumRequired, supportRestricted } = require("../functions/access");
const { sendFiveMessages } = require("../functions/sender");
const { sendCommandLog } = require("../functions/logging");
const { safeReply, safeUpdate, safeDeferUpdate } = require("../functions/interaction");
const { panel, makeContainer, neutralButton, linkButton, V2, EPHEMERAL_V2 } = require("../ui/builders");
const { acceptedNitroPanel } = require("../functions/panels");
const { normalizeId } = require("../config/constants");

async function handleModerationButton(interaction) {
  if (!isAdministrator(interaction)) {
    await safeReply(interaction, panel("Restricted", "Administrator permission required."));
    return;
  }

  const [action, id] = interaction.customId.split(":");
  const targetId = normalizeId(id);
  if (!targetId) {
    await safeReply(interaction, panel("Error", "Invalid target user ID."));
    return;
  }

  if (action === "blacklist") blacklistedUsers.add(targetId);
  else if (action === "unblacklist") blacklistedUsers.delete(targetId);
  else return;

  const saved = saveBlacklist();
  await safeReply(
    interaction,
    panel(
      "Blacklist Updated",
      `User \`${targetId}\` has been ${action === "blacklist" ? "blacklisted" : "unblacklisted"}.`,
      saved ? "Saved successfully." : "Updated in memory; disk save failed."
    )
  );
}

async function handleActionButton(interaction) {
  const customId = interaction.customId;

  if (customId === "tos:accept") {
    if (!(await isSupportMember(interaction.user.id))) {
      await safeUpdate(interaction, accessDenied());
      return;
    }
    tosData[interaction.user.id] = true;
    if (!saveTos()) {
      await safeUpdate(interaction, panel("Error", "Your TOS acceptance could not be saved."));
      return;
    }
    await safeUpdate(interaction, panel("Accepted", "Terms of Service accepted. Access granted."));
    return;
  }

  if (customId === "tos:decline") {
    await safeUpdate(interaction, panel("Declined", "Terms of Service declined. Access denied."));
    return;
  }

  if (customId.startsWith("fake_nitro_accept:")) {
    if (customId.slice("fake_nitro_accept:".length) !== interaction.user.id) {
      await safeReply(interaction, panel("Restricted", "Only the gift recipient can use this button."));
      return;
    }
    if (!(await safeDeferUpdate(interaction))) return;
    const result = await sendFiveMessages(interaction, SPAM_TEMPLATE);
    void sendCommandLog(interaction, `Nitro accepted; ${result.sent}/5 sent.`);
    await safeUpdate(interaction, acceptedNitroPanel());
    return;
  }

  if (customId.startsWith("ghost_ping:")) {
    const targetId = normalizeId(customId.slice("ghost_ping:".length));
    if (!targetId) {
      await safeReply(interaction, panel("Error", "Invalid target user ID."));
      return;
    }

    if (!(await safeDeferUpdate(interaction))) return;

    try {
      const channel = interaction.channelId
        ? await client.channels.fetch(interaction.channelId).catch(() => null)
        : interaction.channel;

      if (!channel || typeof channel.send !== "function") {
        console.error("Ghost ping failed: channel is unavailable.");
        return;
      }

      const sentMessage = await channel.send({
        content: `<@${targetId}>`,
        allowedMentions: { parse: [], users: [targetId] },
      });

      setTimeout(() => {
        void sentMessage.delete().catch((error) => {
          if (error?.code !== 10008) console.error("Ghost ping deletion failed:", error);
        });
      }, 1000);
    } catch (error) {
      console.error("Ghost ping send failed:", error);
    }

    return;
  }

  cleanupSessions();

  if (customId.startsWith("batch_lag:")) {
    const [, type, ownerId] = customId.split(":");
    if (ownerId !== interaction.user.id) {
      await safeReply(interaction, panel("Restricted", "This button belongs to another user."));
      return;
    }
    if (!(await isSupportMember(interaction.user.id))) {
      await safeUpdate(interaction, accessDenied());
      return;
    }
    if (isSupportServer(interaction)) {
      await safeUpdate(interaction, supportRestricted());
      return;
    }
    if (!(await hasPremiumRole(interaction.user.id))) {
      await safeUpdate(interaction, premiumRequired());
      return;
    }
    const message = LAG_MESSAGES[type];
    if (!message) {
      await safeUpdate(interaction, panel("Configuration Error", `**LAG_TYPE_${type}** is not configured.`));
      return;
    }
    if (!(await safeDeferUpdate(interaction))) return;
    const result = await sendFiveMessages(interaction, message);
    void sendCommandLog(interaction, `Lag ${type}: ${result.sent}/5 sent, ${result.failed}/5 failed.`);
    return;
  }

  if (customId.startsWith("batch_spam:")) {
    const ownerId = customId.slice("batch_spam:".length);
    if (ownerId !== interaction.user.id) {
      await safeReply(interaction, panel("Restricted", "This button belongs to another user."));
      return;
    }
    if (!(await isSupportMember(interaction.user.id))) {
      await safeUpdate(interaction, accessDenied());
      return;
    }
    if (isSupportServer(interaction)) {
      await safeUpdate(interaction, supportRestricted());
      return;
    }
    if (!(await safeDeferUpdate(interaction))) return;
    const result = await sendFiveMessages(interaction, SPAM_TEMPLATE);
    void sendCommandLog(interaction, `Spam: ${result.sent}/5 sent, ${result.failed}/5 failed.`);
    return;
  }

  if (customId.startsWith("batch_custom:")) {
    const sessionId = customId.slice("batch_custom:".length);
    const session = customSpamSessions.get(sessionId);
    if (!session || Date.now() >= session.expiresAt) {
      customSpamSessions.delete(sessionId);
      await safeUpdate(interaction, panel("Expired", "This custom request has expired. Run `/customspam` again."));
      return;
    }
    if (session.userId !== interaction.user.id) {
      await safeReply(interaction, panel("Restricted", "This button belongs to another user."));
      return;
    }
    if (!(await isSupportMember(interaction.user.id))) {
      await safeUpdate(interaction, accessDenied());
      return;
    }
    if (isSupportServer(interaction)) {
      await safeUpdate(interaction, supportRestricted());
      return;
    }
    session.expiresAt = Date.now() + CUSTOM_SESSION_TTL_MS;
    if (!(await safeDeferUpdate(interaction))) return;
    const result = await sendFiveMessages(interaction, session.content);
    void sendCommandLog(interaction, `Custom spam: ${result.sent}/5 sent, ${result.failed}/5 failed.`);
  }
}

module.exports = { handleModerationButton, handleActionButton };

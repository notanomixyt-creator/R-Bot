"use strict";

const { client } = require("../config/client");
const { LAG_MESSAGES, SUPPORT_SERVER_ID, BOT_NAME, ALLOWED_MENTIONS_ALL } = require("../config/constants");
const { tosData } = require("../data/storage");
const { createCustomSession } = require("../functions/state");
const { recordCommandActivity } = require("../functions/profile");
const { moderateText } = require("../functions/moderationService");
const { ensureCommandAccess, hasPremiumRole, isSupportServer, canUseFemale } = require("../functions/membership");
const { sendCommandLog } = require("../functions/logging");
const { safeReply, safeUpdate } = require("../functions/interaction");
const { getFemalePhoto } = require("../functions/pexels");
const { uptimePanel, profilePanel, spamPanel, ghostPingPanel, nitroPanel, fakeTokenPanel, fakeIpPanel } = require("../functions/panels");
const { panel, makeContainer, neutralButton, linkButton, V2 } = require("../ui/builders");
const { MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder } = require("discord.js");

async function handleCommand(interaction) {
  if (!(await ensureCommandAccess(interaction))) return;
  recordCommandActivity(interaction);

  switch (interaction.commandName) {
    case "profile": {
      await safeReply(interaction, await profilePanel(interaction.user));
      return;
    }

    case "ping": {
      const started = process.hrtime.bigint();
      await safeReply(interaction, panel("Pong!", "Measuring response time..."));
      const ms = Math.max(0, Math.round(Number(process.hrtime.bigint() - started) / 1e6));
      await safeUpdate(interaction, panel(
        "Pong!",
        `**Roundtrip:** ${ms}ms`,
        `**WebSocket:** ${Math.max(0, Math.round(client.ws.ping))}ms`
      ));
      void sendCommandLog(interaction, `Roundtrip ${ms}ms | WebSocket ${client.ws.ping}ms`);
      return;
    }

    case "uptime": {
      await safeReply(interaction, uptimePanel());
      void sendCommandLog(interaction, `Uptime: ${require("../functions/utils").formatUptime(process.uptime())}`);
      return;
    }

    case "female": {
      if (!canUseFemale(interaction)) {
        await safeReply(interaction, panel("Restricted", "Commands are disabled in the support server."));
        return;
      }
      await safeReply(interaction, panel("Female", "Fetching a portrait..."));
      try {
        const imageUrl = await getFemalePhoto();
        await interaction.followUp({
          flags: V2,
          components: [
            makeContainer("Portrait Result")
              .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(imageUrl)
              ))
          ],
          allowedMentions: require("../config/constants").ALLOWED_MENTIONS_NONE,
        });
      } catch (error) {
        console.error("Female command failed:", error);
        await interaction.followUp(panel("Error", "Unable to fetch the image right now."));
      }
      return;
    }

    case "say": {
      const content = interaction.options.getString("message", true);
      const moderation = await moderateText(interaction, content, "say");
      if (moderation.blocked) return;

      await safeReply(interaction, panel("Say", "Sending message 1 time(s)..."));
      await interaction.followUp({ content, allowedMentions: ALLOWED_MENTIONS_ALL });
      void sendCommandLog(interaction, content);
      return;
    }

    case "lag": {
      const type = interaction.options.getInteger("type", true);
      const message = LAG_MESSAGES[type];
      if (!message) {
        await safeReply(interaction, panel("Configuration Error", `**LAG_TYPE_${type}** is not configured.`));
        return;
      }
      if (!(await hasPremiumRole(interaction.user.id))) {
        await safeReply(interaction, require("../functions/access").premiumRequired());
        return;
      }
      await safeReply(interaction, spamPanel(
        "Premium Feature",
        `batch_lag:${type}:${interaction.user.id}`,
        "Press **Start** to send 5 messages."
      ));
      return;
    }

    case "spam": {
      await safeReply(interaction, spamPanel(
        "Spam",
        `batch_spam:${interaction.user.id}`,
        "Press **Start** to send 5 messages."
      ));
      return;
    }

    case "customspam": {
      const content = interaction.options.getString("message", true);
      const moderation = await moderateText(interaction, content, "customspam");
      if (moderation.blocked) return;
      const sessionId = createCustomSession(interaction.user.id, content);
      await safeReply(interaction, spamPanel(
        "Custom Spam",
        `batch_custom:${sessionId}`,
        "Press **Start** to send 5 messages."
      ));
      return;
    }

    case "ghost-ping": {
      const target = interaction.options.getUser("user", true);
      await safeReply(interaction, ghostPingPanel(target));
      return;
    }

    case "blame": {
      const target = interaction.options.getUser("user", true);
      await safeReply(interaction, panel(
        "Blame",
        `Blaming **<@${target.id}>** for /spam...`,
        null,
        true,
        ALLOWED_MENTIONS_ALL
      ));

      await interaction.followUp(panel(
        "Thank You!",
        `Thank you **<@${target.id}>** for using **${BOT_NAME}**!`,
        `Your **/spam** operation has finished.`,
        false,
        ALLOWED_MENTIONS_ALL
      ));
      void sendCommandLog(interaction, `Blame operation completed for ${target.id}.`);
      return;
    }

    case "fake-nitro": {
      await safeReply(interaction, panel("Fake Nitro", "Sending fake Nitro gift..."));
      await interaction.followUp(nitroPanel(interaction.user));
      void sendCommandLog(interaction, `Fake Nitro shown to ${interaction.user.id}.`);
      return;
    }

    case "fake-token": {
      const target = interaction.options.getUser("user", true);
      await safeReply(interaction, panel("Fake Token", "Generating fake token..."));
      await interaction.followUp(fakeTokenPanel(target));
      void sendCommandLog(interaction, `Fake token generated for ${target.id}.`);
      return;
    }

    case "fake-ip": {
      const target = interaction.options.getUser("user", true);
      await safeReply(interaction, panel("Fake IP", "Generating fake IP..."));
      await interaction.followUp(fakeIpPanel(target));
      void sendCommandLog(interaction, `Fake IP generated for ${target.id}.`);
      return;
    }

    default:
      await safeReply(interaction, panel("Unavailable", "Command not configured."));
  }
}

module.exports = { handleCommand };

"use strict";

const { client } = require("../config/client");
const { LOG_CHANNEL_ID, LINK_USED_CHANNEL_ID, BOT_AUTOMOD_CHANNEL_ID, ALLOWED_MENTIONS_NONE } = require("../config/constants");
const { V2, panel, makeContainer, divider, text, neutralButton } = require("../ui/builders");
const { ActionRowBuilder } = require("discord.js");

function cleanLog(value, maxLength = 1500) {
  const output = String(value ?? "None").replace(/```/g, "'''").trim();
  return output.length <= maxLength ? output : `${output.slice(0, maxLength - 3)}...`;
}

async function getChannel(id) {
  const channel = await client.channels.fetch(id).catch(() => null);
  return channel?.isTextBased?.() ? channel : null;
}

async function sendCommandLog(interaction, output) {
  try {
    const channel = await getChannel(LOG_CHANNEL_ID);
    if (!channel) return;
    const container = makeContainer(
      "Log",
      `**User:** ${interaction.user.username}\n**ID:** \`${interaction.user.id}\`\n**Command:** \`${interaction.isChatInputCommand() ? `/${interaction.commandName}` : `Button (${interaction.customId})`}\``,
      `**Channel:** \`${interaction.channelId ?? "Unknown"}\`\n**Server:** \`${interaction.guildId ?? "DM"}\`\n\n**Output**\n\`\`\`\n${cleanLog(output)}\n\`\`\``
    );
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text("**Administrator Moderation**"));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      neutralButton(`blacklist:${interaction.user.id}`, "Blacklist"),
      neutralButton(`unblacklist:${interaction.user.id}`, "Unblacklist")
    ));
    await channel.send({ flags: V2, components: [container], allowedMentions: ALLOWED_MENTIONS_NONE });
  } catch (error) {
    console.error("Command log failed:", error);
  }
}

async function sendLinkLog(interaction, links) {
  if (!links.length) return;
  try {
    const channel = await getChannel(LINK_USED_CHANNEL_ID);
    if (!channel) return;
    const body = links.map((link) => `- \`${cleanLog(link, 900)}\``).join("\n");
    await channel.send(panel(
      "Link Used",
      `**User:** ${interaction.user.username}\n**ID:** \`${interaction.user.id}\`\n**Command:** \`/${interaction.commandName}\``,
      `**Links**\n${body}`,
      false
    ));
  } catch (error) {
    console.error("Link log failed:", error);
  }
}

async function sendAutomodLog(interaction, matched, source, persisted) {
  try {
    const channel = await getChannel(BOT_AUTOMOD_CHANNEL_ID);
    if (!channel) return;
    await channel.send(panel(
      "Auto Moderation",
      `**User:** ${interaction.user.username}\n**ID:** \`${interaction.user.id}\`\n**Source:** \`${cleanLog(source, 80)}\``,
      `**Matched:** \`${cleanLog(matched, 200)}\`\n**Action:** User blacklisted\n**Persistence:** ${persisted ? "Saved" : "Memory only"}`,
      false
    ));
  } catch (error) {
    console.error("Automod log failed:", error);
  }
}

module.exports = { cleanLog, getChannel, sendCommandLog, sendLinkLog, sendAutomodLog };

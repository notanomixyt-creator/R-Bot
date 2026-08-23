"use strict";

const crypto = require("node:crypto");
const { ActionRowBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require("discord.js");
const { BOT_NAME, SUPPORT_SERVER_INVITE, NITRO_IMAGE_URL, ALLOWED_MENTIONS_ALL, ALLOWED_MENTIONS_NONE, PROCESS_STARTED_AT_MS } = require("../config/constants");
const { tosData, profileData, blacklistedUsers } = require("../data/storage");
const { getProfile, mostUsedCommand } = require("./profile");
const { hasPremiumRole, isBlacklisted } = require("./access");
const { fakeIpHistory } = require("./state");
const { randomInt, randomHex, formatUptime, formatDiscordTimestamp, formatDiscordRelative } = require("./utils");
const { cleanLog } = require("./logging");
const { EPHEMERAL_V2, V2, text, divider, neutralButton, linkButton, makeContainer, panel, buttonPanel } = require("../ui/builders");

function uptimePanel() {
  return panel(
    "Uptime",
    `**Uptime:** ${formatUptime(process.uptime())}`,
    `**Started:** ${formatDiscordTimestamp(PROCESS_STARTED_AT_MS)}\n**Relative:** ${formatDiscordRelative(PROCESS_STARTED_AT_MS)}`
  );
}

async function profilePanel(user) {
  const profile = getProfile(user.id, user.username);
  const [mostUsed, mostCount] = mostUsedCommand(profile);
  const avatar = user.displayAvatarURL({ extension: "png", size: 256 });
  const lastActive = profile.lastActiveAt
    ? `${formatDiscordTimestamp(profile.lastActiveAt)} • ${formatDiscordRelative(profile.lastActiveAt)}`
    : "Not Available";

  const section = new (require("discord.js").SectionBuilder)()
    .addTextDisplayComponents(
      text(`**User**\n\`${cleanLog(user.username, 80)}\``),
      text(`**Commands**\n\`${Number(profile.commands || 0)}\``),
      text(`**Most Used**\n\`/${mostUsed} (${mostCount})\``)
    )
    .setThumbnailAccessory(new (require("discord.js").ThumbnailBuilder)().setURL(avatar));

  const container = makeContainer("Profile")
    .addSectionComponents(section)
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(`**Premium**\n\`${(await hasPremiumRole(user.id)) ? "Yes" : "No"}\`\n\n**Blacklisted**\n\`${isBlacklisted(user.id) ? "Yes" : "No"}\``),
      text(`**TOS Accepted**\n\`${tosData[user.id] ? "Yes" : "No"}\`\n\n**Last Active**\n${lastActive}`)
    );

  return { flags: EPHEMERAL_V2, components: [container], allowedMentions: ALLOWED_MENTIONS_NONE };
}

function ghostPingPanel(target) {
  const container = makeContainer(
    "Ghost Ping",
    `**Target:** <@${target.id}>`
  ).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      neutralButton(`ghost_ping:${target.id}`, "Ghost Ping")
    )
  );
  return {
    flags: EPHEMERAL_V2,
    components: [container],
    allowedMentions: ALLOWED_MENTIONS_ALL,
  };
}

function spamPanel(kind, customId, body) {
  return buttonPanel(kind, body, [neutralButton(customId, "Start")]);
}

function nitroPanel(user) {
  const container = makeContainer("Nitro")
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(NITRO_IMAGE_URL)
    ))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text("## You've been gifted a subscription!"),
      text(`**${BOT_NAME}** has gifted you Nitro for **3 months**.`),
      text("Expires in 48 hours.")
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        neutralButton(`fake_nitro_accept:${user.id}`, "Accept Gift"),
        linkButton("Learn More", SUPPORT_SERVER_INVITE)
      )
    );

  return { flags: V2, components: [container], allowedMentions: ALLOWED_MENTIONS_ALL };
}

function acceptedNitroPanel() {
  const container = makeContainer(
    "Nitro",
    "## Gift Accepted",
    `The gift action is complete.\n\n**${BOT_NAME}** sent the requested message batch.`
  ).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      neutralButton("fake_nitro_accepted", "Accepted", true),
      linkButton("Learn More", SUPPORT_SERVER_INVITE)
    )
  );
  return { flags: V2, components: [container], allowedMentions: ALLOWED_MENTIONS_NONE };
}

const FAKE_IP_PROFILES = [
  { label: "North America", ipv4: [23, 91], ipv6: "2606:4700" },
  { label: "Europe", ipv4: [31, 51], ipv6: "2a00:1450" },
  { label: "United Kingdom", ipv4: [81, 92], ipv6: "2a02:6b8" },
  { label: "Asia Pacific", ipv4: [103, 104], ipv6: "2404:6800" },
  { label: "Oceania", ipv4: [139, 144], ipv6: "2001:8003" },
  { label: "South America", ipv4: [177, 181], ipv6: "2804:14" },
];

function fakeIpForUser(userId) {
  const previous = fakeIpHistory.get(userId);
  let profile;
  do {
    profile = FAKE_IP_PROFILES[Math.floor(Math.random() * FAKE_IP_PROFILES.length)];
  } while (previous && previous.profile === profile.label && FAKE_IP_PROFILES.length > 1);

  const data = {
    profile: profile.label,
    ipv4: `${profile.ipv4[0]}.${profile.ipv4[1]}.${randomInt(1, 254)}.${randomInt(1, 254)}`,
    ipv6: `${profile.ipv6}:${randomHex(4)}:${randomHex(4)}:${randomHex(4)}:${randomHex(4)}:${randomHex(4)}:${randomHex(4)}`,
    protocol: Math.random() > 0.5 ? "TCP" : "UDP",
  };
  fakeIpHistory.set(userId, data);
  return data;
}

function fakeIpPanel(target) {
  const ip = fakeIpForUser(target.id);
  const container = makeContainer(
    "IP Information",
    `**Target:** <@${target.id}>`,
    `**IPv4:** \`${ip.ipv4}\`\n**IPv6:** \`${ip.ipv6}\`\n**Region:** ${ip.profile}\n**Protocol:** ${ip.protocol}`
  );
  return { flags: V2, components: [container], allowedMentions: ALLOWED_MENTIONS_ALL };
}

function fakeTokenPanel(target) {
  const raw = crypto.randomBytes(28).toString("base64url");
  const token = `${raw.slice(0, 24)}.${raw.slice(24, 30)}.${crypto.randomBytes(24).toString("base64url")}`;
  const container = makeContainer(
    "Fake Token",
    `**Target:** <@${target.id}>`,
    `**Token**\n\`${token}\``
  );
  return { flags: V2, components: [container], allowedMentions: ALLOWED_MENTIONS_ALL };
}

module.exports = {
  uptimePanel,
  profilePanel,
  ghostPingPanel,
  spamPanel,
  nitroPanel,
  acceptedNitroPanel,
  fakeIpForUser,
  fakeIpPanel,
  fakeTokenPanel,
};

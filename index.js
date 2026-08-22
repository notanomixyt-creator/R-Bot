"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ApplicationIntegrationType,
  InteractionContextType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function normalizeId(value) {
  const id = String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  return /^\d{17,20}$/.test(id) ? id : "";
}

const TOKEN = process.env.TOKEN?.trim();
const CLIENT_ID = normalizeId(process.env.CLIENT_ID);
const SUPPORT_SERVER_ID = normalizeId(process.env.SUPPORT_SERVER_ID);
const SUPPORT_FEMALE_CHANNEL_ID = normalizeId(process.env.SUPPORT_FEMALE_CHANNEL_ID);
const PREMIUM_ROLE_ID = normalizeId(process.env.PREMIUM_ROLE_ID);
const LOG_CHANNEL_ID = normalizeId(process.env.LOG_CHANNEL_ID);
const LINK_USED_CHANNEL_ID = normalizeId(process.env.LINK_USED_CHANNEL_ID);
const BOT_AUTOMOD_CHANNEL_ID = normalizeId(process.env.BOT_AUTOMOD_CHANNEL_ID);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY?.trim();

const SUPPORT_SERVER_INVITE = "https://discord.gg/aBsPJHGWPE";

const NITRO_IMAGE_URL =
  "https://cdn.discordapp.com/attachments/1539084725073744002/1539566265587343410/discord-nitro.png?ex=6a877111&is=6a861f91&hm=d97ffeda66d1fb663acc5d5ca95d6ed36e502892981c29a0d55c05d6af27c2e8&";

const BANNED_IMAGE_URL =
  "https://cdn.discordapp.com/attachments/1539084725073744002/1539566289994125382/discord-banned.jpg?ex=6a877117&is=6a861f97&hm=4d51bf8dbb3f62e8d5300c0a57d483a00e19b399f98009ab59a64274926fda51&";

const requiredEnv = {
  TOKEN,
  CLIENT_ID,
  SUPPORT_SERVER_ID,
  SUPPORT_FEMALE_CHANNEL_ID,
  PREMIUM_ROLE_ID,
  LOG_CHANNEL_ID,
  LINK_USED_CHANNEL_ID,
  BOT_AUTOMOD_CHANNEL_ID,
  PEXELS_API_KEY,
};

for (const [name, value] of Object.entries(requiredEnv)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Mentions                                                                   */
/* -------------------------------------------------------------------------- */

const ALLOWED_MENTIONS_ALL = Object.freeze({
  parse: ["users", "roles", "everyone"],
});

const ALLOWED_MENTIONS_NONE = Object.freeze({
  parse: [],
});

/* -------------------------------------------------------------------------- */
/* Lag / spam                                                                 */
/* -------------------------------------------------------------------------- */

const LAG_MESSAGES = {
  1: process.env.LAG_TYPE_1?.trim() || null,
  2: process.env.LAG_TYPE_2?.trim() || null,
  3: process.env.LAG_TYPE_3?.trim() || null,
  4: process.env.LAG_TYPE_4?.trim() || null,
};

const SPAM_TEMPLATE = `# [Larpify](https://discord.gg/aBsPJHGWPE)
## **Powerful Discord Bots**

### • Fast & Reliable
### • Built For Discord Communities
### • And More...

-# @everyone`;

/* -------------------------------------------------------------------------- */
/* Auto moderation                                                            */
/* -------------------------------------------------------------------------- */

const BAD_WORD_PATTERNS = [
  /\bsex\b/i,
  /\bnigga\b/i,
  /\bnigger\b/i,
  /\brape\b/i,
  /\bporn\b/i,
  /\bfuck\b/i,
  /\bfucking\b/i,
  /\bbitch\b/i,
  /\bslut\b/i,
  /\bwhore\b/i,
  /\bcunt\b/i,
  /\bdick\b/i,
  /\bpussy\b/i,
  /\bpedophile\b/i,
  /\bpedo\b/i,
  /\bcsam\b/i,
];

const URL_PATTERN =
  /(?:^|[\s<(\[])(?:(?:https?|ftp):\/\/|www\.|(?:discord\.gg|discord\.com\/invite\/)|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?:[^\s<>()\]"']*)/gi;

function findBadWord(content) {
  const value = String(content ?? "");

  for (const pattern of BAD_WORD_PATTERNS) {
    pattern.lastIndex = 0;
    const match = value.match(pattern);
    pattern.lastIndex = 0;

    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
}

function extractLinks(content) {
  const matches = String(content ?? "").match(URL_PATTERN) || [];
  const links = [];

  for (const raw of matches) {
    const cleaned = raw
      .trim()
      .replace(/^[<([\[]+/, "")
      .replace(/[>\])},.!?]+$/g, "");

    if (cleaned && !links.includes(cleaned)) {
      links.push(cleaned);
    }
  }

  return links;
}

function cleanInline(value, maxLength = 900) {
  const output = String(value ?? "")
    .replace(/[`]/g, "'")
    .replace(/\r?\n/g, " ")
    .trim();

  return output.length <= maxLength
    ? output
    : `${output.slice(0, maxLength - 3)}...`;
}

/* -------------------------------------------------------------------------- */
/* Client                                                                     */
/* -------------------------------------------------------------------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

const DATA_DIR = path.join(__dirname, "data");
const TOS_PATH = path.join(DATA_DIR, "tos.json");
const BLACKLIST_PATH = path.join(DATA_DIR, "blacklist.json");

function ensureDataDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(TOS_PATH)) {
    fs.writeFileSync(TOS_PATH, "{}\n", "utf8");
  }

  if (!fs.existsSync(BLACKLIST_PATH)) {
    fs.writeFileSync(BLACKLIST_PATH, "[]\n", "utf8");
  }
}

ensureDataDirectory();

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        `${JSON.stringify(fallback, null, 2)}\n`,
        "utf8"
      );
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function writeJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8"
    );

    fs.renameSync(temporaryPath, filePath);
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);

    try {
      if (fs.existsSync(temporaryPath)) {
        fs.unlinkSync(temporaryPath);
      }
    } catch {}

    return false;
  }
}

const rawTos = readJson(TOS_PATH, {});
const tosData =
  rawTos &&
  typeof rawTos === "object" &&
  !Array.isArray(rawTos)
    ? rawTos
    : {};

const rawBlacklist = readJson(BLACKLIST_PATH, []);
const blacklistedUsers = new Set(
  Array.isArray(rawBlacklist)
    ? rawBlacklist
        .map(String)
        .filter((id) => Boolean(normalizeId(id)))
    : []
);

function saveTos() {
  return writeJson(TOS_PATH, tosData);
}

function saveBlacklist() {
  return writeJson(BLACKLIST_PATH, [...blacklistedUsers]);
}

/* -------------------------------------------------------------------------- */
/* Session / cooldown state                                                   */
/* -------------------------------------------------------------------------- */

const customSpamSessions = new Map();
const buttonCooldowns = new Map();

const SESSION_TTL = 15 * 60 * 1000;
const BUTTON_COOLDOWN = 2500;

function createCustomSession(userId, content) {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL;

  customSpamSessions.set(sessionId, {
    userId,
    content,
    expiresAt,
  });

  const timer = setTimeout(() => {
    customSpamSessions.delete(sessionId);
  }, SESSION_TTL);

  timer.unref?.();

  return sessionId;
}

function cleanupSessions() {
  const now = Date.now();

  for (const [sessionId, session] of customSpamSessions) {
    if (!session || now >= session.expiresAt) {
      customSpamSessions.delete(sessionId);
    }
  }
}

function getCooldown(userId, action) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const expiresAt = buttonCooldowns.get(key) || 0;

  if (now < expiresAt) {
    return Math.ceil((expiresAt - now) / 1000);
  }

  buttonCooldowns.set(key, now + BUTTON_COOLDOWN);
  return 0;
}

/* -------------------------------------------------------------------------- */
/* Components V2                                                             */
/* -------------------------------------------------------------------------- */

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL_V2 =
  MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

function text(value) {
  return new TextDisplayBuilder().setContent(
    String(value ?? "").trim()
  );
}

function divider() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function createContainer(title, body, details = null) {
  const result = new ContainerBuilder()
    .clearAccentColor()
    .addTextDisplayComponents(text(`# ${title}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(body));

  if (details) {
    result
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(details));
  }

  return result;
}

function ephemeralPanel(
  title,
  body,
  details = null,
  allowedMentions = ALLOWED_MENTIONS_NONE
) {
  return {
    flags: EPHEMERAL_V2,
    components: [createContainer(title, body, details)],
    allowedMentions,
  };
}

function publicPanel(
  title,
  body,
  details = null,
  allowedMentions = ALLOWED_MENTIONS_NONE
) {
  return {
    flags: V2,
    components: [createContainer(title, body, details)],
    allowedMentions,
  };
}

function imagePanel(
  title,
  imageUrl,
  footer = null,
  buttons = [],
  allowedMentions = ALLOWED_MENTIONS_NONE
) {
  const gallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(imageUrl)
  );

  const result = new ContainerBuilder()
    .clearAccentColor()
    .addTextDisplayComponents(text(`# ${title}`))
    .addSeparatorComponents(divider())
    .addMediaGalleryComponents(gallery);

  if (footer) {
    result
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(footer));
  }

  if (buttons.length) {
    result.addActionRowComponents(
      new ActionRowBuilder().addComponents(...buttons)
    );
  }

  return {
    flags: V2,
    components: [result],
    allowedMentions,
  };
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

function secondaryButton(customId, label) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary);
}

function linkButton(label, url) {
  return new ButtonBuilder()
    .setLabel(label)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function buttonPanel(title, body, buttons) {
  const result = new ContainerBuilder()
    .clearAccentColor()
    .addTextDisplayComponents(text(`# ${title}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(body))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(...buttons)
    );

  return {
    flags: EPHEMERAL_V2,
    components: [result],
    allowedMentions: ALLOWED_MENTIONS_NONE,
  };
}

function startPanel(title, customId, body) {
  return buttonPanel(title, body, [
    secondaryButton(customId, "Start"),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

function tosPrompt() {
  return buttonPanel(
    "Terms of Service",
    [
      "**Before using Larpify**",
      "",
      "By using this bot, you agree not to send **NSFW** or **CSAM** content.",
      "",
      "Sending prohibited content may result in an immediate blacklist.",
    ].join("\n"),
    [
      secondaryButton("tos:accept", "Accept"),
      secondaryButton("tos:decline", "Decline"),
    ]
  );
}

function accessDenied() {
  return buttonPanel(
    "Access Denied",
    [
      "You must be a member of the Larpify support server to use this bot.",
      "",
      `**Support Server:** ${SUPPORT_SERVER_INVITE}`,
    ].join("\n"),
    [linkButton("Join Server", SUPPORT_SERVER_INVITE)]
  );
}

function premiumRequired() {
  return buttonPanel(
    "Premium Required",
    [
      "You don't have premium to use this command.",
      "",
      "**Boost Larpify Discord server to use this command.**",
    ].join("\n"),
    [linkButton("Larpify Server", SUPPORT_SERVER_INVITE)]
  );
}

function supportRestricted() {
  return ephemeralPanel(
    "Restricted",
    "Commands are disabled inside the support server, except `/female` in the designated channel."
  );
}

/* -------------------------------------------------------------------------- */
/* Realtime membership / premium                                              */
/* -------------------------------------------------------------------------- */

async function getFreshSupportMember(userId) {
  try {
    const guild = await client.guilds
      .fetch(SUPPORT_SERVER_ID)
      .catch(() => null);

    if (!guild) {
      return null;
    }

    return await guild.members
      .fetch({
        user: userId,
        force: true,
      })
      .catch(() => null);
  } catch (error) {
    console.error("Support member lookup failed:", error);
    return null;
  }
}

async function isSupportMember(userId) {
  return Boolean(
    await getFreshSupportMember(userId)
  );
}

async function hasPremiumRole(userId) {
  try {
    if (!PREMIUM_ROLE_ID) {
      return false;
    }

    const member = await getFreshSupportMember(userId);

    if (!member) {
      return false;
    }

    return Boolean(
      member.roles?.cache?.has(PREMIUM_ROLE_ID)
    );
  } catch (error) {
    console.error("Premium role check failed:", error);
    return false;
  }
}

function isSupportServer(interaction) {
  return interaction.guildId === SUPPORT_SERVER_ID;
}

function canUseFemaleInSupportServer(interaction) {
  return (
    isSupportServer(interaction) &&
    interaction.channelId === SUPPORT_FEMALE_CHANNEL_ID
  );
}

function isBlacklisted(userId) {
  return blacklistedUsers.has(String(userId));
}

function isAdministrator(interaction) {
  return Boolean(
    interaction.inGuild() &&
      interaction.memberPermissions?.has(
        PermissionsBitField.Flags.Administrator
      )
  );
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                    */
/* -------------------------------------------------------------------------- */

function cleanLog(value, maxLength = 1500) {
  const output = String(value ?? "None")
    .replace(/```/g, "'''")
    .trim();

  return output.length <= maxLength
    ? output
    : `${output.slice(0, maxLength - 3)}...`;
}

function getCommandName(interaction) {
  if (interaction.isChatInputCommand()) {
    return `/${interaction.commandName}`;
  }

  if (interaction.isButton()) {
    return `Button (${interaction.customId.split(":")[0]})`;
  }

  return "Unknown Action";
}

function getLocation(interaction) {
  if (interaction.guildId) {
    return {
      type: "Server",
      serverId: interaction.guildId,
    };
  }

  return {
    type: "DM",
    serverId: "N/A",
  };
}

function buildCommandLog(interaction, output) {
  const location = getLocation(interaction);

  const moderationRow = new ActionRowBuilder().addComponents(
    secondaryButton(
      `blacklist:${interaction.user.id}`,
      "Blacklist"
    ),
    secondaryButton(
      `unblacklist:${interaction.user.id}`,
      "Unblacklist"
    )
  );

  const result = new ContainerBuilder()
    .clearAccentColor()
    .addTextDisplayComponents(
      text("# Log"),
      text(
        `**User:** ${interaction.user.username}\n` +
          `**ID:** \`${interaction.user.id}\`\n` +
          `**Command:** \`${getCommandName(interaction)}\``
      )
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**Channel:** \`${interaction.channelId ?? "Unknown"}\`\n` +
          `**Location:** ${location.type}\n` +
          `**Server ID:** \`${location.serverId}\``
      )
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**Output**\n\`\`\`\n${cleanLog(output)}\n\`\`\``
      )
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text("**Administrator Moderation**")
    )
    .addActionRowComponents(moderationRow);

  return {
    flags: V2,
    components: [result],
    allowedMentions: ALLOWED_MENTIONS_NONE,
  };
}

async function sendCommandLog(interaction, output) {
  try {
    const channel = await client.channels
      .fetch(LOG_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    await channel.send(
      buildCommandLog(interaction, output)
    );
  } catch (error) {
    console.error("Command log failed:", error);
  }
}

/* -------------------------------------------------------------------------- */
/* Link logging                                                               */
/* -------------------------------------------------------------------------- */

async function sendLinkLog(interaction, links) {
  if (!Array.isArray(links) || links.length === 0) {
    return;
  }

  try {
    const channel = await client.channels
      .fetch(LINK_USED_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    const linksText = links
      .map(
        (link) =>
          `- \`${cleanInline(link, 900)}\``
      )
      .join("\n");

    const moderationRow = new ActionRowBuilder().addComponents(
      secondaryButton(
        `blacklist:${interaction.user.id}`,
        "Blacklist"
      ),
      secondaryButton(
        `unblacklist:${interaction.user.id}`,
        "Unblacklist"
      )
    );

    const result = new ContainerBuilder()
      .clearAccentColor()
      .addTextDisplayComponents(
        text("# Link Used"),
        text(
          `**User:** ${interaction.user.username}\n` +
            `**ID:** \`${interaction.user.id}\`\n` +
            `**Command:** \`/${interaction.commandName}\``
        )
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          `**Links**\n${linksText}`
        )
      )
      .addActionRowComponents(moderationRow);

    await channel.send({
      flags: V2,
      components: [result],
      allowedMentions: ALLOWED_MENTIONS_NONE,
    });
  } catch (error) {
    console.error("Link log failed:", error);
  }
}

/* -------------------------------------------------------------------------- */
/* Auto moderation logging                                                   */
/* -------------------------------------------------------------------------- */

async function sendAutomodLog(
  interaction,
  matchedWord,
  source,
  persisted
) {
  try {
    const channel = await client.channels
      .fetch(BOT_AUTOMOD_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    const result = new ContainerBuilder()
      .clearAccentColor()
      .addTextDisplayComponents(
        text("# Auto Moderation"),
        text(
          `**User:** ${interaction.user.username}\n` +
            `**ID:** \`${interaction.user.id}\`\n` +
            `**Command:** \`/${interaction.commandName}\``
        )
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          `**Matched:** \`${cleanInline(matchedWord, 200)}\`\n` +
            `**Source:** \`${cleanInline(source, 100)}\`\n` +
            "**Action:** User blacklisted"
        )
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          persisted
            ? "Blacklist saved successfully."
            : "Blacklist was applied in memory, but saving failed."
        )
      );

    await channel.send({
      flags: V2,
      components: [result],
      allowedMentions: ALLOWED_MENTIONS_NONE,
    });
  } catch (error) {
    console.error("Auto moderation log failed:", error);
  }
}

async function autoBlacklistUser(
  interaction,
  matchedWord,
  source
) {
  const userId = interaction.user.id;
  const wasAlreadyBlacklisted = blacklistedUsers.has(userId);

  blacklistedUsers.add(userId);
  const persisted = saveBlacklist();

  if (!persisted) {
    console.error(
      `Failed to persist auto blacklist for ${userId}.`
    );
  }

  await sendAutomodLog(
    interaction,
    matchedWord,
    source,
    persisted
  );

  return {
    newlyBlacklisted: !wasAlreadyBlacklisted,
    persisted,
  };
}

/* -------------------------------------------------------------------------- */
/* User message moderation                                                   */
/* -------------------------------------------------------------------------- */

async function moderateUserMessage(
  interaction,
  content,
  source
) {
  const badWord = findBadWord(content);

  if (badWord) {
    await autoBlacklistUser(
      interaction,
      badWord,
      source
    );

    await safeReply(
      interaction,
      ephemeralPanel(
        "Blocked",
        "Your message was blocked.",
        "Prohibited language was detected and your account has been blacklisted."
      )
    );

    return {
      blocked: true,
      links: [],
    };
  }

  const links = extractLinks(content);

  if (links.length) {
    await sendLinkLog(
      interaction,
      links
    );
  }

  return {
    blocked: false,
    links,
  };
}

/* -------------------------------------------------------------------------- */
/* Safe interactions                                                          */
/* -------------------------------------------------------------------------- */

function isInteractionExpired(error) {
  return (
    error?.code === 10062 ||
    error?.code === 40060 ||
    error?.code === 10015
  );
}

async function safeReply(
  interaction,
  payload
) {
  try {
    if (
      interaction.replied ||
      interaction.deferred
    ) {
      return await interaction.followUp(payload);
    }

    return await interaction.reply(payload);
  } catch (error) {
    if (!isInteractionExpired(error)) {
      console.error("Reply failed:", error);
    }

    return null;
  }
}

async function safeUpdate(
  interaction,
  payload
) {
  try {
    if (
      interaction.replied ||
      interaction.deferred
    ) {
      return await interaction.editReply(payload);
    }

    return await interaction.update(payload);
  } catch (error) {
    if (!isInteractionExpired(error)) {
      console.error("Update failed:", error);
    }

    return null;
  }
}

async function safeDeferUpdate(
  interaction
) {
  try {
    if (
      interaction.replied ||
      interaction.deferred
    ) {
      return true;
    }

    await interaction.deferUpdate();
    return true;
  } catch (error) {
    if (!isInteractionExpired(error)) {
      console.error("deferUpdate failed:", error);
    }

    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Commands                                                                   */
/* -------------------------------------------------------------------------- */

function commonCommand(command) {
  return command
    .setIntegrationTypes(
      ApplicationIntegrationType.UserInstall
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .toJSON();
}

const commands = [
  commonCommand(
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Check application response time")
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("uptime")
      .setDescription("Check process uptime")
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("female")
      .setDescription("Request a portrait")
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("lag")
      .setDescription("Send 5 configured test messages")
      .addIntegerOption((option) =>
        option
          .setName("type")
          .setDescription("Select effect type")
          .setRequired(true)
          .addChoices(
            { name: "Type 1", value: 1 },
            { name: "Type 2", value: 2 },
            { name: "Type 3", value: 3 },
            { name: "Type 4", value: 4 }
          )
      )
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Send one message as the bot")
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("Message to send")
          .setRequired(true)
          .setMaxLength(2000)
      )
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("spam")
      .setDescription("Send 5 configured test messages")
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("customspam")
      .setDescription("Send 5 custom test messages")
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("Message to send")
          .setRequired(true)
          .setMaxLength(2000)
      )
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("blame")
      .setDescription("Blame a user for spamming")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Target user")
          .setRequired(true)
      )
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("fake-nitro")
      .setDescription("Open a Nitro gift preview")
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("fake-ban")
      .setDescription("Open a moderation preview")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Target user")
          .setRequired(true)
      )
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("fake-token")
      .setDescription("Encode a user ID")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Target user")
          .setRequired(true)
      )
  ),

  commonCommand(
    new SlashCommandBuilder()
      .setName("fake-ip")
      .setDescription("Show sample IP information")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Target user")
          .setRequired(true)
      )
  ),
];

async function registerCommands() {
  console.log("Registering application commands...");

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("Application commands registered.");
}

/* -------------------------------------------------------------------------- */
/* Pexels                                                                     */
/* -------------------------------------------------------------------------- */

const femaleQueries = [
  "young adult woman portrait",
  "woman portrait",
  "fashion woman portrait",
  "adult woman portrait",
  "stylish woman portrait",
];

const fallbackFemalePhotos = [
  {
    src: {
      large:
        "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    },
  },
  {
    src: {
      large:
        "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    },
  },
  {
    src: {
      large:
        "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    },
  },
  {
    src: {
      large:
        "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    },
  },
];

async function searchPexels(query) {
  const params = new URLSearchParams({
    query,
    orientation: "portrait",
    size: "large",
    per_page: "20",
    page: "1",
    locale: "en-US",
  });

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    8000
  );

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: PEXELS_API_KEY,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data?.photos)
      ? data.photos
      : [];
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Pexels request failed:", error);
    }

    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function getFemalePhoto() {
  const queries = [...femaleQueries].sort(
    () => Math.random() - 0.5
  );

  for (const query of queries) {
    const photos = await searchPexels(query);

    const valid = photos.filter(
      (photo) =>
        photo?.src?.large ||
        photo?.src?.large2x ||
        photo?.src?.portrait ||
        photo?.src?.original
    );

    if (valid.length) {
      return valid[
        Math.floor(
          Math.random() * valid.length
        )
      ];
    }
  }

  return fallbackFemalePhotos[
    Math.floor(
      Math.random() * fallbackFemalePhotos.length
    )
  ];
}

function femalePublicMessage(photo) {
  const image =
    photo?.src?.large ||
    photo?.src?.large2x ||
    photo?.src?.portrait ||
    photo?.src?.original;

  if (!image) {
    throw new Error(
      "No usable portrait URL was returned."
    );
  }

  const gallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(image)
  );

  const result = new ContainerBuilder()
    .clearAccentColor()
    .addTextDisplayComponents(
      text("# Portrait Result")
    )
    .addSeparatorComponents(divider())
    .addMediaGalleryComponents(gallery)
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text("Report if NSFW in tickets.")
    );

  return {
    flags: V2,
    components: [result],
    allowedMentions: ALLOWED_MENTIONS_NONE,
  };
}

/* -------------------------------------------------------------------------- */
/* Presence                                                                   */
/* -------------------------------------------------------------------------- */

const PRESENCE_MESSAGES = [
  "Over Your Conversation",
  "YouTube",
];

let presenceIndex = 0;
let presenceInterval = null;

function updatePresence() {
  if (!client.user) {
    return;
  }

  try {
    client.user.setPresence({
      status: "dnd",
      activities: [
        {
          name:
            PRESENCE_MESSAGES[presenceIndex],
          type: ActivityType.Watching,
        },
      ],
    });

    presenceIndex =
      (presenceIndex + 1) %
      PRESENCE_MESSAGES.length;
  } catch (error) {
    console.error(
      "Presence update failed:",
      error
    );
  }
}

function startPresenceRotation() {
  updatePresence();

  if (presenceInterval) {
    clearInterval(presenceInterval);
  }

  presenceInterval = setInterval(
    updatePresence,
    5000
  );

  presenceInterval.unref?.();
}

/* -------------------------------------------------------------------------- */
/* Batch sending                                                              */
/* -------------------------------------------------------------------------- */

async function sendFiveMessages(
  interaction,
  content
) {
  const message = String(content ?? "")
    .trim()
    .slice(0, 2000);

  if (!message) {
    return {
      successes: 0,
      failures: 5,
    };
  }

  const results = await Promise.allSettled(
    Array.from(
      { length: 5 },
      () =>
        interaction.followUp({
          content: message,
          allowedMentions:
            ALLOWED_MENTIONS_ALL,
        })
    )
  );

  const successes = results.filter(
    (result) =>
      result.status === "fulfilled"
  ).length;

  return {
    successes,
    failures: 5 - successes,
  };
}

/* -------------------------------------------------------------------------- */
/* Command handler                                                            */
/* -------------------------------------------------------------------------- */

async function handleCommand(
  interaction
) {
  if (
    !(await isSupportMember(
      interaction.user.id
    ))
  ) {
    await safeReply(
      interaction,
      accessDenied()
    );

    return;
  }

  if (isSupportServer(interaction)) {
    if (
      interaction.commandName !== "female" ||
      !canUseFemaleInSupportServer(interaction)
    ) {
      await safeReply(
        interaction,
        supportRestricted()
      );

      return;
    }
  }

  if (
    isBlacklisted(
      interaction.user.id
    )
  ) {
    await safeReply(
      interaction,
      ephemeralPanel(
        "Blocked",
        "You are blacklisted from using this bot."
      )
    );

    return;
  }

  switch (interaction.commandName) {
    case "ping": {
      const latency = Math.max(
        0,
        Math.round(client.ws.ping)
      );

      await safeReply(
        interaction,
        ephemeralPanel(
          "Ping",
          `**${latency}ms**`
        )
      );

      await sendCommandLog(
        interaction,
        `Ping: ${latency}ms`
      );

      return;
    }

    case "uptime": {
      const uptime = formatUptime(
        process.uptime()
      );

      await safeReply(
        interaction,
        ephemeralPanel(
          "Uptime",
          `**${uptime}**`
        )
      );

      await sendCommandLog(
        interaction,
        `Uptime: ${uptime}`
      );

      return;
    }

    case "female": {
      await safeReply(
        interaction,
        ephemeralPanel(
          "Fetching",
          "**Fetching a female image...**"
        )
      );

      try {
        const photo = await getFemalePhoto();

        await interaction.followUp(
          femalePublicMessage(photo)
        );

        await sendCommandLog(
          interaction,
          "Female portrait request completed."
        );
      } catch (error) {
        console.error(
          "Female command failed:",
          error
        );

        await interaction.followUp(
          publicPanel(
            "Error",
            "Unable to fetch the image right now."
          )
        );
      }

      return;
    }

    case "say": {
      const content =
        interaction.options.getString(
          "message",
          true
        );

      const moderation =
        await moderateUserMessage(
          interaction,
          content,
          "say"
        );

      if (moderation.blocked) {
        return;
      }

      await safeReply(
        interaction,
        ephemeralPanel(
          "Sending",
          "**Sending 1 message as the bot.**"
        )
      );

      await interaction.followUp(
        publicPanel(
          "Message",
          content,
          null,
          ALLOWED_MENTIONS_ALL
        )
      );

      await sendCommandLog(
        interaction,
        content
      );

      return;
    }

    case "lag": {
      if (
        !(await hasPremiumRole(
          interaction.user.id
        ))
      ) {
        await safeReply(
          interaction,
          premiumRequired()
        );

        return;
      }

      const type =
        interaction.options.getInteger(
          "type",
          true
        );

      const message =
        LAG_MESSAGES[type];

      if (!message) {
        await safeReply(
          interaction,
          ephemeralPanel(
            "Configuration Error",
            `**LAG_TYPE_${type}** is not configured.`
          )
        );

        return;
      }

      await safeReply(
        interaction,
        startPanel(
          "Lag Test",
          `start_lag:${type}:${interaction.user.id}`,
          [
            "**Premium feature**",
            "",
            "Press **Start** to run 5 controlled test messages.",
          ].join("\n")
        )
      );

      return;
    }

    case "spam": {
      await safeReply(
        interaction,
        startPanel(
          "Spam Test",
          `start_spam:${interaction.user.id}`,
          [
            "Press **Start** to run 5 test messages.",
            "",
            "Uses the Larpify template.",
          ].join("\n")
        )
      );

      return;
    }

    case "customspam": {
      const content =
        interaction.options.getString(
          "message",
          true
        );

      const moderation =
        await moderateUserMessage(
          interaction,
          content,
          "customspam"
        );

      if (moderation.blocked) {
        return;
      }

      const sessionId =
        createCustomSession(
          interaction.user.id,
          content
        );

      await safeReply(
        interaction,
        startPanel(
          "Custom Test",
          `start_custom:${sessionId}`,
          [
            "Press **Start** to run 5 messages.",
            "",
            "Your custom message will be used.",
          ].join("\n")
        )
      );

      await sendCommandLog(
        interaction,
        content
      );

      return;
    }

    case "blame": {
      const target =
        interaction.options.getUser(
          "user",
          true
        );

      await safeReply(
        interaction,
        ephemeralPanel(
          "Blaming User",
          "**Blaming a user for /spam.**",
          `Target: <@${target.id}>`,
          ALLOWED_MENTIONS_ALL
        )
      );

      await interaction.followUp(
        publicPanel(
          "Completed",
          `<@${target.id}> **thanks for using Larpify.**`,
          "Your **/spam** operation has been completed.",
          ALLOWED_MENTIONS_ALL
        )
      );

      await sendCommandLog(
        interaction,
        `Blame operation completed for ${target.id}.`
      );

      return;
    }

    case "fake-nitro": {
      const target = interaction.user;

      await safeReply(
        interaction,
        ephemeralPanel(
          "Sending",
          "**Preparing your Nitro gift preview...**"
        )
      );

      await interaction.followUp(
        imagePanel(
          "Larpify Gift",
          NITRO_IMAGE_URL,
          [
            "**Larpify has gifted you 3 months of Nitro.**",
            "",
            `Recipient: <@${target.id}>`,
            "",
            "Use the buttons below for support information.",
          ].join("\n"),
          [
            linkButton(
              "Accept Gift",
              SUPPORT_SERVER_INVITE
            ),
            linkButton(
              "More Info",
              SUPPORT_SERVER_INVITE
            ),
          ],
          ALLOWED_MENTIONS_ALL
        )
      );

      return;
    }

    case "fake-ban": {
      const target =
        interaction.options.getUser(
          "user",
          true
        );

      await safeReply(
        interaction,
        ephemeralPanel(
          "Processing",
          "**Preparing the moderation preview...**"
        )
      );

      await interaction.followUp(
        imagePanel(
          "Moderation Notice",
          BANNED_IMAGE_URL,
          [
            `User: <@${target.id}>`,
            "",
            "**Status:** Temporarily Restricted",
            "**Reason:** Spam activity",
            "**Duration:** 28 days",
            "",
            "Contact Larpify support for more information.",
          ].join("\n"),
          [
            linkButton(
              "Support",
              SUPPORT_SERVER_INVITE
            ),
          ],
          ALLOWED_MENTIONS_ALL
        )
      );

      return;
    }

    case "fake-token": {
      const target =
        interaction.options.getUser(
          "user",
          true
        );

      await safeReply(
        interaction,
        ephemeralPanel(
          "Encoding",
          "**Encoding the user ID...**"
        )
      );

      const encoded =
        Buffer
          .from(target.id, "utf8")
          .toString("base64")
          .replace(/=+$/g, "");

      await interaction.followUp(
        publicPanel(
          `Encoded ID of <@${target.id}>`,
          `\`\`\`\n${encoded}\n\`\`\``,
          null,
          ALLOWED_MENTIONS_ALL
        )
      );

      return;
    }

    case "fake-ip": {
      const target =
        interaction.options.getUser(
          "user",
          true
        );

      const hash =
        crypto
          .createHash("sha256")
          .update(target.id)
          .digest("hex");

      const ipv4 =
        `192.0.2.${
          (parseInt(hash.slice(0, 2), 16) % 253) + 1
        }`;

      const ipv6 =
        `2001:db8:${hash.slice(2, 6)}:${hash.slice(6, 10)}::${
          (parseInt(hash.slice(10, 14), 16) & 0xffff).toString(16)
        }`;

      await safeReply(
        interaction,
        ephemeralPanel(
          "Sending",
          "**Preparing the IP information panel...**"
        )
      );

      await interaction.followUp(
        publicPanel(
          `IP Information — <@${target.id}>`,
          [
            `**IPv4:** \`${ipv4}\``,
            `**IPv6:** \`${ipv6}\``,
            "",
            "**Protocol:** UDP / IPv4",
          ].join("\n"),
          null,
          ALLOWED_MENTIONS_ALL
        )
      );

      return;
    }

    default:
      await safeReply(
        interaction,
        ephemeralPanel(
          "Unavailable",
          "Command not configured."
        )
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Moderation buttons                                                         */
/* -------------------------------------------------------------------------- */

async function handleModerationButton(
  interaction
) {
  const [action, targetUserId] =
    interaction.customId.split(":");

  if (
    action !== "blacklist" &&
    action !== "unblacklist"
  ) {
    return;
  }

  if (!isAdministrator(interaction)) {
    await safeReply(
      interaction,
      ephemeralPanel(
        "Restricted",
        "**Administrator permission required.**"
      )
    );
    return;
  }

  const normalizedTarget = normalizeId(targetUserId);

  if (!normalizedTarget) {
    await safeReply(
      interaction,
      ephemeralPanel(
        "Error",
        "Invalid target user ID."
      )
    );
    return;
  }

  if (action === "blacklist") {
    blacklistedUsers.add(normalizedTarget);

    if (!saveBlacklist()) {
      await safeReply(
        interaction,
        ephemeralPanel(
          "Error",
          "Failed to save the blacklist."
        )
      );
      return;
    }

    await safeReply(
      interaction,
      ephemeralPanel(
        "Blacklist Updated",
        `User \`${normalizedTarget}\` has been blacklisted.`
      )
    );
    return;
  }

  blacklistedUsers.delete(normalizedTarget);

  if (!saveBlacklist()) {
    await safeReply(
      interaction,
      ephemeralPanel(
        "Error",
        "Failed to save the blacklist."
      )
    );
    return;
  }

  await safeReply(
    interaction,
    ephemeralPanel(
      "Blacklist Updated",
      `User \`${normalizedTarget}\` has been unblacklisted.`
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Action buttons                                                             */
/* -------------------------------------------------------------------------- */

async function handleActionButton(
  interaction
) {
  const customId = interaction.customId;

  if (customId === "tos:accept") {
    if (
      !(await isSupportMember(
        interaction.user.id
      ))
    ) {
      await safeUpdate(
        interaction,
        accessDenied()
      );
      return;
    }

    tosData[interaction.user.id] = true;

    if (!saveTos()) {
      await safeUpdate(
        interaction,
        ephemeralPanel(
          "Error",
          "Your TOS acceptance could not be saved."
        )
      );
      return;
    }

    await safeUpdate(
      interaction,
      ephemeralPanel(
        "Accepted",
        "Terms of Service accepted. Access granted."
      )
    );

    return;
  }

  if (customId === "tos:decline") {
    await safeUpdate(
      interaction,
      ephemeralPanel(
        "Declined",
        "Terms of Service declined. Access denied."
      )
    );
    return;
  }

  cleanupSessions();

  const remaining = getCooldown(
    interaction.user.id,
    customId.split(":")[0]
  );

  if (remaining > 0) {
    await safeReply(
      interaction,
      ephemeralPanel(
        "Cooldown",
        `Please wait **${remaining}s** before using this button again.`
      )
    );
    return;
  }

  /* ---------------------------------------------------------------------- */
  /* Lag                                                                    */
  /* ---------------------------------------------------------------------- */

  if (customId.startsWith("start_lag:")) {
    const [, type, ownerId] = customId.split(":");

    if (ownerId !== interaction.user.id) {
      await safeReply(
        interaction,
        ephemeralPanel(
          "Restricted",
          "This test button belongs to another user."
        )
      );
      return;
    }

    if (
      !(await isSupportMember(
        interaction.user.id
      ))
    ) {
      await safeUpdate(
        interaction,
        accessDenied()
      );
      return;
    }

    if (
      !(await hasPremiumRole(
        interaction.user.id
      ))
    ) {
      await safeUpdate(
        interaction,
        premiumRequired()
      );
      return;
    }

    if (isSupportServer(interaction)) {
      await safeUpdate(
        interaction,
        supportRestricted()
      );
      return;
    }

    const message = LAG_MESSAGES[type];

    if (!message) {
      await safeUpdate(
        interaction,
        ephemeralPanel(
          "Configuration Error",
          `**LAG_TYPE_${type}** is not configured.`
        )
      );
      return;
    }

    if (!(await safeDeferUpdate(interaction))) {
      return;
    }

    const result = await sendFiveMessages(
      interaction,
      message
    );

    await sendCommandLog(
      interaction,
      `Lag type ${type}: ${result.successes}/5 successful, ${result.failures}/5 failed.`
    );

    return;
  }

  /* ---------------------------------------------------------------------- */
  /* Spam                                                                   */
  /* ---------------------------------------------------------------------- */

  if (customId.startsWith("start_spam:")) {
    const [, ownerId] = customId.split(":");

    if (ownerId !== interaction.user.id) {
      await safeReply(
        interaction,
        ephemeralPanel(
          "Restricted",
          "This test button belongs to another user."
        )
      );
      return;
    }

    if (
      !(await isSupportMember(
        interaction.user.id
      ))
    ) {
      await safeUpdate(
        interaction,
        accessDenied()
      );
      return;
    }

    if (isSupportServer(interaction)) {
      await safeUpdate(
        interaction,
        supportRestricted()
      );
      return;
    }

    if (!(await safeDeferUpdate(interaction))) {
      return;
    }

    const result = await sendFiveMessages(
      interaction,
      SPAM_TEMPLATE
    );

    await sendCommandLog(
      interaction,
      `SPAM operation: ${result.successes}/5 successful, ${result.failures}/5 failed.`
    );

    return;
  }

  /* ---------------------------------------------------------------------- */
  /* Custom spam                                                            */
  /* ---------------------------------------------------------------------- */

  if (customId.startsWith("start_custom:")) {
    const sessionId = customId.slice(
      "start_custom:".length
    );

    const session = customSpamSessions.get(
      sessionId
    );

    if (
      !session ||
      Date.now() >= session.expiresAt
    ) {
      customSpamSessions.delete(sessionId);

      await safeUpdate(
        interaction,
        ephemeralPanel(
          "Expired",
          "This custom test has expired. Run `/customspam` again."
        )
      );
      return;
    }

    if (session.userId !== interaction.user.id) {
      await safeReply(
        interaction,
        ephemeralPanel(
          "Restricted",
          "This custom session belongs to another user."
        )
      );
      return;
    }

    if (
      !(await isSupportMember(
        interaction.user.id
      ))
    ) {
      customSpamSessions.delete(sessionId);

      await safeUpdate(
        interaction,
        accessDenied()
      );
      return;
    }

    if (isSupportServer(interaction)) {
      await safeUpdate(
        interaction,
        supportRestricted()
      );
      return;
    }

    customSpamSessions.delete(sessionId);

    if (!(await safeDeferUpdate(interaction))) {
      return;
    }

    const result = await sendFiveMessages(
      interaction,
      session.content
    );

    await sendCommandLog(
      interaction,
      `Custom spam operation: ${result.successes}/5 successful, ${result.failures}/5 failed.`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Interaction router                                                         */
/* -------------------------------------------------------------------------- */

client.on(
  Events.InteractionCreate,
  async (interaction) => {
    try {
      if (
        !interaction.isChatInputCommand() &&
        !interaction.isButton()
      ) {
        return;
      }

      if (
        interaction.isButton() &&
        (
          interaction.customId.startsWith("blacklist:") ||
          interaction.customId.startsWith("unblacklist:")
        )
      ) {
        await handleModerationButton(
          interaction
        );
        return;
      }

      const userId = interaction.user.id;

      if (isBlacklisted(userId)) {
        await safeReply(
          interaction,
          ephemeralPanel(
            "Blocked",
            "You are blacklisted from using this bot."
          )
        );
        return;
      }

      /* Fresh membership check for every interaction. */
      if (!(await isSupportMember(userId))) {
        await safeReply(
          interaction,
          accessDenied()
        );
        return;
      }

      if (!tosData[userId]) {
        if (
          interaction.isButton() &&
          interaction.customId.startsWith("tos:")
        ) {
          await handleActionButton(
            interaction
          );
        } else {
          await safeReply(
            interaction,
            tosPrompt()
          );
        }
        return;
      }

      if (interaction.isChatInputCommand()) {
        await handleCommand(
          interaction
        );
        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith("start_")
      ) {
        await handleActionButton(
          interaction
        );
        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith("tos:")
      ) {
        await handleActionButton(
          interaction
        );
      }
    } catch (error) {
      console.error(
        "Interaction handler error:",
        error
      );

      await safeReply(
        interaction,
        ephemeralPanel(
          "Error",
          "An unexpected error occurred while processing this action."
        )
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Uptime                                                                     */
/* -------------------------------------------------------------------------- */

function formatUptime(seconds) {
  const total = Math.max(
    0,
    Math.floor(seconds)
  );

  const days = Math.floor(
    total / 86400
  );

  const hours = Math.floor(
    (total % 86400) / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const secs = total % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

/* -------------------------------------------------------------------------- */
/* Ready / presence                                                           */
/* -------------------------------------------------------------------------- */

client.once(
  Events.ClientReady,
  async (bot) => {
    console.log(
      `Logged in as ${bot.user.tag}`
    );

    console.log(
      `Premium role ID: ${PREMIUM_ROLE_ID}`
    );

    console.log(
      `Link log channel ID: ${LINK_USED_CHANNEL_ID}`
    );

    console.log(
      `Auto moderation channel ID: ${BOT_AUTOMOD_CHANNEL_ID}`
    );

    try {
      await registerCommands();
    } catch (error) {
      console.error(
        "Command registration failed:",
        error
      );
    }

    startPresenceRotation();
  }
);

/* -------------------------------------------------------------------------- */
/* Process safety                                                             */
/* -------------------------------------------------------------------------- */

let shuttingDown = false;

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );

    shutdown(
      "UNCAUGHT_EXCEPTION"
    );
  }
);

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `${signal} received. Shutting down...`
  );

  if (presenceInterval) {
    clearInterval(
      presenceInterval
    );
    presenceInterval = null;
  }

  try {
    client.destroy();
  } catch (error) {
    console.error(
      "Client destroy failed:",
      error
    );
  }

  process.exit(
    signal === "UNCAUGHT_EXCEPTION"
      ? 1
      : 0
  );
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

client
  .login(TOKEN)
  .catch((error) => {
    console.error(
      "Discord login failed:",
      error
    );

    process.exit(1);
  });

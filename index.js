"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

require("dotenv").config({ path: path.join(__dirname, ".env") });

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
  SectionBuilder,
  ThumbnailBuilder,
} = require("discord.js");

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const BOT_NAME = "Larpify";
const SUPPORT_SERVER_INVITE = "https://discord.gg/aBsPJHGWPE";
const PROCESS_STARTED_AT_MS = Date.now();
const BATCH_SIZE = 5;
const CUSTOM_SESSION_TTL_MS = 15 * 60 * 1000;
const SUPPORT_CACHE_TTL_MS = 15 * 1000;

function normalizeId(value) {
  const id = String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
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
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

const ALLOWED_MENTIONS_ALL = Object.freeze({ parse: ["users", "roles", "everyone"] });
const ALLOWED_MENTIONS_NONE = Object.freeze({ parse: [] });

const LAG_MESSAGES = Object.freeze({
  1: process.env.LAG_TYPE_1?.trim() || null,
  2: process.env.LAG_TYPE_2?.trim() || null,
  3: process.env.LAG_TYPE_3?.trim() || null,
  4: process.env.LAG_TYPE_4?.trim() || null,
});

const SPAM_TEMPLATE = `# [Larpify](https://discord.gg/aBsPJHGWPE)
## Powerful N & R Bots, Made With AI.

### - Powerful Discord Bots
### - Fast & Reliable
### - AI-Powered Features
### - Built For Discord Communities
### - And More...

-# @everyone`;

const NITRO_IMAGE_URL =
  "https://cdn.discordapp.com/attachments/1539084725073744002/1539566265587343410/discord-nitro.png?ex=6a877111&is=6a861f91&hm=d97ffeda66d1fb663acc5d5ca95d6ed36e502892981c29a0d55c05d6af27c2e8&";

/* -------------------------------------------------------------------------- */
/* Client                                                                     */
/* -------------------------------------------------------------------------- */

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

const DATA_DIR = path.join(__dirname, "data");
const TOS_PATH = path.join(DATA_DIR, "tos.json");
const BLACKLIST_PATH = path.join(DATA_DIR, "blacklist.json");
const PROFILE_PATH = path.join(DATA_DIR, "profiles.json");

function ensureDataDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TOS_PATH)) fs.writeFileSync(TOS_PATH, "{}\n", "utf8");
  if (!fs.existsSync(BLACKLIST_PATH)) fs.writeFileSync(BLACKLIST_PATH, "[]\n", "utf8");
  if (!fs.existsSync(PROFILE_PATH)) fs.writeFileSync(PROFILE_PATH, "{}\n", "utf8");
}

ensureDataDirectory();

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function writeJson(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    return false;
  }
}

const loadedTos = readJson(TOS_PATH, {});
const tosData = loadedTos && typeof loadedTos === "object" && !Array.isArray(loadedTos) ? loadedTos : {};

const loadedBlacklist = readJson(BLACKLIST_PATH, []);
const blacklistedUsers = new Set(
  Array.isArray(loadedBlacklist)
    ? loadedBlacklist.map(String).filter((id) => normalizeId(id))
    : []
);

const loadedProfiles = readJson(PROFILE_PATH, {});
const profileData = loadedProfiles && typeof loadedProfiles === "object" && !Array.isArray(loadedProfiles)
  ? loadedProfiles
  : {};

const saveTos = () => writeJson(TOS_PATH, tosData);
const saveBlacklist = () => writeJson(BLACKLIST_PATH, [...blacklistedUsers]);
const saveProfiles = () => writeJson(PROFILE_PATH, profileData);

/* -------------------------------------------------------------------------- */
/* In-memory state                                                            */
/* -------------------------------------------------------------------------- */

const customSpamSessions = new Map();
const supportMemberCache = new Map();
const fakeIpHistory = new Map();

function createCustomSession(userId, content) {
  const id = crypto.randomUUID();
  customSpamSessions.set(id, {
    userId,
    content: String(content).slice(0, 2000),
    expiresAt: Date.now() + CUSTOM_SESSION_TTL_MS,
  });
  return id;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of customSpamSessions) {
    if (!session || now >= session.expiresAt) customSpamSessions.delete(id);
  }
}

function getProfile(userId, username) {
  const key = String(userId);
  if (!profileData[key] || typeof profileData[key] !== "object") {
    profileData[key] = {
      username: String(username || "Unknown User"),
      commands: 0,
      commandCounts: {},
      lastActiveAt: null,
      updatedAt: Date.now(),
    };
  }
  profileData[key].username = String(username || profileData[key].username || "Unknown User");
  profileData[key].commandCounts = profileData[key].commandCounts && typeof profileData[key].commandCounts === "object"
    ? profileData[key].commandCounts
    : {};
  return profileData[key];
}

function recordCommandActivity(interaction) {
  if (!interaction?.isChatInputCommand?.()) return;
  if (interaction.commandName === "profile") return;

  const profile = getProfile(interaction.user.id, interaction.user.username);
  const command = interaction.commandName;
  profile.commands = Number(profile.commands || 0) + 1;
  profile.commandCounts[command] = Number(profile.commandCounts[command] || 0) + 1;
  profile.lastActiveAt = Date.now();
  profile.updatedAt = Date.now();

  setImmediate(() => saveProfiles());
}

function mostUsedCommand(profile) {
  const entries = Object.entries(profile?.commandCounts || {})
    .map(([name, count]) => [name, Number(count)])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return entries[0] || ["None", 0];
}

/* -------------------------------------------------------------------------- */
/* Automod                                                                    */
/* -------------------------------------------------------------------------- */

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060\u2061\u2062\u2063\u2064\u2065\u2066\u2067\u2068\u2069\u206A-\u206F]/g;
const BIDI_RE = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const CONTROL_RE = /[\u0000-\u001F\u007F]/g;
const COMBINING_RE = /\p{M}/gu;

// A small, deliberate homoglyph table helps detect obvious Unicode disguises
// without turning every non-ASCII message into a moderation hit.
const HOMOGLYPH_MAP = new Map([
  ["а", "a"], ["А", "a"], ["е", "e"], ["Е", "e"], ["о", "o"], ["О", "o"],
  ["р", "p"], ["Р", "p"], ["с", "c"], ["С", "c"], ["х", "x"], ["Х", "x"],
  ["у", "y"], ["У", "y"], ["і", "i"], ["І", "i"], ["ј", "j"], ["Ј", "j"],
  ["ι", "i"], ["Ι", "i"], ["κ", "k"], ["Κ", "k"], ["ν", "v"], ["Ν", "n"],
  ["ο", "o"], ["Ο", "o"], ["ρ", "p"], ["Ρ", "p"], ["τ", "t"], ["Τ", "t"],
]);

const LEET_MAP = new Map([
  ["0", "o"], ["1", "i"], ["2", "z"], ["3", "e"], ["4", "a"],
  ["5", "s"], ["6", "g"], ["7", "t"], ["8", "b"], ["9", "g"],
  ["@", "a"], ["$", "s"], ["!", "i"],
]);

const BAD_WORD_PATTERNS = Object.freeze([
  { label: "Sexual Content", regex: /\bsex(?:ual|ually)?\b/i },
  { label: "Hate Slur", regex: /\bnigg(?:a|er)\b/i },
  { label: "Sexual Violence", regex: /\brap(?:e|ist|ing)\b/i },
  { label: "Pornography", regex: /\bporn(?:o|ography)?\b/i },
  { label: "Profanity", regex: /\bf+u+c+k+(?:ing|ed|er)?\b/i },
  { label: "Profanity", regex: /\bb+i+t+c+h+\b/i },
  { label: "Profanity", regex: /\bs+l+u+t+\b/i },
  { label: "Profanity", regex: /\bw+h+o+r+e+\b/i },
  { label: "Profanity", regex: /\bc+u+n+t+\b/i },
  { label: "Profanity", regex: /\bd+i+c+k+\b/i },
  { label: "Profanity", regex: /\bp+u+s+s+y+\b/i },
  { label: "Child Safety", regex: /\bped(?:o|ophile)\b/i },
  { label: "Child Sexual Abuse", regex: /\bcsa+m\b/i },
  { label: "Child Sexual Abuse", regex: /\bchild\s*(?:sexual|porn|abuse)\b/i },
  { label: "Sexual Content", regex: /\b(?:sexual|nude|explicit)\s*(?:minor|child|kid)\b/i },
  { label: "Graphic Content", regex: /\bgore\b/i },
]);

const COMPACT_NEEDLES = Object.freeze([
  ["sex", "Sexual Content"],
  ["nigga", "Hate Slur"],
  ["nigger", "Hate Slur"],
  ["rape", "Sexual Violence"],
  ["porn", "Pornography"],
  ["fuck", "Profanity"],
  ["bitch", "Profanity"],
  ["slut", "Profanity"],
  ["whore", "Profanity"],
  ["cunt", "Profanity"],
  ["dick", "Profanity"],
  ["pussy", "Profanity"],
  ["pedophile", "Child Safety"],
  ["pedo", "Child Safety"],
  ["csam", "Child Sexual Abuse"],
  ["gore", "Graphic Content"],
]);

const URL_PATTERN = /(?:https?:\/\/|www\.|(?:discord\.gg|discord\.com\/invite\/)|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?:[^\s<>()\[\]{}"']*)/gi;

function applyUnicodeMap(value) {
  let output = "";
  for (const char of value) {
    output += HOMOGLYPH_MAP.get(char) ?? char;
  }
  return output;
}

function normalizeForModeration(content) {
  let value = applyUnicodeMap(String(content ?? "")
    .normalize("NFKD")
    .replace(COMBINING_RE, "")
    .replace(ZERO_WIDTH_RE, "")
    .replace(BIDI_RE, "")
    .replace(CONTROL_RE, "")
    .toLowerCase());

  let mapped = "";
  for (const char of value) mapped += LEET_MAP.get(char) ?? char;

  const spaced = mapped
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = spaced.replace(/\s+/g, "");
  const collapsed = compact.replace(/(.)\1{2,}/g, "$1$1");
  const alnumRuns = spaced.split(" ").filter(Boolean);

  return { spaced, compact, collapsed, alnumRuns };
}

function findBadWord(content) {
  const forms = normalizeForModeration(content);

  for (const rule of BAD_WORD_PATTERNS) {
    if (rule.regex.test(forms.spaced) || rule.regex.test(forms.collapsed)) {
      return rule.label;
    }
  }

  for (const [needle, label] of COMPACT_NEEDLES) {
    if (forms.compact.includes(needle)) return label;
  }

  // Catch single-letter separator obfuscation such as f.u.c.k while avoiding
  // very broad substring matching across ordinary sentences.
  for (const run of forms.alnumRuns) {
    if (run.length < 3 || run.length > 32) continue;
    for (const [needle, label] of COMPACT_NEEDLES) {
      if (run === needle || (run.length <= needle.length + 3 && run.includes(needle))) {
        return label;
      }
    }
  }

  return null;
}

function extractLinks(content) {
  const matches = String(content ?? "").match(URL_PATTERN) || [];
  const unique = new Set();

  for (const raw of matches) {
    const cleaned = raw
      .trim()
      .replace(/^[<([\[]+/, "")
      .replace(/[>\])},.!?]+$/g, "");
    if (cleaned) unique.add(cleaned);
  }

  return [...unique];
}

/* -------------------------------------------------------------------------- */
/* Components V2                                                             */
/* -------------------------------------------------------------------------- */

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL_V2 = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

function text(content) {
  return new TextDisplayBuilder().setContent(String(content ?? "").trim());
}

function divider() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function neutralButton(customId, label, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary);
  if (disabled) button.setDisabled(true);
  return button;
}

function linkButton(label, url) {
  return new ButtonBuilder()
    .setLabel(label)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function makeContainer(title, body = null, details = null) {
  const container = new ContainerBuilder().clearAccentColor();
  container.addTextDisplayComponents(text(`# ${title}`));
  if (body) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(body));
  if (details) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(details));
  return container;
}

function panel(title, body, details = null, ephemeral = true, allowedMentions = ALLOWED_MENTIONS_NONE) {
  return {
    flags: ephemeral ? EPHEMERAL_V2 : V2,
    components: [makeContainer(title, body, details)],
    allowedMentions,
  };
}

function buttonPanel(title, body, buttons, ephemeral = true) {
  const container = makeContainer(title, body)
    .addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
  return {
    flags: ephemeral ? EPHEMERAL_V2 : V2,
    components: [container],
    allowedMentions: ALLOWED_MENTIONS_NONE,
  };
}

function imagePanel(title, imageUrl, body, buttons = [], allowedMentions = ALLOWED_MENTIONS_NONE) {
  const container = makeContainer(title)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl))
    );
  if (body) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(body));
  if (buttons.length) container.addSeparatorComponents(divider()).addActionRowComponents(
    new ActionRowBuilder().addComponents(...buttons)
  );
  return { flags: V2, components: [container], allowedMentions };
}

/* -------------------------------------------------------------------------- */
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Membership / premium                                                       */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Logging                                                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Interaction helpers                                                        */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

async function autoBlacklistUser(interaction, matched, source) {
  const id = interaction.user.id;
  const wasBlacklisted = blacklistedUsers.has(id);
  blacklistedUsers.add(id);

  // Persist immediately, but keep logging off the critical response path.
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

/* -------------------------------------------------------------------------- */
/* Commands                                                                   */
/* -------------------------------------------------------------------------- */

function commonCommand(command) {
  return command
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    )
    .toJSON();
}

const commands = [
  commonCommand(new SlashCommandBuilder().setName("ping").setDescription("Check application response time")),
  commonCommand(new SlashCommandBuilder().setName("uptime").setDescription("Check process uptime")),
  commonCommand(new SlashCommandBuilder().setName("profile").setDescription("View your Larpify profile")),
  commonCommand(
    new SlashCommandBuilder()
      .setName("lag")
      .setDescription("Send 5 configured messages")
      .addIntegerOption((option) => option
        .setName("type")
        .setDescription("Select message type")
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
      .setDescription("Send a message as Larpify")
      .addStringOption((option) => option
        .setName("message")
        .setDescription("Message to send")
        .setRequired(true)
        .setMaxLength(2000)
      )
  ),
  commonCommand(new SlashCommandBuilder().setName("spam").setDescription("Send the Larpify message 5 times")),
  commonCommand(
    new SlashCommandBuilder()
      .setName("customspam")
      .setDescription("Send a custom message 5 times")
      .addStringOption((option) => option
        .setName("message")
        .setDescription("Message to send")
        .setRequired(true)
        .setMaxLength(2000)
      )
  ),
  commonCommand(
    new SlashCommandBuilder()
      .setName("ghost-ping")
      .setDescription("Open the Ghost Ping button")
      .addUserOption((option) => option.setName("user").setDescription("Target user").setRequired(true))
  ),
  commonCommand(
    new SlashCommandBuilder()
      .setName("blame")
      .setDescription("Blame a user for /spam")
      .addUserOption((option) => option.setName("user").setDescription("Target user").setRequired(true))
  ),
  commonCommand(new SlashCommandBuilder().setName("fake-nitro").setDescription("Open a Nitro gift preview")),
  commonCommand(
    new SlashCommandBuilder()
      .setName("fake-token")
      .setDescription("Generate a random fake token")
      .addUserOption((option) => option.setName("user").setDescription("Target user").setRequired(true))
  ),
  commonCommand(
    new SlashCommandBuilder()
      .setName("fake-ip")
      .setDescription("Generate random fake IP information")
      .addUserOption((option) => option.setName("user").setDescription("Target user").setRequired(true))
  ),
];

const FEMALE_COMMAND = new SlashCommandBuilder()
  .setName("female")
  .setDescription("Request a portrait")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .toJSON();

async function registerCommands() {
  await Promise.all([
    rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }),
    rest.put(Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID), { body: [FEMALE_COMMAND] }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Pexels                                                                     */
/* -------------------------------------------------------------------------- */

const FEMALE_QUERIES = [
  "adult woman portrait",
  "woman portrait",
  "fashion woman portrait",
  "adult woman fashion",
  "stylish woman portrait",
];

const FALLBACK_FEMALE_PHOTOS = [
  "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
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
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: PEXELS_API_KEY, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.photos) ? data.photos : [];
  } catch (error) {
    if (error?.name !== "AbortError") console.error("Pexels request failed:", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function getFemalePhoto() {
  const shuffled = [...FEMALE_QUERIES].sort(() => Math.random() - 0.5);
  for (const query of shuffled) {
    const photos = await searchPexels(query);
    const usable = photos.filter((photo) => photo?.src?.large || photo?.src?.portrait || photo?.src?.original);
    if (usable.length) {
      const photo = usable[Math.floor(Math.random() * usable.length)];
      return photo?.src?.large || photo?.src?.portrait || photo?.src?.original;
    }
  }
  return FALLBACK_FEMALE_PHOTOS[Math.floor(Math.random() * FALLBACK_FEMALE_PHOTOS.length)];
}

/* -------------------------------------------------------------------------- */
/* UI builders                                                                */
/* -------------------------------------------------------------------------- */

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

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      text(`**User**\n\`${cleanLog(user.username, 80)}\``),
      text(`**Commands**\n\`${Number(profile.commands || 0)}\``),
      text(`**Most Used**\n\`/${mostUsed} (${mostCount})\``)
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));

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

/* -------------------------------------------------------------------------- */
/* Sending                                                                    */
/* -------------------------------------------------------------------------- */

async function sendFiveMessages(interaction, content) {
  const message = String(content ?? "").trim().slice(0, 2000);
  if (!message) return { sent: 0, failed: BATCH_SIZE };

  const jobs = Array.from({ length: BATCH_SIZE }, () => interaction.followUp({
    content: message,
    allowedMentions: ALLOWED_MENTIONS_ALL,
  }));

  const results = await Promise.allSettled(jobs);
  return {
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

/* -------------------------------------------------------------------------- */
/* Interaction routing                                                        */
/* -------------------------------------------------------------------------- */

async function ensureCommandAccess(interaction) {
  if (!(await isSupportMember(interaction.user.id))) {
    await safeReply(interaction, accessDenied());
    return false;
  }

  if (isSupportServer(interaction)) {
    const allowed = interaction.commandName === "female";
    if (!allowed) {
      await safeReply(interaction, supportRestricted());
      return false;
    }
  }

  if (isBlacklisted(interaction.user.id)) {
    await safeReply(interaction, panel("Blocked", "You are permanently blacklisted from using this bot."));
    return false;
  }

  return true;
}

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
      void sendCommandLog(interaction, `Uptime: ${formatUptime(process.uptime())}`);
      return;
    }

    case "female": {
      if (!canUseFemale(interaction)) {
        await safeReply(interaction, supportRestricted());
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
          allowedMentions: ALLOWED_MENTIONS_NONE,
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
        await safeReply(interaction, premiumRequired());
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
          if (error?.code !== 10008) {
            console.error("Ghost ping deletion failed:", error);
          }
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

client.on(Events.InteractionCreate, async (interaction) => {
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

    if (interaction.isButton()) {
      await handleActionButton(interaction);
    }
  } catch (error) {
    console.error("Interaction handler error:", error);
    await safeReply(interaction, panel("Error", "Something went wrong while processing that action."));
  }
});

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomHex(length) {
  let out = "";
  while (out.length < length) out += crypto.randomBytes(Math.ceil(length / 2)).toString("hex");
  return out.slice(0, length);
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function formatDiscordTimestamp(ms) {
  return `<t:${Math.floor(ms / 1000)}:F>`;
}

function formatDiscordRelative(ms) {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

/* -------------------------------------------------------------------------- */
/* Presence / ready                                                           */
/* -------------------------------------------------------------------------- */

const presenceMessages = ["Over Your Conversation", "YouTube"];
let presenceIndex = 0;
let presenceTimer = null;

function updatePresence() {
  if (!client.user) return;
  try {
    client.user.setPresence({
      status: "dnd",
      activities: [{
        name: presenceMessages[presenceIndex],
        type: ActivityType.Watching,
      }],
    });
    presenceIndex = (presenceIndex + 1) % presenceMessages.length;
  } catch (error) {
    console.error("Presence update failed:", error);
  }
}

function startPresence() {
  updatePresence();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(updatePresence, 5000);
  presenceTimer.unref?.();
}

client.once(Events.ClientReady, async (bot) => {
  console.log(`Logged in as ${bot.user.tag}`);
  try {
    await registerCommands();
    console.log("Application commands registered.");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
  startPresence();
});

/* -------------------------------------------------------------------------- */
/* Shutdown                                                                   */
/* -------------------------------------------------------------------------- */

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down...`);

  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }

  try { client.destroy(); } catch (error) { console.error("Client destroy failed:", error); }
  process.exit(signal === "UNCAUGHT_EXCEPTION" ? 1 : 0);
}

process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason));
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

client.login(TOKEN).catch((error) => {
  console.error("Discord login failed:", error);
  process.exit(1);
});

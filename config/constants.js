"use strict";

const path = require("node:path");

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

const DATA_DIR = path.join(__dirname, "..", "data");
const TOS_PATH = path.join(DATA_DIR, "tos.json");
const BLACKLIST_PATH = path.join(DATA_DIR, "blacklist.json");
const PROFILE_PATH = path.join(DATA_DIR, "profiles.json");

module.exports = {
  BOT_NAME,
  SUPPORT_SERVER_INVITE,
  PROCESS_STARTED_AT_MS,
  BATCH_SIZE,
  CUSTOM_SESSION_TTL_MS,
  SUPPORT_CACHE_TTL_MS,
  normalizeId,
  TOKEN,
  CLIENT_ID,
  SUPPORT_SERVER_ID,
  SUPPORT_FEMALE_CHANNEL_ID,
  PREMIUM_ROLE_ID,
  LOG_CHANNEL_ID,
  LINK_USED_CHANNEL_ID,
  BOT_AUTOMOD_CHANNEL_ID,
  PEXELS_API_KEY,
  ALLOWED_MENTIONS_ALL,
  ALLOWED_MENTIONS_NONE,
  LAG_MESSAGES,
  SPAM_TEMPLATE,
  NITRO_IMAGE_URL,
  DATA_DIR,
  TOS_PATH,
  BLACKLIST_PATH,
  PROFILE_PATH,
};

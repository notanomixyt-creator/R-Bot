"use strict";

const fs = require("node:fs");
const {
  DATA_DIR,
  TOS_PATH,
  BLACKLIST_PATH,
  PROFILE_PATH,
  normalizeId,
} = require("../config/constants");

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

module.exports = {
  ensureDataDirectory,
  readJson,
  writeJson,
  tosData,
  blacklistedUsers,
  profileData,
  saveTos,
  saveBlacklist,
  saveProfiles,
};

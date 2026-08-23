"use strict";

const { profileData, saveProfiles } = require("../data/storage");

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

module.exports = { getProfile, recordCommandActivity, mostUsedCommand };

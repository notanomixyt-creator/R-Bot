"use strict";

const crypto = require("node:crypto");

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

module.exports = { randomInt, randomHex, formatUptime, formatDiscordTimestamp, formatDiscordRelative };

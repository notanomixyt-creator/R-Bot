"use strict";

const crypto = require("node:crypto");
const { CUSTOM_SESSION_TTL_MS } = require("../config/constants");

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

module.exports = {
  customSpamSessions,
  supportMemberCache,
  fakeIpHistory,
  createCustomSession,
  cleanupSessions,
};

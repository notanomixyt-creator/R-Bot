"use strict";

const { BATCH_SIZE, ALLOWED_MENTIONS_ALL } = require("../config/constants");

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

module.exports = { sendFiveMessages };

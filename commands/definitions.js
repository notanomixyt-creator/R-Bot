"use strict";

const {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} = require("discord.js");

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

module.exports = { commands, FEMALE_COMMAND };

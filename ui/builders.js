"use strict";

const {
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  ThumbnailBuilder,
} = require("discord.js");

const { ALLOWED_MENTIONS_ALL, ALLOWED_MENTIONS_NONE } = require("../config/constants");

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

function makeProfileSection(user, profile, cleanLog, mostUsed, mostCount, avatar) {
  return new SectionBuilder()
    .addTextDisplayComponents(
      text(`**User**\n\`${cleanLog(user.username, 80)}\``),
      text(`**Commands**\n\`${Number(profile.commands || 0)}\``),
      text(`**Most Used**\n\`/${mostUsed} (${mostCount})\``)
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));
}

module.exports = {
  V2,
  EPHEMERAL_V2,
  text,
  divider,
  neutralButton,
  linkButton,
  makeContainer,
  panel,
  buttonPanel,
  imagePanel,
  makeProfileSection,
};

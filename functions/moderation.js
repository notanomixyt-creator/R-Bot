"use strict";

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060\u2061\u2062\u2063\u2064\u2065\u2066\u2067\u2068\u2069\u206A-\u206F]/g;
const BIDI_RE = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const CONTROL_RE = /[\u0000-\u001F\u007F]/g;
const COMBINING_RE = /\p{M}/gu;

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
  for (const char of value) output += HOMOGLYPH_MAP.get(char) ?? char;
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
    if (rule.regex.test(forms.spaced) || rule.regex.test(forms.collapsed)) return rule.label;
  }

  for (const [needle, label] of COMPACT_NEEDLES) {
    if (forms.compact.includes(needle)) return label;
  }

  for (const run of forms.alnumRuns) {
    if (run.length < 3 || run.length > 32) continue;
    for (const [needle, label] of COMPACT_NEEDLES) {
      if (run === needle || (run.length <= needle.length + 3 && run.includes(needle))) return label;
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

module.exports = { normalizeForModeration, findBadWord, extractLinks };

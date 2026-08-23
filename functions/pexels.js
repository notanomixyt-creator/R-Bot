"use strict";

const { PEXELS_API_KEY } = require("../config/constants");

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

module.exports = { searchPexels, getFemalePhoto };

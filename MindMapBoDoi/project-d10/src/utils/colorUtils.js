// src/utils/colorUtils.js

/**
 * Darkens a hex color by a given percentage.
 * @param {string} hex - The hex color code (e.g., '#RRGGBB' or '#RGB').
 * @param {number} amount - The percentage to darken (0-100). E.g., 20 means 20% darker.
 * @returns {string} The darkened hex color code.
 */
export const darkenColor = (hex, amount) => {
  if (!hex) return '#000000'; // Return black if invalid input

  let color = hex.startsWith('#') ? hex.slice(1) : hex;

  // Handle shorthand hex (#RGB)
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }

  // Ensure valid hex length
  if (color.length !== 6) {
    return '#000000'; // Return black for invalid length
  }

  const num = parseInt(color, 16);
  let r = (num >> 16);
  let g = ((num >> 8) & 0x00FF);
  let b = (num & 0x0000FF);

  const factor = (100 - amount) / 100;

  r = Math.max(0, Math.min(255, Math.round(r * factor)));
  g = Math.max(0, Math.min(255, Math.round(g * factor)));
  b = Math.max(0, Math.min(255, Math.round(b * factor)));

  const newHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

  return newHex;
};
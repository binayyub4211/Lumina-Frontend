#!/usr/bin/env node

const pairs = [
  { fg: "#000000", bg: "#ffffff", name: "text on bg (solar)", required: 10 },
  { fg: "#1a1a1a", bg: "#ffffff", name: "text-secondary on bg (solar)", required: 10 },
  { fg: "#2a2a2a", bg: "#ffffff", name: "text-tertiary on bg (solar)", required: 10 },
  { fg: "#0020b3", bg: "#ffffff", name: "primary on bg (solar)", required: 10 },
  { fg: "#001999", bg: "#ffffff", name: "primary-hover on bg (solar)", required: 10 },
  { fg: "#ffffff", bg: "#0020b3", name: "primary-text on primary (solar)", required: 10 },
  { fg: "#004d00", bg: "#ffffff", name: "secondary on bg (solar)", required: 10 },
  { fg: "#8b0000", bg: "#ffffff", name: "danger on bg (solar)", required: 10 },
  { fg: "#8b0000", bg: "#ffffff", name: "danger-text on bg (solar)", required: 10 },
  { fg: "#4a3a00", bg: "#ffffff", name: "warning on bg (solar)", required: 10 },
  { fg: "#3a2e00", bg: "#ffffff", name: "warning-fill on bg (solar)", required: 10 },
  { fg: "#000000", bg: "#f5f5f5", name: "text on surface (solar)", required: 10 },
  { fg: "#001999", bg: "#e0e8ff", name: "tag-text on tag-bg (solar)", required: 10 },
  { fg: "#ffffff", bg: "#000000", name: "nav-text on nav-bg (solar)", required: 10 },
  { fg: "#000000", bg: "#ffffff", name: "focus-ring on bg (solar)", required: 12 },
  { fg: "#171717", bg: "#ffffff", name: "text on bg (light)", required: 0 },
  { fg: "#6f5f48", bg: "#f7f4ee", name: "text-secondary on bg (light)", required: 0 },
  { fg: "#0f766e", bg: "#f7f4ee", name: "primary on bg (light)", required: 0 },
  { fg: "#ffffff", bg: "#0f766e", name: "primary-text on primary (light)", required: 0 },
  { fg: "#ededed", bg: "#0a0a0a", name: "text on bg (dark)", required: 0 },
  { fg: "#2dd4bf", bg: "#0a0a0a", name: "primary on bg (dark)", required: 0 },
  { fg: "#0a0a0a", bg: "#2dd4bf", name: "primary-text on primary (dark)", required: 0 },
];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

function srgb(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let failures = 0;

for (const { fg, bg, name, required } of pairs) {
  const ratio = contrastRatio(fg, bg);
  const passesText = ratio >= 10.0;
  const passesAAA = ratio >= 7.0;
  const meetsRequired = required === 0 || ratio >= required;

  let status;
  if (required === 0) {
    status = "INFO";
  } else if (meetsRequired) {
    status = "PASS";
  } else {
    status = "FAIL";
  }

  if (required > 0 && !meetsRequired) failures++;
  console.log(
    `${status.padEnd(8)} ${ratio.toFixed(2).padStart(5)}:1  ${name}  (${fg} on ${bg})`,
  );
}

console.log(`\n---`);
if (failures === 0) {
  console.log(`All required contrast pairs meet minimum thresholds.`);
} else {
  console.log(`${failures} pair(s) below required threshold.`);
  process.exitCode = 1;
}

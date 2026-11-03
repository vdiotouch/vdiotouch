/*
 * Light design tokens as plain values, for code that cannot read CSS
 * variables (the AntD theme). Light only: there is no dark mode.
 *
 * Copied by hand from the light (`:root`) block of src/styles/tokens.css.
 * If tokens.css is regenerated, update this map to match.
 *
 * In components, prefer the CSS variables (`var(--surface-sunken)`) in a
 * `.module.css` file over importing these values.
 */
export const tokens = {
  surface: "#ffffff",
  raised: "#ffffff",
  sunken: "#f8faff",
  overlay: "#ffffff",
  content: "#12151a",
  muted: "#5a5e65",
  subtle: "#6f737a",
  inverted: "#f8faff",
  borderSubtle: "#e4e8f0",
  borderStrong: "#6f737a",
  focus: "#2d4aec",
  interactive: "#2d4aec",
  interactiveHover: "#2134cc",
  interactiveActive: "#1826aa",
  interactiveFg: "#ffffff",
  interactiveText: "#2d4aec",
  interactiveTextHover: "#2134cc",
  interactiveSubtle: "#f1f5ff",
  success: "#007a36",
  successText: "#00622a",
  successSurface: "#eff8f0",
  successBorder: "#2f9b51",
  warning: "#885a00",
  warningText: "#6e4800",
  warningSurface: "#fcf4ea",
  warningBorder: "#af7600",
  danger: "#bf0314",
  dangerText: "#9c000d",
  dangerSurface: "#fff2f0",
  dangerBorder: "#e2413b",
  processing: "#007185",
  processingText: "#005b6b",
  processingSurface: "#ecf8fb",
  processingBorder: "#0093ab",
} as const;

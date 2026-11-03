#!/usr/bin/env node
/**
 * Generates src/styles/tokens.css (Tailwind v4 `@theme` + theme variables).
 *
 * This file is the derivation. Nothing below is a hand-picked hex except the
 * two PRD §21.1 anchors and the hue/chroma geometry; every ramp step falls out
 * of the ladder, and every semantic token is a named reference to a step.
 *
 * Why OKLCH and not HSL
 * ---------------------
 * HSL's "lightness" is not perceptual: `hsl(60 100% 50%)` (yellow) and
 * `hsl(240 100% 50%)` (blue) are both "50%" and differ by roughly 8:1 in
 * measured contrast. That makes "change the hue, keep the contrast" impossible,
 * which is exactly the operation a brand needs to survive.
 *
 * OKLCH's L tracks perceived lightness, so one shared lightness ladder across
 * every chromatic ramp means a hue change can never move a contrast ratio. That
 * property is what lets §21.5's hue shift be a one-line change rather than a
 * re-audit.
 *
 * Run: npm run tokens:build
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ------------------------------------------------------ sRGB <-> OKLCH ---- */
const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const hex = (v) => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, '0')
const toHex = ([r, g, b]) => ('#' + hex(r) + hex(g) + hex(b)).toUpperCase()

function oklchToLinearRgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)

/**
 * Gamut-map by reducing chroma while holding lightness and hue. Clipping RGB
 * channels instead would shift the hue, which would break the "one ladder,
 * stable contrast" guarantee at the saturated end of a ramp.
 */
function oklch(L, C, H) {
  let rgb = oklchToLinearRgb(L, C, H)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = C
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinearRgb(L, mid, H))) lo = mid
      else hi = mid
    }
    rgb = oklchToLinearRgb(L, lo, H)
  }
  return toHex(rgb.map(unlin))
}

/* ------------------------------------------------------------ geometry ---- */

// One shared lightness ladder for every chromatic ramp. Pinned so that step 600
// reproduces the PRD §21.1 primary anchor #2D4AEC (L=0.506) exactly, and step
// 700 lands on its hover anchor #1E37C9 (L=0.435).
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const L_LADDER = {
  50: 0.971, 100: 0.936, 200: 0.885, 300: 0.82, 400: 0.715,
  500: 0.61, 600: 0.506, 700: 0.435, 800: 0.375, 900: 0.32, 950: 0.235,
}
// Chroma as a fraction of the anchor's, peaking at the anchor step.
const C_TAPER = {
  50: 0.1, 100: 0.21, 200: 0.38, 300: 0.6, 400: 0.84,
  500: 0.97, 600: 1.0, 700: 0.94, 800: 0.84, 900: 0.74, 950: 0.56,
}

// Neutrals need a wider range: they supply page backgrounds AND body text in
// two themes, so they run from pure white to near-black.
const N_STEPS = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 975, 1000]
const N_LADDER = {
  0: 1.0, 50: 0.985, 100: 0.967, 200: 0.93, 300: 0.88, 400: 0.79,
  500: 0.68, 600: 0.555, 700: 0.48, 800: 0.36, 900: 0.265,
  950: 0.195, 975: 0.15, 1000: 0.11,
}

const ramp = (hue, chroma) =>
  Object.fromEntries(STEPS.map((s) => [s, oklch(L_LADDER[s], chroma * C_TAPER[s], hue)]))

const BRAND_HUE = 267.7 // from #2D4AEC
const BRAND_C = 0.243
// #A855F7 is OKLCH hue 303.9 — exactly Tailwind purple-500 (PRD §21.5). Shifted
// +9.1 deg: ~2 JND at this chroma, so it reads as distinct side by side while
// staying the same colour family, and it lands in the gap between purple-500
// and fuchsia-500 (322) rather than on another stock value. Chroma is
// #A855F7's own, so hue is the only thing that changed.
const ACCENT_HUE = 313.0
const ACCENT_C = 0.233

const ramps = {
  brand: ramp(BRAND_HUE, BRAND_C),
  'brand-accent': ramp(ACCENT_HUE, ACCENT_C),
  // Status hues, all >=30 deg clear of both brand hues (FR-BRD-04). `processing`
  // is cyan rather than the obvious blue precisely so an in-flight encode never
  // reads as branded chrome.
  success: ramp(150.0, 0.15),
  warning: ramp(75.0, 0.165),
  danger: ramp(27.0, 0.205),
  processing: ramp(215.0, 0.135),
  neutral: Object.fromEntries(N_STEPS.map((s) => [s, oklch(N_LADDER[s], 0.012, 265.0)])),
}

const R = ramps
const WHITE = '#FFFFFF'

/* ----------------------------------------------------- semantic mapping ---- */
// [light, dark]. Dark-theme steps are chosen so the ratio holds against a
// near-black page — the case PRD §21.2's on-white table never covers.
const semantic = {
  surface: [WHITE, R.neutral[975]],
  'surface-raised': [WHITE, R.neutral[900]],
  'surface-sunken': [R.neutral[50], R.neutral[1000]],
  'surface-overlay': [WHITE, R.neutral[900]],

  content: [R.neutral[950], R.neutral[50]],
  'content-muted': [R.neutral[700], R.neutral[300]],
  'content-subtle': [R.neutral[600], R.neutral[400]],
  'content-inverted': [R.neutral[50], R.neutral[950]],

  'border-subtle': [R.neutral[200], R.neutral[800]],
  // One value for both themes: >=3:1 against a white page AND a near-black one
  // is a narrow window, and neutral-600 sits inside it.
  'border-strong': [R.neutral[600], R.neutral[600]],
  'border-focus': [R.brand[600], R.brand[400]],

  interactive: [R.brand[600], R.brand[500]],
  'interactive-hover': [R.brand[700], R.brand[400]],
  'interactive-active': [R.brand[800], R.brand[300]],
  // Inverts by theme. White on the dark theme's brand-500 fill is 3.96:1 — a
  // fail. Near-black on it is 4.97:1. Material 3 and Primer do the same.
  'interactive-foreground': [WHITE, R.neutral[975]],
  'interactive-text': [R.brand[600], R.brand[400]],
  'interactive-text-hover': [R.brand[700], R.brand[300]],
  'interactive-subtle': [R.brand[50], oklch(N_LADDER[975] + 0.035, 0.055, BRAND_HUE)],

  // FR-BRD-01: -decor is 4.25:1 on white. Legal for fills, borders, icons
  // >=24px, large display type and illustration. NOT for normal-size text.
  // FR-BRD-02: -text is the purple that carries text, 6.69:1 on white.
  'accent-decor': [R['brand-accent'][500], R['brand-accent'][400]],
  'accent-text': [R['brand-accent'][600], R['brand-accent'][400]],
  'accent-subtle': [R['brand-accent'][50], oklch(N_LADDER[975] + 0.035, 0.055, ACCENT_HUE)],
}

for (const s of ['success', 'warning', 'danger', 'processing']) {
  const hueBySlot = { success: 150.0, warning: 75.0, danger: 27.0, processing: 215.0 }
  semantic[`status-${s}`] = [R[s][600], R[s][400]]
  semantic[`status-${s}-text`] = [R[s][700], R[s][300]]
  semantic[`status-${s}-surface`] = [R[s][50], oklch(N_LADDER[975] + 0.025, 0.04, hueBySlot[s])]
  semantic[`status-${s}-border`] = [R[s][500], R[s][500]]
}

/* ------------------------------------------------------------- player ---- */
// Each alpha is the minimum at which the control it backs clears its WCAG
// threshold against a pure white frame — the worst case a video can present.
// Solved, not chosen; scripts/check-contrast.mjs re-verifies them every build.
const scrim = { control: 0.7, icon: 0.45, caption: 0.75, controlLight: 0.88 }

const player = {
  'player-scrim-control': `0 0 0 / ${scrim.control}`,
  'player-scrim-icon': `0 0 0 / ${scrim.icon}`,
  'player-caption-bg': `0 0 0 / ${scrim.caption}`,
  'player-caption-fg': WHITE,
  'player-control': WHITE,
  'player-control-muted': R.neutral[300],
  // Opaque on purpose. A translucent track composites with the frame and is
  // 1.06:1 against a brand fill over a white video. Opaque is 5.18:1 always.
  'player-track': R.neutral[200],
  'player-track-buffer': R.neutral[500],
  'player-fill': R.brand[600],
  'player-handle': WHITE,
}
const playerLight = {
  'player-scrim-control': `255 255 255 / ${scrim.controlLight}`,
  'player-control': R.neutral[950],
  'player-control-muted': R.neutral[800],
  'player-track': R.neutral[200],
  // A light scrim cannot carry the seek bar's boundary on the track alone, so
  // the boundary moves to a 1px outline.
  'player-track-outline': R.neutral[600],
  'player-track-buffer': R.neutral[400],
  'player-fill': R.brand[600],
  'player-handle': R.neutral[950],
}

/* ------------------------------------------------------------- emit ---- */
const lower = (h) => h.toLowerCase()
const value = (v) => (v.startsWith('#') ? lower(v) : `rgb(${v})`)

const SHADCN = [
  ['background', 'surface'], ['foreground', 'content'],
  ['card', 'surface-raised'], ['card-foreground', 'content'],
  ['popover', 'surface-overlay'], ['popover-foreground', 'content'],
  ['primary', 'interactive'], ['primary-foreground', 'interactive-foreground'],
  ['secondary', 'surface-sunken'], ['secondary-foreground', 'content'],
  ['muted', 'surface-sunken'], ['muted-foreground', 'content-subtle'],
  ['accent', 'surface-sunken'], ['accent-foreground', 'content'],
  ['destructive', 'status-danger'], ['destructive-foreground', 'content-inverted'],
  ['border', 'border-subtle'], ['input', 'border-strong'], ['ring', 'border-focus'],
]
const STATUSES = ['success', 'warning', 'danger', 'processing']
const PLAYER_UTILS = [
  'player-control', 'player-control-muted', 'player-track',
  'player-track-buffer', 'player-fill', 'player-handle',
]
// The brand purple is exposed as `brand-accent-*` so it never collides with
// shadcn's `accent` (a subtle hover surface).
const utilName = (k) => (k.startsWith('accent-') ? `brand-${k}` : k)

const css = [
  '/* AUTO-GENERATED by scripts/generate-tokens.mjs — do not hand-edit.',
  '   Run `npm run tokens:build` to regenerate. Hex values only. */',
  '',
  '@theme {',
  '  /* ---- raw ramps. Escape hatch; prefer the semantic tokens below. ---- */',
  ...Object.entries(ramps).flatMap(([name, steps]) => [
    ...Object.entries(steps).map(([s, h]) => `  --color-${name}-${s}: ${lower(h)};`),
    '',
  ]),
  '  --radius-sm: 0.25rem;',
  '  --radius-md: 0.375rem;',
  '  --radius-lg: 0.5rem;',
  '  --radius-xl: 0.75rem;',
  '',
  '  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,',
  '    "Helvetica Neue", Arial, sans-serif;',
  '',
  '  --animate-blink: blink 1.5s ease-in-out infinite;',
  '  @keyframes blink {',
  '    0%,',
  '    100% {',
  '      opacity: 1;',
  '    }',
  '    50% {',
  '      opacity: 0.35;',
  '    }',
  '  }',
  '}',
  '',
  ':root {',
  ...Object.entries(semantic).map(([k, [l]]) => `  --${k}: ${lower(l)};`),
  '',
  '  /* player chrome. Dark scrim is the default in BOTH themes: contrast',
  '     over video comes from the scrim, not the page theme. */',
  ...Object.entries(player).map(([k, v]) => `  --${k}: ${value(v)};`),
  '}',
  '',
  '.dark {',
  ...Object.entries(semantic).map(([k, [, d]]) => `  --${k}: ${lower(d)};`),
  '}',
  '',
  '/* Opt-in light player variant (FR-BRD-07). Audited, but not the default.',
  '   Apply to the player root: <div class="vt-player player-theme-light"> */',
  '.player-theme-light {',
  ...Object.entries(playerLight).map(([k, v]) => `  --${k}: ${value(v)};`),
  '}',
  '',
  '/* Tailwind colour utilities. `@theme inline` so every class resolves through',
  '   the variables above and flips with `.dark`. */',
  '@theme inline {',
  '  /* semantic layer — prefer these in new code */',
  ...Object.keys(semantic)
    .filter((k) => !k.startsWith('status-'))
    .map((k) => `  --color-${utilName(k)}: var(--${k});`),
  '',
  '  /* status: semantic, never substituted with brand hues (FR-BRD-04).',
  '     Always pair with an icon and a text label (FR-BRD-05). */',
  ...STATUSES.flatMap((s) => [
    `  --color-${s}: var(--status-${s});`,
    `  --color-${s}-fg: var(--status-${s}-text);`,
    `  --color-${s}-surface: var(--status-${s}-surface);`,
    `  --color-${s}-line: var(--status-${s}-border);`,
  ]),
  '',
  '  /* shadcn/ui aliases: same class names, audited values */',
  ...SHADCN.map(([a, b]) => `  --color-${a}: var(--${b});`),
  '',
  '  /* player chrome */',
  ...PLAYER_UTILS.map((k) => `  --color-${k}: var(--${k});`),
  '  --color-player-caption: var(--player-caption-fg);',
  '}',
  '',
].join('\n')

writeFileSync(join(ROOT, 'src/styles/tokens.css'), css)
console.log('wrote src/styles/tokens.css')

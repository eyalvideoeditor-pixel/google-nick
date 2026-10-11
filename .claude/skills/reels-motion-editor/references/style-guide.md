# House Style Guide

Extracted frame-by-frame from the user's finished reference reel (576x1024 export of a 1080x1920 / 25fps edit, 49s, Hebrew talking head). All sizes below are given for **1080x1920**.

## 1. Typography (all on-screen text)

- **Font**: heavy, *condensed*, sans-serif Hebrew display face with square terminals (tall narrow letters, tight word spacing). Ask the user for the exact font file they use in AE/Premiere and put it in `template/public/fonts/`. Until then use **Karantina Bold** (Google Fonts) - the closest free match.
- **Size**: ~58-64px cap height for one-line subtitles (≈ 5.5% of frame width). Lines are short: 2-4 words, max ~70% of frame width.
- **Never** a stroke/outline, never a box behind text.
- Shadow: `0 3px 10px rgba(0,0,0,0.55)` - just enough to read on bright backgrounds.

### Two text roles

| Role | Who makes it | Color | Position (center Y) | Motion |
|---|---|---|---|---|
| Regular subtitle | User, in Premiere | pure white `#FFFFFF` | ~75% of height (y≈1440) | hard cut per phrase |
| **Animated subtitle** ([T] segments, and text inside animations) | This skill | warm cream gradient, top `#FFFFFF` → bottom `#EFE6BC` | ~68% of height (y≈1300) on footage; inside animations wherever the layout needs, usually on the baseline/timeline | letter-by-letter (below) |

## 2. Animated subtitle - the exact motion

Observed at 25fps on "להתחיל לפני חמש שנים":

1. **RTL letter-by-letter reveal**. The line is anchored on its final centered position; letters appear starting from the **right** (first Hebrew letter) toward the left.
2. **Cadence**: ~1.2 frames per character (≈20 characters in ~24 frames). Spaces count as a character. Speed it up for long lines so the reveal ends before the speaker finishes the phrase.
3. **Per-letter entrance** (≈6 frames each, overlapping): starts at `scale 0.55`, `opacity 0`, shifted ~0.35em further **left** (ahead of the writing direction) and slightly lower; springs into place (`damping ~14`, small overshoot ≈ 1.04). Because 4-5 letters are in flight at once, the leading edge looks like small, widely spaced letters ("ש נ י ם") that compress into the word - that is the signature look.
4. **Hold** fully formed until the phrase ends.
5. **Exit**: the whole line slides **left** ~40% of the frame width in 3-4 frames with an ease-in and is cut (no fade), as the next line starts writing in. Optional: motion blur on the exit (`<CameraMotionBlur>` or a 2-frame `filter: blur(6px)`).
6. **Next-line preview** (used in places): the next line can sit below the current one in dim gray `rgba(200,200,200,0.35)`, slightly blurred, then "lights up" (to cream, blur 0) when it becomes active.
7. Text inside animation scenes (e.g. on the timeline baseline: "הוא כנראה", "בדיוק מה שימנע") uses the same reveal, slightly smaller (~48px), white.

## 3. Animation scenes - visual language

Palette (sampled):

| Token | Hex | Use |
|---|---|---|
| bgBlack | `#000000` - `#010B00` | outer background |
| bgGreenDeep | `#002A06` | radial background center |
| greenMid | `#248A26` | glass body fill |
| neon | `#3CFF3A` | strokes, curves, year numbers, highlights |
| neonSoft | `#7DFF6B` | rim light / inner glow |
| cream | `#EFE6BC` | text gradient bottom |

Recurring elements (all exist as components in `template/src/components`):

- **NeonBackground** - black frame with a large soft radial green glow, usually off-center (upper-right or behind the subject). Slow drift of the glow center.
- **GlassCard** - rounded rectangle (radius ≈ 40px), translucent green fill gradient (top-left brighter), 3px neon border with outer glow, inner shadow at the bottom. Holds a chart.
- **YearCounter** - big neon year top-left in the card ("2026" → "2027" → "2030" → "2031"), condensed font, ticks one value at a time with a tiny vertical flip.
- **GrowthCurve** - S-curve drawn with an SVG path (stroke-dashoffset), neon, 6px, glowing; its head is brightest.
- **Timeline** - horizontal neon baseline with small vertical tick marks; ticks pop in left→right.
- **GlassFigure** - person silhouette made of a glossy sphere (head) + dome (body); green glass with white rim light along the top edge and darker bottom. Used as the "viewer / you" character, often cropped by the frame edge and large in the foreground.
- **PillLabel** - rounded pill with glass fill and neon border, text inside ("לחכות" / "להשקיע"); pops in with overshoot.
- **Extruded3DText** - huge extruded neon-green glyph ("?") with darker side faces, slight rotation, more copies blurred in the background for depth.

## 4. Camera & transitions (between footage and animation)

- **Cut-in**: hard cut or 2-4 frame **white flash** (overexposed footage → white → animation).
- Inside a scene: continuous **slow push-in** (scale 1.00 → 1.08 over the scene) plus small parallax between layers (foreground figure moves more than the card). Big moves are **whip-zooms** onto a detail (e.g. from the card down into the figure's head) with motion blur.
- **Green-tint cutaway**: speaker footage graded monochrome green (`filter: grayscale(1) sepia(1) hue-rotate(60deg) saturate(4)` approx), with a **pixel/particle dissolve** edge eating the frame, then a **glitch / pixel-sort** frame or two returning to normal footage.
- **Color-wash transition**: full-frame warm gradient (peach `#F4B7A0` → cream `#F6E3A8`) for 3-5 frames between two shots.
- Footage itself is often punched-in (110-130%) on emphasis lines and the background softened - that is done in Premiere, not here.

## 5. Pacing

- Animation segments are 2-6 seconds, matching one or two sentences.
- Every element enters on the spoken word that refers to it.
- Something should move on every frame; no static holds longer than ~12 frames.

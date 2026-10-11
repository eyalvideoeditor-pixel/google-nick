# Remotion Recipes

All components live in `template/src/components`. Scenes in `template/src/scenes` are worked examples rebuilt from the reference reel - copy one as the starting point for a new [A] segment.

## Rebuilding a reference image - worked procedure

1. Open the image, list every element top to bottom:
   ```
   bg: black, green glow upper-right            -> NeonBackground cx=.75 cy=.3
   card 66% wide, top 12%, rounded, glass       -> GlassCard
   "2026" neon top-left of card                 -> YearCounter
   rising S-curve inside card                   -> GrowthCurve
   baseline with ticks under card               -> Timeline
   big green person bottom-right, cropped       -> GlassFigure size=520
   caption on baseline                          -> AnimatedSubtitle y=.355 fontSize=52
   ```
2. Convert positions from the image to 1080x1920 px (`x_px = x% * 1080`). If the reference is not 9:16, re-compose for 9:16 rather than stretching.
3. Anything without a component: build it from divs (CSS gradients, `border-radius`, `box-shadow` for glow, `inset` shadows for glass) or an SVG `<path>`. Trace curved shapes as SVG paths by eye from the image; animate them with `pathLength={1}` + `strokeDashoffset`.
4. Photographic/complex textures that cannot be rebuilt with shapes (rare): ask the user whether to keep them as an image layer; if yes, still animate it (parallax, mask reveal) - never a static still.
5. Map each element's entrance to the word timings from the transcript (`Math.round(seconds * 25)`).

## Timing helpers

```ts
const f = (sec: number) => Math.round(sec * 25);       // seconds -> frames
// word-synced entrance inside a Sequence that starts at the segment start:
<GlassCard enterFrame={f(word.start - segment.start)} ... />
```

## Motion vocabulary (match the reference)

| Want | Code |
|---|---|
| pop with overshoot | `spring({frame, fps, config: {damping: 9-12, stiffness: 150-180}})` |
| soft settle | `spring({... damping: 16-20})` |
| draw a line | `interpolate(frame,[a,b],[0,1],{easing: Easing.inOut(Easing.cubic)})` -> strokeDashoffset |
| camera push | `<PushIn to={1.07}>` |
| whip zoom to detail | scale 1 -> 3 over 6 frames, `Easing.in(Easing.exp)`, transformOrigin at the detail, plus `filter: blur()` peaking mid-move |
| flash cut-in | `<WhiteFlash at={0} />` |
| warm wash between shots | `<ColorWash at={n} />` |
| deterministic jitter/particles | `random('seed-' + i)` from `remotion` |

## Using the speaker footage inside a scene

```tsx
import {OffthreadVideo, staticFile} from 'remotion';
<OffthreadVideo src={staticFile('source.mp4')} startFrom={f(12.4)}
  style={{filter: 'grayscale(1) sepia(1) hue-rotate(60deg) saturate(4) brightness(0.8)'}} />
```
Put the source in `public/`. For the pixel-dissolve edge, overlay a grid of small black squares whose opacity is driven by `random(i)` against a moving threshold.

## Render commands

```bash
# still for review
npx remotion still YearsChart out/check.png --frame=40
# full-screen animation for Premiere
npx remotion render YearsChart out/00-12-08_years.mp4 --codec=h264 --crf=16
# transparent overlay (animated subtitles) for Premiere
npx remotion render SubtitleOverlay out/00-20-15_subs.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png
# pass lines without editing code
npx remotion render SubtitleOverlay out/subs.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png \
  --props='{"lines":[{"text":"מה שמנע ממך","start":0,"end":1.2}]}'
```
SubtitleOverlay's duration is computed from `lines` (calculateMetadata), so `--props` alone is enough.

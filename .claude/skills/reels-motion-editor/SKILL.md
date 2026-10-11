---
name: reels-motion-editor
description: Edit vertical Hebrew talking-head reels in the user's house style - pick the sentences to illustrate, rebuild AI reference images as animated Remotion scenes (dark-to-neon-green glass look), render letter-by-letter animated subtitles, and hand back alpha/MP4 renders plus an SFX cue sheet for Premiere. Use whenever the user wants to edit a reel/short, animate a sentence, recreate a reference image as motion graphics, make animated text/subtitles, or plan sound design for an animation. Triggers - "ערוך סרטון", "אנימציה למשפט", "תבנה את התמונה ברימושן", "כתוביות מונפשות", reel, short, Remotion, motion graphics.
---

# Reels Motion Editor

Replaces the user's After Effects step. Their pipeline:

1. Raw vertical video (1080x1920, 25fps, Hebrew speaker to camera).
2. They choose sentences to **illustrate** (full-screen animation) or **emphasize** (animated text).
3. **This skill** builds those pieces in Remotion (was: After Effects).
4. User goes back to Premiere: regular subtitles, SFX, music.

So the deliverables are always: rendered clips that drop onto the Premiere timeline at the right timecode + an SFX cue sheet so the sound design lands on the animation beats.

Read `references/style-guide.md` before building anything - it is the visual spec extracted from the user's reference reel. Code patterns are in `references/remotion-recipes.md`. A working Remotion project lives in `template/`.

## Step 0 - Setup (once per project)

```bash
cp -r <skill-dir>/template ./reel-<name> && cd ./reel-<name>
npm install
# put the user's subtitle font in public/fonts/ and set FONT_FILE in src/theme.ts
npx remotion studio   # live preview
```

Requires Node 18+, ffmpeg. If missing, tell the user what to install - do not silently fall back.

## Step 1 - Get the transcript with timings

- Preferred: user exports SRT from Premiere (Text panel → Captions → Export).
- Otherwise transcribe: `whisper video.mp4 --language he --model large-v3 --word_timestamps True --output_format json` (or whisper.cpp / faster-whisper). Hebrew needs large models.
- Convert to `src/data/transcript.json`: `[{ "text": "...", "start": 12.34, "end": 14.10 }]` in seconds, per sentence; keep word timings if available.
- Optional: extract audio peaks (`ffmpeg -i video.mp4 -ac 1 -ar 1000 -f f32le -`) to snap hits to speech accents.

## Step 2 - Agree on what to animate

Show the transcript as a numbered list with timecodes. The user marks lines:
- **[A] Animation** - full-screen illustration (reference image coming).
- **[T] Animated text** - letter-by-letter subtitle over the footage.
- Unmarked → regular subtitle, done by the user in Premiere (not our job, but note style in the guide if asked).

If the user did not mark anything, suggest 3-6 candidates: numbers/years, contrasts ("לחכות / להשקיע"), questions, punchlines, list items. Ask before building.

## Step 3 - Rebuild the reference image in Remotion

The user brings an AI-generated reference image per [A] segment. **Never** drop the image into the video as a still. Rebuild it:

1. **Look at the image** and write an element breakdown before coding: background, each object (shape, color, glow, gradient, position as % of 1080x1920), text, depth/layering. Map every object to a primitive: CSS div with gradients/box-shadow, SVG path, or an existing component in `template/src/components`.
2. **Reuse first**: NeonBackground, GlassCard, GlassFigure, GrowthCurve, Timeline, PillLabel, YearCounter, Extruded3DText, AnimatedSubtitle. Add new components to `src/components` in the same style when needed.
3. **Re-skin to the house style** unless the user says to keep the reference colors: black → deep green radial background, glossy neon-green glass shapes, cream/white condensed Hebrew text (see style guide).
4. **Choreograph to the speech**: each element enters on the word that names it (use word timings). Build-up order: background → container → main object → data/labels → accent motion. Keep something moving every frame (slow camera push 1.00→1.08, curve drawing, counters ticking).
5. **Render a still for review first**: `npx remotion still <Comp> out/check.png --frame=<n>` and show it next to the reference. Iterate on the still; only then render video.

## Step 4 - Animated text segments [T]

Use `<AnimatedSubtitle>` (letter-by-letter RTL reveal, exact spec in style guide). One composition per segment, transparent background, duration = sentence length + 10 frames tail.

## Step 5 - Render for Premiere

- Full-screen animation: `npx remotion render <Comp> out/<tc>_<name>.mp4 --codec=h264 --crf=16`
- Overlay with transparency (animated text, overlays on footage): `npx remotion render <Comp> out/<tc>_<name>.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png`
- If the animation includes the speaker footage (e.g. green-tinted cutaway), pass the source clip via `<OffthreadVideo>` with `startFrom` at the segment timecode.
- Name files with the start timecode (`00-12-08_years-chart.mov`) so placement in Premiere is trivial.

## Step 6 - SFX cue sheet

For every render, write `out/<name>_sfx.md` (and a Premiere-importable marker CSV if asked) listing frame → timeline timecode → suggested sound, derived from the actual keyframes:

| Event in animation | Sound |
|---|---|
| Scene cut into animation / white flash | whoosh-in or impact "hit" |
| Each subtitle letter burst | soft typing tick / UI click (only on [T] segments, low volume) |
| Card / pill pops in (overshoot spring) | pop / bubble |
| Line or curve drawing | riser / swipe whose length = draw duration |
| Number / year counter ticking | digital tick per change |
| 3D object slam (question mark) | boom / low thud + short reverse swell before |
| Glitch / pixel dissolve back to footage | glitch / digital crunch |
| Exit back to footage | whoosh-out |

Music is chosen by the user from their own folder - ignore unless asked.

## Rules

- 1080x1920, 25 fps unless the source says otherwise (check with `ffprobe`).
- Keep important content inside the safe area: top 12% and bottom 18% are covered by platform UI.
- Hebrew is RTL: always `direction: 'rtl'` on text containers; numbers stay LTR inside.
- Everything must be deterministic (Remotion): no `Math.random()` - use `random(seed)` from `remotion`.
- Show a still before every full render; renders are slow.

import {continueRender, delayRender, staticFile} from 'remotion';

// Swap for the user's own font file in public/fonts (e.g. 'fonts/MyFont-Black.otf').
// Default: Karantina Bold (SIL OFL), the closest free match to the reference reel.
export const FONT_FILE = 'fonts/Karantina-Bold.ttf';

export const FONT_FAMILY = 'HouseFont';

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading house font');
  const face = new FontFace('HouseFont', `url(${staticFile(FONT_FILE)})`);
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}

export const COLORS = {
  bgBlack: '#000000',
  bgGreenDeep: '#002A06',
  greenMid: '#248A26',
  neon: '#3CFF3A',
  neonSoft: '#7DFF6B',
  cream: '#EFE6BC',
  white: '#FFFFFF',
};

export const FPS = 25;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const glow = (color: string, size = 18) =>
  `0 0 ${size}px ${color}, 0 0 ${size * 2.5}px ${color}66`;

export const creamText: React.CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontWeight: 700,
  backgroundImage: `linear-gradient(180deg, ${COLORS.white} 15%, ${COLORS.cream} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.55))',
};

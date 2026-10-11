import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONT_FAMILY, glow} from '../theme';

/** Neon number that switches value at given frames with a tiny vertical flip. */
export const YearCounter: React.FC<{steps: {frame: number; value: string}[]; x: number; y: number; fontSize?: number}> = ({
  steps,
  x,
  y,
  fontSize = 110,
}) => {
  const frame = useCurrentFrame();
  const current = [...steps].reverse().find((s) => frame >= s.frame) ?? steps[0];
  const since = frame - current.frame;
  const flip = interpolate(since, [0, 4], [0.4, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize,
        lineHeight: 1,
        color: COLORS.neon,
        textShadow: glow(COLORS.neon, 10),
        transform: `translateY(${flip * -fontSize}px)`,
        opacity: 1 - flip,
      }}
    >
      {current.value}
    </div>
  );
};

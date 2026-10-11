import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, glow} from '../theme';

/** Neon baseline with tick marks that pop in left to right. */
export const Timeline: React.FC<{x: number; y: number; width: number; ticks?: number; startFrame?: number}> = ({
  x,
  y,
  width,
  ticks = 5,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const line = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: x, top: y, width}}>
      <div style={{height: 4, width: width * line, background: COLORS.neon, boxShadow: glow(COLORS.neon, 8), borderRadius: 2}} />
      {Array.from({length: ticks}).map((_, i) => {
        const s = spring({frame: frame - startFrame - 4 - i * 2, fps, config: {damping: 12}});
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: ((i + 0.5) / ticks) * width,
              top: -12,
              width: 4,
              height: 28,
              background: COLORS.neon,
              transform: `scaleY(${s})`,
              boxShadow: glow(COLORS.neon, 6),
            }}
          />
        );
      })}
    </div>
  );
};

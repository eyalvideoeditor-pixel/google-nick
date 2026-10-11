import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../theme';

/** Black frame with a large, slowly drifting radial green glow. */
export const NeonBackground: React.FC<{cx?: number; cy?: number; intensity?: number}> = ({
  cx = 0.7,
  cy = 0.3,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 1]);
  const x = (cx - 0.04 * drift) * 100;
  const y = (cy + 0.03 * drift) * 100;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 85% 60% at ${x}% ${y}%, ${COLORS.greenMid}${Math.round(
          0x99 * intensity,
        )
          .toString(16)
          .padStart(2, '0')} 0%, ${COLORS.bgGreenDeep} 40%, ${COLORS.bgBlack} 85%)`,
      }}
    />
  );
};

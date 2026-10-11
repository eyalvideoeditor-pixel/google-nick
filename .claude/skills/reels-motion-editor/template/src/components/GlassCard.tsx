import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, glow} from '../theme';

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  enterFrame?: number;
  radius?: number;
  children?: React.ReactNode;
};

/** Rounded translucent green glass panel with neon border and glow. */
export const GlassCard: React.FC<Props> = ({x, y, width, height, enterFrame = 0, radius = 40, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - enterFrame, fps, config: {damping: 16, stiffness: 140}});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: radius,
        opacity: s,
        transform: `scale(${0.85 + 0.15 * s})`,
        background: `linear-gradient(145deg, ${COLORS.greenMid}cc 0%, ${COLORS.bgGreenDeep}e6 70%)`,
        border: `3px solid ${COLORS.neon}aa`,
        boxShadow: `${glow(COLORS.neon + '55', 22)}, inset 0 -30px 60px rgba(0,0,0,0.45), inset 0 2px 0 ${COLORS.neonSoft}88`,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

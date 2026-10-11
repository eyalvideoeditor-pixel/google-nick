import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../theme';

const glassBall = (light = '35% 25%'): React.CSSProperties => ({
  position: 'absolute',
  background: `radial-gradient(circle at ${light}, ${COLORS.neonSoft} 0%, ${COLORS.greenMid} 35%, ${COLORS.bgGreenDeep} 100%)`,
  boxShadow: `inset 0 6px 0 rgba(255,255,255,0.55), inset 0 -40px 60px rgba(0,0,0,0.5), 0 0 40px ${COLORS.neon}55`,
  border: `2px solid ${COLORS.neonSoft}aa`,
});

/** Glossy green "person": sphere head + dome body. `size` = body width in px. */
export const GlassFigure: React.FC<{x: number; y: number; size: number; enterFrame?: number}> = ({
  x,
  y,
  size,
  enterFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - enterFrame, fps, config: {damping: 13, stiffness: 120}});
  const head = size * 0.52;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, transform: `translateY(${(1 - s) * size * 0.6}px)`, opacity: s}}>
      <div style={{...glassBall(), width: head, height: head, borderRadius: '50%', left: (size - head) / 2, top: 0}} />
      <div
        style={{
          ...glassBall('50% 10%'),
          width: size,
          height: size * 1.1,
          borderRadius: `${size / 2}px ${size / 2}px 0 0`,
          left: 0,
          top: head * 1.06,
        }}
      />
    </div>
  );
};

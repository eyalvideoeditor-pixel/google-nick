import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY, glow} from '../theme';

/** Glass pill with neon border and text; pops in with overshoot. */
export const PillLabel: React.FC<{text: string; x: number; y: number; enterFrame?: number; fontSize?: number}> = ({
  text,
  x,
  y,
  enterFrame = 0,
  fontSize = 72,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - enterFrame, fps, config: {damping: 9, stiffness: 160}});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${s})`,
        padding: `${fontSize * 0.12}px ${fontSize * 0.55}px`,
        borderRadius: 999,
        background: `linear-gradient(180deg, ${COLORS.greenMid} 0%, ${COLORS.bgGreenDeep} 100%)`,
        border: `3px solid ${COLORS.neon}`,
        boxShadow: `${glow(COLORS.neon + '88', 14)}, inset 0 3px 0 ${COLORS.neonSoft}99`,
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize,
        color: COLORS.neon,
        textShadow: glow(COLORS.neon, 6),
        direction: 'rtl',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

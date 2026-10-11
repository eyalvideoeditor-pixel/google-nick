import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY} from '../theme';

/** Big extruded neon glyph (e.g. "?") built from stacked offset copies. */
export const Extruded3DText: React.FC<{text: string; x: number; y: number; fontSize?: number; depth?: number; enterFrame?: number; rotate?: number}> = ({
  text,
  x,
  y,
  fontSize = 520,
  depth = 26,
  enterFrame = 0,
  rotate = -8,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - enterFrame, fps, config: {damping: 10, stiffness: 150}});
  const base: React.CSSProperties = {position: 'absolute', left: 0, top: 0, fontFamily: FONT_FAMILY, fontWeight: 700, fontSize, lineHeight: 1};
  return (
    <div style={{position: 'absolute', left: x - fontSize * 0.25, top: y - fontSize * 0.5, width: fontSize * 0.5, height: fontSize, transformOrigin: '50% 50%', transform: `rotate(${rotate}deg) scale(${0.3 + 0.7 * s})`, opacity: Math.min(1, s * 1.5)}}>
      {Array.from({length: depth}).map((_, i) => (
        <div key={i} style={{...base, color: i === depth - 1 ? COLORS.neon : '#0B4A0B', transform: `translate(${i * 0.9}px, ${i * 0.9}px)`}}>
          {text}
        </div>
      ))}
      <div
        style={{
          ...base,
          transform: `translate(${depth * 0.9}px, ${depth * 0.9}px)`,
          backgroundImage: `linear-gradient(160deg, ${COLORS.neonSoft} 0%, ${COLORS.neon} 40%, ${COLORS.greenMid} 100%)`,
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          filter: `drop-shadow(0 0 20px ${COLORS.neon}88)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

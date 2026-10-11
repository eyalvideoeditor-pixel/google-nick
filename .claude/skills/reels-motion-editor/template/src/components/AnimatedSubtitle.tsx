import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {creamText} from '../theme';

type Props = {
  text: string;
  /** Frame (relative to the Sequence) at which the line starts writing in. */
  startFrame?: number;
  /** Frame at which the line slides out to the left. Omit to keep it on screen. */
  exitFrame?: number;
  /** Frames between consecutive letters. Reference reel: ~1.2. */
  framesPerChar?: number;
  fontSize?: number;
  /** Center Y as a fraction of frame height. Reference reel: 0.68 on footage. */
  y?: number;
  /** Render as the dim "next line" preview instead of the active line. */
  preview?: boolean;
  style?: React.CSSProperties;
};

/**
 * House-style animated subtitle: RTL letter-by-letter reveal where each letter
 * enters small, transparent and offset ahead of the writing direction, then
 * springs into place. The line exits by sliding left.
 */
export const AnimatedSubtitle: React.FC<Props> = ({
  text,
  startFrame = 0,
  exitFrame,
  framesPerChar = 1.2,
  fontSize = 62,
  y = 0.68,
  preview = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const chars = Array.from(text);

  const exitProgress =
    exitFrame === undefined
      ? 0
      : interpolate(frame, [exitFrame, exitFrame + 4], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.cubic),
        });
  if (exitFrame !== undefined && frame >= exitFrame + 4) return null;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: `${y * 100}%`,
          left: 0,
          right: 0,
          transform: `translate(${-exitProgress * width * 0.4}px, -50%)`,
          filter: exitProgress > 0 ? `blur(${exitProgress * 6}px)` : undefined,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{direction: 'rtl', whiteSpace: 'pre', fontSize, lineHeight: 1.1, ...style}}>
          {chars.map((ch, i) => {
            const local = frame - startFrame - i * framesPerChar;
            const s = preview
              ? 1
              : spring({frame: local, fps, config: {damping: 14, stiffness: 180, mass: 0.6}});
            const opacity = preview ? 1 : interpolate(local, [0, 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const scale = interpolate(s, [0, 1], [0.55, 1]);
            // Ahead of the writing direction = to the left for RTL.
            const dx = interpolate(s, [0, 1], [-0.35, 0]);
            const dy = interpolate(s, [0, 1], [0.12, 0]);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity,
                  transform: `translate(${dx}em, ${dy}em) scale(${scale})`,
                  transformOrigin: '50% 80%',
                  ...(preview
                    ? {color: 'rgba(200,200,200,0.35)', filter: 'blur(1.5px)', fontFamily: creamText.fontFamily, fontWeight: 700}
                    : creamText),
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Frames needed to fully write a line, for laying out Sequences. */
export const writeDuration = (text: string, framesPerChar = 1.2) =>
  Math.ceil(Array.from(text).length * framesPerChar + 8);

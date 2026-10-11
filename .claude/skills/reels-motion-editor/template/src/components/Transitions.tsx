import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

/** Full-frame white flash peaking at `at` (used for cut-ins). */
export const WhiteFlash: React.FC<{at: number; frames?: number}> = ({at, frames = 4}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - frames / 2, at, at + frames / 2], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#fff', opacity: o}} />;
};

/** Warm peach -> cream color wash between shots. */
export const ColorWash: React.FC<{at: number; frames?: number}> = ({at, frames = 5}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 1, at, at + frames - 1, at + frames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: 'linear-gradient(200deg, #F6E3A8 0%, #F4B7A0 70%)', opacity: o}} />;
};

/** Slow push-in wrapper: scale 1 -> `to` across the composition. */
export const PushIn: React.FC<{from?: number; to?: number; durationInFrames: number; children: React.ReactNode}> = ({
  from = 1,
  to = 1.08,
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, durationInFrames], [from, to]);
  return <AbsoluteFill style={{transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};

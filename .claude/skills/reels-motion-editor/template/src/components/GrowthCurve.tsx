import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {COLORS} from '../theme';

/** S-curve drawn with stroke-dashoffset. Coordinates are in the parent's px space. */
export const GrowthCurve: React.FC<{
  width: number;
  height: number;
  startFrame: number;
  endFrame: number;
  d?: string;
  strokeWidth?: number;
}> = ({width, height, startFrame, endFrame, d, strokeWidth = 7}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const path = d ?? `M 0 ${height} C ${width * 0.45} ${height}, ${width * 0.4} ${height * 0.15}, ${width} 0`;
  return (
    <svg width={width} height={height} style={{position: 'absolute', overflow: 'visible'}}>
      <defs>
        <filter id="curveGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={path}
        pathLength={1}
        fill="none"
        stroke={COLORS.neon}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
        filter="url(#curveGlow)"
      />
    </svg>
  );
};

import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {AnimatedSubtitle} from '../components/AnimatedSubtitle';
import {FPS} from '../theme';

export type Line = {text: string; start: number; end: number};

/**
 * Transparent overlay of animated subtitles for a [T] segment.
 * `lines` times are in seconds relative to the segment start.
 */
export const SubtitleOverlay: React.FC<{lines: Line[]; showPreview?: boolean}> = ({lines, showPreview = false}) => (
  <AbsoluteFill>
    {lines.map((l, i) => {
      const from = Math.round(l.start * FPS);
      const dur = Math.max(6, Math.round((l.end - l.start) * FPS));
      const next = lines[i + 1];
      return (
        <Sequence key={i} from={from} durationInFrames={dur + 4} layout="none">
          <AnimatedSubtitle text={l.text} exitFrame={dur} />
          {showPreview && next ? <AnimatedSubtitle text={next.text} y={0.73} fontSize={50} preview /> : null}
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export const overlayDuration = (lines: Line[]) => Math.ceil((lines[lines.length - 1]?.end ?? 1) * FPS) + 10;

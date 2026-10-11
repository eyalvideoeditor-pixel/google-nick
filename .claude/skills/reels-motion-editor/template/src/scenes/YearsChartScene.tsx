import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {AnimatedSubtitle} from '../components/AnimatedSubtitle';
import {GlassCard} from '../components/GlassCard';
import {GlassFigure} from '../components/GlassFigure';
import {GrowthCurve} from '../components/GrowthCurve';
import {NeonBackground} from '../components/NeonBackground';
import {Timeline} from '../components/Timeline';
import {PushIn, WhiteFlash} from '../components/Transitions';
import {YearCounter} from '../components/YearCounter';

export const YEARS_CHART_DURATION = 100;

/**
 * Recreation of the reference reel's "years chart" beat: glass card with a
 * ticking year, growing S-curve, timeline baseline, glass figure in the
 * foreground and animated captions on the baseline.
 */
export const YearsChartScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <NeonBackground cx={0.75} cy={0.3} />
      <PushIn durationInFrames={YEARS_CHART_DURATION} to={1.07}>
        <GlassCard x={300} y={230} width={720} height={500} enterFrame={2}>
          <YearCounter
            x={40}
            y={36}
            steps={[
              {frame: 0, value: '2026'},
              {frame: 30, value: '2027'},
              {frame: 55, value: '2030'},
              {frame: 78, value: '2031'},
            ]}
          />
          <div style={{position: 'absolute', left: 60, top: 150}}>
            <GrowthCurve width={600} height={300} startFrame={28} endFrame={90} />
          </div>
        </GlassCard>
        <Timeline x={120} y={700} width={900} startFrame={6} />
        <GlassFigure x={720} y={760} size={520} enterFrame={24} />
        <Sequence from={4} durationInFrames={26} layout="none">
          <AnimatedSubtitle text="הוא כנראה" y={0.355} fontSize={52} exitFrame={22} />
        </Sequence>
        <Sequence from={30} durationInFrames={26} layout="none">
          <AnimatedSubtitle text="בדיוק מה שימנע" y={0.355} fontSize={52} exitFrame={22} />
        </Sequence>
        <Sequence from={56} durationInFrames={22} layout="none">
          <AnimatedSubtitle text="ממך להתחיל גם" y={0.355} fontSize={52} exitFrame={18} />
        </Sequence>
        <Sequence from={78} layout="none">
          <AnimatedSubtitle text="בעוד חמש שנים" y={0.355} fontSize={52} />
        </Sequence>
      </PushIn>
      <WhiteFlash at={0} frames={4} />
    </AbsoluteFill>
  );
};

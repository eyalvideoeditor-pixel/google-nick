import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AnimatedSubtitle} from '../components/AnimatedSubtitle';
import {Extruded3DText} from '../components/Extruded3DText';
import {NeonBackground} from '../components/NeonBackground';
import {PushIn} from '../components/Transitions';

export const QUESTION_DURATION = 50;

/** Huge extruded "?" with blurred copies behind and a caption under it. */
export const QuestionScene: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <NeonBackground cx={0.5} cy={0.25} intensity={0.5} />
    <PushIn durationInFrames={QUESTION_DURATION} to={1.1}>
      <AbsoluteFill style={{filter: 'blur(10px)', opacity: 0.6}}>
        <Extruded3DText text="?" x={1020} y={360} fontSize={300} enterFrame={6} rotate={10} />
        <Extruded3DText text="?" x={60} y={1300} fontSize={260} enterFrame={9} rotate={-14} />
      </AbsoluteFill>
      <Extruded3DText text="?" x={540} y={560} enterFrame={0} />
      <AnimatedSubtitle text="אם גם בעוד חמש שנים" y={0.6} fontSize={72} startFrame={8} />
    </PushIn>
  </AbsoluteFill>
);

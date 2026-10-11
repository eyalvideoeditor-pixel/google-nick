import React from 'react';
import {AbsoluteFill, Composition} from 'remotion';
import {FPS, HEIGHT, WIDTH} from './theme';
import {QUESTION_DURATION, QuestionScene} from './scenes/QuestionScene';
import {overlayDuration, SubtitleOverlay, type Line} from './scenes/SubtitleOverlay';
import {YEARS_CHART_DURATION, YearsChartScene} from './scenes/YearsChartScene';

const demoLines: Line[] = [
  {text: 'מה שמנע ממך', start: 0, end: 1.2},
  {text: 'להתחיל לפני חמש שנים', start: 1.2, end: 3.0},
];

// Shows a transparent overlay over a gray stand-in for footage in the Studio only.
const OverlayPreview: React.FC<{lines: Line[]}> = ({lines}) => (
  <AbsoluteFill style={{background: 'linear-gradient(#3a3a3a, #111)'}}>
    <SubtitleOverlay lines={lines} />
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="YearsChart" component={YearsChartScene} durationInFrames={YEARS_CHART_DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Question" component={QuestionScene} durationInFrames={QUESTION_DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    {/* Render THIS one for Premiere (transparent, ProRes 4444). */}
    <Composition
      id="SubtitleOverlay"
      component={SubtitleOverlay}
      defaultProps={{lines: demoLines, showPreview: false}}
      calculateMetadata={({props}) => ({durationInFrames: overlayDuration(props.lines)})}
      durationInFrames={overlayDuration(demoLines)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition id="SubtitleOverlayPreview" component={OverlayPreview} defaultProps={{lines: demoLines}} durationInFrames={overlayDuration(demoLines)} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);

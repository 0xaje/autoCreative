import React from 'react';
import { Title } from '../components/primitives/Title';
import { Caption } from '../components/primitives/Caption';
import { FeatureCallout } from '../components/primitives/Title';
import { LogoReveal, Zoom, Highlight } from '../components/primitives/MotionPrimitives';
import { Scene } from '@creative-agent/schemas';

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'radial-gradient(ellipse at center, #1e1b4b 0%, #0f172a 70%, #020617 100%)',
  overflow: 'hidden'
};

// 1. HookScene
export const HookScene: React.FC<{ scene: Scene; projectName: string }> = ({ scene, projectName }) => (
  <div style={containerStyle}>
    <Zoom scale={1.08}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <LogoReveal name={projectName} />
        <div style={{ marginTop: 32 }}>
          <Title
            category="The Modern Solution"
            title={scene.title || `Introducing ${projectName}`}
            subtitle={scene.narrationText}
          />
        </div>
      </div>
    </Zoom>
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 2. ProblemScene
export const ProblemScene: React.FC<{ scene: Scene; projectName: string }> = ({ scene }) => (
  <div style={{ ...containerStyle, background: 'radial-gradient(ellipse at center, #270817 0%, #0f172a 70%, #020617 100%)' }}>
    <Zoom scale={1.05}>
      <Title
        category="The Core Challenge"
        title={scene.title || "The Legacy Bottleneck"}
        subtitle={scene.narrationText}
      />
    </Zoom>
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 3. ProductRevealScene
export const ProductRevealScene: React.FC<{ scene: Scene; projectName: string; mediaUrl?: string }> = ({
  scene,
  projectName,
  mediaUrl
}) => (
  <div style={containerStyle}>
    {mediaUrl ? (
      <video src={mediaUrl} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <Title category="Live Reveal" title={projectName} subtitle={scene.narrationText} />
    )}
    <FeatureCallout label="Verified Live Application" description="Autonomous Chrome Exploration" state="VERIFIED" />
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 4. ProductDemoScene
export const ProductDemoScene: React.FC<{ scene: Scene; mediaUrl?: string }> = ({ scene, mediaUrl }) => (
  <div style={containerStyle}>
    {mediaUrl && (
      <video src={mediaUrl} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    )}
    <FeatureCallout label={scene.title || "Core Workflow"} description="Semantic Interaction Trajectory" state="VERIFIED" />
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 5. FeatureScene
export const FeatureScene: React.FC<{ scene: Scene; mediaUrl?: string }> = ({ scene, mediaUrl }) => (
  <div style={containerStyle}>
    {mediaUrl && (
      <video src={mediaUrl} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    )}
    <FeatureCallout label={scene.title} description="Production Feature Demonstration" state="VERIFIED" />
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 6. ArchitectureScene
export const ArchitectureScene: React.FC<{ scene: Scene; projectName: string }> = ({ scene, projectName }) => (
  <div style={{ ...containerStyle, background: 'radial-gradient(ellipse at center, #062b3b 0%, #0f172a 70%, #020617 100%)' }}>
    <Zoom scale={1.04}>
      <Title
        category="Architecture & Telemetry"
        title="Engineered for Performance"
        subtitle={scene.narrationText}
      />
    </Zoom>
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 7. ResultScene
export const ResultScene: React.FC<{ scene: Scene }> = ({ scene }) => (
  <div style={containerStyle}>
    <Title
      category="Measurable Impact"
      title={scene.title || "Real-World Results"}
      subtitle={scene.narrationText}
    />
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 8. CinematicScene
export const CinematicScene: React.FC<{ scene: Scene; mediaUrl?: string }> = ({ scene, mediaUrl }) => (
  <div style={containerStyle}>
    {mediaUrl && (
      <video src={mediaUrl} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    )}
    <Title title={scene.title} subtitle={scene.narrationText} />
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

// 9. EndingScene
export const EndingScene: React.FC<{ scene: Scene; projectName: string }> = ({ scene, projectName }) => (
  <div style={containerStyle}>
    <Zoom scale={1.06}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <LogoReveal name={projectName} />
        <div style={{ marginTop: 28 }}>
          <Title
            category="Get Started Today"
            title={`Build with ${projectName}`}
            subtitle={scene.narrationText}
          />
        </div>
      </div>
    </Zoom>
    {scene.narrationText && <Caption text={scene.narrationText} />}
  </div>
);

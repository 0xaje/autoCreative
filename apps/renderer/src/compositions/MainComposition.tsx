import React from 'react';
import { SceneManifest, Scene } from '@creative-agent/schemas';
import {
  HookScene,
  ProblemScene,
  ProductRevealScene,
  ProductDemoScene,
  FeatureScene,
  ArchitectureScene,
  ResultScene,
  CinematicScene,
  EndingScene
} from '../scenes/Scenes';

export interface MainCompositionProps {
  manifest: SceneManifest;
  projectName?: string;
  mediaBaseUrl?: string;
}

export const MainComposition: React.FC<MainCompositionProps> = ({
  manifest,
  projectName = 'AutoCreative',
  mediaBaseUrl = ''
}) => {
  const renderScene = (scene: Scene) => {
    const mediaUrl = scene.videoPath ? `${mediaBaseUrl}/${scene.videoPath}` : undefined;

    switch (scene.type) {
      case 'hook':
        return <HookScene scene={scene} projectName={projectName} />;
      case 'problem':
        return <ProblemScene scene={scene} projectName={projectName} />;
      case 'product_reveal':
        return <ProductRevealScene scene={scene} projectName={projectName} mediaUrl={mediaUrl} />;
      case 'product_demo':
        return <ProductDemoScene scene={scene} mediaUrl={mediaUrl} />;
      case 'feature':
        return <FeatureScene scene={scene} mediaUrl={mediaUrl} />;
      case 'architecture':
        return <ArchitectureScene scene={scene} projectName={projectName} />;
      case 'result':
        return <ResultScene scene={scene} />;
      case 'cinematic':
        return <CinematicScene scene={scene} mediaUrl={mediaUrl} />;
      case 'ending':
        return <EndingScene scene={scene} projectName={projectName} />;
      default:
        return <ProductDemoScene scene={scene} mediaUrl={mediaUrl} />;
    }
  };

  return (
    <div style={{
      width: manifest.resolution?.width || 1920,
      height: manifest.resolution?.height || 1080,
      background: '#020617',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {manifest.scenes.map((scene) => (
        <div key={scene.id} style={{ width: '100%', height: '100%' }}>
          {renderScene(scene)}
        </div>
      ))}
    </div>
  );
};

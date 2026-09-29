import React from 'react';

export interface ZoomProps {
  scale?: number;
  durationSeconds?: number;
  children: React.ReactNode;
}

export const Zoom: React.FC<ZoomProps> = ({
  scale = 1.05,
  children
}) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `scale(${scale})`,
      transition: 'transform 5s ease-out'
    }}>
      {children}
    </div>
  );
};

export interface HighlightProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export const Highlight: React.FC<HighlightProps> = ({
  x,
  y,
  width,
  height,
  color = '#6366f1'
}) => {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      border: `2px solid ${color}`,
      boxShadow: `0 0 16px ${color}`,
      borderRadius: 8,
      pointerEvents: 'none',
      zIndex: 40
    }} />
  );
};

export interface LogoRevealProps {
  name: string;
}

export const LogoReveal: React.FC<LogoRevealProps> = ({ name }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 900,
        fontSize: 28,
        boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#ffffff' }}>
        {name}
      </div>
    </div>
  );
};

export interface ProgressIndicatorProps {
  currentScene: number;
  totalScenes: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentScene,
  totalScenes
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: 30,
      right: 40,
      display: 'flex',
      gap: 6,
      zIndex: 60
    }}>
      {Array.from({ length: totalScenes }).map((_, idx) => (
        <div key={idx} style={{
          width: 24,
          height: 4,
          borderRadius: 2,
          background: idx <= currentScene ? '#6366f1' : 'rgba(255, 255, 255, 0.2)',
          boxShadow: idx <= currentScene ? '0 0 8px #6366f1' : 'none'
        }} />
      ))}
    </div>
  );
};

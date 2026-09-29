import React from 'react';

export interface CaptionProps {
  text: string;
  activeWord?: string;
  fontSize?: number;
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  activeWord,
  fontSize = 28
}) => {
  if (!text) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 60,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 100
    }}>
      <div style={{
        background: 'rgba(6, 9, 19, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
        borderRadius: 9999,
        padding: '12px 32px',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        maxWidth: '80%',
        textAlign: 'center'
      }}>
        {text}
      </div>
    </div>
  );
};

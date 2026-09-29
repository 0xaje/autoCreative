import React from 'react';

export interface TitleProps {
  title: string;
  subtitle?: string;
  category?: string;
  align?: 'left' | 'center';
}

export const Title: React.FC<TitleProps> = ({
  title,
  subtitle,
  category,
  align = 'center'
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'center' ? 'center' : 'flex-start',
      textAlign: align,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {category && (
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#818cf8',
          marginBottom: 12
        }}>
          {category}
        </span>
      )}
      <h1 style={{
        fontSize: 54,
        fontWeight: 800,
        color: '#ffffff',
        lineHeight: 1.15,
        margin: 0,
        textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          fontSize: 24,
          fontWeight: 400,
          color: '#94a3b8',
          marginTop: 16,
          maxWidth: 800,
          lineHeight: 1.5
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export interface FeatureCalloutProps {
  label: string;
  description?: string;
  state?: string;
  x?: number;
  y?: number;
}

export const FeatureCallout: React.FC<FeatureCalloutProps> = ({
  label,
  description,
  state = 'VERIFIED',
  x = 60,
  y = 80
}) => {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
      borderRadius: 12,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: 50
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: state === 'VERIFIED' ? '#10b981' : '#6366f1',
        boxShadow: `0 0 10px ${state === 'VERIFIED' ? '#10b981' : '#6366f1'}`
      }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{description}</div>
        )}
      </div>
    </div>
  );
};

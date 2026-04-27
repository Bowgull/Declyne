import React from 'react';

interface Props {
  fontSize?: number;
  color?: string;
  letterSpacing?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function DeclyneWordmark({
  fontSize = 38,
  color = '#5e5a60',
  letterSpacing = '-0.02em',
  style,
  className,
}: Props) {
  return (
    <span
      className={`display ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        fontSize,
        lineHeight: 0.95,
        letterSpacing,
        color,
        ...style,
      }}
    >
      <span style={{ color: '#9e78b9' }}>D</span>
      <span style={{ letterSpacing }}>eclyne</span>
    </span>
  );
}

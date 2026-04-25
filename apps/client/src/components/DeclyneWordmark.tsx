import React from 'react';

interface Props {
  fontSize?: number;
  color?: string;
  letterSpacing?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function DeclyneWordmark({ fontSize = 38, color = 'var(--color-accent-purple)', letterSpacing = '-0.02em', style, className }: Props) {
  const lineHeight = 0.95;
  const aspect = 771 / 617;
  const dHeight = 0.92;
  return (
    <span
      className={`display ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        fontSize,
        lineHeight,
        letterSpacing,
        color,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          height: `${dHeight}em`,
          width: `${dHeight * aspect}em`,
          marginBottom: '0.04em',
          flexShrink: 0,
          backgroundColor: 'currentColor',
          WebkitMaskImage: 'url(/brand/letter-d.png)',
          maskImage: 'url(/brand/letter-d.png)',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      <span style={{ letterSpacing }}>eclyne</span>
    </span>
  );
}

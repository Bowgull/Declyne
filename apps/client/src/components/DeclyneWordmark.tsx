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
  const aspect = 771 / 617;
  const dHeight = 0.92;
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
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          height: `${dHeight}em`,
          width: `${dHeight * aspect}em`,
          marginBottom: '0.04em',
          flexShrink: 0,
          backgroundColor: '#9e78b9',
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

import type { CSSProperties } from 'react';

interface BarProps {
  width?: number | string;
  height?: number;
  variant?: 'default' | 'tall' | 'hero';
  style?: CSSProperties;
}

export function SkeletonBar({ width = '60%', height, variant = 'default', style }: BarProps) {
  const cls = `skeleton-bar${variant !== 'default' ? ` ${variant}` : ''}`;
  const composed: CSSProperties = { width, ...(height ? { height } : {}), ...style };
  return <span className={cls} style={composed} aria-hidden />;
}

interface RowProps {
  rows?: number;
}

export function SkeletonRows({ rows = 3 }: RowProps) {
  const out = [];
  for (let i = 0; i < rows; i++) {
    out.push(
      <div className="skeleton-row" key={i}>
        <SkeletonBar width={`${55 + ((i * 13) % 30)}%`} />
        <SkeletonBar width={70} />
      </div>
    );
  }
  return <div role="status" aria-label="Loading">{out}</div>;
}

export function SkeletonHero() {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
      <SkeletonBar width={120} height={10} />
      <SkeletonBar variant="hero" width="62%" />
      <SkeletonBar width="38%" height={11} />
    </div>
  );
}

import type { ReactNode } from 'react';

type Props = {
  kicker: string;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
};

export default function LedgerHeader({ kicker, title, subtitle, action }: Props) {
  return (
    <header className="ledger-header">
      <div className="ledger-header-title">
        <div className="ledger-kicker">{kicker}</div>
        <div className="ledger-title">{title}</div>
        {subtitle && <div className="ledger-subtitle">{subtitle}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </header>
  );
}

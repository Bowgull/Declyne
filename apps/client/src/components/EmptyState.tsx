import type { ReactNode } from 'react';

interface Props {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ title, body, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      {body && <div className="empty-state-text">{body}</div>}
      {action && <div>{action}</div>}
    </div>
  );
}

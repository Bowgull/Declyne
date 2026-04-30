import { useEffect, useState } from 'react';
import { clearToast, getToast, subscribeToast, type ToastState } from '../lib/toast';

export default function Toast() {
  const [toast, setToast] = useState<ToastState | null>(getToast);
  useEffect(() => subscribeToast(() => setToast(getToast())), []);
  if (!toast) return null;
  return (
    <div
      className={`app-toast app-toast-${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      onClick={clearToast}
    >
      <span className="app-toast-glyph" aria-hidden>
        {toast.kind === 'error' ? '!' : toast.kind === 'success' ? '✓' : 'i'}
      </span>
      <span className="app-toast-text">{toast.message}</span>
      <span className="app-toast-dismiss" aria-hidden>
        ×
      </span>
    </div>
  );
}

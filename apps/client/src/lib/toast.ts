export type ToastKind = 'error' | 'success' | 'info';

export interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

let current: ToastState | null = null;
let nextId = 1;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  error: 5000,
  success: 2400,
  info: 3200,
};

function notify(): void {
  listeners.forEach((fn) => fn());
}

function clearTimer(): void {
  if (dismissTimer != null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

export function showToast(kind: ToastKind, message: string, durationMs?: number): void {
  clearTimer();
  current = { id: nextId++, kind, message };
  notify();
  const ms = durationMs ?? DEFAULT_DURATION_MS[kind];
  dismissTimer = setTimeout(() => {
    current = null;
    dismissTimer = null;
    notify();
  }, ms);
}

export function showErrorToast(message: string): void {
  showToast('error', message);
}

export function showSuccessToast(message: string): void {
  showToast('success', message);
}

export function showInfoToast(message: string): void {
  showToast('info', message);
}

export function clearToast(): void {
  clearTimer();
  current = null;
  notify();
}

export function getToast(): ToastState | null {
  return current;
}

export function subscribeToast(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const ERROR_CODE_LABELS: Record<string, string> = {
  unauthorized: 'Sign in again to continue.',
  rate_limited: 'Slow down a moment, then try again.',
  no_current_period: 'No active pay period yet. Import a paycheque first.',
  no_period: 'No pay period found for that range.',
  no_debt_allocations: 'No debt allocations to commit.',
  unbalanced_books: "Books don't balance. Reconciliation refused.",
  period_locked: "That period is closed. Edits aren't allowed.",
  period_not_found: 'Period not found.',
  uncleared_lines_remain: 'Uncleared lines remain. Confirm to seal anyway.',
  internal: 'Something went wrong on our side. Try again.',
};

function extractServerMessage(raw: string): string | null {
  // Format from api.req: `POST /path failed 400: {body}` or similar.
  const colonIdx = raw.indexOf(': ');
  const body = colonIdx >= 0 ? raw.slice(colonIdx + 2) : raw;
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
      const code = parsed.error ?? parsed.message;
      if (typeof code === 'string' && code) {
        return ERROR_CODE_LABELS[code] ?? code.replace(/_/g, ' ');
      }
    } catch {
      // fall through
    }
  }
  return trimmed;
}

// Convert any thrown value into a user-readable line. Strips schema/SQL hints.
export function toastErrorFrom(err: unknown, fallback = "Couldn't save. Try again."): void {
  if (err instanceof Error && err.message) {
    const msg = extractServerMessage(err.message) ?? fallback;
    const trimmed = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
    showErrorToast(trimmed);
    return;
  }
  showErrorToast(fallback);
}

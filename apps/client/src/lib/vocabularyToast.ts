type ToastState = { message: string } | null;

let current: ToastState = null;
const listeners = new Set<() => void>();

export function showVocabularyToast(message: string): void {
  current = { message };
  listeners.forEach((fn) => fn());
}

export function clearVocabularyToast(): void {
  current = null;
  listeners.forEach((fn) => fn());
}

export function getVocabularyToast(): ToastState {
  return current;
}

export function subscribeVocabularyToast(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

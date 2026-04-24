const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const TOKEN = import.meta.env.VITE_API_TOKEN ?? '';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => req<T>('GET', path),
  post: <T>(path: string, body?: unknown) => req<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('PATCH', path, body),
  del: <T>(path: string) => req<T>('DELETE', path),
  baseUrl: BASE_URL,
  token: TOKEN,
};

// Dedup hash = SHA256(date|description|amount|accountId)
// Runs in both the browser (Web Worker) and the Cloudflare Worker.
// Both have globalThis.crypto.subtle.

export async function dedupHash(
  date: string,
  description: string,
  amountCents: number,
  accountId: string,
): Promise<string> {
  const input = `${date}|${description}|${amountCents}|${accountId}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const MAX_BODY = 4000;

export function normalizeMessageBody(value: string): string | null {
  const body = value.normalize("NFKC").trim();
  if (body.length === 0 || [...body].length > MAX_BODY) {
    return null;
  }
  return body;
}

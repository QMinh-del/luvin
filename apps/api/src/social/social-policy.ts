function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 31 || code === 127)) {
      return true;
    }
  }
  return false;
}
const MOODS = new Set(["HAPPY", "LOVING", "MISSING", "CALM", "BUSY", "SLEEPY"]);

export function normalizeDisplayName(value: string): string | null {
  const name = value.normalize("NFKC").trim();
  if (name.length < 1 || [...name].length > 50 || hasControlCharacter(name)) {
    return null;
  }
  return name;
}

export function approvedMood(value: string): string | null {
  const code = value.trim().toUpperCase();
  return MOODS.has(code) ? code : null;
}

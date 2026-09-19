const SENSITIVE_KEY =
  /^(.*)?(password|passwd|secret|token|authorization|cookie|apikey|accesskey|secretkey|databaseurl|signedurl|dateofbirth|dob|latitude|longitude|lat|lng|coordinate|coordinates|message|reporttext|evidence|resetlink|email)s?$/i;

const CREDENTIAL_IN_URL = /:\/\/([^/@]+)@/g;

export function redactValue(input: unknown): unknown {
  return redactUnknown(input);
}

function redactUnknown(input: unknown): unknown {
  if (typeof input === "string") {
    return redactString(input);
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactUnknown(item));
  }
  if (input && typeof input === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = SENSITIVE_KEY.test(key.replaceAll("_", ""))
        ? "[REDACTED]"
        : redactUnknown(value);
    }
    return output;
  }
  return input;
}

function redactString(value: string): string {
  return value.replace(CREDENTIAL_IN_URL, "://[REDACTED]@");
}

export function containsSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key.replaceAll("_", ""));
}

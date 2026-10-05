/** Normalize an email into a session-id-safe prefix. */
export function normalizeEmailSession(email: string): string {
  return email.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 64);
}

/** True when the session id belongs to the user (exact match or `<prefix>--<uuid>`). */
export function isOwnSession(sessionId: string, normalizedEmail: string): boolean {
  return sessionId === normalizedEmail || sessionId.startsWith(normalizedEmail + "--");
}


const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Extract unique email addresses from a CSV or plain-text leads file.
 * Works with any column layout — every well-formed address in the file counts.
 */
export function parseLeads(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

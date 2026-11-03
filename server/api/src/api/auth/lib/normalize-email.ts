/** Emails are stored and looked up trimmed and lowercased, so `A@x.com` and `a@x.com` are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

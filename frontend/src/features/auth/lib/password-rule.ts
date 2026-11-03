import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "../constants";

const encoder = new TextEncoder();

/** The length rule the server enforces on sign up. Bytes, because emoji and most non-Latin letters take 2–4. */
export function meetsPasswordRule(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && encoder.encode(password).length <= MAX_PASSWORD_BYTES;
}

export function isPasswordTooLong(password: string): boolean {
  return encoder.encode(password).length > MAX_PASSWORD_BYTES;
}

import { ApiError } from "../api";

function isClientError(err: unknown): err is ApiError {
  return err instanceof ApiError && !!err.status && err.status >= 400 && err.status < 500;
}

/** A 4xx from /auth/login means the email and password did not match. */
export function loginErrorMessage(err: unknown): string {
  if (isClientError(err)) return "Email or password is incorrect.";
  return err instanceof Error ? err.message : "Could not log in. Try again.";
}

export function signupErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Could not create your account. Try again.";
}

/** The api answers 409 or a message like "email already exists". */
export function isEmailTakenError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 409 || /already|exist|taken|duplicate/i.test(err.message);
}

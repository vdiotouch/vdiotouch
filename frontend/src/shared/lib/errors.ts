import { ClientError } from "graphql-request";

/**
 * A short, readable message for a failed request. GraphQL errors carry the
 * api's own message; anything else falls back to `fallback`.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err instanceof ClientError) {
    return err.response.errors?.[0]?.message ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

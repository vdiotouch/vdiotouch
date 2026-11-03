import { safeDecode } from "@/shared/lib/format";

/** Titles can arrive URL-encoded (from file names); show them decoded. */
export function assetTitle(title: string | null | undefined) {
  return safeDecode(title ?? "").trim() || "Untitled video";
}

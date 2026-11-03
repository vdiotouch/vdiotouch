import type { StatusTone } from "@/components/data-display/status-tag";
import { ASSET_STATUS } from "../constants";

export interface StatusDisplay {
  tone: StatusTone;
  label: string;
}

const STATUS_DISPLAY: Record<string, StatusDisplay> = {
  [ASSET_STATUS.QUEUED]: { tone: "warning", label: "Queued" },
  [ASSET_STATUS.DOWNLOADING]: { tone: "processing", label: "Downloading" },
  [ASSET_STATUS.DOWNLOADED]: { tone: "processing", label: "Downloaded" },
  [ASSET_STATUS.VALIDATED]: { tone: "processing", label: "Validated" },
  [ASSET_STATUS.PROCESSING]: { tone: "processing", label: "Encoding" },
  [ASSET_STATUS.READY]: { tone: "success", label: "Ready" },
  [ASSET_STATUS.FAILED]: { tone: "error", label: "Failed" },
};

/** "SOME_STATUS" -> "Some status", for statuses this app does not know yet. */
function humanize(status: string) {
  const words = status.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Tone and label for a status string from the api. */
export function statusDisplay(status: string | null | undefined): StatusDisplay {
  const key = (status ?? "").toUpperCase();
  return STATUS_DISPLAY[key] ?? { tone: "processing", label: humanize(key || "Unknown") };
}

/** True once the pipeline has stopped, so re-processing makes sense. */
export function isFinished(status: string) {
  return status === ASSET_STATUS.READY || status === ASSET_STATUS.FAILED;
}

const STATUS_HINTS: Record<string, string> = {
  [ASSET_STATUS.QUEUED]: "Waiting to start",
  [ASSET_STATUS.FAILED]: "Open details to see why, or re-process it.",
};

/** One line under the status tag when the status alone doesn't explain it. */
export function statusHint(status: string): string | null {
  return STATUS_HINTS[status] ?? null;
}

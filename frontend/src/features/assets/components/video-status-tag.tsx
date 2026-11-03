import { StatusTag } from "@/components/data-display/status-tag";
import { statusDisplay } from "../lib/asset-status";

/** Status tag for a video or one of its files, from the api's status string. */
export function VideoStatusTag({ status }: { status: string }) {
  const { tone, label } = statusDisplay(status);
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

import { Card, Descriptions } from "antd";
import { formatBytes, formatDateTime, formatDuration } from "@/shared/lib/format";
import { resolutionFiles } from "../../lib/asset-files";
import type { AssetDetails } from "../../types";

function resolutionsSummary(asset: AssetDetails) {
  if (!asset.with_transcoding) return "Off";
  const count = resolutionFiles(asset.files).length;
  return count > 0 ? `On (${count} ${count === 1 ? "resolution" : "resolutions"})` : "On";
}

function sourceSummary(asset: AssetDetails) {
  const parts: string[] = [];
  if (asset.width > 0 && asset.height > 0) parts.push(`${asset.width} × ${asset.height}`);
  if (asset.size > 0) parts.push(formatBytes(asset.size));
  return parts.join(", ") || "–";
}

export function MetadataCard({ asset }: { asset: AssetDetails }) {
  const rows: [string, string][] = [
    ["Duration", asset.duration > 0 ? formatDuration(asset.duration) : "–"],
    ["Source", sourceSummary(asset)],
    ["Multiple resolutions", resolutionsSummary(asset)],
    ["Transcript", asset.with_transcription ? "On" : "Off"],
    ["Created", formatDateTime(asset.created_at)],
    ["Updated", formatDateTime(asset.updated_at)],
  ];

  return (
    <Card title="Metadata">
      <Descriptions
        column={1}
        size="small"
        colon={false}
        styles={{ label: { width: 150 } }}
        items={rows.map(([label, value]) => ({ key: label, label, children: value }))}
      />
    </Card>
  );
}

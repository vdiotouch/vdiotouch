import { Card, Descriptions } from "antd";
import { formatBytes, formatDateTime, formatDuration } from "@/shared/lib/format";
import { resolutionFiles, totalStorage } from "../../lib/asset-files";
import type { AssetDetails } from "../../types";

function resolutionsSummary(asset: AssetDetails) {
  if (!asset.with_transcoding) return "Off";
  const count = resolutionFiles(asset.files).length;
  return count > 0 ? `On (${count} ${count === 1 ? "resolution" : "resolutions"})` : "On";
}

function sourceResolution(asset: AssetDetails) {
  return asset.width > 0 && asset.height > 0 ? `${asset.width} × ${asset.height}` : "–";
}

function sourceSize(asset: AssetDetails) {
  return asset.size > 0 ? formatBytes(asset.size) : "–";
}

/** "1.20 GB (9 files)": source, downloads and every resolution together. */
function totalSizeSummary(asset: AssetDetails) {
  const { bytes, fileCount } = totalStorage(asset);
  if (bytes === 0) return "–";
  return `${formatBytes(bytes)} (${fileCount} ${fileCount === 1 ? "file" : "files"})`;
}

export function MetadataCard({ asset }: { asset: AssetDetails }) {
  const rows: [string, string][] = [
    ["Duration", asset.duration > 0 ? formatDuration(asset.duration) : "–"],
    ["Source resolution", sourceResolution(asset)],
    ["Source size", sourceSize(asset)],
    ["Total size", totalSizeSummary(asset)],
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

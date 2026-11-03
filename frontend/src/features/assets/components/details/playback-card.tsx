import { Card, Typography } from "antd";
import { notify } from "@/shared/lib/notify";
import type { AssetDetails } from "../../types";
import styles from "./video-details.module.css";

function CopyableValue({ value, label }: { value: string; label: string }) {
  return (
    <Typography.Paragraph
      code
      ellipsis={{ tooltip: value }}
      copyable={{
        text: value,
        tooltips: [`Copy ${label.toLowerCase()}`, "Copied"],
        onCopy: () => notify.success(`${label} copied`),
      }}
      className={styles.copyableValue}
    >
      {value}
    </Typography.Paragraph>
  );
}

/** Master playlist URL and video ID, the two values integrations need. */
export function PlaybackCard({ asset }: { asset: AssetDetails }) {
  return (
    <Card title="Playback">
      <Typography.Text type="secondary" className={styles.fieldLabel}>
        Master playlist (HLS)
      </Typography.Text>
      {asset.master_playlist_url ? (
        <CopyableValue value={asset.master_playlist_url} label="Playlist URL" />
      ) : (
        <Typography.Paragraph type="secondary" className={styles.copyableValue}>
          Available once the first resolution is ready.
        </Typography.Paragraph>
      )}
      <Typography.Text type="secondary" className={styles.fieldLabel}>
        Video ID
      </Typography.Text>
      <CopyableValue value={asset._id} label="Video ID" />
    </Card>
  );
}

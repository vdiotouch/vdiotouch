import { Typography } from "antd";
import { statusHint } from "../../lib/asset-status";
import { VideoStatusTag } from "../video-status-tag";
import styles from "./video-list.module.css";

/** The "Status" column: tag plus a hint for queued and failed videos. */
export function VideoStatusCell({ status }: { status: string }) {
  const hint = statusHint(status);
  return (
    <div>
      <VideoStatusTag status={status} />
      {hint && (
        <Typography.Text type="secondary" className={styles.statusHint}>
          {hint}
        </Typography.Text>
      )}
    </div>
  );
}

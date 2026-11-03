import { Typography } from "antd";
import { StatusTag } from "@/components/data-display/status-tag";
import type { SampleVideo } from "./showcase-content";
import styles from "./showcase.module.css";

export function SampleVideoList({ videos }: { videos: SampleVideo[] }) {
  return (
    <ul className={styles.sampleList}>
      {videos.map((video) => (
        <li key={video.title} className={styles.sampleRow}>
          <div className={styles.sampleText}>
            <Typography.Text strong ellipsis className={styles.sampleTitle}>
              {video.title}
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.small}>
              {video.note}
            </Typography.Text>
          </div>
          <StatusTag tone={video.tone}>{video.status}</StatusTag>
        </li>
      ))}
    </ul>
  );
}

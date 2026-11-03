import { Skeleton } from "antd";
import styles from "./video-list.module.css";

/** Placeholder rows while the first page loads. */
export function VideosLoading({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading videos" className={styles.loading}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.loadingRow}>
          <Skeleton.Node active className={styles.loadingThumb} />
          <Skeleton active title={{ width: "50%" }} paragraph={{ rows: 1, width: "30%" }} />
        </div>
      ))}
    </div>
  );
}

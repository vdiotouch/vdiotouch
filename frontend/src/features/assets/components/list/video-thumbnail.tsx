import * as React from "react";
import { VideoCameraOutlined } from "@ant-design/icons";
import { formatDuration } from "@/shared/lib/format";
import styles from "./video-list.module.css";

interface VideoThumbnailProps {
  src: string;
  duration: number;
  /** Width in px; the height follows 16:9. */
  width?: number;
}

/** 16:9 thumbnail with the duration in the corner. Decorative: the title is the link. */
export function VideoThumbnail({ src, duration, width = 96 }: VideoThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const showImage = src && !failed;

  return (
    <div className={styles.thumbnail} style={{ width }} aria-hidden="true">
      {showImage ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <VideoCameraOutlined className={styles.thumbnailIcon} />
      )}
      {duration > 0 && <span className={styles.duration}>{formatDuration(duration)}</span>}
    </div>
  );
}

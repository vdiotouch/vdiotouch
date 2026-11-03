import { Tag, Typography } from "antd";
import { assetTitle } from "../../lib/asset-title";
import type { AssetSummary } from "../../types";
import { VideoThumbnail } from "./video-thumbnail";
import { VideoTitleLink } from "./video-title-link";
import styles from "./video-list.module.css";

/** Thumbnail, title link, short ID and tags: the "Video" column. */
export function VideoSummary({ asset }: { asset: AssetSummary }) {
  return (
    <div className={styles.summary}>
      <VideoThumbnail src={asset.thumbnail_url} duration={asset.duration} />
      <div className={styles.summaryText}>
        <VideoTitleLink id={asset._id} title={assetTitle(asset.title)} />
        <Typography.Text type="secondary" className={styles.videoId}>
          {asset._id}
        </Typography.Text>
        {asset.tags.length > 0 && (
          <div className={styles.tags}>
            {asset.tags.map((tag) => (
              <Tag key={tag} className={styles.tag}>
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

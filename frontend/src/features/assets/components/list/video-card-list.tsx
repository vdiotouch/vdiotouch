import { Checkbox, Typography } from "antd";
import { formatBytes, formatDate } from "@/shared/lib/format";
import { statusHint } from "../../lib/asset-status";
import { assetTitle } from "../../lib/asset-title";
import type { AssetSummary } from "../../types";
import { VideoStatusTag } from "../video-status-tag";
import { VideoRowMenu } from "./video-row-menu";
import { VideoThumbnail } from "./video-thumbnail";
import { VideoTitleLink } from "./video-title-link";
import styles from "./video-list.module.css";

interface VideoCardListProps {
  assets: AssetSummary[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

/** Videos list below 768px: one card per video instead of table rows. */
export function VideoCardList({ assets, selectedIds, onSelectionChange }: VideoCardListProps) {
  const toggle = (id: string, checked: boolean) =>
    onSelectionChange(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id));

  return (
    <div role="list" aria-label="Videos">
      {assets.map((asset) => {
        const title = assetTitle(asset.title);
        const selected = selectedIds.includes(asset._id);
        const hint = statusHint(asset.latest_status);
        return (
          <div
            key={asset._id}
            role="listitem"
            className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}
          >
            <Checkbox
              aria-label={`Select ${title}`}
              checked={selected}
              className={styles.cardCheckbox}
              onChange={(e) => toggle(asset._id, e.target.checked)}
            />
            <VideoThumbnail src={asset.thumbnail_url} duration={asset.duration} width={88} />
            <div className={styles.summaryText}>
              <VideoTitleLink id={asset._id} title={title} lines={2} />
              <div className={styles.cardMeta}>
                <VideoStatusTag status={asset.latest_status} />
                <Typography.Text type="secondary" className={styles.cardMetaText}>
                  {asset.size > 0 && `${formatBytes(asset.size)} · `}
                  {formatDate(asset.created_at)}
                </Typography.Text>
              </div>
              {hint && (
                <Typography.Text type="secondary" className={styles.statusHint}>
                  {hint}
                </Typography.Text>
              )}
            </div>
            <VideoRowMenu id={asset._id} title={title} />
          </div>
        );
      })}
    </div>
  );
}

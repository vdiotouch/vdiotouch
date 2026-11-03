import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";
import styles from "./video-list.module.css";

interface BulkActionsBarProps {
  count: number;
  onReprocess: () => void;
  onCopyIds: () => void;
  onClear: () => void;
}

/** Sticky bar above the list while rows are selected. */
export function BulkActionsBar({ count, onReprocess, onCopyIds, onClear }: BulkActionsBarProps) {
  return (
    <div role="region" aria-label="Bulk actions" className={styles.bulkBar}>
      <Typography.Text strong className={styles.bulkCount} aria-live="polite">
        {count} selected
      </Typography.Text>
      <Button size="small" type="text" icon={<ReloadOutlined />} onClick={onReprocess}>
        Re-process
      </Button>
      <Button size="small" type="text" icon={<CopyOutlined />} onClick={onCopyIds}>
        Copy IDs
      </Button>
      <Button size="small" type="link" className={styles.bulkClear} onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}

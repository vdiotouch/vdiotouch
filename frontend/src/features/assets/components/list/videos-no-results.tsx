import { Button, Empty, Typography } from "antd";
import styles from "./video-list.module.css";

interface VideosNoResultsProps {
  search: string;
  onClear: () => void;
}

/** A search that matched nothing. */
export function VideosNoResults({ search, onClear }: VideosNoResultsProps) {
  return (
    <Empty
      className={styles.noResults}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <>
          <Typography.Text strong className={styles.block}>
            No videos match “{search}”.
          </Typography.Text>
          <Typography.Text type="secondary">Check the spelling and try again.</Typography.Text>
        </>
      }
    >
      <Button onClick={onClear}>Clear search</Button>
    </Empty>
  );
}

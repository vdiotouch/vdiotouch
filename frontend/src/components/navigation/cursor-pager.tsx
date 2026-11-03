import { Button, Space, Typography } from "antd";
import styles from "./cursor-pager.module.css";

interface CursorPagerProps {
  /** Zero-based index of the page on screen. */
  pageIndex: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * "Page X of N" with Previous / Next, for the api's cursor pagination
 * (no jumping to a page number, no total count).
 */
export function CursorPager({
  pageIndex,
  totalPages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: CursorPagerProps) {
  return (
    <nav aria-label="Pagination" className={styles.pager}>
      <Typography.Text type="secondary" aria-live="polite">
        Page {pageIndex + 1} of {Math.max(totalPages, 1)}
      </Typography.Text>
      <Space className={styles.buttons}>
        <Button disabled={!hasPrevious} onClick={onPrevious}>
          Previous
        </Button>
        <Button disabled={!hasNext} onClick={onNext}>
          Next
        </Button>
      </Space>
    </nav>
  );
}

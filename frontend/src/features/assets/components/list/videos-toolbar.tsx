import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import styles from "./video-list.module.css";

interface VideosToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

/** Search by title, above the list. */
export function VideosToolbar({ search, onSearchChange }: VideosToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <Input
        allowClear
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        prefix={<SearchOutlined aria-hidden="true" />}
        placeholder="Search by title"
        aria-label="Search videos by title"
        className={styles.search}
      />
    </div>
  );
}

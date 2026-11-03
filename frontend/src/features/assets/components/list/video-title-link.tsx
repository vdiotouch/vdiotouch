import { Link } from "@tanstack/react-router";
import styles from "./video-list.module.css";

interface VideoTitleLinkProps {
  id: string;
  title: string;
  /** How many lines show before the title is cut off. */
  lines?: 1 | 2;
}

export function VideoTitleLink({ id, title, lines = 1 }: VideoTitleLinkProps) {
  return (
    <Link
      to="/videos/$id"
      params={{ id }}
      title={title}
      className={lines === 2 ? `${styles.titleLink} ${styles.titleLinkTwoLines}` : styles.titleLink}
    >
      {title}
    </Link>
  );
}

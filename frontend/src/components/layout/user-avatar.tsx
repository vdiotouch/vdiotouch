import { Avatar } from "antd";
import { getInitials } from "@/shared/lib/initials";
import styles from "./app-shell.module.css";

/** Round avatar with the user's initials. Decorative: the trigger carries the label. */
export function UserAvatar({ name }: { name: string }) {
  return (
    <Avatar aria-hidden="true" className={styles.avatar}>
      {getInitials(name)}
    </Avatar>
  );
}

import * as React from "react";
import styles from "./video-details.module.css";

interface PlayerMessageProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** "alert" for failures, so screen readers announce them. */
  role?: "alert" | "status";
}

/** Dark 16:9 panel shown where the player would be. */
export function PlayerMessage({ icon, title, description, children, role = "status" }: PlayerMessageProps) {
  return (
    <div role={role} className={styles.playerMessage}>
      <div>
        <div className={styles.playerMessageIcon} aria-hidden="true">
          {icon}
        </div>
        <div className={styles.playerMessageTitle}>{title}</div>
        {description && <div className={styles.playerMessageText}>{description}</div>}
        {children && <div className={styles.playerMessageActions}>{children}</div>}
      </div>
    </div>
  );
}

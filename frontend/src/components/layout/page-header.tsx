import * as React from "react";
import { Typography } from "antd";
import { useResponsive } from "@/shared/hooks/use-responsive";
import styles from "./page-header.module.css";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons on the right; they stack full-width on phones. */
  actions?: React.ReactNode;
}

/** Page title, one-line description and the page's main actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { isMobile } = useResponsive();

  return (
    <header className={isMobile ? `${styles.header} ${styles.headerMobile}` : styles.header}>
      <div>
        <Typography.Title level={3} className={styles.title}>
          {title}
        </Typography.Title>
        {description && <Typography.Text type="secondary">{description}</Typography.Text>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

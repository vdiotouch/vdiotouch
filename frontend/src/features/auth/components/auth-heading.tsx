import { Typography } from "antd";
import styles from "./auth-heading.module.css";

interface AuthHeadingProps {
  title: string;
  subtitle: string;
}

export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <header className={styles.heading}>
      <Typography.Title level={2} className={styles.title}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary" className={styles.subtitle}>
        {subtitle}
      </Typography.Text>
    </header>
  );
}

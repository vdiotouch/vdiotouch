import * as React from "react";
import { useResponsive } from "@/shared/hooks/use-responsive";
import styles from "./two-column-layout.module.css";

interface TwoColumnLayoutProps {
  main: React.ReactNode;
  /** 360px column on the right; it moves under `main` below 992px. */
  side: React.ReactNode;
}

/** Page body with a main column and a 360px side column. */
export function TwoColumnLayout({ main, side }: TwoColumnLayoutProps) {
  const { isNarrow } = useResponsive();
  return (
    <div className={isNarrow ? `${styles.layout} ${styles.stacked}` : styles.layout}>
      <div className={styles.column}>{main}</div>
      <div className={styles.column}>{side}</div>
    </div>
  );
}

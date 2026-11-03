import * as React from "react";
import { Typography } from "antd";
import { config } from "@/shared/lib/config";
import styles from "./support-link.module.css";

interface SupportLinkProps {
  children?: React.ReactNode;
  /** Muted text with a 44px touch target, for footers. */
  subtle?: boolean;
}

/** mailto link to the support address (VITE_SUPPORT_EMAIL / SUPPORT_EMAIL). */
export function SupportLink({ children = "Contact support", subtle = false }: SupportLinkProps) {
  return (
    <Typography.Link
      href={`mailto:${config.supportEmail}`}
      type={subtle ? "secondary" : undefined}
      className={subtle ? styles.subtle : undefined}
    >
      {children}
    </Typography.Link>
  );
}

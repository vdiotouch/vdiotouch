import * as React from "react";
import { Link } from "@tanstack/react-router";
import styles from "./text-link.module.css";

/** Routes a TextLink can point to. Add a path here when a page needs it. */
export type TextLinkPath = "/" | "/login" | "/signup" | "/developer";

interface TextLinkProps {
  to: TextLinkPath;
  children: React.ReactNode;
}

/** In-app router link that looks like an AntD text link. */
export function TextLink({ to, children }: TextLinkProps) {
  return (
    <Link to={to} className={styles.link}>
      {children}
    </Link>
  );
}

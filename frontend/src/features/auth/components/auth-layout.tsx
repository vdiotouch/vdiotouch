import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { SupportLink } from "@/components/navigation/support-link";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { AuthSwitchPrompt } from "./auth-switch-prompt";
import { ShowcasePanel } from "./showcase/showcase-panel";
import styles from "./auth-layout.module.css";

interface AuthLayoutProps {
  mode: "login" | "signup";
  children: React.ReactNode;
}

/**
 * Split screen shared by log in and sign up: the showcase panel on the left
 * (992px and wider) and the form on the right.
 */
export function AuthLayout({ mode, children }: AuthLayoutProps) {
  const { isNarrow } = useResponsive();

  return (
    <div className={isNarrow ? styles.page : `${styles.page} ${styles.split}`}>
      {!isNarrow && <ShowcasePanel mode={mode} />}

      <main className={styles.main}>
        <div className={styles.topBar}>
          {isNarrow && <Logo height={30} />}
          <AuthSwitchPrompt to={mode === "login" ? "signup" : "login"} compact />
        </div>

        <div className={styles.formArea}>
          <div className={styles.formColumn}>{children}</div>
        </div>

        <nav aria-label="Footer" className={styles.footer}>
          <SupportLink subtle>Support</SupportLink>
        </nav>
      </main>
    </div>
  );
}

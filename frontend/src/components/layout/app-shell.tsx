import * as React from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Layout } from "antd";
import { useResponsive } from "@/shared/hooks/use-responsive";
import type { AccountMenuUser } from "./account-menu";
import { AppHeader } from "./app-header";
import { AppSider } from "./app-sider";
import { NavDrawer } from "./nav-drawer";
import { navKeyForPath } from "./navigation";
import styles from "./app-shell.module.css";

interface AppShellProps {
  user: AccountMenuUser;
  onLogout: () => void;
}

/**
 * Signed-in layout: side nav with the profile card at the bottom (a drawer
 * below 992px), header with breadcrumb, and the current page in <Outlet />.
 */
export function AppShell({ user, onLogout }: AppShellProps) {
  const { isMobile, isNarrow } = useResponsive();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const selected = navKeyForPath(pathname);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Growing past the breakpoint swaps the drawer for the sider.
  React.useEffect(() => {
    if (!isNarrow) setDrawerOpen(false);
  }, [isNarrow]);

  return (
    <Layout className={styles.shell}>
      {!isNarrow && <AppSider selected={selected} user={user} onLogout={onLogout} />}
      <NavDrawer
        open={isNarrow && drawerOpen}
        selected={selected}
        user={user}
        onLogout={onLogout}
        onClose={() => setDrawerOpen(false)}
      />

      <Layout>
        <AppHeader
          pathname={pathname}
          user={user}
          onLogout={onLogout}
          isMobile={isMobile}
          isNarrow={isNarrow}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <Layout.Content
          className={isMobile ? `${styles.content} ${styles.contentMobile}` : styles.content}
        >
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

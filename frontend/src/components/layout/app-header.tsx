import { MenuOutlined } from "@ant-design/icons";
import { Button, Layout } from "antd";
import { AccountMenu, type AccountMenuUser } from "./account-menu";
import { HomeLink } from "./home-link";
import { PageBreadcrumb } from "./page-breadcrumb";
import { UserAvatar } from "./user-avatar";
import styles from "./app-shell.module.css";

interface AppHeaderProps {
  pathname: string;
  user: AccountMenuUser;
  onLogout: () => void;
  isMobile: boolean;
  /**
   * Below 992px: show the menu button, logo and avatar instead of the
   * breadcrumb. At 992px and wider the account menu lives in the side nav.
   */
  isNarrow: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}

export function AppHeader({
  pathname,
  user,
  onLogout,
  isMobile,
  isNarrow,
  drawerOpen,
  onOpenDrawer,
}: AppHeaderProps) {
  return (
    <Layout.Header className={isMobile ? `${styles.header} ${styles.headerMobile}` : styles.header}>
      {isNarrow ? (
        <>
          <Button
            type="text"
            icon={<MenuOutlined />}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={onOpenDrawer}
          />
          <HomeLink logoHeight={26} />
        </>
      ) : (
        <PageBreadcrumb pathname={pathname} />
      )}
      {isNarrow && (
        <div className={styles.headerEnd}>
          <AccountMenu user={user} onLogout={onLogout} placement="bottomRight">
            <Button
              type="text"
              shape="circle"
              aria-label={`Account menu, ${user.name}`}
              className={styles.accountButton}
            >
              <UserAvatar name={user.name} />
            </Button>
          </AccountMenu>
        </div>
      )}
    </Layout.Header>
  );
}

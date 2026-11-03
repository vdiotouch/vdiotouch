import { MenuOutlined } from "@ant-design/icons";
import { Button, Layout } from "antd";
import { AccountMenu, type AccountMenuUser } from "./account-menu";
import { HomeLink } from "./home-link";
import { PageBreadcrumb } from "./page-breadcrumb";
import styles from "./app-shell.module.css";

interface AppHeaderProps {
  pathname: string;
  user: AccountMenuUser;
  onLogout: () => void;
  isMobile: boolean;
  /** Below 992px: show the menu button and logo instead of the breadcrumb. */
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
      <div className={styles.headerEnd}>
        <AccountMenu user={user} onLogout={onLogout} />
      </div>
    </Layout.Header>
  );
}

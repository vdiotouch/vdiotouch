import { Layout } from "antd";
import type { AccountMenuUser } from "./account-menu";
import { HomeLink } from "./home-link";
import { NavMenu } from "./nav-menu";
import type { NavKey } from "./navigation";
import { SiderProfile } from "./sider-profile";
import styles from "./app-shell.module.css";

const SIDER_WIDTH = 232;

interface AppSiderProps {
  selected: NavKey;
  user: AccountMenuUser;
  onLogout: () => void;
}

/** Fixed side navigation, shown at 992px and wider, with the profile card at the bottom. */
export function AppSider({ selected, user, onLogout }: AppSiderProps) {
  return (
    <Layout.Sider width={SIDER_WIDTH} theme="light" className={styles.sider}>
      <div className={styles.siderInner}>
        <HomeLink className={styles.siderBrand} />
        <div className={styles.siderNav}>
          <NavMenu selected={selected} />
        </div>
        <SiderProfile user={user} onLogout={onLogout} />
      </div>
    </Layout.Sider>
  );
}

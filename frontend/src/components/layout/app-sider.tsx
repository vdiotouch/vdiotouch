import { Layout } from "antd";
import { HomeLink } from "./home-link";
import { NavMenu } from "./nav-menu";
import type { NavKey } from "./navigation";
import styles from "./app-shell.module.css";

const SIDER_WIDTH = 232;

/** Fixed side navigation, shown at 992px and wider. */
export function AppSider({ selected }: { selected: NavKey }) {
  return (
    <Layout.Sider width={SIDER_WIDTH} theme="light" className={styles.sider}>
      <div className={styles.siderInner}>
        <HomeLink className={styles.siderBrand} />
        <NavMenu selected={selected} />
      </div>
    </Layout.Sider>
  );
}

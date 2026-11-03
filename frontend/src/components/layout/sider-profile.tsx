import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { AccountMenu, type AccountMenuUser } from "./account-menu";
import { UserAvatar } from "./user-avatar";
import styles from "./app-shell.module.css";

interface SiderProfileProps {
  user: AccountMenuUser;
  onLogout: () => void;
}

/** Profile card pinned to the bottom of the side nav; opens the account menu. */
export function SiderProfile({ user, onLogout }: SiderProfileProps) {
  return (
    <div className={styles.siderProfile}>
      <AccountMenu user={user} onLogout={onLogout} placement="topLeft">
        <button
          type="button"
          className={styles.profileButton}
          aria-label={`Account menu, ${user.name}`}
        >
          <UserAvatar name={user.name} />
          <span className={styles.profileText}>
            <span className={styles.profileName}>{user.name}</span>
            <span className={styles.profileEmail}>{user.email}</span>
          </span>
          <span className={styles.profileChevron} aria-hidden="true">
            <UpOutlined />
            <DownOutlined />
          </span>
        </button>
      </AccountMenu>
    </div>
  );
}

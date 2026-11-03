import { Avatar, Button, Dropdown, Typography } from "antd";
import type { MenuProps } from "antd";
import { getInitials } from "@/shared/lib/initials";
import styles from "./app-shell.module.css";

export interface AccountMenuUser {
  name: string;
  email: string;
}

interface AccountMenuProps {
  user: AccountMenuUser;
  onLogout: () => void;
}

/** Avatar button in the header that opens "who am I" and "Log out". */
export function AccountMenu({ user, onLogout }: AccountMenuProps) {
  const items: MenuProps["items"] = [
    {
      key: "who",
      disabled: true,
      label: (
        <div>
          <Typography.Text strong>{user.name}</Typography.Text>
          <br />
          <Typography.Text type="secondary" className={styles.accountEmail}>
            {user.email}
          </Typography.Text>
        </div>
      ),
    },
    { type: "divider" },
    { key: "logout", label: "Log out" },
  ];

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "logout") onLogout();
  };

  return (
    <Dropdown trigger={["click"]} menu={{ items, onClick: handleClick }}>
      <Button
        type="text"
        shape="circle"
        aria-label={`Account menu, ${user.name}`}
        className={styles.accountButton}
      >
        <Avatar aria-hidden="true" className={styles.avatar}>
          {getInitials(user.name)}
        </Avatar>
      </Button>
    </Dropdown>
  );
}

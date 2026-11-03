import type { ReactElement } from "react";
import { Dropdown, Typography } from "antd";
import type { DropdownProps, MenuProps } from "antd";
import styles from "./app-shell.module.css";

export interface AccountMenuUser {
  name: string;
  email: string;
}

interface AccountMenuProps {
  user: AccountMenuUser;
  onLogout: () => void;
  /** Where the menu opens relative to the trigger. */
  placement?: DropdownProps["placement"];
  /** The element that opens the menu, e.g. an avatar or the profile card. */
  children: ReactElement;
}

/** "Who am I" and "Log out" menu, opened by clicking its child. */
export function AccountMenu({ user, onLogout, placement, children }: AccountMenuProps) {
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
    <Dropdown trigger={["click"]} placement={placement} menu={{ items, onClick: handleClick }}>
      {children}
    </Dropdown>
  );
}

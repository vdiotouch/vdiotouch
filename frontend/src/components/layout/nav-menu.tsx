import { useNavigate } from "@tanstack/react-router";
import { ApiOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { NAV_ROUTES, type NavKey } from "./navigation";

const NAV_ITEMS: MenuProps["items"] = [
  { key: "videos", icon: <VideoCameraOutlined />, label: "Videos" },
  {
    type: "group",
    label: "Developer",
    children: [{ key: "webhooks", icon: <ApiOutlined />, label: "Webhooks" }],
  },
];

interface NavMenuProps {
  selected: NavKey;
  /** Called after a navigation, e.g. to close the drawer. */
  onNavigate?: () => void;
}

export function NavMenu({ selected, onNavigate }: NavMenuProps) {
  const navigate = useNavigate();

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    void navigate({ to: NAV_ROUTES[key as NavKey] });
    onNavigate?.();
  };

  return (
    <nav aria-label="Main">
      <Menu
        mode="inline"
        selectedKeys={[selected]}
        items={NAV_ITEMS}
        onClick={handleClick}
        style={{ borderInlineEnd: 0, background: "transparent" }}
      />
    </nav>
  );
}

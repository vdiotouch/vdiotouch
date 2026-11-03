import { Drawer } from "antd";
import { Logo } from "@/components/brand/logo";
import type { AccountMenuUser } from "./account-menu";
import { NavMenu } from "./nav-menu";
import type { NavKey } from "./navigation";
import { SiderProfile } from "./sider-profile";

const DRAWER_WIDTH = 272;

interface NavDrawerProps {
  open: boolean;
  selected: NavKey;
  user: AccountMenuUser;
  onLogout: () => void;
  onClose: () => void;
}

/** Side navigation in a drawer, used below 992px, with the profile card at the bottom. */
export function NavDrawer({ open, selected, user, onLogout, onClose }: NavDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      size={DRAWER_WIDTH}
      title={<Logo height={30} />}
      closable={{ "aria-label": "Close navigation" }}
      styles={{ body: { padding: "8px 0" }, footer: { padding: 0, borderTop: 0 } }}
      footer={<SiderProfile user={user} onLogout={onLogout} />}
    >
      <NavMenu selected={selected} onNavigate={onClose} />
    </Drawer>
  );
}

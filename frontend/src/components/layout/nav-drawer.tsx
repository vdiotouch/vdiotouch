import { Drawer } from "antd";
import { Logo } from "@/components/brand/logo";
import { NavMenu } from "./nav-menu";
import type { NavKey } from "./navigation";

const DRAWER_WIDTH = 272;

interface NavDrawerProps {
  open: boolean;
  selected: NavKey;
  onClose: () => void;
}

/** Side navigation in a drawer, used below 992px. */
export function NavDrawer({ open, selected, onClose }: NavDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      size={DRAWER_WIDTH}
      title={<Logo height={30} />}
      closable={{ "aria-label": "Close navigation" }}
      styles={{ body: { padding: "8px 0" } }}
    >
      <NavMenu selected={selected} onNavigate={onClose} />
    </Drawer>
  );
}

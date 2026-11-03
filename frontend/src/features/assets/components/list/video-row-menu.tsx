import { CopyOutlined, DeleteOutlined, EyeOutlined, MoreOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "@tanstack/react-router";
import { Button, Dropdown, type MenuProps } from "antd";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { useAssetActions } from "../../hooks/use-asset-actions";

interface VideoRowMenuProps {
  id: string;
  title: string;
}

/** The ⋮ menu on a video row or card. */
export function VideoRowMenu({ id, title }: VideoRowMenuProps) {
  const navigate = useNavigate();
  const actions = useAssetActions();

  const items: MenuProps["items"] = [
    { key: "open", icon: <EyeOutlined />, label: "Open details" },
    { key: "copy", icon: <CopyOutlined />, label: "Copy video ID" },
    { key: "reprocess", icon: <ReloadOutlined />, label: "Re-process" },
    { type: "divider" },
    { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "open") void navigate({ to: "/videos/$id", params: { id } });
    if (key === "copy") void copyToClipboard(id, "Video ID");
    if (key === "reprocess") actions.reprocess({ id, title });
    if (key === "delete") actions.deleteOne({ id, title });
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={["click"]} placement="bottomRight">
      <Button type="text" icon={<MoreOutlined />} aria-label={`Actions for ${title}`} />
    </Dropdown>
  );
}

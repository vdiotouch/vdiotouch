import { DeleteOutlined, EditOutlined, MoreOutlined } from "@ant-design/icons";
import { Button, Dropdown, type MenuProps } from "antd";
import type { Webhook } from "../types";

interface WebhookRowMenuProps {
  webhook: Webhook;
  onEdit: (webhook: Webhook) => void;
  onDelete: (webhook: Webhook) => void;
}

/** The ⋮ menu on an endpoint row or card. */
export function WebhookRowMenu({ webhook, onEdit, onDelete }: WebhookRowMenuProps) {
  const items: MenuProps["items"] = [
    { key: "edit", icon: <EditOutlined />, label: "Edit" },
    { type: "divider" },
    { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true },
  ];
  const onClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "edit") onEdit(webhook);
    if (key === "delete") onDelete(webhook);
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={["click"]} placement="bottomRight">
      <Button type="text" icon={<MoreOutlined />} aria-label={`Actions for ${webhook.url}`} />
    </Dropdown>
  );
}

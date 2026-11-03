import { Table, Typography, type TableProps } from "antd";
import { formatDate } from "@/shared/lib/format";
import type { Webhook } from "../types";
import { SecretStatus } from "./secret-status";
import { WebhookRowMenu } from "./webhook-row-menu";
import styles from "./webhooks.module.css";

interface WebhooksTableProps {
  webhooks: Webhook[];
  onEdit: (webhook: Webhook) => void;
  onDelete: (webhook: Webhook) => void;
}

/** Endpoints list from 768px up. */
export function WebhooksTable({ webhooks, onEdit, onDelete }: WebhooksTableProps) {
  const columns: TableProps<Webhook>["columns"] = [
    {
      title: "Endpoint",
      dataIndex: "url",
      ellipsis: true,
      render: (url: string) => (
        <Typography.Text strong code title={url}>
          {url}
        </Typography.Text>
      ),
    },
    {
      title: "Secret",
      dataIndex: "secret_token",
      width: 190,
      render: (secret: string | null) => <SecretStatus hasSecret={!!secret} />,
    },
    {
      title: "Added",
      dataIndex: "created_at",
      width: 130,
      render: (createdAt: string) => (
        <Typography.Text type="secondary" className={styles.nowrap}>
          {formatDate(createdAt)}
        </Typography.Text>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: "actions",
      width: 52,
      render: (_, webhook) => <WebhookRowMenu webhook={webhook} onEdit={onEdit} onDelete={onDelete} />,
    },
  ];

  return (
    <Table<Webhook> rowKey="_id" columns={columns} dataSource={webhooks} pagination={false} />
  );
}

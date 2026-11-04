import { Typography } from "antd";
import { formatDate } from "@/shared/lib/format";
import type { Webhook } from "../types";
import { SecretStatus } from "./secret-status";
import { WebhookRowMenu } from "./webhook-row-menu";
import styles from "./webhooks.module.css";

interface WebhookCardListProps {
  webhooks: Webhook[];
  onEdit: (webhook: Webhook) => void;
  onDelete: (webhook: Webhook) => void;
}

/** Endpoints list below 768px. */
export function WebhookCardList({ webhooks, onEdit, onDelete }: WebhookCardListProps) {
  return (
    <div role="list" aria-label="Endpoints">
      {webhooks.map((webhook) => (
        <div key={webhook._id} role="listitem" className={styles.card}>
          <div className={styles.cardText}>
            <Typography.Text strong code className={styles.url}>
              {webhook.url}
            </Typography.Text>
            <div className={styles.cardMeta}>
              <SecretStatus hasSecret={webhook.has_secret} />
              <Typography.Text type="secondary" className={styles.small}>
                Added {formatDate(webhook.created_at)}
              </Typography.Text>
            </div>
          </div>
          <WebhookRowMenu webhook={webhook} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ))}
    </div>
  );
}

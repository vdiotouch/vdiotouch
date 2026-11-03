import { Card, Typography } from "antd";
import { EXAMPLE_PAYLOAD, SECRET_HEADER, WEBHOOK_EVENTS } from "../constants";
import styles from "./webhooks.module.css";

/** What we send: the events, an example body and how the secret is passed. */
export function WebhookGuideCard() {
  return (
    <Card title="Example payload">
      <pre tabIndex={0} aria-label="Example payload" className={styles.payload}>
        {EXAMPLE_PAYLOAD}
      </pre>
      <Typography.Paragraph type="secondary" className={styles.note}>
        If you set a secret, it's sent in the{" "}
        <Typography.Text code className={styles.nowrap}>
          {SECRET_HEADER}
        </Typography.Text>{" "}
        header so you can check the request came from us.
      </Typography.Paragraph>

      <Typography.Title level={5} className={styles.eventsTitle}>
        Events
      </Typography.Title>
      <dl className={styles.events}>
        {WEBHOOK_EVENTS.map((event) => (
          <div key={event.name} className={styles.event}>
            <dt>
              <Typography.Text code>{event.name}</Typography.Text>
            </dt>
            <dd className={styles.eventDescription}>{event.description}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

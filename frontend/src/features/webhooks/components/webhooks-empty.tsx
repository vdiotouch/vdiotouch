import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Typography } from "antd";
import styles from "./webhooks.module.css";

/** No endpoints yet. */
export function WebhooksEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <Empty
      className={styles.empty}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <>
          <Typography.Text strong className={styles.block}>
            No endpoints yet.
          </Typography.Text>
          <Typography.Text type="secondary">
            Add one to hear about status changes without polling the api.
          </Typography.Text>
        </>
      }
    >
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
        Add endpoint
      </Button>
    </Empty>
  );
}

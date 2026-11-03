import { LockOutlined } from "@ant-design/icons";
import { Tag, Typography } from "antd";

/** Whether the endpoint has a secret. The secret itself is never shown. */
export function SecretStatus({ hasSecret }: { hasSecret: boolean }) {
  return hasSecret ? (
    <Tag icon={<LockOutlined aria-hidden="true" />}>Signing secret set</Tag>
  ) : (
    <Typography.Text type="secondary">No secret</Typography.Text>
  );
}

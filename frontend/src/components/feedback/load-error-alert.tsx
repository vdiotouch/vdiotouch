import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button } from "antd";

interface LoadErrorAlertProps {
  /** e.g. "We couldn't load your videos." */
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/** Shown in place of content that failed to load, with a Retry button. */
export function LoadErrorAlert({
  title,
  description = "Check your connection and try again. If it keeps happening, the API may be down.",
  onRetry,
  retrying = false,
}: LoadErrorAlertProps) {
  return (
    <Alert
      type="error"
      showIcon
      role="alert"
      title={title}
      description={description}
      action={
        onRetry && (
          <Button size="small" icon={<ReloadOutlined />} loading={retrying} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  );
}

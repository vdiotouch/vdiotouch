import * as React from "react";
import { Alert } from "antd";
import styles from "./form-error-alert.module.css";

interface FormErrorAlertProps {
  /** Nothing renders while this is empty. */
  message: string | null;
}

/**
 * Error banner above a form. It takes focus each time the message changes so
 * keyboard and screen reader users land on it after a failed submit.
 */
export function FormErrorAlert({ message }: FormErrorAlertProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);

  if (!message) return null;
  return (
    <div ref={ref} tabIndex={-1} className={styles.wrapper}>
      <Alert type="error" showIcon role="alert" title={message} />
    </div>
  );
}

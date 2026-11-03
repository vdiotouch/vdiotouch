import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import { Alert, Button, Typography } from "antd";
import styles from "./video-details.module.css";

export type SaveState = "idle" | "saving" | "saved" | "failed";

interface SaveBarProps {
  state: SaveState;
  /** Unsaved edits exist. */
  dirty: boolean;
  onDiscard: () => void;
}

/** Discard / Save changes, with the Saving, Saved and Save failed states. */
export function SaveBar({ state, dirty, onDiscard }: SaveBarProps) {
  const saving = state === "saving";
  const failed = state === "failed";

  return (
    <>
      {failed && (
        <Alert
          type="error"
          showIcon
          role="alert"
          className={styles.saveError}
          title="Couldn't save your changes."
          description="Your edits are still here. Check your connection and try again."
        />
      )}
      <div className={styles.saveBar}>
        <span aria-live="polite" className={styles.saveStatus}>
          {state === "saved" && (
            <Typography.Text type="success">
              <CheckCircleFilled aria-hidden="true" /> Saved just now
            </Typography.Text>
          )}
          {failed && (
            <Typography.Text type="danger">
              <CloseCircleFilled aria-hidden="true" /> Not saved
            </Typography.Text>
          )}
        </span>
        <Button disabled={saving || !dirty} onClick={onDiscard}>
          Discard
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={saving}
          aria-busy={saving}
          disabled={!dirty && !failed}
        >
          {saving ? "Saving…" : failed ? "Try again" : "Save changes"}
        </Button>
      </div>
    </>
  );
}

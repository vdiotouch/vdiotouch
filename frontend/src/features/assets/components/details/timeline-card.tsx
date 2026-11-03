import * as React from "react";
import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from "@ant-design/icons";
import { Button, Card, Timeline, Typography } from "antd";
import { formatDateTime } from "@/shared/lib/format";
import { ASSET_STATUS } from "../../constants";
import { statusDisplay } from "../../lib/asset-status";
import type { StatusLog } from "../../types";
import styles from "./video-details.module.css";

/** How many steps show before "Show all". */
const COLLAPSED_COUNT = 5;

function stepIcon(log: StatusLog, isLatest: boolean) {
  if (log.status === ASSET_STATUS.FAILED) {
    return <CloseCircleFilled aria-hidden="true" className={styles.stepFailed} />;
  }
  if (isLatest && log.status !== ASSET_STATUS.READY) {
    return <LoadingOutlined aria-hidden="true" className={styles.stepActive} />;
  }
  return <CheckCircleFilled aria-hidden="true" className={styles.stepDone} />;
}

/** Each pipeline step the video went through, newest first. */
export function TimelineCard({ logs }: { logs: StatusLog[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const newestFirst = [...logs].reverse();
  const visible = expanded ? newestFirst : newestFirst.slice(0, COLLAPSED_COUNT);

  return (
    <Card title="Processing timeline">
      {logs.length === 0 ? (
        <Typography.Text type="secondary">No steps yet.</Typography.Text>
      ) : (
        <Timeline
          className={styles.timeline}
          items={visible.map((log, index) => ({
            key: `${log.status}-${log.created_at}`,
            icon: stepIcon(log, index === 0),
            content: (
              <div>
                <Typography.Text strong>{statusDisplay(log.status).label}</Typography.Text>
                <br />
                <Typography.Text type="secondary" className={styles.stepMeta}>
                  {formatDateTime(log.created_at)}
                  {log.details && ` · ${log.details}`}
                </Typography.Text>
              </div>
            ),
          }))}
        />
      )}
      {logs.length > COLLAPSED_COUNT && (
        <Button type="link" className={styles.timelineToggle} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer steps" : `Show all ${logs.length} steps`}
        </Button>
      )}
    </Card>
  );
}

import { LinkOutlined, PlayCircleOutlined, VideoCameraOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Steps, Typography } from "antd";
import styles from "./video-list.module.css";

/** First run: the account has no videos yet. */
export function VideosEmpty({ onImport }: { onImport: () => void }) {
  return (
    <Card className={styles.emptyCard}>
      <Empty
        image={
          <div className={styles.emptyIcon} aria-hidden="true">
            <VideoCameraOutlined />
          </div>
        }
        styles={{ image: { height: 80 } }}
        description={
          <>
            <Typography.Title level={4} className={styles.emptyTitle}>
              Add your first video
            </Typography.Title>
            <Typography.Text type="secondary">
              We encode it to HLS in several resolutions and give you a link you can play anywhere.
            </Typography.Text>
          </>
        }
      >
        <Button type="primary" icon={<LinkOutlined />} onClick={onImport}>
          Import from link
        </Button>
      </Empty>
      <div className={styles.emptySteps}>
        <Steps
          current={-1}
          items={[
            { title: "Import", content: "Paste a public link to the video file.", icon: <LinkOutlined /> },
            {
              title: "Encode",
              content: "360p to 1080p HLS, with a live status for each step.",
              icon: <ThunderboltOutlined />,
            },
            {
              title: "Stream",
              content: "Copy the playlist URL, or get notified by webhook.",
              icon: <PlayCircleOutlined />,
            },
          ]}
        />
      </div>
    </Card>
  );
}

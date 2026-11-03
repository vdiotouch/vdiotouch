import * as React from "react";
import { ClockCircleOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, Card } from "antd";
import { statusDisplay } from "../../lib/asset-status";
import type { AssetDetails } from "../../types";
import { PlayerMessage } from "./player-message";
import styles from "./video-details.module.css";

const VideoPlayer = React.lazy(() => import("./video-player"));

/** The player, or a message while the video isn't playable. */
export function PlayerCard({ asset }: { asset: AssetDetails }) {
  const [failed, setFailed] = React.useState(false);
  // Bumped by "Try again" to mount a fresh player.
  const [attempt, setAttempt] = React.useState(0);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  let content: React.ReactNode;
  if (!asset.master_playlist_url) {
    content = (
      <PlayerMessage
        icon={<ClockCircleOutlined />}
        title="This video isn't ready to play yet."
        description={`Status: ${statusDisplay(asset.latest_status).label}. The player appears once the first resolution is published.`}
      />
    );
  } else if (failed) {
    content = (
      <PlayerMessage
        role="alert"
        icon={<WarningOutlined />}
        title="This video can't play right now."
        description="The playlist didn't load. The files may still be publishing, or the link may have expired."
      >
        <Button icon={<ReloadOutlined />} onClick={retry}>
          Try again
        </Button>
      </PlayerMessage>
    );
  } else {
    content = (
      <React.Suspense fallback={<div className={styles.playerPlaceholder} />}>
        <VideoPlayer
          key={attempt}
          masterUrl={asset.master_playlist_url}
          thumbnailUrl={asset.thumbnail_url}
          onFatalError={() => setFailed(true)}
        />
      </React.Suspense>
    );
  }

  return (
    <Card styles={{ body: { padding: 12 } }}>
      {content}
    </Card>
  );
}

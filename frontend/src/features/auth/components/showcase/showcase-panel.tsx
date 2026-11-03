import { Card, Typography } from "antd";
import { Logo } from "@/components/brand/logo";
import { FeatureList } from "./feature-list";
import { PlayerPreview } from "./player-preview";
import { SampleVideoList } from "./sample-video-list";
import { FEATURES, HEADLINES, SAMPLE_VIDEOS, TAGLINE } from "./showcase-content";
import styles from "./showcase.module.css";

interface ShowcasePanelProps {
  mode: "login" | "signup";
}

/**
 * Left half of the auth split screen (992px and wider). Decorative only, so
 * it is hidden from assistive tech and cannot take focus.
 */
export function ShowcasePanel({ mode }: ShowcasePanelProps) {
  return (
    <div aria-hidden="true" inert className={styles.panel}>
      <Logo height={40} />

      <div className={styles.body}>
        <Typography.Title level={1} className={styles.headline}>
          {HEADLINES[mode]}
        </Typography.Title>
        <Typography.Text type="secondary" className={styles.tagline}>
          {TAGLINE}
        </Typography.Text>

        <Card size="small" className={styles.previewCard} styles={{ body: { padding: 0 } }}>
          <PlayerPreview />
          <SampleVideoList videos={SAMPLE_VIDEOS} />
        </Card>

        <FeatureList features={FEATURES} />
      </div>

      <Typography.Text type="secondary" className={styles.small}>
        © {new Date().getFullYear()} Vdio Touch
      </Typography.Text>
    </div>
  );
}

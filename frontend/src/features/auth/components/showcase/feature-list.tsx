import { Typography } from "antd";
import type { Feature } from "./showcase-content";
import styles from "./showcase.module.css";

export function FeatureList({ features }: { features: Feature[] }) {
  return (
    <ul className={styles.featureList}>
      {features.map((feature) => (
        <li key={feature.title} className={styles.feature}>
          <span className={styles.featureIcon}>{feature.icon}</span>
          <div>
            <Typography.Text strong>{feature.title}</Typography.Text>
            <br />
            <Typography.Text type="secondary">{feature.body}</Typography.Text>
          </div>
        </li>
      ))}
    </ul>
  );
}

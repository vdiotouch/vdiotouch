import { CaretRightFilled } from "@ant-design/icons";
import styles from "./showcase.module.css";

/** Static picture of a paused player. */
export function PlayerPreview() {
  return (
    <div className={styles.player}>
      <div className={styles.playButton}>
        <CaretRightFilled />
      </div>
      <div className={styles.controls}>
        <span className={styles.time}>12:04</span>
        <div className={styles.track}>
          <div className={styles.trackFill} />
        </div>
        <span className={styles.quality}>1080p</span>
      </div>
    </div>
  );
}

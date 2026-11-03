import * as React from "react";
import Hls from "hls.js";
import Plyr from "plyr";
import styles from "./video-details.module.css";

interface VideoPlayerProps {
  masterUrl: string;
  thumbnailUrl: string;
  /** Called when the playlist can't be loaded or played. */
  onFatalError: () => void;
}

/**
 * HLS player (hls.js + Plyr) with a quality menu. Default export so the page
 * can load it with React.lazy: both libraries are large.
 */
export default function VideoPlayer({ masterUrl, thumbnailUrl, onFatalError }: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  // Kept in a ref so a new callback doesn't tear the player down.
  const onFatalErrorRef = React.useRef(onFatalError);
  React.useEffect(() => {
    onFatalErrorRef.current = onFatalError;
  }, [onFatalError]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let player: Plyr | null = null;
    let hls: Hls | null = null;

    const baseOptions: Plyr.Options = {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen",
      ],
      settings: ["captions", "quality", "speed"],
    };

    if (Hls.isSupported()) {
      const instance = new Hls();
      hls = instance;
      instance.loadSource(masterUrl);
      instance.attachMedia(video);
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        const heights = instance.levels.map((l) => l.height);
        player = new Plyr(video, {
          ...baseOptions,
          quality: {
            default: heights[heights.length - 1] ?? 0,
            options: heights,
            forced: true,
            onChange: (quality: number) => {
              instance.currentLevel = instance.levels.findIndex((l) => l.height === quality);
            },
          },
        });
      });
      instance.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) onFatalErrorRef.current();
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = masterUrl;
      player = new Plyr(video, baseOptions);
    }

    return () => {
      player?.destroy();
      hls?.destroy();
    };
  }, [masterUrl]);

  return (
    <div className={`vt-player ${styles.player}`}>
      <video
        ref={videoRef}
        className={styles.video}
        crossOrigin="anonymous"
        playsInline
        poster={thumbnailUrl}
      />
    </div>
  );
}

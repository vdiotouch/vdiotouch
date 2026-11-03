import * as React from "react";
import { CloudServerOutlined, CodeOutlined, LockOutlined } from "@ant-design/icons";
import type { StatusTone } from "@/components/data-display/status-tag";

/** Copy and sample data for the decorative panel beside the auth forms. */

export const HEADLINES = {
  login: "Upload once. Stream everywhere.",
  signup: "Start streaming in minutes.",
} as const;

export const TAGLINE =
  "Vdio Touch takes a video file or a link and turns it into an adaptive stream you can embed anywhere.";

export interface SampleVideo {
  title: string;
  tone: StatusTone;
  status: string;
  note: string;
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  { title: "chapter-6-optics", tone: "processing", status: "Encoding", note: "Started 2 min ago" },
  { title: "batch 22: table completion", tone: "success", status: "Ready", note: "4 resolutions" },
  { title: "lecture-09-thermo.mp4", tone: "warning", status: "Queued", note: "Waiting to start" },
];

export interface Feature {
  icon: React.ReactNode;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    icon: <CloudServerOutlined />,
    title: "Adaptive HLS, encoded for you",
    body: "Every upload is encoded to 1080p, 720p, 480p and 360p.",
  },
  {
    icon: <CodeOutlined />,
    title: "Built for developers",
    body: "GraphQL API, playback URLs and status webhooks.",
  },
  {
    icon: <LockOutlined />,
    title: "Your storage, your keys",
    body: "Files go to your own R2 or S3 bucket.",
  },
];

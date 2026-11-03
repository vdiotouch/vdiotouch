import * as React from "react";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  LoadingOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";

export type StatusTone = "success" | "processing" | "warning" | "error";

const TONE_ICONS: Record<StatusTone, React.ReactNode> = {
  success: <CheckCircleFilled aria-hidden="true" />,
  processing: <LoadingOutlined spin aria-hidden="true" />,
  warning: <ClockCircleOutlined aria-hidden="true" />,
  error: <CloseCircleFilled aria-hidden="true" />,
};

interface StatusTagProps {
  tone: StatusTone;
  children: React.ReactNode;
}

/** Coloured tag with an icon, so status never relies on colour alone. */
export function StatusTag({ tone, children }: StatusTagProps) {
  return (
    <Tag color={tone} icon={TONE_ICONS[tone]}>
      {children}
    </Tag>
  );
}

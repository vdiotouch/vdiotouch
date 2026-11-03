import { ArrowLeftOutlined, CopyOutlined, DeleteOutlined, MoreOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Dropdown, Space, Typography, type MenuProps } from "antd";
import { CopyButton } from "@/components/actions/copy-button";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { formatDate, formatDuration } from "@/shared/lib/format";
import { assetTitle } from "../../lib/asset-title";
import type { AssetDetails } from "../../types";
import { VideoStatusTag } from "../video-status-tag";
import styles from "./video-details.module.css";

interface VideoDetailsHeaderProps {
  asset: AssetDetails;
  onReprocess: () => void;
  onDelete: () => void;
}

/** "1:52:40 · 1920×1080 · Uploaded 5 Mar 2026" */
function summaryLine(asset: AssetDetails) {
  const parts: string[] = [];
  if (asset.duration > 0) parts.push(formatDuration(asset.duration));
  if (asset.width > 0 && asset.height > 0) parts.push(`${asset.width}×${asset.height}`);
  parts.push(`Uploaded ${formatDate(asset.created_at)}`);
  return parts.join(" · ");
}

/** Back link, title, status and the page's actions. */
export function VideoDetailsHeader({ asset, onReprocess, onDelete }: VideoDetailsHeaderProps) {
  const { isMobile } = useResponsive();

  const menuItems: MenuProps["items"] = [
    // On phones Re-process moves into the menu to save room.
    ...(isMobile ? [{ key: "reprocess", icon: <ReloadOutlined />, label: "Re-process" }] : []),
    { key: "copy-id", icon: <CopyOutlined />, label: "Copy video ID" },
    { type: "divider" as const },
    { key: "delete", icon: <DeleteOutlined />, label: "Delete video", danger: true },
  ];
  const onMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "reprocess") onReprocess();
    if (key === "copy-id") void copyToClipboard(asset._id, "Video ID");
    if (key === "delete") onDelete();
  };

  return (
    <header className={isMobile ? `${styles.header} ${styles.headerMobile}` : styles.header}>
      <Link to="/" aria-label="Back to videos" className={styles.backLink}>
        <ArrowLeftOutlined aria-hidden="true" />
      </Link>
      <div className={styles.headerText}>
        <Typography.Title level={4} className={styles.headerTitle}>
          {assetTitle(asset.title)}
        </Typography.Title>
        <div className={styles.headerMeta}>
          <VideoStatusTag status={asset.latest_status} />
          <Typography.Text type="secondary">{summaryLine(asset)}</Typography.Text>
        </div>
      </div>
      <Space wrap className={styles.headerActions}>
        <CopyButton
          type="primary"
          text={asset.master_playlist_url ?? ""}
          label="Playlist URL"
          disabled={!asset.master_playlist_url}
        >
          Copy playlist URL
        </CopyButton>
        {!isMobile && (
          <Button icon={<ReloadOutlined />} onClick={onReprocess}>
            Re-process
          </Button>
        )}
        <Dropdown menu={{ items: menuItems, onClick: onMenuClick }} trigger={["click"]} placement="bottomRight">
          <Button icon={<MoreOutlined />} aria-label="More actions" />
        </Dropdown>
      </Space>
    </header>
  );
}

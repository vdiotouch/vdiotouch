import { Card, List, Table, Typography, type TableProps } from "antd";
import { CopyButton } from "@/components/actions/copy-button";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { formatBytes } from "@/shared/lib/format";
import { ASSET_STATUS } from "../../constants";
import { resolutionFiles, resolutionLabel, resolutionUrl } from "../../lib/asset-files";
import type { AssetDetails, FileDetails } from "../../types";
import { VideoStatusTag } from "../video-status-tag";
import styles from "./video-details.module.css";

interface CopyUrlButtonProps {
  file: FileDetails;
  masterPlaylistUrl: string | null;
}

/** Copy URL is only offered once the resolution is published. */
function CopyUrlButton({ file, masterPlaylistUrl }: CopyUrlButtonProps) {
  const url =
    file.latest_status === ASSET_STATUS.READY && masterPlaylistUrl
      ? resolutionUrl(masterPlaylistUrl, file)
      : null;
  const label = resolutionLabel(file);
  return (
    <CopyButton
      size="small"
      text={url ?? ""}
      label={`${label} URL`}
      aria-label={`Copy ${label} URL`}
      disabled={!url}
    >
      Copy URL
    </CopyButton>
  );
}

/** One HLS playlist per resolution, with its status, size and URL. */
export function ResolutionsCard({ asset }: { asset: AssetDetails }) {
  const { isMobile } = useResponsive();
  const files = resolutionFiles(asset.files);
  const master = asset.master_playlist_url;

  const columns: TableProps<FileDetails>["columns"] = [
    {
      title: "Resolution",
      key: "resolution",
      render: (_, file) => (
        <>
          <Typography.Text strong>{resolutionLabel(file)}</Typography.Text>{" "}
          <Typography.Text type="secondary">
            {file.width}×{file.height}
          </Typography.Text>
        </>
      ),
    },
    {
      title: "Status",
      dataIndex: "latest_status",
      render: (status: string) => <VideoStatusTag status={status} />,
    },
    {
      title: "Size",
      dataIndex: "size",
      render: (size: number) => <Typography.Text type="secondary">{formatBytes(size)}</Typography.Text>,
    },
    {
      title: <span className="sr-only">Copy URL</span>,
      key: "copy",
      align: "right",
      render: (_, file) => <CopyUrlButton file={file} masterPlaylistUrl={master} />,
    },
  ];

  return (
    <Card
      title={
        <>
          Resolutions{" "}
          <Typography.Text type="secondary" className={styles.cardTitleNote}>
            HLS, one per resolution
          </Typography.Text>
        </>
      }
      styles={{ body: { padding: 0 } }}
    >
      {files.length === 0 ? (
        <Typography.Paragraph type="secondary" className={styles.cardEmpty}>
          {asset.with_transcoding
            ? "Resolutions appear here as they finish encoding."
            : "Multiple resolutions were turned off for this video."}
        </Typography.Paragraph>
      ) : isMobile ? (
        <List
          dataSource={files}
          rowKey="_id"
          renderItem={(file) => (
            <List.Item
              className={styles.listItem}
              actions={[<CopyUrlButton key="copy" file={file} masterPlaylistUrl={master} />]}
            >
              <div>
                <Typography.Text strong>{resolutionLabel(file)}</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  {file.width}×{file.height} · {formatBytes(file.size)}
                </Typography.Text>
                <div>
                  <VideoStatusTag status={file.latest_status} />
                </div>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <Table<FileDetails>
          rowKey="_id"
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={files}
        />
      )}
    </Card>
  );
}

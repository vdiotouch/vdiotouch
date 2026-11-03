import * as React from "react";
import { DownloadOutlined } from "@ant-design/icons";
import { Button, List, Typography } from "antd";
import { errorMessage } from "@/shared/lib/errors";
import { formatBytes } from "@/shared/lib/format";
import { notify } from "@/shared/lib/notify";
import { getFileUrl } from "../../api";
import { ASSET_STATUS } from "../../constants";
import { downloadableFiles } from "../../lib/asset-files";
import type { AssetDetails, FileDetails } from "../../types";
import { VideoStatusTag } from "../video-status-tag";
import styles from "./video-details.module.css";

function DownloadButton({ file, label }: { file: FileDetails; label: string }) {
  const [busy, setBusy] = React.useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const url = await getFileUrl(file._id);
      if (url) window.open(url, "_blank", "noopener");
      else notify.error(`The ${label.toLowerCase()} has no download link yet.`);
    } catch (err) {
      notify.error(`Couldn't get the download link: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="small"
      icon={<DownloadOutlined />}
      loading={busy}
      disabled={file.latest_status !== ASSET_STATUS.READY}
      aria-label={`Download ${label.toLowerCase()}`}
      onClick={() => void download()}
    >
      Download
    </Button>
  );
}

/** Source, MP4, thumbnail, audio and transcript files, with download links. */
export function FilesList({ asset }: { asset: AssetDetails }) {
  const files = downloadableFiles(asset.files);

  if (files.length === 0) {
    return <Typography.Paragraph type="secondary">No files yet.</Typography.Paragraph>;
  }

  return (
    <List
      dataSource={files}
      rowKey={({ file }) => file._id}
      renderItem={({ file, label }) => (
        <List.Item
          className={styles.listItem}
          actions={[<DownloadButton key="download" file={file} label={label} />]}
        >
          <div>
            <Typography.Text strong>{label}</Typography.Text>{" "}
            <Typography.Text type="secondary">{formatBytes(file.size)}</Typography.Text>
            <div>
              <VideoStatusTag status={file.latest_status} />
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}

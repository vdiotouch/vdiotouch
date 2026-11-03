import { Table, Typography, type TableProps } from "antd";
import { formatBytes, formatDate } from "@/shared/lib/format";
import { assetTitle } from "../../lib/asset-title";
import type { AssetSummary } from "../../types";
import { VideoRowMenu } from "./video-row-menu";
import { VideoStatusCell } from "./video-status-cell";
import { VideoSummary } from "./video-summary";
import styles from "./video-list.module.css";

interface VideosTableProps {
  assets: AssetSummary[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const columns: TableProps<AssetSummary>["columns"] = [
  {
    title: "Video",
    key: "video",
    render: (_, asset) => <VideoSummary asset={asset} />,
  },
  {
    title: "Status",
    dataIndex: "latest_status",
    width: 230,
    render: (status: string) => <VideoStatusCell status={status} />,
  },
  {
    title: "Size",
    dataIndex: "size",
    render: (size: number) => (
      <Typography.Text type="secondary" className={styles.nowrap}>
        {size > 0 ? formatBytes(size) : "–"}
      </Typography.Text>
    ),
  },
  {
    title: "Created",
    dataIndex: "created_at",
    render: (createdAt: string) => (
      <Typography.Text type="secondary" className={styles.nowrap}>
        {formatDate(createdAt)}
      </Typography.Text>
    ),
  },
  {
    title: <span className="sr-only">Actions</span>,
    key: "actions",
    width: 52,
    render: (_, asset) => <VideoRowMenu id={asset._id} title={assetTitle(asset.title)} />,
  },
];

/** Videos list from 768px up. */
export function VideosTable({ assets, selectedIds, onSelectionChange }: VideosTableProps) {
  return (
    <Table<AssetSummary>
      rowKey="_id"
      size="middle"
      columns={columns}
      dataSource={assets}
      pagination={false}
      rowSelection={{
        selectedRowKeys: selectedIds,
        onChange: (keys) => onSelectionChange(keys.map(String)),
        getCheckboxProps: (asset) => ({ "aria-label": `Select ${assetTitle(asset.title)}` }),
      }}
    />
  );
}

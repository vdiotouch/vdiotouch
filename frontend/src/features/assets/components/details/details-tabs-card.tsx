import { Card, Tabs } from "antd";
import { downloadableFiles } from "../../lib/asset-files";
import type { AssetDetails } from "../../types";
import { DetailsForm } from "./details-form";
import { FilesList } from "./files-list";

/** Details (the edit form) and Files (downloads) tabs. */
export function DetailsTabsCard({ asset }: { asset: AssetDetails }) {
  const fileCount = downloadableFiles(asset.files).length;

  return (
    <Card styles={{ body: { paddingTop: 4 } }}>
      <Tabs
        defaultActiveKey="details"
        items={[
          { key: "details", label: "Details", children: <DetailsForm asset={asset} /> },
          { key: "files", label: `Files (${fileCount})`, children: <FilesList asset={asset} /> },
        ]}
      />
    </Card>
  );
}

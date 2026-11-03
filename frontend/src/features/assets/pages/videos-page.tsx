import * as React from "react";
import { LinkOutlined } from "@ant-design/icons";
import { Button, Card } from "antd";
import { LoadErrorAlert } from "@/components/feedback/load-error-alert";
import { PageHeader } from "@/components/layout/page-header";
import { CursorPager } from "@/components/navigation/cursor-pager";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { useCursorPagination } from "@/shared/lib/use-cursor-pagination";
import { useAssets } from "../api";
import { ImportVideoDialog } from "../components/import/import-video-dialog";
import { BulkActionsBar } from "../components/list/bulk-actions-bar";
import { VideoCardList } from "../components/list/video-card-list";
import { VideosEmpty } from "../components/list/videos-empty";
import { VideosLoading } from "../components/list/videos-loading";
import { VideosNoResults } from "../components/list/videos-no-results";
import { VideosTable } from "../components/list/videos-table";
import { VideosToolbar } from "../components/list/videos-toolbar";
import { useAssetActions } from "../hooks/use-asset-actions";
import { assetTitle } from "../lib/asset-title";
import styles from "./videos-page.module.css";

export function VideosPage() {
  const { isMobile } = useResponsive();
  const actions = useAssetActions();
  const pagination = useCursorPagination();
  const [searchInput, setSearchInput] = React.useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);

  const { data, isPending, isError, isRefetching, refetch } = useAssets(pagination.cursor, search);
  const assets = data?.ListAsset.assets ?? [];
  const page = data?.ListAsset.page_info;

  // Rows can disappear between polls (deleted, or moved to another page).
  const selected = assets.filter((asset) => selectedIds.includes(asset._id));
  const isFirstRun = !!data && assets.length === 0 && !search && pagination.pageIndex === 0;

  const changeSearch = (value: string) => {
    setSearchInput(value);
    setSelectedIds([]);
    pagination.reset();
  };
  const goToPrevious = () => {
    setSelectedIds([]);
    pagination.prev(page);
  };
  const goToNext = () => {
    setSelectedIds([]);
    pagination.next(page);
  };

  const importButton = (
    <Button type="primary" icon={<LinkOutlined />} onClick={() => setImportOpen(true)}>
      Import from link
    </Button>
  );
  const importDialog = <ImportVideoDialog open={importOpen} onClose={() => setImportOpen(false)} />;

  if (isFirstRun) {
    return (
      <>
        <PageHeader title="Videos" description="Import, encode and stream." />
        <VideosEmpty onImport={() => setImportOpen(true)} />
        {importDialog}
      </>
    );
  }

  const renderList = () => {
    if (isPending) return <VideosLoading rows={isMobile ? 4 : 6} />;
    if (isError && !data) {
      return (
        <div className={styles.listMessage}>
          <LoadErrorAlert
            title="We couldn't load your videos."
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        </div>
      );
    }
    if (assets.length === 0) {
      return <VideosNoResults search={search} onClear={() => changeSearch("")} />;
    }
    const listProps = {
      assets,
      selectedIds: selected.map((asset) => asset._id),
      onSelectionChange: setSelectedIds,
    };
    return isMobile ? <VideoCardList {...listProps} /> : <VideosTable {...listProps} />;
  };

  return (
    <>
      <PageHeader
        title="Videos"
        description="Import, encode and stream. Status updates live while encoding runs."
        actions={importButton}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <VideosToolbar search={searchInput} onSearchChange={changeSearch} />
        {selected.length > 0 && (
          <BulkActionsBar
            count={selected.length}
            onReprocess={() =>
              actions.reprocessMany(selected.map((a) => ({ id: a._id, title: assetTitle(a.title) })))
            }
            onCopyIds={() => void copyToClipboard(selected.map((a) => a._id).join("\n"), "Video IDs")}
            onClear={() => setSelectedIds([])}
          />
        )}
        {renderList()}
        {assets.length > 0 && page && (
          <CursorPager
            pageIndex={pagination.pageIndex}
            totalPages={page.total_pages}
            hasPrevious={!!page.prev_cursor && pagination.pageIndex > 0}
            hasNext={!!page.next_cursor}
            onPrevious={goToPrevious}
            onNext={goToNext}
          />
        )}
      </Card>

      {importDialog}
    </>
  );
}

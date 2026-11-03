import * as React from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Skeleton } from "antd";
import { LoadErrorAlert } from "@/components/feedback/load-error-alert";
import { PageHeader } from "@/components/layout/page-header";
import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { CursorPager } from "@/components/navigation/cursor-pager";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { useCursorPagination } from "@/shared/lib/use-cursor-pagination";
import { useWebhooks } from "../api";
import { WebhookCardList } from "../components/webhook-card-list";
import { WebhookDialog } from "../components/webhook-dialog";
import { WebhookGuideCard } from "../components/webhook-guide-card";
import { WebhooksEmpty } from "../components/webhooks-empty";
import { WebhooksTable } from "../components/webhooks-table";
import { useWebhookActions } from "../hooks/use-webhook-actions";
import type { Webhook } from "../types";
import styles from "./webhooks-page.module.css";

/** Which dialog is open: closed, adding, or editing one endpoint. */
type DialogState = { open: false } | { open: true; webhook: Webhook | null };

export function WebhooksPage() {
  const { isMobile } = useResponsive();
  const actions = useWebhookActions();
  const pagination = useCursorPagination();
  const [dialog, setDialog] = React.useState<DialogState>({ open: false });
  const { data, isPending, isError, isRefetching, refetch } = useWebhooks(pagination.cursor);

  const webhooks = data?.ListWebhook.webhooks ?? [];
  const page = data?.ListWebhook.page_info;

  const openAdd = () => setDialog({ open: true, webhook: null });
  const openEdit = (webhook: Webhook) => setDialog({ open: true, webhook });

  const renderList = () => {
    if (isPending) {
      return (
        <div aria-busy="true" aria-label="Loading endpoints" className={styles.listMessage}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      );
    }
    if (isError && !data) {
      return (
        <div className={styles.listMessage}>
          <LoadErrorAlert
            title="We couldn't load your endpoints."
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        </div>
      );
    }
    if (webhooks.length === 0) return <WebhooksEmpty onAdd={openAdd} />;

    const listProps = { webhooks, onEdit: openEdit, onDelete: actions.deleteOne };
    return isMobile ? <WebhookCardList {...listProps} /> : <WebhooksTable {...listProps} />;
  };

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="We send a POST to your endpoint each time a video changes status."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add endpoint
          </Button>
        }
      />

      <TwoColumnLayout
        main={
          <Card styles={{ body: { padding: 0 } }}>
            {renderList()}
            {page && page.total_pages > 1 && (
              <CursorPager
                pageIndex={pagination.pageIndex}
                totalPages={page.total_pages}
                hasPrevious={!!page.prev_cursor && pagination.pageIndex > 0}
                hasNext={!!page.next_cursor}
                onPrevious={() => pagination.prev(page)}
                onNext={() => pagination.next(page)}
              />
            )}
          </Card>
        }
        side={<WebhookGuideCard />}
      />

      <WebhookDialog
        open={dialog.open}
        webhook={dialog.open ? dialog.webhook : null}
        onClose={() => setDialog({ open: false })}
      />
    </>
  );
}

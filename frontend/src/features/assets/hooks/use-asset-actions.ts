import { App } from "antd";
import { errorMessage } from "@/shared/lib/errors";
import { notify } from "@/shared/lib/notify";
import { useDeleteAsset, useReprocessAsset } from "../api";

interface Target {
  id: string;
  title: string;
}

/**
 * Re-process and Delete, each behind a confirm dialog, with toasts for the
 * result. Used by the row menu, the bulk bar and the details page.
 */
export function useAssetActions() {
  const { modal } = App.useApp();
  const reprocess = useReprocessAsset();
  const remove = useDeleteAsset();

  const reprocessMany = (targets: Target[]) => {
    const single = targets.length === 1;
    modal.confirm({
      title: single ? `Re-process “${targets[0]!.title}”?` : `Re-process ${targets.length} videos?`,
      content: "Encoding starts again from the source file. The current files stay until it finishes.",
      okText: "Re-process",
      onOk: async () => {
        const results = await Promise.allSettled(
          targets.map((t) => reprocess.mutateAsync({ id: t.id })),
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === 0) {
          notify.success(single ? "Re-processing started" : `Re-processing ${targets.length} videos`);
        } else {
          const first = (failed[0] as PromiseRejectedResult).reason;
          notify.error(
            single
              ? `Couldn't re-process: ${errorMessage(first)}`
              : `${failed.length} of ${targets.length} couldn't be re-processed: ${errorMessage(first)}`,
          );
        }
      },
    });
  };

  const deleteOne = (target: Target, onDeleted?: () => void) => {
    modal.confirm({
      title: `Delete “${target.title}”?`,
      content: "The video and all its files are removed. Links to it stop working.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove.mutateAsync({ id: target.id });
          notify.success("Video deleted");
          onDeleted?.();
        } catch (err) {
          notify.error(`Couldn't delete the video: ${errorMessage(err)}`);
        }
      },
    });
  };

  return {
    reprocess: (target: Target) => reprocessMany([target]),
    reprocessMany,
    deleteOne,
  };
}

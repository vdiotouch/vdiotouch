import { App } from "antd";
import { errorMessage } from "@/shared/lib/errors";
import { notify } from "@/shared/lib/notify";
import { useDeleteWebhook } from "../api";
import type { Webhook } from "../types";

/** Delete behind a confirm dialog, with a toast for the result. */
export function useWebhookActions() {
  const { modal } = App.useApp();
  const remove = useDeleteWebhook();

  const deleteOne = (webhook: Webhook) => {
    modal.confirm({
      title: "Delete this endpoint?",
      content: `We stop sending events to ${webhook.url}.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove.mutateAsync({ id: webhook._id });
          notify.success("Endpoint deleted");
        } catch (err) {
          notify.error(`Couldn't delete the endpoint: ${errorMessage(err)}`);
        }
      },
    });
  };

  return { deleteOne };
}

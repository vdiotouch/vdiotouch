import * as React from "react";
import { Button, Checkbox, Form, Input, Modal } from "antd";
import { FormErrorAlert } from "@/components/feedback/form-error-alert";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { errorMessage } from "@/shared/lib/errors";
import { notify } from "@/shared/lib/notify";
import { useCreateWebhook, useUpdateWebhook } from "../api";
import type { Webhook } from "../types";

interface WebhookValues {
  url: string;
  secret?: string;
  removeSecret?: boolean;
}

interface WebhookDialogProps {
  open: boolean;
  /** The endpoint to edit; leave out to add a new one. */
  webhook?: Webhook | null;
  onClose: () => void;
}

const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** Add or edit an endpoint. An existing secret is never shown, only replaced or removed. */
export function WebhookDialog({ open, webhook, onClose }: WebhookDialogProps) {
  const { isMobile } = useResponsive();
  const [form] = Form.useForm<WebhookValues>();
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const [error, setError] = React.useState<string | null>(null);
  const removeSecret = Form.useWatch("removeSecret", form);

  const editing = !!webhook;
  const hasSecret = !!webhook?.secret_token;
  const saving = create.isPending || update.isPending;

  // The form unmounts on close (destroyOnHidden), so it opens fresh next time.
  const close = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async ({ url, secret, removeSecret }: WebhookValues) => {
    setError(null);
    const newSecret = secret?.trim() || null;
    try {
      if (webhook) {
        await update.mutateAsync({
          id: webhook._id,
          url: url.trim(),
          // Left out keeps the current secret; null removes it.
          ...(removeSecret ? { secret_token: null } : newSecret ? { secret_token: newSecret } : {}),
        });
        notify.success("Endpoint updated");
      } else {
        await create.mutateAsync({ url: url.trim(), secret_token: newSecret });
        notify.success("Endpoint added");
      }
      close();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the endpoint. Try again."));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      destroyOnHidden
      width={isMobile ? "100%" : 520}
      title={editing ? "Edit endpoint" : "Add endpoint"}
      footer={[
        <Button key="cancel" onClick={close} disabled={saving}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
          {editing ? "Save changes" : "Add endpoint"}
        </Button>,
      ]}
    >
      <FormErrorAlert message={error} />
      <Form<WebhookValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        initialValues={{ url: webhook?.url ?? "", secret: "", removeSecret: false }}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="url"
          label="Endpoint URL"
          extra="We send a POST request here each time a video or one of its files changes status."
          rules={[
            { required: true, message: "Enter the endpoint URL" },
            {
              validator: (_, value: string) =>
                !value || isHttpUrl(value.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error("Enter a full link, starting with https://")),
            },
          ]}
        >
          <Input autoFocus inputMode="url" placeholder="https://example.com/hooks/vdio" />
        </Form.Item>
        <Form.Item
          name="secret"
          label={hasSecret ? "New secret (optional)" : "Secret (optional)"}
          extra={
            hasSecret
              ? "Leave empty to keep the current secret."
              : "Sent with every request so you can check it came from us."
          }
        >
          <Input.Password autoComplete="new-password" disabled={saving || !!removeSecret} />
        </Form.Item>
        {hasSecret && (
          <Form.Item name="removeSecret" valuePropName="checked">
            <Checkbox>Remove the current secret</Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

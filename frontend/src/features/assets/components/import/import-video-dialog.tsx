import * as React from "react";
import { LinkOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Typography } from "antd";
import { FormErrorAlert } from "@/components/feedback/form-error-alert";
import { useResponsive } from "@/shared/hooks/use-responsive";
import { config } from "@/shared/lib/config";
import { errorMessage } from "@/shared/lib/errors";
import { notify } from "@/shared/lib/notify";
import { useCreateAsset } from "../../api";
import { SUPPORTED_FORMATS } from "../../constants";
import { ProcessingOption } from "./processing-option";
import styles from "./import-video-dialog.module.css";

interface ImportValues {
  sourceUrl: string;
  title?: string;
  withTranscoding: boolean;
  withTranscription: boolean;
}

const INITIAL_VALUES: ImportValues = {
  sourceUrl: "",
  title: "",
  withTranscoding: true,
  withTranscription: false,
};

interface ImportVideoDialogProps {
  open: boolean;
  onClose: () => void;
}

/** "Formats … Max file size 113 MB." The size part is left out when it isn't configured. */
function formatsHint() {
  const maxSize = config.maxVideoSizeMb;
  return maxSize ? `${SUPPORTED_FORMATS}. Max file size ${maxSize} MB.` : `${SUPPORTED_FORMATS}.`;
}

/**
 * Import a video from a public link (CreateAsset). Upload from device is
 * left out until the api's tus server is back on.
 */
export function ImportVideoDialog({ open, onClose }: ImportVideoDialogProps) {
  const { isMobile } = useResponsive();
  const [form] = Form.useForm<ImportValues>();
  const createAsset = useCreateAsset();
  const [error, setError] = React.useState<string | null>(null);

  // The form unmounts on close (destroyOnHidden), so it opens empty next time.
  const close = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (values: ImportValues) => {
    setError(null);
    try {
      await createAsset.mutateAsync({
        source_url: values.sourceUrl.trim(),
        title: values.title?.trim() || undefined,
        with_transcoding: values.withTranscoding,
        with_transcription: values.withTranscription,
      });
      notify.success("Import started. The video shows up in the list as it encodes.");
      close();
    } catch (err) {
      setError(errorMessage(err, "Couldn't start the import. Try again."));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      width={isMobile ? "100%" : 580}
      centered={!isMobile}
      className={isMobile ? styles.fullScreen : undefined}
      destroyOnHidden
      title={
        <>
          <div>Import a video</div>
          <Typography.Text type="secondary" className={styles.subtitle}>
            {formatsHint()}
          </Typography.Text>
        </>
      }
      footer={
        <Button
          type="primary"
          icon={<LinkOutlined />}
          loading={createAsset.isPending}
          onClick={() => form.submit()}
          block={isMobile}
        >
          {createAsset.isPending ? "Importing…" : "Import video"}
        </Button>
      }
    >
      <FormErrorAlert message={error} />
      <Form<ImportValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={INITIAL_VALUES}
        disabled={createAsset.isPending}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="sourceUrl"
          label="Video URL"
          extra="A direct, public link to the file. Pages like YouTube don't work."
          rules={[
            { required: true, message: "Enter the link to the video file" },
            { type: "url", message: "Enter a full link, starting with https://" },
          ]}
        >
          <Input
            autoFocus
            inputMode="url"
            placeholder="https://example.com/lecture.mp4"
            prefix={<LinkOutlined aria-hidden="true" />}
          />
        </Form.Item>
        <Form.Item name="title" label="Title">
          <Input placeholder="Taken from the file name if you leave this empty" />
        </Form.Item>

        <div className={styles.options}>
          <Form.Item name="withTranscoding" valuePropName="checked" noStyle>
            <ProcessingOption
              id="import-transcoding"
              title="Multiple resolutions"
              description="360p, 480p, 720p and 1080p, up to the source resolution."
            />
          </Form.Item>
          <Form.Item name="withTranscription" valuePropName="checked" noStyle>
            <ProcessingOption
              id="import-transcription"
              title="Transcript"
              description="Adds captions. Takes longer."
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

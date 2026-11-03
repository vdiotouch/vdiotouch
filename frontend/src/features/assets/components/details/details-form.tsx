import * as React from "react";
import { Form, Input, Select } from "antd";
import { useUpdateAsset } from "../../api";
import { changedFields, editableFields, hasChanges } from "../../lib/asset-edit";
import type { AssetDetails, AssetEditableFields } from "../../types";
import { SaveBar, type SaveState } from "./save-bar";

/**
 * Edit title, description and tags (UpdateAsset). Polling doesn't overwrite
 * what the user is typing: the form only takes the saved values on mount and
 * on Discard.
 */
export function DetailsForm({ asset }: { asset: AssetDetails }) {
  const [form] = Form.useForm<AssetEditableFields>();
  const update = useUpdateAsset();
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  const saved = editableFields(asset);
  const draft: AssetEditableFields = {
    title: Form.useWatch("title", form) ?? saved.title,
    description: Form.useWatch("description", form) ?? saved.description,
    tags: Form.useWatch("tags", form) ?? saved.tags,
  };
  const dirty = hasChanges(draft, saved);

  const handleSubmit = async (values: AssetEditableFields) => {
    setSaveState("saving");
    try {
      await update.mutateAsync({ id: asset._id, ...changedFields(values, saved) });
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  };

  const discard = () => {
    form.setFieldsValue(saved);
    setSaveState("idle");
  };

  return (
    <Form<AssetEditableFields>
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={saved}
      onFinish={handleSubmit}
      // A new edit after "Saved" or "Not saved" clears that message.
      onValuesChange={() => setSaveState((state) => (state === "saving" ? state : "idle"))}
    >
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, whitespace: true, message: "Enter a title" }]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Add a description" />
      </Form.Item>
      <Form.Item name="tags" label="Tags" extra="Press Enter or comma after each tag.">
        <Select
          mode="tags"
          placeholder="Add a tag"
          aria-label="Tags"
          tokenSeparators={[","]}
          open={false}
          suffixIcon={null}
        />
      </Form.Item>
      <SaveBar state={saveState} dirty={dirty} onDiscard={discard} />
    </Form>
  );
}

import type { AssetDetails, AssetEditableFields } from "../types";
import { assetTitle } from "./asset-title";

/** The saved values of the fields the details form edits. */
export function editableFields(asset: AssetDetails): AssetEditableFields {
  return {
    title: assetTitle(asset.title),
    description: asset.description ?? "",
    tags: asset.tags,
  };
}

function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

/** Only the fields that differ from `saved`, so untouched fields aren't rewritten. */
export function changedFields(
  draft: AssetEditableFields,
  saved: AssetEditableFields,
): Partial<AssetEditableFields> {
  const changes: Partial<AssetEditableFields> = {};
  if (draft.title.trim() !== saved.title) changes.title = draft.title.trim();
  if (draft.description !== saved.description) changes.description = draft.description;
  if (!sameTags(draft.tags, saved.tags)) changes.tags = draft.tags;
  return changes;
}

export function hasChanges(draft: AssetEditableFields, saved: AssetEditableFields) {
  return Object.keys(changedFields(draft, saved)).length > 0;
}

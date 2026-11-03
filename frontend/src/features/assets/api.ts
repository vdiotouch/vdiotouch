import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "@/shared/api/graphql";
import { config } from "@/shared/lib/config";
import type { Cursor } from "@/shared/lib/use-cursor-pagination";
import {
  CREATE_ASSET,
  DELETE_ASSET,
  GET_ASSET,
  GET_FILE_URL,
  LIST_ASSETS,
  REPROCESS_ASSET,
  UPDATE_ASSET,
} from "./queries";
import type { AssetDetails, AssetEditableFields, AssetList, CreateAssetInput } from "./types";

export const assetKeys = {
  all: ["assets"] as const,
  list: (vars: object) => ["assets", "list", vars] as const,
  detail: (id: string) => ["assets", "detail", id] as const,
};

/** One page of videos, refreshed every few seconds so statuses stay live. */
export function useAssets(cursor: Cursor, search: string) {
  const vars = { first: config.pageSize, search: search || undefined, ...cursor };
  return useQuery({
    queryKey: assetKeys.list(vars),
    queryFn: () => gql<AssetList>(LIST_ASSETS, vars),
    refetchInterval: config.pollIntervalMs,
    placeholderData: keepPreviousData,
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: assetKeys.detail(id),
    queryFn: () => gql<{ GetAsset: AssetDetails }>(GET_ASSET, { id }),
    refetchInterval: config.pollIntervalMs,
  });
}

/** A mutation that refreshes every asset query once it succeeds. */
function useAssetMutation<TVars extends object>(document: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => gql<unknown, TVars>(document, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

export const useCreateAsset = () => useAssetMutation<CreateAssetInput>(CREATE_ASSET);
export const useReprocessAsset = () => useAssetMutation<{ id: string }>(REPROCESS_ASSET);
export const useDeleteAsset = () => useAssetMutation<{ id: string }>(DELETE_ASSET);
export const useUpdateAsset = () =>
  useAssetMutation<{ id: string } & Partial<AssetEditableFields>>(UPDATE_ASSET);

/** Download URL for a thumbnail, source, download, audio or transcript file. */
export async function getFileUrl(id: string) {
  const data = await gql<{ GetFileUrl: string | null }>(GET_FILE_URL, { id });
  return data.GetFileUrl || null;
}

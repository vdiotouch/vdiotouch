import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "@/shared/api/graphql";
import type { Cursor } from "@/shared/lib/use-cursor-pagination";
import { WEBHOOK_PAGE_SIZE } from "./constants";
import { CREATE_WEBHOOK, DELETE_WEBHOOK, LIST_WEBHOOKS, UPDATE_WEBHOOK } from "./queries";
import type { CreateWebhookInput, UpdateWebhookInput, WebhookList } from "./types";

const webhookKeys = {
  all: ["webhooks"] as const,
  list: (vars: object) => ["webhooks", "list", vars] as const,
};

export function useWebhooks(cursor: Cursor) {
  const vars = { first: WEBHOOK_PAGE_SIZE, ...cursor };
  return useQuery({
    queryKey: webhookKeys.list(vars),
    queryFn: () => gql<WebhookList>(LIST_WEBHOOKS, vars),
    placeholderData: keepPreviousData,
  });
}

/** A mutation that refreshes the webhooks list once it succeeds. */
function useWebhookMutation<TVars extends object>(document: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => gql<unknown, TVars>(document, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhookKeys.all }),
  });
}

export const useCreateWebhook = () => useWebhookMutation<CreateWebhookInput>(CREATE_WEBHOOK);
export const useUpdateWebhook = () => useWebhookMutation<UpdateWebhookInput>(UPDATE_WEBHOOK);
export const useDeleteWebhook = () => useWebhookMutation<{ id: string }>(DELETE_WEBHOOK);

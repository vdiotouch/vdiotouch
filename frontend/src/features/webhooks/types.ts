import type { CursorPage } from "@/shared/lib/use-cursor-pagination";

export interface Webhook {
  _id: string;
  url: string;
  secret_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookList {
  ListWebhook: { webhooks: Webhook[]; page_info: CursorPage };
}

export interface CreateWebhookInput {
  url: string;
  secret_token: string | null;
}

/** `secret_token` left out keeps the current secret; null removes it. */
export interface UpdateWebhookInput {
  id: string;
  url: string;
  secret_token?: string | null;
}

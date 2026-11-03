export const WEBHOOK_PAGE_SIZE = 10;

/** Header the api sends the endpoint's secret in (webhook-notify-consumer.service.ts). */
export const SECRET_HEADER = "x-vdio-touch-key";

/** Event names the api sends; <status> is the new status in lower case. */
export const WEBHOOK_EVENTS = [
  { name: "asset.status.<status>", description: "A video changed status, e.g. asset.status.ready" },
  { name: "file.status.<status>", description: "One of its files changed status, e.g. a resolution" },
] as const;

/** Shape of an asset event body (webhook.service.ts publishAssetEvent). */
export const EXAMPLE_PAYLOAD = `{
  "event_type": "asset.status.ready",
  "data": {
    "asset_id": "66e1f0a9c2b14d0012a7be31",
    "status": "READY",
    "created_at": "2026-03-05T14:02:11.000Z",
    "updated_at": "2026-03-05T14:19:02.000Z"
  }
}`;

import type { ArchCategory } from "./componentData";

/**
 * A short, honest "how does this stage talk to its neighbors" label for the side panel's
 * "Communication protocol" field. `componentData.ts` doesn't carry a per-node protocol field
 * (its `technologies`/`performanceNotes` prose already implies this contextually), so rather
 * than inventing per-node specifics, this is one small category-level lookup — reviewable at a
 * glance, and easy to adjust if a category's real transport ever changes.
 */
export const PROTOCOL_BY_CATEGORY: Record<ArchCategory, string> = {
  source: "Git protocol / HTTPS webhook",
  gateway: "HTTPS (REST)",
  queue: "Redis pub/sub + task queue protocol",
  compute: "Internal task dispatch (Celery over Redis)",
  scanner: "Internal RPC (invoked as a Celery worker task)",
  intelligence: "Internal REST / in-process call",
  output: "HTTPS (REST) / webhook",
  storage: "PostgreSQL wire protocol",
};

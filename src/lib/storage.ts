import { IBucket } from "@/@types";

export const buckets = storage.defineItem<IBucket[]>("local:buckets", {
  fallback: [],
});

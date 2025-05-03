import { IBucket } from "@/@types";

export const buckets = storage.defineItem<Partial<IBucket[]>>("local:buckets", {
  fallback: [],
});

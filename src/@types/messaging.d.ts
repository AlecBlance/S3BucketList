import type { ProtocolWithReturn } from "webext-bridge";
import type { IBucket } from "./index";

declare module "webext-bridge" {
  export interface ProtocolMap {
    "buckets:remove": ProtocolWithReturn<string[], IBucket[]>;
  }
}

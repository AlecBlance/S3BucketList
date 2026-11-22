import type { ProtocolWithReturn } from "webext-bridge";
import type { IBucket } from "./index";

declare module "webext-bridge" {
  export interface ProtocolMap {
    "buckets:remove": ProtocolWithReturn<string[], IBucket[]>;
    "buckets:retry": ProtocolWithReturn<string, IBucket[]>;
    "buckets:annotate": ProtocolWithReturn<
      {
        hostname: string;
        notes: string;
        reviewStatus: NonNullable<IBucket["reviewStatus"]>;
      },
      IBucket[]
    >;
  }
}

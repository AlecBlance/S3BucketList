export interface IBucket {
  date: number;
  hostname: string;
  origin?: string;
  owner?: string | undefined;
  claimed?: boolean;
  permissions: IPermissions;
  public: boolean;
  initiator?: string;
  owned?: boolean;
  checkStatus?: "pending" | "checking" | "checked" | "failed";
  checkedAt?: number;
  recordId?: string;
  observations?: IBucketObservations;
  endpoint?: IS3Endpoint;
  access?: IAccessEvidence;
  notes?: string;
  reviewStatus?: "todo" | "expected" | "reported" | "fixed";
  reviewBaseline?: Partial<
    Record<
      "listing" | "acl" | "object" | "content",
      "allowed" | "denied" | "missing"
    >
  >;
  reviewGrantBaseline?: IAclPermissions;
  checkHistory?: ICheckSnapshot[];
  discovery?: "traffic" | "reference" | "manual";
  scanTrace?: IScanAttempt[];
  objectHead?: IAccessCheck;
  objectRead?: IAccessCheck;
}

export interface IS3Endpoint {
  key: string;
  hostname: string;
  kind: "virtual" | "path" | "website" | "custom";
  bucket?: string;
  region?: string;
  partition?: "aws" | "aws-cn" | "aws-us-gov";
  apiUrl?: string;
  object: boolean;
}

export interface IAccessCheck {
  result: "allowed" | "denied" | "missing" | "unknown" | "not-checked";
  at: number;
  status?: number;
  endpoint?: string;
  reason?: ScanReason;
  errorCode?: string;
  durationMs?: number;
  grants?: IAclPermissions;
  keysReturned?: 0 | 1;
}

export type ScanReason =
  | "confirmed"
  | "denied"
  | "missing-bucket"
  | "missing-object"
  | "network"
  | "timeout"
  | "cancelled"
  | "throttled"
  | "wrong-region"
  | "unexpected"
  | "too-large"
  | "unsupported";
export interface IScanAttempt {
  operation: "region" | "listing" | "acl" | "object" | "content" | "browse";
  method: "GET" | "HEAD";
  endpoint?: string;
  at: number;
  durationMs: number;
  status?: number;
  errorCode?: string;
  region?: string;
  reason: ScanReason;
}

export interface IAccessEvidence {
  listing?: IAccessCheck;
  acl?: IAccessCheck;
  file?: { at: number; context: "signed" | "browser"; status: number };
  signedLink?: boolean;
}

export interface ICheckSnapshot {
  id: string;
  at: number;
  state: "checked" | "failed";
  listing?: IAccessCheck;
  acl?: IAccessCheck;
  objectHead?: IAccessCheck;
  objectRead?: IAccessCheck;
  trace?: IScanAttempt[];
}

export interface ICheckJob {
  id: string;
  hostname: string;
  recordId?: string;
  state: "queued" | "running" | "done" | "failed" | "cancelled";
  attempts: number;
  createdAt: number;
  updatedAt: number;
  reason: "auto" | "manual";
}

export interface IPageReference {
  url: string;
  signed: boolean;
}

export interface IBucketObservations {
  firstSeen: number;
  lastSeen: number;
  sightings: number;
  sources: string[];
  endpoints: string[];
  lastStatus?: number;
  signedUrl: boolean;
  references?: number;
}

export interface IPermissions {
  AllUsers?: string[];
  AuthenticatedUsers?: string[];
  LogDelivery?: string[];
  ListBucket?: boolean;
}

export type IAclPermissions = Omit<IPermissions, "ListBucket">;
export interface ISettings {
  tabOnly: {
    enabled: boolean;
    tabIds: string[];
  };
}

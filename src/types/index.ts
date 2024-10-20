export type IBucketType = Record<string, IBucketInfo[]>;

export interface IBucketInfo {
  permissions: Record<string, string[]>;
  date: number;
  hostname: string;
  origin: string;
}
export type ILastSeen = Record<string, number>;

export interface IUseLastSeen {
  lastSeen: ILastSeen;
  addLastSeen: ({ type, date }: { type: string; date: number }) => void;
  setLastSeen: (lastSeen: ILastSeen) => void;
}

export interface IUseBuckets {
  buckets: IBucketType;
  setBuckets: (buckets: IBucketType) => void;
}

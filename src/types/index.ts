export interface IBucketInfo {
  type: string;
  permissions: Record<string, string[]>;
  date: number;
  hostname: string;
}
export interface ILastSeen {
  good: number;
  bad: number;
  error: number;
}

export interface IUseLastSeen {
  lastSeen: ILastSeen;
  addLastSeen: ({ type, date }: { type: string; date: number }) => void;
  setLastSeen: (lastSeen: ILastSeen) => void;
}

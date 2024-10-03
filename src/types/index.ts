export interface IBucketInfo {
  type: string;
  permissions: Record<string, string[]>;
  date: number;
  hostname: string;
}

export interface IBucket {
  date?: number;
  hostname?: string;
  origin?: string;
  owner?: string | undefined;
  claimed?: boolean;
  permissions?: IPermissions;
  public: boolean;
}

export interface IPermissions {
  AllUsers?: string[];
  AuthenticatedUsers?: string[];
  ListBucket?: boolean;
}

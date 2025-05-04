export interface IBucket {
  date?: number;
  hostname?: string;
  origin?: string;
  owner?: string | undefined;
  owned?: boolean;
  claimed?: boolean;
  permissions?: IPermissions;
  public: boolean;
}

export interface IPermissions {
  AllUsers?: string[];
  AuthenticatedUsers?: string[];
  ListBucket?: boolean;
}

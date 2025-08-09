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

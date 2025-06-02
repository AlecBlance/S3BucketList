export interface IBucket {
  date: number;
  hostname: string;
  origin?: string;
  owner?: string | undefined;
  owned?: boolean;
  claimed?: boolean;
  permissions: IPermissions;
  public: boolean;
  initiator?: string;
}

export interface IPermissions {
  AllUsers?: string[];
  AuthenticatedUsers?: string[];
  LogDelivery?: string[];
  ListBucket?: boolean;
}

export interface ISettings {
  tabOnly: {
    enabled: boolean;
    tabIds: string[];
  };
}

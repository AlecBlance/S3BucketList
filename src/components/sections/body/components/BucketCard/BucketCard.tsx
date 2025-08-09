import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IBucket } from "@/@types";
import OptionsDropdown from "./OptionsDropdown";
import useLastSeen from "@/lib/store/useLastSeen.store";

type BucketCardProps = Pick<
  IBucket,
  "hostname" | "initiator" | "permissions" | "date" | "owned"
>;

const BucketCard = ({
  hostname,
  initiator,
  permissions,
  date,
  owned,
}: BucketCardProps) => {
  const { lastSeen } = useLastSeen((state) => state);

  const labelMap: Record<string, string> = {
    AllUsers: "All",
    AuthenticatedUsers: "Auth",
    LogDelivery: "Log",
  };

  return (
    <div>
      <Card className="hover:bg-accent flex cursor-pointer flex-row items-start gap-0 py-4 transition-all duration-300 ease-in-out">
        <div className="grow space-y-2">
          <CardHeader className="flex items-center justify-between px-4">
            <CardTitle className="flex space-x-2 truncate text-sm">
              {lastSeen < date && <Badge>New</Badge>}
              {!owned && <Badge className="bg-red-500">Unclaimed</Badge>}
              <p className="truncate">{hostname}</p>{" "}
            </CardTitle>
            <OptionsDropdown hostname={hostname} />
          </CardHeader>
          <CardContent className="px-4">
            {initiator && (
              <p>
                <b className="text-primary">From:</b> {initiator}
              </p>
            )}

            <div className="flex flex-wrap gap-x-2">
              {["AllUsers", "AuthenticatedUsers", "LogDelivery"].map((key) => {
                const perms = permissions[key as keyof typeof permissions];
                return (
                  Array.isArray(perms) &&
                  perms.length > 0 && (
                    <p className="space-x-1" key={key}>
                      <b className="text-primary">{labelMap[key]}:</b>
                      {perms.map((perm: string) => (
                        <span key={perm}>{perm}</span>
                      ))}
                    </p>
                  )
                );
              })}
              {permissions.ListBucket && (
                <p>
                  <b className="text-primary">ListBucket:</b> true
                </p>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default BucketCard;

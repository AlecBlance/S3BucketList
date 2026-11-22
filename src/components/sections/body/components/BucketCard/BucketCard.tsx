import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IBucket } from "@/@types";
import OptionsDropdown from "./OptionsDropdown";
import useLastSeen from "@/lib/store/useLastSeen.store";
import { findingLabels } from "@/lib/bucket/findings";
import BucketDetails from "./BucketDetails";

type BucketCardProps = IBucket;

const BucketCard = (bucket: BucketCardProps) => {
  const { hostname, initiator, date, checkStatus, observations } = bucket;
  const { lastSeen } = useLastSeen((state) => state);

  return (
    <div>
      <Card className="hover:bg-accent flex cursor-pointer flex-row items-start gap-0 py-4 transition-all duration-300 ease-in-out">
        <div className="grow space-y-2">
          <CardHeader className="flex items-center justify-between px-4">
            <CardTitle className="flex space-x-2 truncate text-sm">
              {lastSeen < date && <Badge>New</Badge>}
              {checkStatus && (
                <Badge variant="secondary">
                  {
                    {
                      pending: "Not checked",
                      checking: "Checking",
                      checked: "Checked",
                      failed: "Check failed",
                    }[checkStatus]
                  }
                </Badge>
              )}
              <p className="truncate">{hostname}</p>{" "}
            </CardTitle>
            <OptionsDropdown
              hostname={hostname}
              checkStatus={checkStatus}
              endpoint={bucket.endpoint}
            />
          </CardHeader>
          <CardContent className="px-4">
            {initiator && (
              <p>
                <b className="text-primary">From:</b> {initiator}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {findingLabels(bucket).map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              {observations && (
                <p>
                  Seen {observations.sightings}{" "}
                  {observations.sightings === 1 ? "time" : "times"}
                </p>
              )}
              <BucketDetails bucket={bucket} />
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default BucketCard;

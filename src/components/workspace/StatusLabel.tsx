import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { STATUS_HELP } from "@/lib/bucket/status-help";
import { statusTone } from "@/lib/bucket/status-tone";
import "./status-label.css";

export default function StatusLabel({
  label,
  helpKey = label,
  className = "",
}: {
  label: string;
  helpKey?: string;
  className?: string;
}) {
  const explanation = STATUS_HELP[helpKey];
  return (
    <span
      className={`status-with-help ${className}`}
      data-tone={statusTone(helpKey)}
    >
      <span className="status-text">{label}</span>
      {explanation && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="status-info-button"
              aria-label={`About ${helpKey}`}
              title={explanation}
            >
              <Info size={13} aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="status-info-popover"
              sideOffset={7}
              collisionPadding={12}
              aria-label={`About ${helpKey}`}
            >
              <strong>{label}</strong>
              <p>{explanation}</p>
              <Popover.Arrow className="status-info-arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </span>
  );
}

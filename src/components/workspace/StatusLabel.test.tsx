import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StatusLabel from "./StatusLabel";
import { STATUS_HELP } from "@/lib/bucket/status-help";

describe("status explanations", () => {
  it.each(Object.keys(STATUS_HELP))(
    "gives %s a keyboard-accessible info button",
    (label) => {
      const html = renderToStaticMarkup(<StatusLabel label={label} />);
      expect(html).toContain(`aria-label="About ${label}"`);
      expect(html).toContain('type="button"');
      expect(html).toContain('aria-haspopup="dialog"');
      expect(html).toContain("title=");
    },
  );
  it("explains hidden bucket identity and unavailable checks without claiming every custom address is a CDN", () => {
    expect(STATUS_HELP["Bucket unknown"]).toContain("custom domain or CDN");
    expect(STATUS_HELP["Bucket unknown"]).toContain(
      "Check again is unavailable",
    );
    expect(STATUS_HELP["Bucket unknown"]).toContain(
      "does not mean the bucket is missing or vulnerable",
    );
  });
  it("allows operation-specific help for generic result labels", () => {
    const html = renderToStaticMarkup(
      <StatusLabel label="Blocked" helpKey="ACL blocked" />,
    );
    expect(html).toContain('aria-label="About ACL blocked"');
    expect(html).toContain("Listing and file access are separate permissions");
    expect(html).toContain('data-tone="denied"');
  });
});

import type { IPageReference } from "@/@types";

/** Self-contained so scripting.executeScript can inject it without dependencies. */
export function collectPageReferences(doc: Document = document): {
  origin: string;
  references: IPageReference[];
} {
  const found = new Map<string, IPageReference>();
  const inspect = (raw: string) => {
    if (found.size >= 200) return;
    try {
      const url = new URL(raw, doc.baseURI);
      if (!["http:", "https:"].includes(url.protocol)) return;
      if (!/\.amazonaws\.com(?:\.cn)?$/.test(url.hostname)) return;
      const prefix = url.hostname.replace(/\.amazonaws\.com(?:\.cn)?$/, "");
      const service = /^s3(?:[.-][a-z0-9-]+|\.dualstack\.[a-z0-9-]+)?$/.test(
        prefix,
      );
      const virtual = /^.+\.s3(?:[.-][a-z0-9.-]+)?$/.test(prefix);
      const website = /^.+\.s3-website[.-][a-z0-9-]+$/.test(prefix);
      if (!service && !virtual && !website) return;
      const bucket = service ? url.pathname.split("/")[1] : undefined;
      if (
        service &&
        (!bucket || !/^[a-z0-9][a-z0-9._-]{1,253}[a-z0-9]$/.test(bucket))
      )
        return;
      const safeUrl = `${url.protocol}//${url.hostname}/${bucket ? `${bucket}/` : ""}`;
      const signed = [...url.searchParams.keys()].some((key) =>
        [
          "x-amz-signature",
          "x-amz-credential",
          "signature",
          "awsaccesskeyid",
        ].includes(key.toLowerCase()),
      );
      found.set(safeUrl, {
        url: safeUrl,
        signed: signed || !!found.get(safeUrl)?.signed,
      });
    } catch {
      /* Ignore malformed references. */
    }
  };
  const nodes = Array.from(
    doc.querySelectorAll("a[href],link[href],[src]"),
  ).slice(0, 2000);
  for (const node of nodes) {
    const value = node.getAttribute("href") ?? node.getAttribute("src");
    if (value) inspect(value);
  }
  let bytes = 0;
  for (const script of Array.from(
    doc.querySelectorAll("script:not([src])"),
  ).slice(0, 100)) {
    const text = (script.textContent ?? "").slice(
      0,
      Math.max(0, 500_000 - bytes),
    );
    bytes += text.length;
    const normalized = text.replace(/\\\//g, "/");
    for (const match of normalized.matchAll(/https?:\/\/[^\s"'<>\\)]+/g))
      inspect(match[0]);
    if (bytes >= 500_000 || found.size >= 200) break;
  }
  let origin = "";
  try {
    origin = doc.location?.origin ?? new URL(doc.baseURI).origin;
  } catch {
    /* No source origin. */
  }
  return { origin, references: [...found.values()] };
}

import { describe, expect, it } from "vitest";
import { collectPageReferences } from "./extract";
describe("page reference extraction", () => {
  it("reads references without network requests, stripping paths and signed tokens", () => {
    const doc = {
      baseURI: "https://site.example/page",
      location: { origin: "https://site.example" },
      querySelectorAll(selector: string) {
        if (selector.startsWith("script"))
          return [
            {
              textContent:
                '{"url":"https:\\/\\/s3.us-west-2.amazonaws.com/other-bucket/private?X-Amz-Signature=SECRET"}',
            },
          ];
        return [
          {
            getAttribute: () =>
              "https://sample.s3.amazonaws.com/private?Signature=SECRET",
          },
          { getAttribute: () => "https://sample.s3.amazonaws.com/another" },
          { getAttribute: () => "https://not-s3.example/object" },
        ];
      },
    } as unknown as Document;
    const result = collectPageReferences(doc);
    expect(result.origin).toBe("https://site.example");
    expect(result.references).toHaveLength(2);
    expect(result.references).toContainEqual({
      url: "https://sample.s3.amazonaws.com/",
      signed: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|private|another/);
  });
});

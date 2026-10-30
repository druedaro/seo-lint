import type { Rule, RuleContext, Finding } from "../types.js";
import { querySelectorAll, getAttribute, getLocation, type Document } from "../parser.js";

const REQUIRED_OG_PROPERTIES = ["og:title", "og:description", "og:image"] as const;

export const ogTagsComplete: Rule = {
  meta: {
    id: "og-tags-complete",
    severity: "warning",
    category: "meta",
    description: "Page should have complete Open Graph tags (og:title, og:description, og:image).",
    docsUrl: "https://ogp.me/",
  },

  check(doc: Document, ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];

    const is404Page = ctx.filePath === "404.html" || /(^|\/)404(\/index)?\.html$/i.test(ctx.filePath);
    if (is404Page) {
      return findings;
    }

    const metas = querySelectorAll(doc, "meta");
    const isNoIndex = metas.some((el) => {
      const name = (getAttribute(el, "name") ?? "").toLowerCase();
      const content = (getAttribute(el, "content") ?? "").toLowerCase();
      return (name === "robots" || name === "googlebot") && (content.includes("noindex") || content.includes("none"));
    });
    if (isNoIndex) {
      return findings;
    }

    const ogMetas = new Map<string, { content: string; loc?: { line: number; column: number } }>();

    for (const meta of metas) {
      const prop = (getAttribute(meta, "property") ?? getAttribute(meta, "name"))?.trim().toLowerCase();
      if (!prop || !prop.startsWith("og:")) continue;

      const content = getAttribute(meta, "content") ?? "";
      const loc = getLocation(meta);

      if (!ogMetas.has(prop)) {
        ogMetas.set(prop, { content, loc });
      }
    }

    for (const prop of REQUIRED_OG_PROPERTIES) {
      const entry = ogMetas.get(prop);

      if (!entry) {
        findings.push({
          ruleId: "og-tags-complete",
          severity: ogTagsComplete.meta.severity,
          category: ogTagsComplete.meta.category,
          message: `Missing <meta property="${prop}"> tag.`,
          filePath: ctx.filePath,
        });
        continue;
      }

      const trimmedContent = entry.content.trim();

      if (trimmedContent.length === 0) {
        findings.push({
          ruleId: "og-tags-complete",
          severity: ogTagsComplete.meta.severity,
          category: ogTagsComplete.meta.category,
          message: `The "${prop}" tag has empty content.`,
          filePath: ctx.filePath,
          ...entry.loc,
        });
        continue;
      }

      if (prop === "og:image") {
        try {
          const parsed = new URL(trimmedContent);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            findings.push({
              ruleId: "og-tags-complete",
              severity: ogTagsComplete.meta.severity,
              category: ogTagsComplete.meta.category,
              message: `The "og:image" URL must use http or https protocol (got "${trimmedContent}").`,
              filePath: ctx.filePath,
              ...entry.loc,
            });
          }
        } catch {
          findings.push({
            ruleId: "og-tags-complete",
            severity: ogTagsComplete.meta.severity,
            category: ogTagsComplete.meta.category,
            message: `The "og:image" tag must be a valid absolute URL (got "${trimmedContent}").`,
            filePath: ctx.filePath,
            ...entry.loc,
          });
        }
      }
    }

    return findings;
  },
};

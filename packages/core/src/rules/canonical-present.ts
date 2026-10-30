import type { Rule, RuleContext, Finding } from "../types.js";
import { querySelectorAll, getAttribute, getLocation, type Document } from "../parser.js";

export const canonicalPresent: Rule = {
  meta: {
    id: "canonical-present",
    severity: "error",
    category: "meta",
    description: "Page must have a valid, absolute <link rel=\"canonical\"> element.",
    docsUrl: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
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

    const links = querySelectorAll(doc, "link");

    const canonicalLinks = links.filter((el) => {
      const rel = getAttribute(el, "rel");
      if (!rel) return false;
      return rel.toLowerCase().split(/\s+/).includes("canonical");
    });

    if (canonicalLinks.length === 0) {
      findings.push({
        ruleId: "canonical-present",
        severity: canonicalPresent.meta.severity,
        category: canonicalPresent.meta.category,
        message: "Missing <link rel=\"canonical\"> element.",
        filePath: ctx.filePath,
      });
      return findings;
    }

    if (canonicalLinks.length > 1) {
      for (const link of canonicalLinks.slice(1)) {
        const extraLoc = getLocation(link);
        findings.push({
          ruleId: "canonical-present",
          severity: canonicalPresent.meta.severity,
          category: canonicalPresent.meta.category,
          message: "Multiple <link rel=\"canonical\"> elements found.",
          filePath: ctx.filePath,
          ...extraLoc,
        });
      }
    }

    const firstCanonical = canonicalLinks[0]!;
    const rawHref = getAttribute(firstCanonical, "href");
    const loc = getLocation(firstCanonical);

    if (rawHref === undefined) {
      findings.push({
        ruleId: "canonical-present",
        severity: canonicalPresent.meta.severity,
        category: canonicalPresent.meta.category,
        message: "Canonical <link> element is missing an href attribute.",
        filePath: ctx.filePath,
        ...loc,
      });
      return findings;
    }

    const href = rawHref.trim();
    if (href.length === 0) {
      findings.push({
        ruleId: "canonical-present",
        severity: canonicalPresent.meta.severity,
        category: canonicalPresent.meta.category,
        message: "Canonical <link> element has an empty href attribute.",
        filePath: ctx.filePath,
        ...loc,
      });
      return findings;
    }

    try {
      const parsed = new URL(href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        findings.push({
          ruleId: "canonical-present",
          severity: canonicalPresent.meta.severity,
          category: canonicalPresent.meta.category,
          message: `Canonical URL must use http or https protocol (got "${href}").`,
          filePath: ctx.filePath,
          ...loc,
        });
      }
    } catch {
      findings.push({
        ruleId: "canonical-present",
        severity: canonicalPresent.meta.severity,
        category: canonicalPresent.meta.category,
        message: `Canonical URL must be a valid absolute URL (got "${href}").`,
        filePath: ctx.filePath,
        ...loc,
      });
    }

    return findings;
  },
};

import type { Rule, RuleContext, Finding } from "../types.js";
import {
  querySelectorAll,
  getAttribute,
  getLocation,
  type Document,
} from "../parser.js";
import * as path from "path";

export const noBrokenInternalLinks: Rule = {
  meta: {
    id: "no-broken-internal-links",
    severity: "error",
    category: "links",
    description:
      "Internal <a> links must point to existing files in the analysed dist folder.",
    docsUrl: "https://github.com/druedaro/seo-lint#no-broken-internal-links",
  },

  check(doc: Document, ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const anchors = querySelectorAll(doc, "a");
    for (const el of anchors) {
      const href = getAttribute(el, "href");
      if (!href) continue;
      const raw = href.trim();

      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("/")) continue;
      if (raw.startsWith("//")) continue;

      const cleanHref = raw.split(/[?#]/)[0];
      if (!cleanHref) continue;

      const baseDir = path.dirname(ctx.filePath);
      const normalizedPath = path.normalize(
        path.isAbsolute(cleanHref) ? cleanHref.slice(1) : path.join(baseDir, cleanHref)
      );

      const candidates = [
        normalizedPath,
        path.join(normalizedPath, "index.html"),
        normalizedPath.endsWith(".html") || normalizedPath.endsWith(".htm")
          ? normalizedPath
          : normalizedPath + ".html",
      ];

      const exists = candidates.some((cand) => ctx.allFiles.includes(cand));

      if (!exists) {
        const loc = getLocation(el);
        findings.push({
          ruleId: "no-broken-internal-links",
          severity: noBrokenInternalLinks.meta.severity,
          category: noBrokenInternalLinks.meta.category,
          message: `Internal link "${href}" points to a non‑existent file "${normalizedPath}".`,
          filePath: ctx.filePath,
          ...loc,
        });
      }
    }
    return findings;
  },
};

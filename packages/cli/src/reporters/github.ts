import type { LintResult } from "@seo-lint/core";

export function formatGithubReport(result: LintResult): string {
  const lines: string[] = [];

  for (const f of result.findings) {
    const level = f.severity === "error" ? "error" : "warning";
    const parts = [`file=${f.filePath}`];
    if (f.line !== undefined) parts.push(`line=${f.line}`);
    if (f.column !== undefined) parts.push(`col=${f.column}`);

    lines.push(`::${level} ${parts.join(",")}::${f.filePath}: [${f.ruleId}] ${f.message}`);
  }

  const errorCount = result.findings.filter((f) => f.severity === "error").length;
  const warningCount = result.findings.filter((f) => f.severity === "warning").length;

  if (result.findings.length === 0) {
    if (result.filesAnalysed === 0) {
      lines.push(
        "::warning::seo-lint: No HTML files found to audit. Did you build the project first? Check your target directory."
      );
    } else {
      lines.push(
        `seo-lint: No SEO/GEO problems found across ${result.filesAnalysed} files.`
      );
    }
  } else {
    lines.push(
      `seo-lint: Found ${errorCount} error(s) and ${warningCount} warning(s) across ${result.filesAnalysed} files.`
    );
  }

  const brokenLinksByHref = new Map<string, Set<string>>();
  for (const f of result.findings) {
    if (f.ruleId === "no-broken-internal-links") {
      const match = f.message.match(/Internal link "([^"]+)"/);
      const href = match?.[1];
      if (href) {
        const files = brokenLinksByHref.get(href) ?? new Set<string>();
        files.add(f.filePath);
        brokenLinksByHref.set(href, files);
      }
    }
  }

  for (const [href, files] of brokenLinksByHref) {
    if (files.size >= 3) {
      lines.push(
        `::notice::seo-lint tip: Broken link "${href}" is repeated across ${files.size} pages (likely in a shared Footer or Header component).`
      );
    }
  }

  return lines.join("\n") + "\n";
}

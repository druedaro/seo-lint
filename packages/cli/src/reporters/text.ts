import pc from "picocolors";
import type { Finding, LintResult } from "@seo-lint/core";

export function formatTextReport(result: LintResult): string {
  if (result.findings.length === 0) {
    if (result.filesAnalysed === 0) {
      return (
        pc.yellow("⚠") +
        " No HTML files found to audit. Did you build the project first? Check your target directory.\n"
      );
    }
    return (
      pc.green("✔") +
      ` No SEO or GEO problems found across ${result.filesAnalysed} file${result.filesAnalysed === 1 ? "" : "s"
      }.\n`
    );
  }

  const byFile = new Map<string, Finding[]>();
  for (const finding of result.findings) {
    const list = byFile.get(finding.filePath) ?? [];
    list.push(finding);
    byFile.set(finding.filePath, list);
  }

  const output: string[] = [];

  for (const [filePath, findings] of byFile) {
    output.push(pc.underline(filePath));

    for (const f of findings) {
      const pos =
        f.line !== undefined && f.column !== undefined
          ? `${f.line}:${f.column}`
          : "1:1";
      const padPos = pos.padEnd(8);
      const badge =
        f.severity === "error" ? pc.red("error  ") : pc.yellow("warning");
      const rule = pc.dim(f.ruleId);
      output.push(`  ${padPos}  ${badge}  ${f.message}  ${rule}`);
    }

    output.push("");
  }

  const errorCount = result.findings.filter((f) => f.severity === "error").length;
  const warningCount = result.findings.filter((f) => f.severity === "warning").length;
  const total = errorCount + warningCount;

  const summaryIcon = errorCount > 0 ? pc.red("✖") : pc.yellow("⚠");
  const summaryText = `${summaryIcon} ${total} problem${total === 1 ? "" : "s"} (${errorCount} error${errorCount === 1 ? "" : "s"
    }, ${warningCount} warning${warningCount === 1 ? "" : "s"}) across ${result.filesAnalysed
    } file${result.filesAnalysed === 1 ? "" : "s"}.`;


  output.push(summaryText);

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
      output.push(
        pc.cyan("ℹ Tip: ") +
        `Broken link "${href}" is repeated across ${files.size} pages (likely in a shared Footer or Header component).`
      );
    }
  }

  return output.join("\n") + "\n";
}

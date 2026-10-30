import * as fs from "fs";
import * as path from "path";
import { lintFiles, type LintResult, type SeoLintConfig } from "@seo-lint/core";

export interface ScanOptions {
  distDir: string;
  config?: SeoLintConfig;
  ignore?: string[];
}

const DEFAULT_IGNORES = [
  /^google[a-f0-9]{16}\.html$/i,
  /^BingSiteAuth\.xml$/i,
];

export function loadIgnoreFile(dir: string): string[] {
  const filePath = path.join(dir, ".seo-lintignore");
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
  } catch {
    return [];
  }
}

function matchPattern(relPath: string, pattern: string): boolean {
  if (!pattern) return false;
  const basename = path.basename(relPath);

  if (pattern.includes("*")) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
    const re = new RegExp(`^${escaped}$`, "i");
    return re.test(relPath) || re.test(basename);
  }

  return relPath === pattern || basename === pattern || relPath.includes(pattern);
}

function shouldIgnore(relPath: string, ignorePatterns: string[]): boolean {
  const basename = path.basename(relPath);
  if (DEFAULT_IGNORES.some((re) => re.test(basename))) {
    return true;
  }

  for (const pattern of ignorePatterns) {
    if (matchPattern(relPath, pattern)) {
      return true;
    }
  }
  return false;
}

function collectAllFiles(dir: string, baseDir: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectAllFiles(full, baseDir));
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, full).replace(/\\/g, "/");
      results.push(rel);
    }
  }

  return results;
}

export function scanAndLint(options: ScanOptions): LintResult {
  let { distDir, config, ignore = [] } = options;
  let absDist = path.resolve(distDir);

  if (!fs.existsSync(absDist)) {
    throw new Error(`Target directory does not exist: "${distDir}" (resolved: ${absDist})`);
  }

  if (!fs.existsSync(path.join(absDist, "index.html"))) {
    const clientSubdir = path.join(absDist, "client");
    const publicSubdir = path.join(absDist, "public");

    if (
      fs.existsSync(clientSubdir) &&
      fs.statSync(clientSubdir).isDirectory() &&
      (fs.existsSync(path.join(clientSubdir, "index.html")) ||
        fs.readdirSync(clientSubdir).some((f) => f.endsWith(".html") || f.endsWith(".htm")))
    ) {
      absDist = clientSubdir;
      distDir = path.join(distDir, "client");
    } else if (
      fs.existsSync(publicSubdir) &&
      fs.statSync(publicSubdir).isDirectory() &&
      (fs.existsSync(path.join(publicSubdir, "index.html")) ||
        fs.readdirSync(publicSubdir).some((f) => f.endsWith(".html") || f.endsWith(".htm")))
    ) {
      absDist = publicSubdir;
      distDir = path.join(distDir, "public");
    }
  }

  const fileIgnores = [
    ...loadIgnoreFile(process.cwd()),
    ...(absDist !== path.resolve(process.cwd()) ? loadIgnoreFile(absDist) : []),
  ];
  const mergedIgnore = Array.from(new Set([...ignore, ...fileIgnores]));

  const allFiles = collectAllFiles(absDist);
  const htmlRelPaths = allFiles
    .filter((f) => f.endsWith(".html") || f.endsWith(".htm"))
    .filter((f) => !shouldIgnore(f, mergedIgnore));

  const htmlFiles: Array<{ filePath: string; html: string }> = [];
  let isMultiLang = false;

  for (const rel of htmlRelPaths) {
    const full = path.join(absDist, rel);
    const content = fs.readFileSync(full, "utf-8");
    htmlFiles.push({ filePath: rel, html: content });

    if (!isMultiLang && /hreflang/i.test(content)) {
      isMultiLang = true;
    }
  }

  return lintFiles(htmlFiles, {
    allFiles,
    isMultiLang,
    config,
  });
}

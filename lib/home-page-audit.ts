import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

import {
  HOME_PAGE_AUTH_EXEMPT,
  HOME_PAGE_AUTH_MARKERS,
  HOME_PAGE_SPECS,
} from "@/lib/home-page-registry";

const HOME_APP_DIR = join(process.cwd(), "app", "(home)");

function collectPageFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectPageFiles(full));
    } else if (entry === "page.tsx") {
      results.push(full);
    }
  }
  return results;
}

export type HomePageAuditIssue = {
  pagePath: string;
  message: string;
};

/** Returns issues; empty array means all private pages have page-level authorization. */
export function auditHomePageAuthorization(): HomePageAuditIssue[] {
  if (!existsSync(HOME_APP_DIR)) {
    return [{ pagePath: "app/(home)", message: "Directory not found" }];
  }

  const issues: HomePageAuditIssue[] = [];
  const pageFiles = collectPageFiles(HOME_APP_DIR);
  const relativePages = pageFiles.map((f) =>
    relative(HOME_APP_DIR, f).replace(/\\/g, "/")
  );

  const specPaths = new Set(HOME_PAGE_SPECS.map((s) => s.pagePath));

  for (const rel of relativePages) {
    const full = join(HOME_APP_DIR, rel);
    const content = readFileSync(full, "utf8");
    const hasMarker = HOME_PAGE_AUTH_MARKERS.some((m) => content.includes(m));
    const isExempt = HOME_PAGE_AUTH_EXEMPT.has(rel);

    if (!specPaths.has(rel)) {
      issues.push({
        pagePath: `app/(home)/${rel}`,
        message: "Page missing from HOME_PAGE_SPECS registry",
      });
    }

    if (!isExempt && !hasMarker) {
      issues.push({
        pagePath: `app/(home)/${rel}`,
        message: `Missing page-level auth (${HOME_PAGE_AUTH_MARKERS.join(" or ")})`,
      });
    }
  }

  for (const spec of HOME_PAGE_SPECS) {
    if (!relativePages.includes(spec.pagePath)) {
      issues.push({
        pagePath: `app/(home)/${spec.pagePath}`,
        message: "Listed in registry but page file not found",
      });
    }
  }

  return issues;
}

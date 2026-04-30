#!/usr/bin/env python3
"""
F5.M1 catalog quality audit.

Walks every server in packages/* and reports drift / gaps that block
Registry submission and cross-platform listings. Produces a structured
markdown report on stdout (or to a file via --out).

Checks:

  1. server.json required fields ($schema, name, description, repository, version, packages)
  2. Naming convention — name=io.github.codespar/mcp-<slug>, package.identifier=@codespar/mcp-<slug>
  3. Repo URL canonicalization (mcp-dev-brasil → mcp-dev-latam)
  4. Provider block (homepage / logoUrl / docsUrl) for dashboard rendering
  5. README presence + required H2 sections (Tools, Authentication)
  6. Enterprise CTA presence (shipped 2026-04-29 — should be in every README)
  7. Tool count consistency — `## Tools (N)` README header vs declared tools
  8. Version consistency — server.json version matches package.json version

Exit code: 0 if no critical drift, 1 if any HIGH-severity finding.

Usage:
  python3 scripts/audit-catalog.py
  python3 scripts/audit-catalog.py --out docs/catalog-audit.md
  python3 scripts/audit-catalog.py --json | jq .
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = ROOT / "packages"

CANONICAL_REPO = "https://github.com/codespar/mcp-dev-latam"
LEGACY_REPO_RE = re.compile(r"mcp-dev-brasil")
NAME_PREFIX = "io.github.codespar/mcp-"
IDENT_PREFIX = "@codespar/mcp-"


@dataclass
class Finding:
    server: str
    severity: str  # "HIGH" | "MED" | "LOW"
    category: str
    detail: str


@dataclass
class Audit:
    findings: list[Finding] = field(default_factory=list)
    servers_seen: int = 0

    def add(
        self,
        server: str,
        severity: str,
        category: str,
        detail: str,
    ) -> None:
        self.findings.append(Finding(server, severity, category, detail))

    def by_category(self) -> dict[str, list[Finding]]:
        out: dict[str, list[Finding]] = defaultdict(list)
        for f in self.findings:
            out[f.category].append(f)
        return out


def discover_servers() -> list[Path]:
    """Every directory under packages/ with a server.json (skips
    node_modules + the shared helper package)."""
    out: list[Path] = []
    for sj in PACKAGES.glob("*/*/server.json"):
        if "node_modules" in sj.parts:
            continue
        out.append(sj.parent)
    out.sort()
    return out


def load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as err:
        return None


def server_slug(d: Path) -> str:
    """packages/payments/asaas → payments/asaas."""
    return f"{d.parent.name}/{d.name}"


REQUIRED_TOP_LEVEL = ["$schema", "name", "description", "repository", "version", "packages"]


def check_required_fields(audit: Audit, slug: str, sj: dict) -> None:
    for field_name in REQUIRED_TOP_LEVEL:
        if field_name not in sj:
            audit.add(
                slug, "HIGH", "1-required-fields",
                f"missing top-level `{field_name}`",
            )


def check_naming(audit: Audit, slug: str, sj: dict) -> None:
    name = sj.get("name", "")
    if name and not name.startswith(NAME_PREFIX):
        audit.add(
            slug, "HIGH", "2-naming",
            f"name `{name}` does not start with `{NAME_PREFIX}`",
        )
    pkgs = sj.get("packages") or []
    for i, pkg in enumerate(pkgs):
        ident = pkg.get("identifier", "") if isinstance(pkg, dict) else ""
        if ident and not ident.startswith(IDENT_PREFIX):
            audit.add(
                slug, "HIGH", "2-naming",
                f"packages[{i}].identifier `{ident}` does not start with `{IDENT_PREFIX}`",
            )


def check_repo_url(audit: Audit, slug: str, sj: dict) -> None:
    repo = sj.get("repository") or {}
    url = repo.get("url", "") if isinstance(repo, dict) else ""
    if LEGACY_REPO_RE.search(url):
        audit.add(
            slug, "MED", "3-repo-canonical",
            f"repository.url is on legacy `mcp-dev-brasil` (canonical is `mcp-dev-latam`): {url}",
        )
    elif url and url != CANONICAL_REPO:
        audit.add(
            slug, "LOW", "3-repo-canonical",
            f"repository.url drift: {url}",
        )


def check_provider_block(audit: Audit, slug: str, sj: dict) -> None:
    provider = sj.get("provider")
    if not provider or not isinstance(provider, dict):
        audit.add(
            slug, "MED", "4-provider-metadata",
            "no `provider` block — dashboard renders mono-initial fallback",
        )
        return
    if not provider.get("homepage"):
        audit.add(slug, "MED", "4-provider-metadata", "provider.homepage missing")
    if not provider.get("logoUrl") and not provider.get("logoFallback"):
        audit.add(slug, "MED", "4-provider-metadata", "no logoUrl or logoFallback")
    if not provider.get("docsUrl"):
        audit.add(slug, "LOW", "4-provider-metadata", "provider.docsUrl missing")


README_REQUIRED_SECTIONS = ["## Tools", "## Authentication"]


def check_readme(audit: Audit, slug: str, dir_path: Path) -> None:
    readme = dir_path / "README.md"
    if not readme.exists():
        audit.add(slug, "HIGH", "5-readme", "README.md missing")
        return
    text = readme.read_text(encoding="utf-8")
    if len(text) < 200:
        audit.add(slug, "MED", "5-readme", f"README.md is suspiciously short ({len(text)} chars)")
    for section in README_REQUIRED_SECTIONS:
        if section not in text:
            audit.add(slug, "MED", "5-readme", f"missing section header `{section}`")


def check_enterprise_cta(audit: Audit, slug: str, dir_path: Path) -> None:
    readme = dir_path / "README.md"
    if not readme.exists():
        return  # already flagged by 5-readme
    text = readme.read_text(encoding="utf-8")
    if "CodeSpar Enterprise" not in text:
        audit.add(
            slug, "LOW", "6-enterprise-cta",
            "README.md has no Enterprise CTA (shipped 2026-04-29 — should be present)",
        )


TOOL_COUNT_RE = re.compile(r"##\s+Tools\s*\((\d+)\)")


def check_tool_count(audit: Audit, slug: str, dir_path: Path, sj: dict) -> None:
    readme = dir_path / "README.md"
    if not readme.exists():
        return
    text = readme.read_text(encoding="utf-8")
    m = TOOL_COUNT_RE.search(text)
    if not m:
        # README doesn't declare a count — flag as LOW (cosmetic)
        audit.add(
            slug, "LOW", "7-tool-count",
            "README has no `## Tools (N)` header",
        )
        return
    declared = int(m.group(1))
    # Some servers list tools in server.json, others don't (the
    # canonical source is the package's own implementation). Skip
    # consistency check unless server.json carries `tools` array.
    tools = sj.get("tools")
    if isinstance(tools, list) and len(tools) != declared:
        audit.add(
            slug, "MED", "7-tool-count",
            f"README declares {declared} tools but server.json `tools` has {len(tools)}",
        )


def check_version_consistency(audit: Audit, slug: str, dir_path: Path, sj: dict) -> None:
    pjson = dir_path / "package.json"
    sj_version = sj.get("version", "")
    pkg_version = ""
    if pjson.exists():
        pjson_data = load_json(pjson) or {}
        pkg_version = pjson_data.get("version", "")
    pkgs = sj.get("packages") or []
    for i, pkg in enumerate(pkgs):
        if not isinstance(pkg, dict):
            continue
        pkg_v = pkg.get("version", "")
        if sj_version and pkg_v and pkg_v != sj_version:
            audit.add(
                slug, "MED", "8-version-consistency",
                f"server.json version=`{sj_version}` but packages[{i}].version=`{pkg_v}`",
            )
        if pkg_version and pkg_v and pkg_v != pkg_version:
            audit.add(
                slug, "MED", "8-version-consistency",
                f"package.json version=`{pkg_version}` but packages[{i}].version=`{pkg_v}`",
            )


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", help="Write report to file (default: stdout)")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown")
    args = parser.parse_args()

    audit = Audit()
    server_dirs = discover_servers()
    audit.servers_seen = len(server_dirs)

    for d in server_dirs:
        slug = server_slug(d)
        sj_path = d / "server.json"
        sj = load_json(sj_path)
        if sj is None:
            audit.add(slug, "HIGH", "1-required-fields", "server.json failed to parse")
            continue
        check_required_fields(audit, slug, sj)
        check_naming(audit, slug, sj)
        check_repo_url(audit, slug, sj)
        check_provider_block(audit, slug, sj)
        check_readme(audit, slug, d)
        check_enterprise_cta(audit, slug, d)
        check_tool_count(audit, slug, d, sj)
        check_version_consistency(audit, slug, d, sj)

    by_cat = audit.by_category()
    severities = {"HIGH": 0, "MED": 0, "LOW": 0}
    for f in audit.findings:
        severities[f.severity] += 1

    if args.json:
        out_text = json.dumps(
            {
                "servers_seen": audit.servers_seen,
                "summary": severities,
                "findings": [
                    {
                        "server": f.server,
                        "severity": f.severity,
                        "category": f.category,
                        "detail": f.detail,
                    }
                    for f in audit.findings
                ],
            },
            indent=2,
        )
    else:
        lines: list[str] = []
        lines.append("# Catalog quality audit — F5.M1\n")
        lines.append(f"_Generated by `scripts/audit-catalog.py`. Servers scanned: **{audit.servers_seen}**._\n")
        lines.append("## Summary\n")
        lines.append(f"- HIGH: **{severities['HIGH']}**")
        lines.append(f"- MED:  **{severities['MED']}**")
        lines.append(f"- LOW:  **{severities['LOW']}**")
        lines.append("")
        if not audit.findings:
            lines.append("✅ Clean run — no findings.\n")
        else:
            for category in sorted(by_cat.keys()):
                cat_findings = by_cat[category]
                lines.append(f"## {category} ({len(cat_findings)})\n")
                # Group by severity within the category
                for sev in ("HIGH", "MED", "LOW"):
                    sev_findings = [f for f in cat_findings if f.severity == sev]
                    if not sev_findings:
                        continue
                    lines.append(f"### {sev}\n")
                    for f in sev_findings:
                        lines.append(f"- `{f.server}` — {f.detail}")
                    lines.append("")
                lines.append("")
        out_text = "\n".join(lines)

    if args.out:
        Path(args.out).write_text(out_text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(out_text)

    return 1 if severities["HIGH"] > 0 else 0


if __name__ == "__main__":
    sys.exit(run())

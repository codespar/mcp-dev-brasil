import { describe } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

/**
 * Loads `<repo-root>/.env` (gitignored) so contract tests can read
 * credentials from process.env. No-op if the file or dotenv is absent.
 */
export async function loadContractEnv(): Promise<void> {
  const envPath = resolve(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return;
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: envPath });
  } catch {
    // dotenv not installed — leave process.env as-is
  }
}

export interface ParsedToolResult {
  isError: boolean;
  text: string;
  json: unknown | null;
}

/**
 * Normalizes an MCP tools/call result into { isError, text, json }.
 * Pure — no network, no env.
 */
export function parseToolResult(result: any): ParsedToolResult {
  const text: string = result?.content?.[0]?.text ?? "";
  let json: unknown | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { isError: result?.isError === true, text, json };
}

/**
 * describe block that is skipped unless `envVar` is set, and uses a
 * longer timeout (network calls). Mirrors describe.skipIf semantics.
 */
export function describeContract(
  name: string,
  envVar: string,
  fn: () => void,
): void {
  const has = !!process.env[envVar];
  const block = has ? describe : describe.skip;
  block(`${name} [contract]`, () => {
    fn();
  });
}

/**
 * Throws a clear, actionable error when a tool result indicates the
 * credential was rejected (HTTP 401/403 / unauthorized / forbidden), so a
 * bad/expired token fails loudly instead of looking like a generic contract
 * break. Pass a provider-specific `hint` to guide the user.
 */
export function assertCredentialAccepted(
  parsed: ParsedToolResult,
  hint?: string,
): void {
  if (parsed.isError && /\b40[13]\b|unauthorized|forbidden|invalid[_ ]?token/i.test(parsed.text)) {
    throw new Error(
      `The provider rejected the credential (got: ${parsed.text}).` +
        (hint ? ` ${hint}` : ""),
    );
  }
}

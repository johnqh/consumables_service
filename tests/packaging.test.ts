/**
 * The built package must be importable by Node ESM.
 *
 * TypeScript happily compiles `export * from "./schema"` into exactly that, and
 * Node ESM rejects a directory import — so the package built, published, and
 * type-checked cleanly while being unimportable by any ESM consumer. It was
 * found only when music_api tried to use it.
 *
 * Nothing else catches this: the source compiles, the unit tests import from
 * `src/` rather than `dist/`, and a bundler-based consumer resolves the
 * directory anyway. Hence a test over the build output.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = new URL("../dist", import.meta.url).pathname;

function jsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return jsFiles(full);
    return full.endsWith(".js") ? [full] : [];
  });
}

describe.skipIf(!existsSync(DIST))("built output", () => {
  it("gives every relative import a file extension", () => {
    const offenders: string[] = [];

    for (const file of jsFiles(DIST)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+"(\.[^"]*)"/g)) {
        const specifier = match[1];
        if (!specifier.endsWith(".js")) {
          offenders.push(`${file.replace(DIST, "dist")}: ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

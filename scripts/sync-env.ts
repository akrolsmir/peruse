#!/usr/bin/env bun

// Reads API keys from .env.local (auto-loaded by Bun) and sets them as Convex environment variables.

const ENV_KEYS = ["REPLICATE_API_TOKEN", "ANTHROPIC_API_KEY", "HUGGINGFACE_API_KEY"];

for (const key of ENV_KEYS) {
  const value = process.env[key];
  if (!value) {
    console.warn(`⚠ ${key} not found in environment, skipping`);
    continue;
  }
  const proc = Bun.spawnSync(["bunx", "convex", "env", "set", key, value], {
    cwd: import.meta.dirname + "/..",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode === 0) {
    console.log(`✓ ${key}`);
  } else {
    console.error(`✗ ${key} failed (exit ${proc.exitCode})`);
    process.exit(1);
  }
}

console.log("Done.");

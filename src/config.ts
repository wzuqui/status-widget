import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

let resolvedEnvPath: string | null = null;

function findEnvFile(appPath: string): string {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(appPath, '.env'),
    path.join(path.dirname(process.execPath), '.env'),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) return filePath;
  }

  return candidates[0];
}

function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    result[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return result;
}

export function loadEnvFile(appPath: string): void {
  resolvedEnvPath = findEnvFile(appPath);

  if (!existsSync(resolvedEnvPath)) return;

  const entries = parseEnvContent(readFileSync(resolvedEnvPath, 'utf8'));
  for (const [key, value] of Object.entries(entries)) {
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function readEnvConfig(): Record<string, string> {
  if (!resolvedEnvPath || !existsSync(resolvedEnvPath)) return {};
  return parseEnvContent(readFileSync(resolvedEnvPath, 'utf8'));
}

export function writeEnvConfig(updates: Record<string, string>): void {
  if (!resolvedEnvPath) return;

  const current = existsSync(resolvedEnvPath)
    ? parseEnvContent(readFileSync(resolvedEnvPath, 'utf8'))
    : {};

  const merged = { ...current, ...updates };

  const content = Object.entries(merged)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  writeFileSync(resolvedEnvPath, content + '\n', 'utf8');

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      process.env[key] = value;
    }
  }
}

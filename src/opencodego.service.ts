import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const FIVE_HOUR_LIMIT = 12; // $12

export type OpenCodeGoUsage = {
  usedPercent: number;
  reset_at: string | null;
  indicator: string;
};

export class OpenCodeGoService {
  private dbPath: string;

  constructor() {
    this.dbPath = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');
  }

  getFiveHourUsage(): OpenCodeGoUsage {
    const now = Date.now();
    const windowStart = now - FIVE_HOURS_MS;

    const scriptPath = join(process.cwd(), `opencodego_helper_${Date.now()}.js`);

    const script = `
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(${JSON.stringify(this.dbPath)}, sqlite3.OPEN_READONLY);
const windowStart = ${windowStart};

db.get(
  "SELECT COALESCE(SUM(json_extract(data, '$.cost')), 0) as totalCost FROM message WHERE json_extract(data, '$.providerID') = 'opencode-go' AND time_created > ?",
  [windowStart],
  (err, costRow) => {
    if (err) {
      console.error(JSON.stringify({ error: err.message }));
      db.close(() => process.exit(1));
      return;
    }
    db.get(
      "SELECT time_created FROM message WHERE json_extract(data, '$.providerID') = 'opencode-go' AND time_created > ? ORDER BY time_created ASC LIMIT 1",
      [windowStart],
      (err2, oldestRow) => {
        if (err2) {
          console.error(JSON.stringify({ error: err2.message }));
          db.close(() => process.exit(1));
          return;
        }
        console.log(JSON.stringify({ totalCost: costRow.totalCost, oldestTime: oldestRow ? oldestRow.time_created : null }));
        db.close(() => process.exit(0));
      }
    );
  }
);
`;

    try {
      writeFileSync(scriptPath, script, 'utf8');

      const output = execSync(`node "${scriptPath}"`, {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      }).trim();

      const result = JSON.parse(output) as { totalCost: number; oldestTime: number | null; error?: string };

      if (result.error) {
        throw new Error(result.error);
      }

      const totalCost = result.totalCost ?? 0;
      const usedPercent = (totalCost / FIVE_HOUR_LIMIT) * 100;

      let reset_at: string | null = null;
      if (result.oldestTime) {
        const resetTimestamp = result.oldestTime + FIVE_HOURS_MS;
        reset_at = new Date(resetTimestamp).toISOString();
      }

      return {
        usedPercent,
        reset_at,
        indicator: getUsageIndicator(usedPercent),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenCodeGo SQLite error: ${message}`);
    } finally {
      try {
        unlinkSync(scriptPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function getUsageIndicator(percentUsage: number): string {
  if (percentUsage <= 33) return '❄️';
  if (percentUsage <= 66) return '💨';
  return '🔥';
}

export const openCodeGoService = new OpenCodeGoService();

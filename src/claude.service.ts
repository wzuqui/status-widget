type ClaudeUsageResponse = {
  five_hour?: {
    utilization?: number;
    reset_at?: string;
    resets_at?: string;
  };
  seven_day?: {
    utilization?: number;
    reset_at?: string;
  };
};

export type ClaudeUsage = {
  utilization: number;
  sevenDayUtilization: number;
  resets_at: string | null;
  sevenDayReset_at: string | null;
  indicator: string;
  sevenDayIndicator: string;
};

export class ClaudeService {
  async getFiveHourUsage(): Promise<ClaudeUsage> {
    const data = await this.fetchUsage();
    const utilization = data.five_hour?.utilization;
    const sevenDayUtilization = data.seven_day?.utilization;

    if (typeof utilization !== 'number') {
      throw new Error('five_hour.utilization was not found in Claude response');
    }

    if (typeof sevenDayUtilization !== 'number') {
      throw new Error('seven_day.utilization was not found in Claude response');
    }

    return {
      utilization,
      sevenDayUtilization,
      resets_at: data.five_hour?.reset_at ?? data.five_hour?.resets_at ?? null,
      indicator: getUsageIndicator(utilization),
      sevenDayReset_at: data.seven_day?.reset_at ?? null,
      sevenDayIndicator: getUsageIndicator(sevenDayUtilization),
    };
  }

  private async fetchUsage(): Promise<ClaudeUsageResponse> {
    const response = await fetch(this.usageUrl, {
      headers: this.headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Claude usage request failed with status ${response.status}`);
    }

    return (await response.json()) as ClaudeUsageResponse;
  }

  private get usageUrl(): string {
    return `https://claude.ai/api/organizations/${this.organizationId}/usage`;
  }

  private get organizationId(): string {
    const organizationId = process.env.CLAUDE_ORGANIZATION_ID?.trim();
    if (!organizationId) {
      throw new Error('CLAUDE_ORGANIZATION_ID is not configured');
    }

    return organizationId;
  }

  private get headers(): HeadersInit {
    return {
      accept: '*/*',
      cookie: this.cookie,
      referer: 'https://claude.ai/settings/usage',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0',
    };
  }

  private get cookie(): string {
    const cookie = process.env.CLAUDE_COOKIE?.trim();
    if (!cookie) {
      throw new Error('CLAUDE_COOKIE is not configured');
    }

    return cookie;
  }
}

function getUsageIndicator(percentUsage: number): string {
  if (percentUsage <= 33) return '❄️';
  if (percentUsage <= 66) return '💨';
  return '🔥';
}

export const claudeService = new ClaudeService();

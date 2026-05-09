type StatusWidgetApi = {
  close: () => void;
  getCards: () => Promise<CardId[]>;
  getStatus: (id: 'claude' | 'codex' | 'opencodego') => Promise<StatusResponse>;
};

type CardId = 'claude' | 'codex' | 'opencodego';

type StatusResponse = {
  texto?: string;
  utilization?: number;
  sevenDayUtilization?: number;
  sevenDayReset_at?: string;
  sevenDayIndicator?: string;
  usedPercent?: number;
  secondaryWindowUsedPercent?: number;
  secondaryWindowReset_at?: string;
  secondaryWindowIndicator?: string;
  resets_at?: string;
  reset_at?: string;
  indicator?: string;
  error?: string;
  details?: string;
};

type StatusCard = {
  id: CardId;
  title: string;
  percentField: 'utilization' | 'usedPercent';
  indicatorField: 'indicator';
  resetField: 'resets_at' | 'reset_at';
  secondaryPercentField: 'sevenDayUtilization' | 'secondaryWindowUsedPercent';
  secondaryIndicatorField: 'sevenDayIndicator' | 'secondaryWindowIndicator';
  secondaryResetField: 'sevenDayReset_at' | 'secondaryWindowReset_at';
};

declare interface Window {
  statusWidget?: StatusWidgetApi;
}

const refreshMs = 5000;
const allCards: Record<CardId, StatusCard> = {
  claude: {
    id: 'claude',
    title: '.: Claude :.',
    percentField: 'utilization',
    indicatorField: 'indicator',
    resetField: 'resets_at',
    secondaryPercentField: 'sevenDayUtilization',
    secondaryIndicatorField: 'sevenDayIndicator',
    secondaryResetField: 'sevenDayReset_at',
  },
  codex: {
    id: 'codex',
    title: '.: Codex :.',
    percentField: 'usedPercent',
    indicatorField: 'indicator',
    resetField: 'reset_at',
    secondaryPercentField: 'secondaryWindowUsedPercent',
    secondaryIndicatorField: 'secondaryWindowIndicator',
    secondaryResetField: 'secondaryWindowReset_at',
  },
  opencodego: {
    id: 'opencodego',
    title: '.: OpenCodeGo :.',
    percentField: 'usedPercent',
    resetField: 'reset_at',
  },
};

let cards: StatusCard[] = Object.values(allCards);

function formatTimeRemaining(resetAtIso?: string): string {
  if (!resetAtIso) return '--';

  const diffMs = new Date(resetAtIso).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return '--';
  if (diffMs <= 0) return 'agora';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function getIndicator(percent: number): string {
  if (percent <= 33) return '❄️';
  if (percent <= 66) return '💨';
  return '🔥';
}

function parseTextFallback(text?: string): { percent?: number; reset?: string; indicator?: string } {
  if (!text) return {};

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const percentLine = lines.find((line) => line.includes('%')) || '';
  const percent = Number(percentLine.match(/(\d+(?:\.\d+)?)%/)?.[1]);
  const indicator = percentLine.match(/[❄️💨🔥]/u)?.[0];
  const reset = lines.find((line) => !line.includes('%') && !line.includes(':'));

  return {
    percent: Number.isFinite(percent) ? percent : undefined,
    reset,
    indicator,
  };
}

function setCardLoading(card: StatusCard): void {
  const root = document.querySelector<HTMLElement>(`[data-card="${card.id}"]`);
  if (!root) return;

  root.classList.remove('error');
  root.querySelector('[data-title]')!.textContent = card.title;
  root.querySelector('[data-percent]')!.textContent = '-- %';
  root.querySelector('[data-indicator]')!.textContent = '...';
  root.querySelector('[data-reset]')!.textContent = 'buscando';
  root.querySelector('[data-secondary-percent]')!.textContent = '-- %';
  root.querySelector('[data-secondary-indicator]')!.textContent = '...';
  root.querySelector('[data-secondary-reset]')!.textContent = 'buscando';
}

function setCardError(card: StatusCard, message: string): void {
  const root = document.querySelector<HTMLElement>(`[data-card="${card.id}"]`);
  if (!root) return;

  root.classList.add('error');
  root.querySelector('[data-title]')!.textContent = card.title;
  root.querySelector('[data-percent]')!.textContent = 'OFF';
  root.querySelector('[data-indicator]')!.textContent = '!';
  root.querySelector('[data-reset]')!.textContent = message.slice(0, 14);
  root.querySelector('[data-secondary-percent]')!.textContent = 'OFF';
  root.querySelector('[data-secondary-indicator]')!.textContent = '!';
  root.querySelector('[data-secondary-reset]')!.textContent = message.slice(0, 14);
}

function setCardStatus(card: StatusCard, payload: StatusResponse): void {
  const root = document.querySelector<HTMLElement>(`[data-card="${card.id}"]`);
  if (!root) return;

  const fallback = parseTextFallback(payload.texto);
  const rawPercent = payload[card.percentField];
  const percent = typeof rawPercent === 'number' ? rawPercent : fallback.percent;
  const secondaryPercent = payload[card.secondaryPercentField];
  const resetValue = payload[card.resetField];
  const resetText = resetValue ? formatTimeRemaining(resetValue) : fallback.reset || '--';
  const secondaryResetValue = payload[card.secondaryResetField];
  const secondaryResetText = secondaryResetValue ? formatTimeRemaining(secondaryResetValue) : '--';
  const indicator = payload[card.indicatorField] || fallback.indicator || (typeof percent === 'number' ? getIndicator(percent) : '--');
  const secondaryIndicator = payload[card.secondaryIndicatorField] || (typeof secondaryPercent === 'number' ? getIndicator(secondaryPercent) : '--');

  root.classList.remove('error');
  root.querySelector('[data-title]')!.textContent = card.title;
  root.querySelector('[data-percent]')!.textContent = typeof percent === 'number' ? `${Math.round(percent)} %` : '-- %';
  root.querySelector('[data-indicator]')!.textContent = indicator;
  root.querySelector('[data-reset]')!.textContent = resetText;
  root.querySelector('[data-secondary-percent]')!.textContent = typeof secondaryPercent === 'number' ? `${Math.round(secondaryPercent)} %` : '-- %';
  root.querySelector('[data-secondary-indicator]')!.textContent = secondaryIndicator;
  root.querySelector('[data-secondary-reset]')!.textContent = secondaryResetText;
}

function buildCard(card: StatusCard): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card';
  section.dataset.card = card.id;
  section.innerHTML = `
    <div class="title" data-title>${card.title}</div>
    <div class="metric">
      <div class="usage">
        <span data-percent>-- %</span>
        <span class="indicator" data-indicator>...</span>
      </div>
      <div class="reset" data-reset>buscando</div>
    </div>
    <div class="metric-divider"></div>
    <div class="metric">
      <div class="usage">
        <span data-secondary-percent>-- %</span>
        <span class="indicator" data-secondary-indicator>...</span>
      </div>
      <div class="reset" data-secondary-reset>buscando</div>
    </div>
  `;

  return section;
}

function renderCards(enabledCards: StatusCard[]): void {
  const container = document.querySelector<HTMLElement>('[data-cards]');
  if (!container) return;

  container.replaceChildren(...enabledCards.map(buildCard));
  document.body.dataset.cardCount = String(enabledCards.length);
}

async function refreshCard(card: StatusCard): Promise<void> {
  try {
    if (!window.statusWidget) {
      throw new Error('Electron bridge unavailable');
    }

    const payload = await window.statusWidget.getStatus(card.id);
    setCardStatus(card, payload);
  } catch (error) {
    setCardError(card, error instanceof Error ? error.message : 'erro');
  }
}

function refreshAll(): void {
  for (const card of cards) {
    void refreshCard(card);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const enabledCardIds = await window.statusWidget?.getCards();
    if (enabledCardIds?.length) {
      cards = enabledCardIds.map((id) => allCards[id]).filter(Boolean);
    }
  } catch {
    cards = Object.values(allCards);
  }

  renderCards(cards);

  for (const card of cards) {
    setCardLoading(card);
  }

  document.querySelector('[data-close]')?.addEventListener('click', () => {
    window.statusWidget?.close();
  });

  refreshAll();
  window.setInterval(refreshAll, refreshMs);
});

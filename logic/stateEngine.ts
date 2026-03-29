const DEFAULT_DISTRACTIONS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'reddit.com',
  'netflix.com',
  'tiktok.com'
];

export function normalizeDomain(input: string): string {
  if (!input) return '';

  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/^www\./, '');
  value = value.split('/')[0];

  return value;
}

export function extractDomain(url: string): string {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);
    return normalizeDomain(parsed.hostname);
  } catch {
    return normalizeDomain(url);
  }
}

export async function isDistractingDomain(domain: string, blockedDomains: string[]): Promise<boolean> {
  const cleanDomain = normalizeDomain(domain);

  if (!cleanDomain) return false;

  const normalizedBlocked = blockedDomains.map(normalizeDomain);

  const matchDomain = (candidate: string, target: string) => {
    return candidate === target || candidate.endsWith(`.${target}`);
  };

  const inDefaultList = DEFAULT_DISTRACTIONS.some((item) => matchDomain(cleanDomain, item));
  const inBlockedList = normalizedBlocked.some((item) => matchDomain(cleanDomain, item));

  return inDefaultList || inBlockedList;
}

export interface Metrics {
  totalEvents: number;
  distractingEvents: number;
  distractingDomainsSeen: Set<string>;
  productiveDomainsSeen: Set<string>;
  activeTimeSeconds: number;
}

export function buildMetrics(events: any[]): Metrics {
  const distractingDomainsSeen = new Set<string>();
  const productiveDomainsSeen = new Set<string>();
  let distractingEvents = 0;
  let activeTimeSeconds = 0;

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];

    if (event.is_distracting) {
      distractingEvents++;
      distractingDomainsSeen.add(event.domain);
    } else {
      productiveDomainsSeen.add(event.domain);
    }

    const nextEvent = sortedEvents[i + 1];

    if (nextEvent) {
      const gapMs = nextEvent.timestamp - event.timestamp;
      const clampedGapMs = Math.max(0, Math.min(gapMs, 60_000));
      activeTimeSeconds += Math.floor(clampedGapMs / 1000);
    } else {
      activeTimeSeconds += 10;
    }
  }

  return {
    totalEvents: sortedEvents.length,
    distractingEvents,
    distractingDomainsSeen,
    productiveDomainsSeen,
    activeTimeSeconds,
  };
}

export function classifyState(metrics: Metrics): string {
  if (metrics.totalEvents === 0) return 'IDLE';

  const distractionRatio = metrics.distractingEvents / metrics.totalEvents;

  if (metrics.totalEvents >= 3 && distractionRatio >= 0.5) {
    return 'DISTRACTED';
  }

  if (metrics.totalEvents >= 3 && distractionRatio >= 0.2) {
    return 'UNFOCUSED';
  }

  return 'FOCUS';
}

export function recommendationForState(state: string): string {
  switch (state) {
    case 'FOCUS':
      return "You're doing great. Keep going.";
    case 'UNFOCUSED':
      return 'You are starting to drift. Try closing extra tabs.';
    case 'DISTRACTED':
      return 'You are getting pulled away. Reset and return to one task.';
    default:
      return 'Ready to begin a focused session?';
  }
}
/**
 * Anonymous choice logging for the Control Room.
 *
 * Prototype storage is localStorage only; the shapes below are the wire
 * schema for the eventual `POST /api/telemetry` backend (append-only, one
 * completed session per request — see data/scenarios/README.md). No PII: the
 * only identifier is a random UUID that never leaves this browser.
 */

export type ChoiceEvent = {
  timestepId: string;
  optionId: string;
  presentedAt: number;
  chosenAt: number;
  hesitationMs: number;
  warningScope: 'none' | 'targeted' | 'province';
  divergedFromHistory: boolean;
};

export type SessionScore = {
  leadTimeMinutes: number | null;
  coverage: number;
  falseAlarmWeight: number;
  divergence: number;
};

export type SessionLog = {
  sessionId: string;
  scenarioId: string;
  startedAt: number;
  completedAt: number | null;
  events: ChoiceEvent[];
  score: SessionScore | null;
};

type Store = { v: 1; player: string; sessions: SessionLog[] };

const KEY = 'cc-control-room-log-v1';
const MAX_SESSIONS = 200;

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.v === 1 && Array.isArray(parsed.sessions)) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt — start fresh in memory */
  }
  return { v: 1, player: uuid(), sessions: [] };
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota or privacy mode: the game must never break over telemetry */
  }
}

export function startSession(scenarioId: string): SessionLog {
  const session: SessionLog = {
    sessionId: uuid(),
    scenarioId,
    startedAt: Date.now(),
    completedAt: null,
    events: [],
    score: null,
  };
  const store = load();
  store.sessions.push(session);
  if (store.sessions.length > MAX_SESSIONS) store.sessions.splice(0, store.sessions.length - MAX_SESSIONS);
  save(store);
  return session;
}

function update(sessionId: string, fn: (s: SessionLog) => void) {
  const store = load();
  const session = store.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return;
  fn(session);
  save(store);
}

export function logChoice(sessionId: string, event: ChoiceEvent) {
  update(sessionId, (s) => s.events.push(event));
}

export function completeSession(sessionId: string, score: SessionScore) {
  update(sessionId, (s) => {
    s.completedAt = Date.now();
    s.score = score;
  });
}

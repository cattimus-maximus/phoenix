import { useCallback, useSyncExternalStore } from "react";

/**
 * Saved views are the deliberate, named counterpart to recent searches: a
 * user promotes a filter they return to often into a stable, labeled entry
 * instead of relying on the ephemeral, auto-captured history. Persisted to
 * localStorage per mount point, mirroring the history hook's scheme so the two
 * sit side by side without stepping on each other.
 */

const LOCAL_STORAGE_KEY_PREFIX = "arize-phoenix-filter-saved-views";

/**
 * Upper bound on stored views. High enough that no real user hits it, low
 * enough that a runaway writer can't bloat localStorage without bound.
 */
const DEFAULT_CAPACITY = 24;

/**
 * A named, user-saved filter. `id` is stable across renames so the UI can key
 * on it; `name` is the label the user typed; `condition` is the DSL text;
 * `createdAt` is an ISO timestamp used only for stable ordering.
 */
export type DSLFilterSavedView = {
  id: string;
  name: string;
  condition: string;
  createdAt: string;
};

/**
 * The localStorage key a mount point's saved views are persisted under. Shares
 * the `historyKey` convention (e.g. `span-filter-${projectId}`) so views are
 * scoped to the same data as recent searches.
 */
export function getDSLFilterSavedViewsStorageKey(historyKey: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}-${historyKey}`;
}

function isSavedView(value: unknown): value is DSLFilterSavedView {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.condition === "string" &&
    typeof record.createdAt === "string"
  );
}

/**
 * Reads persisted saved views, tolerating missing, malformed, or foreign
 * values — like recent searches, saved views are a progressive enhancement and
 * a corrupt entry must never throw or discard the rest of the list.
 */
export function readDSLFilterSavedViews(storageKey: string): DSLFilterSavedView[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSavedView);
  } catch {
    return [];
  }
}

function writeDSLFilterSavedViews(
  storageKey: string,
  views: DSLFilterSavedView[]
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(views));
  } catch {
    // localStorage full or unavailable — degrade silently
  }
  // localStorage's own `storage` event does not fire in the tab that made the
  // write, so notify same-tab subscribers (this hook's other mounts) directly.
  notifySavedViewsChanged(storageKey);
}

// A per-key subscriber registry so `useSyncExternalStore` can react to writes
// made in this same tab (the browser's `storage` event only reaches *other*
// tabs). Keeping this at module scope lets sibling mounts sharing a key — e.g.
// the spans and traces tabs — stay in sync without a shared React provider.
const savedViewsListeners = new Map<string, Set<() => void>>();

function notifySavedViewsChanged(storageKey: string): void {
  savedViewsListeners.get(storageKey)?.forEach((listener) => listener());
}

function subscribeToSavedViews(
  storageKey: string,
  onChange: () => void
): () => void {
  let listeners = savedViewsListeners.get(storageKey);
  if (!listeners) {
    listeners = new Set();
    savedViewsListeners.set(storageKey, listeners);
  }
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) {
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    listeners?.delete(onChange);
    if (listeners && listeners.size === 0) {
      savedViewsListeners.delete(storageKey);
    }
  };
}

// `useSyncExternalStore` demands a referentially stable snapshot: returning a
// fresh array every read would loop it forever. Cache the parsed list keyed by
// the exact raw string so identity only changes when the stored bytes do.
const savedViewsSnapshotCache = new Map<
  string,
  { raw: string | null; value: DSLFilterSavedView[] }
>();

const EMPTY_SAVED_VIEWS: DSLFilterSavedView[] = [];

function getSavedViewsSnapshot(storageKey: string): DSLFilterSavedView[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    raw = null;
  }
  const cached = savedViewsSnapshotCache.get(storageKey);
  if (cached && cached.raw === raw) {
    return cached.value;
  }
  const value = raw === null ? EMPTY_SAVED_VIEWS : readDSLFilterSavedViews(storageKey);
  savedViewsSnapshotCache.set(storageKey, { raw, value });
  return value;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Returns the list with `view` inserted at the front, replacing any existing
 * view whose name matches case-insensitively (so re-saving under a known name
 * updates it in place rather than spawning a near-duplicate) and capped at
 * `capacity`.
 */
export function upsertDSLFilterSavedView(
  views: DSLFilterSavedView[],
  view: DSLFilterSavedView,
  capacity: number = DEFAULT_CAPACITY
): DSLFilterSavedView[] {
  const target = normalizeName(view.name);
  return [
    view,
    ...views.filter((existing) => normalizeName(existing.name) !== target),
  ].slice(0, capacity);
}

/**
 * Returns the list with the view of the given id removed.
 */
export function removeDSLFilterSavedView(
  views: DSLFilterSavedView[],
  id: string
): DSLFilterSavedView[] {
  return views.filter((view) => view.id !== id);
}

function createId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the timestamp-based id
  }
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type UseDSLFilterSavedViewsProps = {
  /**
   * Scopes the saved views to their mount point — shares the `historyKey`
   * convention with recent searches (e.g. `span-filter-${projectId}`).
   */
  historyKey: string;
  /**
   * How many saved views to keep
   */
  capacity?: number;
};

export type DSLFilterSavedViews = {
  /**
   * The saved views, newest first.
   */
  savedViews: DSLFilterSavedView[];
  /**
   * Saves `condition` under `name`, replacing any existing view with the same
   * (case-insensitive) name. Returns the saved view, or null when either the
   * name or the condition is blank.
   */
  saveView: (name: string, condition: string) => DSLFilterSavedView | null;
  /**
   * Deletes the saved view with the given id.
   */
  deleteView: (id: string) => void;
};

/**
 * Manages a per-mount-point list of named saved filters in localStorage. The
 * companion to `useDSLFilterConditionHistory`: history captures what the user
 * ran; saved views hold what they chose to keep. State is held in React and
 * written through to storage on every mutation, and a `storage` listener keeps
 * sibling mounts (e.g. the spans and traces tabs sharing a key) in sync.
 */
export function useDSLFilterSavedViews({
  historyKey,
  capacity = DEFAULT_CAPACITY,
}: UseDSLFilterSavedViewsProps): DSLFilterSavedViews {
  const storageKey = getDSLFilterSavedViewsStorageKey(historyKey);
  const savedViews = useSyncExternalStore(
    (onChange) => subscribeToSavedViews(storageKey, onChange),
    () => getSavedViewsSnapshot(storageKey)
  );

  const saveView = useCallback(
    (name: string, condition: string): DSLFilterSavedView | null => {
      const trimmedName = name.trim();
      const trimmedCondition = condition.trim();
      if (trimmedName === "" || trimmedCondition === "") {
        return null;
      }
      const view: DSLFilterSavedView = {
        id: createId(),
        name: trimmedName,
        condition: trimmedCondition,
        createdAt: new Date().toISOString(),
      };
      // Read-modify-write against storage rather than a state snapshot so a
      // sibling mount's concurrent save is not clobbered.
      const next = upsertDSLFilterSavedView(
        readDSLFilterSavedViews(storageKey),
        view,
        capacity
      );
      writeDSLFilterSavedViews(storageKey, next);
      return view;
    },
    [storageKey, capacity]
  );

  const deleteView = useCallback(
    (id: string) => {
      const next = removeDSLFilterSavedView(
        readDSLFilterSavedViews(storageKey),
        id
      );
      writeDSLFilterSavedViews(storageKey, next);
    },
    [storageKey]
  );

  return { savedViews, saveView, deleteView };
}

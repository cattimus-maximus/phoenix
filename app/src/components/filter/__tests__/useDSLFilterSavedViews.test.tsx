import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import {
  type DSLFilterSavedView,
  type DSLFilterSavedViews,
  getDSLFilterSavedViewsStorageKey,
  readDSLFilterSavedViews,
  removeDSLFilterSavedView,
  upsertDSLFilterSavedView,
  useDSLFilterSavedViews,
  type UseDSLFilterSavedViewsProps,
} from "../useDSLFilterSavedViews";

installTestStorage();

const HISTORY_KEY = "test-filter";
const STORAGE_KEY = getDSLFilterSavedViewsStorageKey(HISTORY_KEY);

function view(overrides: Partial<DSLFilterSavedView> = {}): DSLFilterSavedView {
  return {
    id: "id-1",
    name: "Errors",
    condition: "status_code == 'ERROR'",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("readDSLFilterSavedViews", () => {
  beforeEach(() => localStorage.clear());

  it("returns an empty list when nothing is stored", () => {
    expect(readDSLFilterSavedViews(STORAGE_KEY)).toEqual([]);
  });

  it("tolerates malformed, foreign, and partial values", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(readDSLFilterSavedViews(STORAGE_KEY)).toEqual([]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(readDSLFilterSavedViews(STORAGE_KEY)).toEqual([]);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        view(),
        42,
        null,
        { id: "x", name: "missing condition" },
      ])
    );
    expect(readDSLFilterSavedViews(STORAGE_KEY)).toEqual([view()]);
  });
});

describe("upsertDSLFilterSavedView", () => {
  it("adds the newest view first", () => {
    const a = view({ id: "a", name: "A" });
    const b = view({ id: "b", name: "B" });
    expect(upsertDSLFilterSavedView([a], b)).toEqual([b, a]);
  });

  it("replaces a view with the same name case-insensitively", () => {
    const existing = view({
      id: "old",
      name: "Errors",
      condition: "status_code == 'ERROR'",
    });
    const replacement = view({
      id: "new",
      name: "errors",
      condition: "status_code == 'ERROR' and span_kind == 'LLM'",
    });
    expect(upsertDSLFilterSavedView([existing], replacement)).toEqual([
      replacement,
    ]);
  });

  it("drops the oldest entries beyond the capacity", () => {
    const a = view({ id: "a", name: "A" });
    const b = view({ id: "b", name: "B" });
    const c = view({ id: "c", name: "C" });
    expect(upsertDSLFilterSavedView([a, b], c, 2)).toEqual([c, a]);
  });
});

describe("removeDSLFilterSavedView", () => {
  it("removes the view of the given id", () => {
    const a = view({ id: "a", name: "A" });
    const b = view({ id: "b", name: "B" });
    expect(removeDSLFilterSavedView([a, b], "a")).toEqual([b]);
  });
});

describe("useDSLFilterSavedViews", () => {
  let root: Root | null = null;
  let hook: DSLFilterSavedViews;

  function Harness(props: UseDSLFilterSavedViewsProps) {
    hook = useDSLFilterSavedViews(props);
    return null;
  }

  function mountHarness(
    props: UseDSLFilterSavedViewsProps = { historyKey: HISTORY_KEY }
  ) {
    root = createRoot(document.createElement("div"));
    act(() => {
      root?.render(<Harness {...props} />);
    });
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
  });

  it("saves a view and persists it", () => {
    mountHarness();
    act(() => {
      hook.saveView("Errors", "status_code == 'ERROR'");
    });

    expect(hook.savedViews).toHaveLength(1);
    expect(hook.savedViews[0]).toMatchObject({
      name: "Errors",
      condition: "status_code == 'ERROR'",
    });
    expect(readDSLFilterSavedViews(STORAGE_KEY)).toHaveLength(1);
  });

  it("refuses to save a blank name or blank condition", () => {
    mountHarness();
    let saved: DSLFilterSavedView | null = null;
    act(() => {
      saved = hook.saveView("   ", "status_code == 'ERROR'");
    });
    expect(saved).toBeNull();
    act(() => {
      saved = hook.saveView("Errors", "   ");
    });
    expect(saved).toBeNull();
    expect(hook.savedViews).toEqual([]);
  });

  it("re-saving a name updates the existing view rather than duplicating", () => {
    mountHarness();
    act(() => {
      hook.saveView("Errors", "status_code == 'ERROR'");
    });
    act(() => {
      hook.saveView("errors", "status_code == 'ERROR' and span_kind == 'LLM'");
    });

    expect(hook.savedViews).toHaveLength(1);
    expect(hook.savedViews[0].condition).toBe(
      "status_code == 'ERROR' and span_kind == 'LLM'"
    );
  });

  it("deletes a view by id", () => {
    mountHarness();
    let saved: DSLFilterSavedView | null = null;
    act(() => {
      saved = hook.saveView("Errors", "status_code == 'ERROR'");
    });
    act(() => {
      hook.deleteView(saved!.id);
    });

    expect(hook.savedViews).toEqual([]);
    expect(readDSLFilterSavedViews(STORAGE_KEY)).toEqual([]);
  });

  it("keeps views separate per history key", () => {
    mountHarness({ historyKey: "project-a" });
    act(() => {
      hook.saveView("A only", "status_code == 'ERROR'");
    });

    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    mountHarness({ historyKey: "project-b" });
    expect(hook.savedViews).toEqual([]);
  });
});

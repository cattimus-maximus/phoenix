import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import { SavedFilterViewsMenu } from "../SavedFilterViewsMenu";
import {
  type DSLFilterSavedView,
  getDSLFilterSavedViewsStorageKey,
  readDSLFilterSavedViews,
} from "../useDSLFilterSavedViews";

installTestStorage();

const HISTORY_KEY = "test-menu";
const STORAGE_KEY = getDSLFilterSavedViewsStorageKey(HISTORY_KEY);

function seed(views: DSLFilterSavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

function view(overrides: Partial<DSLFilterSavedView> = {}): DSLFilterSavedView {
  return {
    id: "seed-1",
    name: "Errors",
    condition: "status_code == 'ERROR'",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("SavedFilterViewsMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderMenu(
    props: Partial<React.ComponentProps<typeof SavedFilterViewsMenu>> = {}
  ) {
    const onApply = props.onApply ?? (() => {});
    act(() => {
      root.render(
        <SavedFilterViewsMenu
          historyKey={HISTORY_KEY}
          currentCondition={props.currentCondition ?? ""}
          canSave={props.canSave ?? false}
          onApply={onApply}
        />
      );
    });
    return { onApply };
  }

  function trigger() {
    return document.querySelector<HTMLButtonElement>(
      'button[aria-label="Saved filter views"]'
    );
  }

  it("shows the saved view count on the trigger", () => {
    seed([view({ id: "a", name: "A" }), view({ id: "b", name: "B" })]);
    renderMenu();
    expect(trigger()?.textContent).toContain("Views (2)");
  });

  it("labels the trigger without a count when there are no views", () => {
    renderMenu();
    expect(trigger()?.textContent).toContain("Views");
    expect(trigger()?.textContent).not.toContain("(");
  });

  it("applies a saved view when its row is clicked", async () => {
    seed([view()]);
    const applied: string[] = [];
    renderMenu({ onApply: (condition) => applied.push(condition) });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(trigger()!);
    });

    const applyButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".saved-view-row__apply")
    )[0];
    expect(applyButton).toBeTruthy();
    await act(async () => {
      await user.click(applyButton);
    });

    expect(applied).toEqual(["status_code == 'ERROR'"]);
  });

  it("deletes a saved view when its delete button is clicked", async () => {
    seed([view()]);
    renderMenu();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(trigger()!);
    });

    const deleteButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete saved view Errors"]'
    );
    expect(deleteButton).toBeTruthy();
    await act(async () => {
      await user.click(deleteButton!);
    });

    expect(readDSLFilterSavedViews(STORAGE_KEY)).toEqual([]);
  });

  it("saves the current filter under a typed name", async () => {
    renderMenu({
      canSave: true,
      currentCondition: "span_kind == 'LLM'",
    });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(trigger()!);
    });

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Name for the current filter"]'
    );
    expect(input).toBeTruthy();
    await act(async () => {
      await user.type(input!, "LLM spans");
    });

    const saveButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.includes("Save"));
    expect(saveButton).toBeTruthy();
    await act(async () => {
      await user.click(saveButton!);
    });

    const stored = readDSLFilterSavedViews(STORAGE_KEY);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: "LLM spans",
      condition: "span_kind == 'LLM'",
    });
  });

  it("disables saving when the current filter cannot be saved", async () => {
    renderMenu({ canSave: false, currentCondition: "" });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(trigger()!);
    });

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Name for the current filter"]'
    );
    expect(input?.disabled).toBe(true);
  });
});

import { css } from "@emotion/react";
import { type FormEvent, useCallback, useRef, useState } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Form,
  Icon,
  IconButton,
  Icons,
  Input,
  Label,
  Popover,
  Text,
  TextField,
  View,
} from "@phoenix/components";

import { useDSLFilterSavedViews } from "./useDSLFilterSavedViews";

const savedViewsPopoverCSS = css`
  width: 320px;
  max-width: 100vw;
`;

const savedViewsListCSS = css`
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
`;

const savedViewRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-50);

  .saved-view-row__apply {
    flex: 1 1 auto;
    min-width: 0;
    justify-content: flex-start;
    text-align: left;
  }

  .saved-view-row__name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .saved-view-row__condition {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export type SavedFilterViewsMenuProps = {
  /**
   * Scopes the saved views to their mount point — shares the `historyKey`
   * convention with recent searches (e.g. `span-filter-${projectId}`).
   */
  historyKey: string;
  /**
   * The filter condition currently entered in the field, offered as the thing
   * to save.
   */
  currentCondition: string;
  /**
   * Whether `currentCondition` is a non-empty, valid filter and therefore
   * eligible to be saved as a view.
   */
  canSave: boolean;
  /**
   * Applies a saved view's condition to the filter field.
   */
  onApply: (condition: string) => void;
};

/**
 * A "Saved views" menu for the span/trace filter field: the deliberate,
 * named counterpart to recent searches. Lets the user save the current filter
 * under a name, then re-apply or delete saved filters later. Persistence lives
 * entirely in `useDSLFilterSavedViews` (localStorage, per mount point).
 */
export function SavedFilterViewsMenu({
  historyKey,
  currentCondition,
  canSave,
  onApply,
}: SavedFilterViewsMenuProps) {
  const { savedViews, saveView, deleteView } = useDSLFilterSavedViews({
    historyKey,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const onSave = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const saved = saveView(name, currentCondition);
      if (saved) {
        setName("");
      }
    },
    [saveView, name, currentCondition]
  );

  const onApplyView = useCallback(
    (condition: string) => {
      onApply(condition);
      setIsOpen(false);
    },
    [onApply]
  );

  const trimmedName = name.trim();
  const canSubmit = canSave && trimmedName !== "";

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setName("");
        }
      }}
    >
      <Button
        size="S"
        variant="quiet"
        aria-label="Saved filter views"
        leadingVisual={<Icon svg={<Icons.Save />} />}
      >
        {savedViews.length > 0 ? `Views (${savedViews.length})` : "Views"}
      </Button>
      <Popover placement="bottom end" css={savedViewsPopoverCSS}>
        <Dialog aria-label="Saved filter views">
          <View padding="size-100">
            <Flex direction="column" gap="size-100">
              <Form onSubmit={onSave}>
                <Flex direction="row" gap="size-100" alignItems="end">
                  <View flex="1 1 auto">
                    <TextField
                      value={name}
                      onChange={setName}
                      isDisabled={!canSave}
                      aria-label="Name for the current filter"
                    >
                      <Label>Save current filter as</Label>
                      <Input ref={nameInputRef} placeholder="e.g. LLM errors" />
                    </TextField>
                  </View>
                  <Button
                    type="submit"
                    size="S"
                    variant="primary"
                    isDisabled={!canSubmit}
                    leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
                  >
                    Save
                  </Button>
                </Flex>
              </Form>
              {!canSave ? (
                <Text size="XS" color="text-700">
                  Enter a valid filter to save it as a view.
                </Text>
              ) : null}
              <View
                borderTopColor="default"
                borderTopWidth="thin"
                paddingTop="size-100"
              >
                {savedViews.length === 0 ? (
                  <Text size="S" color="text-700">
                    No saved views yet.
                  </Text>
                ) : (
                  <div css={savedViewsListCSS}>
                    {savedViews.map((view) => (
                      <div key={view.id} css={savedViewRowCSS}>
                        <Button
                          size="S"
                          variant="quiet"
                          className="saved-view-row__apply"
                          onPress={() => onApplyView(view.condition)}
                        >
                          <span>
                            <span className="saved-view-row__name">
                              <Text size="S">{view.name}</Text>
                            </span>
                            <span className="saved-view-row__condition">
                              <Text size="XS" color="text-700">
                                {view.condition}
                              </Text>
                            </span>
                          </span>
                        </Button>
                        <IconButton
                          size="S"
                          aria-label={`Delete saved view ${view.name}`}
                          onPress={() => deleteView(view.id)}
                        >
                          <Icon svg={<Icons.Trash />} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </View>
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

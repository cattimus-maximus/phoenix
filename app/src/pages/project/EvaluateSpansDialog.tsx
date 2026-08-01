import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Divider,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { usePreferencesContext } from "@phoenix/contexts";

import { PythonEvaluateSpansGuide } from "./PythonEvaluateSpansGuide";
import { TypeScriptEvaluateSpansGuide } from "./TypeScriptEvaluateSpansGuide";

const checklistCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
`;

const stepCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-200);
  align-items: flex-start;
`;

const stepMarkerColumnCSS = css`
  flex: none;
  width: 24px;
  display: flex;
  justify-content: center;
  padding-top: 2px;
`;

const stepMarkerCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--global-border-color-default);
  color: var(--global-text-color-700);
  font-size: 12px;
  line-height: 1;
`;

const stepContentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  flex: 1 1 auto;
`;

const ChecklistStep = ({
  index,
  title,
  children,
}: {
  index: number;
  title: ReactNode;
  children: ReactNode;
}) => {
  return (
    <div css={stepCSS}>
      <div css={stepMarkerColumnCSS}>
        <div css={stepMarkerCSS}>{index}</div>
      </div>
      <div css={stepContentCSS}>
        <Text weight="heavy">{title}</Text>
        {children}
      </div>
    </div>
  );
};

/**
 * A slide-over guide that bridges tracing to evaluation. It first walks the
 * user through the in-app, no-code path — add the selected spans to a dataset,
 * then create an evaluator in the Evaluators tab that scores them — and then
 * offers a ready-to-run code snippet as an alternative for those who prefer to
 * evaluate programmatically.
 */
export function EvaluateSpansDialog({
  projectName,
  spanIds,
  onAddToDataset,
}: {
  projectName: string;
  /**
   * The OpenTelemetry span IDs of the selected spans
   */
  spanIds: string[];
  /**
   * Triggers the "Add to Dataset" flow for the current selection. Closing this
   * slide-over is the caller's responsibility so the dataset selector can take
   * over.
   */
  onAddToDataset: () => void;
}) {
  const navigate = useNavigate();
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  const spanCount = spanIds.length;
  const isPlural = spanCount !== 1;
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Evaluate the Selected Spans</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-100">
            <Text size="L" weight="heavy">
              Evaluate in the app
            </Text>
          </View>
          <View paddingBottom="size-200">
            <Text color="text-700">
              Evaluators run against a dataset. Add the selected span
              {isPlural ? "s" : ""} to a dataset, then create an evaluator to
              score {isPlural ? "them" : "it"}. Scores are logged back as
              annotations and appear on the spans and in the annotation score
              charts.
            </Text>
          </View>
          <div css={checklistCSS}>
            <ChecklistStep index={1} title="Add the selected spans to a dataset">
              <Text size="S" color="text-700">
                Save {isPlural ? `these ${spanCount} spans` : "this span"} as
                dataset example{isPlural ? "s" : ""} so an evaluator has data to
                run against.
              </Text>
              <Flex direction="row">
                <Button
                  variant="primary"
                  size="S"
                  leadingVisual={<Icon svg={<Icons.Plus />} />}
                  onPress={onAddToDataset}
                >
                  Add to Dataset
                </Button>
              </Flex>
            </ChecklistStep>
            <ChecklistStep index={2} title="Create an evaluator">
              <Text size="S" color="text-700">
                Open the Evaluators tab and add a code or LLM evaluator to that
                dataset, then run it to score the examples.
              </Text>
              <Flex direction="row">
                <Button
                  size="S"
                  leadingVisual={<Icon svg={<Icons.Scale />} />}
                  onPress={() => navigate("/evaluators")}
                >
                  Go to Evaluators
                </Button>
              </Flex>
            </ChecklistStep>
          </div>
          <View paddingTop="size-400" paddingBottom="size-200">
            <Divider />
          </View>
          <View paddingBottom="size-100">
            <Text size="L" weight="heavy">
              Prefer code? Evaluate programmatically
            </Text>
          </View>
          <View paddingBottom="size-100">
            <Text color="text-700">
              Run an evaluator over the selected spans from your own environment
              and log the scores back to Phoenix.
            </Text>
          </View>
          <View paddingTop="size-100" paddingBottom="size-100">
            <CodeLanguageRadioGroup
              language={programmingLanguage}
              onChange={setProgrammingLanguage}
            />
          </View>
          {programmingLanguage === "Python" ? (
            <PythonEvaluateSpansGuide
              projectName={projectName}
              spanIds={spanIds}
            />
          ) : (
            <TypeScriptEvaluateSpansGuide
              projectName={projectName}
              spanIds={spanIds}
            />
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}

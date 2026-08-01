import { css } from "@emotion/react";
import { Suspense, useState } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  ExternalLink,
  Flex,
  Icon,
  Icons,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";

import { ProviderBrowserCredentialsPanel } from "./ProviderBrowserCredentialsPanel";
import type { ProviderServerCredentialsPanelProvider } from "./ProviderServerCredentialsPanel";
import { ProviderServerCredentialsPanel } from "./ProviderServerCredentialsPanel";

const calloutCSS = css`
  box-sizing: border-box;
  width: 100%;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-default);
  padding: var(--global-dimension-size-200);
  color: var(--global-text-color-900);
`;

/**
 * A prerequisite callout shown when the selected model's provider has no API
 * key configured, so users add a key before a run fails instead of after.
 * Offers browser-local key entry to everyone (runs send local keys with the
 * request) and server-side setup to admins.
 */
export function ProviderCredentialCallout({
  provider,
  modelName,
  mayUseDefaultCredentialChain = false,
  onCredentialsUpdated,
}: {
  provider: ProviderServerCredentialsPanelProvider;
  /**
   * The selected model, for copy; falls back to provider-level copy.
   */
  modelName?: string | null;
  /**
   * When true (AWS Bedrock, Azure OpenAI), the server may authenticate via
   * an ambient credential chain it cannot detect — the callout softens to an
   * informational hint and becomes dismissible.
   */
  mayUseDefaultCredentialChain?: boolean;
  /**
   * Called after server-side credentials change, so the caller can refetch
   * credential status.
   */
  onCredentialsUpdated?: () => void;
}) {
  const isAdmin = useIsAdminOrAuthDisabled();
  const [dismissed, setDismissed] = useState(false);
  const [credentialView, setCredentialView] = useState<"local" | "server">(
    "local"
  );

  if (dismissed) {
    return null;
  }

  const modelPhrase = modelName ? `${modelName}` : "this model";

  return (
    <section css={calloutCSS} aria-label={`${provider.name} API key setup`}>
      <Flex direction="column" gap="size-100">
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-100"
        >
          <Flex direction="row" alignItems="center" gap="size-100">
            <Icon
              color={mayUseDefaultCredentialChain ? "info" : "warning"}
              svg={
                mayUseDefaultCredentialChain ? (
                  <Icons.Info />
                ) : (
                  <Icons.AlertTriangle />
                )
              }
            />
            <Text weight="heavy">
              {provider.name} API key is not configured
            </Text>
          </Flex>
          {mayUseDefaultCredentialChain && (
            <Button
              size="S"
              aria-label="Dismiss API key setup"
              leadingVisual={<Icon svg={<Icons.Close />} />}
              onPress={() => setDismissed(true)}
            />
          )}
        </Flex>
        <Text size="XS" color="text-700">
          {mayUseDefaultCredentialChain
            ? `Runs that use ${modelPhrase} may fail without credentials. If the server authenticates through an ambient credential chain (such as an IAM role or a managed identity), no key is needed and you can dismiss this message.`
            : `Runs that use ${modelPhrase} will fail until an API key is added.`}
        </Text>
        <Flex direction="row" alignItems="center" gap="size-150">
          <DialogTrigger>
            <Button
              size="S"
              variant="primary"
              leadingVisual={<Icon svg={<Icons.Key />} />}
            >
              Add API key
            </Button>
            <Popover style={{ width: "500px" }}>
              <Dialog>
                {({ close }) => (
                  <View padding="size-200">
                    <Flex direction="column" gap="size-100">
                      <Flex
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text weight="heavy">{provider.name} API key</Text>
                        {isAdmin && (
                          <SegmentedControl
                            selectedKey={credentialView}
                            size="S"
                            aria-label="Credential Destination"
                            onSelectionChange={(view) => {
                              if (view === "local" || view === "server") {
                                setCredentialView(view);
                              }
                            }}
                          >
                            <SegmentedControlItem aria-label="Local" id="local">
                              Local
                            </SegmentedControlItem>
                            <SegmentedControlItem
                              aria-label="Server"
                              id="server"
                            >
                              Server
                            </SegmentedControlItem>
                          </SegmentedControl>
                        )}
                      </Flex>
                      {isAdmin && credentialView === "server" ? (
                        <Suspense
                          fallback={
                            <View paddingY="size-100">
                              <Text color="text-700">Loading…</Text>
                            </View>
                          }
                        >
                          <ProviderServerCredentialsPanel
                            provider={provider}
                            onCredentialsUpdated={onCredentialsUpdated}
                            onSaved={close}
                          />
                        </Suspense>
                      ) : (
                        <ProviderBrowserCredentialsPanel
                          provider={provider}
                          onSaved={close}
                        />
                      )}
                    </Flex>
                  </View>
                )}
              </Dialog>
            </Popover>
          </DialogTrigger>
          <ExternalLink href="/settings/providers">
            View AI provider settings
          </ExternalLink>
        </Flex>
      </Flex>
    </section>
  );
}

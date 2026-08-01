import { useCallback, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";

import type { useModelCredentialStatusQuery } from "./__generated__/useModelCredentialStatusQuery.graphql";
import {
  providerNeedsCredentials,
  providerSupportsDefaultCredentialChain,
} from "./modelProviderUtils";
import type { ProviderServerCredentialsPanelProvider } from "./ProviderServerCredentialsPanel";

/**
 * Minimal description of a selected model for credential-status purposes.
 * Matches the shape of both `ModelMenuValue` and the playground instance
 * model config.
 */
export type ModelCredentialStatusModel = {
  provider: string;
  modelName?: string | null;
  customProvider?: { id: string; name: string } | null;
};

export type ModelCredentialStatus = {
  /**
   * The selected model's provider when it requires credentials and none are
   * set on the server or in this browser; null when the model is ready to
   * use (or no built-in provider is selected).
   */
  missingCredentialsProvider: ProviderServerCredentialsPanelProvider | null;
  /**
   * True when the provider may authenticate through an ambient default
   * credential chain (e.g. an IAM role for AWS Bedrock, or a managed
   * identity for Azure OpenAI) that the server cannot detect. Missing
   * credentials are then a hint, not a certainty.
   */
  mayUseDefaultCredentialChain: boolean;
  /**
   * Refetches the server-side credential status (e.g. after credentials
   * are saved).
   */
  refresh: () => void;
};

/**
 * Reports whether the selected model's provider still needs an API key,
 * checking both server-side credentials (`credentialsSet`) and keys stored
 * in this browser. Custom providers are never flagged — they carry their
 * own auth configuration.
 */
export function useModelCredentialStatus(
  model: ModelCredentialStatusModel | null
): ModelCredentialStatus {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<useModelCredentialStatusQuery>(
    graphql`
      query useModelCredentialStatusQuery {
        modelProviders {
          key
          name
          dependenciesInstalled
          credentialsSet
          credentialRequirements {
            envVarName
            isRequired
          }
        }
      }
    `,
    {},
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const localCredentials = useCredentialsContext((state) => state);
  const refresh = useCallback(() => setFetchKey((key) => key + 1), []);

  const missingCredentialsProvider = useMemo(() => {
    if (!model || model.customProvider) {
      return null;
    }
    const provider = data.modelProviders.find(
      (provider) => provider.key === model.provider
    );
    if (
      !provider ||
      !providerNeedsCredentials({ provider, localCredentials })
    ) {
      return null;
    }
    return provider;
  }, [model, data.modelProviders, localCredentials]);

  return {
    missingCredentialsProvider,
    mayUseDefaultCredentialChain:
      missingCredentialsProvider != null &&
      providerSupportsDefaultCredentialChain({
        providerKey: missingCredentialsProvider.key,
      }),
    refresh,
  };
}

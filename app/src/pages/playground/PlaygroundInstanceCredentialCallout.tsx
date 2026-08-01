import { View } from "@phoenix/components";
import {
  ProviderCredentialCallout,
  useModelCredentialStatus,
} from "@phoenix/components/generative";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

/**
 * Surfaces the API-key prerequisite for a playground instance: when the
 * instance's selected model belongs to a provider with no credentials on the
 * server or in this browser, renders a callout with inline key entry so the
 * user can fix it before running. Renders nothing when the model is ready.
 *
 * Must be rendered inside a Suspense boundary (fetches provider credential
 * status).
 */
export function PlaygroundInstanceCredentialCallout({
  playgroundInstanceId,
}: {
  playgroundInstanceId: number;
}) {
  const model = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === playgroundInstanceId)
        ?.model
  );
  const { missingCredentialsProvider, mayUseDefaultCredentialChain, refresh } =
    useModelCredentialStatus(model ?? null);

  if (!missingCredentialsProvider) {
    return null;
  }

  return (
    <View paddingTop="size-100">
      <ProviderCredentialCallout
        provider={missingCredentialsProvider}
        modelName={model?.modelName}
        mayUseDefaultCredentialChain={mayUseDefaultCredentialChain}
        onCredentialsUpdated={refresh}
      />
    </View>
  );
}

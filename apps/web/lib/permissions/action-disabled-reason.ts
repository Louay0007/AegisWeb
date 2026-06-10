export function actionDisabledReason(apiMode: boolean | undefined, action: string, canUseAction: boolean | undefined) {
  if (!apiMode) return `Connect to the backend API to ${action}.`;
  if (!canUseAction) return `Your role cannot ${action}.`;
  return undefined;
}

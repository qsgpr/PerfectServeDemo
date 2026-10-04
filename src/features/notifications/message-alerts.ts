export async function enableMessageAlerts(_userId: string): Promise<string> {
  return "In-app message alerts are enabled. Background notifications require the installed mobile app.";
}
export async function getMessageAlertStatus(_userId: string): Promise<string> {
  return "In-app message alerts are enabled.";
}
export async function showMessageAlert(
  _userId: string,
  _messageId: string,
): Promise<void> {}
export async function unregisterMessageAlerts(): Promise<void> {}
export function observeMessageAlerts(_open: (id: string) => void): () => void {
  return () => {};
}
export function setOpenConversation(_id: string | null): void {}

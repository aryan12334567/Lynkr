/** Runs inside the active tab. It inspects only the focused editable element. */
export function insertDraft(text: string): boolean {
  const element = document.activeElement as HTMLElement | null;
  if (!element || !(element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && element.type === "text") || element.isContentEditable)) return false;
  element.focus();
  return document.execCommand("insertText", false, text);
}

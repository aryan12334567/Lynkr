/** Runs inside the active tab. It inspects only the focused editable element. */
export function insertDraft(text) {
    const element = document.activeElement;
    if (!element || !(element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && element.type === "text") || element.isContentEditable))
        return false;
    element.focus();
    return document.execCommand("insertText", false, text);
}

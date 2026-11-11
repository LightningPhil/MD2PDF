export function makeDialog(title: string, body: string, submitText = 'Apply'): { dialog: HTMLDialogElement; form: HTMLFormElement } {
  const dialog = document.createElement('dialog');
  dialog.className = 'tool-dialog';
  const id = `dialog-${crypto.randomUUID()}`;
  dialog.setAttribute('aria-labelledby', id);
  dialog.innerHTML = `<form><div class="tool-dialog-header"><h2 id="${id}"></h2><button type="button" data-cancel aria-label="Close dialog">×</button></div><div class="tool-dialog-body">${body}</div><p class="tool-dialog-message" role="status"></p><div class="tool-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit">${submitText}</button></div></form>`;
  dialog.querySelector('h2')!.textContent = title;
  document.body.append(dialog);
  let previousFocus: HTMLElement | null = null;
  dialog.addEventListener('close', () => previousFocus?.focus());
  dialog.addEventListener('dialog-opening', () => { previousFocus = document.activeElement as HTMLElement | null; });
  dialog.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => dialog.close()));
  return { dialog, form: dialog.querySelector('form')! };
}
export function showDialog(dialog: HTMLDialogElement): void {
  dialog.querySelector('.tool-dialog-message')!.textContent = '';
  dialog.dispatchEvent(new Event('dialog-opening'));
  dialog.showModal();
}
export function dialogError(dialog: HTMLDialogElement, message: string): void {
  dialog.querySelector('.tool-dialog-message')!.textContent = message;
}

/** A cancellable filename prompt using the same keyboard/focus behaviour as the authoring tools. */
export function requestFilename(filename: string): Promise<string | null> {
  const { dialog, form } = makeDialog('Rename document', '<label>Filename<input name="filename" maxlength="255" autocomplete="off"></label>', 'Rename');
  const input = form.elements.namedItem('filename') as HTMLInputElement;
  input.value = filename;
  return new Promise(resolve => {
    let result: string | null = null;
    dialog.addEventListener('close', () => { resolve(result); dialog.remove(); }, { once: true });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!input.value.trim()) { dialogError(dialog, 'Enter a filename.'); input.focus(); return; }
      result = input.value.trim(); dialog.close();
    });
    showDialog(dialog); input.focus(); input.select();
  });
}

export function confirmDocumentClose(filename: string): Promise<boolean> {
  const { dialog, form } = makeDialog('Close document?', '<p class="close-document-name"></p><p>This removes its locally saved draft and undo history. If you need a copy, choose Cancel and use Save or Save package first.</p>', 'Close document');
  dialog.querySelector('.close-document-name')!.textContent = filename;
  return new Promise(resolve => {
    let confirmed = false;
    dialog.addEventListener('close', () => { resolve(confirmed); dialog.remove(); }, { once: true });
    form.addEventListener('submit', event => { event.preventDefault(); confirmed = true; dialog.close(); });
    showDialog(dialog);
    (dialog.querySelector('.tool-dialog-actions [data-cancel]') as HTMLButtonElement).focus();
  });
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

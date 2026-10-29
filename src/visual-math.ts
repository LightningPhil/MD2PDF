import { MathfieldElement } from 'mathlive';
import 'mathlive/fonts.css';

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.computeEngine = null;

export function installVisualMath(dialog: HTMLDialogElement): void {
  if (dialog.querySelector('math-field')) return;
  const source = dialog.querySelector<HTMLTextAreaElement>('#equationSource')!;
  const label = document.createElement('label');
  label.textContent = 'Edit visually - use Tab to move between boxes';
  label.htmlFor = 'visualEquation';
  const field = new MathfieldElement();
  field.id = 'visualEquation';
  field.setAttribute('aria-label', 'Visual equation editor');
  field.mathVirtualKeyboardPolicy = 'manual';
  field.smartFence = true;
  field.smartSuperscript = true;
  field.value = source.value;
  const controls = document.createElement('div');
  controls.className = 'visual-math-controls';
  const structures: [string, string][] = [
    ['Fraction boxes', '\\frac{#?}{#?}'], ['Root box', '\\sqrt{#?}'],
    ['Exponent box', '#@^{#?}'], ['Subscript box', '#@_{#?}'],
    ['2 × 2 matrix', '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}'],
  ];
  for (const [text, latex] of structures) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = text;
    button.addEventListener('click', () => {
      field.focus(); field.insert(latex, { selectionMode: 'placeholder' });
      source.value = field.value; source.dispatchEvent(new Event('input'));
    });
    controls.append(button);
  }
  const keyboard = document.createElement('button');
  keyboard.type = 'button'; keyboard.textContent = 'Math keyboard';
  const keyboardHost = document.createElement('div');
  keyboardHost.className = 'math-keyboard-host';
  keyboard.addEventListener('click', () => {
    window.mathVirtualKeyboard.container = keyboardHost;
    if (window.mathVirtualKeyboard.visible) window.mathVirtualKeyboard.hide();
    else window.mathVirtualKeyboard.show();
    field.focus();
  });
  controls.append(keyboard);
  const sourceLabel = dialog.querySelector('label[for="equationSource"]')!;
  sourceLabel.before(label, field, controls, keyboardHost);
  const latex = document.createElement('details');
  latex.className = 'latex-source';
  const summary = document.createElement('summary'); summary.textContent = 'Edit LaTeX source';
  sourceLabel.replaceWith(latex); latex.append(summary, sourceLabel, source);
  source.rows = 3;
  window.mathVirtualKeyboard.container = keyboardHost;
  let updating = false;
  field.addEventListener('input', () => {
    updating = true;
    source.value = field.value;
    source.dispatchEvent(new Event('input'));
    updating = false;
  });
  source.addEventListener('input', () => { if (!updating) field.setValue(source.value, { silenceNotifications: true }); });
  dialog.addEventListener('equation-open', () => { field.setValue(source.value, { silenceNotifications: true }); field.focus(); });
  // Template and structure controls change the textarea programmatically.
  dialog.querySelector('#equationTemplate')!.addEventListener('change', () => field.setValue(source.value, { silenceNotifications: true }));
  dialog.querySelectorAll('.equation-symbols button, .equation-structures button').forEach(button => button.addEventListener('click', () => field.setValue(source.value, { silenceNotifications: true })));
  dialog.addEventListener('close', () => window.mathVirtualKeyboard.hide());
  if (dialog.open) field.focus();
}

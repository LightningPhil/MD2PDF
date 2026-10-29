type EditorSnapshot = { content: string; start: number; end: number };

export class MarkdownEditor {
  private textarea: HTMLTextAreaElement;
  private changeCallbacks: ((content: string) => void)[] = [];
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private lastState: EditorSnapshot;
  
  constructor(textareaId: string) {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) {
      throw new Error(`Textarea element with id '${textareaId}' not found`);
    }
    this.textarea = textarea;
    this.lastState = this.snapshot();
    this.setupEventListeners();
  }
  
  /**
   * Gets the current editor content
   */
  getContent(): string {
    return this.textarea.value;
  }
  
  /**
   * Sets the editor content
   * @param content - The markdown content to set
   */
  setContent(content: string): void {
    this.textarea.value = content;
    this.undoStack = [];
    this.redoStack = [];
    this.lastState = this.snapshot();
    this.notifyChange();
  }
  
  /**
   * Adds a callback that will be called when the content changes
   * @param callback - Function to call with the new content
   */
  onChange(callback: (content: string) => void): void {
    this.changeCallbacks.push(callback);
  }
  
  /**
   * Removes a change callback
   * @param callback - The callback function to remove
   */
  removeChangeListener(callback: (content: string) => void): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }
  
  /**
   * Focuses the editor
   */
  focus(): void {
    this.textarea.focus();
  }
  
  /**
   * Clears the editor content
   */
  clear(): void {
    this.replaceRange(0, this.textarea.value.length, '');
  }
  
  /**
   * Inserts text at the current cursor position
   * @param text - Text to insert
   */
  insertText(text: string): void {
    this.replaceRange(this.textarea.selectionStart, this.textarea.selectionEnd, text);
  }

  getSelection(): { start: number; end: number } {
    return { start: this.textarea.selectionStart, end: this.textarea.selectionEnd };
  }

  setSelection(start: number, end = start): void {
    this.textarea.setSelectionRange(start, end);
  }

  replaceRange(start: number, end: number, text: string, selectStart = text.length, selectEnd = selectStart): void {
    this.recordHistory(this.undoStack, this.snapshot());
    this.redoStack = [];
    this.textarea.setRangeText(text, start, end, 'end');
    this.textarea.setSelectionRange(start + selectStart, start + selectEnd);
    this.lastState = this.snapshot();
    this.notifyChange();
  }

  undo(): void { this.restoreHistory(this.undoStack, this.redoStack); }
  redo(): void { this.restoreHistory(this.redoStack, this.undoStack); }

  private snapshot(): EditorSnapshot {
    return { content: this.textarea.value, ...this.getSelection() };
  }

  private recordHistory(stack: EditorSnapshot[], state: EditorSnapshot): void {
    stack.push(state);
    // Embedded images can make a document large; bound history by size as well as count.
    let characters = stack.reduce((total, entry) => total + entry.content.length, 0);
    while (stack.length > 1 && (stack.length > 200 || characters > 10_000_000)) {
      characters -= stack.shift()!.content.length;
    }
  }

  private restoreHistory(from: typeof this.undoStack, to: typeof this.undoStack): void {
    const state = from.pop();
    if (!state) return;
    this.recordHistory(to, this.snapshot());
    this.textarea.value = state.content;
    this.textarea.setSelectionRange(state.start, state.end);
    this.lastState = this.snapshot();
    this.notifyChange();
  }
  
  /**
   * Gets the selected text
   */
  getSelectedText(): string {
    return this.textarea.value.substring(this.textarea.selectionStart, this.textarea.selectionEnd);
  }
  
  /**
   * Wraps the selected text with the given wrapper
   * @param wrapper - Text to wrap around selection (e.g., '**' for bold)
   */
  wrapSelection(wrapper: string): void {
    const { start, end } = this.getSelection();
    const selected = this.getSelectedText();
    this.replaceRange(start, end, wrapper + selected + wrapper,
      selected ? 0 : wrapper.length,
      selected ? selected.length + wrapper.length * 2 : wrapper.length);
  }
  /**
   * Sets up event listeners for the textarea
   */
  private setupEventListeners(): void {
    // Listen for input changes
    this.textarea.addEventListener('input', () => {
      this.recordHistory(this.undoStack, this.lastState);
      this.redoStack = [];
      this.lastState = this.snapshot();
      this.notifyChange();
    });
    this.textarea.addEventListener('beforeinput', (event) => {
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        event.preventDefault();
        if (event.inputType === 'historyUndo') this.undo();
        else this.redo();
        return;
      }
      this.lastState = this.snapshot();
    });
    
    // Handle tab key for indentation
    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && ['z', 'y'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        this.insertText('  '); // Insert two spaces
      }
    });
    
  }
  
  /**
   * Notifies all change callbacks
   */
  private notifyChange(): void {
    const content = this.getContent();
    this.changeCallbacks.forEach(callback => {
      try {
        callback(content);
      } catch (error) {
        console.error('Error in editor change callback:', error);
      }
    });
  }
}

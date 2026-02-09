export class MarkdownEditor {
  private textarea: HTMLTextAreaElement;
  private changeCallbacks: ((content: string) => void)[] = [];
  private cursorLineCallbacks: ((lineNumber: number) => void)[] = [];
  private focusPulseTimer: number | null = null;
  
  constructor(textareaId: string) {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) {
      throw new Error(`Textarea element with id '${textareaId}' not found`);
    }
    this.textarea = textarea;
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
   * Adds a callback that will be called when the active cursor line changes.
   */
  onCursorLineChange(callback: (lineNumber: number) => void): void {
    this.cursorLineCallbacks.push(callback);
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
    this.textarea.value = '';
    this.notifyChange();
  }

  /**
   * Reveals a line in the editor and moves the caret to it.
   * Returns true if the line existed and was selected.
   */
  revealLine(lineNumber: number): boolean {
    if (!Number.isFinite(lineNumber)) {
      return false;
    }

    const resolved = this.resolveLineRange(Math.max(1, Math.floor(lineNumber)));
    if (!resolved) {
      return false;
    }

    this.textarea.focus();
    this.textarea.setSelectionRange(resolved.start, resolved.end);
    this.scrollLineIntoView(resolved.lineNumber);
    this.pulseEditorFocus();
    this.notifyCursorLineChange();
    return true;
  }
  
  /**
   * Inserts text at the current cursor position
   * @param text - Text to insert
   */
  insertText(text: string): void {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const currentValue = this.textarea.value;
    
    this.textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);
    
    // Set cursor position after inserted text
    const newPosition = start + text.length;
    this.textarea.selectionStart = newPosition;
    this.textarea.selectionEnd = newPosition;
    
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
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selectedText = this.getSelectedText();
    
    if (selectedText) {
      this.textarea.value = 
        this.textarea.value.substring(0, start) + 
        wrapper + selectedText + wrapper + 
        this.textarea.value.substring(end);
      
      // Select the wrapped text
      this.textarea.selectionStart = start;
      this.textarea.selectionEnd = end + (wrapper.length * 2);
    } else {
      // If no selection, just insert the wrapper and position cursor in middle
      this.insertText(wrapper + wrapper);
      const position = start + wrapper.length;
      this.textarea.selectionStart = position;
      this.textarea.selectionEnd = position;
    }
    
    this.notifyChange();
  }
  
  /**
   * Sets up event listeners for the textarea
   */
  private setupEventListeners(): void {
    // Listen for input changes
    this.textarea.addEventListener('input', () => {
      this.notifyChange();
    });
    
    // Handle tab key for indentation
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.insertText('  '); // Insert two spaces
      }
    });

    this.textarea.addEventListener('click', () => {
      this.notifyCursorLineChange();
    });

    this.textarea.addEventListener('mouseup', () => {
      this.notifyCursorLineChange();
    });

    this.textarea.addEventListener('select', () => {
      this.notifyCursorLineChange();
    });

    this.textarea.addEventListener('keyup', (event) => {
      if (isNavigationKey(event.key)) {
        this.notifyCursorLineChange();
      }
    });
    
    // Auto-resize textarea (optional)
    this.textarea.addEventListener('input', () => {
      this.autoResize();
    });
  }
  
  /**
   * Auto-resizes the textarea to fit content
   */
  private autoResize(): void {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = this.textarea.scrollHeight + 'px';
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

  /**
   * Notifies cursor-line listeners with the current caret line.
   */
  private notifyCursorLineChange(): void {
    const lineNumber = this.getCurrentLineNumber();
    this.cursorLineCallbacks.forEach((callback) => {
      try {
        callback(lineNumber);
      } catch (error) {
        console.error('Error in cursor line callback:', error);
      }
    });
  }

  private getCurrentLineNumber(): number {
    const cursorPosition = this.textarea.selectionStart ?? 0;
    const prefix = this.textarea.value.slice(0, cursorPosition);
    return prefix.split('\n').length;
  }

  private resolveLineRange(requestedLine: number): { start: number; end: number; lineNumber: number } | null {
    const text = this.textarea.value;
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === '\n') {
        lineStarts.push(index + 1);
      }
    }

    if (lineStarts.length === 0) {
      return null;
    }

    const maxLine = lineStarts.length;
    const lineNumber = Math.min(Math.max(requestedLine, 1), maxLine);
    const start = lineStarts[lineNumber - 1];
    const nextLineStart = lineNumber < maxLine ? lineStarts[lineNumber] : text.length;
    const end = Math.max(start, nextLineStart - (lineNumber < maxLine ? 1 : 0));

    return {
      start,
      end,
      lineNumber,
    };
  }

  private scrollLineIntoView(lineNumber: number): void {
    const computed = window.getComputedStyle(this.textarea);
    const parsedLineHeight = Number.parseFloat(computed.lineHeight);
    const parsedFontSize = Number.parseFloat(computed.fontSize);
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : (Number.isFinite(parsedFontSize) ? parsedFontSize * 1.45 : 20);

    const targetTop = Math.max(0, (lineNumber - 1) * lineHeight);
    const offsetTop = Math.max(0, targetTop - (this.textarea.clientHeight * 0.35));
    this.textarea.scrollTop = offsetTop;
  }

  private pulseEditorFocus(): void {
    this.textarea.classList.remove('editor-line-focus');
    void this.textarea.offsetWidth;
    this.textarea.classList.add('editor-line-focus');

    if (this.focusPulseTimer !== null) {
      window.clearTimeout(this.focusPulseTimer);
    }

    this.focusPulseTimer = window.setTimeout(() => {
      this.textarea.classList.remove('editor-line-focus');
      this.focusPulseTimer = null;
    }, 1200);
  }
}

function isNavigationKey(key: string): boolean {
  return key === 'ArrowUp'
    || key === 'ArrowDown'
    || key === 'ArrowLeft'
    || key === 'ArrowRight'
    || key === 'PageUp'
    || key === 'PageDown'
    || key === 'Home'
    || key === 'End';
}

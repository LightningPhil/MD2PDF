export class MarkdownEditor {
  private textarea: HTMLTextAreaElement;
  private changeCallbacks: ((content: string) => void)[] = [];
  private cursorLineCallbacks: ((lineNumber: number) => void)[] = [];
  
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

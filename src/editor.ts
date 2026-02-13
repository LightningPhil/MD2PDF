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
      this.autoResize();
      this.notifyCursorLineChange();
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

  getCurrentLineNumber(): number {
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

  /**
   * Scroll so the given character position is visible.
   * Uses a mirror element to accurately measure where wrapped lines actually render.
   */
  private scrollLineIntoView(lineNumber: number): void {
    const resolved = this.resolveLineRange(lineNumber);
    if (!resolved) {
      return;
    }

    const charPosition = resolved.start;
    const targetTop = this.measureCharacterTop(charPosition);
    
    // Center the target line roughly 35% from the top of the visible viewport
    const offsetTop = Math.max(0, targetTop - (this.textarea.clientHeight * 0.35));
    this.textarea.scrollTop = offsetTop;
  }

  /**
   * Measures the actual Y position of a character in the textarea by creating
   * a hidden mirror div that replicates the textarea's text layout.
   */
  private measureCharacterTop(charPosition: number): number {
    const text = this.textarea.value;
    const computed = window.getComputedStyle(this.textarea);

    // Create a mirror div that replicates textarea text rendering
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';

    // Copy all relevant styles that affect text layout
    mirror.style.width = `${this.textarea.clientWidth}px`;
    mirror.style.font = computed.font;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.fontWeight = computed.fontWeight;
    mirror.style.fontStyle = computed.fontStyle;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.wordSpacing = computed.wordSpacing;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.padding = computed.padding;
    mirror.style.boxSizing = computed.boxSizing;
    mirror.style.border = computed.border;
    mirror.style.tabSize = computed.tabSize;

    // Text before the target position
    const beforeText = text.substring(0, charPosition);
    const beforeNode = document.createTextNode(beforeText);
    mirror.appendChild(beforeNode);

    // Marker span at the target position
    const marker = document.createElement('span');
    marker.textContent = text[charPosition] || '\u200b'; // Zero-width space if at end
    mirror.appendChild(marker);

    document.body.appendChild(mirror);

    // Measure the marker's position relative to the mirror's top
    const markerTop = marker.offsetTop;

    document.body.removeChild(mirror);

    return markerTop;
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

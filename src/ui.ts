import { MathRenderMode } from './katex.js';

export class UIController {
  private uploadBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private mathToggleBtn: HTMLButtonElement;
  private uploadInput: HTMLInputElement;
  private fontSizeSelect: HTMLSelectElement;
  private marginSelect: HTMLSelectElement;
  private currentMathMode: MathRenderMode = 'html';
  
  // Callbacks
  private fileUploadCallback?: (content: string, filename: string) => void;
  private fileSaveCallback?: () => string;
  private mathModeChangeCallback?: (mode: MathRenderMode) => void;
  private settingsChangeCallback?: () => void;
  
  constructor() {
    // Get UI elements
    this.uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.mathToggleBtn = document.getElementById('mathToggle') as HTMLButtonElement;
    this.uploadInput = document.getElementById('uploadFile') as HTMLInputElement;
    this.fontSizeSelect = document.getElementById('fontSizeSelect') as HTMLSelectElement;
    this.marginSelect = document.getElementById('marginSelect') as HTMLSelectElement;
    
    if (!this.uploadBtn || !this.saveBtn || !this.mathToggleBtn || !this.uploadInput) {
      throw new Error('Required UI elements not found');
    }
    
    this.setupEventListeners();
    this.applySettings(); // Apply initial settings
  }
  
  /**
   * Sets the callback for file upload
   * @param callback - Function to call with file content and filename
   */
  onFileUpload(callback: (content: string, filename: string) => void): void {
    this.fileUploadCallback = callback;
  }
  
  /**
   * Sets the callback for file save
   * @param callback - Function that returns the content to save
   */
  onFileSave(callback: () => string): void {
    this.fileSaveCallback = callback;
  }
  
  /**
   * Sets the callback for math mode changes
   * @param callback - Function to call when math mode changes
   */
  onMathModeChange(callback: (mode: MathRenderMode) => void): void {
    this.mathModeChangeCallback = callback;
  }
  
  /**
   * Sets the callback for settings changes (font size, margins)
   * @param callback - Function to call when settings change
   */
  onSettingsChange(callback: () => void): void {
    this.settingsChangeCallback = callback;
  }
  
  /**
   * Updates the math mode and button text
   * @param mode - The new math mode
   */
  setMathMode(mode: MathRenderMode): void {
    this.currentMathMode = mode;
    this.updateMathToggleButton();
  }
  
  /**
   * Gets the current math mode
   */
  getMathMode(): MathRenderMode {
    return this.currentMathMode;
  }
  
  /**
   * Gets the current font size in pixels
   */
  getFontSize(): number {
    return parseInt(this.fontSizeSelect?.value || '12', 10);
  }
  
  /**
   * Gets the current margin in mm
   */
  getMargin(): number {
    return parseFloat(this.marginSelect?.value || '20');
  }
  
  /**
   * Applies current settings to CSS custom properties
   */
  private applySettings(): void {
    const root = document.documentElement;
    root.style.setProperty('--page-font-size', `${this.getFontSize()}px`);
    root.style.setProperty('--page-margin', `${this.getMargin()}mm`);
  }
  
  /**
   * Shows a toast notification
   * @param message - Message to display
   * @param type - Type of notification ('success', 'error', 'info')
   */
  showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 1000;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  /**
   * Sets up event listeners for UI elements
   */
  private setupEventListeners(): void {
    // Upload button
    this.uploadBtn.addEventListener('click', () => {
      this.uploadInput.click();
    });
    
    // File input change
    this.uploadInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && this.fileUploadCallback) {
        this.readFile(file);
      }
    });
    
    // Save button
    this.saveBtn.addEventListener('click', () => {
      if (this.fileSaveCallback) {
        const content = this.fileSaveCallback();
        this.downloadFile(content, 'document.md');
      }
    });
    
    // Math mode toggle
    this.mathToggleBtn.addEventListener('click', () => {
      this.toggleMathMode();
    });
    
    // Font size change
    if (this.fontSizeSelect) {
      this.fontSizeSelect.addEventListener('change', () => {
        this.applySettings();
        if (this.settingsChangeCallback) {
          this.settingsChangeCallback();
        }
      });
    }
    
    // Margin change
    if (this.marginSelect) {
      this.marginSelect.addEventListener('change', () => {
        this.applySettings();
        if (this.settingsChangeCallback) {
          this.settingsChangeCallback();
        }
      });
    }
    
    // Drag and drop support
    this.setupDragAndDrop();
  }
  
  /**
   * Reads a file and calls the upload callback
   * @param file - File to read
   */
  private readFile(file: File): void {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content && this.fileUploadCallback) {
        this.fileUploadCallback(content, file.name);
        this.showNotification(`Loaded ${file.name}`, 'success');
      }
    };
    
    reader.onerror = () => {
      this.showNotification('Failed to read file', 'error');
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Downloads content as a file
   * @param content - Content to download
   * @param filename - Name of the file
   */
  private downloadFile(content: string, filename: string): void {
    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showNotification(`Saved ${filename}`, 'success');
    } catch (error) {
      this.showNotification('Failed to save file', 'error');
      console.error('Save error:', error);
    }
  }
  
  /**
   * Toggles between HTML and SVG math modes
   */
  private toggleMathMode(): void {
    const newMode: MathRenderMode = this.currentMathMode === 'html' ? 'svg' : 'html';
    this.setMathMode(newMode);
    
    if (this.mathModeChangeCallback) {
      this.mathModeChangeCallback(newMode);
    }
  }
  
  /**
   * Updates the math toggle button text
   */
  private updateMathToggleButton(): void {
    this.mathToggleBtn.textContent = `🧮 Math: ${this.currentMathMode.toUpperCase()}`;
  }
  
  /**
   * Sets up drag and drop functionality
   */
  private setupDragAndDrop(): void {
    const app = document.getElementById('app');
    if (!app) return;
    
    app.addEventListener('dragover', (e) => {
      e.preventDefault();
      app.style.backgroundColor = '#f0f8ff';
    });
    
    app.addEventListener('dragleave', (e) => {
      e.preventDefault();
      app.style.backgroundColor = '';
    });
    
    app.addEventListener('drop', (e) => {
      e.preventDefault();
      app.style.backgroundColor = '';
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.type === 'text/plain') {
          this.readFile(file);
        } else {
          this.showNotification('Please drop a markdown (.md) file', 'error');
        }
      }
    });
  }
}

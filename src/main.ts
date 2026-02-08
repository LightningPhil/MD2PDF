import { MarkdownEditor } from './editor.js';
import { renderMarkdown } from './markdown.js';
import { PageManager } from './pages.js';
import { UIController } from './ui.js';

// Extend window interface for KaTeX
declare global {
  interface Window {
    katex: any;
  }
}

class MD2PDFApp {
  private editor!: MarkdownEditor;
  private pageManager!: PageManager;
  private ui!: UIController;
  private isExportingPdf = false;
  
  constructor() {
    try {
      // Initialize components
      this.editor = new MarkdownEditor('markdownEditor');
      this.pageManager = new PageManager('previewContainer');
      this.ui = new UIController();
      
      this.setupEventHandlers();
      this.updatePreview(); // Initial render
      
      console.log('MD2PDF App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MD2PDF App:', error);
      this.showError('Failed to initialize application');
    }
  }
  
  /**
   * Sets up event handlers between components
   */
  private setupEventHandlers(): void {
    // Editor changes -> update preview
    this.editor.onChange((_content) => {
      this.updatePreview();
    });
    
    // File upload -> load into editor
    this.ui.onFileUpload((content, filename) => {
      this.editor.setContent(content);
      console.log(`Loaded file: ${filename}`);
    });
    
    // File save -> get content from editor
    this.ui.onFileSave(() => {
      return this.editor.getContent();
    });

    // PDF export
    this.ui.onPdfExport(() => {
      this.exportCurrentPreviewToPdf();
    });
    
    // Math mode change -> update pages
    this.ui.onMathModeChange((mode) => {
      this.pageManager.setMathMode(mode);
      this.updatePreview(); // Re-render with new math mode
      console.log(`Math mode changed to: ${mode}`);
    });
    
    // Settings change (font size, margins) -> update preview
    this.ui.onSettingsChange(() => {
      this.updatePreview();
      console.log('Settings changed, re-rendering preview');
    });
  }
  
  /**
   * Updates the preview with current editor content
   */
  private updatePreview(): void {
    try {
      const markdown = this.editor.getContent();
      
      if (!markdown.trim()) {
        // Show empty page for empty content
        this.pageManager.updatePages(document.createElement('div'));
        this.ui.refreshPreviewViewport();
        return;
      }
      
      // Render markdown to HTML
      const mathMode = this.pageManager.getMathMode();
      const htmlContent = renderMarkdown(markdown, { mathMode: { type: mathMode } });
      
      // Update pages
      this.pageManager.updatePages(htmlContent);
      this.ui.refreshPreviewViewport();
      
    } catch (error) {
      console.error('Error updating preview:', error);
      this.showError('Failed to update preview');
    }
  }
  
  /**
   * Shows an error message to the user
   */
  private showError(message: string): void {
    this.ui.showNotification(message, 'error');
  }

  private exportCurrentPreviewToPdf(): void {
    if (this.isExportingPdf) {
      return;
    }

    this.isExportingPdf = true;

    const root = document.documentElement;
    const previousMathMode = this.pageManager.getMathMode();

    if (previousMathMode !== 'html') {
      this.pageManager.setMathMode('html');
      this.ui.setMathMode('html');
      this.updatePreview();
    }

    this.ui.showNotification('Opening print dialog for PDF export...', 'info');
    root.dataset.exportMode = 'pdf';

    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;

      delete root.dataset.exportMode;

      if (previousMathMode !== 'html') {
        this.pageManager.setMathMode(previousMathMode);
        this.ui.setMathMode(previousMathMode);
        this.updatePreview();
      }

      window.removeEventListener('afterprint', onAfterPrint);
      this.isExportingPdf = false;
    };

    const onAfterPrint = (): void => {
      cleanup();
    };

    window.addEventListener('afterprint', onAfterPrint);

    try {
      window.print();
    } finally {
      window.setTimeout(() => {
        cleanup();
      }, 1200);
    }
  }
}

// Wait for DOM to be loaded before initializing the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MD2PDFApp();
  });
} else {
  new MD2PDFApp();
}

// Load KaTeX library if not already loaded
if (typeof window !== 'undefined' && !window.katex) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
  script.onload = () => {
    console.log('KaTeX library loaded');
  };
  script.onerror = () => {
    console.error('Failed to load KaTeX library');
  };
  document.head.appendChild(script);
}

/**
 * Base modal class providing common modal behavior.
 * Subclasses implement specific modal content and logic.
 */

export interface ModalElements {
  backdrop: HTMLElement;
  closeBtn: HTMLButtonElement;
}

export abstract class BaseModal {
  protected readonly backdrop: HTMLElement;
  protected readonly closeBtn: HTMLButtonElement;
  protected isOpen = false;

  /**
   * CSS class added to document.body when modal is open.
   * Override in subclass if needed.
   */
  protected abstract readonly bodyClass: string;

  constructor(elements: ModalElements) {
    this.backdrop = elements.backdrop;
    this.closeBtn = elements.closeBtn;
    this.setupBaseListeners();
  }

  private setupBaseListeners(): void {
    // Close button
    this.closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Backdrop click (if not intercepted by modal content)
    this.backdrop.addEventListener('click', (event) => {
      if (event.target === this.backdrop) {
        this.close();
      }
    });

    // Escape key (global, but only acts when this modal is open)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        this.close();
      }
    });
  }

  /**
   * Opens the modal. Subclasses can override to add custom open behavior.
   */
  open(): void {
    if (this.isOpen) return;
    
    this.onBeforeOpen();
    this.backdrop.hidden = false;
    document.body.classList.add(this.bodyClass);
    this.isOpen = true;
    this.onAfterOpen();
  }

  /**
   * Closes the modal. Subclasses can override to add custom close behavior.
   */
  close(): void {
    if (!this.isOpen) return;
    if (!this.canClose()) return;
    
    this.onBeforeClose();
    this.backdrop.hidden = true;
    document.body.classList.remove(this.bodyClass);
    this.isOpen = false;
    this.onAfterClose();
  }

  /**
   * Returns true if modal is currently open.
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Override to add pre-open logic.
   */
  protected onBeforeOpen(): void {
    // Default no-op
  }

  /**
   * Override to add post-open logic (e.g., focus management).
   */
  protected onAfterOpen(): void {
    this.closeBtn.focus();
  }

  /**
   * Override to prevent closing in certain states.
   */
  protected canClose(): boolean {
    return true;
  }

  /**
   * Override to add pre-close logic.
   */
  protected onBeforeClose(): void {
    // Default no-op
  }

  /**
   * Override to add post-close logic.
   */
  protected onAfterClose(): void {
    // Default no-op
  }
}

/**
 * Header/Footer configuration modal.
 */
import { BaseModal, type ModalElements } from './BaseModal.js';
import type { HeaderFooterConfig } from '../typesetter.js';

export type HeaderFooterMode = 'none' | 'auto' | 'manual';

export interface HeaderFooterFormConfig {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  skipFirstPage: boolean;
}

export interface HeaderFooterModalElements extends ModalElements {
  modeNone: HTMLInputElement;
  modeAuto: HTMLInputElement;
  modeManual: HTMLInputElement;
  autoSection: HTMLElement;
  manualSection: HTMLElement;
  autoSkipFirst: HTMLInputElement;
  headerLeft: HTMLInputElement;
  headerCenter: HTMLInputElement;
  headerRight: HTMLInputElement;
  footerLeft: HTMLInputElement;
  footerCenter: HTMLInputElement;
  footerRight: HTMLInputElement;
  manualSkipFirst: HTMLInputElement;
  applyBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

export class HeaderFooterModal extends BaseModal {
  protected readonly bodyClass = 'hf-modal-open';
  
  private readonly modeNone: HTMLInputElement;
  private readonly modeAuto: HTMLInputElement;
  private readonly modeManual: HTMLInputElement;
  private readonly autoSection: HTMLElement;
  private readonly manualSection: HTMLElement;
  private readonly autoSkipFirst: HTMLInputElement;
  private readonly headerLeft: HTMLInputElement;
  private readonly headerCenter: HTMLInputElement;
  private readonly headerRight: HTMLInputElement;
  private readonly footerLeft: HTMLInputElement;
  private readonly footerCenter: HTMLInputElement;
  private readonly footerRight: HTMLInputElement;
  private readonly manualSkipFirst: HTMLInputElement;
  private readonly applyBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;

  private mode: HeaderFooterMode = 'none';
  private config: HeaderFooterFormConfig = {
    headerLeft: '',
    headerCenter: '',
    headerRight: '',
    footerLeft: '',
    footerCenter: '',
    footerRight: '',
    skipFirstPage: false,
  };
  private documentTitle = 'Untitled';

  private onApplyCallback?: () => void;

  constructor(elements: HeaderFooterModalElements) {
    super(elements);
    this.modeNone = elements.modeNone;
    this.modeAuto = elements.modeAuto;
    this.modeManual = elements.modeManual;
    this.autoSection = elements.autoSection;
    this.manualSection = elements.manualSection;
    this.autoSkipFirst = elements.autoSkipFirst;
    this.headerLeft = elements.headerLeft;
    this.headerCenter = elements.headerCenter;
    this.headerRight = elements.headerRight;
    this.footerLeft = elements.footerLeft;
    this.footerCenter = elements.footerCenter;
    this.footerRight = elements.footerRight;
    this.manualSkipFirst = elements.manualSkipFirst;
    this.applyBtn = elements.applyBtn;
    this.cancelBtn = elements.cancelBtn;
    
    this.setupListeners();
  }

  private setupListeners(): void {
    // Mode radio buttons
    [this.modeNone, this.modeAuto, this.modeManual].forEach((radio) => {
      radio.addEventListener('change', () => this.updateSections());
    });

    // Apply button
    this.applyBtn.addEventListener('click', () => {
      this.applySettings();
    });

    // Cancel button
    this.cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  /**
   * Sets the callback for when settings are applied.
   */
  onApply(callback: () => void): void {
    this.onApplyCallback = callback;
  }

  protected onBeforeOpen(): void {
    // Populate form with current settings
    this.modeNone.checked = this.mode === 'none';
    this.modeAuto.checked = this.mode === 'auto';
    this.modeManual.checked = this.mode === 'manual';
    
    this.autoSkipFirst.checked = this.config.skipFirstPage;
    this.manualSkipFirst.checked = this.config.skipFirstPage;
    this.headerLeft.value = this.config.headerLeft;
    this.headerCenter.value = this.config.headerCenter;
    this.headerRight.value = this.config.headerRight;
    this.footerLeft.value = this.config.footerLeft;
    this.footerCenter.value = this.config.footerCenter;
    this.footerRight.value = this.config.footerRight;
    
    this.updateSections();
  }

  private updateSections(): void {
    if (this.modeNone.checked) {
      this.autoSection.hidden = true;
      this.manualSection.hidden = true;
    } else if (this.modeAuto.checked) {
      this.autoSection.hidden = false;
      this.manualSection.hidden = true;
    } else {
      this.autoSection.hidden = true;
      this.manualSection.hidden = false;
    }
  }

  private applySettings(): void {
    // Determine current mode
    if (this.modeNone.checked) {
      this.mode = 'none';
    } else if (this.modeAuto.checked) {
      this.mode = 'auto';
    } else {
      this.mode = 'manual';
    }

    // Get skip first page from the active mode's checkbox
    const skipFirstPage = this.mode === 'auto' 
      ? this.autoSkipFirst.checked 
      : this.manualSkipFirst.checked;

    this.config = {
      headerLeft: this.headerLeft.value,
      headerCenter: this.headerCenter.value,
      headerRight: this.headerRight.value,
      footerLeft: this.footerLeft.value,
      footerCenter: this.footerCenter.value,
      footerRight: this.footerRight.value,
      skipFirstPage,
    };

    this.onApplyCallback?.();
    this.close();
  }

  /**
   * Sets the document title for auto header/footer mode.
   */
  setDocumentTitle(title: string): void {
    this.documentTitle = title;
  }

  /**
   * Gets the current mode.
   */
  getMode(): HeaderFooterMode {
    return this.mode;
  }

  /**
   * Gets the current header/footer config for typesetter.
   */
  getConfig(): HeaderFooterConfig | undefined {
    if (this.mode === 'none') {
      return undefined;
    }

    // Auto mode: use predefined values  
    // Manual mode: use the user-provided values
    if (this.mode === 'auto') {
      return {
        header: {
          left: this.documentTitle || undefined,
          center: undefined,
          right: '{{date}}',
        },
        footer: {
          left: undefined,
          center: 'Page {{pageNumber}} of {{totalPages}}',
          right: undefined,
        },
        skipFirstPage: this.config.skipFirstPage,
      };
    }

    return {
      header: {
        left: this.config.headerLeft || undefined,
        center: this.config.headerCenter || undefined,
        right: this.config.headerRight || undefined,
      },
      footer: {
        left: this.config.footerLeft || undefined,
        center: this.config.footerCenter || undefined,
        right: this.config.footerRight || undefined,
      },
      skipFirstPage: this.config.skipFirstPage,
    };
  }
}

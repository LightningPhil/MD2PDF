/**
 * Typography and formatting settings modal.
 */
import { BaseModal, type ModalElements } from './BaseModal.js';

export interface TypographySettings {
  // Font sizes
  baseFontSizePt: number;
  h1Scale: number;
  h2Scale: number;
  h3Scale: number;
  codeFontSizePt: number;
  tableFontSizePt: number;
  headerFooterFontSizePt: number;
  
  // Spacing
  lineHeight: number;
  paragraphSpacingPt: number;
  
  // Features
  linkUnderline: boolean;
  codeBlockBackground: boolean;
  codeBlockBorder: boolean;
  codeBlockLineNumbers: boolean;
}

export interface SettingsModalElements extends ModalElements {
  // Font size inputs
  baseFontSize: HTMLInputElement;
  h1Scale: HTMLInputElement;
  h2Scale: HTMLInputElement;
  h3Scale: HTMLInputElement;
  codeFontSize: HTMLInputElement;
  tableFontSize: HTMLInputElement;
  headerFooterFontSize: HTMLInputElement;
  
  // Spacing inputs
  lineHeight: HTMLInputElement;
  paragraphSpacing: HTMLInputElement;
  
  // Feature toggles
  linkUnderline: HTMLInputElement;
  codeBlockBackground: HTMLInputElement;
  codeBlockBorder: HTMLInputElement;
  codeBlockLineNumbers: HTMLInputElement;
  
  // Buttons
  applyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

const DEFAULT_SETTINGS: TypographySettings = {
  baseFontSizePt: 12,
  h1Scale: 2.0,
  h2Scale: 1.5,
  h3Scale: 1.2,
  codeFontSizePt: 10,
  tableFontSizePt: 11,
  headerFooterFontSizePt: 10,
  lineHeight: 1.4,
  paragraphSpacingPt: 12,
  linkUnderline: false,
  codeBlockBackground: true,
  codeBlockBorder: true,
  codeBlockLineNumbers: false,
};

export class SettingsModal extends BaseModal {
  protected readonly bodyClass = 'settings-modal-open';
  
  // Font size inputs
  private readonly baseFontSize: HTMLInputElement;
  private readonly h1Scale: HTMLInputElement;
  private readonly h2Scale: HTMLInputElement;
  private readonly h3Scale: HTMLInputElement;
  private readonly codeFontSize: HTMLInputElement;
  private readonly tableFontSize: HTMLInputElement;
  private readonly headerFooterFontSize: HTMLInputElement;
  
  // Spacing inputs
  private readonly lineHeight: HTMLInputElement;
  private readonly paragraphSpacing: HTMLInputElement;
  
  // Feature toggles
  private readonly linkUnderline: HTMLInputElement;
  private readonly codeBlockBackground: HTMLInputElement;
  private readonly codeBlockBorder: HTMLInputElement;
  private readonly codeBlockLineNumbers: HTMLInputElement;
  
  // Buttons
  private readonly applyBtn: HTMLButtonElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;

  private settings: TypographySettings = { ...DEFAULT_SETTINGS };
  private onApplyCallback?: (settings: TypographySettings) => void;

  constructor(elements: SettingsModalElements) {
    super(elements);
    
    this.baseFontSize = elements.baseFontSize;
    this.h1Scale = elements.h1Scale;
    this.h2Scale = elements.h2Scale;
    this.h3Scale = elements.h3Scale;
    this.codeFontSize = elements.codeFontSize;
    this.tableFontSize = elements.tableFontSize;
    this.headerFooterFontSize = elements.headerFooterFontSize;
    this.lineHeight = elements.lineHeight;
    this.paragraphSpacing = elements.paragraphSpacing;
    this.linkUnderline = elements.linkUnderline;
    this.codeBlockBackground = elements.codeBlockBackground;
    this.codeBlockBorder = elements.codeBlockBorder;
    this.codeBlockLineNumbers = elements.codeBlockLineNumbers;
    this.applyBtn = elements.applyBtn;
    this.resetBtn = elements.resetBtn;
    this.cancelBtn = elements.cancelBtn;
    
    this.setupListeners();
    this.populateFromSettings();
  }

  private setupListeners(): void {
    this.applyBtn.addEventListener('click', () => {
      this.applySettings();
    });

    this.resetBtn.addEventListener('click', () => {
      this.resetToDefaults();
    });

    this.cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  private populateFromSettings(): void {
    this.baseFontSize.value = String(this.settings.baseFontSizePt);
    this.h1Scale.value = String(this.settings.h1Scale);
    this.h2Scale.value = String(this.settings.h2Scale);
    this.h3Scale.value = String(this.settings.h3Scale);
    this.codeFontSize.value = String(this.settings.codeFontSizePt);
    this.tableFontSize.value = String(this.settings.tableFontSizePt);
    this.headerFooterFontSize.value = String(this.settings.headerFooterFontSizePt);
    this.lineHeight.value = String(this.settings.lineHeight);
    this.paragraphSpacing.value = String(this.settings.paragraphSpacingPt);
    this.linkUnderline.checked = this.settings.linkUnderline;
    this.codeBlockBackground.checked = this.settings.codeBlockBackground;
    this.codeBlockBorder.checked = this.settings.codeBlockBorder;
    this.codeBlockLineNumbers.checked = this.settings.codeBlockLineNumbers;
  }

  private readFormValues(): TypographySettings {
    return {
      baseFontSizePt: this.parseNumber(this.baseFontSize.value, DEFAULT_SETTINGS.baseFontSizePt, 6, 48),
      h1Scale: this.parseNumber(this.h1Scale.value, DEFAULT_SETTINGS.h1Scale, 1, 4),
      h2Scale: this.parseNumber(this.h2Scale.value, DEFAULT_SETTINGS.h2Scale, 1, 3),
      h3Scale: this.parseNumber(this.h3Scale.value, DEFAULT_SETTINGS.h3Scale, 1, 2.5),
      codeFontSizePt: this.parseNumber(this.codeFontSize.value, DEFAULT_SETTINGS.codeFontSizePt, 6, 24),
      tableFontSizePt: this.parseNumber(this.tableFontSize.value, DEFAULT_SETTINGS.tableFontSizePt, 6, 24),
      headerFooterFontSizePt: this.parseNumber(this.headerFooterFontSize.value, DEFAULT_SETTINGS.headerFooterFontSizePt, 6, 18),
      lineHeight: this.parseNumber(this.lineHeight.value, DEFAULT_SETTINGS.lineHeight, 1, 3),
      paragraphSpacingPt: this.parseNumber(this.paragraphSpacing.value, DEFAULT_SETTINGS.paragraphSpacingPt, 0, 48),
      linkUnderline: this.linkUnderline.checked,
      codeBlockBackground: this.codeBlockBackground.checked,
      codeBlockBorder: this.codeBlockBorder.checked,
      codeBlockLineNumbers: this.codeBlockLineNumbers.checked,
    };
  }

  private parseNumber(value: string, fallback: number, min: number, max: number): number {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
    return fallback;
  }

  private applySettings(): void {
    this.settings = this.readFormValues();
    this.onApplyCallback?.(this.settings);
    this.close();
  }

  private resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.populateFromSettings();
  }

  /**
   * Sets the callback to invoke when settings are applied.
   */
  onApply(callback: (settings: TypographySettings) => void): void {
    this.onApplyCallback = callback;
  }

  /**
   * Gets the current settings.
   */
  getSettings(): TypographySettings {
    return { ...this.settings };
  }

  /**
   * Updates settings programmatically (e.g., loading saved preferences).
   */
  setSettings(settings: Partial<TypographySettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.populateFromSettings();
  }

  /**
   * Opens the modal with current settings pre-populated.
   */
  override open(): void {
    this.populateFromSettings();
    super.open();
  }
}

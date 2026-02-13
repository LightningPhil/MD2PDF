/**
 * Controller for theme management (dark/light mode).
 */
import type { ThemeMode } from '../types/ui.js';

const THEME_STORAGE_KEY = 'md2pdf.theme';

export interface ThemeControllerElements {
  toggleBtn: HTMLButtonElement;
}

export class ThemeController {
  private readonly toggleBtn: HTMLButtonElement;
  private currentTheme: ThemeMode = 'dark';

  constructor(elements: ThemeControllerElements) {
    this.toggleBtn = elements.toggleBtn;
    this.setupListeners();
    this.initializeFromStorage();
  }

  private setupListeners(): void {
    this.toggleBtn.addEventListener('click', () => {
      this.toggle();
    });
  }

  /**
   * Initializes theme from localStorage or defaults to dark.
   */
  private initializeFromStorage(): void {
    let storedTheme: string | null = null;

    try {
      storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      storedTheme = null;
    }

    const initialTheme: ThemeMode = storedTheme === 'light' ? 'light' : 'dark';
    this.apply(initialTheme);
  }

  /**
   * Applies the specified theme.
   */
  apply(theme: ThemeMode): void {
    this.currentTheme = theme;
    document.documentElement.dataset.theme = theme;

    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${nextTheme} theme`;
    this.toggleBtn.setAttribute('aria-label', label);
    this.toggleBtn.setAttribute('title', label);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore persistence errors.
    }
  }

  /**
   * Toggles between dark and light theme.
   */
  toggle(): void {
    const nextTheme: ThemeMode = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.apply(nextTheme);
  }

  /**
   * Gets the current theme.
   */
  getTheme(): ThemeMode {
    return this.currentTheme;
  }
}

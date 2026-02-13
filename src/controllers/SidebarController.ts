/**
 * Controller for sidebar collapse and resize functionality.
 */
import { clamp } from '../utils/math.js';

const SIDEBAR_WIDTH_STORAGE_KEY = 'md2pdf.sidebar.width';
const STACKED_LAYOUT_BREAKPOINT = 1200;

export interface SidebarControllerElements {
  workspaceShell: HTMLElement;
  toggleBtn: HTMLButtonElement;
  toggleIcon: HTMLElement;
  divider: HTMLElement;
}

export interface SidebarControllerConfig {
  minWidthPx?: number;
  maxWidthPx?: number;
  defaultWidthPx?: number;
}

export interface SidebarControllerCallbacks {
  onViewportRefresh?: () => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export class SidebarController {
  private readonly workspaceShell: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly toggleIcon: HTMLElement;
  private readonly divider: HTMLElement;

  private readonly minWidthPx: number;
  private readonly maxWidthPx: number;
  private widthPx: number;

  private isCollapsed = false;
  private isDragging = false;

  private readonly onViewportRefresh: () => void;
  private readonly onDragStateChange: (isDragging: boolean) => void;

  constructor(
    elements: SidebarControllerElements,
    config: SidebarControllerConfig = {},
    callbacks: SidebarControllerCallbacks = {}
  ) {
    this.workspaceShell = elements.workspaceShell;
    this.toggleBtn = elements.toggleBtn;
    this.toggleIcon = elements.toggleIcon;
    this.divider = elements.divider;

    this.minWidthPx = config.minWidthPx ?? 220;
    this.maxWidthPx = config.maxWidthPx ?? 520;
    this.widthPx = config.defaultWidthPx ?? 290;

    this.onViewportRefresh = callbacks.onViewportRefresh ?? (() => {});
    this.onDragStateChange = callbacks.onDragStateChange ?? (() => {});

    this.setupListeners();
  }

  /**
   * Initializes sidebar width from localStorage or defaults.
   */
  initializeWidth(): void {
    let storedWidth: string | null = null;

    try {
      storedWidth = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    } catch {
      storedWidth = null;
    }

    if (!storedWidth) {
      this.setWidth(this.widthPx, false);
      return;
    }

    const parsed = Number.parseFloat(storedWidth);
    this.setWidth(Number.isFinite(parsed) ? parsed : this.widthPx, false);
  }

  /**
   * Toggles the sidebar between collapsed and expanded states.
   */
  toggle(): void {
    this.isCollapsed = !this.isCollapsed;
    this.workspaceShell.classList.toggle('sidebar-collapsed', this.isCollapsed);
    
    if (this.isCollapsed) {
      this.isDragging = false;
      this.onDragStateChange(false);
    }
    
    this.updateToggleButton();
    requestAnimationFrame(() => this.onViewportRefresh());
  }

  /**
   * Returns whether the sidebar is currently collapsed.
   */
  getIsCollapsed(): boolean {
    return this.isCollapsed;
  }

  /**
   * Returns whether the sidebar divider is currently being dragged.
   */
  getIsDragging(): boolean {
    return this.isDragging;
  }

  /**
   * Returns the current sidebar width in pixels.
   */
  getWidth(): number {
    return this.widthPx;
  }

  private setupListeners(): void {
    // Toggle button
    this.toggleBtn.addEventListener('click', () => this.toggle());

    // Divider drag
    this.divider.addEventListener('pointerdown', (e) => this.startDrag(e));
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);

    // Keyboard resize
    this.divider.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging || this.isStackedLayout() || this.isCollapsed) {
      return;
    }

    this.updateWidthFromPointerX(event.clientX);
  };

  private readonly onPointerUp = (): void => {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;
    this.onDragStateChange(false);
  };

  private startDrag(event: PointerEvent): void {
    if (this.isStackedLayout() || this.isCollapsed) {
      return;
    }

    this.isDragging = true;
    this.onDragStateChange(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    this.updateWidthFromPointerX(event.clientX);
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (this.isStackedLayout() || this.isCollapsed) {
      return;
    }

    let handled = true;

    if (event.key === 'ArrowLeft') {
      this.setWidth(this.widthPx - 12);
    } else if (event.key === 'ArrowRight') {
      this.setWidth(this.widthPx + 12);
    } else if (event.key === 'Home') {
      this.setWidth(this.minWidthPx);
    } else if (event.key === 'End') {
      this.setWidth(this.maxWidthPx);
    } else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
      this.onViewportRefresh();
    }
  }

  private updateWidthFromPointerX(clientX: number): void {
    const rect = this.workspaceShell.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const desiredWidth = clientX - rect.left;
    this.setWidth(desiredWidth);
    this.onViewportRefresh();
  }

  private setWidth(widthPx: number, persist = true): void {
    const clamped = Math.round(clamp(widthPx, this.minWidthPx, this.maxWidthPx));
    this.widthPx = clamped;
    document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
    this.divider.setAttribute('aria-valuenow', String(clamped));

    if (!persist) {
      return;
    }

    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore persistence errors.
    }
  }

  private updateToggleButton(): void {
    this.toggleIcon.textContent = this.isCollapsed ? '>' : '<';
    const label = this.isCollapsed ? 'Expand document list' : 'Collapse document list';
    this.toggleBtn.setAttribute('aria-label', label);
    this.toggleBtn.setAttribute('title', label);
  }

  private isStackedLayout(): boolean {
    return window.matchMedia(`(max-width: ${STACKED_LAYOUT_BREAKPOINT}px)`).matches;
  }
}

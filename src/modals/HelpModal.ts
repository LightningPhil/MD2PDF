/**
 * Help modal showing documentation topics.
 */
import { BaseModal, type ModalElements } from './BaseModal.js';

export interface HelpModalElements extends ModalElements {
  body: HTMLElement;
  topicNavBtns: HTMLButtonElement[];
  topicPages: HTMLElement[];
  llmPromptCopyBtn: HTMLButtonElement;
  llmPromptText: HTMLElement;
  llmPromptCopyStatus: HTMLElement;
}

export class HelpModal extends BaseModal {
  protected readonly bodyClass = 'help-modal-open';
  
  private readonly body: HTMLElement;
  private readonly topicNavBtns: HTMLButtonElement[];
  private readonly topicPages: HTMLElement[];
  private readonly llmPromptCopyBtn: HTMLButtonElement;
  private readonly llmPromptText: HTMLElement;
  private readonly llmPromptCopyStatus: HTMLElement;
  private llmPromptCopyStatusTimer: number | null = null;

  constructor(elements: HelpModalElements) {
    super(elements);
    this.body = elements.body;
    this.topicNavBtns = elements.topicNavBtns;
    this.topicPages = elements.topicPages;
    this.llmPromptCopyBtn = elements.llmPromptCopyBtn;
    this.llmPromptText = elements.llmPromptText;
    this.llmPromptCopyStatus = elements.llmPromptCopyStatus;
    
    this.setupListeners();
  }

  private setupListeners(): void {
    // Topic navigation
    this.topicNavBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const topic = btn.dataset.topic;
        if (topic) {
          this.switchTopic(topic);
        }
      });
    });

    // LLM prompt copy button
    this.llmPromptCopyBtn.addEventListener('click', () => {
      void this.copyLlmPrompt();
    });
  }

  protected onAfterOpen(): void {
    this.resetLlmPromptCopyStatus();
    this.body.scrollTop = 0;
    this.closeBtn.focus();
  }

  protected onAfterClose(): void {
    this.resetLlmPromptCopyStatus();
  }

  private switchTopic(topicId: string): void {
    // Update navigation buttons
    this.topicNavBtns.forEach((btn) => {
      if (btn.dataset.topic === topicId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update topic pages
    this.topicPages.forEach((page) => {
      if (page.dataset.topic === topicId) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });

    // Scroll content to top
    this.body.scrollTop = 0;
  }

  private async copyLlmPrompt(): Promise<void> {
    const prompt = this.llmPromptText.textContent?.trim();
    if (!prompt) {
      this.showCopyStatus('Prompt unavailable', 'error');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        this.copyTextFallback(prompt);
      }
      this.showCopyStatus('Copied!', 'success');
    } catch {
      this.showCopyStatus('Copy failed', 'error');
    }
  }

  private copyTextFallback(text: string): void {
    const fallbackTextarea = document.createElement('textarea');
    fallbackTextarea.value = text;
    fallbackTextarea.readOnly = true;
    fallbackTextarea.style.position = 'fixed';
    fallbackTextarea.style.left = '-9999px';
    fallbackTextarea.style.top = '0';
    document.body.appendChild(fallbackTextarea);
    fallbackTextarea.select();
    fallbackTextarea.setSelectionRange(0, fallbackTextarea.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(fallbackTextarea);

    if (!copied) {
      throw new Error('Fallback clipboard copy failed');
    }
  }

  private showCopyStatus(message: string, type: 'success' | 'error'): void {
    this.resetLlmPromptCopyStatus();

    this.llmPromptCopyStatus.textContent = message;
    this.llmPromptCopyStatus.className = `llm-prompt-copy-status ${type}`;
    this.llmPromptCopyBtn.textContent = type === 'success' ? 'Copied!' : 'Copy';

    this.llmPromptCopyStatusTimer = window.setTimeout(() => {
      this.resetLlmPromptCopyStatus();
    }, 2500);
  }

  private resetLlmPromptCopyStatus(): void {
    if (this.llmPromptCopyStatusTimer !== null) {
      clearTimeout(this.llmPromptCopyStatusTimer);
      this.llmPromptCopyStatusTimer = null;
    }

    this.llmPromptCopyStatus.textContent = '';
    this.llmPromptCopyBtn.textContent = 'Copy';
  }
}

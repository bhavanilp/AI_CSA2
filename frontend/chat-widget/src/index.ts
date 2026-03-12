import { v4 as uuidv4 } from 'uuid';
import { ChatAPI } from './api';
import { Message, WidgetConfig } from './types';
import { createStyles } from './styles';

export class AICSAWidget {
  private config: WidgetConfig;
  private api: ChatAPI;
  private conversationId: string;
  private sessionId: string;
  private messages: Message[] = [];
  private isOpen: boolean = false;
  private container: HTMLElement | null = null;
  private isLoading: boolean = false;

  constructor(config: WidgetConfig) {
    if (!config.apiEndpoint || !config.organizationId) {
      throw new Error('apiEndpoint and organizationId are required');
    }

    this.config = config;
    this.api = new ChatAPI(config.apiEndpoint, config.organizationId);
    this.conversationId = this.getOrCreateConversationId();
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateConversationId(): string {
    const stored = sessionStorage.getItem('aicsa_conversation_id');
    if (stored) return stored;
    const id = uuidv4();
    sessionStorage.setItem('aicsa_conversation_id', id);
    return id;
  }

  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('aicsa_session_id');
    if (stored) return stored;
    const id = uuidv4();
    sessionStorage.setItem('aicsa_session_id', id);
    return id;
  }

  public init(): void {
    this.injectStyles();
    this.renderWidget();
    this.attachEventListeners();
    console.log('AICSA Widget initialized');
  }

  private injectStyles(): void {
    const styleElement = document.createElement('style');
    styleElement.textContent = createStyles(this.config);
    document.head.appendChild(styleElement);
  }

  private renderWidget(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'aicsa-widget-container';
    document.body.appendChild(this.container);

    // Create button
    const button = document.createElement('button');
    button.id = 'aicsa-widget-button';
    button.title = 'Chat with us';
    button.innerHTML = '💬';
    this.container.appendChild(button);

    // Create chat window
    const chatWindow = document.createElement('div');
    chatWindow.id = 'aicsa-widget-chat';
    chatWindow.innerHTML = `
      <div class="aicsa-header">
        <div class="aicsa-header-title">Support Assistant</div>
        <button class="aicsa-close-btn">&times;</button>
      </div>
      <div class="aicsa-messages"></div>
      <div class="aicsa-input-area">
        <textarea class="aicsa-input" placeholder="${this.config.theme?.placeholder || 'Type your question...'}" rows="1"></textarea>
        <button class="aicsa-send-btn">Send</button>
      </div>
    `;
    this.container.appendChild(chatWindow);

    // Add welcome message
    this.addBotMessage(this.config.theme?.welcomeMessage || 'Hi! How can we help?');
  }

  private attachEventListeners(): void {
    const button = document.getElementById('aicsa-widget-button');
    const closeBtn = document.querySelector('.aicsa-close-btn') as HTMLElement;
    const sendBtn = document.querySelector('.aicsa-send-btn') as HTMLElement;
    const input = document.querySelector('.aicsa-input') as HTMLTextAreaElement;
    const chatWindow = document.getElementById('aicsa-widget-chat');

    button?.addEventListener('click', () => this.toggleChat());
    closeBtn?.addEventListener('click', () => this.closeChat());
    sendBtn?.addEventListener('click', () => this.sendMessage());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });
  }

  private toggleChat(): void {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  private openChat(): void {
    const chatWindow = document.getElementById('aicsa-widget-chat');
    if (chatWindow) {
      chatWindow.classList.add('open');
      this.isOpen = true;
      const input = document.querySelector('.aicsa-input') as HTMLTextAreaElement;
      input?.focus();
    }
  }

  private closeChat(): void {
    const chatWindow = document.getElementById('aicsa-widget-chat');
    if (chatWindow) {
      chatWindow.classList.remove('open');
      this.isOpen = false;
    }
  }

  private async sendMessage(): Promise<void> {
    const input = document.querySelector('.aicsa-input') as HTMLTextAreaElement;
    const message = input?.value.trim();

    if (!message) return;

    // Add user message
    this.addUserMessage(message);
    input.value = '';
    input.style.height = 'auto';

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Send to API
      const response = await this.api.sendMessage(this.conversationId, message, this.sessionId);

      // Remove typing indicator
      this.removeTypingIndicator();

      // Add bot response
      this.addBotMessage(response.content, response.sources);

      // Check if escalation is needed
      if (response.should_escalate) {
        this.showEscalationModal();
      }
    } catch (error) {
      this.removeTypingIndicator();
      this.addBotMessage('Sorry, something went wrong. Please try again.');
      console.error('Failed to send message:', error);
    }
  }

  private addUserMessage(content: string): void {
    const message: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(message);
    this.renderMessage(message);
  }

  private addBotMessage(content: string, sources?: any[]): void {
    const message: Message = {
      role: 'bot',
      content,
      timestamp: new Date().toISOString(),
      sources,
    };
    this.messages.push(message);
    this.renderMessage(message);
  }

  private renderMessage(message: Message): void {
    const messagesContainer = document.querySelector('.aicsa-messages');
    if (!messagesContainer) return;

    const messageEl = document.createElement('div');
    messageEl.className = `aicsa-message ${message.role}`;

    const contentEl = document.createElement('div');
    contentEl.className = 'aicsa-message-content';
    contentEl.textContent = message.content;

    messageEl.appendChild(contentEl);

    // Add sources if available
    if (message.sources && message.sources.length > 0) {
      const sourcesEl = document.createElement('div');
      sourcesEl.className = 'aicsa-source';
      sourcesEl.innerHTML = message.sources
        .map((s) => {
          const min = typeof s.confidence_min === 'number' ? s.confidence_min : undefined;
          const max = typeof s.confidence_max === 'number' ? s.confidence_max : undefined;
          const fallback = typeof s.score === 'number' ? s.score : undefined;

          let confidenceText = '';
          if (typeof min === 'number' && typeof max === 'number') {
            confidenceText =
              Math.abs(max - min) < 0.0005
                ? ` (${max.toFixed(2)})`
                : ` (${min.toFixed(2)}-${max.toFixed(2)})`;
          } else if (typeof fallback === 'number') {
            confidenceText = ` (${fallback.toFixed(2)})`;
          }

          return `<a href="${s.url || '#'}" target="_blank">${s.name}${confidenceText}</a>`;
        })
        .join(' • ');
      contentEl.appendChild(sourcesEl);
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private showTypingIndicator(): void {
    const messagesContainer = document.querySelector('.aicsa-messages');
    if (!messagesContainer) return;

    const typingEl = document.createElement('div');
    typingEl.className = 'aicsa-message bot';
    typingEl.id = 'aicsa-typing-indicator';
    typingEl.innerHTML = `
      <div class="aicsa-typing-indicator">
        <div class="aicsa-typing-dot"></div>
        <div class="aicsa-typing-dot"></div>
        <div class="aicsa-typing-dot"></div>
      </div>
    `;

    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private removeTypingIndicator(): void {
    const typingEl = document.getElementById('aicsa-typing-indicator');
    typingEl?.remove();
  }

  private showEscalationModal(): void {
    const modal = document.createElement('div');
    modal.className = 'aicsa-escalation-modal open';
    modal.innerHTML = `
      <div class="aicsa-escalation-content">
        <div class="aicsa-escalation-title">Need more help?</div>
        <p style="margin-bottom: 16px; color: #666; font-size: 14px;">
          I can connect you with a support agent who can help further.
        </p>
        <input type="text" class="aicsa-escalation-input" placeholder="Your name" id="aicsa-escalation-name" />
        <input type="email" class="aicsa-escalation-input" placeholder="Your email" id="aicsa-escalation-email" />
        <textarea class="aicsa-escalation-input" placeholder="Additional details (optional)" rows="3" id="aicsa-escalation-message"></textarea>
        <div class="aicsa-escalation-buttons">
          <button class="aicsa-escalation-button secondary" onclick="this.closest('.aicsa-escalation-modal').remove();">Cancel</button>
          <button class="aicsa-escalation-button primary" id="aicsa-escalation-submit">Submit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const submitBtn = document.getElementById('aicsa-escalation-submit');
    submitBtn?.addEventListener('click', () => this.submitEscalation(modal));
  }

  private async submitEscalation(modal: HTMLElement): Promise<void> {
    const nameInput = document.getElementById('aicsa-escalation-name') as HTMLInputElement;
    const emailInput = document.getElementById('aicsa-escalation-email') as HTMLInputElement;
    const messageInput = document.getElementById('aicsa-escalation-message') as HTMLTextAreaElement;

    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    const message = messageInput?.value.trim();

    if (!name || !email) {
      alert('Please enter your name and email');
      return;
    }

    try {
      const response = await this.api.escalate(this.conversationId, name, email, message);
      modal.remove();
      this.addBotMessage(
        `Thank you! We've created a support ticket (${response.ticket_reference}). A support agent will contact you shortly at ${email}.`
      );

      if (this.config.onEscalate) {
        this.config.onEscalate({ ticket_reference: response.ticket_reference });
      }
    } catch (error) {
      alert('Failed to submit escalation. Please try again.');
      console.error('Escalation failed:', error);
    }
  }

  public setUser(userId: string, userEmail?: string): void {
    sessionStorage.setItem('aicsa_user_id', userId);
    if (userEmail) {
      sessionStorage.setItem('aicsa_user_email', userEmail);
    }
  }

  public open(): void {
    this.openChat();
  }

  public close(): void {
    this.closeChat();
  }

  public destroy(): void {
    this.container?.remove();
  }
}

// Global initialization function
declare global {
  interface Window {
    AICSAWidget: typeof AICSAWidget;
  }
}

if (typeof window !== 'undefined') {
  window.AICSAWidget = AICSAWidget;
}

export default AICSAWidget;

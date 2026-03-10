import { WidgetConfig, defaultTheme, defaultPosition, defaultMaxHeight, defaultZIndex } from './types';

export const createStyles = (config: WidgetConfig): string => {
  const theme = { ...defaultTheme, ...(config.theme || {}) };
  const position = config.position || defaultPosition;
  const zIndex = config.zIndex || defaultZIndex;
  const maxHeight = config.maxHeight || defaultMaxHeight;

  const positionStyles = {
    'bottom-right': 'bottom: 20px; right: 20px;',
    'bottom-left': 'bottom: 20px; left: 20px;',
    'top-right': 'top: 20px; right: 20px;',
  };

  return `
    #aicsa-widget-container {
      position: fixed;
      ${positionStyles[position]}
      z-index: ${zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    }

    #aicsa-widget-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: ${theme.primaryColor};
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    #aicsa-widget-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    #aicsa-widget-chat {
      display: none;
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 380px;
      max-height: ${maxHeight}px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);
      overflow: hidden;
      flex-direction: column;
    }

    #aicsa-widget-chat.open {
      display: flex;
    }

    .aicsa-header {
      background-color: ${theme.primaryColor};
      color: white;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e0e0e0;
    }

    .aicsa-header-title {
      font-weight: 600;
      font-size: 16px;
    }

    .aicsa-close-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 20px;
      padding: 0;
    }

    .aicsa-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background-color: #f5f5f5;
    }

    .aicsa-message {
      margin-bottom: 12px;
      display: flex;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .aicsa-message.user {
      justify-content: flex-end;
    }

    .aicsa-message-content {
      max-width: 70%;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
    }

    .aicsa-message.user .aicsa-message-content {
      background-color: ${theme.primaryColor};
      color: white;
    }

    .aicsa-message.bot .aicsa-message-content {
      background-color: #e9ecef;
      color: #333;
    }

    .aicsa-input-area {
      padding: 12px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 8px;
    }

    .aicsa-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      max-height: 80px;
    }

    .aicsa-input:focus {
      outline: none;
      border-color: ${theme.primaryColor};
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    .aicsa-send-btn {
      background-color: ${theme.primaryColor};
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .aicsa-send-btn:hover {
      opacity: 0.9;
    }

    .aicsa-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .aicsa-typing-indicator {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 10px 14px;
      background-color: #e9ecef;
      border-radius: 8px;
      width: fit-content;
    }

    .aicsa-typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #999;
      animation: typing 1.4s infinite;
    }

    .aicsa-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .aicsa-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        opacity: 0.5;
        transform: translateY(0);
      }
      30% {
        opacity: 1;
        transform: translateY(-10px);
      }
    }

    .aicsa-source {
      font-size: 12px;
      color: #666;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #ddd;
    }

    .aicsa-escalation-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: ${zIndex + 1};
      align-items: center;
      justify-content: center;
    }

    .aicsa-escalation-modal.open {
      display: flex;
    }

    .aicsa-escalation-content {
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
    }

    .aicsa-escalation-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
    }

    .aicsa-escalation-input {
      width: 100%;
      padding: 10px;
      margin-bottom: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }

    .aicsa-escalation-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .aicsa-escalation-button {
      padding: 10px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .aicsa-escalation-button.primary {
      background-color: ${theme.primaryColor};
      color: white;
    }

    .aicsa-escalation-button.primary:hover {
      opacity: 0.9;
    }

    .aicsa-escalation-button.secondary {
      background-color: #e9ecef;
      color: #333;
    }

    .aicsa-escalation-button.secondary:hover {
      background-color: #dee2e6;
    }
  `;
};

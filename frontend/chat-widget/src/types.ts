export interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
  sources?: Array<{
    source_id: string;
    name: string;
    url?: string;
    score?: number;
    confidence_min?: number;
    confidence_max?: number;
    match_count?: number;
  }>;
}

export interface WidgetConfig {
  apiEndpoint: string;
  organizationId: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    welcomeMessage?: string;
    placeholder?: string;
  };
  position?: 'bottom-right' | 'bottom-left' | 'top-right';
  maxHeight?: number;
  zIndex?: number;
  onEscalate?: (data: any) => void;
}

export const defaultTheme = {
  primaryColor: '#007bff',
  secondaryColor: '#6c757d',
  logoUrl: '',
  welcomeMessage: 'Hi! How can we help?',
  placeholder: 'Type your question...',
};

export const defaultPosition = 'bottom-right';
export const defaultZIndex = 9999;
export const defaultMaxHeight = 600;

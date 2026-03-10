import axios, { AxiosInstance } from 'axios';

export class ChatAPI {
  private client: AxiosInstance;
  private organizationId: string;

  constructor(apiEndpoint: string, organizationId: string) {
    this.client = axios.create({
      baseURL: apiEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.organizationId = organizationId;
  }

  async sendMessage(conversationId: string, message: string, sessionId: string): Promise<any> {
    try {
      const response = await this.client.post('/api/chat/message', {
        conversation_id: conversationId,
        message,
        session_id: sessionId,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async escalate(conversationId: string, userName: string, userEmail: string, message?: string): Promise<any> {
    try {
      const response = await this.client.post('/api/chat/escalate', {
        conversation_id: conversationId,
        user_name: userName,
        user_email: userEmail,
        message,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to escalate:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/chat/conversation/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get conversation:', error);
      throw error;
    }
  }
}

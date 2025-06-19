export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
}

export interface Message {
  id: string;
  text: string;
  timestamp: number;
  senderId: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read';
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status?: 'online' | 'offline' | 'away';
  lastSeen?: number;
}
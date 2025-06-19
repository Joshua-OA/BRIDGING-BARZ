import { Conversation, Message, User } from '@/types/chat';

// Mock users data
export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'Sarah Johnson',
    avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
    status: 'online'
  },
  {
    id: 'user2',
    name: 'Mike Peterson',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    status: 'offline',
    lastSeen: Date.now() - 3600000 // 1 hour ago
  },
  {
    id: 'user3',
    name: 'Emily Chen',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    status: 'online'
  },
  {
    id: 'user4',
    name: 'David Wilson',
    avatar: 'https://randomuser.me/api/portraits/men/86.jpg',
    status: 'away',
    lastSeen: Date.now() - 900000 // 15 minutes ago
  },
  {
    id: 'user5',
    name: 'Alex Morgan',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    status: 'online'
  },
  {
    id: 'user6',
    name: 'James Richards',
    avatar: 'https://randomuser.me/api/portraits/men/41.jpg',
    status: 'offline',
    lastSeen: Date.now() - 86400000 // 1 day ago
  },
  {
    id: 'user7',
    name: 'Team Project',
    avatar: 'https://randomuser.me/api/portraits/men/20.jpg',
    status: 'online'
  }
];

// Mock conversations data
export const mockConversations: Conversation[] = [
  {
    id: 'conv1',
    name: 'Sarah Johnson',
    avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
    lastMessage: 'Are we still meeting for coffee tomorrow?',
    timestamp: Date.now() - 600000, // 10 minutes ago
    unreadCount: 2
  },
  {
    id: 'conv2',
    name: 'Mike Peterson',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    lastMessage: 'I sent you the project files. Let me know what you think!',
    timestamp: Date.now() - 3600000, // 1 hour ago
    unreadCount: 0
  },
  {
    id: 'conv3',
    name: 'Emily Chen',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    lastMessage: 'Thanks for the help yesterday! It worked perfectly.',
    timestamp: Date.now() - 86400000, // 1 day ago
    unreadCount: 0
  },
  {
    id: 'conv4',
    name: 'David Wilson',
    avatar: 'https://randomuser.me/api/portraits/men/86.jpg',
    lastMessage: 'Don\'t forget about the meeting at 3 PM today.',
    timestamp: Date.now() - 43200000, // 12 hours ago
    unreadCount: 1
  },
  {
    id: 'conv5',
    name: 'Alex Morgan',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    lastMessage: 'Did you get a chance to review the proposal?',
    timestamp: Date.now() - 172800000, // 2 days ago
    unreadCount: 0
  },
  {
    id: 'conv6',
    name: 'James Richards',
    avatar: 'https://randomuser.me/api/portraits/men/41.jpg',
    lastMessage: 'Hey, how\'s it going?',
    timestamp: Date.now() - 259200000, // 3 days ago
    unreadCount: 0
  },
  {
    id: 'conv7',
    name: 'Team Project',
    avatar: 'https://randomuser.me/api/portraits/men/20.jpg',
    lastMessage: 'Jason: We need to discuss the timeline for next week.',
    timestamp: Date.now() - 10800000, // 3 hours ago
    unreadCount: 5
  }
];

// Mock messages for a conversation
export const mockMessages: Record<string, Message[]> = {
  conv1: [
    {
      id: 'msg1',
      text: 'Hey Sarah, how are you?',
      timestamp: Date.now() - 86400000, // 1 day ago
      senderId: 'currentUser',
      conversationId: 'conv1',
      status: 'read'
    },
    {
      id: 'msg2',
      text: 'I\'m good, thanks! How about you?',
      timestamp: Date.now() - 86340000, // 23 hours and 59 minutes ago
      senderId: 'user1',
      conversationId: 'conv1',
      status: 'read'
    },
    {
      id: 'msg3',
      text: 'Pretty good. Do you want to grab coffee tomorrow?',
      timestamp: Date.now() - 3600000, // 1 hour ago
      senderId: 'currentUser',
      conversationId: 'conv1',
      status: 'read'
    },
    {
      id: 'msg4',
      text: 'Sure, that sounds great!',
      timestamp: Date.now() - 3540000, // 59 minutes ago
      senderId: 'user1',
      conversationId: 'conv1',
      status: 'read'
    },
    {
      id: 'msg5',
      text: 'What time works for you?',
      timestamp: Date.now() - 900000, // 15 minutes ago
      senderId: 'user1',
      conversationId: 'conv1',
      status: 'delivered'
    },
    {
      id: 'msg6',
      text: 'Are we still meeting for coffee tomorrow?',
      timestamp: Date.now() - 600000, // 10 minutes ago
      senderId: 'user1',
      conversationId: 'conv1',
      status: 'delivered'
    }
  ],
  // Other conversations would have similar message arrays
};
import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import ConversationHeader from '@/components/chat/ConversationHeader';
import MessageBubble from '@/components/chat/MessageBubble';
import { mockMessages, mockConversations } from '@/data/mockChatData';
import { Message } from '@/types/chat';

// Platform-specific WebRTC imports
let RTCPeerConnection: any;

if (Platform.OS !== 'web') {
  try {
    const WebRTC = require('react-native-webrtc');
    RTCPeerConnection = WebRTC.RTCPeerConnection;
  } catch (e) {
    console.log(
      'Could not load react-native-webrtc. WebRTC features will not be available on native in Expo Go.'
    );
  }
} else {
  RTCPeerConnection = window.RTCPeerConnection;
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState(() =>
    mockConversations.find((conv) => conv.id === id)
  );
  const [messages, setMessages] = useState<Message[]>(
    mockMessages[id as string] || []
  );
  const peerConnection = useRef<any>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!RTCPeerConnection) {
      console.warn('WebRTC not supported on this platform');
      return;
    }

    // Initialize WebRTC connection
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };

    peerConnection.current = new RTCPeerConnection(configuration);

    // Create data channel for text chat
    if (peerConnection.current) {
      dataChannel.current = peerConnection.current.createDataChannel('chat');

      if (dataChannel.current) {
        dataChannel.current.onmessage = (event) => {
          const receivedMessage: Message = JSON.parse(event.data);
          setMessages((prev) => [receivedMessage, ...prev]);
        };
      }
    }

    return () => {
      if (dataChannel.current) {
        dataChannel.current.close();
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      text: message,
      timestamp: Date.now(),
      senderId: 'currentUser',
      conversationId: id as string,
      status: 'sent',
    };

    // Send message through WebRTC data channel if available
    if (dataChannel.current?.readyState === 'open') {
      dataChannel.current.send(JSON.stringify(newMessage));
    }

    setMessages((prev) => [newMessage, ...prev]);
    setMessage('');

    // Simulate message delivery status update
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: 'delivered' } : msg
        )
      );
    }, 1000);
  };

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages]);

  if (!conversation) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Counselor not found</Text>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ConversationHeader
        name={conversation.name}
        avatar={conversation.avatar}
        onBack={handleBack}
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isCurrentUser={item.senderId === 'currentUser'}
          />
        )}
        inverted
        contentContainerStyle={styles.messagesList}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={message}
          onChangeText={setMessage}
          multiline
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !message.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={!message.trim()}
        >
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  notFoundText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#4B5563',
    marginBottom: 16,
  },
  backButton: {
    padding: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
});

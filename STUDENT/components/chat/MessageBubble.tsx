import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { Message } from '@/types/chat';
import { formatDistanceToNow } from '@/utils/dateUtils';

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
}

export default function MessageBubble({ message, isCurrentUser }: MessageBubbleProps) {
  const { text, timestamp, status } = message;
  
  const renderStatus = () => {
    if (!isCurrentUser) return null;
    
    if (status === 'sent') {
      return <Check size={14} color="#9CA3AF" />;
    } else if (status === 'delivered') {
      return <CheckCheck size={14} color="#9CA3AF" />;
    } else if (status === 'read') {
      return <CheckCheck size={14} color="#3B82F6" />;
    }
    
    return null;
  };
  
  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
    ]}>
      <View style={[
        styles.bubble,
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
      ]}>
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.currentUserText : styles.otherUserText
        ]}>
          {text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {formatDistanceToNow(timestamp)}
          </Text>
          {renderStatus()}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
  },
  otherUserContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currentUserBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#1F2937',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginRight: 4,
  },
});
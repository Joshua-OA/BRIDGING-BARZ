import React, { ReactNode } from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';

interface InputFieldProps extends TextInputProps {
  icon: ReactNode;
}

export default function InputField({ icon, ...props }: InputFieldProps) {
  return (
    <View style={styles.inputContainer}>
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <TextInput
        style={styles.input}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  iconContainer: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
});
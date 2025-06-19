import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { LogIn, QrCode } from 'lucide-react-native';
import InputField from '@/components/auth/InputField';
import AuthHeader from '@/components/auth/AuthHeader';

export default function SignInScreen() {
  const { signIn, isLoading } = useAuth();
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!userId || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError('');
      await signIn(userId, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError('Invalid user ID or password');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <AuthHeader
          title="Welcome!"
          subtitle="Connect with your counselor"
          icon={<LogIn size={32} color="#3B82F6" />}
        />

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <InputField
            icon={<QrCode size={20} color="#6B7280" />}
            placeholder="User ID"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />

          <InputField
            icon={<LogIn size={20} color="#6B7280" />}
            placeholder="Access Key"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>First time here?</Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.signUpLink}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  form: {
    marginTop: 32,
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  signInButton: {
    backgroundColor: '#3B82F6',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signInButtonText: {
    color: 'white',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signUpText: {
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  signUpLink: {
    color: '#3B82F6',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 4,
  },
});

import { useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const navigateToNextScreen = () => {
    const route = isAuthenticated ? '/(tabs)' : '/(auth)/sign-in';
    router.replace(route);
  };

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 800 }),
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 500 }, (finished) => {
        if (finished) {
          runOnJS(navigateToNextScreen)();
        }
      })
    );

    scale.value = withSequence(
      withTiming(1, { duration: 800 }),
      withTiming(1.1, { duration: 1000 }),
      withTiming(1, { duration: 500 })
    );
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        <Image
          source={{ uri: 'https://placekitten.com/200/200' }}
          style={styles.logo}
        />
        <Text style={styles.appName}>Bridging Barz</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
  appName: {
    marginTop: 16,
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

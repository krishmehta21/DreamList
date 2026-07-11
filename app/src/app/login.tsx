import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DL, DLFonts } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tactile Pressable Wrapper for Micro-Animations
function TactilePressable({ onPress, style, children, disabled }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={styles.tactileWrapper}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);

  const isLoading = loading || authLoading;

  // Animation values
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;
  const tabTranslateX = useRef(new Animated.Value(0)).current;

  // Background glow animations
  const glow1Anim = useRef(new Animated.Value(0)).current;
  const glow2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance animation
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle breathing background glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow1Anim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow1Anim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow2Anim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow2Anim, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Animate sliding tab pill
  useEffect(() => {
    Animated.spring(tabTranslateX, {
      toValue: activeTab === 'signin' ? 0 : 120,
      useNativeDriver: true,
      tension: 60,
      friction: 7,
    }).start();
  }, [activeTab]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  // Simplified One-Tap Demo Access Login
  const handleDemoLogin = async () => {
    const demoEmail = 'demo@dreamlist.app';
    const demoPassword = 'demopassword123';
    setError(null);
    setLoading(true);
    try {
      try {
        await signIn(demoEmail, demoPassword);
      } catch (signInErr: any) {
        // If demo user does not exist (e.g. fresh database setup), sign them up once
        const isCredError =
          signInErr.message?.toLowerCase().includes('invalid login credentials') ||
          signInErr.status === 400 ||
          signInErr.status === 401;
          
        if (isCredError) {
          await signUp(demoEmail, demoPassword);
          await signIn(demoEmail, demoPassword);
        } else {
          throw signInErr;
        }
      }
      router.replace('/');
    } catch (e: any) {
      setError('Demo login failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Background glow styles
  const glow1Style = {
    transform: [
      {
        scale: glow1Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.2],
        }),
      },
    ],
    opacity: glow1Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.15, 0.25],
    }),
  };

  const glow2Style = {
    transform: [
      {
        scale: glow2Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.3],
        }),
      },
    ],
    opacity: glow2Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.08, 0.18],
    }),
  };

  return (
    <View style={styles.screen}>
      {/* Decorative blurred background glows */}
      <Animated.View style={[styles.glowBubble, styles.glowViolet, glow1Style]} />
      <Animated.View style={[styles.glowBubble, styles.glowCyan, glow2Style]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>DreamList</Text>
            <Text style={styles.subtitle}>Curate your wants, tracked by AI</Text>
          </View>

          {/* Sliding Tab Controller */}
          <View style={styles.tabContainer}>
            <Animated.View
              style={[
                styles.slidingPill,
                { transform: [{ translateX: tabTranslateX }] },
              ]}
            />
            <Pressable
              style={styles.tabButton}
              onPress={() => {
                setActiveTab('signin');
                setError(null);
              }}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'signin' && styles.tabButtonTextActive,
                ]}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={styles.tabButton}
              onPress={() => {
                setActiveTab('signup');
                setError(null);
              }}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'signup' && styles.tabButtonTextActive,
                ]}
              >
                Register
              </Text>
            </Pressable>
          </View>

          {/* Inputs Section */}
          <View style={styles.form}>
            {/* Email Input */}
            <View
              style={[
                styles.inputWrapper,
                focusedInput === 'email' && styles.inputWrapperFocused,
              ]}
            >
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={DL.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
                textContentType="emailAddress"
                autoComplete="email"
              />
              {email.length > 0 && !isLoading && (
                <Pressable onPress={() => setEmail('')} hitSlop={8}>
                  <Text style={styles.clearIcon}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* Password Input */}
            <View
              style={[
                styles.inputWrapper,
                focusedInput === 'password' && styles.inputWrapperFocused,
              ]}
            >
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={DL.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                textContentType="password"
                autoComplete="password"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Action Button */}
          <TactilePressable
            style={styles.primaryButton}
            onPress={activeTab === 'signin' ? handleSignIn : handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#0B0D10" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TactilePressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* One-Tap Demo Button */}
          <TactilePressable
            style={styles.demoButton}
            onPress={handleDemoLogin}
            disabled={isLoading}
          >
            <View style={styles.demoButtonContent}>
              <Text style={styles.demoButtonText}>✨ One-Tap Demo Access</Text>
              <Text style={styles.demoButtonSub}>Instant preview — no sign up</Text>
            </View>
          </TactilePressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0D10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  glowBubble: {
    position: 'absolute',
    borderRadius: 999,
    width: 250,
    height: 250,
    filter: Platform.OS === 'web' ? 'blur(80px)' : undefined, // web support
  },
  glowViolet: {
    top: '15%',
    left: '10%',
    backgroundColor: DL.dream,
  },
  glowCyan: {
    bottom: '15%',
    right: '10%',
    backgroundColor: DL.soon,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#121519',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 24,
    padding: 28,
    gap: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 4,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: DL.text,
    fontFamily: DLFonts.sans,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    padding: 4,
    position: 'relative',
    height: 44,
    width: 248,
    alignSelf: 'center',
    borderWidth: 1.2,
    borderColor: DL.border,
  },
  slidingPill: {
    position: 'absolute',
    width: 120,
    height: 34,
    backgroundColor: '#121519',
    borderRadius: 10,
    top: 4,
    left: 4,
    borderWidth: 1.2,
    borderColor: DL.border,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: DL.muted,
    fontFamily: DLFonts.sans,
  },
  tabButtonTextActive: {
    color: DL.text,
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: DL.soon,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    color: DL.text,
    fontSize: 14,
    fontFamily: DLFonts.sans,
  },
  clearIcon: {
    color: DL.muted,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  eyeBtn: {
    paddingHorizontal: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    color: DL.danger,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: DLFonts.sans,
  },
  tactileWrapper: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: DL.now,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B0D10',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: DL.muted,
    fontSize: 10,
    fontWeight: '700',
    marginHorizontal: 12,
    fontFamily: DLFonts.mono,
  },
  demoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoButtonContent: {
    alignItems: 'center',
  },
  demoButtonText: {
    color: DL.text,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  demoButtonSub: {
    color: DL.muted,
    fontSize: 10,
    marginTop: 2,
    fontFamily: DLFonts.sans,
  },
});

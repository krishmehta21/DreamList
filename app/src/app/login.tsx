import React, { useState, useRef, useCallback } from 'react';
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
  Dimensions,
  ScrollView,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Line, Defs, LinearGradient as SvgGradient, Stop, G, Ellipse } from 'react-native-svg';
import { DLFonts } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { CustomAlert as Alert } from '@/components/CustomAlert';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SW - 48, 380);

// ─── Decorative Sparkle Stars ──────────────────────────────────────────────────

function Sparkle({ x, y, size = 8, color = '#C7D2FE' }: { x: number; y: number; size?: number; color?: string }) {
  const hs = size / 2;
  return (
    <Path
      d={`M ${x} ${y - hs} Q ${x} ${y} ${x + hs} ${y} Q ${x} ${y} ${x} ${y + hs} Q ${x} ${y} ${x - hs} ${y} Q ${x} ${y} ${x} ${y - hs}`}
      fill={color}
    />
  );
}

// ─── Welcome Illustration: Person using phone with checklist ───────────────────

function WelcomeIllustration() {
  return (
    <View style={styles.illustrationWrap}>
      <Svg width={200} height={140} viewBox="0 0 200 140" fill="none">
        {/* Sparkles */}
        <Sparkle x={32} y={22} size={10} color="#818CF8" />
        <Sparkle x={170} y={30} size={12} color="#5046E5" />
        <Sparkle x={178} y={90} size={6} color="#C7D2FE" />
        <Circle cx={182} cy={18} r={5} stroke="#C7D2FE" strokeWidth={1.2} fill="none" />
        <Circle cx={22} cy={58} r={3} stroke="#818CF8" strokeWidth={1.2} fill="none" />
        <Circle cx={120} cy={12} r={2.5} fill="#5046E5" />

        {/* Ground shadow */}
        <Ellipse cx={100} cy={132} rx={72} ry={4} fill="#E2E8F0" opacity={0.5} />

        {/* Phone body */}
        <Rect x={48} y={14} width={62} height={110} rx={12} fill="#FFFFFF" stroke="#1E1B4B" strokeWidth={2} />
        {/* Notch */}
        <Rect x={68} y={18} width={22} height={3} rx={1.5} fill="#CBD5E1" />
        {/* Screen content - note card */}
        <Rect x={56} y={30} width={46} height={36} rx={6} fill="#F1F5F9" stroke="#E2E8F0" strokeWidth={1} />
        <Line x1={62} y1={39} x2={90} y2={39} stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
        <Line x1={62} y1={45} x2={84} y2={45} stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
        <Line x1={62} y1={51} x2={76} y2={51} stroke="#CBD5E1" strokeWidth={1.5} strokeLinecap="round" />
        {/* Checkmark circle */}
        <Circle cx={79} cy={82} r={10} fill="#5046E5" />
        <Path d="M 74 82 L 77.5 85.5 L 84 79" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Screen bottom bar */}
        <Rect x={64} y={102} width={30} height={4} rx={2} fill="#E2E8F0" />

        {/* Character */}
        {/* Head */}
        <Circle cx={142} cy={42} r={8} fill="#FDE68A" />
        {/* Hair */}
        <Path d="M 135 38 Q 142 30 149 38 Q 150 42 148 44 Q 142 39 135 41 Z" fill="#1E1B4B" />
        {/* Body - indigo shirt */}
        <Path d="M 134 52 L 150 52 L 152 78 L 132 78 Z" fill="#5046E5" />
        {/* Arm pointing at phone */}
        <Path d="M 134 56 Q 122 64 114 68" stroke="#5046E5" strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <Circle cx={113} cy={69} r={2.5} fill="#FDE68A" />
        {/* Other arm */}
        <Path d="M 150 56 Q 158 64 160 70" stroke="#5046E5" strokeWidth={3} strokeLinecap="round" fill="none" />
        <Circle cx={160.5} cy={71} r={2} fill="#FDE68A" />
        {/* Legs */}
        <Line x1={138} y1={78} x2={137} y2={128} stroke="#1E1B4B" strokeWidth={4} strokeLinecap="round" />
        <Line x1={146} y1={78} x2={156} y2={127} stroke="#1E1B4B" strokeWidth={4} strokeLinecap="round" />
        {/* Shoes */}
        <Rect x={132} y={127} width={8} height={3.5} rx={1.5} fill="#1E1B4B" />
        <Rect x={155} y={126} width={8} height={3.5} rx={1.5} fill="#1E1B4B" />
      </Svg>
    </View>
  );
}

// ─── Portal Illustration: Person approaching a door ────────────────────────────

function PortalIllustration() {
  return (
    <View style={styles.illustrationWrap}>
      <Svg width={200} height={130} viewBox="0 0 200 130" fill="none">
        {/* Sparkles */}
        <Sparkle x={38} y={18} size={10} color="#5046E5" />
        <Sparkle x={168} y={28} size={10} color="#818CF8" />
        <Circle cx={18} cy={42} r={4} stroke="#5046E5" strokeWidth={1.2} fill="none" />
        <Circle cx={184} cy={16} r={3} fill="#5046E5" />

        {/* Ground shadow */}
        <Ellipse cx={100} cy={124} rx={72} ry={4} fill="#E2E8F0" opacity={0.5} />

        {/* Soft leaf shapes */}
        <Path d="M 48 124 Q 34 96 50 86 Q 62 102 60 124 Z" fill="#F1F5F9" />
        <Path d="M 140 124 Q 162 94 148 84 Q 138 100 138 124 Z" fill="#F1F5F9" />

        {/* Arch doorway */}
        <Path d="M 70 124 L 70 56 A 24 24 0 0 1 118 56 L 118 124 Z" fill="#CBD5E1" />
        {/* Door panels */}
        <Rect x={78} y={58} width={14} height={22} rx={2} fill="#FFFFFF" />
        <Rect x={96} y={58} width={14} height={22} rx={2} fill="#FFFFFF" />
        <Rect x={78} y={84} width={14} height={26} rx={2} fill="#FFFFFF" />
        <Rect x={96} y={84} width={14} height={26} rx={2} fill="#FFFFFF" />
        {/* Door knob */}
        <Circle cx={102} cy={96} r={2.5} fill="#5046E5" />

        {/* Character */}
        <Circle cx={146} cy={52} r={7} fill="#FDE68A" />
        <Path d="M 140 48 Q 146 42 152 48 Q 153 52 151 54 Q 146 50 140 52 Z" fill="#1E1B4B" />
        <Path d="M 140 61 L 152 61 L 151 84 L 139 84 Z" fill="#5046E5" />
        {/* Arm reaching for knob */}
        <Path d="M 140 65 Q 130 75 126 84" stroke="#5046E5" strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <Circle cx={125} cy={85} r={2} fill="#FDE68A" />
        {/* Legs */}
        <Line x1={143} y1={84} x2={143} y2={121} stroke="#1E1B4B" strokeWidth={3.8} strokeLinecap="round" />
        <Line x1={149} y1={84} x2={149} y2={121} stroke="#1E1B4B" strokeWidth={3.8} strokeLinecap="round" />
        <Rect x={139} y={120} width={7} height={3} rx={1.5} fill="#1E1B4B" />
        <Rect x={147} y={120} width={7} height={3} rx={1.5} fill="#1E1B4B" />
      </Svg>
    </View>
  );
}

// ─── Main Login Screen ─────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, loading: authLoading } = useAuth();

  const [viewMode, setViewMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isLoading = loading || authLoading;

  // Animation
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;

  const transitionTo = useCallback((nextMode: 'welcome' | 'login' | 'signup') => {
    Vibration.vibrate(8);
    setError(null);
    Animated.timing(cardOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setViewMode(nextMode);
      cardTranslateY.setValue(14);
      Animated.parallel([
        Animated.spring(cardOpacity, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 300,
          mass: 0.8,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 300,
          mass: 0.8,
        }),
      ]).start();
    });
  }, [cardOpacity, cardTranslateY]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
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

  const handleDemoLogin = async () => {
    const demoEmail = 'demo@dreamlist.app';
    const demoPassword = 'demopassword123';
    setError(null);
    setLoading(true);
    try {
      try {
        await signIn(demoEmail, demoPassword);
      } catch (signInErr: any) {
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
    } catch (_e: any) {
      setError('Demo login failed. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Vibration.vibrate(8);
    Alert.alert(
      'Reset Password',
      'Enter your email on the login form and we\'ll send you a password reset link.',
      [{ text: 'Got It' }]
    );
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderFormInput = (
    label: string,
    fieldKey: string,
    value: string,
    onChangeText: (t: string) => void,
    options?: {
      placeholder?: string;
      keyboardType?: 'email-address' | 'default';
      autoCapitalize?: 'none' | 'words';
      secureTextEntry?: boolean;
      isPassword?: boolean;
    }
  ) => {
    const isFocused = focusedField === fieldKey;
    return (
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, isFocused && styles.fieldLabelFocused]}>{label}</Text>
        <View style={[styles.fieldRow, isFocused && styles.fieldRowFocused]}>
          <TextInput
            style={styles.fieldInput}
            placeholder={options?.placeholder}
            placeholderTextColor="#B0BEC5"
            keyboardType={options?.keyboardType || 'default'}
            autoCapitalize={options?.autoCapitalize || 'none'}
            autoCorrect={false}
            secureTextEntry={options?.secureTextEntry && !showPassword}
            value={value}
            onChangeText={onChangeText}
            editable={!isLoading}
            onFocus={() => setFocusedField(fieldKey)}
            onBlur={() => setFocusedField(null)}
          />
          {options?.isPassword && (
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={10}>
              <Text style={styles.eyeIcon}>{showPassword ? '👁' : '🔒'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Gradient background */}
      <LinearGradient
        colors={['#4338CA', '#3730A3', '#312E81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating decorative circles */}
      <View style={styles.deco1} pointerEvents="none" />
      <View style={styles.deco2} pointerEvents="none" />
      <View style={styles.deco3} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
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
            {/* ══════════════════════════════════════════════════════════════
                WELCOME VIEW
               ══════════════════════════════════════════════════════════════ */}
            {viewMode === 'welcome' && (
              <View style={styles.viewBody}>
                <WelcomeIllustration />

                <Text style={styles.heroTitle}>Hello</Text>
                <Text style={styles.heroSub}>
                  Welcome to DreamList, where you{'\n'}manage your financial dreams
                </Text>

                <View style={styles.actionGroup}>
                  <Pressable
                    style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnScale]}
                    onPress={() => transitionTo('login')}
                  >
                    <LinearGradient
                      colors={['#5046E5', '#4338CA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnGradient}
                    >
                      <Text style={styles.btnPrimaryText}>Login</Text>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.btnOutline, pressed && styles.btnScale]}
                    onPress={() => transitionTo('signup')}
                  >
                    <Text style={styles.btnOutlineText}>Sign Up</Text>
                  </Pressable>
                </View>

                {/* Separator */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Demo button */}
                <Pressable
                  style={({ pressed }) => [styles.btnDemo, pressed && styles.btnScale]}
                  onPress={handleDemoLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#5046E5" />
                  ) : (
                    <Text style={styles.btnDemoText}>⚡  Try Instant Demo</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════
                LOGIN / SIGNUP VIEW
               ══════════════════════════════════════════════════════════════ */}
            {viewMode !== 'welcome' && (
              <View style={styles.viewBody}>
                {/* Back arrow */}
                <Pressable
                  style={styles.backBtn}
                  onPress={() => transitionTo('welcome')}
                  hitSlop={14}
                >
                  <Text style={styles.backArrow}>‹</Text>
                </Pressable>

                <PortalIllustration />

                <Text style={styles.formHeading}>
                  {viewMode === 'login' ? 'Login' : 'Sign Up'}
                </Text>

                {/* Form */}
                <View style={styles.formArea}>
                  {viewMode === 'signup' &&
                    renderFormInput('Name', 'name', name, setName, {
                      placeholder: 'Your full name',
                      autoCapitalize: 'words',
                    })
                  }

                  {renderFormInput('Email', 'email', email, setEmail, {
                    placeholder: 'you@example.com',
                    keyboardType: 'email-address',
                  })}

                  {renderFormInput('Password', 'password', password, setPassword, {
                    placeholder: '••••••••',
                    secureTextEntry: true,
                    isPassword: true,
                  })}

                  {/* Forgot password */}
                  {viewMode === 'login' && (
                    <Pressable onPress={handleForgotPassword} style={styles.forgotBtn} hitSlop={8}>
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </Pressable>
                  )}

                  {/* Error */}
                  {error && (
                    <View style={styles.errorBubble}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* Submit */}
                  <Pressable
                    style={({ pressed }) => [styles.btnPrimary, styles.btnSubmit, pressed && styles.btnScale]}
                    onPress={viewMode === 'login' ? handleSignIn : handleSignUp}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={['#5046E5', '#4338CA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnGradient}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.btnPrimaryText}>
                          {viewMode === 'login' ? 'Log In' : 'Create Account'}
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>

                  {/* Toggle */}
                  <Pressable
                    onPress={() => transitionTo(viewMode === 'login' ? 'signup' : 'login')}
                    style={styles.toggleRow}
                    hitSlop={8}
                  >
                    <Text style={styles.toggleText}>
                      {viewMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                      <Text style={styles.toggleBold}>
                        {viewMode === 'login' ? 'Sign Up' : 'Log In'}
                      </Text>
                    </Text>
                  </Pressable>

                  {/* Demo */}
                  <Pressable
                    style={({ pressed }) => [styles.btnDemo, { marginTop: 6 }, pressed && styles.btnScale]}
                    onPress={handleDemoLogin}
                    disabled={isLoading}
                  >
                    <Text style={styles.btnDemoText}>⚡  Instant Demo Access</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Footer branding */}
          <Text style={styles.footerText}>DreamList · Smart Finance</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#312E81',
  },

  // Floating decorative circles
  deco1: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  deco2: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(49, 46, 129, 0.35)',
  },
  deco3: {
    position: 'absolute',
    top: '30%',
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },

  kav: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },

  // White card
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  viewBody: {
    width: '100%',
    alignItems: 'center',
  },

  // Illustration
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: -4,
  },

  // Back button
  backBtn: {
    position: 'absolute',
    top: -12,
    left: -10,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '600',
    color: '#4338CA',
    marginTop: -2,
  },

  // ─── Welcome View ────────────────────────────────────────────────────────────
  heroTitle: {
    fontFamily: DLFonts.sans,
    fontSize: 32,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSub: {
    fontFamily: DLFonts.sans,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  actionGroup: {
    width: '100%',
    gap: 14,
    marginBottom: 22,
  },

  // Primary gradient button
  btnPrimary: {
    width: '100%',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnGradient: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    paddingHorizontal: 24,
  },
  btnPrimaryText: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // Outlined button
  btnOutline: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    borderWidth: 1.8,
    borderColor: '#5046E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnOutlineText: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: '#5046E5',
    letterSpacing: 0.4,
  },

  btnScale: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: '#94A3B8',
    marginHorizontal: 14,
    fontWeight: '500',
  },

  // Demo button
  btnDemo: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDemoText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#5046E5',
    letterSpacing: 0.2,
  },

  // ─── Form View ───────────────────────────────────────────────────────────────
  formHeading: {
    fontFamily: DLFonts.sans,
    fontSize: 28,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  formArea: {
    width: '100%',
  },

  // Field group (underline style like reference)
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldLabelFocused: {
    color: '#5046E5',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  fieldRowFocused: {
    borderBottomColor: '#5046E5',
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontFamily: DLFonts.sans,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 0,
  },

  eyeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },

  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 18,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Error
  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontFamily: DLFonts.sans,
    fontSize: 12.5,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },

  btnSubmit: {
    marginTop: 4,
    marginBottom: 18,
  },

  toggleRow: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  toggleText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: '#64748B',
  },
  toggleBold: {
    fontWeight: '800',
    color: '#5046E5',
  },

  // Footer
  footerText: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

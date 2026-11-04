import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Wrench,
  Building2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { GradientButton } from '../../components/GradientButton';
import { useAuth } from '../../contexts/AuthContext';
import { FONT } from '../../constants/theme';
import {
  verificarCodigoTotpMfa,
  solicitarRecuperacao2faAdmin,
} from '../../lib/condoConfigApi';
import { traduzirErroServidor } from '../../constants/configTexts';

import { PostLoginLoader } from '../../components/PostLoginLoader';
import { TurnstileWidget } from '../../components/TurnstileWidget';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    signIn,
    isPrestador,
    isContaBloqueadaSindico,
    signOut,
    mfaRequired,
    mfaFactorId,
    clearMfaRequired,
    startPostLogin,
    finishPostLogin,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [notPrestadorModalOpen, setNotPrestadorModalOpen] = useState(false);

  useEffect(() => {
    if (isContaBloqueadaSindico) {
      setNotPrestadorModalOpen(true);
    }
  }, [isContaBloqueadaSindico]);

  // Estados 2FA TOTP no login e recuperação via Admin
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryMotivo, setRecoveryMotivo] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState('');

  // Estados CAPTCHA Turnstile e Recuperação de Senha por E-mail
  const isCaptchaEnabled = process.env.EXPO_PUBLIC_CAPTCHA_ENABLED === 'true';
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaTokenRef = useRef<string | null>(null);
  const [captchaTokenTime, setCaptchaTokenTime] = useState<number>(0);
  const [turnstileResetKey, setTurnstileResetKey] = useState<number>(0);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setError('Informe o e-mail para receber as instruções.');
      return;
    }
    
    setForgotLoading(true);
    let token = captchaTokenRef.current || captchaToken;

    if (isCaptchaEnabled) {
      if (!token) {
        const start = Date.now();
        while (!token && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 120));
          token = captchaTokenRef.current;
        }
      }

      if (!token) {
        setForgotLoading(false);
        setError('Não foi possível verificar, tente novamente');
        setTurnstileResetKey((k) => k + 1);
        return;
      }

      const now = Date.now();
      if (captchaTokenTime > 0 && now - captchaTokenTime > 4 * 60 * 1000) {
        setForgotLoading(false);
        setError('A verificação de segurança expirou. Por favor, tente novamente.');
        setCaptchaToken(null);
        captchaTokenRef.current = null;
        setCaptchaTokenTime(0);
        setTurnstileResetKey((k) => k + 1);
        return;
      }
    }

    const tokenToSend = isCaptchaEnabled ? token : undefined;
    setCaptchaToken(null);
    captchaTokenRef.current = null;
    setCaptchaTokenTime(0);

    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        ...(tokenToSend ? { captchaToken: tokenToSend } : {}),
      });
      // Resposta genérica anti-enumeração (LGPD / OWASP)
      setForgotMsg('Se este e-mail estiver cadastrado, você receberá um link seguro para redefinir sua senha.');
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (
        errMsg.toLowerCase().includes('captcha') ||
        errMsg.toLowerCase().includes('disallowed')
      ) {
        setError('Não foi possível verificar, tente novamente');
      } else {
        setForgotMsg('Se este e-mail estiver cadastrado, você receberá um link seguro para redefinir sua senha.');
      }
    } finally {
      setForgotLoading(false);
      if (isCaptchaEnabled) setTurnstileResetKey((k) => k + 1);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Por favor, preencha seu e-mail e senha.');
      return;
    }

    setError('');
    setLoading(true);

    let token = captchaTokenRef.current || captchaToken;

    if (isCaptchaEnabled) {
      if (!token) {
        const start = Date.now();
        while (!token && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 120));
          token = captchaTokenRef.current;
        }
      }

      if (!token) {
        setLoading(false);
        setError('Não foi possível verificar, tente novamente');
        setTurnstileResetKey((k) => k + 1);
        return;
      }

      const now = Date.now();
      if (captchaTokenTime > 0 && now - captchaTokenTime > 4 * 60 * 1000) {
        setLoading(false);
        setError('A verificação de segurança expirou. Por favor, tente novamente.');
        setCaptchaToken(null);
        captchaTokenRef.current = null;
        setCaptchaTokenTime(0);
        setTurnstileResetKey((k) => k + 1);
        return;
      }
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const tokenToSend = isCaptchaEnabled ? (token || undefined) : undefined;
    setCaptchaToken(null);
    captchaTokenRef.current = null;
    setCaptchaTokenTime(0);

    try {
      startPostLogin();
      const resultado = await signIn(email, password, tokenToSend);
      if (resultado?.mfaRequired) {
        finishPostLogin();
        setMfaCode('');
        return;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      finishPostLogin();
      console.error('[Login] Erro ao autenticar:', err);
      let msg =
        err?.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos. Verifique e tente novamente.'
          : err?.message || 'Falha ao entrar no aplicativo.';
      
      const lower = msg.toLowerCase();
      if (
        lower.includes('captcha') ||
        lower.includes('disallowed') ||
        lower.includes('request disallowed')
      ) {
        msg = 'Não foi possível verificar, tente novamente';
      }

      setError(msg);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      setLoading(false);
      setTurnstileResetKey((k) => k + 1);
    }
  };

  const handleVerifyMfa = async () => {
    const clean = mfaCode.replace(/\D/g, '');
    if (clean.length !== 6 || !mfaFactorId) {
      setError('Digite o código de 6 dígitos do seu aplicativo autenticador.');
      return;
    }
    setError('');
    setMfaLoading(true);
    try {
      await verificarCodigoTotpMfa(mfaFactorId, clean, false);
      startPostLogin();
      clearMfaRequired();
    } catch (err: any) {
      setError(traduzirErroServidor(err));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleSolicitarRecuperacao2fa = async () => {
    if (recoveryMotivo.trim().length < 15) {
      setError('Descreva o motivo com pelo menos 15 caracteres para validação do Admin.');
      return;
    }
    setError('');
    setRecoveryLoading(true);
    try {
      await solicitarRecuperacao2faAdmin(recoveryMotivo.trim(), []);
      setRecoverySuccessMsg(
        'Solicitação registrada na Mesa de Conferência. A equipe Solfy validará sua identidade para redefinir o 2FA.'
      );
      setRecoveryMotivo('');
    } catch (err: any) {
      setError(traduzirErroServidor(err));
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Botão de Voltar no Topo Esquerdo */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <GradientButton
          variant="icon"
          onPress={async () => {
            if (mfaRequired) {
              await signOut();
              return;
            }
            router.replace('/(auth)/welcome');
          }}
          accessibilityLabel="Voltar"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          icon={<ArrowLeft size={20} color="#132817" strokeWidth={2.4} />}
          style={styles.backBtnGradient}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header com Logo Full Toda Preta + pro. */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
          <View style={styles.brandLogoRow}>
            <Image
              source={require('../../assets/images/logo-full.png')}
              style={styles.logoFullBlack}
              contentFit="contain"
              tintColor="#000000"
              priority="high"
            />
            <Text style={styles.condoText}>pro.</Text>
          </View>
          <Text style={styles.brandSubtitle}>
            Oportunidades e demandas prediais para Prestadores de Serviços
          </Text>
        </Animated.View>

        {/* Card de Login Minimalista (ou Verificação 2FA quando exigida) */}
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.card}>
          {mfaRequired ? (
            <>
              <Text style={styles.cardTitle}>Verificação em duas etapas</Text>
              <Text style={styles.cardSubtitle}>
                Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.
              </Text>

              {!!error && (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBox}>
                  <AlertCircle size={17} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CÓDIGO DE 6 DÍGITOS (2FA)</Text>
                <View style={styles.inputWrapper}>
                  <ShieldCheck size={18} color="#2E5A36" />
                  <TextInput
                    style={[styles.input, { letterSpacing: 6, fontWeight: '700', fontSize: 18 }]}
                    placeholder="000000"
                    placeholderTextColor="#94A3B8"
                    value={mfaCode}
                    onChangeText={(t) => {
                      setMfaCode(t.replace(/\D/g, '').slice(0, 6));
                      setError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              <GradientButton
                variant="primary"
                size="lg"
                title="Confirmar código 2FA"
                loading={mfaLoading}
                rightIcon={<ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
                onPress={handleVerifyMfa}
                style={styles.loginBtnGrad}
              />

              <GradientButton
                variant="ghost"
                size="sm"
                onPress={() => {
                  setError('');
                  setRecoverySuccessMsg('');
                  setRecoveryModalOpen(true);
                }}
                style={styles.registerLinkBtn}
              >
                <Text style={styles.registerLinkText}>
                  Perdeu acesso ao autenticador?{' '}
                  <Text style={styles.registerLinkBold}>Solicitar recuperação ao Admin</Text>
                </Text>
              </GradientButton>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Acesse sua conta</Text>
              <Text style={styles.cardSubtitle}>
                Painel exclusivo para gestão predial
              </Text>

              {!!error && (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBox}>
                  <AlertCircle size={17} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}

              {/* Campo E-mail */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-MAIL</Text>
                <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                  <Mail size={18} color={emailFocused ? '#2E5A36' : '#94A3B8'} />
                  <TextInput
                    style={styles.input}
                    placeholder="seu.email@condominio.com"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setError('');
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* Campo Senha */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>SENHA</Text>
                <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
                  <Lock size={18} color={passwordFocused ? '#2E5A36' : '#94A3B8'} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      setError('');
                    }}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#94A3B8" />
                    ) : (
                      <Eye size={18} color="#94A3B8" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Verificação Anti-Bot Cloudflare Turnstile (Invisível em background) */}
              {isCaptchaEnabled && (
                <TurnstileWidget
                  resetKey={turnstileResetKey}
                  onToken={(t) => {
                    setCaptchaToken(t);
                    captchaTokenRef.current = t;
                    setCaptchaTokenTime(t ? Date.now() : 0);
                    if (t) setError('');
                  }}
                  onError={(msg) => {
                    setCaptchaToken(null);
                    captchaTokenRef.current = null;
                    setCaptchaTokenTime(0);
                    setError(msg || 'Não foi possível verificar, tente novamente');
                  }}
                />
              )}

              {/* Botão de Entrar com Gradiente Verde Militar e Animações Hover/Click */}
              <GradientButton
                variant="primary"
                size="lg"
                title={loading ? 'Entrando...' : 'Entrar na Solfy PRO'}
                loading={loading}
                disabled={loading}
                rightIcon={<ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
                onPress={handleLogin}
                style={styles.loginBtnGrad}
              />

              {/* Link Esqueci Minha Senha */}
              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(email);
                  setForgotMsg('');
                  setForgotModalOpen(true);
                }}
                style={{ alignSelf: 'center', marginVertical: 8, padding: 4 }}
              >
                <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                  Esqueceu sua senha?
                </Text>
              </TouchableOpacity>

              {/* Link para Cadastro */}
              <GradientButton
                variant="ghost"
                size="sm"
                onPress={() => router.push('/(auth)/cadastro')}
                style={styles.registerLinkBtn}
              >
                <Text style={styles.registerLinkText}>
                  Primeiro acesso?{' '}
                  <Text style={styles.registerLinkBold}>Cadastrar prestador</Text>
                </Text>
              </GradientButton>
            </>
          )}

          {/* Rodapé de Segurança Minimalista */}
          <View style={styles.badgeFooter}>
            <ShieldCheck size={14} color="#2E5A36" />
            <Text style={styles.badgeFooterText}>
              Ambiente seguro e criptografado
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Modal de Recuperação de 2FA via Admin */}
      <Modal
        visible={recoveryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRecoveryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <ShieldCheck size={32} color="#092215" />
            </View>
            <Text style={styles.modalTitle}>Recuperação de 2FA</Text>
            <Text style={styles.modalDesc}>
              Se você trocou ou perdeu o aparelho com o autenticador, descreva o ocorrido. A Mesa de Conferência Solfy validará sua identidade para redefinir o 2FA.
            </Text>
            {recoverySuccessMsg ? (
              <Text style={[styles.modalDesc, { color: '#15803D', fontWeight: '600' }]}>
                {recoverySuccessMsg}
              </Text>
            ) : (
              <TextInput
                style={{
                  width: '100%',
                  minHeight: 84,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 13,
                  color: '#0F172A',
                  textAlignVertical: 'top',
                  marginBottom: 14,
                }}
                placeholder="Ex.: Troquei de aparelho celular e perdi acesso ao Google Authenticator..."
                placeholderTextColor="#94A3B8"
                multiline
                value={recoveryMotivo}
                onChangeText={setRecoveryMotivo}
              />
            )}
            {!recoverySuccessMsg && (
              <GradientButton
                variant="primary"
                size="md"
                disabled={recoveryLoading}
                loading={recoveryLoading}
                loadingText="Enviando..."
                title="Enviar para análise do Admin"
                onPress={handleSolicitarRecuperacao2fa}
                style={{ width: '100%', marginBottom: 10, height: 48, borderRadius: 12 }}
              />
            )}
            <GradientButton
              variant="secondary"
              size="md"
              title="Fechar"
              onPress={() => setRecoveryModalOpen(false)}
              style={{ width: '100%', height: 46, borderRadius: 12 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Recuperação de Senha por E-mail */}
      <Modal
        visible={forgotModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Mail size={32} color="#092215" />
            </View>
            <Text style={styles.modalTitle}>Redefinir Senha</Text>
            <Text style={styles.modalDesc}>
              Digite o e-mail cadastrado na sua conta para receber o link seguro de redefinição de senha.
            </Text>
            {forgotMsg ? (
              <Text style={[styles.modalDesc, { color: '#15803D', fontWeight: '600' }]}>
                {forgotMsg}
              </Text>
            ) : (
              <View style={[styles.inputWrapper, { width: '100%', marginBottom: 14 }]}>
                <Mail size={18} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  placeholder="seu.email@exemplo.com"
                  placeholderTextColor="#94A3B8"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            )}
            {!forgotMsg && (
              <GradientButton
                variant="primary"
                size="md"
                disabled={forgotLoading}
                loading={forgotLoading}
                loadingText="Enviando..."
                title="Enviar Link de Recuperação"
                onPress={handleForgotPassword}
                style={{ width: '100%', marginBottom: 10, height: 48, borderRadius: 12 }}
              />
            )}
            <GradientButton
              variant="secondary"
              size="md"
              title="Fechar"
              onPress={() => setForgotModalOpen(false)}
              style={{ width: '100%', height: 46, borderRadius: 12 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal se Usuário for Síndico tentando acessar o Solfy PRO */}
      <Modal
        visible={notPrestadorModalOpen || isContaBloqueadaSindico}
        transparent
        animationType="fade"
        onRequestClose={() => setNotPrestadorModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Wrench size={34} color="#092215" />
            </View>
            <Text style={styles.modalTitle}>Acesso para Prestadores</Text>
            <Text style={styles.modalDesc}>
              Esta conta foi identificada como Gestor / Síndico de Condomínio.{'\n\n'}
              O aplicativo <Text style={{ fontWeight: '700' }}>Solfy PRO</Text> é de uso exclusivo para técnicos, profissionais autônomos e empresas prestadoras de serviços.{'\n\n'}
              Para administrar o seu condomínio, visualizar orçamentos e aprovar demandas, utilize o aplicativo <Text style={{ fontWeight: '700' }}>Solfy Condo</Text>.
            </Text>
            <View style={{ width: '100%', gap: 10 }}>
              <GradientButton
                variant="primary"
                size="md"
                title="Abrir Solfy Condo"
                onPress={() => {
                  Linking.openURL('solfycondo://').catch(() => {
                    Alert.alert('Solfy Condo', 'Abra o aplicativo Solfy Condo instalado no seu aparelho.');
                  });
                }}
                style={{ width: '100%', height: 48, borderRadius: 12 }}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={async () => {
                  setNotPrestadorModalOpen(false);
                  await signOut();
                }}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: FONT.bold, color: '#4B5563', fontSize: 14 }}>
                  Entrar com outra conta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Recuperação de Senha por E-mail */}
      <Modal
        visible={forgotModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Mail size={32} color="#092215" />
            </View>
            <Text style={styles.modalTitle}>Redefinir Senha</Text>
            <Text style={styles.modalDesc}>
              Digite o e-mail cadastrado na sua conta para receber o link seguro de redefinição de senha.
            </Text>
            {forgotMsg ? (
              <Text style={[styles.modalDesc, { color: '#15803D', fontWeight: '600' }]}>
                {forgotMsg}
              </Text>
            ) : (
              <View style={[styles.inputWrapper, { width: '100%', marginBottom: 14 }]}>
                <Mail size={18} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  placeholder="seu.email@exemplo.com"
                  placeholderTextColor="#94A3B8"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            )}
            {!forgotMsg && (
              <GradientButton
                variant="primary"
                size="md"
                disabled={forgotLoading}
                loading={forgotLoading}
                loadingText="Enviando..."
                title="Enviar Link de Recuperação"
                onPress={handleForgotPassword}
                style={{ width: '100%', marginBottom: 10, height: 48, borderRadius: 12 }}
              />
            )}
            <GradientButton
              variant="secondary"
              size="md"
              title="Fechar"
              onPress={() => setForgotModalOpen(false)}
              style={{ width: '100%', height: 46, borderRadius: 12 }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  topBar: {
    paddingHorizontal: 20,
    zIndex: 10,
    alignSelf: 'flex-start',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 5px rgba(0,0,0,0.04)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 5,
          elevation: 1,
        }),
  },
  backBtnGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#C8E2CC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoFullBlack: {
    width: 96,
    height: 39,
  },
  condoText: {
    fontFamily: FONT.bold,
    fontSize: 28,
    fontWeight: '800',
    color: '#132817',
    letterSpacing: -0.6,
    marginLeft: 4,
  },
  brandSubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 19,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 18px rgba(15, 23, 42, 0.05)' } as any)
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.05,
          shadowRadius: 18,
          elevation: 3,
        }),
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#132817',
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3E25',
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputFocused: {
    borderColor: '#2E5A36',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },
  loginBtnGrad: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    marginTop: 8,
  },
  loginBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 10px rgba(19, 40, 23, 0.22)' } as any)
      : {
          shadowColor: '#132817',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 3,
        }),
  },
  loginBtnGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  registerLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  registerLinkBtn: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  registerLinkText: {
    fontSize: 13.5,
    color: '#475569',
    fontWeight: '600',
  },
  registerLinkBold: {
    color: '#1E3E25',
    fontWeight: '800',
  },
  badgeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  badgeFooterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#092215',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalBtn: {
    backgroundColor: '#092215',
    borderRadius: 14,
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

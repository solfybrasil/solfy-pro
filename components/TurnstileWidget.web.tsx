import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ShieldCheck, X } from 'lucide-react-native';

export interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  onError?: (err: string) => void;
  siteKey?: string;
  resetKey?: number | string;
  theme?: 'light' | 'dark' | 'auto';
  style?: any;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          cData?: string;
          callback?: (token: string) => void;
          'error-callback'?: (errorCode: string) => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
          'before-interactive-callback'?: () => void;
          'after-interactive-callback'?: () => void;
          'unsupported-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          language?: string;
          tabindex?: number;
          'response-field'?: boolean;
          'response-field-name'?: string;
          size?: 'normal' | 'flexible' | 'compact';
          retry?: 'auto' | 'never';
          'retry-interval'?: number;
          'refresh-expired'?: 'auto' | 'manual' | 'never';
          'refresh-timeout'?: 'auto' | 'manual' | 'never';
          appearance?: 'always' | 'execute' | 'interaction-only';
          execution?: 'render' | 'execute';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const TOKEN_MAX_AGE_MS = 4 * 60 * 1000; // 4 minutos (renova antes de expirar)
const INTERACTIVE_FALLBACK_MS = 8000; // 8 segundos para fallback interativo
const TEST_SITE_KEY = '1x00000000000000000000BB';

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onToken,
  onError,
  siteKey,
  resetKey,
  theme = 'auto',
  style,
}) => {
  const isCaptchaEnabled = process.env.EXPO_PUBLIC_CAPTCHA_ENABLED === 'true';

  if (!isCaptchaEnabled) {
    return null;
  }

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  const effectiveSiteKey =
    siteKey ||
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ||
    (isDev ? TEST_SITE_KEY : '');

  const [isInteractive, setIsInteractive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Não foi possível verificar, tente novamente');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const expiryTimerRef = useRef<any>(null);
  const fallbackTimerRef = useRef<any>(null);
  const tokenResolvedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const clearTimers = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const handleTokenReceived = useCallback(
    (token: string) => {
      clearTimers();
      tokenResolvedRef.current = true;
      if (!isMountedRef.current) return;
      setHasError(false);
      setIsInteractive(false);
      onToken(token);

      expiryTimerRef.current = setTimeout(() => {
        console.warn('[TurnstileWidget.web] Token expirou aos 4 minutos. Renovando silenciosamente...');
        handleReset();
      }, TOKEN_MAX_AGE_MS);
    },
    [clearTimers, onToken]
  );

  const handleError = useCallback(
    (rawError: string) => {
      clearTimers();
      tokenResolvedRef.current = false;
      console.warn('[TurnstileWidget.web] Falha de verificação CAPTCHA:', rawError);
      if (!isMountedRef.current) return;
      setHasError(true);
      setIsInteractive(false);
      setErrorMessage('Não foi possível verificar, tente novamente');
      onToken(null);
      if (onError) onError('Não foi possível verificar, tente novamente');
    },
    [clearTimers, onError, onToken]
  );

  const startFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setTimeout(() => {
      if (!tokenResolvedRef.current && isMountedRef.current) {
        console.warn('[TurnstileWidget.web] Token não recebido em 8s. Exibindo desafio...');
        setIsInteractive(true);
      }
    }, INTERACTIVE_FALLBACK_MS);
  }, []);

  const handleReset = useCallback(() => {
    clearTimers();
    tokenResolvedRef.current = false;
    if (isMountedRef.current) {
      setHasError(false);
      setIsInteractive(false);
    }
    onToken(null);

    if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
      try {
        window.turnstile.reset(widgetIdRef.current);
        startFallbackTimer();
        return;
      } catch (err) {
        console.warn('[TurnstileWidget.web] Erro ao resetar widget:', err);
      }
    }
    startFallbackTimer();
  }, [clearTimers, onToken, startFallbackTimer]);

  // Carrega e renderiza o Turnstile no DOM Web
  useEffect(() => {
    isMountedRef.current = true;
    startFallbackTimer();

    let scriptAdded = false;

    function renderTurnstile() {
      if (!window.turnstile || !containerRef.current || !isMountedRef.current) return;

      // Remove instância anterior se houver
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
        widgetIdRef.current = null;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: effectiveSiteKey,
          appearance: 'interaction-only',
          theme: theme === 'auto' ? 'auto' : theme,
          'before-interactive-callback': () => {
            if (isMountedRef.current) setIsInteractive(true);
          },
          'after-interactive-callback': () => {
            if (isMountedRef.current) setIsInteractive(false);
          },
          callback: (token: string) => {
            handleTokenReceived(token);
          },
          'error-callback': (code: string) => {
            handleError(code);
          },
          'expired-callback': () => {
            handleReset();
          },
          'timeout-callback': () => {
            handleError('timeout');
          },
        });
        widgetIdRef.current = id;
      } catch (err: any) {
        console.warn('[TurnstileWidget.web] Erro na inicialização do Turnstile:', err);
        handleError(err?.message || 'init_error');
      }
    }

    if (typeof window !== 'undefined') {
      if (window.turnstile) {
        renderTurnstile();
      } else {
        const existingScript = document.getElementById('cf-turnstile-script');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'cf-turnstile-script';
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            renderTurnstile();
          };
          script.onerror = () => {
            handleError('network_error');
          };
          document.head.appendChild(script);
          scriptAdded = true;
        } else {
          // Script já existe no DOM, aguarda carregar
          const checkInterval = setInterval(() => {
            if (window.turnstile) {
              clearInterval(checkInterval);
              renderTurnstile();
            }
          }, 100);
          setTimeout(() => clearInterval(checkInterval), 10000);
        }
      }
    }

    return () => {
      isMountedRef.current = false;
      clearTimers();
      if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
      }
    };
  }, [effectiveSiteKey, theme, handleTokenReceived, handleError, handleReset, startFallbackTimer, clearTimers]);

  // Reset por prop resetKey
  useEffect(() => {
    if (resetKey !== undefined) {
      handleReset();
    }
  }, [resetKey, handleReset]);

  if (!effectiveSiteKey) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Não foi possível verificar, tente novamente</Text>
      </View>
    );
  }

  return (
    <>
      {/* Container invisível onde o Turnstile é montado em segundo plano */}
      <div
        ref={containerRef}
        style={{
          width: isInteractive ? 300 : 0,
          height: isInteractive ? 65 : 0,
          overflow: isInteractive ? 'visible' : 'hidden',
          opacity: isInteractive ? 1 : 0,
          margin: 0,
          padding: 0,
        }}
      />

      {/* Modal / Bottom Sheet para interação caso a Cloudflare exija */}
      {isInteractive && (
        <Modal
          visible={isInteractive}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setIsInteractive(false);
            onError?.('desafio_cancelado');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHeader}>
                <View style={styles.titleRow}>
                  <ShieldCheck size={20} color="#1E3E25" strokeWidth={2.2} />
                  <Text style={styles.sheetTitle}>Verificação Rápida de Segurança</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsInteractive(false);
                    onError?.('desafio_cancelado');
                  }}
                  style={styles.closeBtn}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.sheetSubtitle}>
                Por favor, complete a confirmação abaixo para continuar:
              </Text>

              <View style={styles.interactiveBox}>
                {/* Reanexa o widget visualmente no sheet se necessário */}
                <div
                  ref={(node) => {
                    if (node && containerRef.current && node !== containerRef.current.parentElement) {
                      node.appendChild(containerRef.current);
                    }
                  }}
                  style={{ display: 'flex', justifyContent: 'center', minHeight: 65 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Mensagem de Erro com botão de retry */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={handleReset} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

export default TurnstileWidget;

const styles = StyleSheet.create({
  errorContainer: {
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginVertical: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  retryBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  interactiveBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
});

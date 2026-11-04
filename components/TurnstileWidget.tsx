import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ShieldCheck, X } from 'lucide-react-native';

export interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  onError?: (err: string) => void;
  siteKey?: string;
  resetKey?: number | string;
  theme?: 'light' | 'dark' | 'auto';
  style?: any;
}

const TOKEN_MAX_AGE_MS = 4 * 60 * 1000; // 4 minutos (renova antes dos 5 min da Cloudflare)
const INTERACTIVE_FALLBACK_MS = 8000; // 8 segundos para fallback interativo no bottom sheet
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

  // Apenas utiliza chave de teste em modo de desenvolvimento (__DEV__)
  const effectiveSiteKey =
    siteKey ||
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ||
    (__DEV__ ? TEST_SITE_KEY : '');

  const [reloadCounter, setReloadCounter] = useState(0);
  const [isInteractive, setIsInteractive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Não foi possível verificar, tente novamente');

  const webViewRef = useRef<WebView>(null);
  const expiryTimerRef = useRef<any>(null);
  const fallbackTimerRef = useRef<any>(null);
  const tokenResolvedRef = useRef<boolean>(false);

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

  const startFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setTimeout(() => {
      if (!tokenResolvedRef.current) {
        console.warn('[TurnstileWidget] Token não chegou em 8s. Exibindo bottom sheet interativo...');
        setIsInteractive(true);
      }
    }, INTERACTIVE_FALLBACK_MS);
  }, []);

  const handleReset = useCallback(() => {
    clearTimers();
    tokenResolvedRef.current = false;
    setHasError(false);
    setIsInteractive(false);
    onToken(null);
    setReloadCounter((prev) => prev + 1);
    startFallbackTimer();
  }, [clearTimers, onToken, startFallbackTimer]);

  useEffect(() => {
    startFallbackTimer();
    return () => {
      clearTimers();
    };
  }, [startFallbackTimer, clearTimers]);

  useEffect(() => {
    if (resetKey !== undefined) {
      handleReset();
    }
  }, [resetKey, handleReset]);

  const handleTokenReceived = useCallback(
    (token: string) => {
      clearTimers();
      tokenResolvedRef.current = true;
      setHasError(false);
      setIsInteractive(false);
      onToken(token);

      expiryTimerRef.current = setTimeout(() => {
        console.warn('[TurnstileWidget] Token expirou após 4 minutos. Renovando silenciosamente...');
        handleReset();
      }, TOKEN_MAX_AGE_MS);
    },
    [clearTimers, handleReset, onToken]
  );

  const handleError = useCallback(
    (rawError: string) => {
      clearTimers();
      tokenResolvedRef.current = false;
      console.warn('[TurnstileWidget] Falha de verificação CAPTCHA:', rawError);
      setHasError(true);
      setIsInteractive(false);
      setErrorMessage('Não foi possível verificar, tente novamente');
      onToken(null);
      if (onError) onError('Não foi possível verificar, tente novamente');
    },
    [clearTimers, onError, onToken]
  );

  // Escuta postMessage em ambiente Web (quando WebView do RNW roda como iframe)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebMessage = (e: MessageEvent) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data?.type === 'CF_TURNSTILE_TOKEN' && data.token) {
            handleTokenReceived(data.token);
          } else if (data?.type === 'CF_TURNSTILE_BEFORE_INTERACTIVE') {
            setIsInteractive(true);
          } else if (data?.type === 'CF_TURNSTILE_AFTER_INTERACTIVE') {
            setIsInteractive(false);
          } else if (data?.type === 'CF_TURNSTILE_ERROR') {
            handleError(data.code || 'erro_turnstile');
          } else if (data?.type === 'CF_TURNSTILE_EXPIRED') {
            handleReset();
          }
        } catch (_) {}
      };
      window.addEventListener('message', handleWebMessage);
      return () => {
        window.removeEventListener('message', handleWebMessage);
      };
    }
  }, [handleTokenReceived, handleError, handleReset]);

  if (!effectiveSiteKey) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Não foi possível verificar, tente novamente</Text>
      </View>
    );
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <div id="cf-turnstile-box"></div>
        <script>
          function notify(data) {
            var msg = JSON.stringify(data);
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(msg);
            }
            if (window.parent && window.parent.postMessage) {
              window.parent.postMessage(msg, '*');
            }
          }

          function initTurnstile() {
            if (window.turnstile) {
              try {
                window.turnstile.render('#cf-turnstile-box', {
                  sitekey: '${effectiveSiteKey}',
                  appearance: 'interaction-only',
                  'before-interactive-callback': function() {
                    notify({ type: 'CF_TURNSTILE_BEFORE_INTERACTIVE' });
                  },
                  'after-interactive-callback': function() {
                    notify({ type: 'CF_TURNSTILE_AFTER_INTERACTIVE' });
                  },
                  callback: function(token) {
                    notify({ type: 'CF_TURNSTILE_TOKEN', token: token });
                  },
                  'error-callback': function(code) {
                    notify({ type: 'CF_TURNSTILE_ERROR', code: code });
                  },
                  'expired-callback': function() {
                    notify({ type: 'CF_TURNSTILE_EXPIRED' });
                  },
                  theme: '${theme}',
                  size: 'flexible'
                });
              } catch(e) {
                notify({ type: 'CF_TURNSTILE_ERROR', code: e.message });
              }
            } else {
              setTimeout(initTurnstile, 80);
            }
          }
          initTurnstile();
        </script>
      </body>
    </html>
  `;

  return (
    <>
      {/* WebView Host: em background roda offscreen para garantir execução contínua no Android */}
      <View
        style={[
          styles.hiddenHost,
          isInteractive && styles.interactiveHost,
          style,
        ]}
        pointerEvents={isInteractive ? 'auto' : 'none'}
      >
        {isInteractive && (
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetCard}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <ShieldCheck size={20} color="#1E3E25" strokeWidth={2.4} />
                  <Text style={styles.sheetTitle}>Verificação Rápida</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsInteractive(false);
                    handleError('desafio_cancelado');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.sheetCloseBtn}
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetSub}>
                Confirme a verificação abaixo para continuar com segurança:
              </Text>
              <View style={styles.webviewWrapper}>
                <WebView
                  key={`interactive-${reloadCounter}`}
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{
                    html: htmlContent,
                    baseUrl: 'https://auth.solfy.online',
                  }}
                  style={styles.webviewVisible}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  scalesPageToFit={true}
                  scrollEnabled={false}
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === 'CF_TURNSTILE_TOKEN' && data.token) {
                        handleTokenReceived(data.token);
                      } else if (data.type === 'CF_TURNSTILE_BEFORE_INTERACTIVE') {
                        setIsInteractive(true);
                      } else if (data.type === 'CF_TURNSTILE_AFTER_INTERACTIVE') {
                        setIsInteractive(false);
                      } else if (data.type === 'CF_TURNSTILE_ERROR') {
                        handleError(data.code || 'erro_turnstile');
                      } else if (data.type === 'CF_TURNSTILE_EXPIRED') {
                        handleReset();
                      }
                    } catch (e) {
                      handleError('erro_parse_token');
                    }
                  }}
                  onError={(syntheticEvent) => {
                    handleError(syntheticEvent.nativeEvent?.description || 'erro_webview');
                  }}
                />
              </View>
            </View>
          </View>
        )}

        {!isInteractive && (
          <WebView
            key={`bg-${reloadCounter}`}
            ref={webViewRef}
            originWhitelist={['*']}
            source={{
              html: htmlContent,
              baseUrl: 'https://auth.solfy.online',
            }}
            style={styles.webviewBackground}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
            scrollEnabled={false}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'CF_TURNSTILE_TOKEN' && data.token) {
                  handleTokenReceived(data.token);
                } else if (data.type === 'CF_TURNSTILE_BEFORE_INTERACTIVE') {
                  setIsInteractive(true);
                } else if (data.type === 'CF_TURNSTILE_AFTER_INTERACTIVE') {
                  setIsInteractive(false);
                } else if (data.type === 'CF_TURNSTILE_ERROR') {
                  handleError(data.code || 'erro_turnstile');
                } else if (data.type === 'CF_TURNSTILE_EXPIRED') {
                  handleReset();
                }
              } catch (e) {
                handleError('erro_parse_token');
              }
            }}
            onError={(syntheticEvent) => {
              handleError(syntheticEvent.nativeEvent?.description || 'erro_webview');
            }}
          />
        )}
      </View>

      {/* Alerta Discreto se houver Falha */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  hiddenHost: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 320,
    height: 120,
    opacity: 0.01,
    overflow: 'hidden',
  },
  webviewBackground: {
    width: 320,
    height: 120,
    opacity: 0.01,
  },
  interactiveHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
    zIndex: 99999,
    elevation: 99999,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 34, 21, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 8,
        }),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#132817',
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 17,
  },
  webviewWrapper: {
    height: 100,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  webviewVisible: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  errorContainer: {
    width: '100%',
    padding: 10,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: '#DC2626',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default TurnstileWidget;

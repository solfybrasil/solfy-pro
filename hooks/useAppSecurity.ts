/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   useAppSecurity — Solfy Sentinel Mobile Hook v3.0      ║
 * ║   Integra o Sentinel Engine em qualquer tela do app     ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Uso básico:
 *   const { signRequest, validateTransaction, touchProps, honeypotProps } = useAppSecurity();
 *
 *   // Antes de enviar transação:
 *   const check = validateTransaction('buy_package');
 *   if (!check.allowed) return showError(check.reason);
 *   const secureBody = signRequest({ helper_id, coins, price });
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  initAppSentinel,
  signAppRequest,
  validateTransactionSecurity,
  recordTouch,
  analyzeTouchDynamics,
  tripHoneypot,
  resetHoneypot,
  isHoneypotTripped,
  checkRateLimit,
  generateDeviceFingerprint,
  sha256,
} from '../lib/security';

// ─── Tipos ────────────────────────────────────────────────────────────

export interface SecurityStatus {
  ready: boolean;
  fingerprint: string;
  threatScore: number;
  verdict: 'HUMAN' | 'SUSPICIOUS' | 'BOT';
  honeypotTripped: boolean;
}

export interface TouchEventData {
  locationX: number;
  locationY: number;
}

// ─── Hook Principal ────────────────────────────────────────────────────

export function useAppSecurity() {
  const [status, setStatus] = useState<SecurityStatus>({
    ready: false,
    fingerprint: '',
    threatScore: 0,
    verdict: 'HUMAN',
    honeypotTripped: false,
  });

  // Timestamp de quando cada campo do formulário começou a ser editado
  const fieldStartTimes = useRef<Record<string, number>>({});

  // Velocidade de digitação por campo (chars por segundo)
  const fieldTypingSpeeds = useRef<Record<string, number[]>>({});

  // ─── Inicialização ────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = initAppSentinel();
    resetHoneypot();

    setStatus(prev => ({
      ...prev,
      ready: sentinel.ready,
      fingerprint: sentinel.fingerprint,
    }));
  }, []);

  // ─── Análise de Toque em Tempo Real ───────────────────────────────

  const handleTouch = useCallback((event: { nativeEvent?: TouchEventData } | TouchEventData) => {
    let x = 0;
    let y = 0;

    // Suporta tanto GestureResponderEvent quanto objeto direto
    if ('nativeEvent' in event && event.nativeEvent) {
      x = event.nativeEvent.locationX ?? 0;
      y = event.nativeEvent.locationY ?? 0;
    } else if ('locationX' in event) {
      x = (event as TouchEventData).locationX ?? 0;
      y = (event as TouchEventData).locationY ?? 0;
    }

    recordTouch(x, y);

    const analysis = analyzeTouchDynamics();
    setStatus(prev => ({
      ...prev,
      threatScore: analysis.score,
      verdict: analysis.verdict,
    }));
  }, []);

  // ─── Props de Touch para wrapping em TouchableOpacity / Pressable ─

  /**
   * Spread esses props em qualquer TouchableOpacity para registrar biometria.
   * Ex: <TouchableOpacity {...touchProps} onPress={myPress}>
   */
  const touchProps = {
    onPressIn: (e: any) => {
      handleTouch(e);
    },
  };

  // ─── Análise de Velocidade de Digitação ───────────────────────────

  /**
   * Retorna props para monitorar a cadência de digitação num TextInput.
   * Humanos têm variação natural; robôs preenchem em < 50ms.
   *
   * @param fieldName Identificador único do campo (ex: 'cpf', 'name')
   */
  const getInputSecurityProps = useCallback((fieldName: string) => {
    return {
      onFocus: () => {
        fieldStartTimes.current[fieldName] = Date.now();
        if (!fieldTypingSpeeds.current[fieldName]) {
          fieldTypingSpeeds.current[fieldName] = [];
        }
      },
      onChangeText: (text: string) => {
        const start = fieldStartTimes.current[fieldName];
        if (start && text.length > 0) {
          const elapsed = Date.now() - start;
          const charsPerSecond = (text.length / elapsed) * 1000;
          fieldTypingSpeeds.current[fieldName].push(charsPerSecond);

          // Velocidade de digitação acima de 30 chars/seg é suspeito (robô)
          const avgSpeed =
            fieldTypingSpeeds.current[fieldName].reduce((a, b) => a + b, 0) /
            fieldTypingSpeeds.current[fieldName].length;

          if (avgSpeed > 30 && text.length > 5) {
            setStatus(prev => ({
              ...prev,
              threatScore: Math.min(prev.threatScore + 20, 100),
              verdict: prev.threatScore + 20 >= 70 ? 'BOT' : 'SUSPICIOUS',
            }));
          }
        }
      },
    };
  }, []);

  // ─── Honeypot Props ────────────────────────────────────────────────

  /**
   * Spread esses props num TextInput INVISÍVEL no formulário.
   * Se um bot preencher, o Sentinel detecta automaticamente.
   *
   * Posicione o campo fora da tela com style={{ position: 'absolute', top: -9999 }}
   */
  const honeypotProps = {
    value: '',
    onChangeText: (_: string) => {
      tripHoneypot();
      setStatus(prev => ({
        ...prev,
        honeypotTripped: true,
        verdict: 'BOT',
        threatScore: 100,
      }));
    },
    style: {
      position: 'absolute' as const,
      top: -9999,
      left: -9999,
      width: 1,
      height: 1,
      opacity: 0,
    },
    accessible: false,
    importantForAccessibility: 'no' as const,
  };

  // ─── Assinatura de Requisição SHA-256 ─────────────────────────────

  /**
   * Assina um payload com SHA-256 + nonce + timestamp + fingerprint.
   * Use SEMPRE antes de enviar dados financeiros para a Edge Function.
   */
  const signRequest = useCallback(<T extends Record<string, unknown>>(payload: T) => {
    return signAppRequest(payload);
  }, []);

  // ─── Validação de Transação ────────────────────────────────────────

  /**
   * Valida todas as camadas de segurança antes de processar uma transação.
   * Retorna { allowed: true } se seguro, ou { allowed: false, reason } se bloqueado.
   *
   * @param actionKey Identificador da ação para rate limiting (ex: 'buy_package')
   */
  const validateTransaction = useCallback(
    (actionKey: string = 'transaction'): { allowed: boolean; reason?: string; threatScore?: number } => {
      return validateTransactionSecurity(actionKey);
    },
    [],
  );

  // ─── Rate Limit Standalone ────────────────────────────────────────

  const isRateLimited = useCallback(
    (actionKey: string, maxCalls?: number, windowMs?: number): boolean => {
      return checkRateLimit(actionKey, maxCalls, windowMs);
    },
    [],
  );

  // ─── Reset de Sessão (ex: ao fechar modal) ────────────────────────

  const resetSession = useCallback(() => {
    resetHoneypot();
    fieldStartTimes.current = {};
    fieldTypingSpeeds.current = {};
    setStatus(prev => ({
      ...prev,
      honeypotTripped: false,
      threatScore: 0,
      verdict: 'HUMAN',
    }));
  }, []);

  // ─── Utilitários ──────────────────────────────────────────────────

  /** Gera hash SHA-256 de qualquer string */
  const hashString = useCallback((value: string): string => sha256(value), []);

  /** Fingerprint único do dispositivo físico */
  const deviceFingerprint = useCallback((): string => generateDeviceFingerprint(), []);

  return {
    /** Status atual do Sentinel */
    status,

    /** Props para TouchableOpacity — registra biometria de toque */
    touchProps,

    /** Gera props para TextInput — monitora velocidade de digitação */
    getInputSecurityProps,

    /** Props para TextInput INVISÍVEL (honeypot anti-bot) */
    honeypotProps,

    /** Assina payload com SHA-256 + nonce + timestamp */
    signRequest,

    /** Valida todas as camadas antes de processar transação */
    validateTransaction,

    /** Verifica rate limit de uma ação específica */
    isRateLimited,

    /** Reseta o estado de segurança (fechar modal, nova tentativa) */
    resetSession,

    /** Gera SHA-256 de qualquer string */
    hashString,

    /** Fingerprint único do hardware do dispositivo */
    deviceFingerprint,
  };
}

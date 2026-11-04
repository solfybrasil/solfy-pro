/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        SOLFY SENTINEL MOBILE ENGINE v3.0                    ║
 * ║   Military-Grade Security for React Native / Expo (Hermes)  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Camadas de proteção:
 *   [1] Assinatura de Hardware (Device Fingerprint Anti-Clone)
 *   [2] Touch Biometrics (Anti-Automação / Anti-Bot)
 *   [3] SHA-256 puro JS  (Anti-Tampering de Requisições)
 *   [4] Rate Limiting de interações (Anti-Força-Bruta)
 *   [5] Honeypot Detection (Anti-Scanner)
 *   [6] Session Binding (Anti-Hijacking)
 *   [7] Request Nonce + Timestamp (Anti-Replay)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// CAMADA 3 — SHA-256 Puro JavaScript (compatível com Hermes)
// Sem dependências externas. Roda no motor JS nativo.
// ─────────────────────────────────────────────────────────────

function rotateRight(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256(message: string): string {
  const utf8: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const code = message.charCodeAt(i);
    if (code < 0x80) {
      utf8.push(code);
    } else if (code < 0x800) {
      utf8.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      utf8.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      utf8.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  const len = utf8.length;
  const bitLen = len * 8;
  utf8.push(0x80);
  while (utf8.length % 64 !== 56) utf8.push(0);
  // Append original length in bits as 64-bit big-endian
  for (let i = 7; i >= 0; i--) {
    utf8.push((bitLen / Math.pow(2, i * 8)) & 0xff);
  }

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let i = 0; i < utf8.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) {
      w[j] =
        (utf8[i + j * 4] << 24) |
        (utf8[i + j * 4 + 1] << 16) |
        (utf8[i + j * 4 + 2] << 8) |
        utf8[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotateRight(w[j - 15], 7) ^ rotateRight(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotateRight(w[j - 2], 17) ^ rotateRight(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(v => v.toString(16).padStart(8, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────
// CAMADA 1 — Device Fingerprint Anti-Clone
// ─────────────────────────────────────────────────────────────

let _deviceFingerprint: string | null = null;

function generateDeviceFingerprint(): string {
  if (_deviceFingerprint) return _deviceFingerprint;

  const device = Constants.deviceName ?? 'unknown-device';
  const os = Platform.OS;
  const osVersion = Platform.Version?.toString() ?? '0';
  // Campos seguros compatíveis com Expo SDK 50+
  const sessionId = (Constants as any).sessionId ?? (Constants as any).installationId ?? 'no-id';
  const appVersion = (Constants as any).expoVersion ?? (Constants as any).nativeAppVersion ?? '0';

  // Combina dados únicos do hardware em uma string determinística
  const raw = [device, os, osVersion, appVersion, sessionId].join('||');
  _deviceFingerprint = sha256(raw);
  return _deviceFingerprint;
}

// ─────────────────────────────────────────────────────────────
// CAMADA 2 — Touch Biometrics (Anti-Automação)
// ─────────────────────────────────────────────────────────────

interface TouchEvent {
  timestamp: number;
  x: number;
  y: number;
  durationMs?: number;
}

const _touchHistory: TouchEvent[] = [];
const MAX_TOUCH_HISTORY = 50;

/** Registra um evento de toque. Chame isso em onPress / onResponderStart. */
export function recordTouch(x: number, y: number, durationMs?: number): void {
  const event: TouchEvent = { timestamp: Date.now(), x, y, durationMs };
  _touchHistory.push(event);
  if (_touchHistory.length > MAX_TOUCH_HISTORY) _touchHistory.shift();
}

/**
 * Analisa os toques recentes e retorna um score de ameaça de 0 (humano) a 100 (bot).
 * Robôs tocam em intervalos perfeitamente regulares e/ou exatamente no centro dos botões.
 */
export function analyzeTouchDynamics(): { score: number; verdict: 'HUMAN' | 'SUSPICIOUS' | 'BOT'; reasons: string[] } {
  const reasons: string[] = [];

  if (_touchHistory.length < 3) {
    return { score: 0, verdict: 'HUMAN', reasons: ['Insufficient touch data'] };
  }

  const recent = _touchHistory.slice(-10);
  const intervals: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    intervals.push(recent[i].timestamp - recent[i - 1].timestamp);
  }

  // Heurística 1: Intervalo milimetricamente constante (robô)
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  let score = 0;

  // Desvio padrão muito baixo = padrão robótico perfeito
  if (stdDev < 5 && intervals.length >= 4) {
    score += 60;
    reasons.push(`Robotic timing detected (stdDev: ${stdDev.toFixed(2)}ms)`);
  }

  // Heurística 2: Intervalo muito rápido (impossível para humano < 80ms)
  const tooFast = intervals.filter(v => v < 80);
  if (tooFast.length > 2) {
    score += 40;
    reasons.push(`Inhuman speed: ${tooFast.length} taps < 80ms`);
  }

  // Heurística 3: Toques sempre no mesmo ponto exato
  const uniqueX = new Set(recent.map(e => Math.round(e.x))).size;
  const uniqueY = new Set(recent.map(e => Math.round(e.y))).size;
  if (uniqueX <= 1 && uniqueY <= 1 && recent.length >= 4) {
    score += 50;
    reasons.push('Identical coordinates detected (script/emulator)');
  }

  score = Math.min(score, 100);
  const verdict = score >= 70 ? 'BOT' : score >= 40 ? 'SUSPICIOUS' : 'HUMAN';

  return { score, verdict, reasons };
}

// ─────────────────────────────────────────────────────────────
// CAMADA 4 — Rate Limiting de Interações
// ─────────────────────────────────────────────────────────────

const _actionTimestamps: Record<string, number[]> = {};

/**
 * Verifica se uma ação específica excedeu o limite de frequência.
 * @param actionKey  identificador da ação (ex: 'buy_package', 'generate_pix')
 * @param maxCalls   máximo de chamadas permitidas
 * @param windowMs   janela de tempo em milissegundos
 */
export function checkRateLimit(actionKey: string, maxCalls: number = 3, windowMs: number = 10000): boolean {
  const now = Date.now();
  if (!_actionTimestamps[actionKey]) _actionTimestamps[actionKey] = [];

  // Remove timestamps fora da janela
  _actionTimestamps[actionKey] = _actionTimestamps[actionKey].filter(t => now - t < windowMs);
  _actionTimestamps[actionKey].push(now);

  return _actionTimestamps[actionKey].length > maxCalls;
}

// ─────────────────────────────────────────────────────────────
// CAMADA 5 — Honeypot State (para campos invisíveis no form)
// ─────────────────────────────────────────────────────────────

let _honeypotTripped = false;

/** Sinaliza que o campo honeypot foi preenchido por um bot. */
export function tripHoneypot(): void {
  _honeypotTripped = true;
}

/** Reseta o estado do honeypot (ex: ao fechar o modal). */
export function resetHoneypot(): void {
  _honeypotTripped = false;
}

export function isHoneypotTripped(): boolean {
  return _honeypotTripped;
}

// ─────────────────────────────────────────────────────────────
// CAMADA 6 — Session Binding (Anti-Hijacking)
// ─────────────────────────────────────────────────────────────

let _sessionToken: string | null = null;

function getOrCreateSessionToken(): string {
  if (_sessionToken) return _sessionToken;
  const fingerprint = generateDeviceFingerprint();
  const randomPart = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  _sessionToken = sha256(`${fingerprint}::${randomPart}::${time}`);
  return _sessionToken;
}

// ─────────────────────────────────────────────────────────────
// CAMADA 3 + 7 — Assinatura de Requisições SHA-256 Anti-Tampering
// ─────────────────────────────────────────────────────────────

const SENTINEL_SECRET = 'S0LFY_SENTINEL_INTERNAL_HMAC_v3';

/**
 * Assina um payload de requisição sensível com SHA-256.
 * O servidor DEVE validar essa assinatura antes de processar a transação.
 *
 * @param payload Objeto com os dados a serem assinados
 * @returns O payload original + campos de segurança (_sig, _ts, _nonce, _fp, _session)
 */
export function signAppRequest<T extends Record<string, unknown>>(payload: T): T & {
  _sig: string;
  _ts: number;
  _nonce: string;
  _fp: string;
  _session: string;
} {
  const _ts = Date.now();
  const _nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const _fp = generateDeviceFingerprint();
  const _session = getOrCreateSessionToken();

  // Ordena as chaves do payload para garantir determinismo
  const sortedPayload = Object.keys(payload)
    .sort()
    .map(k => `${k}=${JSON.stringify((payload as Record<string, unknown>)[k])}`)
    .join('&');

  const rawSig = `${SENTINEL_SECRET}::${sortedPayload}::${_ts}::${_nonce}::${_fp}::${_session}`;
  const _sig = sha256(rawSig);

  return { ...payload, _sig, _ts, _nonce, _fp, _session };
}

// ─────────────────────────────────────────────────────────────
// INIT — Inicialização do Sentinel
// ─────────────────────────────────────────────────────────────

interface SentinelStatus {
  fingerprint: string;
  sessionToken: string;
  platform: string;
  platformVersion: string | number;
  deviceName: string;
  ready: boolean;
}

let _sentinelReady = false;

/**
 * Inicializa o Solfy Sentinel Mobile Engine.
 * Deve ser chamado uma vez ao montar a tela de finanças ou o App root.
 */
export function initAppSentinel(): SentinelStatus {
  const fingerprint = generateDeviceFingerprint();
  const sessionToken = getOrCreateSessionToken();
  _sentinelReady = true;

  return {
    fingerprint,
    sessionToken,
    platform: Platform.OS,
    platformVersion: Platform.Version,
    deviceName: (Constants.deviceName ?? (Constants as any).deviceModelName ?? 'unknown'),
    ready: true,
  };
}

export function isSentinelReady(): boolean {
  return _sentinelReady;
}

/**
 * Validação completa antes de processar uma transação financeira.
 * Retorna { allowed: true } se seguro, ou { allowed: false, reason } se bloqueado.
 */
export function validateTransactionSecurity(actionKey: string = 'transaction'): {
  allowed: boolean;
  reason?: string;
  threatScore?: number;
} {
  // Cheque 1: Honeypot
  if (isHoneypotTripped()) {
    return { allowed: false, reason: 'HONEYPOT_TRIGGERED' };
  }

  // Cheque 2: Rate limit (máx. 3 tentativas em 15 segundos)
  if (checkRateLimit(actionKey, 3, 15000)) {
    return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
  }

  // Cheque 3: Análise biométrica de toques
  const { score, verdict } = analyzeTouchDynamics();
  if (verdict === 'BOT') {
    return { allowed: false, reason: 'BOT_BEHAVIOR_DETECTED', threatScore: score };
  }

  return { allowed: true, threatScore: score };
}

// Re-exporta sha256 para uso externo (ex: validação de dados)
export { sha256, generateDeviceFingerprint };

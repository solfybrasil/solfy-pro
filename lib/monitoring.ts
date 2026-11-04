/**
 * Módulo de Monitoramento de Erros e Telemetria Mobile (Solfy PRO)
 * Higienização estrita de dados pessoais (CPF, telefone, e-mail, tokens) antes do envio.
 */

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: {
    id?: string;
    role?: string;
  };
}

const PII_PATTERNS = {
  cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  telefone: /\b(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?\s?)?9[0-9]{4}[-\s]?[0-9]{4}\b/g,
  email: /\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b/g,
  tokenAuth: /(?:Bearer\s+|token[:=]\s*["']?|apiKey[:=]\s*["']?|secret[:=]\s*["']?)[A-Za-z0-9_\-\.]{15,}/gi,
  cartao: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
};

const SENSITIVE_KEYS = [
  'cpf',
  'documento',
  'telefone',
  'phone',
  'email',
  'senha',
  'password',
  'token',
  'secret',
  'authorization',
  'chave_pix',
  'pix',
  'jwt',
];

export function scrubPII<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data
      .replace(PII_PATTERNS.cpf, '[CPF PROTEGIDO]')
      .replace(PII_PATTERNS.telefone, '[TELEFONE PROTEGIDO]')
      .replace(PII_PATTERNS.email, '[EMAIL PROTEGIDO]')
      .replace(PII_PATTERNS.cartao, '[CARTAO PROTEGIDO]')
      .replace(PII_PATTERNS.tokenAuth, '[TOKEN/SECRET PROTEGIDO]') as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => scrubPII(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((s) => lowerKey.includes(s));

      if (isSensitive) {
        cleaned[key] = '[DADO PESSOAL PROTEGIDO]';
      } else {
        cleaned[key] = scrubPII(value);
      }
    }
    return cleaned as T;
  }

  return data;
}

class MonitoringService {
  private dsn: string | null = null;
  private environment: string = 'production';

  public init(dsn?: string) {
    this.dsn = dsn || process.env.EXPO_PUBLIC_SENTRY_DSN || null;
    this.environment = __DEV__ ? 'development' : 'production';

    if (this.dsn) {
      console.log(`[Monitoring Solfy PRO] Ativado (PII scrubbing: ATIVO)`);
    }

    // Configura captura de exceções globais em React Native se ErrorUtils estiver presente
    const globalErrorUtils = (global as any).ErrorUtils;
    if (globalErrorUtils && typeof globalErrorUtils.getGlobalHandler === 'function') {
      const defaultHandler = globalErrorUtils.getGlobalHandler();
      globalErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        this.captureException(error, { extra: { isFatal } });
        if (defaultHandler) defaultHandler(error, isFatal);
      });
    }
  }

  public captureException(error: any, context?: ErrorContext) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const scrubbedMessage = scrubPII(errorObj.message);
    const scrubbedStack = errorObj.stack ? scrubPII(errorObj.stack) : undefined;
    const scrubbedContext = scrubPII(context || {});

    const payload = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: scrubbedMessage,
      stack: scrubbedStack,
      context: scrubbedContext,
      environment: this.environment,
      app: 'solfy-pro',
    };

    if (this.environment === 'development' || !this.dsn) {
      console.warn('[Monitoring PRO - Sanitizado]', payload);
      return;
    }

    this.sendToSentry(payload);
  }

  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    const scrubbedMessage = scrubPII(message);
    const scrubbedContext = scrubPII(context || {});

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message: scrubbedMessage,
      context: scrubbedContext,
      environment: this.environment,
      app: 'solfy-pro',
    };

    if (this.environment === 'development' || !this.dsn) {
      console.log(`[Monitoring PRO ${level.toUpperCase()}]`, payload);
      return;
    }

    this.sendToSentry(payload);
  }

  private async sendToSentry(payload: any) {
    if (!this.dsn) return;
    try {
      const urlMatch = this.dsn.match(/^https:\/\/([a-f0-9]+)@([^/]+)\/([0-9]+)$/);
      if (!urlMatch) return;

      const [, publicKey, host, projectId] = urlMatch;
      const endpoint = `https://${host}/api/${projectId}/envelope/`;

      const randomId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const header = JSON.stringify({
        event_id: randomId.padEnd(32, '0').slice(0, 32),
        sent_at: new Date().toISOString(),
      });
      const itemHeader = JSON.stringify({ type: 'event', content_type: 'application/json' });
      const itemPayload = JSON.stringify(payload);

      const body = `${header}\n${itemHeader}\n${itemPayload}\n`;

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=solfy-monitoring/1.0, sentry_key=${publicKey}`,
        },
        body,
      });
    } catch (e) {
      // Ignora falhas de rede no envio
    }
  }
}

export const monitoring = new MonitoringService();
monitoring.init();

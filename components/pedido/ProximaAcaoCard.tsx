import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarCheck2,
  Send,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react-native';

export type EstadoPedidoAcao =
  | 'convite_pendente'
  | 'aceito_escolher_caminho'
  | 'visita_agendada'
  | 'aguardando_cotacao'
  | 'cotacao_enviada'
  | 'aprovada'
  | 'recusado'
  | 'expirado'
  | 'vagas_preenchidas'
  | 'cancelada';

interface ProximaAcaoCardProps {
  estado: EstadoPedidoAcao;
  prazoLimiteAceite?: string | null;
  prazoLimiteHoras?: number;
  ehEmergencia?: boolean;
  onAceitar?: () => void;
  onRecusar?: () => void;
  onAgendarVisita?: () => void;
  onEnviarOrcamento?: () => void;
  submitting?: boolean;
}

export const ProximaAcaoCard: React.FC<ProximaAcaoCardProps> = ({
  estado,
  prazoLimiteAceite,
  ehEmergencia,
  onAceitar,
  onRecusar,
  onAgendarVisita,
  onEnviarOrcamento,
  submitting = false,
}) => {
  const [segundosRestantes, setSegundosRestantes] = useState<number>(() => {
    if (!prazoLimiteAceite) return 0;
    const diff = Math.floor((new Date(prazoLimiteAceite).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  // Cronômetro regressivo que decrementa a cada 1s
  useEffect(() => {
    if (!prazoLimiteAceite) return;

    const timer = setInterval(() => {
      const diff = Math.floor((new Date(prazoLimiteAceite).getTime() - Date.now()) / 1000);
      setSegundosRestantes(Math.max(0, diff));
    }, 1000);

    return () => clearInterval(timer);
  }, [prazoLimiteAceite]);

  // Formatação do horário exato de Brasília
  const formatarHorarioBrasilia = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const data = new Date(isoString);
      const diaSemana = data.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'short',
      }).replace('.', '');
      const hora = data.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${diaSemana}, ${hora}`;
    } catch {
      return '';
    }
  };

  // Formatação do tempo restante (hh:mm:ss ou Xh Ym)
  const formatarTempoRestante = (segundos: number) => {
    if (segundos <= 0) return 'Expirado';
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const horarioExatoTexto = prazoLimiteAceite ? formatarHorarioBrasilia(prazoLimiteAceite) : '';
  const isMenosDe1Hora = segundosRestantes > 0 && segundosRestantes < 3600;

  // 1. E1: CONVITE PENDENTE
  if (estado === 'convite_pendente') {
    return (
      <View style={[styles.card, styles.cardConvite]}>
        <View style={styles.headerRow}>
          <View style={styles.badgeProximaAcao}>
            <Sparkles size={12} color="#047857" />
            <Text style={styles.badgeProximaAcaoText}>SUA PRÓXIMA AÇÃO</Text>
          </View>

          {/* Cronômetro */}
          {prazoLimiteAceite && (
            <View
              style={[
                styles.timerPill,
                isMenosDe1Hora && styles.timerPillUrgent,
                ehEmergencia && styles.timerPillEmergency,
              ]}
            >
              <Clock size={12} color={isMenosDe1Hora || ehEmergencia ? '#DC2626' : '#047857'} />
              <Text
                style={[
                  styles.timerText,
                  (isMenosDe1Hora || ehEmergencia) && styles.timerTextUrgent,
                ]}
              >
                {formatarTempoRestante(segundosRestantes)}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.tituloAcao}>Decidir sobre o convite do chamado</Text>
        <Text style={styles.descricaoAcao}>
          {horarioExatoTexto ? (
            <>
              Responda até <Text style={styles.boldText}>{horarioExatoTexto}</Text> (horário útil de Brasília) para manter sua prioridade no despacho.
            </>
          ) : (
            'Você foi qualificado e convidado para este chamado. Avalie o escopo antes de aceitar.'
          )}
        </Text>

        {/* Botões de Ação E1 */}
        <View style={styles.botoesRow}>
          <TouchableOpacity
            style={styles.btnRecusar}
            onPress={onRecusar}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Text style={styles.btnRecusarText}>Recusar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAceitar, submitting && { opacity: 0.7 }]}
            onPress={onAceitar}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.btnAceitarText}>Aceitar Convite</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. E2: ACEITO - ESCOLHER CAMINHO
  if (estado === 'aceito_escolher_caminho') {
    return (
      <View style={[styles.card, styles.cardAceito]}>
        <View style={styles.headerRow}>
          <View style={[styles.badgeProximaAcao, { backgroundColor: '#DBEAFE' }]}>
            <CheckCircle2 size={12} color="#1D4ED8" />
            <Text style={[styles.badgeProximaAcaoText, { color: '#1E3A8A' }]}>
              CONVITE ACEITO
            </Text>
          </View>
          <View style={[styles.timerPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Clock size={12} color="#1D4ED8" />
            <Text style={[styles.timerText, { color: '#1D4ED8' }]}>Prazo de 72h</Text>
          </View>
        </View>

        <Text style={styles.tituloAcao}>Escolha como prosseguir com o pedido</Text>
        <Text style={styles.descricaoAcao}>
          Você aceitou a oportunidade! Agora defina se precisa fazer uma vistoria presencial ou se enviará a proposta diretamente.
        </Text>

        <View style={styles.botoesRow}>
          <TouchableOpacity
            style={[styles.btnAcaoSecundaria, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}
            onPress={onAgendarVisita}
            activeOpacity={0.8}
          >
            <CalendarCheck2 size={16} color="#1D4ED8" />
            <Text style={[styles.btnAcaoSecundariaText, { color: '#1D4ED8' }]}>
              Agendar Visita
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAceitar, { backgroundColor: '#092215' }]}
            onPress={onEnviarOrcamento}
            activeOpacity={0.8}
          >
            <Send size={16} color="#FFFFFF" />
            <Text style={styles.btnAceitarText}>Enviar Orçamento</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. ESTADO FINAL: EXPIRADO
  if (estado === 'expirado') {
    return (
      <View style={[styles.card, styles.cardExpirado]}>
        <View style={styles.headerRow}>
          <View style={[styles.badgeProximaAcao, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={12} color="#B91C1C" />
            <Text style={[styles.badgeProximaAcaoText, { color: '#991B1B' }]}>
              CONVITE EXPIRADO
            </Text>
          </View>
        </View>

        <Text style={[styles.tituloAcao, { color: '#991B1B' }]}>
          O prazo de resposta terminou
        </Text>
        <Text style={[styles.descricaoAcao, { color: '#7F1D1D' }]}>
          O pedido foi passado para outro profissional. Convites ignorados reduzem sua prioridade nos próximos chamados.
        </Text>
      </View>
    );
  }

  // 4. ESTADO FINAL: VAGAS PREENCHIDAS (COTA CHEIA)
  if (estado === 'vagas_preenchidas') {
    return (
      <View style={[styles.card, styles.cardVagasPreenchidas]}>
        <View style={styles.headerRow}>
          <View style={[styles.badgeProximaAcao, { backgroundColor: '#F3F4F6' }]}>
            <CheckCircle2 size={12} color="#4B5563" />
            <Text style={[styles.badgeProximaAcaoText, { color: '#374151' }]}>
              VAGAS PREENCHIDAS
            </Text>
          </View>
        </View>

        <Text style={[styles.tituloAcao, { color: '#1F2937' }]}>
          Limite de 3 prestadores atingido
        </Text>
        <Text style={[styles.descricaoAcao, { color: '#4B5563' }]}>
          Este pedido já foi atendido por outros profissionais antes da sua resposta. Isso não afeta sua prioridade nos próximos pedidos.
        </Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      },
    }),
  },
  cardConvite: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  cardAceito: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  cardExpirado: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardVagasPreenchidas: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeProximaAcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
  },
  badgeProximaAcaoText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  timerPillUrgent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  timerPillEmergency: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  timerTextUrgent: {
    color: '#B91C1C',
  },
  tituloAcao: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  descricaoAcao: {
    fontSize: 12.5,
    color: '#047857',
    lineHeight: 18,
    marginBottom: 14,
  },
  boldText: {
    fontWeight: '700',
    color: '#064E3B',
  },
  botoesRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  btnRecusar: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRecusarText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
  },
  btnAceitar: {
    flex: 1.6,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnAceitarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnAcaoSecundaria: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnAcaoSecundariaText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});

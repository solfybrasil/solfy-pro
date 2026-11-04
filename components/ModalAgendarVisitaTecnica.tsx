import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CalendarCheck2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import {
  agendarVisitaTecnicaPrestador,
  buscarVisitasExistentesSolicitacao,
  OportunidadePrestador,
} from '../lib/prestadorPedidosApi';

interface ModalAgendarVisitaTecnicaProps {
  visible: boolean;
  onClose: () => void;
  pedido: OportunidadePrestador | null;
  prestadorId: string;
  onSucesso: () => void;
}

const THEME = {
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  ink: '#0D1B12',
  sub: '#5C6B61',
  mute: '#8A978E',
  line: 'rgba(13, 27, 18, 0.08)',
  deep: '#132817',
  mid: '#2E5A36',
  accent: '#059669',
  accentSoft: '#E3F5EC',
  rose: '#BE123C',
  roseSoft: '#FFE4E6',
};

// Formata data YYYY-MM-DD
const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ModalAgendarVisitaTecnica: React.FC<ModalAgendarVisitaTecnicaProps> = ({
  visible,
  onClose,
  pedido,
  prestadorId,
  onSucesso,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visitasOcupadas, setVisitasOcupadas] = useState<any[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState<string>('');
  const [horarioInicio, setHorarioInicio] = useState<string>('');
  const [horarioFim, setHorarioFim] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  const solicitacaoId = pedido?.solicitacao_id || '';

  // Janela definida pelo síndico
  const hojeStr = useMemo(() => formatLocalDate(new Date()), []);
  const dataInicioJanela = pedido?.visita_janela_data_inicio || hojeStr;
  const dataFimJanela = pedido?.visita_janela_data_fim || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatLocalDate(d);
  })();

  const horaInicioPadrao = (pedido?.visita_janela_horario_inicio || '08:00').substring(0, 5);
  const horaFimPadrao = (pedido?.visita_janela_horario_fim || '18:00').substring(0, 5);

  const carregarSlotsOcupados = async () => {
    if (!solicitacaoId) return;
    setLoading(true);
    try {
      const data = await buscarVisitasExistentesSolicitacao(solicitacaoId);
      setVisitasOcupadas(data || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && solicitacaoId) {
      carregarSlotsOcupados();
    }
  }, [visible, solicitacaoId]);

  // Lista de datas válidas dentro da janela do condomínio
  const diasDisponiveis = useMemo(() => {
    const dias: { dataStr: string; diaSemana: string; diaNumero: number; mesAbrev: string }[] = [];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const [a1, m1, d1] = dataInicioJanela.split('-').map(Number);
    const [a2, m2, d2] = dataFimJanela.split('-').map(Number);

    if (!a1 || !m1 || !d1 || !a2 || !m2 || !d2) return dias;

    const cur = new Date(a1, m1 - 1, d1);
    const fim = new Date(a2, m2 - 1, d2);

    while (cur <= fim) {
      const dataStr = formatLocalDate(cur);
      if (dataStr >= hojeStr) {
        dias.push({
          dataStr,
          diaSemana: semana[cur.getDay()],
          diaNumero: cur.getDate(),
          mesAbrev: meses[cur.getMonth()],
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return dias;
  }, [dataInicioJanela, dataFimJanela, hojeStr]);

  // Seleciona automaticamente o primeiro dia se nenhum estiver selecionado
  useEffect(() => {
    if (diasDisponiveis.length > 0 && !diaSelecionado) {
      setDiaSelecionado(diasDisponiveis[0].dataStr);
    }
  }, [diasDisponiveis, diaSelecionado]);

  // Slots de 1 hora dentro da faixa do síndico
  const slotsDoDia = useMemo(() => {
    if (!diaSelecionado) return [];

    const slots: {
      horarioInicio: string;
      horarioFim: string;
      ocupado: boolean;
      ocupadoPorMim: boolean;
    }[] = [];

    const [hIni] = horaInicioPadrao.split(':').map(Number);
    const [hFim] = horaFimPadrao.split(':').map(Number);

    for (let h = (hIni || 8); h < (hFim || 18); h++) {
      const slotIni = `${String(h).padStart(2, '0')}:00`;
      const slotFim = `${String(h + 1).padStart(2, '0')}:00`;

      const visitaOcupada = visitasOcupadas.find(
        (v) => v.data_visita === diaSelecionado && v.horario_inicio.substring(0, 5) === slotIni
      );

      const ocupado = Boolean(visitaOcupada);
      const ocupadoPorMim = visitaOcupada?.prestador_id === prestadorId;

      slots.push({
        horarioInicio: slotIni,
        horarioFim: slotFim,
        ocupado,
        ocupadoPorMim,
      });
    }

    return slots;
  }, [diaSelecionado, horaInicioPadrao, horaFimPadrao, visitasOcupadas, prestadorId]);

  const handleConfirmar = async () => {
    if (!diaSelecionado || !horarioInicio || !horarioFim) {
      Alert.alert('Atenção', 'Selecione um dia e horário para a visita técnica.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setSubmitting(true);
    try {
      const res = await agendarVisitaTecnicaPrestador({
        solicitacaoId,
        prestadorId,
        dataVisita: diaSelecionado,
        horarioInicio,
        horarioFim,
        observacoes: observacoes.trim() || undefined,
      });

      if (res.sucesso) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        Alert.alert(
          'Visita Agendada!',
          'Sua visita técnica foi agendada e registrada no servidor com lock exclusivo. O síndico foi notificado.',
          [{ text: 'OK', onPress: () => { onSucesso(); onClose(); } }]
        );
      } else {
        Alert.alert(
          'Horário Indisponível',
          res.erro || 'Não foi possível agendar este horário. Por favor, escolha outro slot.',
          [{ text: 'Entendi', onPress: () => carregarSlotsOcupados() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao confirmar visita.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <CalendarCheck2 size={20} color={THEME.mid} />
              </View>
              <View>
                <Text style={styles.title}>Agendar Visita Técnica</Text>
                <Text style={styles.subTitle}>Escolha um horário na janela do síndico</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.closeBtn}>
                <X size={18} color={THEME.ink} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Info do Condomínio & Janela */}
            <View style={styles.condoCard}>
              <View style={styles.condoRow}>
                <Building2 size={16} color={THEME.sub} />
                <Text style={styles.condoName}>{pedido?.condominio_nome}</Text>
              </View>
              <View style={styles.janelaInfo}>
                <Clock size={14} color={THEME.mid} />
                <Text style={styles.janelaText}>
                  Janela permitida: {horaInicioPadrao} às {horaFimPadrao}
                </Text>
              </View>
            </View>

            {/* Slider de Dias */}
            <Text style={styles.sectionLabel}>1. SELECIONE A DATA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diasScroll}>
              {diasDisponiveis.map((d) => {
                const isSelected = diaSelecionado === d.dataStr;
                return (
                  <TouchableOpacity
                    key={d.dataStr}
                    onPress={() => {
                      setDiaSelecionado(d.dataStr);
                      setHorarioInicio('');
                      setHorarioFim('');
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                    }}
                    style={[styles.diaCard, isSelected && styles.diaCardSelected]}
                  >
                    <Text style={[styles.diaSemana, isSelected && styles.diaSemanaSelected]}>
                      {d.diaSemana}
                    </Text>
                    <Text style={[styles.diaNumero, isSelected && styles.diaNumeroSelected]}>
                      {d.diaNumero}
                    </Text>
                    <Text style={[styles.diaMes, isSelected && styles.diaMesSelected]}>
                      {d.mesAbrev}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Grid de Horários */}
            <Text style={styles.sectionLabel}>2. SELECIONE O HORÁRIO (1 HORA)</Text>
            {loading ? (
              <ActivityIndicator size="small" color={THEME.mid} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.slotsGrid}>
                {slotsDoDia.map((slot) => {
                  const isSelected = horarioInicio === slot.horarioInicio;
                  const isBlocked = slot.ocupado;

                  return (
                    <TouchableOpacity
                      key={slot.horarioInicio}
                      disabled={isBlocked}
                      onPress={() => {
                        setHorarioInicio(slot.horarioInicio);
                        setHorarioFim(slot.horarioFim);
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                      }}
                      style={[
                        styles.slotBtn,
                        isSelected && styles.slotBtnSelected,
                        isBlocked && styles.slotBtnDisabled,
                      ]}
                    >
                      <Clock
                        size={14}
                        color={isBlocked ? THEME.mute : isSelected ? '#FFFFFF' : THEME.ink}
                      />
                      <Text
                        style={[
                          styles.slotText,
                          isSelected && styles.slotTextSelected,
                          isBlocked && styles.slotTextDisabled,
                        ]}
                      >
                        {slot.horarioInicio} - {slot.horarioFim}
                      </Text>
                      {isBlocked && (
                        <Text style={styles.ocupadoBadge}>Ocupado</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Observações */}
            <Text style={styles.sectionLabel}>3. OBSERVAÇÕES PARA A PORTARIA (OPCIONAL)</Text>
            <TextInput
              style={styles.inputObs}
              placeholder="Ex: Levarei ajudante, placa do veículo ABC-1234..."
              placeholderTextColor={THEME.mute}
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              numberOfLines={3}
            />

            {/* Aviso de Lock Concorrencial */}
            <View style={styles.avisoLock}>
              <ShieldCheck size={16} color={THEME.accent} />
              <Text style={styles.avisoLockText}>
                O horário é bloqueado com exclusividade no servidor. Outro prestador não poderá escolher o mesmo slot.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, (!horarioInicio || submitting) && styles.confirmBtnDisabled]}
              disabled={!horarioInicio || submitting}
              onPress={handleConfirmar}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar Visita Técnica</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 18, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.ink,
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 12,
    color: THEME.sub,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  condoCard: {
    backgroundColor: THEME.bg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  condoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  condoName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.ink,
  },
  janelaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  janelaText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.mid,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.sub,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  diasScroll: {
    marginBottom: 20,
  },
  diaCard: {
    width: 64,
    height: 80,
    borderRadius: 16,
    backgroundColor: THEME.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  diaCardSelected: {
    backgroundColor: THEME.deep,
    borderColor: THEME.deep,
  },
  diaSemana: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.sub,
  },
  diaSemanaSelected: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  diaNumero: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.ink,
    marginVertical: 2,
  },
  diaNumeroSelected: {
    color: '#FFFFFF',
  },
  diaMes: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.mute,
  },
  diaMesSelected: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  slotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: THEME.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  slotBtnSelected: {
    backgroundColor: THEME.mid,
    borderColor: THEME.mid,
  },
  slotBtnDisabled: {
    backgroundColor: '#F1F3F0',
    opacity: 0.55,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
  },
  slotTextSelected: {
    color: '#FFFFFF',
  },
  slotTextDisabled: {
    color: THEME.mute,
    textDecorationLine: 'line-through',
  },
  ocupadoBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.rose,
    backgroundColor: THEME.roseSoft,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  inputObs: {
    backgroundColor: THEME.bg,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: THEME.ink,
    textAlignVertical: 'top',
    minHeight: 70,
    marginBottom: 16,
  },
  avisoLock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.accentSoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  avisoLockText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#065F46',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  confirmBtn: {
    backgroundColor: THEME.deep,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

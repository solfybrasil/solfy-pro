import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import {
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  Briefcase,
  Sun,
  Sunset,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface JanelaDisponibilidadePickerProps {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  horarioInicio: string; // HH:mm
  horarioFim: string;    // HH:mm
  onChange: (valores: {
    dataInicio: string;
    dataFim: string;
    horarioInicio: string;
    horarioFim: string;
  }) => void;
  erro?: string;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRESETS_HORARIO = [
  { id: 'comercial', label: 'Comercial Completo', desc: '08:00 às 18:00', inicio: '08:00', fim: '18:00', icon: Briefcase },
  { id: 'manha', label: 'Manhã', desc: '08:00 às 12:00', inicio: '08:00', fim: '12:00', icon: Sun },
  { id: 'tarde', label: 'Tarde', desc: '13:00 às 17:00', inicio: '13:00', fim: '17:00', icon: Sunset },
];

export const JanelaDisponibilidadePicker: React.FC<JanelaDisponibilidadePickerProps> = ({
  dataInicio,
  dataFim,
  horarioInicio,
  horarioFim,
  onChange,
  erro,
}) => {
  const hoje = useMemo(() => new Date(), []);
  const [dataVisualizada, setDataVisualizada] = useState<Date>(() => {
    if (dataInicio) {
      const parts = dataInicio.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      }
    }
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });

  const [modoSelecao, setModoSelecao] = useState<'inicio' | 'fim'>('inicio');

  const anoAtual = dataVisualizada.getFullYear();
  const mesAtual = dataVisualizada.getMonth();

  // Navegação de mês
  const handleMesAnterior = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDataVisualizada(new Date(anoAtual, mesAtual - 1, 1));
  };

  const handleProximoMes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDataVisualizada(new Date(anoAtual, mesAtual + 1, 1));
  };

  const podeVoltarMes = useMemo(() => {
    const primeiroDiaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const primeiroDiaVisivel = new Date(anoAtual, mesAtual, 1);
    return primeiroDiaVisivel > primeiroDiaMesAtual;
  }, [hoje, anoAtual, mesAtual]);

  // Geração dos dias do mês na grade de 7 colunas
  const diasDoMes = useMemo(() => {
    const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay();
    const totalDiasMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

    const dias: {
      diaNumero: number;
      dataStr: string;
      isMesAtual: boolean;
      isPassado: boolean;
      isHoje: boolean;
    }[] = [];

    // Preenche dias do mês anterior
    const totalDiasMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const diaNum = totalDiasMesAnterior - i;
      const mesAnt = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;
      const dataStr = `${anoAnt}-${String(mesAnt + 1).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
      dias.push({
        diaNumero: diaNum,
        dataStr,
        isMesAtual: false,
        isPassado: true,
        isHoje: false,
      });
    }

    // Dias do mês atual
    const hojeStr = hoje.toISOString().split('T')[0];
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPassado = dataStr < hojeStr;
      const isHoje = dataStr === hojeStr;
      dias.push({
        diaNumero: d,
        dataStr,
        isMesAtual: true,
        isPassado,
        isHoje,
      });
    }

    // Preenche até múltiplo de 7
    const resto = dias.length % 7;
    if (resto > 0) {
      const faltam = 7 - resto;
      const mesProx = mesAtual === 11 ? 0 : mesAtual + 1;
      const anoProx = mesAtual === 11 ? anoAtual + 1 : anoAtual;
      for (let i = 1; i <= faltam; i++) {
        const dataStr = `${anoProx}-${String(mesProx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dias.push({
          diaNumero: i,
          dataStr,
          isMesAtual: false,
          isPassado: false,
          isHoje: false,
        });
      }
    }

    return dias;
  }, [anoAtual, mesAtual, hoje]);

  // Clique estilo compra de passagem aérea
  const handleDiaClick = (dataStr: string, isPassado: boolean) => {
    if (isPassado) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!dataInicio || (dataInicio && dataFim)) {
      // Primeiro clique: data de início
      onChange({
        dataInicio: dataStr,
        dataFim: '',
        horarioInicio,
        horarioFim,
      });
      setModoSelecao('fim');
    } else if (dataInicio && !dataFim) {
      if (dataStr < dataInicio) {
        // Se clicar em data anterior ao início, define novo início
        onChange({
          dataInicio: dataStr,
          dataFim: '',
          horarioInicio,
          horarioFim,
        });
        setModoSelecao('fim');
      } else {
        // Segundo clique: data final (volta)
        onChange({
          dataInicio,
          dataFim: dataStr,
          horarioInicio,
          horarioFim,
        });
        setModoSelecao('inicio');
      }
    }
  };

  // Cálculo de dias úteis e corridos
  const resumoJanela = useMemo(() => {
    if (!dataInicio || !dataFim) return null;

    const [a1, m1, d1] = dataInicio.split('-').map(Number);
    const [a2, m2, d2] = dataFim.split('-').map(Number);

    const inicioDate = new Date(a1, m1 - 1, d1);
    const fimDate = new Date(a2, m2 - 1, d2);

    if (fimDate < inicioDate) return null;

    const diffMs = fimDate.getTime() - inicioDate.getTime();
    const diasCorridos = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

    let diasUteis = 0;
    const cur = new Date(inicioDate);
    while (cur <= fimDate) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        diasUteis++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return { diasCorridos, diasUteis };
  }, [dataInicio, dataFim]);

  const handlePresetHorario = (inicio: string, fim: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({
      dataInicio,
      dataFim,
      horarioInicio: inicio,
      horarioFim: fim,
    });
  };

  const presetAtivoId = useMemo(() => {
    const match = PRESETS_HORARIO.find((p) => p.inicio === horarioInicio && p.fim === horarioFim);
    return match ? match.id : 'custom';
  }, [horarioInicio, horarioFim]);

  const formatarDataBr = (str?: string) => {
    if (!str) return '—';
    const parts = str.split('-');
    if (parts.length !== 3) return str;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <View style={s.container}>
      {/* ── CABEÇALHO DO BLOCO ── */}
      <View style={s.headerBox}>
        <View style={s.headerTitleRow}>
          <View style={s.headerIconBadge}>
            <CalendarDays size={16} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>
              Janela de Disponibilidade para Visitas Técnicas <Text style={{ color: '#E11D48' }}>*</Text>
            </Text>
            <Text style={s.headerDesc}>
              Defina o período e a faixa de horário em que o condomínio autoriza a entrada de prestadores para vistoria.
            </Text>
          </View>
        </View>

        {/* Status de Seleção Atual (Estilo Passagem Aérea: Origem → Destino) */}
        <View style={s.flightBadgeRow}>
          <View style={[s.flightPill, dataInicio ? s.flightPillActive : null]}>
            <Text style={s.flightPillLabel}>INÍCIO</Text>
            <Text style={[s.flightPillValue, dataInicio ? s.flightPillValueActive : null]}>
              {dataInicio ? formatarDataBr(dataInicio) : 'Selecione data'}
            </Text>
          </View>
          <Text style={s.flightArrow}>→</Text>
          <View style={[s.flightPill, dataFim ? s.flightPillActive : null]}>
            <Text style={s.flightPillLabel}>TÉRMINO</Text>
            <Text style={[s.flightPillValue, dataFim ? s.flightPillValueActive : null]}>
              {dataFim ? formatarDataBr(dataFim) : 'Selecione data'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── CARD PRINCIPAL: CALENDÁRIO RANGE ESTILO COMPRA DE PASSAGEM ── */}
      <View style={s.calendarCard}>
        {/* Navegador de Mês */}
        <View style={s.monthNavRow}>
          <Text style={s.monthTitle}>
            {MESES[mesAtual]} <Text style={s.yearTitle}>{anoAtual}</Text>
          </Text>

          <View style={s.navButtons}>
            <TouchableOpacity
              onPress={handleMesAnterior}
              disabled={!podeVoltarMes}
              style={[s.navBtn, !podeVoltarMes && s.navBtnDisabled]}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={podeVoltarMes ? '#0F172A' : '#94A3B8'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleProximoMes}
              style={s.navBtn}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Grade do Calendário */}
        <View style={s.gridContainer}>
          {/* Header com Dias da Semana */}
          <View style={s.weekDaysRow}>
            {DIAS_SEMANA.map((ds, idx) => (
              <View key={ds} style={s.weekDayCell}>
                <Text
                  style={[
                    s.weekDayText,
                    (idx === 0 || idx === 6) && s.weekDayTextWeekend,
                  ]}
                >
                  {ds}
                </Text>
              </View>
            ))}
          </View>

          {/* Dias em Grid de 7 Colunas */}
          <View style={s.daysGrid}>
            {diasDoMes.map((dia, idx) => {
              const isInicio = dia.dataStr === dataInicio;
              const isFim = dia.dataStr === dataFim;
              const hasFullRange = dataInicio && dataFim && dataFim > dataInicio;
              const isInRange = hasFullRange && dia.dataStr > dataInicio && dia.dataStr < dataFim;
              const isClickable = !dia.isPassado && dia.isMesAtual;

              return (
                <View key={idx} style={s.dayCellWrapper}>
                  {/* Faixa conectora de range entre datas (Estilo Passagem Aérea) */}
                  {isInRange && <View style={s.rangeConnectorMiddle} />}
                  {isInicio && hasFullRange && <View style={s.rangeConnectorStart} />}
                  {isFim && hasFullRange && <View style={s.rangeConnectorEnd} />}

                  <TouchableOpacity
                    disabled={!isClickable}
                    onPress={() => handleDiaClick(dia.dataStr, dia.isPassado)}
                    style={[
                      s.dayButton,
                      (isInicio || isFim) && s.dayButtonSelected,
                      isInRange && s.dayButtonInRange,
                      dia.isHoje && !isInicio && !isFim && s.dayButtonToday,
                      !dia.isMesAtual && s.dayButtonOtherMonth,
                      dia.isPassado && s.dayButtonPast,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        s.dayText,
                        (isInicio || isFim) && s.dayTextSelected,
                        isInRange && s.dayTextInRange,
                        dia.isHoje && !isInicio && !isFim && s.dayTextToday,
                        !dia.isMesAtual && s.dayTextOtherMonth,
                        dia.isPassado && s.dayTextPast,
                      ]}
                    >
                      {dia.diaNumero}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Dica de Interação & Contador de Dias Úteis */}
        <View style={s.calendarFooterRow}>
          <View style={s.hintRow}>
            <View style={s.hintDot} />
            <Text style={s.hintText}>
              {dataInicio && !dataFim
                ? 'Agora clique na data limite para fechar o período'
                : 'Clique no 1º dia e no último dia desejados'}
            </Text>
          </View>

          {resumoJanela && (
            <View style={s.summaryBadge}>
              <Text style={s.summaryBadgeText}>
                {resumoJanela.diasCorridos} dias ({resumoJanela.diasUteis} úteis)
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── FAIXA HORÁRIA PERMITIDA & PRESETS ── */}
      <View style={s.timeCard}>
        <Text style={s.sectionTitle}>Faixa Horária Permitida para Visitas</Text>
        <Text style={s.sectionDesc}>
          Escolha um modelo padrão de funcionamento do condomínio ou ajuste o horário exato:
        </Text>

        <View style={s.presetsGrid}>
          {PRESETS_HORARIO.map((preset) => {
            const isSelected = presetAtivoId === preset.id;
            const Icon = preset.icon;

            return (
              <TouchableOpacity
                key={preset.id}
                onPress={() => handlePresetHorario(preset.inicio, preset.fim)}
                style={[s.presetBtn, isSelected && s.presetBtnActive]}
                activeOpacity={0.7}
              >
                <View style={s.presetLeft}>
                  <View style={[s.presetIconBox, isSelected && s.presetIconBoxActive]}>
                    <Icon size={14} color={isSelected ? '#FFFFFF' : '#059669'} />
                  </View>
                  <View>
                    <Text style={[s.presetLabel, isSelected && s.presetLabelActive]}>
                      {preset.label}
                    </Text>
                    <Text style={[s.presetHours, isSelected && s.presetHoursActive]}>
                      {preset.desc}
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <View style={s.presetCheck}>
                    <Check size={12} color="#059669" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Ajuste Fino Manual */}
        <View style={s.manualTimeBox}>
          <Text style={s.manualTimeTitle}>Ajuste Preciso da Faixa Diária</Text>
          <View style={s.manualInputsRow}>
            <View style={s.timeInputWrapper}>
              <Text style={s.timeInputLabel}>Das:</Text>
              <View style={s.timeInputBox}>
                <Clock size={13} color="#94A3B8" />
                <TextInput
                  value={horarioInicio}
                  onChangeText={(v) =>
                    onChange({
                      dataInicio,
                      dataFim,
                      horarioInicio: v,
                      horarioFim,
                    })
                  }
                  placeholder="08:00"
                  placeholderTextColor="#94A3B8"
                  style={s.timeTextInput}
                />
              </View>
            </View>

            <View style={s.timeInputWrapper}>
              <Text style={s.timeInputLabel}>Até às:</Text>
              <View style={s.timeInputBox}>
                <Clock size={13} color="#94A3B8" />
                <TextInput
                  value={horarioFim}
                  onChangeText={(v) =>
                    onChange({
                      dataInicio,
                      dataFim,
                      horarioInicio,
                      horarioFim: v,
                    })
                  }
                  placeholder="18:00"
                  placeholderTextColor="#94A3B8"
                  style={s.timeTextInput}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Aviso de Trava de Concorrência */}
        <View style={s.lockNoticeBox}>
          <Info size={14} color="#1D4ED8" style={{ marginTop: 2 }} />
          <Text style={s.lockNoticeText}>
            <Text style={{ fontWeight: '800' }}>Trava de Concorrência: </Text>
            Prestadores que optarem por visita técnica agendarão slots exclusivos dentro desta janela. Horários já reservados são bloqueados automaticamente para evitar visitas sobrepostas.
          </Text>
        </View>
      </View>

      {/* Erro de Validação */}
      {erro ? (
        <View style={s.errorRow}>
          <View style={s.errorDot} />
          <Text style={s.errorText}>{erro}</Text>
        </View>
      ) : null}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    marginVertical: 4,
    gap: 12,
  },
  headerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  flightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flightPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  flightPillActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  flightPillLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  flightPillValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  flightPillValueActive: {
    color: '#059669',
  },
  flightArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
    marginHorizontal: 8,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  yearTitle: {
    fontWeight: '500',
    color: '#94A3B8',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  gridContainer: {
    backgroundColor: '#FCFDFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 6,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  weekDayTextWeekend: {
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 2,
  },
  rangeConnectorMiddle: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    right: 0,
    backgroundColor: '#D1FAE5',
  },
  rangeConnectorStart: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: '50%',
    right: 0,
    backgroundColor: '#D1FAE5',
  },
  rangeConnectorEnd: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    right: '50%',
    backgroundColor: '#D1FAE5',
  },
  dayButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  dayButtonSelected: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  dayButtonInRange: {
    backgroundColor: 'transparent',
  },
  dayButtonToday: {
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  dayButtonOtherMonth: {
    opacity: 0.25,
  },
  dayButtonPast: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#0F172A',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextInRange: {
    color: '#065F46',
    fontWeight: '800',
  },
  dayTextToday: {
    color: '#059669',
    fontWeight: '800',
  },
  dayTextOtherMonth: {
    color: '#CBD5E1',
  },
  dayTextPast: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  calendarFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  hintText: {
    fontSize: 10.5,
    color: '#64748B',
    flex: 1,
  },
  summaryBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  summaryBadgeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: '#065F46',
  },
  timeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  presetsGrid: {
    gap: 8,
    marginVertical: 4,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  presetBtnActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  presetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presetIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetIconBoxActive: {
    backgroundColor: '#059669',
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  presetLabelActive: {
    color: '#065F46',
  },
  presetHours: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#64748B',
    marginTop: 1,
  },
  presetHoursActive: {
    color: '#059669',
  },
  presetCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualTimeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  manualTimeTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInputWrapper: {
    flex: 1,
  },
  timeInputLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  timeInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    gap: 6,
    height: 36,
  },
  timeTextInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F172A',
    paddingVertical: 0,
  },
  lockNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  lockNoticeText: {
    fontSize: 10.5,
    color: '#1E3A8A',
    flex: 1,
    lineHeight: 15,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});

export default JanelaDisponibilidadePicker;

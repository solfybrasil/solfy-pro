import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  DollarSign,
  Clock,
  ShieldCheck,
  CreditCard,
  FileText,
  AlertTriangle,
  Lock,
  Building2,
  Trash2,
} from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { SolfyLoader } from '../../../components/SolfyLoader';
import {
  buscarDetalhesPedidoPrestador,
  verificarPodeEnviarCotacao,
  enviarOuEditarCotacaoPrestador,
  retirarCotacaoPrestador,
  OportunidadePrestador,
} from '../../../lib/prestadorPedidosApi';

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
  indigo: '#4F46E5',
  indigoSoft: '#EEF2FF',
  rose: '#BE123C',
  roseSoft: '#FFE4E6',
};

export default function CotacaoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { prestador } = useAuth();

  const [pedido, setPedido] = useState<OportunidadePrestador | null>(null);
  const [loading, setLoading] = useState(true);
  const [bloqueadoPorVisita, setBloqueadoPorVisita] = useState<any>(null);

  const [valorStr, setValorStr] = useState('');
  const [prazoDiasStr, setPrazoDiasStr] = useState('');
  const [garantiaMesesStr, setGarantiaMesesStr] = useState('3');
  const [condicoesPagamento, setCondicoesPagamento] = useState('Faturamento após homologação da entrega');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const cotacaoExistente = pedido?.cotacao;
  const isEdicao = Boolean(cotacaoExistente?.id);

  const carregar = useCallback(async () => {
    if (!id || !prestador?.id) return;
    try {
      const data = await buscarDetalhesPedidoPrestador(id, prestador.id);
      setPedido(data);

      // Checa trava de horário de visita
      const checagem = await verificarPodeEnviarCotacao(id, prestador.id);
      if (!checagem.liberado) {
        setBloqueadoPorVisita(checagem);
      } else {
        setBloqueadoPorVisita(null);
      }

      if (data?.cotacao) {
        setValorStr(String(data.cotacao.valor || ''));
        setPrazoDiasStr(String(data.cotacao.prazo_execucao_dias || ''));
        setGarantiaMesesStr(String(data.cotacao.garantia_meses || '3'));
        setCondicoesPagamento(data.cotacao.condicoes_pagamento || 'Faturamento após homologação da entrega');
        setObservacoes(data.cotacao.observacoes || '');
      }
    } catch (err) {
      console.error('[CotacaoScreen] Erro:', err);
    } finally {
      setLoading(false);
    }
  }, [id, prestador?.id]);

  useEffect(() => {
    setLoading(true);
    carregar();
  }, [carregar]);

  const handleSalvar = async () => {
    const valorNum = parseFloat(valorStr.replace(',', '.'));
    const prazoNum = parseInt(prazoDiasStr, 10);
    const garantiaNum = parseInt(garantiaMesesStr, 10) || 0;

    if (!valorNum || valorNum <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor total válido para a proposta comercial.');
      return;
    }
    if (!prazoNum || prazoNum <= 0) {
      Alert.alert('Prazo inválido', 'Informe o prazo de execução em dias úteis.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setSubmitting(true);
    try {
      const res = await enviarOuEditarCotacaoPrestador({
        cotacaoId: cotacaoExistente?.id,
        solicitacaoId: pedido!.solicitacao_id,
        prestadorId: prestador!.id,
        despachoId: pedido?.despacho_id,
        valor: valorNum,
        prazo_execucao_dias: prazoNum,
        garantia_meses: garantiaNum,
        condicoes_pagamento: condicoesPagamento.trim(),
        observacoes: observacoes.trim(),
        origem_cotacao: pedido?.visita ? 'visita_tecnica' : 'direta',
        visita_id: pedido?.visita?.id,
      });

      if (res.sucesso) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        Alert.alert(
          isEdicao ? 'Proposta Atualizada!' : 'Proposta Enviada!',
          'Sua cotação foi enviada para o condomínio.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Erro', res.erro || 'Falha ao processar cotação.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha na conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetirarProposta = () => {
    if (!cotacaoExistente?.id || !pedido || !prestador?.id) return;

    Alert.alert(
      'Retirar Proposta',
      'Tem certeza de que deseja retirar esta proposta comercial? O condomínio não poderá mais selecioná-la.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Retirar',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            try {
              const res = await retirarCotacaoPrestador(
                cotacaoExistente.id,
                pedido.solicitacao_id,
                prestador.id
              );
              if (res.sucesso) {
                Alert.alert('Proposta Retirada', 'Sua proposta foi removida.', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                Alert.alert('Não foi possível retirar', res.erro || 'Erro ao retirar proposta.');
              }
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Falha ao retirar.');
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <SolfyLoader size={54} color={THEME.mid} />
      </View>
    );
  }

  if (bloqueadoPorVisita) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={THEME.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proposta Comercial</Text>
        </View>

        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconCircle}>
            <Lock size={32} color={THEME.indigo} />
          </View>
          <Text style={styles.lockedTitle}>Cotação Bloqueada</Text>
          <Text style={styles.lockedDesc}>
            Você agendou uma visita técnica para este pedido no dia{' '}
            <Text style={{ fontWeight: '700' }}>{bloqueadoPorVisita.data_visita}</Text> das{' '}
            <Text style={{ fontWeight: '700' }}>{bloqueadoPorVisita.horario_inicio}</Text> às{' '}
            <Text style={{ fontWeight: '700' }}>{bloqueadoPorVisita.horario_fim}</Text>.
          </Text>
          <View style={styles.lockedCard}>
            <Text style={styles.lockedCardText}>
              A formulação da proposta comercial só é liberada no sistema após o horário de conclusão da visita técnica.
            </Text>
          </View>
          <TouchableOpacity style={styles.btnVoltar} onPress={() => router.back()}>
            <Text style={styles.btnVoltarText}>Voltar para o Pedido</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={THEME.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEdicao ? 'Editar Proposta' : 'Enviar Cotação'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {pedido?.condominio_nome} • {pedido?.titulo}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Valor Total */}
        <Text style={styles.label}>VALOR TOTAL DOS SERVIÇOS (R$)</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.prefix}>R$</Text>
          <TextInput
            style={styles.inputValor}
            placeholder="0,00"
            placeholderTextColor={THEME.mute}
            keyboardType="numeric"
            value={valorStr}
            onChangeText={setValorStr}
          />
        </View>

        {/* Prazo de Execução */}
        <Text style={styles.label}>PRAZO DE EXECUÇÃO (DIAS ÚTEIS)</Text>
        <View style={styles.inputWrapper}>
          <Clock size={18} color={THEME.sub} />
          <TextInput
            style={styles.inputText}
            placeholder="Ex: 5"
            placeholderTextColor={THEME.mute}
            keyboardType="number-pad"
            value={prazoDiasStr}
            onChangeText={setPrazoDiasStr}
          />
        </View>

        {/* Garantia */}
        <Text style={styles.label}>GARANTIA TÉCNICA (MESES)</Text>
        <View style={styles.garantiaPills}>
          {['3', '6', '12', '24'].map((m) => {
            const isSelected = garantiaMesesStr === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setGarantiaMesesStr(m)}
                style={[styles.garantiaPill, isSelected && styles.garantiaPillSelected]}
              >
                <Text style={[styles.garantiaPillText, isSelected && styles.garantiaPillTextSelected]}>
                  {m} meses
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Condições de Pagamento */}
        <Text style={styles.label}>CONDIÇÕES DE PAGAMENTO</Text>
        <View style={styles.inputWrapper}>
          <CreditCard size={18} color={THEME.sub} />
          <TextInput
            style={styles.inputText}
            placeholder="Ex: Faturamento após aprovação..."
            placeholderTextColor={THEME.mute}
            value={condicoesPagamento}
            onChangeText={setCondicoesPagamento}
          />
        </View>

        {/* Escopo & Observações */}
        <Text style={styles.label}>ESCOPO INCLUSO E OBSERVAÇÕES TÉCNICAS</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Descreva detalhadamente materiais inclusos, equipe técnica, normas atendidas..."
          placeholderTextColor={THEME.mute}
          multiline
          numberOfLines={5}
          value={observacoes}
          onChangeText={setObservacoes}
        />

        {/* Se for edição, botão de retirar proposta */}
        {isEdicao && (
          <TouchableOpacity
            style={styles.retirarBtn}
            onPress={handleRetirarProposta}
            disabled={withdrawing}
          >
            {withdrawing ? (
              <ActivityIndicator size="small" color={THEME.rose} />
            ) : (
              <>
                <Trash2 size={16} color={THEME.rose} />
                <Text style={styles.retirarBtnText}>Retirar Proposta Comercial</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer Fixo */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
          disabled={submitting}
          onPress={handleSalvar}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>
              {isEdicao ? 'Salvar Alterações' : 'Enviar Proposta Oficial'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.sub,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.sub,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.mid,
  },
  inputValor: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: THEME.ink,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.ink,
  },
  garantiaPills: {
    flexDirection: 'row',
    gap: 8,
  },
  garantiaPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  garantiaPillSelected: {
    backgroundColor: THEME.deep,
    borderColor: THEME.deep,
  },
  garantiaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.sub,
  },
  garantiaPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: THEME.surface,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: THEME.ink,
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  retirarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.roseSoft,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  retirarBtnText: {
    color: THEME.rose,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.surface,
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
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  lockedIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.indigoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.ink,
    marginBottom: 10,
    textAlign: 'center',
  },
  lockedDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: THEME.sub,
    textAlign: 'center',
    marginBottom: 20,
  },
  lockedCard: {
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 28,
  },
  lockedCardText: {
    fontSize: 12,
    lineHeight: 18,
    color: THEME.sub,
    textAlign: 'center',
  },
  btnVoltar: {
    backgroundColor: THEME.deep,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnVoltarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

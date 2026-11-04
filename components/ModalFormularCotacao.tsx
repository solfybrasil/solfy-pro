import React, { useState, useEffect } from 'react';
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
  DollarSign,
  Clock,
  ShieldCheck,
  CreditCard,
  FileText,
  AlertTriangle,
  Trash2,
  CheckCircle2,
} from 'lucide-react-native';
import {
  enviarOuEditarCotacaoPrestador,
  retirarCotacaoPrestador,
  OportunidadePrestador,
} from '../lib/prestadorPedidosApi';

interface ModalFormularCotacaoProps {
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

export const ModalFormularCotacao: React.FC<ModalFormularCotacaoProps> = ({
  visible,
  onClose,
  pedido,
  prestadorId,
  onSucesso,
}) => {
  const cotacaoExistente = pedido?.cotacao;
  const isEdicao = Boolean(cotacaoExistente?.id);

  const [valorStr, setValorStr] = useState<string>('');
  const [prazoDiasStr, setPrazoDiasStr] = useState<string>('');
  const [garantiaMesesStr, setGarantiaMesesStr] = useState<string>('3');
  const [condicoesPagamento, setCondicoesPagamento] = useState<string>('Faturamento após homologação da entrega');
  const [observacoes, setObservacoes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (visible && cotacaoExistente) {
      setValorStr(String(cotacaoExistente.valor || ''));
      setPrazoDiasStr(String(cotacaoExistente.prazo_execucao_dias || ''));
      setGarantiaMesesStr(String(cotacaoExistente.garantia_meses || '3'));
      setCondicoesPagamento(cotacaoExistente.condicoes_pagamento || 'Faturamento após homologação da entrega');
      setObservacoes(cotacaoExistente.observacoes || '');
    } else if (visible) {
      setValorStr('');
      setPrazoDiasStr('');
      setGarantiaMesesStr('3');
      setCondicoesPagamento('Faturamento após homologação da entrega');
      setObservacoes('');
    }
  }, [visible, cotacaoExistente]);

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
        prestadorId,
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
          'Sua cotação foi enviada para o condomínio. Você será notificado quando o síndico deliberar.',
          [{ text: 'OK', onPress: () => { onSucesso(); onClose(); } }]
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
    if (!cotacaoExistente?.id) return;

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
                pedido!.solicitacao_id,
                prestadorId
              );
              if (res.sucesso) {
                Alert.alert('Proposta Retirada', 'Sua proposta foi removida com sucesso.', [
                  { text: 'OK', onPress: () => { onSucesso(); onClose(); } },
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <DollarSign size={20} color={THEME.mid} />
              </View>
              <View>
                <Text style={styles.title}>
                  {isEdicao ? 'Editar Proposta Comercial' : 'Enviar Cotação Comercial'}
                </Text>
                <Text style={styles.subTitle}>
                  {pedido?.condominio_nome} • {pedido?.titulo}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.closeBtn}>
                <X size={18} color={THEME.ink} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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
                placeholder="Ex: 50% entrada, 50% na conclusão..."
                placeholderTextColor={THEME.mute}
                value={condicoesPagamento}
                onChangeText={setCondicoesPagamento}
              />
            </View>

            {/* Observações / Escopo */}
            <Text style={styles.label}>ESCOPO INCLUSO E OBSERVAÇÕES TÉCNICAS</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Descreva materiais inclusos, mão de obra, normas atendidas..."
              placeholderTextColor={THEME.mute}
              multiline
              numberOfLines={4}
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

          {/* Footer */}
          <View style={styles.footer}>
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
    maxHeight: '92%',
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
    maxWidth: 240,
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
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.sub,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
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
    backgroundColor: THEME.bg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
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
    backgroundColor: THEME.bg,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: THEME.ink,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  retirarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.roseSoft,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 10,
  },
  retirarBtnText: {
    color: THEME.rose,
    fontSize: 13,
    fontWeight: '700',
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

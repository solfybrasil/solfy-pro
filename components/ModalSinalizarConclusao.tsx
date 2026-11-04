import React, { useState } from 'react';
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
  CheckCircle2,
  Camera,
  ShieldCheck,
  FileCheck2,
  AlertCircle,
} from 'lucide-react-native';
import { sinalizarConclusaoObraPrestador } from '../lib/prestadorExecucaoApi';

interface ModalSinalizarConclusaoProps {
  visible: boolean;
  onClose: () => void;
  solicitacaoId: string;
  solicitacaoTitulo?: string;
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

export const ModalSinalizarConclusao: React.FC<ModalSinalizarConclusaoProps> = ({
  visible,
  onClose,
  solicitacaoId,
  solicitacaoTitulo,
  onSucesso,
}) => {
  const [observacoes, setObservacoes] = useState('');
  const [garantiaDesc, setGarantiaDesc] = useState('Garantia legal de 90 dias conforme CDC e proposta homologada.');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmar = async () => {
    if (!observacoes.trim()) {
      Alert.alert('Observações de Entrega', 'Por favor, descreva brevemente como o serviço foi concluído.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setSubmitting(true);
    try {
      const obsFinal = `${observacoes.trim()}\n\n🛡️ Termo de Garantia: ${garantiaDesc}`;
      const res = await sinalizarConclusaoObraPrestador({
        solicitacaoId,
        observacoes: obsFinal,
        fotos: [],
      });

      if (res.sucesso) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        Alert.alert(
          'Conclusão Sinalizada!',
          'A entrega do serviço foi registrada. O síndico fará a vistoria final para liberar a homologação do serviço.',
          [{ text: 'OK', onPress: () => { onSucesso(); onClose(); } }]
        );
      } else {
        Alert.alert('Erro', res.mensagem || 'Falha ao registrar entrega.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha na conexão.');
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
                <CheckCircle2 size={22} color={THEME.mid} />
              </View>
              <View>
                <Text style={styles.title}>Sinalizar Conclusão da Obra</Text>
                <Text style={styles.subTitle} numberOfLines={1}>
                  {solicitacaoTitulo || 'Entrega do Serviço'}
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
            {/* Aviso Explicativo */}
            <View style={styles.infoBox}>
              <FileCheck2 size={18} color={THEME.mid} style={{ marginTop: 2 }} />
              <Text style={styles.infoBoxText}>
                Ao sinalizar a conclusão, o síndico receberá uma notificação push para realizar a vistoria técnica e homologar o serviço.
              </Text>
            </View>

            {/* Observações da Entrega */}
            <Text style={styles.label}>1. RELATÓRIO / OBSERVAÇÕES DE ENTREGA</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Descreva as etapas concluídas, testes realizados, limpeza do local, etc..."
              placeholderTextColor={THEME.mute}
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              numberOfLines={4}
            />

            {/* Termo de Garantia */}
            <Text style={styles.label}>2. TERMO DE GARANTIA E ASSISTÊNCIA TÉCNICA</Text>
            <TextInput
              style={styles.inputGarantia}
              value={garantiaDesc}
              onChangeText={setGarantiaDesc}
              multiline
              numberOfLines={2}
            />

            {/* Informação sobre comissão */}
            <View style={styles.comissaoAviso}>
              <ShieldCheck size={16} color={THEME.accent} />
              <Text style={styles.comissaoAvisoText}>
                Após a homologação do síndico, a ordem de pagamento da comissão Solfy será gerada com prazo de vencimento para quitação.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              disabled={submitting}
              onPress={handleConfirmar}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar Conclusão do Serviço</Text>
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
    maxHeight: '88%',
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: THEME.accentSoft,
    padding: 14,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#065F46',
    fontWeight: '500',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.sub,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  textArea: {
    backgroundColor: THEME.bg,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: THEME.ink,
    textAlignVertical: 'top',
    minHeight: 90,
    marginBottom: 14,
  },
  inputGarantia: {
    backgroundColor: THEME.bg,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: THEME.ink,
    textAlignVertical: 'top',
    minHeight: 60,
    marginBottom: 16,
  },
  comissaoAviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  comissaoAvisoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#475569',
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

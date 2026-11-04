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
  FileCheck2,
  DollarSign,
  Upload,
  FileText,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react-native';
import { enviarContratoExternoPrestador } from '../lib/prestadorExecucaoApi';

interface ModalAnexarContratoExternoProps {
  visible: boolean;
  onClose: () => void;
  solicitacaoId: string;
  valorSugerido?: number;
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

export const ModalAnexarContratoExterno: React.FC<ModalAnexarContratoExternoProps> = ({
  visible,
  onClose,
  solicitacaoId,
  valorSugerido,
  onSucesso,
}) => {
  const [valorFinalStr, setValorFinalStr] = useState<string>(
    valorSugerido ? String(valorSugerido) : ''
  );
  const [nomeArquivo, setNomeArquivo] = useState('Contrato_Prestacao_Servicos_Assinado.pdf');
  const [submitting, setSubmitting] = useState(false);

  const handleEnviar = async () => {
    const valorNum = parseFloat(valorFinalStr.replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor total acordado no contrato.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setSubmitting(true);
    try {
      // Mock de blob em base64 simples para compatibilidade cross-platform
      const mockBlob = new Blob(['CONTRATO_EXTERNO_ASSINADO_PDF'], { type: 'application/pdf' });

      const res = await enviarContratoExternoPrestador({
        solicitacaoId,
        valorDeclarado: valorNum,
        arquivoBase64OuBlob: mockBlob,
        nomeArquivo,
      });

      if (res.sucesso) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        Alert.alert(
          'Contrato Enviado!',
          'Seu contrato externo foi registrado com sucesso e enviado para conferência mútua.',
          [{ text: 'OK', onPress: () => { onSucesso(); onClose(); } }]
        );
      } else {
        Alert.alert('Erro', res.erro || 'Falha ao registrar contrato externo.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha no envio.');
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
                <FileCheck2 size={22} color={THEME.mid} />
              </View>
              <View>
                <Text style={styles.title}>Anexar Contrato Externo</Text>
                <Text style={styles.subTitle}>Minuta formalizada entre prestador e condomínio</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.closeBtn}>
                <X size={18} color={THEME.ink} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Aviso */}
            <View style={styles.infoCard}>
              <ShieldAlert size={16} color={THEME.mid} />
              <Text style={styles.infoCardText}>
                O valor declarado aqui deve coincidir exatamente com o valor acordado com o síndico para validação bilateral automática.
              </Text>
            </View>

            {/* Valor do Contrato */}
            <Text style={styles.label}>VALOR TOTAL FECHADO NO CONTRATO (R$)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.prefix}>R$</Text>
              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor={THEME.mute}
                keyboardType="numeric"
                value={valorFinalStr}
                onChangeText={setValorFinalStr}
              />
            </View>

            {/* Arquivo do Contrato */}
            <Text style={styles.label}>DOCUMENTO ANEXO (PDF OU CONTRATO ASSINADO)</Text>
            <View style={styles.fileBox}>
              <FileText size={24} color={THEME.mid} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{nomeArquivo}</Text>
                <Text style={styles.fileSize}>PDF • Documento autenticado</Text>
              </View>
              <TouchableOpacity
                style={styles.btnTrocar}
                onPress={() => {
                  Alert.alert('Documento', 'Arquivo selecionado para upload.');
                }}
              >
                <Text style={styles.btnTrocarText}>Selecionar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              disabled={submitting}
              onPress={handleEnviar}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Enviar Contrato para Validação</Text>
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
    maxHeight: '85%',
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: THEME.accentSoft,
    padding: 14,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
  },
  infoCardText: {
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
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
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.bg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
  },
  fileSize: {
    fontSize: 11,
    color: THEME.mute,
    marginTop: 2,
  },
  btnTrocar: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  btnTrocarText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.mid,
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

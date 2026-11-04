import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { ShieldCheck, AlertTriangle, FileText, CheckCircle2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GradientButton } from './GradientButton';
import { FONT } from '../constants/theme';
import {
  registrarAceiteTermoCnpjGrande,
  TEXTO_TERMO_CNPJ_GRANDE_V1,
} from '../lib/condoPrestadorPainelApi';

interface TermoAceiteCnpjGrandeModalProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  onAceito?: () => void;
}

export function TermoAceiteCnpjGrandeModal({
  visible,
  onClose,
  onSuccess,
  onAceito,
}: TermoAceiteCnpjGrandeModalProps) {
  const [aceitou, setAceitou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleConfirmarAceite = async () => {
    if (!aceitou) {
      setErro('Você precisa ler e marcar que aceita os termos para prosseguir.');
      return;
    }

    setErro(null);
    setSalvando(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      const aparelho = `${Platform.OS.toUpperCase()} (${Platform.Version ?? ''})`;
      const res = await registrarAceiteTermoCnpjGrande('v1.0', TEXTO_TERMO_CNPJ_GRANDE_V1, aparelho);

      if (!res.sucesso) {
        setErro(res.erro || 'Falha ao registrar termo no servidor.');
        return;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
      if (typeof onAceito === 'function') {
        onAceito();
      }
      if (!onSuccess && !onAceito && typeof onClose === 'function') {
        onClose();
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose || (() => {})}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <ShieldCheck size={24} color="#1E3E25" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Termo de Aceite — Grande Porte</Text>
              <Text style={styles.headerSubtitle}>Exigido para atendimento corporativo e demandas maiores</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Destaque Importante */}
          <View style={styles.warningBox}>
            <AlertTriangle size={18} color="#D97706" style={{ marginTop: 2 }} />
            <Text style={styles.warningText}>
              A comissão da Solfy é pós-paga e devida após a conclusão do serviço. O não pagamento enseja bloqueio imediato, cobrança judicial e descontinuação da execução.
            </Text>
          </View>

          {/* Texto Integral Rolável */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={true}>
            <Text style={styles.termoTexto}>{TEXTO_TERMO_CNPJ_GRANDE_V1}</Text>
          </ScrollView>

          {erro && (
            <Text style={styles.errorText}>{erro}</Text>
          )}

          {/* Checkbox de Aceite Digital */}
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.8}
            onPress={() => {
              setAceitou(!aceitou);
              setErro(null);
              if (Platform.OS !== 'web') {
                Haptics.selectionAsync().catch(() => {});
              }
            }}
          >
            <View style={[styles.checkbox, aceitou && styles.checkboxActive]}>
              {aceitou && <CheckCircle2 size={18} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>
              Declaro que li, compreendi e aceito integralmente os termos de remuneração pós-paga, comissão de sucesso e consequências legais de inadimplência da Solfy PRO.
            </Text>
          </TouchableOpacity>

          {/* Botões */}
          <View style={styles.footer}>
            <GradientButton
              variant="primary"
              size="lg"
              title="Confirmar e Registrar Aceite"
              loading={salvando}
              disabled={salvando || !aceitou}
              onPress={handleConfirmarAceite}
              style={{ width: '100%', height: 50, borderRadius: 14 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 34, 21, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    padding: 24,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
          elevation: 10,
        }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONT.bold,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  scrollArea: {
    maxHeight: 220,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  termoTexto: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#1E3E25',
    borderColor: '#1E3E25',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 10,
  },
  footer: {
    width: '100%',
  },
});

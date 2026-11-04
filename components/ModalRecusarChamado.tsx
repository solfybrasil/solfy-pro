import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { X, AlertCircle } from 'lucide-react-native';
import { recusarChamadoPrestador } from '../lib/prestadorPedidosApi';

interface ModalRecusarChamadoProps {
  visible: boolean;
  onClose: () => void;
  despachoId: string;
  prestadorId?: string;
  onSucesso: () => void;
}

const MOTIVOS = [
  { id: 'longe', label: 'Longe da minha região de atendimento' },
  { id: 'agenda_cheia', label: 'Agenda cheia / sem horários disponíveis' },
  { id: 'nao_faco', label: 'Não realizo este tipo de serviço' },
  { id: 'outro', label: 'Outro motivo' },
];

export const ModalRecusarChamado: React.FC<ModalRecusarChamadoProps> = ({
  visible,
  onClose,
  despachoId,
  prestadorId,
  onSucesso,
}) => {
  const [motivoSelecionado, setMotivoSelecionado] = useState(MOTIVOS[0].id);
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmarRecusa = async () => {
    setSubmitting(true);
    try {
      const res = await recusarChamadoPrestador({
        despachoId,
        prestadorId,
        motivo: motivoSelecionado,
        observacao: observacao.trim() || undefined,
      });

      if (res.sucesso) {
        Alert.alert(
          'Convite Recusado',
          'Obrigado pelo retorno. O pedido foi retirado do seu feed e repassado a outro profissional sem afetar sua prioridade.',
          [
            {
              text: 'OK',
              onPress: () => {
                onSucesso();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Atenção', res.erro || 'Falha ao recusar convite. Tente novamente.');
      }
    } catch {
      Alert.alert('Erro', 'Ocorreu um erro ao processar sua recusa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Recusar Convite</Text>
              <Text style={styles.subtitle}>
                Nos ajude a entender o motivo da sua recusa.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#5C6B61" />
            </TouchableOpacity>
          </View>

          {/* Aviso Pedagógico Solfy */}
          <View style={styles.avisoBox}>
            <AlertCircle size={18} color="#D97706" style={{ marginTop: 2 }} />
            <Text style={styles.avisoText}>
              <Text style={{ fontWeight: '700' }}>Recusar é melhor que deixar vencer:</Text> convites ignorados reduzem sua prioridade nos próximos pedidos.
            </Text>
          </View>

          {/* Lista de Motivos Rápidos */}
          <View style={styles.optionsList}>
            {MOTIVOS.map((m) => {
              const selected = motivoSelecionado === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.radioItem, selected && styles.radioItemSelected]}
                  onPress={() => setMotivoSelecionado(m.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {motivoSelecionado === 'outro' && (
              <TextInput
                style={styles.input}
                placeholder="Conte brevemente o motivo (opcional)..."
                placeholderTextColor="#8F9E94"
                value={observacao}
                onChangeText={setObservacao}
                maxLength={200}
                multiline
              />
            )}
          </View>

          {/* Footer Ações */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
              onPress={handleConfirmarRecusa}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>Confirmar Recusa</Text>
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
    backgroundColor: 'rgba(9, 34, 21, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D1B12',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#5C6B61',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
  },
  avisoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  avisoText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
    flex: 1,
  },
  optionsList: {
    gap: 8,
    marginBottom: 20,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAE5',
    backgroundColor: '#F8FAF8',
    gap: 12,
  },
  radioItemSelected: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A8B4AC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#DC2626',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  radioLabel: {
    fontSize: 13.5,
    color: '#1F2937',
    fontWeight: '500',
    flex: 1,
  },
  radioLabelSelected: {
    color: '#991B1B',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
    minHeight: 64,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

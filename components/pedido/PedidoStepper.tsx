import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';

export type EtapaPedido =
  | 'convite'
  | 'aceito'
  | 'visita'
  | 'orcamento'
  | 'decisao'
  | 'execucao'
  | 'concluido'
  | 'avaliado';

interface PedidoStepperProps {
  etapaAtual: EtapaPedido;
}

const ETAPAS: { id: EtapaPedido; label: string }[] = [
  { id: 'convite', label: 'Convite' },
  { id: 'aceito', label: 'Aceito' },
  { id: 'visita', label: 'Visita' },
  { id: 'orcamento', label: 'Orçamento' },
  { id: 'decisao', label: 'Decisão' },
  { id: 'execucao', label: 'Execução' },
  { id: 'concluido', label: 'Concluído' },
  { id: 'avaliado', label: 'Avaliado' },
];

export const PedidoStepper: React.FC<PedidoStepperProps> = ({ etapaAtual }) => {
  const currentIndex = ETAPAS.findIndex((e) => e.id === etapaAtual);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ETAPAS.map((etapa, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          return (
            <React.Fragment key={etapa.id}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.circle,
                    isDone && styles.circleDone,
                    isCurrent && styles.circleCurrent,
                    isPending && styles.circlePending,
                  ]}
                >
                  {isDone ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.circleText,
                        isCurrent && styles.circleTextCurrent,
                        isPending && styles.circleTextPending,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>

                <Text
                  style={[
                    styles.label,
                    isDone && styles.labelDone,
                    isCurrent && styles.labelCurrent,
                    isPending && styles.labelPending,
                  ]}
                  numberOfLines={1}
                >
                  {etapa.label}
                </Text>
              </View>

              {idx < ETAPAS.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    idx < currentIndex && styles.connectorDone,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  stepItem: {
    alignItems: 'center',
    width: 60,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleDone: {
    backgroundColor: '#059669',
  },
  circleCurrent: {
    backgroundColor: '#092215',
    borderWidth: 2,
    borderColor: '#34D399',
  },
  circlePending: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  circleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  circleTextCurrent: {
    color: '#FFFFFF',
  },
  circleTextPending: {
    color: '#9CA3AF',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelDone: {
    color: '#065F46',
  },
  labelCurrent: {
    color: '#092215',
    fontWeight: '800',
  },
  labelPending: {
    color: '#9CA3AF',
  },
  connector: {
    width: 20,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  connectorDone: {
    backgroundColor: '#059669',
  },
});

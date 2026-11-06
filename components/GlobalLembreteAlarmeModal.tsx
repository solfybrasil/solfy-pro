import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, Clock, Check } from 'lucide-react-native';
import { tocarSomNotificacao } from '../lib/notificationSound';
import {
  CHAVE_STORAGE_LEMBRETES,
  CHAVE_STORAGE_EXCLUIDOS,
  type AgendaCompromissoItem,
} from '../lib/condoAgendaApi';

export interface LembretePopUpData {
  titulo: string;
  horario: string;
  descricao?: string;
}

let globalPopUpListener: ((data: LembretePopUpData) => void) | null = null;

/**
 * Dispara manualmente o pop-up de lembrete em qualquer tela do app
 */
export function dispararPopUpLembreteGlobal(data: LembretePopUpData) {
  if (globalPopUpListener) {
    globalPopUpListener(data);
  }
}

export function GlobalLembreteAlarmeModal() {
  const [popUpAtivo, setPopUpAtivo] = useState<LembretePopUpData | null>(null);
  const lembretesDisparadosHojeRef = useRef<Set<string>>(new Set());

  // Registra listener para disparo programático
  useEffect(() => {
    globalPopUpListener = (data) => {
      tocarSomNotificacao().catch(() => {});
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      setPopUpAtivo(data);
    };

    return () => {
      globalPopUpListener = null;
    };
  }, []);

  // 1. Escuta notificações do sistema quando app está aberto em primeiro plano
  useEffect(() => {
    let sub: any = null;
    try {
      if (Platform.OS !== 'web') {
        sub = Notifications.addNotificationReceivedListener((notification) => {
          const data: any = notification.request?.content?.data;
          if (data?.tipo === 'lembrete_agenda') {
            const horario = String(data.horario || '');
            const chaveDisparo = `${data.lembreteId || 'lembrete'}_${horario}`;
            lembretesDisparadosHojeRef.current.add(chaveDisparo);

            tocarSomNotificacao().catch(() => {});
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            }
            setPopUpAtivo({
              titulo: String(data.titulo || notification.request?.content?.title || 'Lembrete da Agenda'),
              horario,
              descricao: String(data.descricao || notification.request?.content?.body || ''),
            });
          }
        });
      }
    } catch (_) {}

    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  // 2. Verificador periódico a cada 8 segundos para conferir horário dos lembretes salvos
  useEffect(() => {
    const verificarLembretesDevidos = async () => {
      if (AppState.currentState !== 'active') return;

      try {
        const now = new Date();
        const horaStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const hojeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const raw = await AsyncStorage.getItem(CHAVE_STORAGE_LEMBRETES);
        if (!raw) return;

        const itens: AgendaCompromissoItem[] = JSON.parse(raw);
        if (!Array.isArray(itens) || itens.length === 0) return;

        const rawExcluidos = await AsyncStorage.getItem(CHAVE_STORAGE_EXCLUIDOS);
        const excluidos = new Set<string>(rawExcluidos ? JSON.parse(rawExcluidos) : []);

        const devidos = itens.filter((c) => {
          if (excluidos.has(c.id)) return false;
          if (c.data_inicio !== hojeStr) return false;
          if (c.horario_inicio !== horaStr) return false;
          return !lembretesDisparadosHojeRef.current.has(`${c.id}_${horaStr}`);
        });

        if (devidos.length > 0) {
          const primeiro = devidos[0];
          lembretesDisparadosHojeRef.current.add(`${primeiro.id}_${horaStr}`);

          tocarSomNotificacao().catch(() => {});
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          }

          setPopUpAtivo({
            titulo: primeiro.titulo,
            horario: primeiro.horario_inicio,
            descricao: primeiro.descricao || '',
          });
        }
      } catch (_) {}
    };

    const interval = setInterval(verificarLembretesDevidos, 8000);
    verificarLembretesDevidos();

    return () => clearInterval(interval);
  }, []);

  if (!popUpAtivo) return null;

  return (
    <Modal
      visible={!!popUpAtivo}
      transparent
      animationType="fade"
      onRequestClose={() => setPopUpAtivo(null)}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Bell size={28} color="#FFFFFF" strokeWidth={2.4} />
          </View>

          <View style={styles.tag}>
            <Clock size={13} color="#059669" strokeWidth={2.5} />
            <Text style={styles.tagText}>
              HORÁRIO DO COMPROMISSO • {popUpAtivo.horario}
            </Text>
          </View>

          <Text style={styles.titulo}>{popUpAtivo.titulo}</Text>

          {!!popUpAtivo.descricao && (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{popUpAtivo.descricao}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.btnConfirmar}
            onPress={() => setPopUpAtivo(null)}
            activeOpacity={0.8}
          >
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.btnConfirmarText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 12px 36px rgba(5, 150, 105, 0.25)' }
      : {
          elevation: 12,
          shadowColor: '#059669',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
        }),
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  descBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    width: '100%',
    marginBottom: 18,
  },
  descText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  btnConfirmar: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnConfirmarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

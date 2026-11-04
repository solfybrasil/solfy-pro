import React, { createContext, useState, useContext, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { AlertTriangle, CheckCircle2, Info, HelpCircle, X, ShieldAlert, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT } from '../constants/theme';
import { normalize } from '../constants/layout';

export type AlertType = 'info' | 'success' | 'error' | 'confirm';

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextData {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextData>({} as AlertContextData);

export const useAlert = () => useContext(AlertContext);

// Configurações visuais claras e nítidas (Light & Clean Theme)
const TYPE_CONFIG = {
  info: {
    icon: Info,
    iconColor: '#0284C7',
    iconBg: '#E0F2FE',
    iconBorder: '#BAE6FD',
    btnBg: '#0284C7',
    btnText: '#FFFFFF',
  },
  success: {
    icon: CheckCircle2,
    iconColor: '#059669',
    iconBg: '#D1FAE5',
    iconBorder: '#A7F3D0',
    btnBg: '#10B981',
    btnText: '#FFFFFF',
  },
  error: {
    icon: AlertTriangle,
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    iconBorder: '#FECACA',
    btnBg: '#EF4444',
    btnText: '#FFFFFF',
  },
  confirm: {
    icon: HelpCircle,
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    iconBorder: '#FDE68A',
    btnBg: '#F59E0B',
    btnText: '#FFFFFF',
  },
};

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((opts: AlertOptions) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setOptions({
      type: 'info',
      confirmText: 'Entendi',
      cancelText: 'Cancelar',
      ...opts,
    });
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    setTimeout(() => setOptions(null), 300);
  }, []);

  const handleConfirm = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    hideAlert();
    setTimeout(() => { options?.onConfirm?.(); }, 100);
  };

  const handleCancel = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    hideAlert();
    setTimeout(() => { options?.onCancel?.(); }, 100);
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      {visible && options && (() => {
        const type = options.type ?? 'info';
        const cfg = TYPE_CONFIG[type];
        const IconComponent = cfg.icon;
        const isConfirm = type === 'confirm';
        
        // Identifica se a confirmação é uma ação destrutiva
        const isDestructive = options.isDestructive ||
          /sair|remover|não fechei|desvincular|excluir|deletar|bloquear/i.test(options.confirmText || '') ||
          /sair|desvincular|remover/i.test(options.title || '');

        const confirmBg = isDestructive ? '#EF4444' : cfg.btnBg;

        return (
          <Modal transparent visible animationType="none" statusBarTranslucent>
            {/* Backdrop escurecido suave */}
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={s.backdrop}
            >
              <Pressable style={StyleSheet.absoluteFillObject} onPress={handleCancel} />
            </Animated.View>

            {/* Container Inferior do Card */}
            <View style={[s.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]} pointerEvents="box-none">
              <Animated.View
                entering={SlideInDown.duration(280).damping(26).stiffness(120)}
                exiting={SlideOutDown.duration(200)}
                style={s.drawerCard}
              >
                {/* Header: Ícone claro à esquerda + Botão fechar (X) à direita */}
                <View style={s.topBar}>
                  <View style={[
                    s.iconBadge,
                    { backgroundColor: isDestructive ? '#FEE2E2' : cfg.iconBg, borderColor: isDestructive ? '#FECACA' : cfg.iconBorder }
                  ]}>
                    <IconComponent size={22} color={isDestructive ? '#DC2626' : cfg.iconColor} strokeWidth={2.4} />
                  </View>

                  <TouchableOpacity
                    onPress={handleCancel}
                    style={s.closeBtn}
                    activeOpacity={0.7}
                  >
                    <X size={18} color="#4B5563" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                {/* Título Claro e Nítido */}
                <Text style={s.title}>
                  {options.title}
                </Text>

                {/* Mensagem / Descrição Clara */}
                <Text style={s.message}>
                  {options.message}
                </Text>

                {/* Botões de Ação em Pílula */}
                <View style={s.buttonsRow}>
                  {isConfirm && (
                    <TouchableOpacity
                      style={s.btnCancel}
                      onPress={handleCancel}
                      activeOpacity={0.8}
                    >
                      <Text style={s.btnCancelTxt}>
                        {options.cancelText}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      s.btnConfirm,
                      { backgroundColor: confirmBg },
                      !isConfirm && s.btnFullWidth
                    ]}
                    onPress={handleConfirm}
                    activeOpacity={0.85}
                  >
                    <Text style={s.btnConfirmTxt}>
                      {options.confirmText}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          </Modal>
        );
      })()}
    </AlertContext.Provider>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  drawerCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 36,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    // Sombra suave e elegante em fundo claro
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    alignItems: 'center',
  },
  btnCancel: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.1,
  },
  btnConfirm: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  btnFullWidth: {
    flex: 1,
  },
  btnConfirmTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
});


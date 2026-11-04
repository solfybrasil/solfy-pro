import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bell } from 'lucide-react-native';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationBellProps {
  size?: number;
  iconSize?: number;
  color?: string;
  badgeCount?: number;
  style?: any;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  size = 40,
  iconSize = 18,
  color = '#FFFFFF',
  badgeCount,
  style,
}) => {
  const router = useRouter();
  const { naoLidasTotal, ultimoAvisoTimestamp } = useNotifications();

  // Contagem efetiva: prioriza a prop se fornecida, senão usa o total global
  const total = badgeCount !== undefined ? badgeCount : naoLidasTotal;

  // Animações de balanço do sino (rotation) e pulso do badge
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const prevTimestampRef = useRef(ultimoAvisoTimestamp);

  // Efeito de balanço sonoro e visual quando entra nova notificação
  useEffect(() => {
    if (ultimoAvisoTimestamp && ultimoAvisoTimestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = ultimoAvisoTimestamp;

      // 1. Animação de badalo do sino físico
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -0.75, duration: 70, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0.75, duration: 70, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -0.4, duration: 60, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0.4, duration: 60, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      // 2. Animação de pulso e expansão
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.22, duration: 120, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1.0, friction: 4, tension: 80, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [ultimoAvisoTimestamp, rotateAnim, scaleAnim, pulseAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-22deg', '0deg', '22deg'],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push('/(app)/notificacoes');
  };

  const badgeText = total > 9 ? '9+' : `${total}`;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={[
        styles.wrapper,
        { width: size, height: size, borderRadius: 14 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Notificações. ${total > 0 ? `${total} não lidas` : 'Nenhuma notificação nova'}`}
    >
      {/* Halo de pulso quando toca notificação */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseHalo,
          {
            width: size,
            height: size,
            borderRadius: 14,
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* Card Efeito Vidro Translúcido 100% Neutro / Sem Cor (Idêntico aos Cards Principais) */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.glassCard, { borderRadius: 14 }]}
      >
        {/* Linha de reflexo de vidro superior */}
        <View style={styles.glassHighlight} pointerEvents="none" />

        {/* Ícone com rotação física de balanço */}
        <Animated.View
          style={{
            transform: [{ rotate: rotation }, { scale: scaleAnim }],
          }}
        >
          <Bell size={iconSize} color={color} strokeWidth={2.4} />
        </Animated.View>
      </LinearGradient>

      {/* Badge Numérico em Destaque */}
      {total > 0 && (
        <View style={styles.badgeWrapper}>
          <View style={[styles.badge, total > 9 && styles.badgeWide]}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 40,
    height: 40,
    borderRadius: 14,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 0,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  glassCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    zIndex: 10,
  },
  pulseHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -3,
    right: -3,
    zIndex: 20,
  },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.4,
        shadowRadius: 2,
      },
      web: {
        boxShadow: '0 1px 4px rgba(239, 68, 68, 0.4)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  badgeWide: {
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },
});

export default NotificationBell;

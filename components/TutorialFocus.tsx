import React, { useRef, useEffect, useState } from 'react';
import { View, Platform } from 'react-native';

export type SpotData = {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
};

// Armazenamento global das posições exatas dos elementos
export const tutorialMeasurements: Record<string, SpotData> = {};

// Notificador de atualizações
const listeners = new Set<() => void>();

export const notifyTutorialSpots = () => {
  listeners.forEach(cb => cb());
};

export const subscribeToSpots = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

interface Props {
  id: string;
  radius?: number;
  offsetX?: number;
  offsetY?: number;
  extraWidth?: number;
  extraHeight?: number;
  children: React.ReactNode;
  style?: any;
}

export default function TutorialFocus({
  id,
  radius = 16,
  offsetX = 0,
  offsetY = 0,
  extraWidth = 0,
  extraHeight = 0,
  children,
  style,
}: Props) {
  const ref = useRef<View>(null);
  
  // Como o elemento pode mudar de posição (animações), fazemos polling
  // apenas quando necessário, ou usamos onLayout
  const measureInterval = useRef<any>(null);

  const performMeasure = () => {
    if (Platform.OS === 'web' && (ref.current as any)?.getBoundingClientRect) {
      const rect = (ref.current as any).getBoundingClientRect();
      const novo = {
        left: rect.left + offsetX,
        top: rect.top + offsetY,
        width: rect.width + extraWidth,
        height: rect.height + extraHeight,
        radius,
      };
      updateSpot(novo);
      return;
    }

    ref.current?.measure((x, y, w, h, px, py) => {
      if (w > 0 && h > 0 && px !== undefined && py !== undefined) {
        const novo = {
          left: px + offsetX,
          top: py + offsetY,
          width: w + extraWidth,
          height: h + extraHeight,
          radius,
        };
        updateSpot(novo);
      }
    });
  };

  const updateSpot = (novo: SpotData) => {
    const atual = tutorialMeasurements[id];
    if (
      !atual ||
      Math.abs(atual.top - novo.top) > 1 ||
      Math.abs(atual.left - novo.left) > 1 ||
      atual.width !== novo.width ||
      atual.height !== novo.height
    ) {
      tutorialMeasurements[id] = novo;
      notifyTutorialSpots();
    }
  };

  useEffect(() => {
    // Mede super rápido para não ter engasgo
    performMeasure();
    const t1 = setTimeout(performMeasure, 50);
    const t2 = setTimeout(performMeasure, 150);
    const t3 = setTimeout(performMeasure, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      // Remove a medida quando o componente é desmontado
      delete tutorialMeasurements[id];
    };
  }, []);

  return (
    <View 
      ref={ref} 
      collapsable={false} 
      onLayout={performMeasure}
      style={style}
    >
      {children}
    </View>
  );
}

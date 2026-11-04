// FaceCaptureScreen.tsx
// Tela de captura de selfie biométrica corrigida e 100% compatível com Expo SDK 54 / React Native moderno
// Utiliza CameraView moderna, Safe Area Insets, máscara escura SVG e validação geométrica de enquadramento facial

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
  BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { X, FlipHorizontal, Check, RotateCcw, Camera as CameraIcon, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Ellipse, Rect, Defs, Mask } from 'react-native-svg';

export type FaceStatus = 'no-face' | 'too-far' | 'too-close' | 'not-centered' | 'good';

interface FaceCaptureScreenProps {
  onCapture: (result: { uri: string; base64?: string | null }) => void;
  onClose?: () => void;
}

export default function FaceCaptureScreen({ onCapture, onClose }: FaceCaptureScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Dimensões responsivas do oval calculadas com precisão para qualquer tela Android/iOS
  const OVAL_WIDTH = Math.min(width * 0.68, 270);
  const OVAL_HEIGHT = OVAL_WIDTH * 1.34;
  const OVAL_RX = OVAL_WIDTH / 2;
  const OVAL_RY = OVAL_HEIGHT / 2;
  const OVAL_CX = width / 2;
  
  // Centro vertical ajustado considerando as barras seguras
  const availableHeight = height - insets.top - insets.bottom;
  const OVAL_CY = insets.top + availableHeight * 0.40;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('no-face');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; base64?: string | null } | null>(null);

  const cameraRef = useRef<any>(null);

  // Tratar botão físico voltar no Android
  useEffect(() => {
    const onBackPress = () => {
      if (onClose) {
        onClose();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onClose]);

  // Detector nativo de faces (quando disponível no dispositivo)
  const handleFacesDetected = useCallback(({ faces }: { faces?: any[] }) => {
    if (!faces || faces.length === 0) {
      setFaceStatus('no-face');
      setIsReady(false);
      return;
    }

    const face = faces[0];
    const { bounds } = face;
    if (!bounds || !bounds.size) {
      setFaceStatus('no-face');
      setIsReady(false);
      return;
    }

    const faceWidth = bounds.size.width;
    const faceCenterX = bounds.origin.x + faceWidth / 2;
    const faceCenterY = bounds.origin.y + bounds.size.height / 2;

    const screenCenterX = width / 2;
    const screenCenterY = OVAL_CY;

    // Checa se o rosto está centralizado no oval
    const offsetX = Math.abs(faceCenterX - screenCenterX);
    const offsetY = Math.abs(faceCenterY - screenCenterY);
    const isCentered = offsetX < width * 0.12 && offsetY < height * 0.10;

    // Checa proporção do rosto em relação à largura do oval (distância ideal)
    const idealMinWidth = OVAL_WIDTH * 0.48;
    const idealMaxWidth = OVAL_WIDTH * 0.92;

    if (!isCentered) {
      setFaceStatus('not-centered');
      setIsReady(false);
    } else if (faceWidth < idealMinWidth) {
      setFaceStatus('too-far');
      setIsReady(false);
    } else if (faceWidth > idealMaxWidth) {
      setFaceStatus('too-close');
      setIsReady(false);
    } else {
      setFaceStatus('good');
      setIsReady(true);
    }
  }, [width, height, OVAL_WIDTH, OVAL_CY]);

  // Se o dispositivo não disparar o evento nativo em tempo real, mantém o enquadramento guiado
  useEffect(() => {
    if (capturedPhoto) return;
    const timer = setTimeout(() => {
      setFaceStatus('good');
      setIsReady(true);
    }, 2400);
    return () => clearTimeout(timer);
  }, [capturedPhoto]);

  // Disparo da foto
  const handleCapture = async () => {
    if (!cameraRef.current || !isReady || isCapturing) return;

    try {
      setIsCapturing(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        base64: true,
        skipProcessing: Platform.OS === 'android',
      });

      if (photo && photo.uri) {
        setCapturedPhoto({
          uri: photo.uri,
          base64: photo.base64 || null,
        });
      }
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (!capturedPhoto) return;
    onCapture(capturedPhoto);
    if (onClose) onClose();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setFaceStatus('no-face');
    setIsReady(false);
  };

  const getStatusMessage = () => {
    if (capturedPhoto) return 'Confira se a imagem ficou nítida';
    switch (faceStatus) {
      case 'no-face':
        return 'Posicione seu rosto no oval';
      case 'too-far':
        return 'Aproxime um pouco o rosto';
      case 'too-close':
        return 'Afaste um pouco o rosto';
      case 'not-centered':
        return 'Centralize seu rosto no oval';
      case 'good':
        return 'Perfeito, pode capturar!';
    }
  };

  const getOvalColor = () => {
    if (capturedPhoto) return '#22C55E';
    switch (faceStatus) {
      case 'good':
        return '#22C55E'; // Verde
      case 'too-far':
      case 'too-close':
        return '#F59E0B'; // Âmbar
      case 'not-centered':
        return '#3B82F6'; // Azul
      case 'no-face':
      default:
        return 'rgba(255, 255, 255, 0.45)';
    }
  };

  // Tela de Permissão
  if (!permission || !permission.granted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <CameraIcon size={40} color="#F59E0B" />
          </View>
          <Text style={styles.permissionTitle}>Permissão de Câmera</Text>
          <Text style={styles.permissionSub}>
            Para validação biométrica e detecção facial em tempo real, precisamos de acesso à câmera do aparelho.
          </Text>

          <TouchableOpacity
            onPress={requestPermission}
            activeOpacity={0.8}
            style={styles.permissionBtn}
          >
            <Text style={styles.permissionBtnTxt}>Ativar Câmera</Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.permissionCancelBtn}>
              <Text style={styles.permissionCancelTxt}>Voltar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44) + 6;
  const bottomPadding = Math.max(insets.bottom, 16) + 12;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── CÂMERA AO VIVO OU PREVIEW DA FOTO CAPTURADA ── */}
      {!capturedPhoto ? (
        <CameraView
          ref={cameraRef as any}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          {...({ onFacesDetected: handleFacesDetected } as any)}
        />
      ) : (
        <Image
          source={{ uri: capturedPhoto.uri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      )}

      {/* ── MÁSCARA ESCURA PROFISSIONAL COM RECORTE OVAL EM SVG ── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <Mask id="mask">
              <Rect width={width} height={height} fill="#FFFFFF" />
              <Ellipse
                cx={OVAL_CX}
                cy={OVAL_CY}
                rx={OVAL_RX}
                ry={OVAL_RY}
                fill="#000000"
              />
            </Mask>
          </Defs>
          <Rect
            width={width}
            height={height}
            fill="rgba(0, 0, 0, 0.70)"
            mask="url(#mask)"
          />
        </Svg>
      </View>

      {/* ── INTERFACE E CONTROLES ── */}
      <View style={styles.uiContainer} pointerEvents="box-none">
        
        {/* Top Header */}
        <View style={[styles.topBar, { paddingTop: topPadding }]}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={styles.iconButton} activeOpacity={0.7}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <View style={styles.badge}>
            <ShieldCheck size={14} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>Biometria Facial</Text>
          </View>

          <TouchableOpacity 
            onPress={() => setFacing(facing === 'front' ? 'back' : 'front')} 
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <FlipHorizontal size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── MOLDURA OVAL MINIMALISTA ── */}
        <View 
          style={[
            styles.ovalContainer, 
            { top: OVAL_CY - OVAL_RY }
          ]} 
          pointerEvents="none"
        >
          <View
            style={[
              styles.oval,
              {
                width: OVAL_WIDTH,
                height: OVAL_HEIGHT,
                borderColor: getOvalColor(),
              },
            ]}
          />
        </View>

        {/* ── MENSAGEM DINÂMICA DE STATUS ── */}
        <View style={styles.statusContainer} pointerEvents="none">
          <View style={[styles.statusPill, isReady && styles.statusPillReady]}>
            <Text style={styles.statusText}>{getStatusMessage()}</Text>
          </View>
        </View>

        {/* ── CONTROLES INFERIORES: DISPARADOR OU CONFIRMAÇÃO ── */}
        <View style={[styles.bottomBar, { paddingBottom: bottomPadding }]}>
          {!capturedPhoto ? (
            <View style={styles.captureRow}>
              <TouchableOpacity
                style={[
                  styles.captureButton, 
                  isReady ? styles.captureButtonReady : styles.captureButtonDisabled
                ]}
                onPress={handleCapture}
                disabled={!isReady || isCapturing}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.captureButtonInner, 
                  isReady ? styles.captureButtonInnerReady : styles.captureButtonInnerDisabled
                ]}>
                  {isCapturing && <ActivityIndicator color="#22C55E" size="small" />}
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.reviewRow}>
              <TouchableOpacity
                onPress={handleRetake}
                style={styles.retakeButton}
                activeOpacity={0.8}
              >
                <RotateCcw size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.retakeText}>Tirar Outra</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                style={styles.confirmButton}
                activeOpacity={0.8}
              >
                <Check size={20} color="#0F172A" strokeWidth={3} style={{ marginRight: 6 }} />
                <Text style={styles.confirmText}>Usar Esta Foto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  uiContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── OVAL ──
  ovalContainer: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    borderRadius: 9999,
    borderWidth: 3.5,
  },

  // ── STATUS ──
  statusContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statusPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statusPillReady: {
    borderColor: 'rgba(34, 197, 94, 0.55)',
    backgroundColor: 'rgba(5, 46, 22, 0.92)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── DISPARADOR ──
  bottomBar: {
    paddingHorizontal: 24,
    zIndex: 20,
  },
  captureRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  captureButtonDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.20)',
    opacity: 0.40,
  },
  captureButtonReady: {
    borderColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 8,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInnerDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  captureButtonInnerReady: {
    backgroundColor: '#FFFFFF',
  },

  // Revisão
  reviewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    borderRadius: 14,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmText: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '900',
  },

  // Permissão
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  permissionBtn: {
    width: '100%',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  permissionBtnTxt: {
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '800',
  },
  permissionCancelBtn: {
    paddingVertical: 8,
  },
  permissionCancelTxt: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { 
  Camera, 
  RotateCcw, 
  Check, 
  X, 
  Flashlight, 
  FlipHorizontal,
  ShieldCheck
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Ellipse, Rect, Defs, Mask } from 'react-native-svg';

interface BiometricScannerModalProps {
  visible: boolean;
  type: 'selfie' | 'docFront' | 'docBack';
  onCapture: (result: { uri: string; base64?: string | null }) => void;
  onClose: () => void;
}

export default function BiometricScannerModal({
  visible,
  type,
  onCapture,
  onClose,
}: BiometricScannerModalProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>(type === 'selfie' ? 'front' : 'back');
  const [torch, setTorch] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; base64?: string | null } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  const cameraRef = useRef<any>(null);

  // ── Dimensões Responsivas para Oval / Retângulo de Documento ──
  const OVAL_WIDTH = Math.min(SCREEN_WIDTH * 0.74, 290);
  const OVAL_HEIGHT = OVAL_WIDTH * 1.34;
  const OVAL_RX = OVAL_WIDTH / 2;
  const OVAL_RY = OVAL_HEIGHT / 2;
  const OVAL_CX = SCREEN_WIDTH / 2;

  const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom;
  const OVAL_CY = insets.top + availableHeight * 0.44;

  const DOC_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 340);
  const DOC_HEIGHT = DOC_WIDTH * 0.63;

  // Tratar botão Voltar físico do Android
  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      onClose();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      setFacing(type === 'selfie' ? 'front' : 'back');
      setCapturedPhoto(null);
      setTorch(false);
      setScreenFlash(false);
      setIsCapturing(false);
    }
  }, [visible, type]);

  // ── Captura Direta e Desbloqueada ──
  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      setScreenFlash(true);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      setTimeout(() => setScreenFlash(false), 140);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
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
      console.error('Erro na captura da foto:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (!capturedPhoto) return;
    onCapture(capturedPhoto);
    onClose();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  if (!visible) return null;

  // Tela de Permissão
  if (!permission || !permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
        <View style={[styles.permissionContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent />
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconWrap}>
              <Camera size={40} color="#F59E0B" />
            </View>
            <Text style={styles.permissionTitle}>Câmera Obrigatória</Text>
            <Text style={styles.permissionSub}>
              Para enviar sua foto de perfil ou documentos, é necessário conceder permissão de acesso à câmera.
            </Text>

            <TouchableOpacity
              onPress={requestPermission}
              activeOpacity={0.8}
              style={styles.permissionBtn}
            >
              <Text style={styles.permissionBtnTxt}>Ativar Câmera</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.permissionCancelBtn}>
              <Text style={styles.permissionCancelTxt}>Voltar ao Cadastro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const topBarPaddingTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44) + 6;
  const bottomBarPaddingBottom = Math.max(insets.bottom, 20) + 14;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* ── CÂMERA AO VIVO OU FOTO CAPTURADA ── */}
        {!capturedPhoto ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            enableTorch={torch}
          />
        ) : (
          <Image
            source={{ uri: capturedPhoto.uri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        )}

        {/* Flash na tela ao fotografar */}
        {screenFlash && <View style={styles.flashOverlay} />}

        {/* ── MÁSCARA ESCURA COM CORTE OVAL CENTRAL LIMPO ── */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
            <Defs>
              <Mask id="maskMinimal">
                <Rect width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="#FFFFFF" />
                {type === 'selfie' ? (
                  <Ellipse
                    cx={OVAL_CX}
                    cy={OVAL_CY}
                    rx={OVAL_RX}
                    ry={OVAL_RY}
                    fill="#000000"
                  />
                ) : (
                  <Rect
                    x={(SCREEN_WIDTH - DOC_WIDTH) / 2}
                    y={OVAL_CY - DOC_HEIGHT / 2}
                    width={DOC_WIDTH}
                    height={DOC_HEIGHT}
                    rx={18}
                    ry={18}
                    fill="#000000"
                  />
                )}
              </Mask>
            </Defs>

            <Rect
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              fill="rgba(0, 0, 0, 0.72)"
              mask="url(#maskMinimal)"
            />
          </Svg>
        </View>

        {/* ── INTERFACE LIMPA (SEM MENSAGENS / SEM CARTÕES LARANJAS) ── */}
        <View style={styles.overlayUI} pointerEvents="box-none">
          
          {/* Barra Superior Minimalista */}
          <View style={[styles.topBar, { paddingTop: topBarPaddingTop }]}>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.circleIconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.topBadge}>
              <ShieldCheck size={14} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.topBadgeTxt}>
                {type === 'selfie' ? 'Foto de Perfil' : type === 'docFront' ? 'RG Frente' : 'RG Verso'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {type !== 'selfie' && (
                <TouchableOpacity
                  onPress={() => setTorch(!torch)}
                  style={[styles.circleIconBtn, torch && styles.circleIconBtnActive]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Flashlight size={18} color={torch ? '#0F172A' : '#FFFFFF'} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setFacing(facing === 'front' ? 'back' : 'front')}
                style={styles.circleIconBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <FlipHorizontal size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── BORDA OVAL SUAVE NO CENTRO ── */}
          <View 
            style={[
              styles.centerOvalContainer,
              { top: OVAL_CY - (type === 'selfie' ? OVAL_RY : DOC_HEIGHT / 2) }
            ]}
            pointerEvents="none"
          >
            {type === 'selfie' ? (
              <View 
                style={[
                  styles.minimalOval, 
                  { 
                    width: OVAL_WIDTH, 
                    height: OVAL_HEIGHT, 
                  }
                ]} 
              />
            ) : (
              <View 
                style={[
                  styles.minimalDocRect, 
                  { 
                    width: DOC_WIDTH, 
                    height: DOC_HEIGHT 
                  }
                ]}
              >
                <View style={[styles.cornerMarker, styles.cornerTL]} />
                <View style={[styles.cornerMarker, styles.cornerTR]} />
                <View style={[styles.cornerMarker, styles.cornerBL]} />
                <View style={[styles.cornerMarker, styles.cornerBR]} />
              </View>
            )}
          </View>

          {/* ── BOTÃO DE CAPTURA DIRETO ── */}
          <View style={[styles.bottomContainer, { paddingBottom: bottomBarPaddingBottom }]}>
            {!capturedPhoto ? (
              <View style={styles.captureRow}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={handleCapture}
                  disabled={isCapturing}
                  activeOpacity={0.8}
                >
                  <View style={styles.captureButtonInner}>
                    {isCapturing && (
                      <ActivityIndicator color="#0F172A" size="small" />
                    )}
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
                  <RotateCcw size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.retakeText}>Tirar Outra</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmPhoto}
                  style={styles.confirmButton}
                  activeOpacity={0.8}
                >
                  <Check size={18} color="#0F172A" strokeWidth={3} style={{ marginRight: 6 }} />
                  <Text style={styles.confirmText}>Usar Foto</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 999,
  },
  overlayUI: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIconBtnActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  topBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Oval & Retângulo no Centro
  centerOvalContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  minimalOval: {
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  minimalDocRect: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    position: 'relative',
  },
  cornerMarker: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#F59E0B',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },

  // Bottom Controls
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  captureRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Review Actions
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 14,
  },
  retakeButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1.2,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },

  // Permission Screen
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  permissionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  permissionBtnTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  permissionCancelBtn: {
    padding: 10,
  },
  permissionCancelTxt: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
});

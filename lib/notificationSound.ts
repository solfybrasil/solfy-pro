import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

let audioLoadedSound: Audio.Sound | null = null;
let isAudioConfigured = false;

/**
 * Toca o som oficial de notificação da Solfy e emite vibração tátil.
 * Suporta React Native (iOS/Android) via expo-av e Web via Audio / Web Audio API.
 */
export async function tocarSomNotificacao(): Promise<void> {
  // 1. Feedback háptico instantâneo
  try {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch {}

  // 2. Reprodução de Som no Ambiente Web
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const audio = new window.Audio('/notification.mp3');
        audio.volume = 0.9;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Se autoplay bloqueado pelo navegador, sintetiza chime via Web Audio
            sintetizarChimeWeb();
          });
        }
      }
    } catch {
      sintetizarChimeWeb();
    }
    return;
  }

  // 3. Reprodução de Som Nativa (iOS e Android via expo-av)
  try {
    if (!isAudioConfigured) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});
      isAudioConfigured = true;
    }

    if (audioLoadedSound) {
      try {
        await audioLoadedSound.replayAsync();
        return;
      } catch {
        try {
          await audioLoadedSound.unloadAsync();
        } catch {}
        audioLoadedSound = null;
      }
    }

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/notification.mp3'),
      { shouldPlay: true, volume: 1.0 }
    );

    audioLoadedSound = sound;
  } catch (err) {
    console.warn('[tocarSomNotificacao] Aviso de som nativo:', err);
  }
}

/**
 * Sintetizador acústico suave de dois tons (Web Audio API) caso o browser restrinja mp3
 */
function sintetizarChimeWeb() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc1.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.15); // E6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.45);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {}
}

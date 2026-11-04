import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type SolfyLoaderSize = 'sm' | 'md' | 'lg' | 'xl' | number;

interface SolfyLoaderProps {
  size?: SolfyLoaderSize;
  fullscreen?: boolean;
  color?: string;
  backgroundColor?: string;
  text?: string;
  style?: StyleProp<ViewStyle>;
}

// Largura da logo conforme tamanho
const getSizeInPx = (size: SolfyLoaderSize = 'md'): number => {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'sm':
      return 28;
    case 'md':
      return 44;
    case 'lg':
      return 64;
    case 'xl':
      return 92;
    default:
      return 44;
  }
};

export function SolfyLoader({
  size = 'md',
  fullscreen = false,
  color = 'rgb(13, 82, 0)',
  backgroundColor = '#F6F5F1',
  text,
  style,
}: SolfyLoaderProps) {
  const logoWidth = getSizeInPx(size);
  const logoHeight = logoWidth * (818 / 776);

  // Animações nativas para iOS e Android (Reanimated)
  const sunTranslateY = useSharedValue(0);
  const bodyScaleX = useSharedValue(1);
  const bodyScaleY = useSharedValue(1);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // 0.9s de ciclo: o sol sobe (-38px na escala 776x818) e desce batendo na taça
      sunTranslateY.value = withRepeat(
        withSequence(
          // Subida rápida com desaceleração no ápice
          withTiming(-48, { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.3, 1) }),
          // Queda acelerada até encontrar a taça
          withTiming(0, { duration: 380, easing: Easing.bezier(0.55, 0.05, 0.8, 0.35) }),
          // Repouso momentâneo
          withTiming(0, { duration: 100 })
        ),
        -1,
        false
      );

      // A taça amortece a batida do sol (leve compressão vertical e expansão horizontal)
      bodyScaleX.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 420 }),
          withTiming(1.025, { duration: 120, easing: Easing.out(Easing.ease) }),
          withTiming(0.99, { duration: 160, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 200 })
        ),
        -1,
        false
      );

      bodyScaleY.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 420 }),
          withTiming(0.965, { duration: 120, easing: Easing.out(Easing.ease) }),
          withTiming(1.01, { duration: 160, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 200 })
        ),
        -1,
        false
      );
    }
  }, []);

  const sunAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sunTranslateY.value * (logoHeight / 818) }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: bodyScaleX.value },
      { scaleY: bodyScaleY.value },
    ],
  }));

  // Renderização Web (React Native Web) via CSS Keyframes 60fps por GPU
  if (Platform.OS === 'web') {
    const content = (
      <div className="solfy-loader-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <style dangerouslySetInnerHTML={{ __html: webKeyframes }} />
        <div
          className="solfy-ptr-logo"
          style={{ width: logoWidth, height: logoHeight, position: 'relative', overflow: 'visible' }}
        >
          <svg
            viewBox="0 0 776 818"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Taça e corpo que amortecem */}
            <path
              className="solfy-bounce-body"
              fill={color}
              fillRule="evenodd"
              d="M14,659.115L14,219.891C14,185.949 27.665,15.697 223.851,15C413.018,14.327 423.517,144.587 423.633,171.088C423.648,174.51 423.6,398.352 423.6,398.352C434.032,463.022 489.681,495.64 538.524,496.336C586.713,497.024 645.232,474.673 661,398.4L660.992,158.5L762,158.482L762,599.26C762,599.26 748.532,736.764 626.612,784.803C473.532,845.119 378.389,730.247 378.389,730.247L456.017,666.626C456.017,666.626 534.105,732.406 603.758,684.431C673.41,636.457 660.988,564.584 660.988,564.584C660.988,564.584 545.646,636.383 435.995,570.662C326.343,504.941 321.6,417.983 321.6,417.983L115.128,418L115.1,600.596C115.1,600.596 118.615,625.23 102.674,642.431C86.734,659.631 58.419,659.1 58.419,659.1L14,659.115ZM115.1,318.861L321.637,318.9L321.069,158.461C321.069,158.461 266.722,88.204 170.451,135.192C135.151,152.421 119.046,192.989 115.5,228.57C112.515,258.519 115.1,318.861 115.1,318.861Z"
            />
            {/* O Sol que quica dentro da taça */}
            <circle
              className="solfy-bounce-sun"
              cx="542.235"
              cy="370.316"
              r="68.678"
              fill={color}
            />
          </svg>
        </div>
        {text && <span style={{ fontSize: 13, color: '#7A857D', fontWeight: 500 }}>{text}</span>}
      </div>
    );

    if (fullscreen) {
      return (
        <View style={[styles.fullscreenContainer, { backgroundColor }, style]}>
          {content}
        </View>
      );
    }

    return (
      <View style={[styles.inlineContainer, style]}>
        {content}
      </View>
    );
  }

  // Renderização Mobile Nativo (iOS e Android)
  const nativeContent = (
    <View style={styles.nativeCenter}>
      <Animated.View style={bodyAnimatedStyle}>
        <Svg width={logoWidth} height={logoHeight} viewBox="0 0 776 818">
          <Path
            fill={color}
            fillRule="evenodd"
            d="M14,659.115L14,219.891C14,185.949 27.665,15.697 223.851,15C413.018,14.327 423.517,144.587 423.633,171.088C423.648,174.51 423.6,398.352 423.6,398.352C434.032,463.022 489.681,495.64 538.524,496.336C586.713,497.024 645.232,474.673 661,398.4L660.992,158.5L762,158.482L762,599.26C762,599.26 748.532,736.764 626.612,784.803C473.532,845.119 378.389,730.247 378.389,730.247L456.017,666.626C456.017,666.626 534.105,732.406 603.758,684.431C673.41,636.457 660.988,564.584 660.988,564.584C660.988,564.584 545.646,636.383 435.995,570.662C326.343,504.941 321.6,417.983 321.6,417.983L115.128,418L115.1,600.596C115.1,600.596 118.615,625.23 102.674,642.431C86.734,659.631 58.419,659.1 58.419,659.1L14,659.115ZM115.1,318.861L321.637,318.9L321.069,158.461C321.069,158.461 266.722,88.204 170.451,135.192C135.151,152.421 119.046,192.989 115.5,228.57C112.515,258.519 115.1,318.861 115.1,318.861Z"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.nativeSunAbsolute,
          {
            left: (542.235 / 776) * logoWidth - (68.678 / 776) * logoWidth,
            top: (370.316 / 818) * logoHeight - (68.678 / 818) * logoHeight,
            width: ((68.678 * 2) / 776) * logoWidth,
            height: ((68.678 * 2) / 818) * logoHeight,
          },
          sunAnimatedStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="50" fill={color} />
        </Svg>
      </Animated.View>

      {text && <Text style={styles.labelText}>{text}</Text>}
    </View>
  );

  if (fullscreen) {
    return (
      <View style={[styles.fullscreenContainer, { backgroundColor }, style]}>
        {nativeContent}
      </View>
    );
  }

  return (
    <View style={[styles.inlineContainer, style]}>
      {nativeContent}
    </View>
  );
}

const webKeyframes = `
  .solfy-bounce-sun {
    transform-box: view-box;
    transform-origin: 542px 370px;
    animation: ptr-bounce 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) infinite;
  }

  .solfy-bounce-body {
    transform-box: view-box;
    transform-origin: 388px 660px;
    animation: ptr-cushion 0.9s ease-in-out infinite;
  }

  @keyframes ptr-bounce {
    0% {
      transform: translateY(0);
      animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
    }
    45% {
      transform: translateY(-56px);
      animation-timing-function: cubic-bezier(0.6, 0.05, 0.85, 0.35);
    }
    85% {
      transform: translateY(0);
      animation-timing-function: ease-out;
    }
    92% {
      transform: translateY(-6px);
      animation-timing-function: ease-in;
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes ptr-cushion {
    0%, 40% {
      transform: scale(1, 1);
    }
    85% {
      transform: scale(1.025, 0.97);
    }
    94% {
      transform: scale(0.995, 1.008);
    }
    100% {
      transform: scale(1, 1);
    }
  }
`;

const styles = StyleSheet.create({
  fullscreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F5F1',
  },
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  nativeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nativeSunAbsolute: {
    position: 'absolute',
  },
  labelText: {
    marginTop: 10,
    fontSize: 13,
    color: '#7A857D',
    fontWeight: '500',
  },
});
export default SolfyLoader;

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  Mask,
  Rect,
} from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

interface PostLoginLoaderProps {
  durationSeconds?: number;
  onFinish?: () => void;
}

export function PostLoginLoader({
  durationSeconds = 8,
  onFinish,
}: PostLoginLoaderProps) {
  // Timer obrigatório de 8 segundos pós-login
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinish) {
        onFinish();
      }
    }, durationSeconds * 1000);

    return () => clearTimeout(timer);
  }, [durationSeconds, onFinish]);

  // Renderização Web (React Native Web) com animação pura por GPU
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(500)}
        style={styles.container}
      >
        <style dangerouslySetInnerHTML={{ __html: webStyles }} />

        {/* Halo ambiente suave */}
        <div className="solfy-ambient-halo" />

        {/* Apenas a Logo Solfy centralizada com animação irradial */}
        <div className="solfy-logo-box">
          <svg
            className="solfy-svg-root"
            viewBox="0 0 776 818"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Máscara radial a partir do sol (542.235, 370.316) */}
              <mask id="solfy-mask-reveal" maskUnits="userSpaceOnUse" x="-300" y="-300" width="1400" height="1400">
                <rect x="-300" y="-300" width="1400" height="1400" fill="black" />
                <circle className="solfy-part solfy-reveal" cx="542.235" cy="370.316" r="820" fill="white" />
              </mask>

              <radialGradient id="solfy-wave-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgb(13, 82, 0)" stopOpacity="0.35" />
                <stop offset="65%" stopColor="rgb(13, 82, 0)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="rgb(13, 82, 0)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Ondas / Ripples radiais contínuas que emanam do sol */}
            <g className="solfy-ripples-group">
              <circle
                className="solfy-part solfy-ripple solfy-ripple-1"
                cx="542.235"
                cy="370.316"
                r="740"
                fill="none"
                stroke="rgb(13, 82, 0)"
                strokeWidth="3.5"
              />
              <circle
                className="solfy-part solfy-ripple solfy-ripple-2"
                cx="542.235"
                cy="370.316"
                r="740"
                fill="url(#solfy-wave-grad)"
              />
              <circle
                className="solfy-part solfy-ripple solfy-ripple-3"
                cx="542.235"
                cy="370.316"
                r="740"
                fill="none"
                stroke="rgb(13, 82, 0)"
                strokeWidth="2"
                strokeDasharray="12 10"
              />
            </g>

            {/* Corpo da Logo da Solfy mascarado pela irradiação */}
            <path
              className="solfy-part solfy-body"
              fill="rgb(13, 82, 0)"
              fillRule="evenodd"
              d="M14,659.115L14,219.891C14,185.949 27.665,15.697 223.851,15C413.018,14.327 423.517,144.587 423.633,171.088C423.648,174.51 423.6,398.352 423.6,398.352C434.032,463.022 489.681,495.64 538.524,496.336C586.713,497.024 645.232,474.673 661,398.4L660.992,158.5L762,158.482L762,599.26C762,599.26 748.532,736.764 626.612,784.803C473.532,845.119 378.389,730.247 378.389,730.247L456.017,666.626C456.017,666.626 534.105,732.406 603.758,684.431C673.41,636.457 660.988,564.584 660.988,564.584C660.988,564.584 545.646,636.383 435.995,570.662C326.343,504.941 321.6,417.983 321.6,417.983L115.128,418L115.1,600.596C115.1,600.596 118.615,625.23 102.674,642.431C86.734,659.631 58.419,659.1 58.419,659.1L14,659.115ZM115.1,318.861L321.637,318.9L321.069,158.461C321.069,158.461 266.722,88.204 170.451,135.192C135.151,152.421 119.046,192.989 115.5,228.57C112.515,258.519 115.1,318.861 115.1,318.861Z"
            />

            {/* O Sol (centro constante irradiando) */}
            <circle
              className="solfy-part solfy-sun"
              cx="542.235"
              cy="370.316"
              r="68.678"
              fill="rgb(13, 82, 0)"
            />
          </svg>
        </div>
      </Animated.View>
    );
  }

  // Renderização Nativa para iOS e Android (Apenas a logo com fundo off-white)
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(500)}
      style={styles.container}
    >
      <View style={styles.logoNativeBox}>
        <Svg width={180} height={190} viewBox="0 0 776 818">
          <Defs>
            <Mask id="native-mask-reveal" maskUnits="userSpaceOnUse" x="-300" y="-300" width="1400" height="1400">
              <Rect x="-300" y="-300" width="1400" height="1400" fill="black" />
              <Circle cx="542.235" cy="370.316" r="820" fill="white" />
            </Mask>
          </Defs>

          {/* Corpo da logo */}
          <Path
            fill="rgb(13, 82, 0)"
            fillRule="evenodd"
            d="M14,659.115L14,219.891C14,185.949 27.665,15.697 223.851,15C413.018,14.327 423.517,144.587 423.633,171.088C423.648,174.51 423.6,398.352 423.6,398.352C434.032,463.022 489.681,495.64 538.524,496.336C586.713,497.024 645.232,474.673 661,398.4L660.992,158.5L762,158.482L762,599.26C762,599.26 748.532,736.764 626.612,784.803C473.532,845.119 378.389,730.247 378.389,730.247L456.017,666.626C456.017,666.626 534.105,732.406 603.758,684.431C673.41,636.457 660.988,564.584 660.988,564.584C660.988,564.584 545.646,636.383 435.995,570.662C326.343,504.941 321.6,417.983 321.6,417.983L115.128,418L115.1,600.596C115.1,600.596 118.615,625.23 102.674,642.431C86.734,659.631 58.419,659.1 58.419,659.1L14,659.115ZM115.1,318.861L321.637,318.9L321.069,158.461C321.069,158.461 266.722,88.204 170.451,135.192C135.151,152.421 119.046,192.989 115.5,228.57C112.515,258.519 115.1,318.861 115.1,318.861Z"
          />

          {/* O Sol */}
          <Circle
            cx="542.235"
            cy="370.316"
            r="68.678"
            fill="rgb(13, 82, 0)"
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

const webStyles = `
  .solfy-ambient-halo {
    position: absolute;
    width: 480px;
    height: 480px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(13, 82, 0, 0.2) 0%, rgba(13, 82, 0, 0) 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    pointer-events: none;
    animation: solfy-halo 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes solfy-halo {
    0%, 100% { transform: translate(-50%, -50%) scale(0.75); opacity: 0.25; }
    38% { transform: translate(-50%, -50%) scale(1.35); opacity: 0.65; }
    65% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.4; }
  }

  .solfy-logo-box {
    position: relative;
    z-index: 10;
    width: clamp(130px, 34vmin, 220px);
    height: auto;
    filter: drop-shadow(0 14px 28px rgba(13, 82, 0, 0.08));
  }

  .solfy-svg-root {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .solfy-part {
    transform-box: view-box;
    will-change: transform, opacity;
  }

  .solfy-sun {
    transform-origin: 542.235px 370.316px;
    animation: solfy-v3-sun 2.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  }

  .solfy-reveal {
    transform-origin: 542.235px 370.316px;
    animation: solfy-v3-reveal 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  .solfy-body {
    mask: url(#solfy-mask-reveal);
    -webkit-mask: url(#solfy-mask-reveal);
    transform-origin: 388px 660px;
    animation: solfy-v3-body 2.6s ease-in-out infinite;
  }

  .solfy-ripple {
    transform-origin: 542.235px 370.316px;
    opacity: 0;
  }

  .solfy-ripple-1 {
    animation: solfy-v3-ripple 2.6s cubic-bezier(0.1, 0.7, 0.2, 1) infinite;
  }

  .solfy-ripple-2 {
    animation: solfy-v3-ripple 2.6s cubic-bezier(0.1, 0.7, 0.2, 1) infinite 0.2s;
  }

  .solfy-ripple-3 {
    animation: solfy-v3-ripple 2.6s cubic-bezier(0.1, 0.7, 0.2, 1) infinite 0.4s;
  }

  @keyframes solfy-v3-sun {
    0% { transform: scale(0.92); }
    14% { transform: scale(1.22); }
    24% { transform: scale(0.96); }
    34% { transform: scale(1.04); }
    42%, 75% { transform: scale(1); }
    88% { transform: scale(0.94); }
    100% { transform: scale(0.92); }
  }

  @keyframes solfy-v3-reveal {
    0% { transform: scale(0.08); opacity: 0.15; }
    8% { transform: scale(0.12); opacity: 0.3; }
    42%, 74% { transform: scale(1.05); opacity: 1; }
    88% { transform: scale(0.15); opacity: 0.3; }
    100% { transform: scale(0.08); opacity: 0.15; }
  }

  @keyframes solfy-v3-ripple {
    0%, 6% { transform: scale(0.1); opacity: 0.8; }
    48% { transform: scale(1.15); opacity: 0.22; }
    68%, 100% { transform: scale(1.4); opacity: 0; }
  }

  @keyframes solfy-v3-body {
    0%, 100% { transform: scale(0.99); }
    45%, 65% { transform: scale(1); }
  }
`;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: '#F5F4F0', // Fundo off-white nobre e acolhedor
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoNativeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PostLoginLoader;

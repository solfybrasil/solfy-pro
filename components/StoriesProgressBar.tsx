import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface StoriesProgressBarProps {
  totalSteps: number;
  currentStep: number;
  progressAnim: Animated.Value;
  activeColor?: string;
  trackColor?: string;
}

export const StoriesProgressBar: React.FC<StoriesProgressBarProps> = ({
  totalSteps,
  currentStep,
  progressAnim,
  activeColor = '#FFFFFF',
  trackColor = 'rgba(255, 255, 255, 0.32)',
}) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        let widthInterpolation: any;

        if (index < currentStep) {
          widthInterpolation = '100%';
        } else if (index === currentStep) {
          widthInterpolation = progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
          });
        } else {
          widthInterpolation = '0%';
        }

        return (
          <View key={index} style={[styles.segmentTrack, { backgroundColor: trackColor }]}>
            <Animated.View
              style={[
                styles.segmentFill,
                {
                  backgroundColor: activeColor,
                  width: widthInterpolation,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    width: '100%',
    zIndex: 50,
  },
  segmentTrack: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default StoriesProgressBar;

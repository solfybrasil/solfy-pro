import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

const COMMON = /^(?:password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|abc123|111111|123123|123456|12345678|solfy|solfypro)/i;
const RUN = /(.)\1{3,}/;
const RUN_UP = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|wert|erty|asdf)/i;
const SYMBOL = /[!-/:-@[-`{-~]/;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const defaultPasswordRules: readonly PasswordRule[] = [
  { id: 'length', label: '6 ou mais caracteres', test: (v) => v.length >= 6 },
  { id: 'case', label: 'Letras maiúsculas e minúsculas', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: 'digit', label: 'Pelo menos um número', test: (v) => /\d/.test(v) },
];

const defaultLabels = ['Vazia', 'Fraca', 'Média', 'Forte'] as const;

export function evaluatePasswordStrength(
  value: string,
  rules: readonly PasswordRule[] = defaultPasswordRules,
  labels: readonly string[] = defaultLabels
) {
  const evaluated = rules.map((rule) => ({ ...rule, met: rule.test(value) }));
  const passed = evaluated.reduce((n, r) => n + (r.met ? 1 : 0), 0);
  const guessable =
    value.length > 0 &&
    (COMMON.test(value) || RUN.test(value) || RUN_UP.test(value));

  const score =
    value.length === 0
      ? 0
      : guessable
        ? 1
        : Math.min(rules.length, Math.max(1, passed));

  const label = labels[Math.min(score, labels.length - 1)] ?? '';

  return {
    score,
    max: rules.length,
    label,
    rules: evaluated,
    guessable,
  };
}

export type PasswordStrengthProps = {
  value?: string;
  password?: string;
  rules?: readonly PasswordRule[];
  labels?: readonly string[];
  showRules?: boolean;
  isDark?: boolean;
};

export function PasswordStrength({
  value,
  password,
  rules = defaultPasswordRules,
  labels = defaultLabels,
  showRules = false,
  isDark = false,
}: PasswordStrengthProps) {
  const pwd = value ?? password ?? '';
  const { score, max, label, rules: evaluated, guessable } = useMemo(
    () => evaluatePasswordStrength(pwd, rules, labels),
    [pwd, rules, labels]
  );

  if (!pwd) return null;

  const getToneColor = () => {
    if (score === 0) return isDark ? '#4B5563' : '#9CA3AF';
    if (score <= 1) return '#EF4444'; // Vermelho
    if (score === 2) return '#D97706'; // Âmbar Solfy
    if (score === 3) return '#3B82F6'; // Azul
    return '#10B981'; // Verde
  };

  const toneColor = getToneColor();

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.container}>
      {/* 4 Segment Bars */}
      <View style={styles.barsRow}>
        {Array.from({ length: max }, (_, i) => {
          const isActive = i < score;
          return (
            <View
              key={i}
              style={[
                styles.barBackground,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB' }
              ]}
            >
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: isActive ? toneColor : 'transparent',
                    opacity: isActive ? 1 : 0,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Label and Guessable Warning */}
      <View style={styles.statusRow}>
        <Text style={[styles.strengthLabel, { color: toneColor }]}>
          Força: <Text style={styles.bold}>{label}</Text>
        </Text>
        {guessable && (
          <Text style={[styles.guessableText, { color: isDark ? '#F59E0B' : '#D97706' }]}>
            Padrão fácil de adivinhar
          </Text>
        )}
      </View>

      {/* Rules list if enabled */}
      {showRules && (
        <View style={styles.rulesList}>
          {evaluated.map((r) => (
            <View key={r.id} style={styles.ruleItem}>
              <View
                style={[
                  styles.ruleCheck,
                  { borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D1D5DB' },
                  r.met && { backgroundColor: '#10B981', borderColor: '#10B981' }
                ]}
              >
                {r.met && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text
                style={[
                  styles.ruleText,
                  { color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#6B7280' },
                  r.met && { color: isDark ? '#FFFFFF' : '#111827' }
                ]}
              >
                {r.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  barsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 4,
    width: '100%',
  },
  barBackground: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    flex: 1,
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '800',
  },
  guessableText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  rulesList: {
    marginTop: 8,
    gap: 4,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleCheck: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: {
    fontSize: 11.5,
  },
});

export default PasswordStrength;

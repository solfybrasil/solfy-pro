// ─────────────────────────────────────────────
//  Solfy PRO — Design System v2
//  Solfy Condo — Verde Musgo Exclusivo
// ─────────────────────────────────────────────

export const C = {
  // Backgrounds – warm white/slate
  bg0: '#F8FAFC',       // App background
  bg1: '#FFFFFF',       // Card background
  bg2: '#F1F5F9',       // Light input/section
  bg3: '#E2E8F0',       // Divider/separator

  // Brand (Solfy Condo — Verde Musgo)
  primary:    '#2E5A36',
  primaryDark:'#1A3821',
  primaryBg:  'rgba(46, 90, 54, 0.10)',
  primaryBgLight: '#EDF4EE',

  // Glass
  glass:       'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(255,255,255,0.9)',

  // Gradient Verde Musgo
  grad: ['#132817', '#2E5A36'] as const,
  gradStart: '#132817',
  gradEnd:   '#2E5A36',
  gradMid:   '#204227',

  // Text
  textPrimary:   '#132817',
  textSecondary: '#64748B',
  textTertiary:  '#94A3B8',
  textInverse:   '#FFFFFF',

  // Status
  success:   '#2E5A36',
  successBg: 'rgba(46, 90, 54, 0.10)',
  warning:   '#D97706',
  warningBg: 'rgba(217, 119, 6, 0.10)',
  danger:    '#EF4444',
  dangerBg:  'rgba(239, 68, 68, 0.10)',
  info:      '#0284C7',
  infoBg:    'rgba(2, 132, 199, 0.10)',

  // Divider & Borders
  divider: '#E2E8F0',
  border:  '#E2E8F0',
  surface: '#FFFFFF',

  // Shadow
  shadowColor:  '#132817',
  shadowGreen:  'rgba(46, 90, 54, 0.35)',

  // Text aliases
  textMuted:    '#94A3B8',
  primaryLight: '#EDF4EE',

  // Expo compatible theme properties
  text: '#132817',
  background: '#FFFFFF',
  tint: '#2E5A36',
  icon: '#64748B',
  tabIconDefault: '#94A3B8',
  tabIconSelected: '#2E5A36',
};

export const R = {
  xs:   8,
  sm:   12,
  md:   16,
  lg:   20,
  xl:   24,
  xxl:  32,
  pill: 999,
  full: 999,
};

import { Platform } from 'react-native';

export const FONT = {
  black:     'Arial Rounded MT Bold',
  extrabold: 'Arial Rounded MT Bold',
  bold:      'Arial Rounded MT Bold',
  semibold:  'Arial Rounded MT Bold',
  semiBold:  'Arial Rounded MT Bold',
  medium:    'Arial Rounded MT Bold',
  regular:   'Arial Rounded MT Bold',
};

export const S = {
  xxs:  4,
  xs:   8,
  sm:   12,
  md:   16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export const SH = {
  xs: Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(10, 34, 21, 0.04)' } as any) : {
    shadowColor: C.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(10, 34, 21, 0.06)' } as any) : {
    shadowColor: C.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  card: Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(10, 34, 21, 0.06)' } as any) : {
    shadowColor: C.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: Platform.OS === 'web' ? ({ boxShadow: '0 6px 16px rgba(10, 34, 21, 0.08)' } as any) : {
    shadowColor: C.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const C_DARK = {
  ...C,
  bg0: '#0F172A',
  bg1: '#1E293B',
  bg2: '#334155',
  bg3: '#475569',
  surface: '#1E293B',
  background: '#0F172A',
  border: '#334155',
  divider: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  primary: '#34D399',
  primaryDark: '#059669',
  primaryBg: 'rgba(52, 211, 153, 0.15)',
  primaryLight: 'rgba(52, 211, 153, 0.15)',
  primaryBgLight: '#132817',
  shadowColor: '#000000',
  text: '#F8FAFC',
  tint: '#34D399',
  icon: '#94A3B8',
  tabIconDefault: '#64748B',
  tabIconSelected: '#34D399',
};

export const Colors = {
  light: {
    ...C,
    text: C.textPrimary,
    background: C.bg1,
    tint: C.primary,
    icon: C.textSecondary,
    tabIconDefault: C.textTertiary,
    tabIconSelected: C.primary,
  },
  dark: {
    ...C_DARK,
  },
};

export function obterTokensTema(
  modo: 'claro' | 'escuro' | 'sistema' = 'claro',
  altoContraste = false
) {
  const base = modo === 'escuro' ? C_DARK : C;
  if (!altoContraste) return base;

  return {
    ...base,
    border: modo === 'escuro' ? '#FFFFFF' : '#000000',
    textPrimary: modo === 'escuro' ? '#FFFFFF' : '#000000',
    textSecondary: modo === 'escuro' ? '#E2E8F0' : '#1E293B',
  };
}


import React from 'react';
import {
  Baby,
  Bike,
  Briefcase,
  Camera,
  CarFront,
  Dumbbell,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Laptop,
  Music,
  PiggyBank,
  Plane,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Target,
} from 'lucide-react-native';
import { colors } from '../theme';
import { DEFAULT_GOAL_ICON } from '../data/goalTypes';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const ICONS: Record<string, IconComponent> = {
  Baby, Bike, Briefcase, Camera, CarFront, Dumbbell, Gem, Gift, GraduationCap, Heart, HeartPulse,
  House, Laptop, Music, PiggyBank, Plane, ShieldCheck, Smartphone, Sparkles, Star, Target,
};

/**
 * Ícone de uma meta, a partir do nome guardado em `Goal.icon`.
 * Nomes desconhecidos (por exemplo, de versões futuras) caem no ícone padrão.
 */
export function GoalIcon({ name, size = 20, color = colors.primary }: { name?: string; size?: number; color?: string }) {
  const Icon = (name && ICONS[name]) || ICONS[DEFAULT_GOAL_ICON];
  return <Icon size={size} color={color} />;
}

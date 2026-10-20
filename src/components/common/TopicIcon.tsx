import React from 'react';
import {
  Waves,
  Dumbbell,
  Activity,
  Heart,
  Briefcase,
  Target,
  BookOpen,
  Smile,
  Sparkles,
  Trophy,
  Compass,
  DollarSign,
  Flame,
  Music,
  LucideProps,
} from 'lucide-react';

export const TOPIC_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Waves,
  Dumbbell,
  Activity,
  Heart,
  Briefcase,
  Target,
  BookOpen,
  Smile,
  Sparkles,
  Trophy,
  Compass,
  DollarSign,
  Flame,
  Music,
};

export interface TopicIconOption {
  name: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
}

export const AVAILABLE_TOPIC_ICONS: TopicIconOption[] = [
  { name: 'Waves', label: 'Natación / Agua', icon: Waves },
  { name: 'Dumbbell', label: 'Entrenamiento / Gym', icon: Dumbbell },
  { name: 'Activity', label: 'Salud / Actividad', icon: Activity },
  { name: 'Heart', label: 'Bienestar / Pareja', icon: Heart },
  { name: 'Briefcase', label: 'Trabajo / Carrera', icon: Briefcase },
  { name: 'Target', label: 'Objetivos / Hábitos', icon: Target },
  { name: 'BookOpen', label: 'Estudio / Lectura', icon: BookOpen },
  { name: 'Smile', label: 'Ánimo / Felicidad', icon: Smile },
  { name: 'Trophy', label: 'Logros / Metas', icon: Trophy },
  { name: 'DollarSign', label: 'Finanzas', icon: DollarSign },
  { name: 'Flame', label: 'Energía / Pasión', icon: Flame },
  { name: 'Music', label: 'Música / Arte', icon: Music },
  { name: 'Sparkles', label: 'Creatividad / Especial', icon: Sparkles },
  { name: 'Compass', label: 'Proyectos / Rumbo', icon: Compass },
];

export interface TopicIconProps extends LucideProps {
  name?: string;
  fallback?: React.ComponentType<LucideProps>;
}

export const TopicIcon: React.FC<TopicIconProps> = ({
  name,
  fallback: Fallback = Briefcase,
  ...props
}) => {
  const IconComponent = (name && TOPIC_ICON_MAP[name]) || Fallback;
  return <IconComponent {...props} />;
};

import { PadraoCor } from '../types';

export interface ThemeColors {
  id: PadraoCor;
  name: string;
  desc: string;
  badge: string;
  primaryBg: string;
  primaryHover: string;
  textPrimary: string;
  borderPrimary: string;
  ringPrimary: string;
  softBg: string;
  softBorder: string;
  softText: string;
  dotColor: string;
}

export const THEMES: Record<PadraoCor, ThemeColors> = {
  ambar: {
    id: 'ambar',
    name: 'Kaipira Âmbar Tradicional',
    desc: 'O tom clássico e acolhedor do Restaurante Kaipira',
    badge: 'bg-amber-600',
    primaryBg: 'bg-amber-600',
    primaryHover: 'hover:bg-amber-500',
    textPrimary: 'text-amber-400',
    borderPrimary: 'border-amber-500',
    ringPrimary: 'ring-amber-500',
    softBg: 'bg-amber-950/60',
    softBorder: 'border-amber-800',
    softText: 'text-amber-300',
    dotColor: '#d97706',
  },
  terracota: {
    id: 'terracota',
    name: 'Terracota Fogão a Lenha',
    desc: 'Inspirado nos tijolos e panelas de barro do fogão caipira',
    badge: 'bg-orange-600',
    primaryBg: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-500',
    textPrimary: 'text-orange-400',
    borderPrimary: 'border-orange-500',
    ringPrimary: 'ring-orange-500',
    softBg: 'bg-orange-950/60',
    softBorder: 'border-orange-800',
    softText: 'text-orange-300',
    dotColor: '#ea580c',
  },
  verde: {
    id: 'verde',
    name: 'Verde Mata & Fazenda',
    desc: 'Tons naturais das hortas, couve fresca e pastos do interior',
    badge: 'bg-emerald-600',
    primaryBg: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-500',
    textPrimary: 'text-emerald-400',
    borderPrimary: 'border-emerald-500',
    ringPrimary: 'ring-emerald-500',
    softBg: 'bg-emerald-950/60',
    softBorder: 'border-emerald-800',
    softText: 'text-emerald-300',
    dotColor: '#059669',
  },
  carvao: {
    id: 'carvao',
    name: 'Carvão Nobre & Ouro',
    desc: 'Preto mineral com toques refinados de ouro envelhecido',
    badge: 'bg-yellow-600',
    primaryBg: 'bg-yellow-600',
    primaryHover: 'hover:bg-yellow-500',
    textPrimary: 'text-yellow-400',
    borderPrimary: 'border-yellow-500',
    ringPrimary: 'ring-yellow-500',
    softBg: 'bg-yellow-950/60',
    softBorder: 'border-yellow-800',
    softText: 'text-yellow-300',
    dotColor: '#ca8a04',
  },
  cafe: {
    id: 'cafe',
    name: 'Café Colonial Paulista',
    desc: 'Tradição cafeeira do interior paulista com tons de bronze e canela',
    badge: 'bg-amber-700',
    primaryBg: 'bg-amber-700',
    primaryHover: 'hover:bg-amber-600',
    textPrimary: 'text-amber-300',
    borderPrimary: 'border-amber-600',
    ringPrimary: 'ring-amber-600',
    softBg: 'bg-stone-900',
    softBorder: 'border-amber-900',
    softText: 'text-amber-200',
    dotColor: '#b45309',
  },
};

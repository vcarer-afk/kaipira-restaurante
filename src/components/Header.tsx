import React, { useState, useEffect } from 'react';
import { TipoUsuario, Perfil, PosicaoMenu, PadraoCor, ConfiguracoesSistema } from '../types';
import { THEMES } from '../utils/theme';
import { Cloud, Menu, Clock, Users } from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'cardapio-dia'
  | 'cadastros'
  | 'configuracoes'
  | 'pdv'
  | 'kds'
  | 'led'
  | 'mesas'
  | 'expedicao'
  | 'mensalistas'
  | 'estoque'
  | 'caixa'
  | 'supabase';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentRole: TipoUsuario;
  currentPerfil?: Perfil;
  onChangeRole?: (role: TipoUsuario) => void;
  isLunchTime: boolean;
  onOpenSupabaseModal?: () => void;
  onOpenSlideMenu: () => void;
  pendingKdsCount: number;
  activeConnectionsCount?: number;
  posicaoMenu?: PosicaoMenu;
  padraoCor?: PadraoCor;
  configuracoes?: ConfiguracoesSistema;
  isCloudConfigLoading?: boolean;
  cloudConfigSyncedAt?: Date | null;
  onRefreshCloudConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  currentRole,
  currentPerfil,
  onChangeRole,
  isLunchTime,
  onOpenSupabaseModal,
  onOpenSlideMenu,
  pendingKdsCount,
  activeConnectionsCount = 1,
  posicaoMenu = 'direita',
  padraoCor = 'ambar',
  configuracoes,
  isCloudConfigLoading = false,
  cloudConfigSyncedAt,
  onRefreshCloudConfig,
}) => {
  const theme = THEMES[padraoCor] || THEMES.ambar;

  // Relógio em tempo real no formato "00:00"
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-neutral-900 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Menu Trigger if Posicao is 'esquerda' */}
        {posicaoMenu === 'esquerda' && (
          <button
            onClick={onOpenSlideMenu}
            className={`px-3 py-2 ${theme.primaryBg} ${theme.primaryHover} text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95 uppercase shrink-0`}
            title="Abrir Menu à Esquerda"
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span>
            {pendingKdsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        )}

        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shadow-xs shrink-0 overflow-hidden bg-neutral-900/90"
            style={{
              borderColor: `${theme.dotColor}50`,
            }}
          >
            <img
              src="./logo.png"
              alt="Logo Restaurante Kaipira"
              className="w-full h-full object-contain p-0.5 rounded-lg"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-base font-extrabold tracking-tight text-white truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
                {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
              </span>
              <span className="hidden md:inline-block text-xs text-neutral-400 font-medium">
                · {configuracoes?.cidade || 'Piracicaba'} - {configuracoes?.uf || 'SP'}
              </span>
            </div>
            <div className="hidden xs:flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-neutral-400">
              <span className={isLunchTime ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                {isLunchTime ? 'Almoço (11h-14h)' : 'Fora do Almoço'}
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onRefreshCloudConfig}
                className="text-neutral-400 flex items-center gap-1 hover:text-cyan-300 transition-colors cursor-pointer"
                title={cloudConfigSyncedAt ? `Configurações da Nuvem Carregadas (${cloudConfigSyncedAt.toLocaleTimeString('pt-BR')}) - Clique para recarregar` : 'Sincronizar com a nuvem'}
              >
                <Cloud className={`w-3 h-3 ${isCloudConfigLoading ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
                <span className="hidden sm:inline">{isCloudConfigLoading ? 'Carregando...' : 'Nuvem Ativa'}</span>
                <span className="sm:hidden">{isCloudConfigLoading ? '...' : 'Nuvem'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zone 2: Realtime Clock & Admin Active Connections */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Relógio em tempo real "00:00" */}
          <div
            className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-neutral-850/90 border border-neutral-750 shadow-inner"
            title="Horário Oficial em Tempo Real"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono text-xs sm:text-sm font-black text-white tracking-widest tabular-nums">
              {currentTime}
            </span>
          </div>

          {/* Somente na tela do Administrador/Master/Supervisor: Conexões Ativas "Conectados xx" (oculto em mobile < 640px) */}
          {(currentRole === 'admin' || currentRole === 'master' || currentRole === 'supervisor') && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs font-bold shadow-xs whitespace-nowrap"
              title="Dispositivos e operadores conectados pela internet em tempo real"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono font-black tracking-tight">
                Conectados {String(activeConnectionsCount || 1).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Zone 3: Slide Menu Trigger & Operator Info */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[11px] font-extrabold text-neutral-200 uppercase truncate max-w-[140px]">
              {currentPerfil?.nome?.split(' ')[0] || 'ADMIN'}
            </span>
            <span
              className="text-[10px] font-mono uppercase font-bold"
              style={{ color: theme.dotColor }}
            >
              {currentRole}
            </span>
          </div>

          {/* SLIDE MENU TRIGGER BUTTON (Shown on Right if not 'esquerda') */}
          {posicaoMenu !== 'esquerda' && (
            <button
              onClick={onOpenSlideMenu}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 ${theme.primaryBg} ${theme.primaryHover} text-white rounded-xl text-xs font-black flex items-center gap-1.5 sm:gap-2 shadow-md transition-all hover:scale-105 active:scale-95 uppercase cursor-pointer shrink-0`}
              title="Abrir Menu Principal"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden xs:inline">Menu</span>
              {pendingKdsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

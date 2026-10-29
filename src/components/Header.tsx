import React, { useState, useEffect } from 'react';
import { TipoUsuario, Perfil, PosicaoMenu, PadraoCor, ConfiguracoesSistema } from '../types';
import { THEMES } from '../utils/theme';
import { Cloud, Menu, Clock, Users, ChefHat, Bike } from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'cardapio-dia'
  | 'cadastros'
  | 'configuracoes'
  | 'pdv'
  | 'kds'
  | 'led'
  | 'senhas'
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
  deliveryProntosCount?: number;
  activeConnectionsCount?: number;
  posicaoMenu?: PosicaoMenu;
  padraoCor?: PadraoCor;
  configuracoes?: ConfiguracoesSistema;
  isCloudConfigLoading?: boolean;
  cloudConfigSyncedAt?: Date | null;
  onRefreshCloudConfig?: () => void;
  syncStatus?: 'sincronizado' | 'reconectando';
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
  deliveryProntosCount = 0,
  activeConnectionsCount = 1,
  posicaoMenu = 'direita',
  padraoCor = 'ambar',
  configuracoes,
  isCloudConfigLoading = false,
  cloudConfigSyncedAt,
  onRefreshCloudConfig,
  syncStatus = 'sincronizado',
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

  const temPermissao = (aba: ActiveTab): boolean => {
    if (currentRole === 'master' || currentRole === 'admin' || currentPerfil?.cargo === 'master' || currentPerfil?.cargo === 'admin') {
      return true;
    }
    if (currentPerfil?.permissoes && Array.isArray(currentPerfil.permissoes) && currentPerfil.permissoes.length > 0) {
      const modulo = aba === 'led' ? 'senhas' : (aba as any);
      return currentPerfil.permissoes.includes(modulo);
    }
    if (currentRole === 'cozinha') return aba === 'kds' || aba === 'estoque' || aba === 'senhas' || aba === 'led';
    if (currentRole === 'garcom') return aba === 'mesas' || aba === 'pdv';
    if (currentRole === 'entregador') return aba === 'expedicao';
    if (currentRole === 'atendente') return aba === 'pdv' || aba === 'mesas' || aba === 'expedicao';
    if (currentRole === 'supervisor') return aba !== 'configuracoes';
    return true;
  };

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
              {syncStatus === 'reconectando' ? (
                <button
                  type="button"
                  onClick={onRefreshCloudConfig}
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-amber-300 animate-pulse bg-amber-950/80 border border-amber-600 px-2 sm:px-2.5 py-0.5 rounded-full cursor-pointer shadow-sm"
                  title="Conexão oscilando. Clique para forçar reconexão à nuvem."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Reconectando à Nuvem...</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRefreshCloudConfig}
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 sm:px-2.5 py-0.5 rounded-full hover:bg-emerald-900/60 transition-colors cursor-pointer"
                  title={
                    cloudConfigSyncedAt
                      ? `Sincronizado via Nuvem (${cloudConfigSyncedAt.toLocaleTimeString('pt-BR')}) - Clique para atualizar`
                      : 'Sincronizado via Nuvem'
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="hidden sm:inline">Sincronizado via Nuvem</span>
                  <span className="sm:hidden">Nuvem OK</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Zone 2: Realtime Clock & Quick Nav for KDS & Expedição */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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

          {/* Quick Nav: KDS COZINHA (Pisca em vermelho quando houver pedidos pendentes/em_preparacao) */}
          {temPermissao('kds') && (
            <button
              type="button"
              onClick={() => onSelectTab('kds')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                pendingKdsCount > 0
                  ? 'bg-red-600 text-white animate-pulse border border-red-400 shadow-md shadow-red-950/60'
                  : activeTab === 'kds'
                  ? `${theme.primaryBg} text-white border border-amber-500/50 shadow-xs`
                  : 'bg-neutral-850/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750'
              }`}
              title={
                pendingKdsCount > 0
                  ? `${pendingKdsCount} pedido(s) pendente(s) na cozinha!`
                  : 'KDS Cozinha'
              }
            >
              <ChefHat className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline uppercase">KDS</span>
              {pendingKdsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-red-700 font-black tabular-nums">
                  {pendingKdsCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Nav: EXPEDIÇÃO DELIVERY (Pisca em vermelho quando houver pedidos prontos aguardando entrega) */}
          {temPermissao('expedicao') && (
            <button
              type="button"
              onClick={() => onSelectTab('expedicao')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                deliveryProntosCount > 0
                  ? 'bg-red-600 text-white animate-pulse border border-red-400 shadow-md shadow-red-950/60'
                  : activeTab === 'expedicao'
                  ? `${theme.primaryBg} text-white border border-amber-500/50 shadow-xs`
                  : 'bg-neutral-850/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750'
              }`}
              title={
                deliveryProntosCount > 0
                  ? `${deliveryProntosCount} entrega(s) pronta(s) aguardando despacho!`
                  : 'Expedição & Delivery'
              }
            >
              <Bike className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline uppercase">Expedição</span>
              {deliveryProntosCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-red-700 font-black tabular-nums">
                  {deliveryProntosCount}
                </span>
              )}
            </button>
          )}

          {/* Somente na tela do Administrador/Master/Supervisor: Conexões Ativas "Conectados xx" (oculto em mobile < 640px) */}
          {(currentRole === 'admin' || currentRole === 'master' || currentRole === 'supervisor') && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs font-bold shadow-xs whitespace-nowrap"
              title="Dispositivos e operadores conectados pela internet em tempo real"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono font-black tracking-tight">
                {String(activeConnectionsCount || 1).padStart(2, '0')}
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
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 ${
                pendingKdsCount > 0 || deliveryProntosCount > 0
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse border border-red-400'
                  : `${theme.primaryBg} ${theme.primaryHover} text-white`
              } rounded-xl text-xs font-black flex items-center gap-1.5 sm:gap-2 shadow-md transition-all hover:scale-105 active:scale-95 uppercase cursor-pointer shrink-0`}
              title="Abrir Menu Principal"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden xs:inline">Menu</span>
              {(pendingKdsCount > 0 || deliveryProntosCount > 0) && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

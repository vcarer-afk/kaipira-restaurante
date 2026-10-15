import { TipoUsuario, Perfil, PosicaoMenu, PadraoCor, ConfiguracoesSistema } from '../types';
import { THEMES } from '../utils/theme';
import { UtensilsCrossed, Cloud, Menu } from 'lucide-react';

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
  onChangeRole: (role: TipoUsuario) => void;
  isLunchTime: boolean;
  onOpenSupabaseModal: () => void;
  onOpenSlideMenu: () => void;
  pendingKdsCount: number;
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
  posicaoMenu = 'direita',
  padraoCor = 'ambar',
  configuracoes,
  isCloudConfigLoading = false,
  cloudConfigSyncedAt,
  onRefreshCloudConfig,
}) => {
  const theme = THEMES[padraoCor] || THEMES.ambar;

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
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-9 h-9 rounded-lg border flex items-center justify-center shadow-xs"
            style={{
              backgroundColor: `${theme.dotColor}20`,
              borderColor: `${theme.dotColor}50`,
              color: theme.dotColor,
            }}
          >
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white whitespace-nowrap">
                {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
              </span>
              <span className="hidden sm:inline-block text-xs text-neutral-400 font-medium">
                · {configuracoes?.cidade || 'Piracicaba'} - {configuracoes?.uf || 'SP'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span className={isLunchTime ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                {isLunchTime ? 'Almoço Aberto (11h-14h)' : 'Fora do Almoço'}
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onRefreshCloudConfig}
                className="text-neutral-400 flex items-center gap-1 hover:text-cyan-300 transition-colors cursor-pointer"
                title={cloudConfigSyncedAt ? `Configurações da Nuvem Carregadas (${cloudConfigSyncedAt.toLocaleTimeString('pt-BR')}) - Clique para recarregar` : 'Sincronizar com a nuvem'}
              >
                <Cloud className={`w-3 h-3 ${isCloudConfigLoading ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
                <span>{isCloudConfigLoading ? 'Carregando Nuvem...' : 'Nuvem Ativa'}</span>
              </button>
            </div>
          </div>
        </div>



        {/* Zone 3: Slide Menu Trigger & Operator Info */}
        <div className="flex items-center gap-3 shrink-0">
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
              className={`px-3.5 py-2 ${theme.primaryBg} ${theme.primaryHover} text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95 uppercase`}
              title="Abrir Menu Principal"
            >
              <Menu className="w-4 h-4" />
              <span>Menu</span>
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

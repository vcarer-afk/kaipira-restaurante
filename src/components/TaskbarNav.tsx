import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab } from './Header';
import { TipoUsuario, Perfil, PadraoCor } from '../types';
import { THEMES } from '../utils/theme';
import {
  LayoutDashboard,
  ShoppingBag,
  Utensils,
  ChefHat,
  Bike,
  Banknote,
  Briefcase,
  FileText,
  Sparkles,
  Users,
  BellRing,
  Settings,
  Shield,
  Key,
  Pin,
  PinOff,
  Globe,
} from 'lucide-react';

interface TaskbarNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentRole: TipoUsuario;
  currentPerfil?: Perfil;
  posicao: 'acima' | 'abaixo';
  menuAutoOcultar?: boolean;
  onOpenUsuariosSistema?: () => void;
  pendingKdsCount: number;
  deliveryProntosCount: number;
  padraoCor?: PadraoCor;
  onVisibilityChange?: (visivel: boolean) => void;
  onToggleAutoOcultar?: (novoAutoOcultar: boolean) => void;
}

export const TaskbarNav: React.FC<TaskbarNavProps> = ({
  activeTab,
  onSelectTab,
  currentRole,
  currentPerfil,
  posicao,
  menuAutoOcultar = false,
  onOpenUsuariosSistema,
  pendingKdsCount = 0,
  deliveryProntosCount = 0,
  padraoCor = 'ambar',
  onVisibilityChange,
  onToggleAutoOcultar,
}) => {
  const theme = THEMES[padraoCor] || THEMES.ambar;

  // Se menuAutoOcultar está ativo, inicia recolhido a menos que fixado
  const [isPinned, setIsPinned] = useState(!menuAutoOcultar);
  const [barraVisivel, setBarraVisivel] = useState(!menuAutoOcultar);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincroniza quando a configuração de auto-ocultação for alterada no painel
  useEffect(() => {
    if (!menuAutoOcultar) {
      setIsPinned(true);
      setBarraVisivel(true);
    } else {
      setIsPinned(false);
      setBarraVisivel(false);
    }
  }, [menuAutoOcultar]);

  // Notifica o componente pai sobre a visibilidade efetiva para ajuste de padding dinâmico
  useEffect(() => {
    onVisibilityChange?.(barraVisivel || isPinned);
  }, [barraVisivel, isPinned, onVisibilityChange]);

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBarraVisivel(true);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setBarraVisivel(false);
    }, 300);
  };

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      if (next) {
        setBarraVisivel(true);
      }
      onToggleAutoOcultar?.(!next);
      return next;
    });
  };

  const isSuperAdminKaipira =
    (currentPerfil?.email || '').toLowerCase().trim() === 'admin@kaipira.com' ||
    (currentPerfil?.email || '').toLowerCase().trim() === 'master@kaipira.com' ||
    currentRole === 'master' ||
    currentPerfil?.cargo === 'master';

  const temPermissao = (aba: ActiveTab): boolean => {
    if (aba === 'master-saas') {
      return isSuperAdminKaipira;
    }
    if (
      currentRole === 'master' ||
      currentRole === 'admin' ||
      currentPerfil?.cargo === 'master' ||
      currentPerfil?.cargo === 'admin'
    ) {
      return true;
    }
    if (
      currentPerfil?.permissoes &&
      Array.isArray(currentPerfil.permissoes) &&
      currentPerfil.permissoes.length > 0
    ) {
      const modulo = (aba === 'led' ? 'senhas' : aba) as any;
      return currentPerfil.permissoes.includes(modulo);
    }
    if (currentRole === 'cozinha')
      return aba === 'kds' || aba === 'estoque' || aba === 'senhas' || aba === 'led';
    if (currentRole === 'garcom') return aba === 'mesas' || aba === 'pdv';
    if (currentRole === 'entregador') return aba === 'expedicao';
    if (currentRole === 'atendente') return aba === 'pdv' || aba === 'mesas' || aba === 'expedicao';
    if (currentRole === 'supervisor') return aba !== 'configuracoes';
    return true;
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgePulse?: boolean;
    isCustomAction?: boolean;
    onCustomClick?: () => void;
  }> = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'pdv', label: 'PDV', icon: ShoppingBag },
    { id: 'mesas', label: 'Mesas', icon: Utensils },
    {
      id: 'kds',
      label: 'KDS',
      icon: ChefHat,
      badge: pendingKdsCount > 0 ? pendingKdsCount : undefined,
      badgePulse: pendingKdsCount > 0,
    },
    {
      id: 'expedicao',
      label: 'Expedição',
      icon: Bike,
      badge: deliveryProntosCount > 0 ? deliveryProntosCount : undefined,
      badgePulse: deliveryProntosCount > 0,
    },
    { id: 'caixa', label: 'Caixa', icon: Banknote },
    { id: 'mensalistas', label: 'Mensalistas', icon: Briefcase },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'cardapio-dia', label: 'Cardápio', icon: Sparkles },
    { id: 'cadastros', label: 'Cadastros', icon: Users },
    { id: 'led', label: 'Painel LED', icon: BellRing },
    { id: 'configuracoes', label: 'Ajustes', icon: Settings },
    { id: 'master-saas', label: 'SaaS Global', icon: Globe },
  ];

  const visibleItems = navItems.filter((item) => temPermissao(item.id));

  const isAutoHidden = menuAutoOcultar && !isPinned;
  const isEfetivamenteVisivel = !isAutoHidden || barraVisivel;

  // Classes de posicionamento para 'acima' ou 'abaixo'
  const isAcima = posicao === 'acima';

  // Posicionamento base
  const containerPositionClass = isAcima
    ? isAutoHidden
      ? `fixed top-0 left-0 right-0 z-50 pt-2 transition-transform duration-300 ease-in-out ${
          isEfetivamenteVisivel ? 'translate-y-0' : '-translate-y-full'
        }`
      : 'sticky top-16 z-30 pt-2 pb-1'
    : `fixed bottom-0 left-0 right-0 z-50 pb-2 transition-transform duration-300 ease-in-out ${
        isEfetivamenteVisivel ? 'translate-y-0' : 'translate-y-full'
      }`;

  return (
    <>
      {/* Faixa invisível de detecção nas bordas extremas da tela quando auto-ocultada */}
      {isAutoHidden && !barraVisivel && (
        <div
          onMouseEnter={handleMouseEnter}
          className={`fixed left-0 right-0 z-40 h-3 cursor-pointer bg-amber-500/0 hover:bg-amber-500/10 transition-colors ${
            isAcima ? 'top-0' : 'bottom-0'
          }`}
          title="Passe o mouse para exibir a Barra de Tarefas"
        />
      )}

      {/* Container Principal da Barra de Tarefas Centralizada */}
      <nav
        aria-label="Barra de Tarefas Kaipira"
        className={`barra-tarefas-kaipira ${containerPositionClass}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full flex items-center justify-center pointer-events-none px-2 sm:px-4">
          <div className="pointer-events-auto flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl max-w-full overflow-x-auto scrollbar-none ring-1 ring-white/5">
            {/* Botões de atalho */}
            {visibleItems.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              const hasBadge = typeof item.badge === 'number' && item.badge > 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? `${theme.primaryBg} text-white shadow-md shadow-amber-950/40 border border-white/20`
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                  }`}
                  title={item.label}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-neutral-400'}`} />
                  <span className="hidden md:inline uppercase text-[11px] tracking-wide">
                    {item.label}
                  </span>

                  {hasBadge && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full tabular-nums ${
                        item.badgePulse
                          ? 'bg-red-500 text-white animate-pulse shadow-xs shadow-red-900'
                          : 'bg-amber-500 text-neutral-950'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Atalho Especial: Gestão de Usuários (Restrito estritamente a admin@kaipira.com) */}
            {isSuperAdminKaipira && onOpenUsuariosSistema && (
              <button
                type="button"
                onClick={onOpenUsuariosSistema}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40"
                title="Gestão de Usuários e Chaves de Acesso (Exclusivo admin@kaipira.com)"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline uppercase text-[11px] tracking-wide">
                  Usuários
                </span>
                <Key className="w-3 h-3 text-amber-500 hidden sm:inline" />
              </button>
            )}

            {/* Botão minúsculo de Fixar / Desafixar (Pin) */}
            <div className="pl-1 sm:pl-2 ml-1 border-l border-neutral-800 flex items-center">
              <button
                type="button"
                onClick={togglePin}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isPinned
                    ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                }`}
                title={
                  isPinned
                    ? 'Barra Fixada (Clique para desafixar e auto-ocultar)'
                    : 'Barra com Auto-Ocultação (Clique para fixar aberta)'
                }
                aria-label={isPinned ? 'Desafixar barra' : 'Fixar barra'}
              >
                {isPinned ? (
                  <Pin className="w-3.5 h-3.5 rotate-45" />
                ) : (
                  <PinOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

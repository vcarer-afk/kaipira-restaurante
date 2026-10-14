import React from 'react';
import { ActiveTab } from './Header';
import { TipoUsuario, Perfil, PosicaoMenu, PadraoCor } from '../types';
import { THEMES } from '../utils/theme';
import {
  LayoutDashboard,
  ShoppingBag,
  Utensils,
  ChefHat,
  BellRing,
  Bike,
  Briefcase,
  Boxes,
  Banknote,
  Database,
  X,
  LogOut,
  UserCheck,
  ChevronRight,
  Lock,
  Users,
  Crown,
  Sparkles,
} from 'lucide-react';

interface SlideMenuRightProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentRole: TipoUsuario;
  currentPerfil?: Perfil;
  onChangeRole: (role: TipoUsuario) => void;
  onOpenSupabaseModal: () => void;
  onLogout: () => void;
  pendingKdsCount: number;
  posicaoMenu?: PosicaoMenu;
  padraoCor?: PadraoCor;
}

export const SlideMenuRight: React.FC<SlideMenuRightProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  currentRole,
  currentPerfil,
  onChangeRole,
  onOpenSupabaseModal,
  onLogout,
  pendingKdsCount,
  posicaoMenu = 'direita',
  padraoCor = 'ambar',
}) => {
  const theme = THEMES[padraoCor] || THEMES.ambar;

  const menuItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'DASHBOARD ADMIN',
      desc: 'Visão executiva e indicadores',
      icon: LayoutDashboard,
      roles: ['admin', 'master'],
    },
    {
      id: 'cadastros' as ActiveTab,
      label: 'CENTRAL DE CADASTROS',
      desc: 'Usuários, funcionários, clientes e cardápio',
      icon: Users,
      roles: ['admin', 'master'],
    },
    {
      id: 'cardapio-dia' as ActiveTab,
      label: 'MONTAGEM CARDÁPIO DE HOJE',
      desc: 'Defina pratos e marmitex do dia (11h-14h)',
      icon: Sparkles,
      roles: ['admin', 'master', 'atendente'],
    },
    {
      id: 'pdv' as ActiveTab,
      label: 'ATENDIMENTO / PDV',
      desc: 'Cardápio do dia, delivery e balcão',
      icon: ShoppingBag,
      roles: ['admin', 'atendente', 'garcom'],
    },
    {
      id: 'mesas' as ActiveTab,
      label: 'SALÃO & 20 MESAS',
      desc: 'Mapa de mesas, comandas e reservas',
      icon: Utensils,
      roles: ['admin', 'atendente', 'garcom'],
    },
    {
      id: 'kds' as ActiveTab,
      label: 'KDS COZINHA',
      desc: 'Cozinha em tempo real',
      icon: ChefHat,
      badge: pendingKdsCount > 0 ? pendingKdsCount : undefined,
      roles: ['admin', 'cozinha', 'atendente'],
    },
    {
      id: 'led' as ActiveTab,
      label: 'PAINEL LED SENHAS',
      desc: 'Display para TV e chamada sonora',
      icon: BellRing,
      roles: ['admin', 'atendente', 'cozinha', 'garcom'],
    },
    {
      id: 'expedicao' as ActiveTab,
      label: 'EXPEDIÇÃO DELIVERY',
      desc: 'Controle de motoboys e rotas',
      icon: Bike,
      roles: ['admin', 'atendente', 'entregador'],
    },
    {
      id: 'mensalistas' as ActiveTab,
      label: 'MENSALISTAS',
      desc: 'Contas a receber e empresas',
      icon: Briefcase,
      roles: ['admin', 'atendente'],
    },
    {
      id: 'estoque' as ActiveTab,
      label: 'ESTOQUE & INSUMOS',
      desc: 'Carnes, grãos e estoque mínimo',
      icon: Boxes,
      roles: ['admin', 'cozinha'],
    },
    {
      id: 'caixa' as ActiveTab,
      label: 'CAIXA DIÁRIO',
      desc: 'Abertura, fechamento e sangrias',
      icon: Banknote,
      roles: ['admin', 'atendente'],
    },
    {
      id: 'configuracoes' as ActiveTab,
      label: 'CONFIGURAÇÕES GERAIS',
      desc: 'Banco de dados, email, layout e cores',
      icon: Lock,
      roles: ['admin'],
    },
  ];

  const handleItemClick = (id: ActiveTab) => {
    onSelectTab(id);
    onClose();
  };

  const isLeft = posicaoMenu === 'esquerda';

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Slide drawer container positioned on Left or Right based on posicaoMenu */}
      <aside
        className={`fixed top-0 bottom-0 z-50 w-80 sm:w-96 bg-neutral-900 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out transform ${
          isLeft
            ? `left-0 border-r border-neutral-800 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `right-0 border-l border-neutral-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
        }`}
      >
        {/* Top Drawer Header */}
        <div>
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-850">
            <div>
              <span
                className="text-[10px] font-black uppercase tracking-widest block"
                style={{ color: theme.dotColor }}
              >
                RESTAURANTE KAIPIRA
              </span>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-tight">
                Menu de Navegação
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Operator Profile Card */}
          <div className="p-4 bg-neutral-950/60 border-b border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: `${theme.dotColor}20`,
                    borderColor: `${theme.dotColor}50`,
                    color: theme.dotColor,
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-white uppercase leading-tight">
                    {currentPerfil?.nome || 'ADMINISTRADOR'}
                  </div>
                  <div
                    className="text-[10px] font-bold uppercase"
                    style={{ color: theme.dotColor }}
                  >
                    CARGO: {currentRole}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Switcher dropdown */}
            <div className="mt-3 pt-2 border-t border-neutral-850 flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Alternar Perfil:</span>
              <select
                value={currentRole}
                onChange={(e) => onChangeRole(e.target.value as TipoUsuario)}
                className="bg-neutral-800 border border-neutral-700 font-bold rounded px-2 py-1 uppercase text-[10px] focus:outline-none"
                style={{ color: theme.dotColor }}
              >
                <option value="master">MASTER (LIVRE ACESSO TOTAL)</option>
                <option value="admin">ADMIN (DONA BENEDITA)</option>
                <option value="atendente">ATENDENTE (JULIANA)</option>
                <option value="cozinha">COZINHA (CHEF TIÃO)</option>
                <option value="garcom">GARÇOM (MARCELO)</option>
                <option value="entregador">ENTREGADOR (RODRIGO)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            // Master tem livre acesso irrestrito a todas as telas (bypass)
            const hasAccess = currentRole === 'master' || currentRole === 'admin' || item.roles.includes(currentRole);

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                  isActive
                    ? `${theme.primaryBg} text-white font-bold shadow-md`
                    : hasAccess
                    ? 'hover:bg-neutral-800/80 text-neutral-300 hover:text-white'
                    : 'opacity-50 hover:bg-neutral-850 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isActive ? 'bg-black/20 text-white' : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold uppercase block leading-tight">
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] block ${
                        isActive ? 'text-white/80' : 'text-neutral-500'
                      }`}
                    >
                      {item.desc}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-red-600 text-white font-black rounded-sm tabular-nums">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-600'}`} />
                </div>
              </button>
            );
          })}

          {/* Supabase SQL button */}
          <button
            onClick={() => {
              onOpenSupabaseModal();
              onClose();
            }}
            className="w-full p-2.5 rounded-xl flex items-center justify-between text-left hover:bg-neutral-800/80 text-neutral-300 transition-colors mt-2 border-t border-neutral-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neutral-800 text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase block leading-tight text-white">
                  SUPABASE SQL SCHEMA
                </span>
                <span className="text-[10px] text-neutral-500 block">
                  Script PostgreSQL e Realtime
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-600" />
          </button>
        </div>

        {/* Drawer Bottom Footer with Logout */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-850 space-y-2">
          <button
            onClick={onLogout}
            className="w-full py-2.5 px-3 bg-neutral-800 hover:bg-red-950/80 hover:text-red-400 text-neutral-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors uppercase border border-neutral-700 hover:border-red-800"
          >
            <LogOut className="w-4 h-4" />
            <span>Desconectar / Trocar Login</span>
          </button>
          <div className="text-center text-[10px] text-neutral-500 font-mono">
            SISTEMA RESTAURANTE KAIPIRA · PIRACICABA
          </div>
        </div>
      </aside>
    </>
  );
};

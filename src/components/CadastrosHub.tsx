import React, { useState } from 'react';
import {
  UsuarioSistema,
  TipoUsuario,
  Cliente,
  Produto,
  Categoria,
  Mesa,
  Perfil,
} from '../types';
import { formatPhone, forceUppercase, formatBRL } from '../utils/formatters';
import { UpperInput } from './UpperInput';
import { supabase } from '../lib/supabase';
import {
  salvarUsuarioSupabase,
  excluirUsuarioSupabase,
  garantirMasterSupabase,
} from '../services/supabaseClient';
import {
  Users,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Crown,
  Search,
  Edit2,
  Trash2,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  Utensils,
  ShoppingBag,
  Layers,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCog,
  Briefcase,
  Store,
} from 'lucide-react';

interface CadastrosHubProps {
  usuarios: UsuarioSistema[];
  onReloadUsuarios: () => Promise<void>;
  currentPerfil?: Perfil;
  clientes: Cliente[];
  produtos: Produto[];
  categorias: Categoria[];
  mesas: Mesa[];
  onOpenSupabaseModal: () => void;
  onNavigateTab: (tab: any) => void;
  onCadastrarCliente?: (c: Partial<Cliente>) => void;
  onTogglePauseProduto?: (id: number) => void;
}

export type CadastrosSubTab = 'usuarios' | 'clientes' | 'produtos' | 'cargos' | 'mesas' | 'sql';

export const CadastrosHub: React.FC<CadastrosHubProps> = ({
  usuarios,
  onReloadUsuarios,
  currentPerfil,
  clientes,
  produtos,
  categorias,
  mesas,
  onOpenSupabaseModal,
  onNavigateTab,
  onCadastrarCliente,
  onTogglePauseProduto,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CadastrosSubTab>('usuarios');

  // Search & Filter state for users
  const [userSearch, setUserSearch] = useState('');
  const [filterCargo, setFilterCargo] = useState<string>('todos');

  // User Add/Edit Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form Fields (all text converted to UPPERCASE except email)
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formCargo, setFormCargo] = useState<TipoUsuario>('atendente');
  const [formSenha, setFormSenha] = useState('1234');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Loading & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete modal
  const [userToDelete, setUserToDelete] = useState<UsuarioSistema | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Seed Master State
  const [isSeedingMaster, setIsSeedingMaster] = useState(false);

  // SQL Copy state
  const [copiedSql, setCopiedSql] = useState(false);

  // Client search in Cadastros
  const [clientSearch, setClientSearch] = useState('');

  // Product search in Cadastros
  const [prodSearch, setProdSearch] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | 'todas'>('todas');

  // Filtered users
  const filteredUsuarios = usuarios.filter((u) => {
    if (filterCargo !== 'todos' && u.cargo !== filterCargo) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      const matchNome = (u.nome || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchTel = (u.telefone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      if (!matchNome && !matchEmail && !matchTel) return false;
    }
    return true;
  });

  const openNewUserModal = () => {
    setIsEditingUser(false);
    setEditingUserId(null);
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormCargo('atendente');
    setFormSenha('1234');
    setFormStatus('ativo');
    setShowFormPassword(false);
    setFeedbackMessage(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (u: UsuarioSistema) => {
    setIsEditingUser(true);
    setEditingUserId(u.id);
    setFormNome(u.nome || '');
    setFormEmail(u.email || '');
    setFormTelefone(u.telefone || '');
    setFormCargo(u.cargo);
    setFormSenha(u.senha || 'DNDIGQOL');
    setFormStatus(u.status || 'ativo');
    setShowFormPassword(false);
    setFeedbackMessage(null);
    setShowUserModal(true);
  };

  const handlePhoneChange = (val: string) => {
    // Enforce mandatory phone mask (99) 9-9999-9999
    const formatted = formatPhone(val);
    setFormTelefone(formatted);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    // Validations
    if (!formNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME É OBRIGATÓRIO (SERÁ SALVO EM MAIÚSCULAS).' });
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFeedbackMessage({ type: 'error', text: 'INFORME UM E-MAIL VÁLIDO.' });
      return;
    }
    if (!formTelefone.trim() || formTelefone.replace(/\D/g, '').length < 10) {
      setFeedbackMessage({ type: 'error', text: 'INFORME O TELEFONE COMPLETO COM DDD.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<UsuarioSistema> = {
        id: editingUserId || undefined,
        nome: formNome.trim().toUpperCase(),
        email: formEmail.trim().toLowerCase(),
        telefone: formTelefone.trim(),
        cargo: formCargo,
        status: formStatus,
        senha: formSenha.trim() || '1234',
      };

      const result = await salvarUsuarioSupabase(payload);
      if (result.success) {
        await onReloadUsuarios();
        setShowUserModal(false);
        setFeedbackMessage({
          type: 'success',
          text: `USUÁRIO ${payload.nome} SALVO COM SUCESSO NO SUPABASE!`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: result.error || 'FALHA AO SALVAR USUÁRIO NO SUPABASE.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'ERRO INESPERADO AO CONECTAR COM A NUVEM.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await excluirUsuarioSupabase(userToDelete.id, userToDelete.email);
      if (res.success) {
        await onReloadUsuarios();
        setUserToDelete(null);
        setFeedbackMessage({
          type: 'success',
          text: `USUÁRIO ${userToDelete.nome} EXCLUÍDO DO SUPABASE!`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.error || 'NÃO FOI POSSÍVEL EXCLUIR ESTE USUÁRIO.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'ERRO AO EXCLUIR USUÁRIO.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedMasterNow = async () => {
    setIsSeedingMaster(true);
    try {
      const master = await garantirMasterSupabase();
      await onReloadUsuarios();
      setFeedbackMessage({
        type: 'success',
        text: 'USUÁRIO MASTER (master@kaipira.com / DNDIGQOL) SINCRONIZADO E GARANTIDO NO SUPABASE!',
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'ERRO AO SINCRONIZAR MASTER NO SUPABASE: ' + err.message,
      });
    } finally {
      setIsSeedingMaster(false);
    }
  };

  const sqlDDLForUsuarios = `-- =========================================================================
-- TABELA DE USUÁRIOS & PERFIS DO RESTAURANTE KAIPIRA
-- Execute no SQL Editor do Supabase (https://app.supabase.com)
-- =========================================================================

-- 1. TIPO ENUM COM O PERFIL 'master'
DO $$ BEGIN
    CREATE TYPE tipo_usuario AS ENUM ('master', 'admin', 'atendente', 'cozinha', 'garcom', 'entregador');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Se o tipo já existir no seu banco sem 'master', adicione:
ALTER TYPE tipo_usuario ADD VALUE IF NOT EXISTS 'master';

-- 2. TABELA DE USUÁRIOS / FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefone VARCHAR(25) NOT NULL,
    cargo VARCHAR(50) NOT NULL DEFAULT 'atendente',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    senha VARCHAR(100) NOT NULL DEFAULT 'DNDIGQOL',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CRIAÇÃO AUTOMÁTICA DO USUÁRIO MASTER INICIAL (SEED)
-- Credenciais Oficiais: master@kaipira.com / DNDIGQOL / Cargo: master (Livre Acesso Irrestrito)
INSERT INTO usuarios (nome, email, telefone, cargo, status, senha)
VALUES (
    'ADMINISTRADOR MASTER GERAL',
    'master@kaipira.com',
    '(19) 9-9999-9999',
    'master',
    'ativo',
    'DNDIGQOL'
)
ON CONFLICT (email) DO UPDATE 
SET cargo = 'master',
    senha = 'DNDIGQOL',
    status = 'ativo',
    atualizado_em = NOW();

-- 4. POLÍTICAS DE ACESSO (RLS DESATIVADO OU LIBERADO PARA ANON KEY DO APP)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico usuarios" ON usuarios;
CREATE POLICY "Acesso publico usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlDDLForUsuarios);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const getCargoBadge = (cargo: TipoUsuario) => {
    switch (cargo) {
      case 'master':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs">
            <Crown className="w-3 h-3 text-amber-400" />
            MASTER (IRRESTRITO)
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <ShieldCheck className="w-3 h-3 text-purple-400" />
            ADMINISTRADOR
          </span>
        );
      case 'atendente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <UserCheck className="w-3 h-3 text-blue-400" />
            ATENDENTE
          </span>
        );
      case 'cozinha':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-orange-500/20 text-orange-300 border border-orange-500/30">
            <Utensils className="w-3 h-3 text-orange-400" />
            COZINHA
          </span>
        );
      case 'garcom':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Store className="w-3 h-3 text-emerald-400" />
            GARÇOM
          </span>
        );
      case 'entregador':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <Briefcase className="w-3 h-3 text-cyan-400" />
            ENTREGADOR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-300">
            {cargo}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner: Central de Cadastros */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial from-amber-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 tracking-wider mb-1">
              <Users className="w-4 h-4 text-amber-500" />
              <span>PAINEL DE CADASTROS DO APP · RESTAURANTE KAIPIRA</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-bold ml-2">
                <Cloud className="w-3 h-3 text-emerald-400" />
                100% NUVEM SUPABASE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              Central Integrada de Cadastros
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Gerencie em um só local todos os cadastros essenciais do sistema: Usuários & Funcionários, Clientes, Produtos do Cardápio, Cargos com Regras de Acesso e Mesas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSeedMasterNow}
              disabled={isSeedingMaster}
              className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              title="Garante que o usuário MASTER esteja criado no Supabase"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              {isSeedingMaster ? 'Sincronizando Master...' : 'Setup Master na Nuvem'}
            </button>

            <button
              onClick={() => setActiveSubTab('sql')}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Script SQL Supabase</span>
            </button>
          </div>
        </div>

        {/* Global Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-neutral-800 text-xs">
          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Usuários / Equipe</span>
            <span className="text-lg font-black text-white">{usuarios.length}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {usuarios.filter((u) => u.status !== 'inativo').length} ativos
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Clientes & Mensalistas</span>
            <span className="text-lg font-black text-white">{clientes.length}</span>
            <span className="text-[10px] text-cyan-400 block mt-0.5">
              {clientes.filter((c) => c.eh_mensalista).length} mensalistas
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Cardápio / Produtos</span>
            <span className="text-lg font-black text-white">{produtos.length}</span>
            <span className="text-[10px] text-amber-400 block mt-0.5">
              {categorias.length} categorias ativas
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Salão de Mesas</span>
            <span className="text-lg font-black text-white">{mesas.length}</span>
            <span className="text-[10px] text-purple-400 block mt-0.5">Capacidade 20 mesas</span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Perfil Atual Conectado</span>
            <span className="text-sm font-black text-amber-400 uppercase truncate block">
              {currentPerfil?.cargo || 'ADMIN'}
            </span>
            <span className="text-[10px] text-neutral-400 block mt-0.5 truncate">
              {currentPerfil?.nome || 'DONA BENEDITA'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Feedback notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold uppercase transition-all shadow-lg ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-red-950/80 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-neutral-400 hover:text-white px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveSubTab('usuarios')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'usuarios'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <UserCog className="w-4 h-4" />
          <span>1. Usuários & Funcionários ({usuarios.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('clientes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'clientes'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Clientes & Mensalistas ({clientes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('produtos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'produtos'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>3. Cardápio & Pratos ({produtos.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cargos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'cargos'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>4. Cargos & Permissões</span>
        </button>

        <button
          onClick={() => setActiveSubTab('mesas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'mesas'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>5. Mesas ({mesas.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sql')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'sql'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>SQL Supabase</span>
        </button>
      </div>

      {/* =========================================================================
          ABA 1: GESTÃO COMPLETA DE USUÁRIOS E FUNCIONÁRIOS (CRUD NA NUVEM)
          ========================================================================= */}
      {activeSubTab === 'usuarios' && (
        <div className="flex flex-col gap-4">
          {/* Controls Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="BUSCAR USUÁRIO POR NOME, E-MAIL OU TELEFONE..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>

            {/* Filter by Cargo */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-neutral-400 uppercase whitespace-nowrap">
                Cargo:
              </label>
              <select
                value={filterCargo}
                onChange={(e) => setFilterCargo(e.target.value)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
              >
                <option value="todos">TODOS OS CARGOS</option>
                <option value="master">MASTER (LIVRE ACESSO)</option>
                <option value="admin">ADMINISTRADOR</option>
                <option value="atendente">ATENDENTE</option>
                <option value="cozinha">COZINHA</option>
                <option value="garcom">GARÇOM</option>
                <option value="entregador">ENTREGADOR</option>
              </select>

              <button
                onClick={onReloadUsuarios}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl border border-neutral-700 transition-colors"
                title="Recarregar usuários da Nuvem Supabase"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={openNewUserModal}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Cadastrar Usuário</span>
              </button>
            </div>
          </div>

          {/* Master Profile Callout Banner */}
          <div className="p-4 bg-amber-950/20 border border-amber-600/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mt-0.5">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-amber-300 uppercase tracking-wide block">
                  Usuário Master Inicial do Kaipira
                </span>
                <span className="text-neutral-300 mt-0.5 block">
                  Login: <strong className="text-white font-mono">master@kaipira.com</strong> · Senha:{' '}
                  <strong className="text-white font-mono">DNDIGQOL</strong> · Cargo:{' '}
                  <strong className="text-amber-400 font-bold uppercase">master</strong>
                </span>
                <span className="text-[11px] text-neutral-400 mt-0.5 block">
                  * O cargo MASTER possui bypass total: acesso irrestrito a todas as telas, configurações, caixas, cardápio e permissões.
                </span>
              </div>
            </div>

            <button
              onClick={handleSeedMasterNow}
              disabled={isSeedingMaster}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] uppercase rounded-lg shadow-sm transition-transform active:scale-95 shrink-0"
            >
              {isSeedingMaster ? 'Verificando...' : 'Garantir no Banco'}
            </button>
          </div>

          {/* Users Table / Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Funcionário / Usuário</th>
                    <th className="px-4 py-3">Cargo / Perfil</th>
                    <th className="px-4 py-3">E-mail (Único)</th>
                    <th className="px-4 py-3">Telefone Obrigatório</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredUsuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 uppercase">
                        Nenhum usuário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsuarios.map((u) => {
                      const isMasterUser = u.cargo === 'master' || u.email === 'master@kaipira.com';
                      return (
                        <tr
                          key={u.id || u.email}
                          className={`hover:bg-neutral-850/60 transition-colors ${
                            isMasterUser ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          {/* Nome */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-black uppercase text-xs shadow-xs ${
                                  isMasterUser
                                    ? 'bg-amber-600 text-white border border-amber-400'
                                    : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                                }`}
                              >
                                {isMasterUser ? <Crown className="w-4 h-4" /> : u.nome.charAt(0)}
                              </div>
                              <div>
                                <span className="font-extrabold text-neutral-100 uppercase block">
                                  {u.nome}
                                </span>
                                {isMasterUser && (
                                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                                    Acesso Total Irrestrito
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Cargo */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {getCargoBadge(u.cargo)}
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-neutral-300 font-mono text-[11px]">
                              <Mail className="w-3.5 h-3.5 text-neutral-500" />
                              <span>{u.email}</span>
                            </div>
                          </td>

                          {/* Telefone */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-neutral-300 font-mono text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-neutral-500" />
                              <span>{formatPhone(u.telefone)}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {u.status === 'inativo' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-950/60 text-red-400 border border-red-900">
                                Inativo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-900">
                                Ativo
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openEditUserModal(u)}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
                                title="Editar Usuário"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                              </button>

                              {!isMasterUser && (
                                <button
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 bg-neutral-800 hover:bg-red-900/40 text-neutral-400 hover:text-red-300 rounded-lg transition-colors"
                                  title="Excluir Usuário"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: CLIENTES & MENSALISTAS
          ========================================================================= */}
      {activeSubTab === 'clientes' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Cadastro Geral de Clientes & Mensalistas</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Base centralizada de clientes cadastrados para entregas em Piracicaba e controle de mensalistas.
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('mensalistas')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-sm"
            >
              Abrir Módulo Completo de Mensalistas
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="BUSCAR CLIENTE POR NOME OU TELEFONE..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-2.5">Nome do Cliente</th>
                  <th className="px-4 py-2.5">Telefone</th>
                  <th className="px-4 py-2.5">Bairro / Endereço</th>
                  <th className="px-4 py-2.5">Mensalista</th>
                  <th className="px-4 py-2.5 text-right">Saldo Devedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {clientes
                  .filter((c) => {
                    if (!clientSearch) return true;
                    const q = clientSearch.toLowerCase();
                    return c.nome.toLowerCase().includes(q) || c.telefone.includes(q);
                  })
                  .slice(0, 15)
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-850/50">
                      <td className="px-4 py-2.5 font-bold text-neutral-200 uppercase">{c.nome}</td>
                      <td className="px-4 py-2.5 font-mono text-neutral-300">{formatPhone(c.telefone)}</td>
                      <td className="px-4 py-2.5 text-neutral-400 uppercase">{c.bairro} - {c.endereco}, {c.numero}</td>
                      <td className="px-4 py-2.5">
                        {c.eh_mensalista ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800 font-bold uppercase">
                            Sim
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">Não</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-400">
                        {formatBRL(c.saldo_devedor || 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 3: CARDÁPIO & PRODUTOS
          ========================================================================= */}
      {activeSubTab === 'produtos' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>Cadastro de Produtos & Pratos do Cardápio</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Pratos típicos caipiras, marmitex executivas, porções da cozinha e bebidas.
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('pdv')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-sm"
            >
              Ir para Atendimento / PDV
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="BUSCAR PRATO OU PRODUTO..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <select
              value={selectedCategoriaId}
              onChange={(e) =>
                setSelectedCategoriaId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))
              }
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl text-xs uppercase"
            >
              <option value="todas">TODAS AS CATEGORIAS</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {produtos
              .filter((p) => {
                if (selectedCategoriaId !== 'todas' && p.categoria_id !== selectedCategoriaId) return false;
                if (prodSearch && !p.nome.toLowerCase().includes(prodSearch.toLowerCase())) return false;
                return true;
              })
              .map((p) => {
                const cat = categorias.find((c) => c.id === p.categoria_id);
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-colors ${
                      p.pausado
                        ? 'bg-neutral-900/60 border-neutral-800 opacity-60'
                        : 'bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase text-amber-500">
                          {cat?.nome || 'GERAL'}
                        </span>
                        {p.pausado && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-950 text-red-400 border border-red-800">
                            Pausado
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-neutral-100 uppercase">{p.nome}</h4>
                      <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{p.descricao}</p>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">SALÃO:</span>
                        <strong className="text-amber-400 font-bold">{formatBRL(p.preco_salao)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">DELIVERY:</span>
                        <strong className="text-emerald-400 font-bold">
                          {p.preco_delivery ? formatBRL(p.preco_delivery) : '-'}
                        </strong>
                      </div>
                      {onTogglePauseProduto && (
                        <button
                          onClick={() => onTogglePauseProduto(p.id)}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase border transition-colors ${
                            p.pausado
                              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {p.pausado ? 'Ativar' : 'Pausar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 4: CARGOS & MATRIZ DE PERMISSÕES
          ========================================================================= */}
      {activeSubTab === 'cargos' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Matriz de Cargos & Perfis de Acesso ao Sistema</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Definição técnica de cada cargo no Restaurante Kaipira e seus privilégios de acesso.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Cargo MASTER */}
            <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-950/20 flex flex-col justify-between gap-3 text-xs shadow-md">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500 text-neutral-950 shadow-xs">
                    <Crown className="w-3.5 h-3.5" />
                    MASTER
                  </span>
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Acesso Irrestrito</span>
                </div>
                <h4 className="font-extrabold text-white uppercase text-sm mb-1">
                  Administrador Master Geral
                </h4>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Possui <strong>bypass total e irrestrito</strong> a absolutamente todas as telas, funções, configurações de nuvem, caixas, cardápio, exclusão de registros e criação de novos usuários.
                </p>
              </div>
              <div className="p-2.5 bg-neutral-900/90 rounded-lg text-[10px] space-y-1 font-mono text-neutral-300 border border-amber-800/40">
                <div>LOGIN: <strong className="text-amber-400">master@kaipira.com</strong></div>
                <div>SENHA PADRÃO: <strong className="text-amber-400">DNDIGQOL</strong></div>
                <div>PERMISSÕES: <span className="text-emerald-400 font-bold">100% LIBERADO</span></div>
              </div>
            </div>

            {/* Cargo ADMIN */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-850 flex flex-col justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    ADMIN
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase">Gerência Geral</span>
                </div>
                <h4 className="font-bold text-white uppercase text-sm mb-1">Gerente Administrativo</h4>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Gerencia operações, visualiza o dashboard financeiro, abertura/fechamento de caixas, gestão de mesas, clientes e estoque.
                </p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg text-[10px] space-y-1 font-mono text-neutral-300 border border-neutral-800">
                <div>PERMISSÕES: <span className="text-purple-400">Gestão, Caixa, Salão, PDV</span></div>
              </div>
            </div>

            {/* Cargo ATENDENTE */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-850 flex flex-col justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <UserCheck className="w-3.5 h-3.5" />
                    ATENDENTE
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase">Balcão & Delivery</span>
                </div>
                <h4 className="font-bold text-white uppercase text-sm mb-1">Atendimento ao Cliente</h4>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Lança novos pedidos no balcão e WhatsApp, consulta cardápio do dia, cadastra novos clientes de Piracicaba e acompanha expedição.
                </p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg text-[10px] space-y-1 font-mono text-neutral-300 border border-neutral-800">
                <div>PERMISSÕES: <span className="text-blue-400">PDV, Pedidos, Clientes, Painel LED</span></div>
              </div>
            </div>

            {/* Cargo COZINHA */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-850 flex flex-col justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <Utensils className="w-3.5 h-3.5" />
                    COZINHA
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase">Cozinha</span>
                </div>
                <h4 className="font-bold text-white uppercase text-sm mb-1">Equipe da Cozinha & KDS</h4>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Visualiza comandas em tempo real na tela KDS, avança status para 'em preparo' e 'pronto', e confere estoque mínimo de insumos e carnes.
                </p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg text-[10px] space-y-1 font-mono text-neutral-300 border border-neutral-800">
                <div>PERMISSÕES: <span className="text-orange-400">KDS Cozinha, Painel LED, Estoque</span></div>
              </div>
            </div>

            {/* Cargo GARÇOM */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-850 flex flex-col justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Store className="w-3.5 h-3.5" />
                    GARÇOM
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase">Salão 20 Mesas</span>
                </div>
                <h4 className="font-bold text-white uppercase text-sm mb-1">Atendimento de Salão</h4>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Operação do mapa de 20 mesas, abertura e acréscimo de itens em comandas presenciais, e fechamento de conta.
                </p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg text-[10px] space-y-1 font-mono text-neutral-300 border border-neutral-800">
                <div>PERMISSÕES: <span className="text-emerald-400">Salão & Mesas, PDV, Painel LED</span></div>
              </div>
            </div>

            {/* Cargo ENTREGADOR */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-850 flex flex-col justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <Briefcase className="w-3.5 h-3.5" />
                    ENTREGADOR
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase">Delivery Próprio</span>
                </div>
                <h4 className="font-bold text-white uppercase text-sm mb-1">Motoboys e Entregadores</h4>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Controle de rotas de entrega por bairro em Piracicaba, despacho de pedidos e baixa em pedidos entregues ao cliente.
                </p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg text-[10px] space-y-1 font-mono text-neutral-300 border border-neutral-800">
                <div>PERMISSÕES: <span className="text-cyan-400">Expedição Delivery, Rotas de Piracicaba</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 5: SALÃO & 20 MESAS
          ========================================================================= */}
      {activeSubTab === 'mesas' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>Cadastro e Configuração das 20 Mesas do Salão</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Layout fixo do salão do Restaurante Kaipira com 20 mesas numeradas.
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('mesas')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-sm"
            >
              Abrir Mapa Completo de Mesas
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {mesas.map((m) => (
              <div
                key={m.numero}
                className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-black text-white text-sm block">Mesa {m.numero}</span>
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                    {m.status}
                  </span>
                </div>
                <div
                  className={`w-3 h-3 rounded-full ${
                    m.status === 'ocupada'
                      ? 'bg-amber-500'
                      : m.status === 'conta'
                      ? 'bg-purple-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 6: SCRIPT SQL SUPABASE
          ========================================================================= */}
      {activeSubTab === 'sql' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Script SQL de Usuários & Master para Supabase</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Copie e cole este script no SQL Editor do seu projeto Supabase para criar a tabela de usuários com enum e seed do Master.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copySqlToClipboard}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copiado!' : 'Copiar Script SQL'}</span>
              </button>

              <button
                onClick={onOpenSupabaseModal}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold uppercase transition-colors"
              >
                Ver Schema Completo do Restaurante
              </button>
            </div>
          </div>

          <pre className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 font-mono text-[11px] text-neutral-300 overflow-x-auto leading-relaxed max-h-[450px]">
            {sqlDDLForUsuarios}
          </pre>
        </div>
      )}

      {/* =========================================================================
          MODAL: CADASTRAR OU EDITAR USUÁRIO
          ========================================================================= */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveUser}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <UserCog className="w-4 h-4 text-amber-500" />
                <span>{isEditingUser ? 'Editar Usuário do Sistema' : 'Novo Cadastro de Usuário'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Notice */}
            <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 text-[11px] text-neutral-400">
              * Todos os campos de texto digitáveis (exceto o e-mail) são convertidos automaticamente para <strong>MAIÚSCULAS (UPPERCASE)</strong> e salvos diretamente no Supabase na nuvem.
            </div>

            {/* Campo 1: Nome Completo (UPPERCASE obrigatório) */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME COMPLETO: *
              </label>
              <input
                type="text"
                required
                value={formNome}
                onChange={(e) => setFormNome(e.target.value.toUpperCase())}
                placeholder="EX: DONA BENEDITA OU JOÃO CARLOS DA SILVA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500 font-medium"
              />
            </div>

            {/* Campo 2: E-mail (único, formato livre) */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                E-MAIL / LOGIN ÚNICO: *
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="EX: joao@kaipira.com OU joao.silva@gmail.com"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500 font-mono"
              />
            </div>

            {/* Campo 3: Telefone (com máscara obrigatória (99) 9-9999-9999) */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                TELEFONE / WHATSAPP: *
              </label>
              <input
                type="text"
                required
                value={formTelefone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(19) 9-9999-9999"
                maxLength={16}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500 font-mono"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Máscara obrigatória aplicada: (99) 9-9999-9999
              </span>
            </div>

            {/* Campo 4: Cargo / Perfil de Acesso */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                CARGO / PERFIL DE ACESSO: *
              </label>
              <select
                value={formCargo}
                onChange={(e) => setFormCargo(e.target.value as TipoUsuario)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
              >
                <option value="master">MASTER (LIVRE ACESSO TOTAL & IRRESTRITO)</option>
                <option value="admin">ADMIN (ADMINISTRADOR / GERENTE)</option>
                <option value="atendente">ATENDENTE (BALCÃO & DELIVERY)</option>
                <option value="cozinha">COZINHA (KDS & COZINHA)</option>
                <option value="garcom">GARÇOM (SALÃO 20 MESAS)</option>
                <option value="entregador">ENTREGADOR (DELIVERY PRÓPRIO)</option>
              </select>

              {formCargo === 'master' && (
                <div className="mt-1.5 p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-300 flex items-center gap-1.5 font-medium">
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Atenção: Usuários com cargo <strong>MASTER</strong> têm bypass irrestrito a todas as áreas, relatórios e exclusões do sistema.
                  </span>
                </div>
              )}
            </div>

            {/* Campo 5: Senha de Acesso */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-neutral-300">
                  SENHA DE ACESSO: *
                </label>
                <button
                  type="button"
                  onClick={() => setFormSenha('DNDIGQOL')}
                  className="text-amber-400 text-[10px] hover:underline font-bold"
                >
                  Usar Senha Padrão (DNDIGQOL)
                </button>
              </div>
              <div className="relative">
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  required
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                  placeholder="DIGITE A SENHA DO USUÁRIO"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                >
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Campo 6: Status */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                STATUS DA CONTA:
              </label>
              <div className="flex items-center gap-4 text-xs font-bold uppercase">
                <label className="flex items-center gap-2 cursor-pointer text-emerald-400">
                  <input
                    type="radio"
                    name="formStatus"
                    value="ativo"
                    checked={formStatus === 'ativo'}
                    onChange={() => setFormStatus('ativo')}
                    className="accent-amber-500"
                  />
                  <span>Ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-red-400">
                  <input
                    type="radio"
                    name="formStatus"
                    value="inativo"
                    checked={formStatus === 'inativo'}
                    onChange={() => setFormStatus('inativo')}
                    className="accent-amber-500"
                  />
                  <span>Inativo</span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                {isSaving ? 'Salvando na Nuvem...' : isEditingUser ? 'Atualizar no Supabase' : 'Salvar no Supabase'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE USUÁRIO
          ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">
                  Confirmar Exclusão
                </h3>
                <span className="text-xs text-neutral-400">Operação irreversível no Supabase</span>
              </div>
            </div>

            <p className="text-xs text-neutral-300">
              Deseja realmente excluir permanentemente o funcionário{' '}
              <strong className="text-white uppercase font-black">{userToDelete.nome}</strong> (
              <span className="font-mono text-neutral-400">{userToDelete.email}</span>)?
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir do Banco'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { UsuarioSistema, PerfilUsuario } from '../types';
import {
  fetchUsuariosSistema,
  salvarUsuarioSistema,
  excluirUsuarioSistema,
} from '../services/supabaseClient';
import {
  Shield,
  Key,
  UserCheck,
  UserX,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Check,
  AlertTriangle,
  Lock,
  Mail,
  User,
  RefreshCw,
  Crown,
  ChefHat,
  Monitor,
  Eye,
  EyeOff,
} from 'lucide-react';

interface UsuariosSistemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export const UsuariosSistemaModal: React.FC<UsuariosSistemaModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail = '',
}) => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  const [formNome, setFormNome] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formSenha, setFormSenha] = useState<string>('');
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>('operador');
  const [formAtivo, setFormAtivo] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Deletion Modal State
  const [userToDelete, setUserToDelete] = useState<UsuarioSistema | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const carregarUsuarios = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUsuariosSistema();
      setUsuarios(data);
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
      setFeedback({ type: 'error', message: 'Falha ao buscar usuários no Supabase.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarUsuarios();
    }
  }, [isOpen]);

  const filteredUsuarios = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.nome && u.nome.toLowerCase().includes(s)) ||
        (u.email && u.email.toLowerCase().includes(s)) ||
        (u.perfil && u.perfil.toLowerCase().includes(s))
    );
  }, [usuarios, search]);

  const stats = useMemo(() => {
    return {
      total: usuarios.length,
      ativos: usuarios.filter((u) => u.ativo).length,
      inativos: usuarios.filter((u) => !u.ativo).length,
      admins: usuarios.filter((u) => u.perfil === 'admin').length,
    };
  }, [usuarios]);

  const handleOpenNewUser = () => {
    setEditingUserId(null);
    setFormNome('');
    setFormEmail('');
    setFormSenha('');
    setFormPerfil('operador');
    setFormAtivo(true);
    setShowPassword(false);
    setFeedback(null);
    setShowFormModal(true);
  };

  const handleOpenEditUser = (user: UsuarioSistema) => {
    setEditingUserId(user.id);
    setFormNome(user.nome || '');
    setFormEmail(user.email || '');
    setFormSenha('');
    setFormPerfil(user.perfil || 'operador');
    setFormAtivo(user.ativo ?? true);
    setShowPassword(false);
    setFeedback(null);
    setShowFormModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = formNome.toUpperCase().trim();
    const emailLimpo = formEmail.toLowerCase().trim();

    if (!nomeLimpo) {
      alert('Por favor, informe o nome completo do operador.');
      return;
    }

    if (!emailLimpo || !emailLimpo.includes('@')) {
      alert('Por favor, informe um endereço de e-mail válido para login.');
      return;
    }

    // Se for novo usuário, senha é obrigatória
    if (!editingUserId && !formSenha.trim()) {
      alert('Informe a senha ou PIN de acesso inicial para o novo operador.');
      return;
    }

    // Proteção de mestre: admin@kaipira.com sempre deve ter perfil admin e estar ativo
    const isRootAccount = editingUserId && usuarios.find((u) => u.id === editingUserId)?.email.toLowerCase() === 'admin@kaipira.com';
    const perfilFinal: PerfilUsuario = isRootAccount ? 'admin' : formPerfil;
    const ativoFinal: boolean = isRootAccount ? true : formAtivo;

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: Partial<UsuarioSistema> = {
        id: editingUserId || undefined,
        nome: nomeLimpo,
        email: emailLimpo,
        perfil: perfilFinal,
        ativo: ativoFinal,
      };

      if (formSenha.trim()) {
        payload.senha_hash = formSenha.trim();
      }

      await salvarUsuarioSistema(payload);

      setFeedback({
        type: 'success',
        message: editingUserId
          ? `Usuário ${nomeLimpo} atualizado com sucesso!`
          : `Novo usuário ${nomeLimpo} cadastrado no Supabase!`,
      });

      setShowFormModal(false);
      await carregarUsuarios();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao persistir dados do usuário no Supabase.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: UsuarioSistema) => {
    if (user.email.toLowerCase() === 'admin@kaipira.com') {
      alert('A conta mestre (admin@kaipira.com) não pode ser desativada.');
      return;
    }

    try {
      await salvarUsuarioSistema({
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        ativo: !user.ativo,
      });

      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ativo: !u.ativo } : u))
      );

      setFeedback({
        type: 'success',
        message: `Status de ${user.nome} alterado para ${!user.ativo ? 'ATIVO' : 'INATIVO'}.`,
      });
    } catch (err: any) {
      console.error('Erro ao alternar status:', err);
      alert('Falha ao alternar status do usuário no Supabase.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    if (userToDelete.email.toLowerCase() === 'admin@kaipira.com') {
      alert('A conta mestre (admin@kaipira.com) é protegida e não pode ser excluída.');
      setUserToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await excluirUsuarioSistema(userToDelete.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setFeedback({
        type: 'success',
        message: `Usuário ${userToDelete.nome} removido do sistema com sucesso.`,
      });
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      alert('Erro ao excluir usuário no Supabase: ' + (err.message || 'Falha de comunicação.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const getPerfilBadge = (perfil?: PerfilUsuario) => {
    switch (perfil || 'operador') {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-red-950 text-red-300 border border-red-700/80 shadow-xs">
            <Crown className="w-3 h-3 text-red-400" />
            ADMINISTRADOR
          </span>
        );
      case 'gerente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-blue-950 text-blue-300 border border-blue-700/80 shadow-xs">
            <Shield className="w-3 h-3 text-blue-400" />
            GERENTE
          </span>
        );
      case 'operador':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-xs">
            <Monitor className="w-3 h-3 text-emerald-400" />
            OPERADOR CAIXA/PDV
          </span>
        );
      case 'kds':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-700/80 shadow-xs">
            <ChefHat className="w-3 h-3 text-purple-400" />
            KDS COZINHA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-neutral-800 text-neutral-300 border border-neutral-700">
            {perfil}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-750 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-neutral-850 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Key className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight truncate">
                  Gestão de Usuários do Sistema
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-950 text-red-300 border border-red-800 font-mono">
                  Acesso Exclusivo: admin@kaipira.com
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                Chaves de login e controle de credenciais para Caixa, Cozinha/KDS, Gerente e Administradores.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Bar */}
        {feedback && (
          <div
            className={`px-4 py-2.5 text-xs font-bold uppercase flex items-center justify-between border-b shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                : 'bg-red-950/70 border-red-800 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 hover:bg-black/20 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar & Stats Bar */}
        <div className="p-3 sm:p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-neutral-850 border border-neutral-750 flex items-center gap-2">
              <span className="text-neutral-400 uppercase text-[10px]">Total:</span>
              <strong className="text-white text-xs">{stats.total}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2">
              <span className="text-emerald-400 uppercase text-[10px]">Ativos:</span>
              <strong className="text-emerald-300 text-xs">{stats.ativos}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center gap-2">
              <span className="text-amber-400 uppercase text-[10px]">Admins:</span>
              <strong className="text-amber-300 text-xs">{stats.admins}</strong>
            </div>
          </div>

          {/* Search and Action */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="BUSCAR NOME, EMAIL OU PERFIL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 rounded-xl text-xs uppercase text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={carregarUsuarios}
              disabled={isLoading}
              className="p-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-700 transition-colors cursor-pointer"
              title="Atualizar lista do Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleOpenNewUser}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Operador</span>
            </button>
          </div>
        </div>

        {/* Content Area: Users Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading && usuarios.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 space-y-3">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs uppercase font-bold">Carregando usuários do Supabase...</p>
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 bg-neutral-850/40 rounded-2xl border border-neutral-800 p-8 space-y-2">
              <UserX className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs font-bold uppercase text-neutral-300">Nenhum operador encontrado</p>
              <p className="text-[11px] text-neutral-500">
                Ajuste os termos de busca ou clique em &quot;Novo Operador&quot; para cadastrar uma chave de login.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-850/60 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-3.5">Nome Completo</th>
                    <th className="p-3.5">E-mail (Chave de Login)</th>
                    <th className="p-3.5 text-center">Perfil de Acesso</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredUsuarios.map((user) => {
                    const isRoot = user.email.toLowerCase() === 'admin@kaipira.com';

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-neutral-800/40 transition-colors ${
                          !user.ativo ? 'opacity-65 bg-neutral-900/30' : ''
                        }`}
                      >
                        {/* Name */}
                        <td className="p-3.5 font-bold text-white uppercase">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isRoot
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                            }`}>
                              {user.nome ? user.nome.charAt(0) : 'U'}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate">{user.nome}</span>
                              {isRoot && (
                                <span className="text-[9px] text-amber-400 font-mono font-bold block uppercase">
                                  Conta Mestre / Raiz
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-3.5 font-mono text-neutral-300 text-[11px]">
                          <span className="truncate block max-w-[220px]" title={user.email}>
                            {user.email}
                          </span>
                        </td>

                        {/* Perfil */}
                        <td className="p-3.5 text-center">
                          {getPerfilBadge(user.perfil)}
                        </td>

                        {/* Status */}
                        <td className="p-3.5 text-center">
                          {user.ativo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <Check className="w-3 h-3 text-emerald-400" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-neutral-800 text-neutral-400 border border-neutral-700">
                              Inativo
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Status */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isRoot}
                              className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                isRoot
                                  ? 'opacity-30 cursor-not-allowed bg-neutral-800 border-neutral-700 text-neutral-500'
                                  : user.ativo
                                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                              }`}
                              title={
                                isRoot
                                  ? 'A conta mestre não pode ser desativada'
                                  : user.ativo
                                  ? 'Desativar acesso do operador'
                                  : 'Ativar acesso do operador'
                              }
                            >
                              {user.ativo ? (
                                <UserX className="w-3.5 h-3.5 text-neutral-400" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(user)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                              title="Editar operador e senha"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setUserToDelete(user)}
                              disabled={isRoot}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isRoot
                                  ? 'opacity-30 cursor-not-allowed bg-neutral-800 border-neutral-700 text-neutral-500'
                                  : 'bg-neutral-800 hover:bg-red-950/80 text-neutral-400 hover:text-red-300 border-neutral-700 hover:border-red-800'
                              }`}
                              title={
                                isRoot
                                  ? 'A conta mestre é protegida e não pode ser excluída'
                                  : 'Excluir operador do Supabase'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-neutral-850 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400 shrink-0">
          <span>* As senhas são criptografadas e sincronizadas de forma segura no Supabase.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl uppercase font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* SUB-MODAL: CADASTRO / EDIÇÃO DE USUÁRIO */}
      {showFormModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveUser}
            className="bg-neutral-850 border border-neutral-700 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-white uppercase">
                  {editingUserId ? 'Editar Operador do Sistema' : 'Novo Operador do Sistema'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nome Completo */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME COMPLETO DO OPERADOR: *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="EX: CARLOS ALBERTO COSTA"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs uppercase text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* E-mail / Chave de Login */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                E-MAIL (CHAVE DE LOGIN): *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  disabled={editingUserId !== null && formEmail.toLowerCase() === 'admin@kaipira.com'}
                  placeholder="ex: caixa@kaipira.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value.toLowerCase())}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Senha / PIN */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                {editingUserId ? 'NOVA SENHA / PIN (DEIXE EM BRANCO PARA MANTER):' : 'SENHA / PIN DE ACESSO: *'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingUserId}
                  placeholder={editingUserId ? '•••••••• (Inalterada)' : 'Defina a senha ou PIN'}
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Perfil de Acesso */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                PERFIL DE ACESSO AO SOFTWARE: *
              </label>
              <select
                value={formPerfil}
                disabled={editingUserId !== null && formEmail.toLowerCase() === 'admin@kaipira.com'}
                onChange={(e) => setFormPerfil(e.target.value as PerfilUsuario)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs uppercase font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
              >
                <option value="operador">Operador (Caixa, PDV e Salão)</option>
                <option value="kds">KDS (Exclusivo Display da Cozinha)</option>
                <option value="gerente">Gerente (Acesso Operacional & Caixa)</option>
                <option value="admin">Administrador (Acesso Completo)</option>
              </select>
            </div>

            {/* Ativo Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formAtivo}
                disabled={editingUserId !== null && formEmail.toLowerCase() === 'admin@kaipira.com'}
                onChange={(e) => setFormAtivo(e.target.checked)}
                className="accent-amber-500 w-4 h-4 rounded"
              />
              <span className="text-xs font-bold text-neutral-200 uppercase">
                Usuário com Acesso Ativo no Sistema
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Salvando...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      {userToDelete && (
        <div className="fixed inset-0 z-70 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-850 border border-red-800/80 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase">Excluir Operador?</h4>
                <p className="text-xs text-neutral-400">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1">
              <p>
                <strong>Nome:</strong> {userToDelete.nome}
              </p>
              <p>
                <strong>E-mail:</strong> {userToDelete.email}
              </p>
              <p>
                <strong>Perfil:</strong> {(userToDelete.perfil || 'operador').toUpperCase()}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-2 text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

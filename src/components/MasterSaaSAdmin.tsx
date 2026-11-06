import React, { useState, useEffect, useMemo } from 'react';
import {
  RestauranteTenant,
  SegmentoEmpresa,
  StatusAssinaturaSaaS,
  DEFAULT_RESTAURANTE_ID,
} from '../types';
import {
  fetchTodosRestaurantesSupabase,
  cadastrarNovoRestauranteSupabase,
  atualizarStatusRestauranteSupabase,
  getActiveRestauranteId,
} from '../services/supabaseClient';
import {
  Globe,
  Building2,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sliders,
  DollarSign,
  Calendar,
  X,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MasterSaaSAdminProps {
  currentTenantId: string;
  onSwitchTenant: (tenantId: string) => void;
  onBackToMatriz: () => void;
}

export const MasterSaaSAdmin: React.FC<MasterSaaSAdminProps> = ({
  currentTenantId,
  onSwitchTenant,
  onBackToMatriz,
}) => {
  const [restaurantes, setRestaurantes] = useState<RestauranteTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todos');

  // Modal de Novo Restaurante
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoSlug, setNovoSlug] = useState('');
  const [novoSegmento, setNovoSegmento] = useState<SegmentoEmpresa>('restaurante');
  const [novoPlano, setNovoPlano] = useState<'basico' | 'profissional' | 'enterprise'>('profissional');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novaCidade, setNovaCidade] = useState('PIRACICABA');
  const [novoUf, setNovoUf] = useState('SP');
  const [novoStatus, setNovoStatus] = useState<StatusAssinaturaSaaS>('ativo');
  const [isSaving, setIsSaving] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Carrega lista de restaurantes
  const carregarRestaurantes = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTodosRestaurantesSupabase();
      setRestaurantes(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarRestaurantes();
  }, []);

  // Auto-gera slug ao digitar nome
  const handleNomeChange = (val: string) => {
    setNovoNome(val.toUpperCase());
    const generated = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setNovoSlug(generated);
  };

  // Salvar novo restaurante
  const handleCadastrarNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setErroMsg('Nome Fantasia é obrigatório.');
      return;
    }
    setIsSaving(true);
    setErroMsg(null);

    const res = await cadastrarNovoRestauranteSupabase({
      nome_fantasia: novoNome,
      slug: novoSlug,
      segmento: novoSegmento,
      plano: novoPlano,
      telefone: novoTelefone,
      cidade: novaCidade,
      uf: novoUf,
      status_assinatura: novoStatus,
      ativo: novoStatus !== 'bloqueado',
    });

    setIsSaving(false);
    if (!res.success) {
      setErroMsg(res.error || 'Falha ao cadastrar restaurante');
      return;
    }

    setModalNovoAberto(false);
    setNovoNome('');
    setNovoSlug('');
    setNovoTelefone('');
    carregarRestaurantes();
  };

  // Atualizar status de assinatura
  const handleAlterarStatus = async (
    restauranteId: string,
    novoStatus: StatusAssinaturaSaaS
  ) => {
    const isAtivo = novoStatus !== 'bloqueado';
    const res = await atualizarStatusRestauranteSupabase(restauranteId, {
      status_assinatura: novoStatus,
      ativo: isAtivo,
    });

    if (res.success) {
      setRestaurantes((prev) =>
        prev.map((r) =>
          r.id === restauranteId
            ? { ...r, status_assinatura: novoStatus, ativo: isAtivo }
            : r
        )
      );
    } else {
      alert(`Erro ao alterar status: ${res.error}`);
    }
  };

  // Métricas
  const totalEmpresas = restaurantes.length;
  const empresasAtivas = restaurantes.filter(
    (r) => r.status_assinatura === 'ativo' && r.ativo
  ).length;
  const empresasTrial = restaurantes.filter(
    (r) => r.status_assinatura === 'trial'
  ).length;
  const empresasBloqueadas = restaurantes.filter(
    (r) => r.status_assinatura === 'bloqueado' || !r.ativo || r.status_assinatura === 'inadimplente'
  ).length;

  // Filtro
  const restaurantesFiltrados = useMemo(() => {
    return restaurantes.filter((r) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.nome_fantasia?.toLowerCase().includes(q) ||
        r.slug?.toLowerCase().includes(q) ||
        r.cidade?.toLowerCase().includes(q) ||
        r.telefone?.includes(q);

      const matchStatus =
        filtroStatus === 'todos' || r.status_assinatura === filtroStatus;

      const matchSegmento =
        filtroSegmento === 'todos' || r.segmento === filtroSegmento;

      return matchSearch && matchStatus && matchSegmento;
    });
  }, [restaurantes, search, filtroStatus, filtroSegmento]);

  const activeRestauranteObj = restaurantes.find(
    (r) => r.id === currentTenantId
  );
  const isAuditingOtherTenant = currentTenantId !== DEFAULT_RESTAURANTE_ID;

  const getSegmentoBadge = (seg: SegmentoEmpresa) => {
    switch (seg) {
      case 'pizzaria':
        return { label: 'Pizzaria', icon: '🍕', bg: 'bg-orange-950/80 text-orange-300 border-orange-800' };
      case 'lanchonete':
        return { label: 'Lanchonete', icon: '🍔', bg: 'bg-amber-950/80 text-amber-300 border-amber-800' };
      case 'marmitaria':
        return { label: 'Marmitaria', icon: '🍱', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
      default:
        return { label: 'Restaurante', icon: '🍽️', bg: 'bg-blue-950/80 text-blue-300 border-blue-800' };
    }
  };

  const getStatusBadge = (status: StatusAssinaturaSaaS, ativo: boolean) => {
    if (!ativo || status === 'bloqueado') {
      return {
        label: 'BLOQUEADO',
        color: 'bg-red-950/90 text-red-300 border-red-800',
        dot: 'bg-red-500',
      };
    }
    if (status === 'inadimplente') {
      return {
        label: 'INADIMPLENTE',
        color: 'bg-amber-950/90 text-amber-300 border-amber-800',
        dot: 'bg-amber-500',
      };
    }
    if (status === 'trial') {
      return {
        label: 'TRIAL',
        color: 'bg-cyan-950/90 text-cyan-300 border-cyan-800',
        dot: 'bg-cyan-400',
      };
    }
    return {
      label: 'ATIVO',
      color: 'bg-emerald-950/90 text-emerald-300 border-emerald-800',
      dot: 'bg-emerald-400',
    };
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* BANNER DE AUDITORIA / CONTEXT SWITCH QUANDO OPERANDO EM OUTRA EMPRESA */}
      {isAuditingOtherTenant && (
        <div className="bg-purple-950/90 border-2 border-purple-500 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900 border border-purple-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-purple-300 tracking-wider">
                  MODO DE AUDITORIA MASTER ATIVO (CONTEXT SWITCH)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-700">
                  {activeRestauranteObj?.slug || currentTenantId}
                </span>
              </div>
              <p className="text-xs text-purple-100 font-semibold mt-0.5">
                Você está operando como:{' '}
                <strong className="text-white underline">
                  {activeRestauranteObj?.nome_fantasia || 'Cliente SaaS'}
                </strong>
                . Todas as consultas, pedidos, mesas, caixa e estoque estão contextualizados para este estabelecimento.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToMatriz}
            className="px-4 py-2 bg-white hover:bg-neutral-100 text-purple-950 rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-2 shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <span>Voltar para Matriz Kaipira</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-400 tracking-wider mb-1">
            <Globe className="w-4 h-4 text-purple-400" />
            <span>PAINEL DO SUPER ADMINISTRADOR · SAAS GLOBAL MULTI-TENANT</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
            <span>Gestão Global de Empresas & Assinaturas</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono font-bold">
              ROOT MASTER
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Supervisione todos os estabelecimentos contratantes, libere novas instâncias, altere planos e alterne contextos de suporte técnico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={carregarRestaurantes}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-300 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 flex items-center gap-2 shadow-sm transition-all uppercase cursor-pointer"
            title="Recarregar lista de clientes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : 'text-neutral-400'}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalNovoAberto(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-purple-600 hover:bg-purple-500 border border-purple-400 flex items-center gap-2 shadow-lg shadow-purple-950/60 transition-transform hover:scale-105 active:scale-95 uppercase cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Estabelecimento</span>
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO OPERACIONAL SAAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Total Contratantes
            </span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">
              {String(totalEmpresas).padStart(2, '0')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800 flex items-center justify-center text-purple-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Instâncias Ativas
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
              {String(empresasAtivas).padStart(2, '0')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Período de Trial
            </span>
            <span className="text-2xl font-black text-cyan-400 font-mono mt-1 block">
              {String(empresasTrial).padStart(2, '0')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Bloqueadas / Inadimplentes
            </span>
            <span className="text-2xl font-black text-red-400 font-mono mt-1 block">
              {String(empresasBloqueadas).padStart(2, '0')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome fantasia, slug, cidade ou telefone..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Status */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400 text-[11px] uppercase">Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer uppercase"
            >
              <option value="todos" className="bg-neutral-900">Todos</option>
              <option value="ativo" className="bg-neutral-900">Ativo</option>
              <option value="trial" className="bg-neutral-900">Trial</option>
              <option value="inadimplente" className="bg-neutral-900">Inadimplente</option>
              <option value="bloqueado" className="bg-neutral-900">Bloqueado</option>
            </select>
          </div>

          {/* Filtro Segmento */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400 text-[11px] uppercase">Segmento:</span>
            <select
              value={filtroSegmento}
              onChange={(e) => setFiltroSegmento(e.target.value)}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer uppercase"
            >
              <option value="todos" className="bg-neutral-900">Todos</option>
              <option value="restaurante" className="bg-neutral-900">Restaurante</option>
              <option value="pizzaria" className="bg-neutral-900">Pizzaria</option>
              <option value="lanchonete" className="bg-neutral-900">Lanchonete</option>
              <option value="marmitaria" className="bg-neutral-900">Marmitaria</option>
            </select>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE RESTAURANTES */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-[11px] uppercase font-black tracking-wider text-neutral-400">
                <th className="py-3.5 px-4">Estabelecimento / Slug</th>
                <th className="py-3.5 px-3">Segmento</th>
                <th className="py-3.5 px-3">Plano</th>
                <th className="py-3.5 px-3">Status Assinatura</th>
                <th className="py-3.5 px-3">Cidade / UF</th>
                <th className="py-3.5 px-3">Criado em</th>
                <th className="py-3.5 px-4 text-right">Ações de Gestão & Auditoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span className="font-bold uppercase tracking-wider text-xs">
                      Carregando instâncias multi-empresas da nuvem...
                    </span>
                  </td>
                </tr>
              ) : restaurantesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <Building2 className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                    <span className="font-bold uppercase tracking-wider text-xs block">
                      Nenhum estabelecimento localizado com os filtros selecionados.
                    </span>
                  </td>
                </tr>
              ) : (
                restaurantesFiltrados.map((item) => {
                  const isCurrent = currentTenantId === item.id;
                  const segInfo = getSegmentoBadge(item.segmento);
                  const stInfo = getStatusBadge(item.status_assinatura, item.ativo);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-purple-950/30 hover:bg-purple-950/40'
                          : 'hover:bg-neutral-800/40'
                      }`}
                    >
                      {/* Nome Fantasia & Slug */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                              item.id === DEFAULT_RESTAURANTE_ID
                                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                                : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                            }`}
                          >
                            {item.nome_fantasia?.substring(0, 2).toUpperCase() || 'RT'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white uppercase truncate text-sm">
                                {item.nome_fantasia}
                              </span>
                              {item.id === DEFAULT_RESTAURANTE_ID && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                                  MATRIZ
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-900 text-purple-200 border border-purple-600">
                                  ATUAL
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-neutral-400 font-mono text-[11px]">
                              <span>slug: <strong className="text-neutral-300">{item.slug}</strong></span>
                              {item.telefone && <span>· {item.telefone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Segmento */}
                      <td className="py-4 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border ${segInfo.bg}`}
                        >
                          <span>{segInfo.icon}</span>
                          <span>{segInfo.label}</span>
                        </span>
                      </td>

                      {/* Plano */}
                      <td className="py-4 px-3">
                        <span className="font-mono uppercase font-black text-neutral-200 tracking-wider text-[11px]">
                          {item.plano || 'profissional'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${stInfo.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${stInfo.dot}`} />
                            <span>{stInfo.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Cidade / UF */}
                      <td className="py-4 px-3 text-neutral-300 font-medium uppercase text-xs">
                        {item.cidade || 'PIRACICABA'} - {item.uf || 'SP'}
                      </td>

                      {/* Data de Criação */}
                      <td className="py-4 px-3 text-neutral-400 font-mono text-[11px]">
                        {item.criado_em
                          ? new Date(item.criado_em).toLocaleDateString('pt-BR')
                          : '01/01/2024'}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Seletor Rápido de Status */}
                          <select
                            value={item.status_assinatura}
                            onChange={(e) =>
                              handleAlterarStatus(item.id, e.target.value as StatusAssinaturaSaaS)
                            }
                            className="bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg px-2 py-1 text-[11px] font-bold uppercase cursor-pointer hover:border-neutral-500"
                            title="Alterar status de assinatura"
                          >
                            <option value="ativo">Ativo</option>
                            <option value="trial">Trial</option>
                            <option value="inadimplente">Inadimplente</option>
                            <option value="bloqueado">Bloquear</option>
                          </select>

                          {/* Botão Entrar como Empresa / Context Switch */}
                          {isCurrent ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1 bg-purple-900/50 text-purple-300 border border-purple-700 rounded-lg text-xs font-black uppercase flex items-center gap-1 opacity-75 cursor-default"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Em Operação</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSwitchTenant(item.id)}
                              className="px-3 py-1 bg-neutral-800 hover:bg-purple-600 hover:text-white text-purple-300 border border-purple-800 hover:border-purple-400 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                              title={`Auditar e alternar contexto para ${item.nome_fantasia}`}
                            >
                              <span>Entrar</span>
                              <ExternalLink className="w-3 h-3" />
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

      {/* MODAL PARA CADASTRAR NOVO ESTABELECIMENTO */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-850 border border-neutral-750 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              type="button"
              onClick={() => setModalNovoAberto(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 text-purple-400">
              <Building2 className="w-5 h-5" />
              <h2 className="text-base font-black uppercase text-white tracking-wider">
                Novo Estabelecimento na Plataforma SaaS
              </h2>
            </div>

            {erroMsg && (
              <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{erroMsg}</span>
              </div>
            )}

            <form onSubmit={handleCadastrarNovo} className="space-y-4 text-xs">
              <div>
                <label className="text-neutral-300 font-bold block mb-1 uppercase">
                  Nome Fantasia do Estabelecimento: *
                </label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="EX: PIZZARIA BELLA NAPOLI"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-neutral-300 font-bold block mb-1 uppercase">
                  Slug Único da Empresa (URL e Domínio): *
                </label>
                <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-400 font-mono">
                  <span className="text-neutral-500 text-[11px]">app.kaipira.com/</span>
                  <input
                    type="text"
                    value={novoSlug}
                    onChange={(e) => setNovoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="bella-napoli"
                    className="bg-transparent text-white font-bold outline-none flex-1 ml-1"
                    required
                  />
                </div>
              </div>

              {/* Segmento */}
              <div>
                <label className="text-neutral-300 font-bold block mb-1.5 uppercase">
                  Segmento de Atuação: *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'restaurante', label: 'Restaurante', icon: '🍽️' },
                    { id: 'pizzaria', label: 'Pizzaria', icon: '🍕' },
                    { id: 'lanchonete', label: 'Lanchonete', icon: '🍔' },
                    { id: 'marmitaria', label: 'Marmitaria', icon: '🍱' },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => setNovoSegmento(seg.id as SegmentoEmpresa)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 uppercase cursor-pointer transition-all ${
                        novoSegmento === seg.id
                          ? 'bg-purple-950 border-purple-500 text-purple-200'
                          : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                      }`}
                    >
                      <span>{seg.icon}</span>
                      <span>{seg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plano & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-300 font-bold block mb-1 uppercase">
                    Plano Contratado:
                  </label>
                  <select
                    value={novoPlano}
                    onChange={(e) => setNovoPlano(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl uppercase font-bold"
                  >
                    <option value="basico">Básico</option>
                    <option value="profissional">Profissional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-300 font-bold block mb-1 uppercase">
                    Status Inicial:
                  </label>
                  <select
                    value={novoStatus}
                    onChange={(e) => setNovoStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl uppercase font-bold"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="trial">Período de Teste (Trial)</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Telefone & Localização */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-neutral-300 font-bold block mb-1 uppercase">
                    Cidade:
                  </label>
                  <input
                    type="text"
                    value={novaCidade}
                    onChange={(e) => setNovaCidade(e.target.value.toUpperCase())}
                    placeholder="PIRACICABA"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="text-neutral-300 font-bold block mb-1 uppercase">
                    UF:
                  </label>
                  <input
                    type="text"
                    value={novoUf}
                    maxLength={2}
                    onChange={(e) => setNovoUf(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl uppercase font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-bold block mb-1 uppercase">
                  Telefone / WhatsApp:
                </label>
                <input
                  type="text"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(e.target.value)}
                  placeholder="(19) 9-9999-9999"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl uppercase shadow-md flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisionando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Criar Estabelecimento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

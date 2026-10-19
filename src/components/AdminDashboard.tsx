import React, { useState } from 'react';
import {
  Pedido,
  Mesa,
  CaixaDiario,
  ItemEstoque,
  Cliente,
  FormaPagamento,
  ConfiguracoesSistema,
} from '../types';
import { formatBRL, formatTime } from '../utils/formatters';
import { UpperInput } from './UpperInput';
import { ActiveTab } from './Header';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Bike,
  Utensils,
  Store,
  ChefHat,
  Boxes,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  Banknote,
  Plus,
  Cloud,
  Sparkles,
  Sliders,
  Trash2,
  X,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  FlaskConical,
} from 'lucide-react';

interface AdminDashboardProps {
  pedidos: Pedido[];
  mesas: Mesa[];
  caixa: CaixaDiario;
  estoque: ItemEstoque[];
  clientes: Cliente[];
  configuracoes?: ConfiguracoesSistema;
  currentRole?: string;
  onNavigate: (tab: ActiveTab) => void;
  onAbrirCaixa: (valor: number, observacoes?: string) => void;
  onFecharCaixa: (valor: number, observacoes?: string) => void;
  onMovimentacao: (tipo: 'suprimento' | 'sangria', forma: FormaPagamento, valor: number, descricao: string) => void;
  onUpdateStockItem?: (id: number, data: Partial<ItemEstoque>) => void;
  onZerarFinanceiro?: () => Promise<void> | void;
  onToggleModoOperacao?: (novoModo: 'producao' | 'testes') => Promise<void> | void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  pedidos,
  mesas,
  caixa,
  estoque,
  clientes,
  configuracoes,
  currentRole = 'admin',
  onNavigate,
  onAbrirCaixa,
  onFecharCaixa,
  onMovimentacao,
  onUpdateStockItem,
  onZerarFinanceiro,
  onToggleModoOperacao,
}) => {
  const isAdminOrMaster = currentRole === 'admin' || currentRole === 'master';
  // Cash Register quick modals
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('250.00');
  const [obsAbertura, setObsAbertura] = useState('');

  const [showFecharModal, setShowFecharModal] = useState(false);
  const [valorFechamento, setValorFechamento] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');

  // Stock alert adjustment & dismiss state
  const [dismissedStockAlerts, setDismissedStockAlerts] = useState<number[]>([]);
  const [adjustingStockItem, setAdjustingStockItem] = useState<ItemEstoque | null>(null);
  const [newStockQty, setNewStockQty] = useState('');
  const [newStockMin, setNewStockMin] = useState('');

  // Financial metrics
  const activeAndCompletedOrders = pedidos.filter((p) => p.status !== 'cancelado');
  const totalFaturamento = activeAndCompletedOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const ticketMedio = activeAndCompletedOrders.length > 0
    ? totalFaturamento / activeAndCompletedOrders.length
    : 0;

  // Breakdown by channel
  const deliveryOrders = activeAndCompletedOrders.filter((p) => p.tipo === 'delivery');
  const salaoOrders = activeAndCompletedOrders.filter((p) => p.tipo === 'salão');
  const retiradaOrders = activeAndCompletedOrders.filter((p) => p.tipo === 'retirada');

  const faturamentoDelivery = deliveryOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const faturamentoSalao = salaoOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const faturamentoRetirada = retiradaOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const totalTaxasEntrega = deliveryOrders.reduce((acc, p) => acc + p.taxa_entrega, 0);

  // Tables metrics
  const ocupadas = mesas.filter((m) => m.status === 'ocupada').length;
  const conta = mesas.filter((m) => m.status === 'conta').length;
  const livres = mesas.filter((m) => m.status === 'livre').length;
  const taxaOcupacao = Math.round(((ocupadas + conta) / mesas.length) * 100);

  // Kitchen KDS metrics
  const pendentesKds = pedidos.filter((p) => p.status === 'pendente').length;
  const emPreparoKds = pedidos.filter((p) => p.status === 'em_preparacao').length;
  const prontosKds = pedidos.filter((p) => p.status === 'pronto').length;

  // Stock alerts (ignora alertas excluídos pelo usuário)
  const criticalStockItems = estoque.filter(
    (it) => it.quantidade_atual <= it.estoque_minimo && !dismissedStockAlerts.includes(it.id)
  );

  const handleOpenAdjustStock = (item: ItemEstoque) => {
    setAdjustingStockItem(item);
    setNewStockQty(String(item.quantidade_atual));
    setNewStockMin(String(item.estoque_minimo));
  };

  const handleConfirmAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingStockItem) return;
    const qty = parseFloat(newStockQty.replace(',', '.'));
    const min = parseFloat(newStockMin.replace(',', '.'));
    if (!isNaN(qty) && onUpdateStockItem) {
      onUpdateStockItem(adjustingStockItem.id, {
        quantidade_atual: qty,
        estoque_minimo: !isNaN(min) ? min : adjustingStockItem.estoque_minimo,
      });
    }
    setAdjustingStockItem(null);
  };

  const handleExcluirAlerta = (item: ItemEstoque) => {
    setDismissedStockAlerts((prev) => [...prev, item.id]);
    if (onUpdateStockItem) {
      onUpdateStockItem(item.id, { estoque_minimo: 0 });
    }
  };

  // Mensalistas
  const mensalistas = clientes.filter((c) => c.eh_mensalista || c.saldo_devedor > 0);
  const totalDevedorMensalistas = mensalistas.reduce((acc, c) => acc + (c.saldo_devedor || 0), 0);

  // Cash in drawer
  let dinheiroGaveta = caixa.valor_abertura || 0;
  (caixa.movimentacoes || []).forEach((m) => {
    if (m.forma === 'dinheiro') {
      if (m.tipo === 'entrada_pedido' || m.tipo === 'suprimento') {
        dinheiroGaveta += m.valor;
      } else if (m.tipo === 'sangria') {
        dinheiroGaveta -= m.valor;
      }
    }
  });

  const handleConfirmAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    onAbrirCaixa(Number(valorAbertura || 0), obsAbertura);
    setShowAbrirModal(false);
  };

  const handleConfirmFechar = (e: React.FormEvent) => {
    e.preventDefault();
    onFecharCaixa(Number(valorFechamento || dinheiroGaveta), obsFechamento);
    setShowFecharModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-amber-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1 text-xs font-black uppercase text-amber-500 tracking-wider">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>PAINEL DO ADMINISTRADOR · {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800 text-cyan-300 font-bold ml-2">
              <Cloud className="w-3 h-3 text-cyan-400" />
              Nuvem Ativa
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Visão Geral das Operações & Resultados
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Gestão unificada de salão (20 mesas), delivery próprio em {configuracoes?.cidade || 'Piracicaba'}, cozinha, caixa e configurações
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          {/* Rotinas Administrativas Restritas (Apenas Admin / Master) */}
          {isAdminOrMaster && (
            <>
              {/* Chave Liga/Desliga "Modo Produção / Testes" */}
              <div className="flex items-center bg-neutral-900/90 border border-neutral-700/80 p-1 rounded-xl shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    const novo = configuracoes?.modoOperacao === 'testes' ? 'producao' : 'testes';
                    if (onToggleModoOperacao) onToggleModoOperacao(novo);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    configuracoes?.modoOperacao === 'testes'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs'
                  }`}
                  title="Alternar entre Modo Produção (Oficial) e Modo Testes (Homologação)"
                >
                  {configuracoes?.modoOperacao === 'testes' ? (
                    <>
                      <FlaskConical className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span>Modo Testes</span>
                      <ToggleLeft className="w-4 h-4 ml-0.5 text-amber-400" />
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Modo Produção</span>
                      <ToggleRight className="w-4 h-4 ml-0.5 text-emerald-400" />
                    </>
                  )}
                </button>
              </div>

              {/* Botão "Zerar Financeiro do Dia" */}
              <button
                type="button"
                onClick={() => {
                  const confirmou = window.confirm(
                    '⚠️ ATENÇÃO - CONFIRMAÇÃO DE SEGURANÇA (ADMIN/MASTER):\n\nDeseja realmente ZERAR todo o financeiro e movimentações do caixa do dia atual?\n\nEsta ação resetará o saldo de abertura, lançamentos e fechamento do caixa diário tanto localmente quanto na nuvem Supabase.\n\nEsta operação é irreversível. Deseja prosseguir?'
                  );
                  if (confirmou && onZerarFinanceiro) {
                    onZerarFinanceiro();
                  }
                }}
                className="px-3.5 py-2 bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-200 hover:text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                title="Resetar financeiro, abertura e movimentações do caixa do dia (Apenas Admin/Master)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span>Zerar Financeiro do Dia</span>
              </button>
            </>
          )}

          <button
            onClick={() => onNavigate('cardapio-dia')}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-transform hover:scale-105 active:scale-95 uppercase cursor-pointer"
            title="Definir pratos e marmitex disponíveis para venda hoje"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Montar Cardápio de Hoje</span>
          </button>

          <button
            onClick={() => onNavigate('pdv')}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 uppercase"
          >
            <Zap className="w-4 h-4" />
            <span>Novo Pedido (PDV)</span>
          </button>
        </div>
      </div>

      {/* Aviso de Modo Testes Ativo */}
      {configuracoes?.modoOperacao === 'testes' && (
        <div className="bg-amber-950/60 border border-amber-600/80 p-3.5 rounded-xl flex items-center justify-between gap-3 text-amber-200 text-xs shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-black uppercase tracking-wide">Atenção: Sistema Operando em Modo Testes</span>
              <p className="text-[11px] text-amber-300/90 mt-0.5">
                Os pedidos e registros financeiros estão sendo tratados em ambiente de testes/simulação.
              </p>
            </div>
          </div>
          {isAdminOrMaster && onToggleModoOperacao && (
            <button
              type="button"
              onClick={() => onToggleModoOperacao('producao')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase transition-colors shrink-0 cursor-pointer"
            >
              Ativar Produção
            </button>
          )}
        </div>
      )}

      {/* CASH REGISTER QUICK STATUS & ACTION BAR */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
        caixa.status === 'aberto'
          ? 'bg-neutral-850 border-emerald-900/80'
          : 'bg-red-950/30 border-red-800/80'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            caixa.status === 'aberto'
              ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
              : 'bg-red-950 border-red-800 text-red-400'
          }`}>
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-white">
                Controle de Caixa Diário:
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                caixa.status === 'aberto'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-red-950 text-red-300 border border-red-800'
              }`}>
                {caixa.status === 'aberto' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {caixa.status === 'aberto'
                ? `Aberto em ${caixa.data_caixa} · Fundo inicial: ${formatBRL(caixa.valor_abertura)} · Dinheiro na gaveta: ${formatBRL(dinheiroGaveta)}`
                : 'O caixa está fechado no momento. Abra o caixa para iniciar as operações do dia.'}
            </p>
          </div>
        </div>

        {/* Quick Open/Close Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {caixa.status === 'aberto' ? (
            <button
              onClick={() => {
                setValorFechamento(dinheiroGaveta.toFixed(2));
                setShowFecharModal(true);
              }}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 uppercase transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              Fechar Caixa do Dia
            </button>
          ) : (
            <button
              onClick={() => setShowAbrirModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 uppercase transition-colors shadow-sm"
            >
              <Unlock className="w-3.5 h-3.5" />
              Abrir Caixa do Dia
            </button>
          )}

          <button
            onClick={() => onNavigate('caixa')}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-bold transition-colors"
          >
            Ver Extrato
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faturamento */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento Hoje</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums">
              {formatBRL(totalFaturamento)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>{activeAndCompletedOrders.length} pedidos hoje</span>
            <span className="text-emerald-400 font-bold">100% Nuvem</span>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums">
              {formatBRL(ticketMedio)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>Média por comanda</span>
            <span>Salão + Delivery</span>
          </div>
        </div>

        {/* Taxa de Ocupação Salão */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-bold uppercase tracking-wider">Ocupação Salão</span>
            <Utensils className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tabular-nums">
              {taxaOcupacao}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>{ocupadas + conta} de 20 mesas ativas</span>
            <span className="text-amber-400 font-bold">{livres} livres</span>
          </div>
        </div>

        {/* Dinheiro Físico no Caixa */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-bold uppercase tracking-wider">Gaveta Caixa (Físico)</span>
            <ShoppingBag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-400 font-mono tabular-nums">
              {formatBRL(dinheiroGaveta)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>Status: {caixa.status.toUpperCase()}</span>
            <button
              onClick={() => onNavigate('caixa')}
              className="text-amber-400 hover:underline font-bold"
            >
              Conferir
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Operational Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Channels & Kitchen (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Vendas por Canal */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Desempenho por Canal de Venda</span>
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                TOTAL: {formatBRL(totalFaturamento)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Delivery */}
              <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-amber-500" />
                    Delivery Próprio
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-lg font-black text-white font-mono tabular-nums">
                    {formatBRL(faturamentoDelivery)}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  {deliveryOrders.length} pedidos · Taxas: {formatBRL(totalTaxasEntrega)}
                </div>
              </div>

              {/* Salão */}
              <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-cyan-500" />
                    Salão (20 Mesas)
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-lg font-black text-white font-mono tabular-nums">
                    {formatBRL(faturamentoSalao)}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  {salaoOrders.length} comandas lançadas
                </div>
              </div>

              {/* Retirada */}
              <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-500" />
                    Retirada Balcão
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-lg font-black text-white font-mono tabular-nums">
                    {formatBRL(faturamentoRetirada)}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  {retiradaOrders.length} pedidos no balcão
                </div>
              </div>
            </div>
          </div>

          {/* KDS Cozinha Status */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Cozinha (KDS em Tempo Real)
                </h3>
              </div>
              <button
                onClick={() => onNavigate('kds')}
                className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                Abrir KDS Cozinha <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">
                  1. Fila de Espera
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">
                  {pendentesKds}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-1">Aguardando</span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-xl border border-amber-900/60">
                <span className="text-[10px] text-amber-300 uppercase font-bold block mb-1">
                  2. Cozinha
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">
                  {emPreparoKds}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-1">Em Preparo</span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-xl border border-emerald-900/60">
                <span className="text-[10px] text-emerald-300 uppercase font-bold block mb-1">
                  3. Prontos p/ Saída
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                  {prontosKds}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-1">Aguardando Saída</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Alerts, Mensalistas & Stock (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Estoque em Alerta Crítico */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Estoque de Insumos ({criticalStockItems.length} Alertas)
                </h3>
              </div>
              <button
                onClick={() => onNavigate('estoque')}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                Gerenciar
              </button>
            </div>

            {criticalStockItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Todos os insumos em nível adequado</span>
              </div>
            ) : (
              <div className="space-y-2">
                {criticalStockItems.slice(0, 6).map((it) => (
                  <div
                    key={it.id}
                    className="p-3 bg-red-950/30 border border-red-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-white uppercase block truncate">
                          {it.item_nome}
                        </span>
                        <span className="text-[11px] text-red-300 font-mono">
                          Atual: <strong>{it.quantidade_atual} {it.unidade_medida}</strong> (Mín: {it.estoque_minimo})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjustStock(it)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                        title="Ajustar quantidade em estoque deste insumo"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Ajuste de Estoque</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluirAlerta(it)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-red-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                        title="Excluir alerta de estoque deste insumo"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        <span>Excluir Alerta</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mensalistas & Contas a Receber */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Contas a Receber (Mensalistas)
                </h3>
              </div>
              <button
                onClick={() => onNavigate('mensalistas')}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                Ver Lista
              </button>
            </div>

            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 mb-3 flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-semibold">Total em Aberto:</span>
              <span className="text-base font-black text-amber-400 font-mono tabular-nums">
                {formatBRL(totalDevedorMensalistas)}
              </span>
            </div>

            <div className="space-y-1.5">
              {mensalistas
                .filter((c) => (c.saldo_devedor || 0) > 0)
                .slice(0, 3)
                .map((c) => (
                  <div
                    key={c.id}
                    className="p-2 bg-neutral-900 rounded-lg flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-neutral-200 uppercase truncate max-w-[200px]">
                      {c.nome}
                    </span>
                    <span className="font-black text-amber-400 tabular-nums">
                      {formatBRL(c.saldo_devedor)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ABRIR CAIXA MODAL */}
      {showAbrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAbrir}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-400" />
                <span>Abertura do Caixa Diário</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAbrirModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                FUNDO DE TROCO INICIAL EM DINHEIRO (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorAbertura}
                onChange={(e) => setValorAbertura(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-sm tabular-nums focus:outline-none"
              />
            </div>

            <UpperInput
              label="OBSERVAÇÕES DA ABERTURA:"
              value={obsAbertura}
              onChange={setObsAbertura}
              placeholder="EX: TROCO CONFERIDO EM MOEDAS E NOTAS MIÚDAS"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAbrirModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Confirmar Abertura
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK FECHAR CAIXA MODAL */}
      {showFecharModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmFechar}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Fechamento do Caixa Diário</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFecharModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Vendas Hoje:</span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {formatBRL(totalFaturamento)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Dinheiro Esperado na Gaveta:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {formatBRL(dinheiroGaveta)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                VALOR FÍSICO CONFERIDO NA GAVETA (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorFechamento}
                onChange={(e) => setValorFechamento(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-sm tabular-nums focus:outline-none"
              />
            </div>

            <UpperInput
              label="OBSERVAÇÕES DO FECHAMENTO:"
              value={obsFechamento}
              onChange={setObsFechamento}
              placeholder="EX: CAIXA CONFERIDO E BATIDO"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowFecharModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Confirmar Fechamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Ajuste Rápido de Estoque */}
      {adjustingStockItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmAdjustStock}
            className="bg-neutral-850 rounded-2xl border border-neutral-700 max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-white uppercase">
                  Ajuste de Estoque de Insumo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingStockItem(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
              <span className="text-xs font-bold text-white uppercase block">
                {adjustingStockItem.item_nome}
              </span>
              <span className="text-[11px] text-neutral-400 block font-mono">
                Unidade: {adjustingStockItem.unidade_medida.toUpperCase()} · Mínimo Cadastrado: {adjustingStockItem.estoque_minimo} {adjustingStockItem.unidade_medida}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  NOVA QUANTIDADE ({adjustingStockItem.unidade_medida}): *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  ESTOQUE MÍNIMO ALERTA: *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newStockMin}
                  onChange={(e) => setNewStockMin(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Quick addition buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">
                Adicionar rapidamente ao saldo:
              </span>
              <div className="flex gap-2">
                {[5, 10, 20, 50].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(newStockQty.replace(',', '.')) || adjustingStockItem.quantidade_atual;
                      setNewStockQty(String(cur + delta));
                    }}
                    className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-lg text-xs font-bold font-mono transition-colors border border-neutral-700 cursor-pointer"
                  >
                    +{delta}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setAdjustingStockItem(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Salvar Ajuste
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

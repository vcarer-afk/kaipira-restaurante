import React, { useState, useMemo } from 'react';
import {
  Pedido,
  Mesa,
  CaixaDiario,
  ItemEstoque,
  Cliente,
  FormaPagamento,
  ConfiguracoesSistema,
  CardapioDiarioConfig,
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
  PieChart,
  ChevronRight,
  Power,
  Ban,
  Radio,
} from 'lucide-react';

function describeArc(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const span = Math.max(0, endAngle - startAngle);
  const effectiveEnd = span >= 359.99 ? startAngle + 359.99 : endAngle;

  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((effectiveEnd - 90) * Math.PI) / 180;

  const x1 = x + outerRadius * Math.cos(startRad);
  const y1 = y + outerRadius * Math.sin(startRad);
  const x2 = x + outerRadius * Math.cos(endRad);
  const y2 = y + outerRadius * Math.sin(endRad);

  const x3 = x + innerRadius * Math.cos(endRad);
  const y3 = y + innerRadius * Math.sin(endRad);
  const x4 = x + innerRadius * Math.cos(startRad);
  const y4 = y + innerRadius * Math.sin(startRad);

  const largeArcFlag = span > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

interface AdminDashboardProps {
  pedidos: Pedido[];
  mesas: Mesa[];
  caixa: CaixaDiario;
  estoque: ItemEstoque[];
  clientes: Cliente[];
  configuracoes?: ConfiguracoesSistema;
  cardapioDiario?: CardapioDiarioConfig;
  currentRole?: string;
  onNavigate: (tab: ActiveTab) => void;
  onAbrirCaixa: (valor: number, observacoes?: string) => void;
  onFecharCaixa: (valor: number, observacoes?: string) => void;
  onMovimentacao: (tipo: 'suprimento' | 'sangria', forma: FormaPagamento, valor: number, descricao: string) => void;
  onUpdateStockItem?: (id: number, data: Partial<ItemEstoque>) => void;
  onZerarFinanceiro?: () => Promise<void> | void;
  onToggleModoOperacao?: (novoModo: 'producao' | 'testes') => Promise<void> | void;
  onConfirmarPagamento?: (pedidoId: number, forma?: FormaPagamento, conferidoPor?: string) => Promise<void> | void;
  onToggleKillSwitch?: (chave: 'delivery_site_ativo' | 'delivery_interno_ativo') => Promise<void> | void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  pedidos,
  mesas,
  caixa,
  estoque,
  clientes,
  configuracoes,
  cardapioDiario,
  currentRole = 'admin',
  onNavigate,
  onAbrirCaixa,
  onFecharCaixa,
  onMovimentacao,
  onUpdateStockItem,
  onZerarFinanceiro,
  onToggleModoOperacao,
  onConfirmarPagamento,
  onToggleKillSwitch,
}) => {
  const isAdminOrMaster = currentRole === 'admin' || currentRole === 'master' || currentRole === 'supervisor';
  // Cash Register quick modals
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('0.00');
  const [obsAbertura, setObsAbertura] = useState('');

  const [showFecharModal, setShowFecharModal] = useState(false);
  const [valorFechamento, setValorFechamento] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');

  // Stock alert adjustment & dismiss state
  const [dismissedStockAlerts, setDismissedStockAlerts] = useState<number[]>([]);
  const [adjustingStockItem, setAdjustingStockItem] = useState<ItemEstoque | null>(null);
  const [newStockQty, setNewStockQty] = useState('');
  const [newStockMin, setNewStockMin] = useState('');

  // Regra Unificada de Faturamento: Delivery com Conferência vs Balcão/Mesas Imediatos
  const isPedidoFaturado = (p: Pedido): boolean => {
    if (p.status === 'cancelado') return false;
    if (p.tipo === 'delivery') {
      return p.conferencia_entrega === 'conferido';
    }
    // Balcão e Mesas: faturado se houver pagamentos registrados ou status entregue
    return (p.pagamentos && p.pagamentos.some((pg) => pg.valor > 0)) || p.pagamento_confirmado === true;
  };

  const activeAndCompletedOrders = pedidos.filter((p) => p.status !== 'cancelado');
  const pedidosConfirmados = activeAndCompletedOrders.filter(isPedidoFaturado);
  const pedidosAFaturar = activeAndCompletedOrders.filter((p) => !isPedidoFaturado(p));

  const totalFaturamento = pedidosConfirmados.reduce((acc, p) => acc + p.valor_total, 0);
  const totalAFaturar = pedidosAFaturar.reduce((acc, p) => acc + p.valor_total, 0);

  const ticketMedio = pedidosConfirmados.length > 0
    ? totalFaturamento / pedidosConfirmados.length
    : 0;

  // Breakdown by channel - somente faturados/confirmados
  const deliveryOrders = pedidosConfirmados.filter((p) => p.tipo === 'delivery');
  const salaoOrders = pedidosConfirmados.filter((p) => p.tipo === 'salão');
  const retiradaOrders = pedidosConfirmados.filter((p) => p.tipo === 'retirada');

  const faturamentoDelivery = deliveryOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const faturamentoSalao = salaoOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const faturamentoRetirada = retiradaOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const totalTaxasEntrega = deliveryOrders.reduce((acc, p) => acc + p.taxa_entrega, 0);

  // Pedidos a faturar por canal
  const deliveryAFaturar = pedidosAFaturar.filter((p) => p.tipo === 'delivery');
  const salaoAFaturar = pedidosAFaturar.filter((p) => p.tipo === 'salão');
  const retiradaAFaturar = pedidosAFaturar.filter((p) => p.tipo === 'retirada');

  // Payment totals for 3D Pie Chart (real positive values only from confirmed orders)
  const paymentSlices = useMemo(() => {
    const CANONICAL_CONFIG: Record<
      string,
      { label: string; color: string; darkColor: string }
    > = {
      pix: { label: 'PIX', color: '#06b6d4', darkColor: '#0e7490' },
      dinheiro: { label: 'DINHEIRO (ESPÉCIE)', color: '#10b981', darkColor: '#047857' },
      cartao_credito: { label: 'CARTÃO DE CRÉDITO', color: '#f59e0b', darkColor: '#b45309' },
      cartao_debito: { label: 'CARTÃO DE DÉBITO', color: '#3b82f6', darkColor: '#1d4ed8' },
      vale_refeicao: { label: 'VALE REFEIÇÃO / VR', color: '#8b5cf6', darkColor: '#6d28d9' },
      mensalista: { label: 'CONTA MENSALISTA', color: '#ec4899', darkColor: '#be185d' },
      multiplo: { label: 'MÚLTIPLOS', color: '#a855f7', darkColor: '#7e22ce' },
      outro: { label: 'OUTROS', color: '#64748b', darkColor: '#334155' },
    };

    const totals: Record<string, number> = {};

    pedidosConfirmados.forEach((p) => {
      if (p.pagamentos && p.pagamentos.length > 0) {
        p.pagamentos.forEach((pg) => {
          if (pg.valor && pg.valor > 0) {
            const raw = (pg.forma || 'outro').toLowerCase();
            let key = 'outro';
            if (raw.includes('pix')) key = 'pix';
            else if (raw.includes('dinheiro')) key = 'dinheiro';
            else if (raw.includes('credito') || raw.includes('crédito')) key = 'cartao_credito';
            else if (raw.includes('debito') || raw.includes('débito')) key = 'cartao_debito';
            else if (raw.includes('vale') || raw.includes('refeicao') || raw.includes('refeição') || raw.includes('vr')) key = 'vale_refeicao';
            else if (raw.includes('mensal')) key = 'mensalista';
            else key = raw;

            totals[key] = (totals[key] || 0) + pg.valor;
          }
        });
      }
    });

    const totalGeral = Object.values(totals).reduce((sum, v) => sum + v, 0);

    return Object.entries(totals)
      .filter(([_, val]) => val > 0)
      .map(([key, val]) => {
        const cfg = CANONICAL_CONFIG[key] || {
          label: key.toUpperCase(),
          color: '#64748b',
          darkColor: '#334155',
        };
        return {
          id: key,
          label: cfg.label,
          valor: val,
          percent: totalGeral > 0 ? (val / totalGeral) * 100 : 0,
          color: cfg.color,
          darkColor: cfg.darkColor,
        };
      })
      .sort((a, b) => b.valor - a.valor);
  }, [pedidosConfirmados]);

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

  // Cash in drawer (fundo + suprimentos - sangrias + dinheiro em espécie dos pedidos faturados)
  let dinheiroGaveta = caixa.valor_abertura || 0;
  (caixa.movimentacoes || []).forEach((m) => {
    if (m.tipo === 'suprimento') dinheiroGaveta += m.valor;
    if (m.tipo === 'sangria') dinheiroGaveta -= m.valor;
  });

  pedidosConfirmados.forEach((p) => {
    if (p.pagamentos) {
      p.pagamentos.forEach((pg) => {
        const raw = (pg.forma || '').toLowerCase();
        if (raw.includes('dinheiro')) {
          dinheiroGaveta += pg.valor;
        }
      });
    }
  });

  // Semáforo da Operação (Status em Tempo Real)
  const isCaixaAberto = (caixa?.status || '').toLowerCase() === 'aberto';
  const cardapioEfetivo =
    configuracoes?.cardapio_diario_cache?.status === 'publicado'
      ? configuracoes.cardapio_diario_cache
      : cardapioDiario;
  const isCardapioAtivo = ['publicado', 'aberto', 'confirmado'].includes(
    (cardapioEfetivo?.status || '').toLowerCase()
  );
  const isVitrineAberta = isCaixaAberto && isCardapioAtivo && configuracoes?.delivery_site_ativo !== false;
  const isPdvLiberado = isCaixaAberto && isCardapioAtivo;

  const handleConfirmAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    onAbrirCaixa(Number(valorAbertura || 0), obsAbertura);
    setShowAbrirModal(false);
  };

  const handleConfirmFechar = (e: React.FormEvent) => {
    e.preventDefault();

    const mesasAbertas = mesas.filter((m) => m.status === 'ocupada' || m.status === 'conta');
    const entregasPendentes = pedidos.filter(
      (p) => p.tipo === 'delivery' && p.status !== 'cancelado' && p.conferencia_entrega !== 'conferido'
    );

    if (mesasAbertas.length > 0 || entregasPendentes.length > 0) {
      alert(
        "IMPOSSÍVEL FECHAR O CAIXA:\n\nExistem " +
          mesasAbertas.length +
          " mesa(s) em aberto e " +
          entregasPendentes.length +
          " entrega(s) pendente(s) de conferência."
      );
      return;
    }

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

      {/* Semáforo da Operação (Status em Tempo Real) */}
      <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-amber-400 shrink-0">
            <Radio className="w-5 h-5 animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Semáforo da Operação (Status em Tempo Real)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 uppercase">
                Monitor Operacional
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Diagnóstico contínuo do Caixa, Cardápio Diário, Vitrine do Cliente e Atendimento no PDV.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
          {/* Caixa */}
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs font-mono font-bold uppercase transition-all ${
            isCaixaAberto
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              : 'bg-red-950/80 text-red-300 border-red-800/80'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCaixaAberto ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <div className="leading-tight">
              <span className="text-[9px] text-neutral-400 block uppercase font-sans font-semibold">Caixa</span>
              <span>{isCaixaAberto ? 'ABERTO' : 'FECHADO'}</span>
            </div>
          </div>

          {/* Cardápio */}
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs font-mono font-bold uppercase transition-all ${
            isCardapioAtivo
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCardapioAtivo ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <div className="leading-tight">
              <span className="text-[9px] text-neutral-400 block uppercase font-sans font-semibold">Cardápio</span>
              <span>{isCardapioAtivo ? 'CONFIRMADO' : 'AGUARDANDO'}</span>
            </div>
          </div>

          {/* Vitrine Site */}
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs font-mono font-bold uppercase transition-all ${
            isVitrineAberta
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              : 'bg-red-950/80 text-red-300 border-red-800/80'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isVitrineAberta ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <div className="leading-tight">
              <span className="text-[9px] text-neutral-400 block uppercase font-sans font-semibold">Vitrine Site</span>
              <span>{isVitrineAberta ? 'ABERTA' : 'FECHADA'}</span>
            </div>
          </div>

          {/* PDV / Restaurante */}
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs font-mono font-bold uppercase transition-all ${
            isPdvLiberado
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              : 'bg-red-950/80 text-red-300 border-red-800/80'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPdvLiberado ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <div className="leading-tight">
              <span className="text-[9px] text-neutral-400 block uppercase font-sans font-semibold">PDV / Mesas</span>
              <span>{isPdvLiberado ? 'LIBERADO' : 'BLOQUEADO'}</span>
            </div>
          </div>
        </div>
      </div>

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
                const mesasAbertas = mesas.filter((m) => m.status === 'ocupada' || m.status === 'conta');
                const entregasPendentes = pedidos.filter(
                  (p) => p.tipo === 'delivery' && p.status !== 'cancelado' && p.conferencia_entrega !== 'conferido'
                );

                if (mesasAbertas.length > 0 || entregasPendentes.length > 0) {
                  alert(
                    "IMPOSSÍVEL FECHAR O CAIXA:\n\nExistem " +
                      mesasAbertas.length +
                      " mesa(s) em aberto e " +
                      entregasPendentes.length +
                      " entrega(s) pendente(s) de conferência."
                  );
                  return;
                }

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

      {/* Kill Switches de Emergência (Delivery Site e Delivery Interno) */}
      <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-amber-400 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Controle de Emergência de Entregas (Kill Switches)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-amber-300 border border-neutral-700 uppercase">
                Operação Delivery
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Encerre ou reative instantaneamente as entregas caso a cozinha atinja capacidade máxima.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Kill Switch 1: Delivery do Site */}
          <button
            type="button"
            onClick={() => onToggleKillSwitch && onToggleKillSwitch('delivery_site_ativo')}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 uppercase transition-all shadow-sm cursor-pointer border ${
              configuracoes?.delivery_site_ativo !== false
                ? 'bg-emerald-950/80 hover:bg-red-950 text-emerald-300 hover:text-red-300 border-emerald-800 hover:border-red-800'
                : 'bg-red-900 hover:bg-emerald-900 text-white border-red-700'
            }`}
            title="Encerrar ou reativar pedidos de delivery pelo site"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                configuracoes?.delivery_site_ativo !== false ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span>
              {configuracoes?.delivery_site_ativo !== false
                ? 'Encerrar Entregas (Site)'
                : 'Reativar Entregas (Site)'}
            </span>
          </button>

          {/* Kill Switch 2: Delivery Interno / PDV */}
          <button
            type="button"
            onClick={() => onToggleKillSwitch && onToggleKillSwitch('delivery_interno_ativo')}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 uppercase transition-all shadow-sm cursor-pointer border ${
              configuracoes?.delivery_interno_ativo !== false
                ? 'bg-emerald-950/80 hover:bg-red-950 text-emerald-300 hover:text-red-300 border-emerald-800 hover:border-red-800'
                : 'bg-red-900 hover:bg-emerald-900 text-white border-red-700'
            }`}
            title="Encerrar ou reativar pedidos de delivery no PDV interno"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                configuracoes?.delivery_interno_ativo !== false ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span>
              {configuracoes?.delivery_interno_ativo !== false
                ? 'Encerrar Entregas (Restaurante/PDV)'
                : 'Reativar Entregas (PDV)'}
            </span>
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
            <span>{pedidosConfirmados.length} pedidos confirmados</span>
            <span className="text-emerald-400 font-bold">Auditado</span>
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
            <span>Confirmadas</span>
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
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Conferir
            </button>
          </div>
        </div>
      </div>

      {/* Alerta / Resumo de Pedidos A Faturar / A Receber (Comandas abertas, entregas não auditadas) */}
      {totalAFaturar > 0 && (
        <div className="p-4 bg-amber-950/30 border border-amber-800/70 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  A Faturar / A Receber: {formatBRL(totalAFaturar)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-black">
                  {pedidosAFaturar.length} pendente{pedidosAFaturar.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {salaoAFaturar.length > 0 && `${salaoAFaturar.length} comanda(s) aberta(s) no salão`}
                {salaoAFaturar.length > 0 && (deliveryAFaturar.length > 0 || retiradaAFaturar.length > 0) && ' · '}
                {deliveryAFaturar.length > 0 && `${deliveryAFaturar.length} entrega(s) aguardando conferência`}
                {deliveryAFaturar.length > 0 && retiradaAFaturar.length > 0 && ' · '}
                {retiradaAFaturar.length > 0 && `${retiradaAFaturar.length} pedido(s) balcão`}
                {' — não somam no faturamento até confirmação no caixa.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('caixa')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <span>Conferir no Caixa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Operational Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Channels & Kitchen (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Vendas por Canal */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Desempenho por Canal de Venda (Confirmados)</span>
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                FATURADO: <strong className="text-amber-400">{formatBRL(totalFaturamento)}</strong>
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
                  {deliveryOrders.length} confirmados · Taxas: {formatBRL(totalTaxasEntrega)}
                  {deliveryAFaturar.length > 0 && (
                    <span className="block text-amber-400/90 font-bold mt-0.5">
                      +{deliveryAFaturar.length} a conferir
                    </span>
                  )}
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
                  {salaoOrders.length} contas pagas
                  {salaoAFaturar.length > 0 && (
                    <span className="block text-amber-400/90 font-bold mt-0.5">
                      +{salaoAFaturar.length} comandas abertas
                    </span>
                  )}
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
                  {retiradaOrders.length} confirmados no balcão
                  {retiradaAFaturar.length > 0 && (
                    <span className="block text-amber-400/90 font-bold mt-0.5">
                      +{retiradaAFaturar.length} a conferir
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico 3D de Pizza / Donut das Formas de Pagamento */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <span>Distribuição por Forma de Pagamento (Faturamento Real)</span>
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                {paymentSlices.length} {paymentSlices.length === 1 ? 'forma ativa' : 'formas ativas'}
              </span>
            </div>

            {paymentSlices.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-neutral-700 flex items-center justify-center bg-neutral-900/50">
                  <PieChart className="w-10 h-10 text-neutral-600" />
                </div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  Aguardando primeiras vendas do dia
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* 3D SVG Donut */}
                <div className="md:col-span-6 flex justify-center py-2">
                  <div
                    className="relative"
                    style={{
                      perspective: '700px',
                    }}
                  >
                    <div
                      style={{
                        transform: 'rotateX(26deg)',
                        transformStyle: 'preserve-3d',
                        filter: 'drop-shadow(0 16px 14px rgba(0,0,0,0.75))',
                      }}
                    >
                      <svg width="240" height="230" viewBox="0 0 240 230" className="overflow-visible select-none">
                        {/* Camada Inferior Extrudada (Efeito de profundidade 3D / chanfro cilíndrico) */}
                        <g transform="translate(0, 10)">
                          {(() => {
                            let accumulatedAngle = 0;
                            return paymentSlices.map((slice) => {
                              const sliceAngle = (slice.percent / 100) * 360;
                              const start = accumulatedAngle;
                              const end = accumulatedAngle + sliceAngle;
                              accumulatedAngle = end;
                              return (
                                <path
                                  key={`3d-depth-${slice.id}`}
                                  d={describeArc(120, 105, 46, 88, start, end)}
                                  fill={slice.darkColor}
                                />
                              );
                            });
                          })()}
                        </g>

                        {/* Camada Superior (Superfície do Gráfico 3D) */}
                        <g>
                          {(() => {
                            let accumulatedAngle = 0;
                            return paymentSlices.map((slice) => {
                              const sliceAngle = (slice.percent / 100) * 360;
                              const start = accumulatedAngle;
                              const end = accumulatedAngle + sliceAngle;
                              accumulatedAngle = end;
                              return (
                                <path
                                  key={`3d-top-${slice.id}`}
                                  d={describeArc(120, 105, 46, 88, start, end)}
                                  fill={slice.color}
                                  stroke="#171717"
                                  strokeWidth="1.5"
                                  className="transition-transform duration-200 hover:opacity-95"
                                />
                              );
                            });
                          })()}
                        </g>

                        {/* Centro Oco do Donut com Total */}
                        <circle cx="120" cy="105" r="44" fill="#141416" stroke="#262626" strokeWidth="2" />
                        <text
                          x="120"
                          y="100"
                          textAnchor="middle"
                          fill="#a3a3a3"
                          fontSize="9"
                          fontWeight="800"
                          letterSpacing="0.05em"
                        >
                          RECEBIDO
                        </text>
                        <text
                          x="120"
                          y="116"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {formatBRL(paymentSlices.reduce((sum, s) => sum + s.valor, 0))}
                        </text>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Legenda Lateral */}
                <div className="md:col-span-6 space-y-2">
                  {paymentSlices.map((slice) => (
                    <div
                      key={`legend-${slice.id}`}
                      className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="font-bold text-neutral-200 uppercase truncate">
                          {slice.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span className="text-neutral-400 font-bold">
                          {slice.percent.toFixed(1)}%
                        </span>
                        <span className="font-black text-white tabular-nums">
                          {formatBRL(slice.valor)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

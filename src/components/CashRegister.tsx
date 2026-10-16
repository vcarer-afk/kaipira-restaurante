import React, { useState, useMemo } from 'react';
import {
  CaixaDiario,
  FormaPagamento,
  FormaPagamentoConfig,
  Pedido,
  ConfiguracoesSistema,
} from '../types';
import { INITIAL_FORMAS_PAGAMENTO } from '../data/seedData';
import { formatBRL, formatDateTime, playAlertChime } from '../utils/formatters';
import { UpperInput } from './UpperInput';
import {
  Banknote,
  DollarSign,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  Receipt,
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Calendar,
  Clock,
  CreditCard,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Layers,
  Utensils,
  Bike,
  Store,
  X,
  FileText,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface CashRegisterProps {
  caixa: CaixaDiario;
  formasPagamento?: FormaPagamentoConfig[];
  pedidos?: Pedido[];
  configuracoes?: ConfiguracoesSistema;
  onAbrirCaixa: (valor: number, observacoes?: string) => void;
  onFecharCaixa: (valor: number, observacoes?: string) => void;
  onMovimentacao: (
    tipo: 'entrada_pedido' | 'suprimento' | 'sangria',
    forma: FormaPagamento,
    valor: number,
    descricao: string
  ) => void;
}

export const CashRegister: React.FC<CashRegisterProps> = ({
  caixa,
  formasPagamento = INITIAL_FORMAS_PAGAMENTO,
  pedidos = [],
  configuracoes,
  onAbrirCaixa,
  onFecharCaixa,
  onMovimentacao,
}) => {
  // Modal states
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('250.00');
  const [obsAbertura, setObsAbertura] = useState('');

  const [showFecharModal, setShowFecharModal] = useState(false);
  const [valorFechamento, setValorFechamento] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');

  const [showMovModal, setShowMovModal] = useState(false);
  const [tipoMov, setTipoMov] = useState<'suprimento' | 'sangria'>('sangria');
  const [formaMov, setFormaMov] = useState<string>('dinheiro');
  const [valorMov, setValorMov] = useState('');
  const [descMov, setDescMov] = useState('');

  // End of day report modal
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [reportPrintMode, setReportPrintMode] = useState<'cupom' | 'a4'>('cupom');

  // Filter & Search in movements ledger
  const [searchMov, setSearchMov] = useState('');
  const [filterTipoMov, setFilterTipoMov] = useState<'todos' | 'entrada_pedido' | 'sangria' | 'suprimento'>('todos');

  // Computations
  const movs = useMemo(() => caixa.movimentacoes || [], [caixa.movimentacoes]);

  // Dynamic dictionary of payment methods (registered + any other found in movements)
  const paymentStats = useMemo(() => {
    const statsMap: Record<
      string,
      {
        id: string;
        nome: string;
        tipo: string;
        total: number;
        qtd: number;
        taxa_operadora: number;
      }
    > = {};

    // 1. Initialize with all registered active formas
    formasPagamento.forEach((fp) => {
      statsMap[fp.id.toLowerCase()] = {
        id: fp.id,
        nome: fp.nome,
        tipo: fp.tipo,
        total: 0,
        qtd: 0,
        taxa_operadora: fp.taxa_operadora || 0,
      };
    });

    // 2. Aggregate movements with tipo === 'entrada_pedido'
    let totalEntradasGerais = 0;
    let totalDinheiroEntradas = 0;
    let totalSangrias = 0;
    let totalSuprimentos = 0;
    let sangriasDinheiro = 0;
    let suprimentosDinheiro = 0;

    movs.forEach((m) => {
      const rawForma = String(m.forma || 'outro').toLowerCase().trim();
      const formaKey =
        rawForma === 'pix' || rawForma.includes('pix')
          ? 'pix'
          : rawForma === 'dinheiro' || rawForma.includes('dinheiro') || rawForma.includes('espécie') || rawForma.includes('especie')
          ? 'dinheiro'
          : rawForma === 'cartao_debito' || rawForma.includes('debito') || rawForma.includes('débito')
          ? 'cartao_debito'
          : rawForma === 'cartao_credito' || rawForma.includes('credito') || rawForma.includes('crédito')
          ? 'cartao_credito'
          : rawForma === 'vale_refeicao' || rawForma.includes('vale') || rawForma.includes('vr')
          ? 'vale_refeicao'
          : rawForma === 'mensalista' || rawForma.includes('mensalista')
          ? 'mensalista'
          : rawForma;

      if (m.tipo === 'entrada_pedido') {
        totalEntradasGerais += m.valor;

        if (!statsMap[formaKey]) {
          const guessedNome =
            formaKey === 'dinheiro'
              ? 'DINHEIRO (ESPÉCIE)'
              : formaKey === 'pix'
              ? 'PIX (CHAVE / QR CODE)'
              : formaKey === 'cartao_debito'
              ? 'CARTÃO DE DÉBITO'
              : formaKey === 'cartao_credito'
              ? 'CARTÃO DE CRÉDITO'
              : formaKey === 'vale_refeicao'
              ? 'VALE REFEIÇÃO / VR'
              : formaKey === 'mensalista'
              ? 'MENSALISTA (FATURADO)'
              : formaKey.toUpperCase();

          statsMap[formaKey] = {
            id: formaKey,
            nome: guessedNome,
            tipo: 'outro',
            total: 0,
            qtd: 0,
            taxa_operadora: 0,
          };
        }

        statsMap[formaKey].total += m.valor;
        statsMap[formaKey].qtd += 1;

        if (formaKey === 'dinheiro') {
          totalDinheiroEntradas += m.valor;
        }
      } else if (m.tipo === 'sangria') {
        totalSangrias += m.valor;
        if (formaKey === 'dinheiro' || !m.forma) {
          sangriasDinheiro += m.valor;
        }
      } else if (m.tipo === 'suprimento') {
        totalSuprimentos += m.valor;
        if (formaKey === 'dinheiro' || !m.forma) {
          suprimentosDinheiro += m.valor;
        }
      }
    });

    // Calculate Physical drawer money
    const fundoAbertura = caixa.valor_abertura || 0;
    const dinheiroGavetaEsperado =
      fundoAbertura + totalDinheiroEntradas + suprimentosDinheiro - sangriasDinheiro;

    // Convert statsMap to sorted list
    const statsList = Object.values(statsMap)
      .map((item) => ({
        ...item,
        percentual:
          totalEntradasGerais > 0 ? (item.total / totalEntradasGerais) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      statsList,
      totalEntradasGerais,
      totalDinheiroEntradas,
      totalSangrias,
      totalSuprimentos,
      sangriasDinheiro,
      suprimentosDinheiro,
      fundoAbertura,
      dinheiroGavetaEsperado,
    };
  }, [formasPagamento, movs, caixa.valor_abertura]);

  // Breakdown by channel from orders
  const channelStats = useMemo(() => {
    let salaoTotal = 0;
    let salaoQtd = 0;
    let deliveryTotal = 0;
    let deliveryQtd = 0;
    let balcaoTotal = 0;
    let balcaoQtd = 0;

    pedidos.forEach((p) => {
      if (p.status === 'cancelado') return;
      if (p.tipo === 'salão') {
        salaoTotal += p.valor_total;
        salaoQtd += 1;
      } else if (p.tipo === 'delivery') {
        deliveryTotal += p.valor_total;
        deliveryQtd += 1;
      } else if (p.tipo === 'retirada') {
        balcaoTotal += p.valor_total;
        balcaoQtd += 1;
      }
    });

    const totalPedidos = salaoQtd + deliveryQtd + balcaoQtd;
    const ticketMedio =
      totalPedidos > 0 ? paymentStats.totalEntradasGerais / totalPedidos : 0;

    return {
      salaoTotal,
      salaoQtd,
      deliveryTotal,
      deliveryQtd,
      balcaoTotal,
      balcaoQtd,
      totalPedidos,
      ticketMedio,
    };
  }, [pedidos, paymentStats.totalEntradasGerais]);

  // Physical money in drawer
  const dinheiroNaGaveta = paymentStats.dinheiroGavetaEsperado;

  // Filtered movements for ledger
  const filteredMovs = useMemo(() => {
    return movs.filter((m) => {
      if (filterTipoMov !== 'todos' && m.tipo !== filterTipoMov) return false;
      if (searchMov) {
        const query = searchMov.toLowerCase();
        const descMatch = (m.descricao || '').toLowerCase().includes(query);
        const formaMatch = (m.forma || '').toLowerCase().includes(query);
        if (!descMatch && !formaMatch) return false;
      }
      return true;
    });
  }, [movs, filterTipoMov, searchMov]);

  const handleConfirmAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(valorAbertura || 0);
    onAbrirCaixa(val, obsAbertura);
    playAlertChime('ready');
    setShowAbrirModal(false);
  };

  const handleOpenFecharModal = () => {
    setValorFechamento(dinheiroNaGaveta.toFixed(2));
    setShowFecharModal(true);
  };

  const handleConfirmFechar = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(valorFechamento || dinheiroNaGaveta);
    onFecharCaixa(val, obsFechamento);
    playAlertChime('ready');
    setShowFecharModal(false);
    // Abre automaticamente o relatório completo do dia
    setShowRelatorioModal(true);
  };

  const handleConfirmMov = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorMov || !descMov) return;
    onMovimentacao(tipoMov, formaMov, Number(valorMov), descMov);
    playAlertChime('ready');
    setShowMovModal(false);
    setValorMov('');
    setDescMov('');
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Caixa Header Card */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-2 bg-amber-600/10 border border-amber-600/30 rounded-xl text-amber-500">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                  Controle de Caixa & Faturamento Diário
                </h1>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    caixa.status === 'aberto'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                      : 'bg-red-950/80 text-red-400 border-red-800'
                  }`}
                >
                  {caixa.status === 'aberto' ? '● CAIXA ABERTO' : '○ CAIXA FECHADO'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  {caixa.data_caixa}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  Aberto às: {caixa.aberto_em ? caixa.aberto_em.slice(11, 16) : '--:--'}
                </span>
                {caixa.fechado_em && (
                  <>
                    <span>•</span>
                    <span className="text-red-400 font-bold">
                      Encerrado às: {caixa.fechado_em.slice(11, 16)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Relatório Completo do Dia */}
          <button
            type="button"
            onClick={() => setShowRelatorioModal(true)}
            className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Visualizar e imprimir o relatório financeiro consolidado do dia"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            <span>Relatório Completo do Dia</span>
          </button>

          {caixa.status === 'aberto' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setTipoMov('sangria');
                  setShowMovModal(true);
                }}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 uppercase"
              >
                <ArrowDownCircle className="w-3.5 h-3.5 text-red-400" />
                <span>Sangria / Suprimento</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFecharModal}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Fechar Caixa Diário</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowAbrirModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Caixa do Dia</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards: Visão Geral em Tempo Real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Faturamento Geral do Dia */}
        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-500 uppercase tracking-wider">
              Faturamento Geral (Hoje)
            </span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">
              {formatBRL(paymentStats.totalEntradasGerais)}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>Soma de todas as formas</span>
            <span className="font-bold text-amber-400 font-mono">
              {movs.filter((m) => m.tipo === 'entrada_pedido').length} pagtos
            </span>
          </div>
        </div>

        {/* Dinheiro Físico em Gaveta */}
        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
              Dinheiro Físico na Gaveta
            </span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums tracking-tight">
              {formatBRL(dinheiroNaGaveta)}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>Troco + Espécie - Sangria</span>
            <span className="font-bold text-emerald-300 font-mono">
              Entrada: {formatBRL(paymentStats.totalDinheiroEntradas)}
            </span>
          </div>
        </div>

        {/* Fundo de Troco Inicial */}
        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-neutral-300 uppercase tracking-wider">
              Fundo de Troco Inicial
            </span>
            <Unlock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-black text-neutral-100 tabular-nums tracking-tight">
              {formatBRL(caixa.valor_abertura || 0)}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>Cédulas miúdas e moedas</span>
            <span className="font-bold text-neutral-300 font-mono">Abertura</span>
          </div>
        </div>

        {/* Sangrias & Suprimentos */}
        <div className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-red-400 uppercase tracking-wider">
              Sangrias / Retiradas
            </span>
            <ArrowDownCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-black text-red-400 tabular-nums tracking-tight">
              {formatBRL(paymentStats.totalSangrias)}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>Suprimentos adicionais</span>
            <span className="font-bold text-emerald-400 font-mono">
              +{formatBRL(paymentStats.totalSuprimentos)}
            </span>
          </div>
        </div>
      </div>

      {/* REGRA REQUISITADA: "durante o dia podemos ver a soma de todas as formas de pagamento" */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" />
              <span>Soma de Todas as Formas de Pagamento no Faturamento do Dia</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Todo recebimento de mesas fechadas, pedidos balcão e delivery é computado em tempo real em sua respectiva forma.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-neutral-400 font-mono">
              TOTAL GERAL:{' '}
              <strong className="text-amber-400 text-sm">
                {formatBRL(paymentStats.totalEntradasGerais)}
              </strong>
            </span>
          </div>
        </div>

        {/* Dynamic Payment Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paymentStats.statsList.map((fp) => {
            const hasSales = fp.total > 0;
            return (
              <div
                key={fp.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  hasSales
                    ? 'bg-neutral-900 border-neutral-700/80 shadow-xs'
                    : 'bg-neutral-900/50 border-neutral-800/60 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black uppercase text-neutral-200 truncate pr-2">
                    {fp.nome}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      hasSales
                        ? 'bg-amber-950 text-amber-400 border border-amber-800/70'
                        : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {fp.percentual.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-lg font-black text-white tabular-nums">
                    {formatBRL(fp.total)}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {fp.qtd} {fp.qtd === 1 ? 'recebimento' : 'recebimentos'}
                  </span>
                </div>

                {/* Progress bar of total revenue */}
                <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, fp.percentual))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdown by Sales Channel & Detailed Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Channel & Operational Summary (4 cols) */}
        <div className="lg:col-span-4 bg-neutral-850 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-xs font-black text-white uppercase border-b border-neutral-800 pb-2.5 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Faturamento por Canal de Venda</span>
            </h3>

            <div className="space-y-3 mt-3 text-xs">
              {/* Salão */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white uppercase">Salão (Mesas)</div>
                    <div className="text-[10px] text-neutral-400">
                      {channelStats.salaoQtd} comandas fechadas
                    </div>
                  </div>
                </div>
                <span className="text-sm font-black text-white tabular-nums">
                  {formatBRL(channelStats.salaoTotal)}
                </span>
              </div>

              {/* Delivery */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Bike className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white uppercase">Delivery Piracicaba</div>
                    <div className="text-[10px] text-neutral-400">
                      {channelStats.deliveryQtd} entregas concluídas
                    </div>
                  </div>
                </div>
                <span className="text-sm font-black text-white tabular-nums">
                  {formatBRL(channelStats.deliveryTotal)}
                </span>
              </div>

              {/* Balcão */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white uppercase">Retirada Balcão</div>
                    <div className="text-[10px] text-neutral-400">
                      {channelStats.balcaoQtd} pedidos retirados
                    </div>
                  </div>
                </div>
                <span className="text-sm font-black text-white tabular-nums">
                  {formatBRL(channelStats.balcaoTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-neutral-300">
              <span>Total de Pedidos / Comandas:</span>
              <span className="font-mono font-bold text-white">
                {channelStats.totalPedidos}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-300">
              <span>Ticket Médio Geral:</span>
              <span className="font-mono font-bold text-amber-400">
                {formatBRL(channelStats.ticketMedio)}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Movement Log & Ledger (8 cols) */}
        <div className="lg:col-span-8 bg-neutral-850 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <h3 className="text-xs font-black text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Extrato Cronológico do Caixa ({filteredMovs.length})</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Todas as entradas de pedidos, sangrias e suprimentos registrados no caixa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type filter */}
              <select
                value={filterTipoMov}
                onChange={(e) => setFilterTipoMov(e.target.value as any)}
                aria-label="Filtrar por tipo de movimentação"
                className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 text-white rounded-lg text-xs font-bold uppercase focus:outline-none"
              >
                <option value="todos">TODOS OS TIPOS</option>
                <option value="entrada_pedido">VENDAS / ENTRADAS</option>
                <option value="sangria">SANGRIAS (RETIRADAS)</option>
                <option value="suprimento">SUPRIMENTOS</option>
              </select>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="FILTRAR..."
                  value={searchMov}
                  onChange={(e) => setSearchMov(e.target.value)}
                  className="pl-8 pr-2.5 py-1 bg-neutral-900 border border-neutral-700 text-white rounded-lg text-xs uppercase w-28 focus:w-36 transition-all focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredMovs.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500 uppercase tracking-wider">
                Nenhuma movimentação registrada com os filtros aplicados
              </div>
            ) : (
              [...filteredMovs].reverse().map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    {m.tipo === 'sangria' ? (
                      <div className="p-2 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 shrink-0">
                        <ArrowDownCircle className="w-4 h-4" />
                      </div>
                    ) : m.tipo === 'suprimento' ? (
                      <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0">
                        <ArrowUpCircle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400 shrink-0">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    )}

                    <div>
                      <div className="font-bold text-white uppercase flex items-center gap-2">
                        <span>{m.descricao}</span>
                        {m.forma && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 uppercase">
                            {m.forma}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        {m.hora} · TIPO:{' '}
                        {m.tipo === 'entrada_pedido'
                          ? 'RECEBIMENTO'
                          : m.tipo === 'sangria'
                          ? 'SANGRIA'
                          : 'SUPRIMENTO'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`font-black tabular-nums text-sm ${
                      m.tipo === 'sangria' ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {m.tipo === 'sangria' ? '-' : '+'} {formatBRL(m.valor)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: ABRIR CAIXA
          ========================================================================= */}
      {showAbrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAbrir}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-500" />
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
              <label className="text-xs font-black text-neutral-300 block mb-1 uppercase">
                Fundo de Troco Inicial em Dinheiro (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorAbertura}
                onChange={(e) => setValorAbertura(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-base font-black tabular-nums focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Valor físico contado em cédulas e moedas no início do expediente.
              </span>
            </div>

            <UpperInput
              label="OBSERVAÇÕES DA ABERTURA:"
              value={obsAbertura}
              onChange={setObsAbertura}
              placeholder="EX: TROCO CONFERIDO EM MOEDAS E NOTAS"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAbrirModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase shadow-md cursor-pointer"
              >
                Confirmar Abertura do Caixa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: FECHAR CAIXA (Com conferência de gaveta)
          ========================================================================= */}
      {showFecharModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmFechar}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-500" />
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

            <div className="p-4 bg-neutral-850 rounded-xl border border-neutral-800 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold uppercase">Total Faturamento Geral:</span>
                <span className="font-black text-amber-400 tabular-nums text-sm">
                  {formatBRL(paymentStats.totalEntradasGerais)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold uppercase">Fundo de Troco Abertura:</span>
                <span className="font-bold text-neutral-200 tabular-nums">
                  {formatBRL(caixa.valor_abertura || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold uppercase">Entradas em Dinheiro:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  +{formatBRL(paymentStats.totalDinheiroEntradas)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-bold uppercase">Total de Sangrias:</span>
                <span className="font-bold text-red-400 tabular-nums">
                  -{formatBRL(paymentStats.totalSangrias)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-800 font-black text-sm">
                <span className="text-white uppercase">Dinheiro Esperado na Gaveta:</span>
                <span className="text-emerald-400 tabular-nums font-mono">
                  {formatBRL(dinheiroNaGaveta)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1 uppercase">
                Valor Físico Conferido na Gaveta (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorFechamento}
                onChange={(e) => setValorFechamento(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-base font-black tabular-nums focus:outline-none focus:border-red-500"
              />
              {/* Diferença em tempo real */}
              {(() => {
                const confVal = parseFloat(valorFechamento.replace(',', '.')) || 0;
                const diff = confVal - dinheiroNaGaveta;
                if (Math.abs(diff) < 0.01) {
                  return (
                    <span className="text-[11px] text-emerald-400 mt-1 block font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Caixa batido exato sem diferença!
                    </span>
                  );
                } else if (diff > 0) {
                  return (
                    <span className="text-[11px] text-cyan-400 mt-1 block font-bold">
                      Sobra de caixa: +{formatBRL(diff)}
                    </span>
                  );
                } else {
                  return (
                    <span className="text-[11px] text-red-400 mt-1 block font-bold">
                      Falta de caixa: {formatBRL(diff)}
                    </span>
                  );
                }
              })()}
            </div>

            <UpperInput
              label="OBSERVAÇÕES DO FECHAMENTO:"
              value={obsFechamento}
              onChange={setObsFechamento}
              placeholder="EX: CAIXA CONFERIDO E LACRADO"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowFecharModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase shadow-md cursor-pointer flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Encerrar Caixa & Gerar Relatório</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: SANGRIA / SUPRIMENTO AVULSO
          ========================================================================= */}
      {showMovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmMov}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase">
                Movimentação Avulsa de Caixa
              </h3>
              <button
                type="button"
                onClick={() => setShowMovModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1 uppercase">
                Tipo de Operação:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMov('sangria')}
                  className={`py-2.5 text-xs font-black rounded-xl cursor-pointer uppercase transition-all ${
                    tipoMov === 'sangria'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Sangria (Retirada)
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMov('suprimento')}
                  className={`py-2.5 text-xs font-black rounded-xl cursor-pointer uppercase transition-all ${
                    tipoMov === 'suprimento'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Suprimento (Entrada)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1 uppercase">
                Forma Envolvida:
              </label>
              <select
                value={formaMov}
                onChange={(e) => setFormaMov(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs font-bold uppercase focus:outline-none"
              >
                <option value="dinheiro">DINHEIRO (ESPÉCIE / GAVETA)</option>
                <option value="pix">PIX (CONTA BANCÁRIA)</option>
                <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                <option value="cartao_credito">CARTÃO DE CRÉDITO</option>
                <option value="outro">OUTRA FORMA</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1 uppercase">
                Valor (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorMov}
                onChange={(e) => setValorMov(e.target.value)}
                placeholder="Ex: 50.00"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-base font-black tabular-nums focus:outline-none"
              />
            </div>

            <UpperInput
              label="MOTIVO / DESCRIÇÃO: *"
              value={descMov}
              onChange={setDescMov}
              placeholder="EX: RETIRADA PARA PAGAMENTO DO GÁS"
              required
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowMovModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase shadow-md cursor-pointer"
              >
                Confirmar Lançamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: RELATÓRIO COMPLETO DE TODO MOVIMENTO FINANCEIRO E CAIXA DO SISTEMA
          ========================================================================= */}
      {showRelatorioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl flex flex-col gap-5 my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-600/20 text-amber-500 border border-amber-500/30">
                    <FileSpreadsheet className="w-5 h-5" />
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                    Relatório Financeiro & Movimento de Caixa
                  </h2>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'} · {caixa.data_caixa} ·{' '}
                  Status:{' '}
                  <span className="font-bold uppercase text-white">
                    {caixa.status === 'aberto' ? 'Caixa em Andamento' : 'Caixa Encerrado'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRelatorioModal(false)}
                  className="w-8 h-8 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Report Paper Layout */}
            <div
              id="relatorio-fechamento-caixa"
              className="p-5 sm:p-6 bg-neutral-950 border border-neutral-800 rounded-xl space-y-6 text-neutral-200 font-sans print:bg-white print:text-black print:border-none print:p-0"
            >
              {/* Header Banner */}
              <div className="text-center border-b border-dashed border-neutral-700 pb-4">
                <h3 className="text-lg font-black uppercase text-amber-400 tracking-wide">
                  {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
                </h3>
                <p className="text-xs text-neutral-400">
                  {configuracoes?.endereco || 'RUA DO PORTO'} · {configuracoes?.cidade || 'PIRACICABA'} -{' '}
                  {configuracoes?.uf || 'SP'} · RESTAURANTE KAIPIRA
                </p>
                <h4 className="text-xs font-black uppercase tracking-widest text-white mt-2">
                  FECHAMENTO DIÁRIO & DEMONSTRATIVO DE MOVIMENTO
                </h4>
                <div className="flex flex-wrap justify-center gap-3 text-[11px] text-neutral-400 font-mono mt-1">
                  <span>DATA: {caixa.data_caixa}</span>
                  <span>•</span>
                  <span>ABERTURA: {caixa.aberto_em ? caixa.aberto_em.slice(11, 16) : '--:--'}</span>
                  <span>•</span>
                  <span>FECHAMENTO: {caixa.fechado_em ? caixa.fechado_em.slice(11, 16) : 'EM OPERAÇÃO'}</span>
                </div>
              </div>

              {/* 1. Balanço do Caixa Físico (Gaveta) */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5 border-b border-neutral-800 pb-1">
                  <Banknote className="w-3.5 h-3.5" />
                  <span>1. Balanço do Caixa Físico (Gaveta em Dinheiro)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="flex justify-between p-2 rounded bg-neutral-900 border border-neutral-850">
                    <span className="text-neutral-400 font-bold uppercase">(+) Fundo de Troco Inicial:</span>
                    <span className="font-mono font-black text-white">
                      {formatBRL(caixa.valor_abertura || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-neutral-900 border border-neutral-850">
                    <span className="text-neutral-400 font-bold uppercase">(+) Entradas em Dinheiro:</span>
                    <span className="font-mono font-black text-emerald-400">
                      +{formatBRL(paymentStats.totalDinheiroEntradas)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-neutral-900 border border-neutral-850">
                    <span className="text-neutral-400 font-bold uppercase">(+) Suprimentos em Dinheiro:</span>
                    <span className="font-mono font-black text-emerald-400">
                      +{formatBRL(paymentStats.suprimentosDinheiro)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-neutral-900 border border-neutral-850">
                    <span className="text-neutral-400 font-bold uppercase">(-) Sangrias / Retiradas:</span>
                    <span className="font-mono font-black text-red-400">
                      -{formatBRL(paymentStats.sangriasDinheiro)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-2">
                  <div>
                    <span className="text-[11px] text-neutral-400 font-bold uppercase block">
                      Saldo Calculado pelo Sistema:
                    </span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {formatBRL(dinheiroNaGaveta)}
                    </span>
                  </div>

                  {caixa.valor_fechamento !== undefined && (
                    <div className="sm:text-right">
                      <span className="text-[11px] text-neutral-400 font-bold uppercase block">
                        Saldo Físico Declarado:
                      </span>
                      <span className="text-base font-black text-white font-mono">
                        {formatBRL(caixa.valor_fechamento)}
                      </span>
                      <span className="text-[10px] block mt-0.5 font-bold">
                        {(() => {
                          const diff = (caixa.valor_fechamento || 0) - dinheiroNaGaveta;
                          if (Math.abs(diff) < 0.01) {
                            return <span className="text-emerald-400">CAIXA BATIDO (SEM DIFERENÇA)</span>;
                          } else if (diff > 0) {
                            return <span className="text-cyan-400">SOBRA: +{formatBRL(diff)}</span>;
                          } else {
                            return <span className="text-red-400">FALTA: {formatBRL(diff)}</span>;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Faturamento Geral por Forma de Pagamento */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5 border-b border-neutral-800 pb-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>2. Faturamento por Forma de Pagamento</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] font-black uppercase text-neutral-400">
                        <th className="py-2">Forma de Pagamento</th>
                        <th className="py-2 text-center">Transações</th>
                        <th className="py-2 text-right">Total Faturado</th>
                        <th className="py-2 text-right">% do Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850">
                      {paymentStats.statsList.map((fp) => (
                        <tr key={fp.id} className="hover:bg-neutral-900/60 transition-colors">
                          <td className="py-2.5 font-bold uppercase text-white flex items-center gap-1.5">
                            <span>{fp.nome}</span>
                          </td>
                          <td className="py-2.5 text-center font-mono text-neutral-300">
                            {fp.qtd}
                          </td>
                          <td className="py-2.5 text-right font-mono font-black text-amber-400">
                            {formatBRL(fp.total)}
                          </td>
                          <td className="py-2.5 text-right font-mono text-neutral-300">
                            {fp.percentual.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-neutral-700 font-black text-sm text-white">
                        <td className="py-2.5 uppercase">TOTAL GERAL FATURADO:</td>
                        <td className="py-2.5 text-center font-mono">
                          {movs.filter((m) => m.tipo === 'entrada_pedido').length}
                        </td>
                        <td className="py-2.5 text-right font-mono text-amber-400">
                          {formatBRL(paymentStats.totalEntradasGerais)}
                        </td>
                        <td className="py-2.5 text-right font-mono">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Resumo por Canais de Atendimento */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5 border-b border-neutral-800 pb-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>3. Resumo Operacional por Canal</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                      Salão (Mesas):
                    </span>
                    <span className="text-sm font-black text-white font-mono block mt-1">
                      {formatBRL(channelStats.salaoTotal)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {channelStats.salaoQtd} comandas
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                      Delivery Piracicaba:
                    </span>
                    <span className="text-sm font-black text-white font-mono block mt-1">
                      {formatBRL(channelStats.deliveryTotal)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {channelStats.deliveryQtd} pedidos
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                      Retirada no Balcão:
                    </span>
                    <span className="text-sm font-black text-white font-mono block mt-1">
                      {formatBRL(channelStats.balcaoTotal)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {channelStats.balcaoQtd} pedidos
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-between text-xs mt-1">
                  <span className="text-neutral-400 uppercase font-bold">
                    Ticket Médio por Atendimento:
                  </span>
                  <span className="font-mono font-black text-amber-400">
                    {formatBRL(channelStats.ticketMedio)}
                  </span>
                </div>
              </div>

              {/* 4. Observações */}
              {(caixa.observacoes || obsAbertura || obsFechamento) && (
                <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
                  <span className="text-[10px] text-neutral-400 font-black uppercase block mb-1">
                    Observações Operacionais:
                  </span>
                  <p className="text-neutral-300 italic">
                    {caixa.observacoes || obsFechamento || obsAbertura}
                  </p>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-neutral-700 pt-1.5">
                  <span className="font-bold uppercase text-neutral-300">
                    Operador / Responsável pelo Caixa
                  </span>
                </div>
                <div className="border-t border-neutral-700 pt-1.5">
                  <span className="font-bold uppercase text-neutral-300">
                    Gerência / Conferência
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-xs text-neutral-500">
                Sincronizado e auditado em nuvem Supabase.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Relatório</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRelatorioModal(false)}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold uppercase transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

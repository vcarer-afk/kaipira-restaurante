import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  CaixaDiario,
  FormaPagamento,
  FormaPagamentoConfig,
  Pedido,
  ConfiguracoesSistema,
  UsuarioSistema,
  Produto,
  Mesa,
  Cliente,
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
  ShieldCheck,
  CheckSquare,
  UserCheck,
  BadgeCheck,
  Loader2,
  FileDown,
  LayoutGrid,
  List,
} from 'lucide-react';

interface CashRegisterProps {
  caixa: CaixaDiario;
  formasPagamento?: FormaPagamentoConfig[];
  pedidos?: Pedido[];
  mesas?: Mesa[];
  produtos?: Produto[];
  clientes?: Cliente[];
  configuracoes?: ConfiguracoesSistema;
  currentRole?: string;
  currentPerfil?: any;
  usuarios?: UsuarioSistema[];
  onAbrirCaixa: (valor: number, observacoes?: string) => void;
  onFecharCaixa: (valor: number, observacoes?: string) => void;
  onMovimentacao: (
    tipo: 'entrada_pedido' | 'suprimento' | 'sangria',
    forma: FormaPagamento,
    valor: number,
    descricao: string
  ) => void;
  onConferirEntrega?: (pedidoId: number, conferidoPor: string, formaFinal?: string) => void;
  onConfirmarPagamento?: (pedidoId: number, forma?: FormaPagamento, conferidoPor?: string) => void;
}

export function getFormaCanonica(forma: string): string {
  const f = (forma || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (f.includes('pix')) return 'pix';
  if (f.includes('dinheiro') || f.includes('especie')) return 'dinheiro';
  if (f.includes('debito')) return 'cartao_debito';
  if (f.includes('credito')) return 'cartao_credito';
  if (f.includes('vale') || f.includes('vr') || f.includes('refeicao') || f.includes('ticket')) return 'vale_refeicao';
  if (f.includes('mensalista')) return 'mensalista';
  return f || 'outro';
}

const CANONICAL_NAMES: Record<string, string> = {
  pix: 'PIX (CHAVE / QR CODE)',
  dinheiro: 'DINHEIRO (ESPÉCIE)',
  cartao_debito: 'CARTÃO DE DÉBITO',
  cartao_credito: 'CARTÃO DE CRÉDITO',
  vale_refeicao: 'VALE REFEIÇÃO / VR',
  mensalista: 'MENSALISTA (FATURADO)',
  outro: 'OUTROS / DIVERSOS',
};

export const CashRegister: React.FC<CashRegisterProps> = ({
  caixa,
  formasPagamento = INITIAL_FORMAS_PAGAMENTO,
  pedidos = [],
  mesas = [],
  produtos = [],
  clientes = [],
  configuracoes,
  currentRole,
  currentPerfil,
  usuarios = [],
  onAbrirCaixa,
  onFecharCaixa,
  onMovimentacao,
  onConferirEntrega,
  onConfirmarPagamento,
}) => {
  // Helper para resolver dados do cliente retroativamente via clientes ou dados do pedido
  const resolveCliente = (p: Pedido | null | undefined): Cliente | undefined => {
    if (!p) return undefined;
    if (p.cliente && p.cliente.nome) return p.cliente;
    if (p.cliente_id && clientes && clientes.length > 0) {
      const found = clientes.find((c) => String(c.id) === String(p.cliente_id));
      if (found) return found;
    }
    const pedAny = p as any;
    if (pedAny.cliente_nome || pedAny.nome) {
      return {
        id: p.cliente_id || '1',
        nome: pedAny.cliente_nome || pedAny.nome,
        telefone: pedAny.telefone || '',
        endereco: pedAny.endereco || '',
        numero: pedAny.numero || '',
        bairro: pedAny.bairro || 'PIRACICABA',
        cep: pedAny.cep || '',
        eh_mensalista: false,
        saldo_devedor: 0,
        criado_em: p.criado_em,
      } as Cliente;
    }
    return p.cliente;
  };

  // Helper para garantir exibição da descrição completa do produto em todas as telas
  const getProductDescription = (it: { produto_id?: number; produto_nome?: string }) => {
    if (it.produto_nome && !it.produto_nome.trim().startsWith('#') && !it.produto_nome.toLowerCase().startsWith('prod #') && !it.produto_nome.toLowerCase().startsWith('produto #')) {
      return it.produto_nome;
    }
    if (produtos && it.produto_id) {
      const match = produtos.find((p) => p.id === it.produto_id);
      if (match?.nome) return match.nome;
    }
    return it.produto_nome || `Item #${it.produto_id || '?'}`;
  };
  // Modal states
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('0.00');
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
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Caixa Navigation: Resumo Geral, Conferência de Entregas, ou Extrato
  const [caixaTab, setCaixaTab] = useState<'resumo' | 'conferencia_entregas' | 'extrato'>('resumo');
  const [conferenciaFiltro, setConferenciaFiltro] = useState<'pendentes' | 'conferidos' | 'todos'>('pendentes');
  const [conferenciaViewMode, setConferenciaViewMode] = useState<'blocos' | 'lista'>('blocos');
  const [conferindoPedido, setConferindoPedido] = useState<Pedido | null>(null);
  const [formaConferencia, setFormaConferencia] = useState<string>('dinheiro');

  // Usuários para conferência e baixa de entregas (liberado para operadores ativos em qualquer dispositivo)
  const supervisoresCadastrados = useMemo(() => {
    const list = (usuarios || []).filter((u) => u.status === 'ativo');
    if (list.length === 0) {
      return [{ id: 'sup-operador', nome: currentPerfil?.nome || 'VLADEMIR (SUPERVISOR)', cargo: (currentPerfil?.cargo || 'supervisor') as any }];
    }
    return list;
  }, [usuarios, currentPerfil]);

  const [responsavelConferencia, setResponsavelConferencia] = useState(
    () => currentPerfil?.nome || supervisoresCadastrados[0]?.nome || 'VLADEMIR (SUPERVISOR)'
  );

  // Regra Unificada de Faturamento: Delivery com Conferência vs Balcão/Mesas Imediatos
  const isPedidoFaturado = (p: Pedido): boolean => {
    if (p.status === 'cancelado') return false;
    if (p.tipo === 'delivery') {
      return p.conferencia_entrega === 'conferido';
    }
    // Balcão e Mesas: faturado se houver pagamentos registrados ou status entregue
    return (p.pagamentos && p.pagamentos.some((pg) => pg.valor > 0)) || p.pagamento_confirmado === true;
  };

  const safePedidosList = Array.isArray(pedidos) ? pedidos : [];

  // Pedidos sob a categoria "A Faturar / A Receber" (não confirmados pelo caixa)
  const pedidosAFaturar = useMemo(() => {
    return safePedidosList.filter((p) => p && p.status !== 'cancelado' && !isPedidoFaturado(p));
  }, [safePedidosList]);

  const totalAFaturar = useMemo(() => {
    return pedidosAFaturar.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  }, [pedidosAFaturar]);

  // Filter & Search in movements ledger
  const [searchMov, setSearchMov] = useState('');
  const [filterTipoMov, setFilterTipoMov] = useState<'todos' | 'sangria' | 'suprimento'>('todos');

  // Computations
  const movs = useMemo(() => (caixa && Array.isArray(caixa.movimentacoes) ? caixa.movimentacoes : []), [caixa?.movimentacoes]);

  // REGRA DO USUÁRIO: Entregas Delivery pendentes de conferência do dia atual do caixa
  const dataHojeIso = new Date().toLocaleDateString('en-CA');
  const dataFiltroCaixa = caixa?.data_caixa || dataHojeIso;

  const deliveryOrdersPendentes = useMemo(() => {
    return safePedidosList.filter(
      (p) =>
        p &&
        p.tipo === 'delivery' &&
        p.status !== 'cancelado' &&
        p.conferencia_entrega !== 'conferido' &&
        (!p.criado_em || p.criado_em.startsWith(dataFiltroCaixa) || p.criado_em.startsWith(dataHojeIso))
    );
  }, [safePedidosList, dataFiltroCaixa, dataHojeIso]);

  const deliveryOrdersConferidos = useMemo(() => {
    return safePedidosList.filter(
      (p) =>
        p &&
        p.tipo === 'delivery' &&
        p.status !== 'cancelado' &&
        p.conferencia_entrega === 'conferido' &&
        (!p.criado_em || p.criado_em.startsWith(dataFiltroCaixa) || p.criado_em.startsWith(dataHojeIso))
    );
  }, [safePedidosList, dataFiltroCaixa, dataHojeIso]);

  const deliveryOrdersAll = useMemo(() => {
    return safePedidosList.filter(
      (p) =>
        p &&
        p.tipo === 'delivery' &&
        p.status !== 'cancelado' &&
        (!p.criado_em || p.criado_em.startsWith(dataFiltroCaixa) || p.criado_em.startsWith(dataHojeIso))
    );
  }, [safePedidosList, dataFiltroCaixa, dataHojeIso]);

  const totalPendenteConferencia = useMemo(() => {
    return deliveryOrdersPendentes.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  }, [deliveryOrdersPendentes]);

  const totalConferidoHoje = useMemo(() => {
    return deliveryOrdersConferidos.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  }, [deliveryOrdersConferidos]);

  // Pedidos faturados/confirmados de HOJE (Única fonte de faturamento do caixa)
  const pedidosConfirmados = useMemo(() => {
    return safePedidosList.filter((p) => {
      if (!p || !isPedidoFaturado(p)) return false;
      const criadoEm = p.criado_em || '';
      return !criadoEm || criadoEm.startsWith(dataFiltroCaixa) || criadoEm.startsWith(dataHojeIso);
    });
  }, [safePedidosList, dataFiltroCaixa, dataHojeIso]);

  // Dynamic dictionary of payment methods (canonical, deduplicated)
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

    // 1. Initialize with standard canonical forms
    const standardKeys = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'vale_refeicao', 'mensalista'];
    standardKeys.forEach((key) => {
      statsMap[key] = {
        id: key,
        nome: CANONICAL_NAMES[key] || key.toUpperCase(),
        tipo: key,
        total: 0,
        qtd: 0,
        taxa_operadora: 0,
      };
    });

    // Merge registered formasPagamento using getFormaCanonica
    formasPagamento.forEach((fp) => {
      if (fp.ativo === false) return;
      const canonicalKey = getFormaCanonica(fp.id || fp.nome);
      if (!statsMap[canonicalKey]) {
        statsMap[canonicalKey] = {
          id: canonicalKey,
          nome: CANONICAL_NAMES[canonicalKey] || fp.nome.toUpperCase(),
          tipo: fp.tipo || canonicalKey,
          total: 0,
          qtd: 0,
          taxa_operadora: fp.taxa_operadora || 0,
        };
      } else {
        if (fp.taxa_operadora && statsMap[canonicalKey].taxa_operadora === 0) {
          statsMap[canonicalKey].taxa_operadora = fp.taxa_operadora;
        }
      }
    });

    // 1. O fundo inicial da gaveta
    let dinheiroGaveta = Number(caixa?.valor_abertura) || 0;

    // 2. Somar Suprimentos e subtrair Sangrias (excluindo qualquer entrada_pedido perdida)
    let totalSangrias = 0;
    let totalSuprimentos = 0;
    let sangriasDinheiro = 0;
    let suprimentosDinheiro = 0;

    (caixa?.movimentacoes || []).forEach((m) => {
      const formaKey = getFormaCanonica(m.forma || 'dinheiro');
      if (m.tipo === 'suprimento') {
        dinheiroGaveta += m.valor;
        totalSuprimentos += m.valor;
        if (formaKey === 'dinheiro' || !m.forma) {
          suprimentosDinheiro += m.valor;
        }
      }
      if (m.tipo === 'sangria') {
        dinheiroGaveta -= m.valor;
        totalSangrias += m.valor;
        if (formaKey === 'dinheiro' || !m.forma) {
          sangriasDinheiro += m.valor;
        }
      }
    });

    // 3. Somar todos os pagamentos em ESPÉCIE dos pedidos faturados de HOJE e agregar faturamento geral
    let totalEntradasGerais = 0;
    let totalDinheiroEntradas = 0;

    pedidosConfirmados.forEach((p) => {
      if (p.pagamentos && p.pagamentos.length > 0) {
        p.pagamentos.forEach((pg) => {
          if (!pg.valor || pg.valor <= 0) return;
          const canonicalKey = getFormaCanonica(pg.forma || 'outro');

          totalEntradasGerais += pg.valor;

          if (canonicalKey === 'dinheiro') {
            dinheiroGaveta += pg.valor;
            totalDinheiroEntradas += pg.valor;
          }

          if (!statsMap[canonicalKey]) {
            statsMap[canonicalKey] = {
              id: canonicalKey,
              nome: CANONICAL_NAMES[canonicalKey] || canonicalKey.toUpperCase(),
              tipo: 'outro',
              total: 0,
              qtd: 0,
              taxa_operadora: 0,
            };
          }

          statsMap[canonicalKey].total += pg.valor;
          statsMap[canonicalKey].qtd += 1;
        });
      }
    });

    const fundoAbertura = Number(caixa?.valor_abertura) || 0;
    const dinheiroGavetaEsperado = dinheiroGaveta;

    // Convert statsMap to sorted list, eliminating any duplicated or ghost entries
    const statsList = Object.values(statsMap)
      .filter((item) => {
        return item.total > 0 || ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'].includes(item.id);
      })
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
  }, [formasPagamento, caixa?.movimentacoes, pedidosConfirmados, caixa?.valor_abertura]);

  // Breakdown by channel from orders (Apenas pedidos confirmados no caixa)
  const channelStats = useMemo(() => {
    let salaoTotal = 0;
    let salaoQtd = 0;
    let deliveryTotal = 0;
    let deliveryQtd = 0;
    let balcaoTotal = 0;
    let balcaoQtd = 0;

    safePedidosList.forEach((p) => {
      // Regra Unificada de Faturamento: delivery conferido OU balcão/mesas com pagamentos
      if (!isPedidoFaturado(p)) return;

      if (p.tipo === 'salão') {
        salaoTotal += (Number(p.valor_total) || 0);
        salaoQtd += 1;
      } else if (p.tipo === 'delivery') {
        deliveryTotal += (Number(p.valor_total) || 0);
        deliveryQtd += 1;
      } else if (p.tipo === 'retirada') {
        balcaoTotal += (Number(p.valor_total) || 0);
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

  // Filtered movements for ledger (Apenas Abertura, Sangrias e Suprimentos)
  const filteredMovs = useMemo(() => {
    return movs.filter((m) => {
      // Exclui completamente entradas de pedido do extrato do caixa diário
      if (m.tipo === 'entrada_pedido') return false;
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

    setValorFechamento(dinheiroNaGaveta.toFixed(2));
    setShowFecharModal(true);
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

  // Exportação nativa de PDF com jsPDF + html2canvas (Garante download de arquivo .pdf sem espaço em branco no topo)
  const handleExportarPDF = async () => {
    setIsExportingPDF(true);
    try {
      const reportElement = document.getElementById('relatorio-fechamento-caixa');
      if (!reportElement) {
        setIsExportingPDF(false);
        return;
      }

      // Garante captura do elemento a partir do topo exato sem adicionar scroll
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 5;
      const contentWidth = pdfWidth - margin * 2;
      const pageUsableHeight = pdfHeight - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= pageUsableHeight;

      while (heightLeft > 0) {
        position -= pageUsableHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= pageUsableHeight;
      }

      const dataHoje = caixa.data_caixa || new Date().toISOString().split('T')[0];
      pdf.save(`Relatorio_Fechamento_Caixa_${dataHoje}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar arquivo PDF:', err);
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Abertura do modal rápido de conferência e confirmação de pagamento
  const handleAbrirModalConferencia = (pedido: Pedido) => {
    setConferindoPedido(pedido);
    const formaInicial = pedido.forma_pagamento || pedido.pagamentos?.[0]?.forma || 'dinheiro';
    setFormaConferencia(formaInicial);
  };

  // Conferência de entrega individual pelo Gerente ou Supervisor
  const handleConfirmarConferencia = (pedido: Pedido, responsavel?: string, formaFinal?: string) => {
    const nome = responsavel?.trim() || responsavelConferencia.trim() || 'GERENTE GERAL';
    const formaEscolhida = formaFinal || formaConferencia || pedido.forma_pagamento || pedido.pagamentos?.[0]?.forma || 'dinheiro';
    if (onConferirEntrega) {
      onConferirEntrega(pedido.id, nome, formaEscolhida);
    }
    setConferindoPedido(null);
  };

  // Conferência em lote de todas as entregas pendentes
  const handleConferirTodasPendentes = () => {
    if (deliveryOrdersPendentes.length === 0) return;
    const nome = responsavelConferencia.trim() || currentPerfil?.nome || 'GERENTE GERAL';
    if (!window.confirm(`Confirma a conferência e lançamento no faturamento de ${deliveryOrdersPendentes.length} entrega(s) pelo supervisor ${nome}?`)) {
      return;
    }
    deliveryOrdersPendentes.forEach((p) => {
      if (onConferirEntrega) {
        onConferirEntrega(p.id, nome);
      }
    });
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

      {/* Caixa Navigation Tabs: Resumo Geral / Conferência Entregas / Extrato */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setCaixaTab('resumo')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            caixaTab === 'resumo'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Fluxo & Faturamento</span>
        </button>

        <button
          type="button"
          onClick={() => setCaixaTab('conferencia_entregas')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer relative ${
            caixaTab === 'conferencia_entregas'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Bike className="w-4 h-4 text-cyan-400" />
          <span>Conferência Entregas</span>
          {deliveryOrdersPendentes.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-black animate-pulse">
              {deliveryOrdersPendentes.length} PENDENTE{deliveryOrdersPendentes.length > 1 ? 'S' : ''}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-neutral-800 text-neutral-400">
              0 pendentes
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCaixaTab('extrato')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            caixaTab === 'extrato'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Extrato Geral ({movs.length})</span>
        </button>
      </div>

      {/* Banner de Alerta se houver entregas pendentes */}
      {deliveryOrdersPendentes.length > 0 && caixaTab !== 'conferencia_entregas' && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-300 uppercase">
                {deliveryOrdersPendentes.length} {deliveryOrdersPendentes.length === 1 ? 'Entrega Confirmada por Motoboy Pendente' : 'Entregas Confirmadas por Motoboys Pendentes'} de Conferência
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Total de <strong className="text-white">{formatBRL(totalPendenteConferencia)}</strong> aguardando validação do Gerente ou Supervisor para entrar no faturamento do dia.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCaixaTab('conferencia_entregas')}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <span>Conferir Agora</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {caixaTab === 'resumo' && (
        <>
          {/* Card Resumo A Faturar / A Receber */}
          {totalAFaturar > 0 && (
            <div className="p-4 bg-amber-950/30 border border-amber-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
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
                    Comandas abertas no salão, entregas não auditadas e pedidos de balcão pendentes. Não inflam o saldo consolidado do dia até confirmação pelo caixa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCaixaTab('conferencia_entregas')}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
              >
                <span>Auditar Entregas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
              {pedidosConfirmados.length} pedidos faturados
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
                Abertura, sangrias e suprimentos registrados no caixa do dia.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type filter */}
              <select
                value={filterTipoMov}
                onChange={(e) => setFilterTipoMov(e.target.value as any)}
                aria-label="Filtrar por tipo de movimentação"
                className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 text-white rounded-lg text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="todos" className="bg-neutral-900 text-white font-bold py-1">TODOS (SANGRIAS E SUPRIMENTOS)</option>
                <option value="sangria" className="bg-neutral-900 text-white font-bold py-1">SANGRIAS (RETIRADAS)</option>
                <option value="suprimento" className="bg-neutral-900 text-white font-bold py-1">SUPRIMENTOS (APORTES)</option>
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
      </>
    )}

      {/* =========================================================================
          ABA 2: CONFERÊNCIA ENTREGAS (MOTOBOYS)
          ========================================================================= */}
      {caixaTab === 'conferencia_entregas' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header & Banner da Conferência */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 rounded-2xl">
                <Bike className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white uppercase tracking-tight">
                    Conferência de Entregas (Motoboys)
                  </h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Auditoria de Caixa
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Todas as entregas confirmadas pelos entregadores (motoboys) ficam pendentes de conferência pelo caixa. Somente entrarão no faturamento diário após a conferência do Gerente ou Supervisor.
                </p>
              </div>
            </div>

            {deliveryOrdersPendentes.length > 0 && (
              <button
                type="button"
                onClick={handleConferirTodasPendentes}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Conferir Todas as {deliveryOrdersPendentes.length} Pendentes</span>
              </button>
            )}
          </div>

          {/* Cards de Métricas da Conferência */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-neutral-850 border border-amber-800/60 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  Pendentes de Conferência
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">
                  {formatBRL(totalPendenteConferencia)}
                </span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">
                  {deliveryOrdersPendentes.length} {deliveryOrdersPendentes.length === 1 ? 'entrega aguardando liberação' : 'entregas aguardando liberação'}
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 bg-neutral-850 border border-emerald-800/60 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                  Conferidas & Faturadas Hoje
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                  {formatBRL(totalConferidoHoje)}
                </span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">
                  {deliveryOrdersConferidos.length} {deliveryOrdersConferidos.length === 1 ? 'entrega validada no faturamento' : 'entregas validadas no faturamento'}
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 bg-neutral-850 border border-neutral-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                  Total Geral de Entregas Hoje
                </span>
                <span className="text-2xl font-black text-white font-mono tabular-nums">
                  {formatBRL(totalPendenteConferencia + totalConferidoHoje)}
                </span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">
                  {deliveryOrdersAll.length} entregas finalizadas
                </span>
              </div>
              <div className="p-3 bg-neutral-800 text-neutral-400 rounded-xl">
                <Bike className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filtro de Visualização & Responsável */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-850 p-3 rounded-2xl border border-neutral-800">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setConferenciaFiltro('pendentes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                  conferenciaFiltro === 'pendentes'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Pendentes ({deliveryOrdersPendentes.length})
              </button>
              <button
                type="button"
                onClick={() => setConferenciaFiltro('conferidos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                  conferenciaFiltro === 'conferidos'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Conferidas ({deliveryOrdersConferidos.length})
              </button>
              <button
                type="button"
                onClick={() => setConferenciaFiltro('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                  conferenciaFiltro === 'todos'
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Todas ({deliveryOrdersAll.length})
              </button>
            </div>

            {/* Right Controls: View Mode (Blocos / Lista) & Supervisor */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Toggle de Visualização: Blocos vs Lista */}
              <div className="flex items-center bg-neutral-900 border border-neutral-750 p-1 rounded-xl shadow-inner">
                <button
                  type="button"
                  onClick={() => setConferenciaViewMode('blocos')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    conferenciaViewMode === 'blocos'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos (Cards Detalhados)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConferenciaViewMode('lista')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    conferenciaViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista / Tabela Compacta"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Select Responsável Supervisor / Gerente */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-400 font-bold uppercase hidden md:inline">Supervisor:</span>
                <select
                  value={responsavelConferencia}
                  onChange={(e) => setResponsavelConferencia(e.target.value.toUpperCase())}
                  className="px-2.5 py-1 bg-neutral-900 border border-neutral-700 text-amber-400 font-bold rounded-lg text-xs uppercase focus:outline-none cursor-pointer max-w-[200px]"
                >
                  {supervisoresCadastrados.map((u) => (
                    <option key={u.id} value={u.nome} className="bg-neutral-850 text-white">
                      {u.nome} ({u.cargo.toUpperCase()})
                    </option>
                  ))}
                  <option value={currentPerfil?.nome || 'GERENTE GERAL'} className="bg-neutral-850 text-white">
                    {currentPerfil?.nome || 'GERENTE GERAL'} (ATUAL)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Entregas */}
          {(() => {
            const list =
              conferenciaFiltro === 'pendentes'
                ? deliveryOrdersPendentes
                : conferenciaFiltro === 'conferidos'
                ? deliveryOrdersConferidos
                : deliveryOrdersAll;

            if (list.length === 0) {
              return (
                <div className="py-16 text-center bg-neutral-850 rounded-2xl border border-neutral-800 p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-500 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase">
                    {conferenciaFiltro === 'pendentes'
                      ? 'Nenhuma entrega pendente de conferência!'
                      : 'Nenhuma entrega encontrada neste filtro.'}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    {conferenciaFiltro === 'pendentes'
                      ? 'Todas as entregas confirmadas pelos motoboys já foram auditadas pelo gerente ou supervisor e constam no faturamento diário.'
                      : 'Alterne os filtros acima para consultar entregas pendentes ou conferidas.'}
                  </p>
                </div>
              );
            }

            // MODO 1: VISUALIZAÇÃO EM BLOCOS (CARDS)
            if (conferenciaViewMode === 'blocos') {
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {list.map((p) => {
                    const isConferido = p.conferencia_entrega === 'conferido';
                    const subtotalProdutos = p.itens.reduce(
                      (sum, it) => sum + it.preco_unitario * it.quantidade,
                      0
                    );

                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isConferido
                            ? 'bg-neutral-850/80 border-neutral-800'
                            : 'bg-neutral-850 border-amber-800/80 shadow-md ring-1 ring-amber-500/30'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Top bar da entrega */}
                          <div className="flex items-start justify-between border-b border-neutral-800 pb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-base text-white">
                                  #{p.codigo_senha}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  Pedido #{p.id}
                                </span>
                                <span
                                  className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded ${
                                    isConferido
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                  }`}
                                >
                                  {isConferido ? 'CONFERIDO NO CAIXA' : 'PENDENTE CONFERÊNCIA'}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2">
                                <span className="flex items-center gap-1 text-cyan-400 font-bold">
                                  <Bike className="w-3.5 h-3.5" />
                                  {p.entregador_nome || 'MOTOBOY KAIPIRA'}
                                </span>
                                <span>•</span>
                                <span>Atualizado às {formatDateTime(p.atualizado_em)}</span>
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-lg font-black text-amber-400 font-mono tabular-nums">
                                {formatBRL(p.valor_total)}
                              </span>
                              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                                  💳 {(p.forma_pagamento || p.pagamentos?.[0]?.forma || 'A DEFINIR').replace('_', ' ').toUpperCase()}
                                </span>
                                {p.precisa_troco && p.troco_para && (
                                  <span className="text-[9.5px] font-bold text-amber-400 font-mono">
                                    Troco p/ {formatBRL(p.troco_para)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Dados do Cliente e Endereço de Entrega */}
                          {(() => {
                            const cli = resolveCliente(p);
                            return (
                              <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs space-y-1">
                                <div className="flex justify-between items-baseline">
                                  <span className="font-bold text-white uppercase">
                                    {cli?.nome || (p.tipo === 'delivery' ? 'CLIENTE DELIVERY' : 'CLIENTE BALCÃO')}
                                  </span>
                                  {cli?.telefone && (
                                    <span className="text-[11px] text-neutral-400 font-mono">
                                      {cli.telefone}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-300">
                                  {cli?.endereco || 'PIRACICABA'}
                                  {cli?.numero ? `, Nº ${cli.numero}` : ''}
                                  {cli?.complemento ? ` (${cli.complemento})` : ''} -{' '}
                                  <strong className="text-amber-400">{cli?.bairro || 'PIRACICABA'}</strong>
                                </p>
                              </div>
                            );
                          })()}

                          {/* Detalhe dos Produtos, Quantidades, Valores e Subtotal (Regra solicitada) */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                              Itens Entregues:
                            </span>
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {p.itens.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-neutral-900/60 border border-neutral-850"
                                >
                                  <span className="text-neutral-200">
                                    <strong className="text-amber-400 font-mono">{it.quantidade}x</strong>{' '}
                                    {getProductDescription(it)}
                                  </span>
                                  <div className="text-right shrink-0 font-mono">
                                    <span className="font-bold text-white">
                                      {formatBRL(it.preco_unitario * it.quantidade)}
                                    </span>
                                    <span className="text-[9.5px] text-neutral-500 block">
                                      ({it.quantidade}x {formatBRL(it.preco_unitario)})
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="pt-2 border-t border-neutral-800 text-[11px] flex justify-between text-neutral-400 font-mono">
                              <span>Subtotal Pratos: {formatBRL(subtotalProdutos)}</span>
                              <span>Taxa Entrega: +{formatBRL(p.taxa_entrega || 0)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Ação de Conferência */}
                        <div className="pt-3 border-t border-neutral-800">
                          {isConferido ? (
                            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between text-xs text-emerald-300">
                              <span className="flex items-center gap-1.5 font-bold uppercase">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                Conferido por: {p.conferido_por || 'GERENTE'}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {p.conferido_em ? formatDateTime(p.conferido_em) : 'Hoje'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/40">
                              <div className="flex items-center gap-1.5 text-xs text-amber-300">
                                <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-[11px]">
                                  Liberar entrada de <strong>{formatBRL(p.valor_total)}</strong> no faturamento diário
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAbrirModalConferencia(p)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-98"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Conferir & Faturar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // MODO 2: VISUALIZAÇÃO EM LISTA (TABELA COMPACTA E LINHAS)
            return (
              <div className="bg-neutral-850 rounded-2xl border border-neutral-800 shadow-sm overflow-hidden">
                {/* Visualização em Tabela para Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-[10.5px] uppercase font-black tracking-wider">
                        <th className="py-3 px-4">Senha / Pedido</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Motoboy / Saída</th>
                        <th className="py-3 px-3">Cliente & Destino</th>
                        <th className="py-3 px-3">Itens / Descrição</th>
                        <th className="py-3 px-3">Pagamento</th>
                        <th className="py-3 px-4 text-right">Valor Total</th>
                        <th className="py-3 px-4 text-center">Ação / Auditoria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/80">
                      {list.map((p) => {
                        const isConferido = p.conferencia_entrega === 'conferido';
                        const subtotalProdutos = p.itens.reduce(
                          (sum, it) => sum + it.preco_unitario * it.quantidade,
                          0
                        );

                        return (
                          <tr
                            key={p.id}
                            className={`transition-colors ${
                              isConferido
                                ? 'hover:bg-neutral-800/40'
                                : 'bg-amber-950/10 hover:bg-amber-950/25'
                            }`}
                          >
                            {/* Senha / Pedido */}
                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                              <span className="font-mono font-black text-base text-amber-400 block">
                                #{p.codigo_senha}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                Pedido #{p.id}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-3 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[9.5px] font-black uppercase px-2 py-0.5 rounded ${
                                  isConferido
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                }`}
                              >
                                {isConferido ? (
                                  <>
                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                    <span>CONFERIDO</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    <span>PENDENTE</span>
                                  </>
                                )}
                              </span>
                            </td>

                            {/* Motoboy / Saída */}
                            <td className="py-3.5 px-3 align-top">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                                <Bike className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[140px] uppercase">
                                  {p.entregador_nome || 'MOTOBOY KAIPIRA'}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                                {formatDateTime(p.atualizado_em)}
                              </div>
                            </td>

                            {/* Cliente & Destino */}
                            <td className="py-3.5 px-3 align-top">
                              {(() => {
                                const cli = resolveCliente(p);
                                return (
                                  <>
                                    <div className="font-bold text-white uppercase text-xs">
                                      {cli?.nome || (p.tipo === 'delivery' ? 'CLIENTE DELIVERY' : 'CLIENTE BALCÃO')}
                                    </div>
                                    <div className="text-[11px] text-neutral-300 truncate max-w-[200px] mt-0.5">
                                      {cli?.endereco || 'PIRACICABA'}
                                      {cli?.numero ? `, Nº ${cli.numero}` : ''}
                                      {cli?.complemento ? ` (${cli.complemento})` : ''}
                                    </div>
                                    <div className="text-[10.5px] text-amber-400 font-bold mt-0.5">
                                      {cli?.bairro || 'PIRACICABA'}
                                      {cli?.telefone ? ` · ${cli.telefone}` : ''}
                                    </div>
                                  </>
                                );
                              })()}
                            </td>

                            {/* Itens / Descrição do Produto */}
                            <td className="py-3.5 px-3 align-top max-w-[280px]">
                              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                {p.itens.map((it, idx) => (
                                  <div key={idx} className="text-xs text-neutral-200 leading-snug">
                                    <strong className="text-amber-400 font-mono mr-1">
                                      {it.quantidade}x
                                    </strong>
                                    <span>{getProductDescription(it)}</span>
                                    <span className="text-neutral-500 font-mono text-[10px] ml-1">
                                      ({formatBRL(it.preco_unitario * it.quantidade)})
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-[10px] text-neutral-400 font-mono mt-1 pt-1 border-t border-neutral-800 flex justify-between">
                                <span>Subtotal: {formatBRL(subtotalProdutos)}</span>
                                {p.taxa_entrega > 0 && <span>Taxa: +{formatBRL(p.taxa_entrega)}</span>}
                              </div>
                            </td>

                            {/* Forma de Pagamento */}
                            <td className="py-3.5 px-3 align-top whitespace-nowrap">
                              <span className="text-xs font-black uppercase text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 inline-block font-mono">
                                💳 {(p.forma_pagamento || p.pagamentos?.[0]?.forma || 'A DEFINIR').replace('_', ' ').toUpperCase()}
                              </span>
                              {p.precisa_troco && p.troco_para && (
                                <span className="text-[10px] text-amber-400 font-bold block mt-1 font-mono">
                                  Troco p/ {formatBRL(p.troco_para)}
                                </span>
                              )}
                            </td>

                            {/* Valor Total */}
                            <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                              <span className="text-base font-black text-white font-mono tabular-nums block">
                                {formatBRL(p.valor_total)}
                              </span>
                            </td>

                            {/* Ação / Auditoria */}
                            <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                              {isConferido ? (
                                <div className="inline-flex flex-col items-center justify-center p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    Conferido
                                  </span>
                                  <span className="text-[9.5px] text-neutral-400 font-mono truncate max-w-[120px]">
                                    {p.conferido_por || 'GERENTE'}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirModalConferencia(p)}
                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                                  title="Liberar entrada no faturamento diário"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Conferir</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Visualização em Lista Linear para Mobile */}
                <div className="md:hidden divide-y divide-neutral-800">
                  {list.map((p) => {
                    const isConferido = p.conferencia_entrega === 'conferido';

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 space-y-2.5 transition-colors ${
                          isConferido ? 'bg-neutral-850' : 'bg-amber-950/15'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base text-amber-400">
                              #{p.codigo_senha}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                isConferido
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                              }`}
                            >
                              {isConferido ? 'CONFERIDO' : 'PENDENTE'}
                            </span>
                          </div>
                          <span className="text-base font-black text-white font-mono tabular-nums">
                            {formatBRL(p.valor_total)}
                          </span>
                        </div>

                        <div className="text-xs space-y-0.5">
                          <div className="font-bold text-white uppercase">{p.cliente?.nome || 'CLIENTE'}</div>
                          <div className="text-[11px] text-neutral-400">
                            {p.cliente?.bairro || 'PIRACICABA'} · Motoboy: {p.entregador_nome || 'PRÓPRIO'}
                          </div>
                        </div>

                        {/* Itens Resumidos */}
                        <div className="bg-neutral-900 p-2 rounded-lg text-xs space-y-1">
                          {p.itens.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-[11px]">
                              <span className="text-neutral-200">
                                <strong className="text-amber-400 mr-1">{it.quantidade}x</strong>
                                {getProductDescription(it)}
                              </span>
                              <span className="text-neutral-400 font-mono">
                                {formatBRL(it.preco_unitario * it.quantidade)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Ação */}
                        <div className="pt-1 flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="text-amber-300 font-black text-[11px] uppercase font-mono">
                              💳 {(p.forma_pagamento || p.pagamentos?.[0]?.forma || 'A DEFINIR').replace('_', ' ').toUpperCase()}
                            </span>
                            {p.precisa_troco && p.troco_para && (
                              <span className="text-[10px] text-amber-400 font-bold font-mono">
                                Troco p/ {formatBRL(p.troco_para)}
                              </span>
                            )}
                          </div>

                          {isConferido ? (
                            <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Conferido por {p.conferido_por || 'GERENTE'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAbrirModalConferencia(p)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Conferir & Faturar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          ABA 3: EXTRATO COMPLETO DE MOVIMENTAÇÕES DO CAIXA
          ========================================================================= */}
      {caixaTab === 'extrato' && (
        <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Extrato Geral das Movimentações ({filteredMovs.length})</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Abertura, sangrias e suprimentos registrados no caixa do dia (vendas registradas no faturamento).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterTipoMov}
                onChange={(e) => setFilterTipoMov(e.target.value as any)}
                aria-label="Filtrar por tipo de movimentação"
                className="px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl text-xs font-bold uppercase focus:outline-none"
              >
                <option value="todos">TODOS OS TIPOS (SANGRIAS E SUPRIMENTOS)</option>
                <option value="sangria">SANGRIAS (RETIRADAS)</option>
                <option value="suprimento">SUPRIMENTOS (APORTES)</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="FILTRAR..."
                  value={searchMov}
                  onChange={(e) => setSearchMov(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl text-xs uppercase w-36 focus:w-48 transition-all focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredMovs.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-500 uppercase tracking-wider">
                Nenhuma movimentação registrada com os filtros aplicados
              </div>
            ) : (
              [...filteredMovs].reverse().map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    {m.tipo === 'sangria' ? (
                      <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 shrink-0">
                        <ArrowDownCircle className="w-4 h-4" />
                      </div>
                    ) : m.tipo === 'suprimento' ? (
                      <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 shrink-0">
                        <ArrowUpCircle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-400">
                          {m.hora ? m.hora.slice(0, 5) : '--:--'}
                        </span>
                        <span className="font-black text-white uppercase">{m.descricao}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold uppercase text-neutral-300">
                          {m.forma ? m.forma.toUpperCase() : 'DINHEIRO'}
                        </span>
                        <span>•</span>
                        <span className="uppercase text-[10px]">
                          {m.tipo === 'entrada_pedido'
                            ? 'Venda / Entrada'
                            : m.tipo === 'sangria'
                            ? 'Sangria'
                            : 'Suprimento'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`font-black tabular-nums text-base font-mono ${
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
      )}

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
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="dinheiro" className="bg-neutral-900 text-white font-bold py-1">DINHEIRO (ESPÉCIE / GAVETA)</option>
                <option value="pix" className="bg-neutral-900 text-white font-bold py-1">PIX (CONTA BANCÁRIA)</option>
                <option value="cartao_debito" className="bg-neutral-900 text-white font-bold py-1">CARTÃO DE DÉBITO</option>
                <option value="cartao_credito" className="bg-neutral-900 text-white font-bold py-1">CARTÃO DE CRÉDITO</option>
                <option value="outro" className="bg-neutral-900 text-white font-bold py-1">OUTRA FORMA</option>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto print:p-0 print:m-0 print:static print:block print:bg-white">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl flex flex-col gap-5 my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 print:p-0 print:m-0 print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:bg-white">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4 print:hidden">
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
                  disabled={isExportingPDF}
                  onClick={handleExportarPDF}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  title="Baixar arquivo PDF com o relatório completo de fechamento"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isExportingPDF ? 'Gerando PDF...' : 'Baixar PDF (.PDF)'}</span>
                </button>

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

            {/* Printable Report Paper Layout (Folha A4 Branca com Renderização Nítida para PDF e Impressão) */}
            <div
              id="relatorio-fechamento-caixa"
              className="p-6 sm:p-8 bg-white border border-neutral-300 rounded-xl space-y-6 text-neutral-900 font-sans shadow-2xl max-w-[210mm] mx-auto print:border-none print:shadow-none print:p-0 print:max-w-none"
            >
              {/* Header Banner */}
              <div className="text-center border-b border-dashed border-neutral-400 pb-4">
                <h3 className="text-xl font-black uppercase text-amber-800 tracking-wide font-serif">
                  {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
                </h3>
                <p className="text-xs text-neutral-600">
                  {configuracoes?.endereco || 'RUA DO PORTO'} · {configuracoes?.cidade || 'PIRACICABA'} -{' '}
                  {configuracoes?.uf || 'SP'} · RESTAURANTE KAIPIRA PIRACICABA
                </p>
                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900 mt-2 border-t border-b border-neutral-200 py-1 inline-block px-4">
                  DEMONSTRATIVO DE FECHAMENTO DE CAIXA & AUDITORIA FINANCEIRA
                </h4>
                <div className="flex flex-wrap justify-center gap-3 text-[11px] text-neutral-600 font-mono mt-2">
                  <span>DATA DO CAIXA: <strong className="text-neutral-900">{caixa.data_caixa}</strong></span>
                  <span>•</span>
                  <span>ABERTURA: {caixa.aberto_em ? caixa.aberto_em.slice(11, 16) : '--:--'}</span>
                  <span>•</span>
                  <span>FECHAMENTO: {caixa.fechado_em ? caixa.fechado_em.slice(11, 16) : 'EM OPERAÇÃO'}</span>
                </div>
              </div>

              {/* 1. Balanço do Caixa Físico (Gaveta em Dinheiro) */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5 border-b border-neutral-300 pb-1">
                  <Banknote className="w-3.5 h-3.5 text-amber-700" />
                  <span>1. Balanço do Caixa Físico (Gaveta em Dinheiro)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="flex justify-between p-2.5 rounded bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-600 font-bold uppercase">(+) Fundo de Troco Inicial:</span>
                    <span className="font-mono font-black text-neutral-900">
                      {formatBRL(caixa.valor_abertura || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-600 font-bold uppercase">(+) Entradas em Dinheiro:</span>
                    <span className="font-mono font-black text-emerald-700">
                      +{formatBRL(paymentStats.totalDinheiroEntradas)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-600 font-bold uppercase">(+) Suprimentos em Dinheiro:</span>
                    <span className="font-mono font-black text-emerald-700">
                      +{formatBRL(paymentStats.suprimentosDinheiro)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-600 font-bold uppercase">(-) Sangrias / Retiradas:</span>
                    <span className="font-mono font-black text-red-700">
                      -{formatBRL(paymentStats.sangriasDinheiro)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-2">
                  <div>
                    <span className="text-[11px] text-neutral-600 font-bold uppercase block">
                      Saldo Calculado pelo Sistema (Esperado na Gaveta):
                    </span>
                    <span className="text-lg font-black text-emerald-800 font-mono">
                      {formatBRL(dinheiroNaGaveta)}
                    </span>
                  </div>

                  {caixa.valor_fechamento !== undefined && (
                    <div className="sm:text-right">
                      <span className="text-[11px] text-neutral-600 font-bold uppercase block">
                        Saldo Físico Declarado no Fechamento:
                      </span>
                      <span className="text-lg font-black text-neutral-900 font-mono">
                        {formatBRL(caixa.valor_fechamento)}
                      </span>
                      <span className="text-[10px] block mt-0.5 font-bold">
                        {(() => {
                          const diff = (caixa.valor_fechamento || 0) - dinheiroNaGaveta;
                          if (Math.abs(diff) < 0.01) {
                            return <span className="text-emerald-700">CAIXA BATIDO (SEM DIFERENÇA)</span>;
                          } else if (diff > 0) {
                            return <span className="text-blue-700">SOBRA: +{formatBRL(diff)}</span>;
                          } else {
                            return <span className="text-red-700">FALTA: {formatBRL(diff)}</span>;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Faturamento Geral por Forma de Pagamento */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5 border-b border-neutral-300 pb-1">
                  <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                  <span>2. Faturamento Consolidado por Forma de Pagamento</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-neutral-300">
                    <thead className="bg-neutral-100 text-neutral-800 font-black uppercase text-[11px] border-b border-neutral-300">
                      <tr>
                        <th className="py-2.5 px-3">Forma de Pagamento</th>
                        <th className="py-2.5 px-3 text-center">Transações</th>
                        <th className="py-2.5 px-3 text-right">Total Faturado</th>
                        <th className="py-2.5 px-3 text-right">% Participação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {paymentStats.statsList.map((fp) => (
                        <tr key={fp.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="py-2 px-3 font-bold uppercase text-neutral-900">
                            {fp.nome}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-neutral-700">
                            {fp.qtd}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                            {formatBRL(fp.total)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-neutral-600">
                            {fp.percentual.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-neutral-800 font-black text-xs bg-neutral-100 text-neutral-900">
                        <td className="py-2.5 px-3 uppercase">TOTAL GERAL FATURADO:</td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {pedidosConfirmados.length}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-800 text-sm">
                          {formatBRL(paymentStats.totalEntradasGerais)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Resumo Operacional por Canal de Atendimento */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5 border-b border-neutral-300 pb-1">
                  <Layers className="w-3.5 h-3.5 text-amber-700" />
                  <span>3. Resumo Operacional por Canal</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                    <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                      Salão (Mesas):
                    </span>
                    <span className="text-base font-black text-neutral-900 font-mono block mt-1">
                      {formatBRL(channelStats.salaoTotal)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {channelStats.salaoQtd} comandas
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                    <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                      Delivery Piracicaba (Conferido):
                    </span>
                    <span className="text-base font-black text-neutral-900 font-mono block mt-1">
                      {formatBRL(channelStats.deliveryTotal)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {channelStats.deliveryQtd} pedidos conferidos
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                    <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                      Retirada no Balcão:
                    </span>
                    <span className="text-base font-black text-neutral-900 font-mono block mt-1">
                      {formatBRL(channelStats.balcaoTotal)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {channelStats.balcaoQtd} pedidos retirados
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Auditoria da Conferência de Entregas (Motoboys) */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5 border-b border-neutral-300 pb-1">
                  <Bike className="w-3.5 h-3.5 text-amber-700" />
                  <span>4. Auditoria de Conferência de Entregas (Motoboys)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
                    <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                      Entregas Realizadas Hoje:
                    </span>
                    <span className="text-sm font-black text-neutral-900 font-mono block mt-0.5">
                      {deliveryOrdersAll.length} entregas
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                      Conferidas & Faturadas:
                    </span>
                    <span className="text-sm font-black text-emerald-900 font-mono block mt-0.5">
                      {deliveryOrdersConferidos.length} ({formatBRL(totalConferidoHoje)})
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">
                      Pendentes de Conferência:
                    </span>
                    <span className="text-sm font-black text-amber-900 font-mono block mt-0.5">
                      {deliveryOrdersPendentes.length} ({formatBRL(totalPendenteConferencia)})
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Observações */}
              {(caixa.observacoes || obsAbertura || obsFechamento) && (
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs">
                  <span className="text-[10px] text-neutral-600 font-black uppercase block mb-1">
                    Observações Operacionais:
                  </span>
                  <p className="text-neutral-800 italic">
                    {caixa.observacoes || obsFechamento || obsAbertura}
                  </p>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-neutral-400 pt-1.5">
                  <span className="font-bold uppercase text-neutral-800 block">
                    Operador do Caixa
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">Assinatura / Carimbo</span>
                </div>
                <div className="border-t border-neutral-400 pt-1.5">
                  <span className="font-bold uppercase text-neutral-800 block">
                    Gerência / Supervisão
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">Visto do Supervisor</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800">
              <span className="text-xs text-neutral-500">
                Arquivo gerado em formato A4 · Auditado no Supabase.
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingPDF}
                  onClick={handleExportarPDF}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isExportingPDF ? 'Gerando PDF...' : 'Baixar Relatório em PDF (.PDF)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Salvar como PDF</span>
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

      {/* Modal de Confirmação e Ajuste da Forma de Pagamento da Entrega */}
      {conferindoPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-750 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    Conferência de Entrega · #{conferindoPedido.codigo_senha}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Pedido #{conferindoPedido.id} · Motoboy: {conferindoPedido.entregador_nome || 'PRÓPRIO'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConferindoPedido(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Entrega */}
            {(() => {
              const cli = resolveCliente(conferindoPedido);
              return (
                <div className="bg-neutral-850 p-3.5 rounded-xl border border-neutral-800 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-white uppercase">
                      {cli?.nome || (conferindoPedido.tipo === 'delivery' ? 'CLIENTE DELIVERY' : 'CLIENTE BALCÃO')}
                    </span>
                    <span className="text-base font-black text-amber-400 font-mono">
                      {formatBRL(conferindoPedido.valor_total)}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    {cli?.endereco || 'PIRACICABA'}
                    {cli?.numero ? `, Nº ${cli.numero}` : ''} -{' '}
                    <strong className="text-neutral-300">{cli?.bairro || 'PIRACICABA'}</strong>
                  </p>
                  <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-neutral-400">
                      Forma Combinada no Pedido:{' '}
                      <strong className="text-amber-400 font-mono uppercase">
                        {(conferindoPedido.forma_pagamento || conferindoPedido.pagamentos?.[0]?.forma || 'A DEFINIR').replace('_', ' ')}
                      </strong>
                    </span>
                    {conferindoPedido.precisa_troco && conferindoPedido.troco_para && (
                      <span className="text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 font-mono font-bold">
                        Troco p/ {formatBRL(conferindoPedido.troco_para)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Seleção / Confirmação da Forma Real Recebida */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-neutral-300 flex items-center justify-between">
                <span>Forma de Pagamento Recebida pelo Motoboy:</span>
                <span className="text-[10px] text-amber-400 font-normal">Confirme ou altere</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'dinheiro', label: 'DINHEIRO', icon: '💵' },
                  { id: 'pix', label: 'PIX', icon: '⚡' },
                  { id: 'cartao_debito', label: 'DÉBITO', icon: '💳' },
                  { id: 'cartao_credito', label: 'CRÉDITO', icon: '💳' },
                  { id: 'vale_refeicao', label: 'VALE / VR', icon: '🍽️' },
                  { id: 'mensalista', label: 'MENSALISTA', icon: '📋' },
                ].map((item) => {
                  const isSelected = formaConferencia.toLowerCase() === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormaConferencia(item.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-1 ring-amber-400'
                          : 'bg-neutral-850 text-neutral-300 border-neutral-750 hover:bg-neutral-800'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Responsável pela Conferência */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-neutral-300 block">
                Operador / Supervisor Responsável:
              </label>
              <select
                value={responsavelConferencia}
                onChange={(e) => setResponsavelConferencia(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white rounded-xl text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {supervisoresCadastrados.map((u) => (
                  <option key={u.id} value={u.nome} className="bg-neutral-900 text-white font-bold py-1">
                    {u.nome} ({u.cargo.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setConferindoPedido(null)}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmarConferencia(conferindoPedido, responsavelConferencia, formaConferencia)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirmar & Faturar {formatBRL(conferindoPedido.valor_total)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Pedido,
  Mesa,
  CaixaDiario,
  ItemEstoque,
  Cliente,
  FormaPagamento,
  ConfiguracoesSistema,
  CardapioDiarioConfig,
  DashboardLayoutTipo,
} from '../types';
import { formatBRL, formatTime, isSalaoPedido } from '../utils/formatters';
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
  Radio,
  LayoutDashboard,
  Terminal,
  ShoppingCart,
  Coffee,
  Grid3X3,
  Users,
  Search,
  Eye,
  Check,
  Volume2,
  Tv,
} from 'lucide-react';

function describeArc(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  if (
    typeof startAngle !== 'number' ||
    typeof endAngle !== 'number' ||
    isNaN(startAngle) ||
    isNaN(endAngle) ||
    isNaN(innerRadius) ||
    isNaN(outerRadius)
  ) {
    return '';
  }
  const span = Math.max(0, endAngle - startAngle);
  if (span <= 0) return '';
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
  onSaveConfiguracoes?: (novas: ConfiguracoesSistema) => Promise<void> | void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  pedidos = [],
  mesas = [],
  caixa = { status: 'fechado', valor_abertura: 0, movimentacoes: [] } as any,
  estoque = [],
  clientes = [],
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
  onSaveConfiguracoes,
}) => {
  const isAdminOrMaster = currentRole === 'admin' || currentRole === 'master' || currentRole === 'supervisor';

  // Active dashboard layout (default: 'stripe') com sincronização instantânea
  const [localLayout, setLocalLayout] = useState<DashboardLayoutTipo>(
    configuracoes?.dashboard_layout || 'stripe'
  );

  useEffect(() => {
    if (configuracoes?.dashboard_layout) {
      setLocalLayout(configuracoes.dashboard_layout);
    }
  }, [configuracoes?.dashboard_layout]);

  const layoutAtual: DashboardLayoutTipo = localLayout;

  const handleSelectLayout = (novoLayout: DashboardLayoutTipo) => {
    setLocalLayout(novoLayout);
    if (onSaveConfiguracoes) {
      onSaveConfiguracoes({
        ...(configuracoes || {}),
        dashboard_layout: novoLayout,
      } as any);
    }
  };

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

  // Search filter for Shopify chronological feed
  const [shopifyFeedSearch, setShopifyFeedSearch] = useState('');

  // Validação e normalização de listas seguras (blindagem #310)
  const safePedidos = Array.isArray(pedidos) ? pedidos : [];
  const safeMesas = Array.isArray(mesas) ? mesas : [];
  const safeEstoque = Array.isArray(estoque) ? estoque : [];
  const safeClientes = Array.isArray(clientes) ? clientes : [];

  // Regra Unificada de Faturamento: Delivery com Conferência vs Balcão/Mesas Imediatos
  const isPedidoFaturado = (p: Pedido): boolean => {
    if (!p || p.status === 'cancelado') return false;
    if (p.tipo === 'delivery') {
      return p.conferencia_entrega === 'conferido';
    }
    return (
      (p.pagamentos && Array.isArray(p.pagamentos) && p.pagamentos.some((pg) => pg && Number(pg.valor) > 0)) ||
      p.pagamento_confirmado === true
    );
  };

  // REGRA DE CONSISTÊNCIA: Alinhamento de data e faturamento entre Dashboard e Caixa (inclui turnos noturnos)
  const dataHojeIso = new Date().toLocaleDateString('en-CA');
  const dataFiltroCaixa = caixa?.data_caixa || dataHojeIso;

  const activeAndCompletedOrders = safePedidos.filter((p) => {
    if (!p || p.status === 'cancelado') return false;
    if (!p.criado_em) return true;
    // Compatibilidade com turnos que viram a meia-noite
    return (
      p.criado_em.startsWith(dataFiltroCaixa) ||
      p.criado_em.startsWith(dataHojeIso) ||
      (caixa?.status === 'aberto' && caixa?.aberto_em && new Date(p.criado_em) >= new Date(caixa.aberto_em))
    );
  });
  const pedidosConfirmados = activeAndCompletedOrders.filter(isPedidoFaturado);
  const pedidosAFaturar = activeAndCompletedOrders.filter((p) => !isPedidoFaturado(p));

  const totalFaturamento = pedidosConfirmados.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const totalAFaturar = pedidosAFaturar.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);

  const ticketMedio = pedidosConfirmados.length > 0
    ? totalFaturamento / pedidosConfirmados.length
    : 0;

  // Breakdown by channel - somente faturados/confirmados com normalização universal de salão
  const deliveryOrders = pedidosConfirmados.filter((p) => p && p.tipo === 'delivery');
  const salaoOrders = pedidosConfirmados.filter((p) => p && isSalaoPedido(p));
  const retiradaOrders = pedidosConfirmados.filter((p) => p && (p.tipo === 'retirada' || (p.tipo as string) === 'balcão' || (p.tipo as string) === 'balcao'));

  const faturamentoDelivery = deliveryOrders.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const faturamentoSalao = salaoOrders.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const faturamentoRetirada = retiradaOrders.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const totalTaxasEntrega = deliveryOrders.reduce((acc, p) => acc + (Number(p.taxa_entrega) || 0), 0);

  // Pedidos a faturar por canal
  const deliveryAFaturar = pedidosAFaturar.filter((p) => p && p.tipo === 'delivery');
  const salaoAFaturar = pedidosAFaturar.filter((p) => p && isSalaoPedido(p));
  const retiradaAFaturar = pedidosAFaturar.filter((p) => p && (p.tipo === 'retirada' || (p.tipo as string) === 'balcão' || (p.tipo as string) === 'balcao'));

  // Payment totals for 3D Pie Chart com blindagem contra valores indefinidos ou nulos
  const paymentSlices = useMemo(() => {
    try {
      if (!pedidosConfirmados || !Array.isArray(pedidosConfirmados)) return [];
      
      const CANONICAL_CONFIG: Record<string, { label: string; color: string; darkColor: string }> = {
        pix: { label: 'PIX', color: '#06b6d4', darkColor: '#0e7490' },
        dinheiro: { label: 'DINHEIRO', color: '#10b981', darkColor: '#047857' },
        cartao_credito: { label: 'CRÉDITO', color: '#f59e0b', darkColor: '#b45309' },
        cartao_debito: { label: 'DÉBITO', color: '#3b82f6', darkColor: '#1d4ed8' },
        vale_refeicao: { label: 'VALE REFEIÇÃO', color: '#8b5cf6', darkColor: '#6d28d9' },
        mensalista: { label: 'MENSALISTA', color: '#ec4899', darkColor: '#be185d' },
        outro: { label: 'OUTROS', color: '#64748b', darkColor: '#334155' },
      };

      const totals: Record<string, number> = {};
      pedidosConfirmados.forEach((p) => {
        if (!p) return;
        if (p && p.pagamentos && Array.isArray(p.pagamentos) && p.pagamentos.length > 0) {
          p.pagamentos.forEach((pg) => {
            if (pg && pg.valor && Number(pg.valor) > 0) {
              const raw = (pg.forma || 'outro').toLowerCase();
              let key = 'outro';
              if (raw.includes('pix')) key = 'pix';
              else if (raw.includes('dinheiro')) key = 'dinheiro';
              else if (raw.includes('credito') || raw.includes('crédito')) key = 'cartao_credito';
              else if (raw.includes('debito') || raw.includes('débito')) key = 'cartao_debito';
              else if (raw.includes('vale') || raw.includes('refeicao')) key = 'vale_refeicao';
              else if (raw.includes('mensal')) key = 'mensalista';
              else key = raw;
              totals[key] = (totals[key] || 0) + Number(pg.valor);
            }
          });
        } else if (p && p.forma_pagamento && Number(p.valor_total) > 0) {
          const raw = (p.forma_pagamento || 'outro').toLowerCase();
          let key = 'outro';
          if (raw.includes('pix')) key = 'pix';
          else if (raw.includes('dinheiro')) key = 'dinheiro';
          else if (raw.includes('credito') || raw.includes('crédito')) key = 'cartao_credito';
          else if (raw.includes('debito') || raw.includes('débito')) key = 'cartao_debito';
          else if (raw.includes('vale') || raw.includes('refeicao')) key = 'vale_refeicao';
          else if (raw.includes('mensal')) key = 'mensalista';
          else key = raw;
          totals[key] = (totals[key] || 0) + Number(p.valor_total);
        }
      });

      // Se houver movimentações de recebimento de mensalista no caixa hoje, inclui nas fatias de pagamento
      if (caixa && Array.isArray(caixa.movimentacoes)) {
        caixa.movimentacoes.forEach((m: any) => {
          if (m && m.tipo === 'suprimento' && m.descricao && m.descricao.toUpperCase().includes('MENSALISTA') && Number(m.valor) > 0) {
            const raw = (m.forma || 'pix').toLowerCase();
            let key = 'pix';
            if (raw.includes('dinheiro')) key = 'dinheiro';
            else if (raw.includes('credito') || raw.includes('crédito')) key = 'cartao_credito';
            else if (raw.includes('debito') || raw.includes('débito')) key = 'cartao_debito';
            else if (raw.includes('vale') || raw.includes('refeicao')) key = 'vale_refeicao';
            totals[key] = (totals[key] || 0) + Number(m.valor);
          }
        });
      }

      const totalGeral = Object.values(totals).reduce((sum, v) => sum + v, 0);
      return Object.entries(totals)
        .filter(([_, val]) => val > 0)
        .map(([key, val]) => {
          const cfg = CANONICAL_CONFIG[key] || { label: key.toUpperCase(), color: '#64748b', darkColor: '#334155' };
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
    } catch (err) {
      console.warn("Erro recuperado em paymentSlices:", err);
      return [];
    }
  }, [pedidosConfirmados, caixa?.movimentacoes]);

  // Tables metrics & 20 tables mapping
  const ocupadas = safeMesas.filter((m) => m && m.status === 'ocupada').length;
  const conta = safeMesas.filter((m) => m && m.status === 'conta').length;
  const livres = safeMesas.filter((m) => m && m.status === 'livre').length;
  const taxaOcupacao = safeMesas.length > 0 ? Math.round(((ocupadas + conta) / safeMesas.length) * 100) : 0;

  // Complete 20-table grid representation for Command Center & Hospitality
  const all20Mesas = useMemo(() => {
    const map = new Map<number, Mesa>();
    safeMesas.forEach((m) => {
      if (m && m.numero) map.set(Number(m.numero), m);
    });
    return Array.from({ length: 20 }, (_, i) => {
      const num = i + 1;
      return (
        map.get(num) || {
          id: num,
          numero: num,
          status: 'livre' as const,
          pessoas: 2,
        }
      );
    });
  }, [safeMesas]);

  // Total guests dining in restaurant right now
  const totalPessoasNoSalao = useMemo(() => {
    return safeMesas
      .filter((m) => m && (m.status === 'ocupada' || m.status === 'conta'))
      .reduce((sum, m) => sum + (Number(m.pessoas) || 2), 0);
  }, [safeMesas]);

  // Kitchen KDS metrics
  const pendentesKds = safePedidos.filter((p) => p && p.status === 'pendente').length;
  const emPreparoKds = safePedidos.filter((p) => p && p.status === 'em_preparacao').length;
  const prontosKds = safePedidos.filter((p) => p && p.status === 'pronto').length;

  // Delivery operational metrics
  const deliveryProntosSaida = safePedidos.filter((p) => p && p.tipo === 'delivery' && p.status === 'pronto');
  const deliveryEmRota = safePedidos.filter((p) => p && p.tipo === 'delivery' && p.status === 'a_caminho');
  const deliveryAguardandoPreparo = safePedidos.filter(
    (p) => p && p.tipo === 'delivery' && (p.status === 'pendente' || p.status === 'em_preparacao')
  );

  // Chronological order feed for Shopify layout
  const recentOrdersFeed = useMemo(() => {
    return [...safePedidos]
      .filter((p) => p && p.status !== 'cancelado')
      .sort((a, b) => {
        const timeA = a.criado_em ? new Date(a.criado_em).getTime() : a.id || 0;
        const timeB = b.criado_em ? new Date(b.criado_em).getTime() : b.id || 0;
        return timeB - timeA;
      });
  }, [safePedidos]);

  const filteredRecentOrders = useMemo(() => {
    if (!shopifyFeedSearch.trim()) return recentOrdersFeed.slice(0, 15);
    const q = shopifyFeedSearch.toLowerCase().trim();
    return recentOrdersFeed.filter(
      (p) =>
        String(p.id).includes(q) ||
        (p.cliente?.nome && p.cliente.nome.toLowerCase().includes(q)) ||
        (p.tipo && p.tipo.toLowerCase().includes(q))
    ).slice(0, 25);
  }, [recentOrdersFeed, shopifyFeedSearch]);

  // Stock alerts
  const criticalStockItems = safeEstoque.filter(
    (it) => it && typeof it.quantidade_atual === 'number' && it.quantidade_atual <= it.estoque_minimo && !dismissedStockAlerts.includes(it.id)
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
  const mensalistas = safeClientes.filter((c) => c && (c.eh_mensalista || (c.saldo_devedor && c.saldo_devedor > 0)));
  const totalDevedorMensalistas = mensalistas.reduce((acc, c) => acc + (Number(c.saldo_devedor) || 0), 0);

  // Cash in drawer
  let dinheiroGaveta = Number(caixa?.valor_abertura) || 0;
  if (caixa && Array.isArray(caixa.movimentacoes)) {
    caixa.movimentacoes.forEach((m: any) => {
      if (m && typeof m.valor === 'number' && !isNaN(m.valor)) {
        const rawForma = (m.forma || 'dinheiro').toLowerCase();
        if (rawForma.includes('dinheiro') || !m.forma) {
          if (m.tipo === 'suprimento') dinheiroGaveta += m.valor;
          if (m.tipo === 'sangria') dinheiroGaveta -= m.valor;
        }
      }
    });
  }

  if (Array.isArray(pedidosConfirmados)) {
    pedidosConfirmados.forEach((p) => {
      if (!p) return;
      if (Array.isArray(p.pagamentos)) {
        p.pagamentos.forEach((pg) => {
          if (pg && typeof pg.valor === 'number' && !isNaN(pg.valor)) {
            const raw = (pg.forma || '').toLowerCase();
            if (raw.includes('dinheiro')) {
              dinheiroGaveta += pg.valor;
            }
          }
        });
      } else if (p.forma_pagamento && typeof p.valor_total === 'number' && !isNaN(p.valor_total)) {
        const raw = (p.forma_pagamento || '').toLowerCase();
        if (raw.includes('dinheiro')) {
          dinheiroGaveta += p.valor_total;
        }
      }
    });
  }

  // Semáforo da Operação
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

  // Reusable 3D Donut Chart Component
  const render3DDonutChart = (compact = false) => {
    if (paymentSlices.length === 0) {
      return (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-700 flex items-center justify-center bg-neutral-900/50">
            <PieChart className="w-8 h-8 text-neutral-600" />
          </div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
            Aguardando primeiras vendas do dia
          </span>
        </div>
      );
    }

    return (
      <div className={`grid grid-cols-1 ${compact ? 'gap-4' : 'md:grid-cols-12 gap-6'} items-center`}>
        {/* 3D SVG Donut */}
        <div className={`${compact ? '' : 'md:col-span-6'} flex justify-center py-2`}>
          <div style={{ perspective: '700px' }}>
            <div
              style={{
                transform: 'rotateX(26deg)',
                transformStyle: 'preserve-3d',
                filter: 'drop-shadow(0 16px 14px rgba(0,0,0,0.75))',
              }}
            >
              <svg width="240" height="230" viewBox="0 0 240 230" className="overflow-visible select-none">
                {/* Camada Inferior Extrudada */}
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

                {/* Camada Superior */}
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

                {/* Centro Oco do Donut */}
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
        <div className={`${compact ? '' : 'md:col-span-6'} space-y-2`}>
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
    );
  };

  // Reusable Semáforo da Operação
  const renderSemaforo = () => (
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
  );

  // Reusable Emergency Kill Switches Bar
  const renderKillSwitches = () => (
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
  );

  // Reusable Cash Register Quick Bar
  const renderCaixaBar = () => (
    <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
      caixa?.status === 'aberto'
        ? 'bg-neutral-850 border-emerald-900/80'
        : 'bg-red-950/30 border-red-800/80'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl border ${
          caixa?.status === 'aberto'
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
              caixa?.status === 'aberto'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-red-950 text-red-300 border border-red-800'
            }`}>
              {caixa?.status === 'aberto' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {caixa?.status === 'aberto'
              ? `Aberto em ${caixa?.data_caixa || 'Hoje'} · Fundo inicial: ${formatBRL(caixa?.valor_abertura || 0)} · Dinheiro na gaveta: ${formatBRL(dinheiroGaveta)}`
              : 'O caixa está fechado no momento. Abra o caixa para iniciar as operações do dia.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {caixa?.status === 'aberto' ? (
          <button
            onClick={() => {
              const mesasAbertas = safeMesas.filter((m) => m && (m.status === 'ocupada' || m.status === 'conta'));
              const entregasPendentes = safePedidos.filter(
                (p) => p && p.tipo === 'delivery' && p.status !== 'cancelado' && p.conferencia_entrega !== 'conferido'
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
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 uppercase transition-colors shadow-sm cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            Fechar Caixa do Dia
          </button>
        ) : (
          <button
            onClick={() => setShowAbrirModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 uppercase transition-colors shadow-sm cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            Abrir Caixa do Dia
          </button>
        )}

        <button
          onClick={() => onNavigate('caixa')}
          className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          Ver Extrato
        </button>
      </div>
    </div>
  );

  // Senhas chamadas para o Mini Painel de Senhas (TV / Balcão)
  const senhasChamadas = useMemo(() => {
    const isBalcaoOuMesaOrder = (tipo: string) => {
      const t = (tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return t.includes('retirada') || t.includes('balcao') || t.includes('sal');
    };

    // Prioridade 1: Pedidos com status 'pronto' de Balcão e Salão
    const prontos = safePedidos
      .filter((p) => p && p.status === 'pronto' && isBalcaoOuMesaOrder(p.tipo))
      .sort((a, b) => new Date(b.atualizado_em || b.criado_em).getTime() - new Date(a.atualizado_em || a.criado_em).getTime());

    if (prontos.length > 0) return prontos;

    // Prioridade 2: Pedidos ativos de Balcão ou Salão (não cancelados e não delivery)
    const ativos = safePedidos
      .filter((p) => p && p.status !== 'cancelado' && !(p.tipo || '').toLowerCase().includes('delivery'))
      .sort((a, b) => new Date(b.atualizado_em || b.criado_em).getTime() - new Date(a.atualizado_em || a.criado_em).getTime());

    return ativos;
  }, [safePedidos]);

  // Mini Widget de Painel de Senhas (Chamadas em Tempo Real)
  const renderMiniPainelSenhas = () => {
    const atual = senhasChamadas[0] || null;
    const anteriores = senhasChamadas.slice(1, 4);

    const getLocalText = (p: Pedido) => {
      if ((p.tipo || '').toLowerCase().includes('sal') || p.mesa_id) {
        return `Mesa ${String(p.mesa_id || 1).padStart(2, '0')}`;
      }
      return 'Balcão';
    };

    const getNumeroSenha = (p: Pedido) => p.codigo_senha != null ? `#${p.codigo_senha}` : `#${p.id}`;

    return (
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Volume2 className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-wider text-neutral-200 uppercase font-mono">
                  PAINEL DE SENHAS (CHAMADAS)
                </h4>
                <p className="text-[10px] text-neutral-400 font-medium">Display digital LED de TV e balcão</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AO VIVO
            </span>
          </div>

          {/* Visor Digital LED Matriz / Segmentos */}
          {atual ? (
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 mb-3 text-center shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-neutral-900">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,1)]" />
                  CHAMANDO SENHA
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono font-bold uppercase tracking-wide">
                  {getLocalText(atual)}
                </span>
              </div>
              <div className="font-mono tracking-widest font-black text-3xl sm:text-4xl text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)] py-1.5">
                {getNumeroSenha(atual)}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 truncate font-mono">
                {atual.cliente?.nome || 'Cliente Balcão'} {atual.status === 'pronto' ? '• Pronto para retirada' : ''}
              </p>
            </div>
          ) : (
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 mb-3 text-center shadow-2xl">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-black text-emerald-400/70 uppercase tracking-widest mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400/50 animate-pulse" />
                PAINEL LED EM ESPERA
              </div>
              <div className="font-mono tracking-widest font-black text-2xl sm:text-3xl text-neutral-600 py-1">
                -- --
              </div>
              <span className="text-[10px] text-neutral-500 font-mono block mt-1">Aguardando chamada de pedidos</span>
            </div>
          )}

          {/* Histórico compacto das últimas 3 senhas chamadas em display digital âmbar */}
          {anteriores.length > 0 && (
            <div className="pt-2 border-t border-neutral-800/60 mb-3">
              <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase block mb-1.5 font-mono">
                ÚLTIMAS 3 CHAMADAS ANTERIORES:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {anteriores.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 rounded-xl bg-black border border-neutral-800 text-center shadow-inner"
                  >
                    <span className="block font-mono tracking-widest font-black text-sm sm:text-base text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                      {getNumeroSenha(p)}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-mono font-semibold uppercase truncate block mt-0.5">
                      {getLocalText(p)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('senhas' as any)}
          className="w-full mt-2 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <Tv className="w-4 h-4 text-amber-400" />
          <span>Abrir Painel de TV</span>
        </button>
      </div>
    );
  };

  // =========================================================================
  // 1. LAYOUT: STRIPE EXECUTIVE (Padrão Principal)
  // =========================================================================
  const renderStripeExecutiveLayout = () => (
    <div className="flex flex-col gap-6">
      {/* KPI Cards Strip com gradientes sutis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Hoje */}
        <div className="bg-gradient-to-br from-neutral-850 to-neutral-900 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between shadow-md relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">Faturamento Real (Auditado)</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono tabular-nums tracking-tight">
              {formatBRL(totalFaturamento)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>{pedidosConfirmados.length} pedidos faturados</span>
            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              Auditado no Caixa
            </span>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-gradient-to-br from-neutral-850 to-neutral-900 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between shadow-md relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Ticket Médio por Venda</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tabular-nums tracking-tight">
              {formatBRL(ticketMedio)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>Média por pedido</span>
            <span className="text-neutral-300 font-semibold">{pedidosConfirmados.length} vendas</span>
          </div>
        </div>

        {/* Taxa de Ocupação Salão */}
        <div className="bg-gradient-to-br from-neutral-850 to-neutral-900 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between shadow-md relative overflow-hidden group hover:border-cyan-500/50 transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">Ocupação do Salão</span>
            <Utensils className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono tabular-nums tracking-tight">
              {taxaOcupacao}%
            </span>
            <span className="text-xs font-mono text-neutral-400">({ocupadas + conta}/20 mesas)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>{livres} mesas livres</span>
            <button
              onClick={() => onNavigate('mesas')}
              className="text-cyan-400 hover:underline font-bold cursor-pointer"
            >
              Ver Salão →
            </button>
          </div>
        </div>

        {/* Dinheiro Físico no Caixa */}
        <div className="bg-gradient-to-br from-neutral-850 to-neutral-900 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between shadow-md relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-400">Gaveta Caixa (Físico)</span>
            <Banknote className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-black text-purple-400 font-mono tabular-nums tracking-tight">
              {formatBRL(dinheiroGaveta)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <span>Status: {caixa.status.toUpperCase()}</span>
            <button
              onClick={() => onNavigate('caixa')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Conferir no Caixa
            </button>
          </div>
        </div>
      </div>


      {/* Main Grid: Channels & Charts & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Channels & 3D Payment Donut (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Desempenho por Canal de Venda */}
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
                <span>Distribuição por Meio de Pagamento (Faturamento Real)</span>
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                {paymentSlices.length} {paymentSlices.length === 1 ? 'meio ativo' : 'meios ativos'}
              </span>
            </div>
            {render3DDonutChart()}
          </div>
        </div>

        {/* Right: KDS, Stock & Mensalistas (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
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
                className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
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
                className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
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
                {criticalStockItems.slice(0, 5).map((it) => (
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
                        <span>Ajuste</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluirAlerta(it)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-red-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                        title="Excluir alerta de estoque deste insumo"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
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
                className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
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

          {renderMiniPainelSenhas()}
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // 2. LAYOUT: COMMAND CENTER (Centro de Controle Operacional de Alta Densidade)
  // =========================================================================
  const renderCommandCenterLayout = () => (
    <div className="flex flex-col gap-6">
      {/* Top Operational Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-neutral-900 rounded-xl border border-cyan-800/60 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold">FATURAMENTO HOJE</span>
          <span className="text-xl font-mono font-black text-white tabular-nums my-1">{formatBRL(totalFaturamento)}</span>
          <span className="text-[10px] text-neutral-400">{pedidosConfirmados.length} auditados</span>
        </div>

        <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">A FATURAR / PENDENTE</span>
          <span className="text-xl font-mono font-black text-amber-400 tabular-nums my-1">{formatBRL(totalAFaturar)}</span>
          <span className="text-[10px] text-neutral-400">{pedidosAFaturar.length} comanda(s)</span>
        </div>

        <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">FILA KDS COZINHA</span>
          <span className="text-xl font-mono font-black text-emerald-400 tabular-nums my-1">{pendentesKds + emPreparoKds}</span>
          <span className="text-[10px] text-neutral-400">{prontosKds} prontos p/ saída</span>
        </div>

        <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-purple-400 font-bold">MESAS OCUPADAS</span>
          <span className="text-xl font-mono font-black text-purple-400 tabular-nums my-1">{ocupadas + conta} / 20</span>
          <span className="text-[10px] text-neutral-400">{livres} mesas livres</span>
        </div>

        <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-blue-400 font-bold">MOTOBOYS / DELIVERY</span>
          <span className="text-xl font-mono font-black text-blue-400 tabular-nums my-1">{deliveryProntosSaida.length + deliveryEmRota.length}</span>
          <span className="text-[10px] text-neutral-400">{deliveryEmRota.length} em trânsito</span>
        </div>

        <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-red-400 font-bold">ESTOQUE CRÍTICO</span>
          <span className="text-xl font-mono font-black text-red-400 tabular-nums my-1">{criticalStockItems.length}</span>
          <span className="text-[10px] text-neutral-400">insumos em alerta</span>
        </div>
      </div>

      {/* Grid: 20 Mesas Live Matrix (Left 7 cols) & KDS/Expedition Radar (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Operacional das 20 Mesas em Tempo Real */}
        <div className="lg:col-span-7 bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Matriz Operacional das 20 Mesas (Salão ao Vivo)
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {ocupadas + conta} mesas ocupadas · {totalPessoasNoSalao} convidados no salão · Clique na mesa para atendimento PDV
                </span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('mesas')}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 rounded-lg text-xs font-mono font-bold uppercase cursor-pointer"
            >
              Mapa Completo →
            </button>
          </div>

          {/* 20-Slot Table Matrix */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
            {all20Mesas.map((m) => {
              const isOccupied = m.status === 'ocupada';
              const isConta = m.status === 'conta';
              const isReserved = m.status === 'reservada';
              const isFree = m.status === 'livre';

              let borderBg = 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700 text-neutral-300';
              let badgeColor = 'bg-neutral-800 text-neutral-400';
              let statusLabel = 'LIVRE';

              if (isOccupied) {
                borderBg = 'border-amber-600/80 bg-amber-950/30 hover:border-amber-500 text-amber-200 ring-1 ring-amber-500/30';
                badgeColor = 'bg-amber-600 text-black font-black';
                statusLabel = 'OCUPADA';
              } else if (isConta) {
                borderBg = 'border-purple-600/80 bg-purple-950/30 hover:border-purple-500 text-purple-200 ring-1 ring-purple-500/30';
                badgeColor = 'bg-purple-600 text-white font-black';
                statusLabel = 'CONTA';
              } else if (isReserved) {
                borderBg = 'border-blue-600/80 bg-blue-950/30 text-blue-200';
                badgeColor = 'bg-blue-600 text-white font-bold';
                statusLabel = 'RESERVA';
              }

              return (
                <button
                  key={m.numero}
                  type="button"
                  onClick={() => onNavigate('pdv')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer hover:scale-105 active:scale-95 ${borderBg}`}
                  title={`Mesa ${m.numero}: ${statusLabel} ${m.cliente_nome ? `(${m.cliente_nome})` : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono">
                      MESA {String(m.numero).padStart(2, '0')}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-mono ${badgeColor}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-2 min-h-[28px] flex flex-col justify-end">
                    {isFree ? (
                      <span className="text-[10px] text-neutral-500 font-mono">Disponível</span>
                    ) : (
                      <span className="text-[10px] font-bold text-white uppercase truncate block font-sans">
                        {m.cliente_nome || `${m.pessoas || 2} pessoas`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legenda de Status */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-neutral-800 text-[10px] font-mono text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
              Livre ({livres})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              Ocupada ({ocupadas})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Pedindo Conta ({conta})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Taxa Ocupação: {taxaOcupacao}%
            </span>
          </div>
        </div>

        {/* Radar Operacional: KDS & Motoboys Expedição */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Fila do KDS Cozinha */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-md">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                  FILA DO KDS (COZINHA AO VIVO)
                </h3>
              </div>
              <button
                onClick={() => onNavigate('kds')}
                className="text-xs text-amber-400 hover:underline font-bold font-mono cursor-pointer"
              >
                Abrir KDS →
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center mb-3">
              <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-[9px] text-neutral-400 uppercase font-mono block">Fila</span>
                <span className="text-xl font-mono font-black text-amber-400">{pendentesKds}</span>
              </div>
              <div className="p-2.5 bg-amber-950/40 rounded-xl border border-amber-900/60">
                <span className="text-[9px] text-amber-300 uppercase font-mono block">Fogão</span>
                <span className="text-xl font-mono font-black text-amber-400">{emPreparoKds}</span>
              </div>
              <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-900/60">
                <span className="text-[9px] text-emerald-300 uppercase font-mono block">Prontos</span>
                <span className="text-xl font-mono font-black text-emerald-400">{prontosKds}</span>
              </div>
            </div>

            {/* Pedidos em espera na cozinha */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {safePedidos
                .filter((p) => p && (p.status === 'pendente' || p.status === 'em_preparacao'))
                .slice(0, 5)
                .map((p) => (
                  <div
                    key={p.id}
                    className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold text-[10px]">
                        #{p.id}
                      </span>
                      <span className="text-white truncate font-sans text-xs">
                        {isSalaoPedido(p) ? `Mesa ${p.mesa_id || '?'}` : p.cliente?.nome || 'Balcão'}
                      </span>
                    </div>
                    <span className="text-amber-400 font-bold shrink-0 text-[11px]">
                      {p.status === 'em_preparacao' ? 'Em Preparo' : 'Aguardando'}
                    </span>
                  </div>
                ))}
              {safePedidos.filter((p) => p && (p.status === 'pendente' || p.status === 'em_preparacao')).length === 0 && (
                <div className="py-4 text-center text-xs text-neutral-500 font-mono">
                  Cozinha zerada · Sem comandas em fila
                </div>
              )}
            </div>
          </div>

          {/* Expedição & Motoboys */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-md">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                  EXPEDIÇÃO DELIVERY & MOTOBOYS
                </h3>
              </div>
              <button
                onClick={() => onNavigate('caixa')}
                className="text-xs text-cyan-400 hover:underline font-bold font-mono cursor-pointer"
              >
                Conferência →
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center mb-3">
              <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-[9px] text-neutral-400 uppercase font-mono block">Cozinhando</span>
                <span className="text-xl font-mono font-black text-white">{deliveryAguardandoPreparo.length}</span>
              </div>
              <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-900/60">
                <span className="text-[9px] text-emerald-300 uppercase font-mono block">Aguardando Moto</span>
                <span className="text-xl font-mono font-black text-emerald-400">{deliveryProntosSaida.length}</span>
              </div>
              <div className="p-2.5 bg-cyan-950/40 rounded-xl border border-cyan-900/60">
                <span className="text-[9px] text-cyan-300 uppercase font-mono block">Em Trânsito</span>
                <span className="text-xl font-mono font-black text-cyan-400">{deliveryEmRota.length}</span>
              </div>
            </div>

            {/* Live deliveries */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {[...deliveryProntosSaida, ...deliveryEmRota].slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-between text-xs"
                >
                  <div className="truncate">
                    <span className="font-bold text-white uppercase block truncate">
                      #{p.id} · {p.cliente?.nome || 'Cliente Delivery'}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {p.cliente?.bairro || 'Piracicaba'} · {formatBRL(p.valor_total)}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    p.status === 'pronto' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}>
                    {p.status === 'pronto' ? 'PRONTO P/ MOTO' : 'EM ROTA'}
                  </span>
                </div>
              ))}
              {deliveryProntosSaida.length === 0 && deliveryEmRota.length === 0 && (
                <div className="py-3 text-center text-xs text-neutral-500 font-mono">
                  Nenhum motoboy em rota no momento
                </div>
              )}
            </div>
          </div>

          {renderMiniPainelSenhas()}
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // 3. LAYOUT: SHOPIFY MERCHANT (Feed Cronológico e Analítico em Colunas)
  // =========================================================================
  const renderShopifyMerchantLayout = () => (
    <div className="flex flex-col gap-6">
      {/* Top Merchant Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Total de Vendas Concluídas</span>
          <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums my-2">
            {formatBRL(totalFaturamento)}
          </span>
          <span className="text-[11px] text-neutral-400">{pedidosConfirmados.length} pedidos faturados hoje</span>
        </div>

        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Volume Total de Pedidos</span>
          <span className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums my-2">
            {safePedidos.filter((p) => p && p.status !== 'cancelado').length}
          </span>
          <span className="text-[11px] text-neutral-400">{pedidosAFaturar.length} comandas em aberto</span>
        </div>

        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Ticket Médio por Cliente</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums my-2">
            {formatBRL(ticketMedio)}
          </span>
          <span className="text-[11px] text-neutral-400">Média geral das comandas</span>
        </div>

        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Total Taxas de Entrega</span>
          <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tabular-nums my-2">
            {formatBRL(totalTaxasEntrega)}
          </span>
          <span className="text-[11px] text-neutral-400">{deliveryOrders.length} entregas concluídas</span>
        </div>
      </div>

      {/* 2-Column Merchant Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Feed Cronológico de Pedidos & Eventos em Tempo Real (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                Feed de Pedidos & Atividades ao Vivo
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300">
              {recentOrdersFeed.length} EVENTOS REGISTRADOS
            </span>
          </div>

          {/* Quick search inside feed */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={shopifyFeedSearch}
              onChange={(e) => setShopifyFeedSearch(e.target.value)}
              placeholder="BUSCAR PEDIDO POR #ID, NOME DO CLIENTE OU CANAL..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white uppercase placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Feed List */}
          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredRecentOrders.map((p) => {
              const isPaid = isPedidoFaturado(p);
              const itemsCount = p.itens?.length || 0;

              let typeIcon = <Store className="w-3.5 h-3.5 text-emerald-400" />;
              let typeLabel = 'BALCÃO';
              if (p.tipo === 'delivery') {
                typeIcon = <Bike className="w-3.5 h-3.5 text-amber-400" />;
                typeLabel = 'DELIVERY';
              } else if (isSalaoPedido(p)) {
                typeIcon = <Utensils className="w-3.5 h-3.5 text-cyan-400" />;
                typeLabel = `MESA ${p.mesa_id || '?'}`;
              }

              return (
                <div
                  key={p.id}
                  className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-white">#{p.id}</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {typeIcon}
                        <span>{typeLabel}</span>
                      </span>
                      {p.cliente?.nome && (
                        <span className="text-xs font-bold text-neutral-200 uppercase truncate max-w-[160px]">
                          {p.cliente.nome}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        isPaid
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {isPaid ? 'FATURADO' : 'PENDENTE'}
                      </span>
                      <span className="text-xs font-black text-amber-400 font-mono tabular-nums">
                        {formatBRL(p.valor_total)}
                      </span>
                    </div>
                  </div>

                  {/* Items preview snippet */}
                  {p.itens && p.itens.length > 0 && (
                    <p className="text-[11px] text-neutral-400 line-clamp-1 font-mono">
                      {p.itens.map((it) => `${it.quantidade}x ${it.produto_nome || 'Item'}`).join(' · ')}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-800/80">
                    <span>
                      {p.criado_em ? `Registrado às ${formatTime(p.criado_em)}` : 'Horário não informado'} · {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('caixa')}
                      className="text-amber-400 hover:underline font-bold cursor-pointer"
                    >
                      Ver no Caixa →
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredRecentOrders.length === 0 && (
              <div className="py-8 text-center text-xs text-neutral-500">
                Nenhum pedido encontrado no feed.
              </div>
            )}
          </div>
        </div>

        {/* Coluna 2: 3D Payment Donut & Desempenho por Canal (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <span>Meios de Pagamento Recebidos</span>
              </h3>
            </div>
            {render3DDonutChart(true)}
          </div>

          {/* Desempenho por Canal */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-neutral-800 pb-3 mb-3">
              Vendas por Canal de Distribuição
            </h3>
            <div className="space-y-2">
              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 font-bold text-neutral-300">
                  <Bike className="w-4 h-4 text-amber-500" /> Delivery Próprio
                </span>
                <span className="font-mono font-black text-white">{formatBRL(faturamentoDelivery)}</span>
              </div>
              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 font-bold text-neutral-300">
                  <Utensils className="w-4 h-4 text-cyan-500" /> Salão (Mesas)
                </span>
                <span className="font-mono font-black text-white">{formatBRL(faturamentoSalao)}</span>
              </div>
              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 font-bold text-neutral-300">
                  <Store className="w-4 h-4 text-emerald-500" /> Retirada Balcão
                </span>
                <span className="font-mono font-black text-white">{formatBRL(faturamentoRetirada)}</span>
              </div>
            </div>
          </div>

          {renderMiniPainelSenhas()}
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // 4. LAYOUT: HOSPITALITY MINIMALIST (Restaurante Boutique & Hospitalidade)
  // =========================================================================
  const renderHospitalityMinimalistLayout = () => (
    <div className="flex flex-col gap-6">
      {/* Hospitality Guest Care Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-850/80 p-5 rounded-2xl border border-neutral-800/80 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-300">Convidados no Salão</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-extralight text-white font-mono tracking-tight">
              {totalPessoasNoSalao}
            </span>
            <span className="text-xs text-neutral-400 ml-2 font-sans">pessoas sendo atendidas</span>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800">
            {ocupadas + conta} de 20 mesas em atendimento
          </div>
        </div>

        <div className="bg-neutral-850/80 p-5 rounded-2xl border border-neutral-800/80 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-300">Disponibilidade de Lugares</span>
            <Coffee className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extralight text-emerald-400 font-mono tracking-tight">
              {livres}
            </span>
            <span className="text-xs text-neutral-400 font-sans">mesas prontas para receber</span>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800">
            Ocupação atual: {taxaOcupacao}%
          </div>
        </div>

        <div className="bg-neutral-850/80 p-5 rounded-2xl border border-neutral-800/80 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-300">Ticket Médio Salão</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-extralight text-white font-mono tracking-tight">
              {formatBRL(ticketMedio)}
            </span>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800">
            Experiência gastronômica por comanda
          </div>
        </div>

        <div className="bg-neutral-850/80 p-5 rounded-2xl border border-neutral-800/80 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-300">Faturamento Realizado</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-extralight text-amber-400 font-mono tracking-tight">
              {formatBRL(totalFaturamento)}
            </span>
          </div>
          <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800">
            {pedidosConfirmados.length} contas liquidadas hoje
          </div>
        </div>
      </div>

      {/* Grid: Salão Ativo & Cardápio do Chef em Destaque */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mesas Ativas em Atendimento (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-850/80 p-6 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                Experiência no Salão · Mesas em Atendimento
              </h3>
            </div>
            <button
              onClick={() => onNavigate('mesas')}
              className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              Abrir Salão →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {safeMesas
              .filter((m) => m && (m.status === 'ocupada' || m.status === 'conta'))
              .map((m) => (
                <div
                  key={m.numero}
                  className="p-4 bg-neutral-900/80 rounded-xl border border-neutral-800 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white font-mono">
                      MESA {String(m.numero).padStart(2, '0')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                      m.status === 'conta' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {m.status === 'conta' ? 'Pedindo Conta' : 'Ocupada'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400">
                    <span className="text-neutral-200 font-semibold uppercase block truncate">
                      {m.cliente_nome || 'Mesa Reservada'}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      👥 {m.pessoas || 2} convidados
                    </span>
                  </div>
                </div>
              ))}
            {safeMesas.filter((m) => m && (m.status === 'ocupada' || m.status === 'conta')).length === 0 && (
              <div className="col-span-2 py-8 text-center text-xs text-neutral-500">
                Todas as 20 mesas do salão estão livres e higienizadas no momento.
              </div>
            )}
          </div>
        </div>

        {/* Cardápio do Chef / Menu do Dia (5 cols) */}
        <div className="lg:col-span-5 bg-neutral-850/80 p-6 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                Cardápio do Dia · Especiais do Chef
              </h3>
            </div>
            <button
              onClick={() => onNavigate('cardapio-dia')}
              className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              Ajustar Menu →
            </button>
          </div>

          <div className="p-4 bg-neutral-900/80 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase">Status do Cardápio:</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                isCardapioAtivo ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {isCardapioAtivo ? 'PUBLICADO' : 'RASCUNHO'}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {cardapioEfetivo?.itens && cardapioEfetivo.itens.length > 0
                ? `${cardapioEfetivo.itens.length} pratos e marmitex cadastrados para hoje no cardápio.`
                : 'Pratos do dia prontos para montagem e venda.'}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Distribuição Financeira Serena:
            </h4>
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between text-xs">
              <span className="text-neutral-400">Salão & Mesas</span>
              <span className="font-mono text-white font-bold">{formatBRL(faturamentoSalao)}</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between text-xs">
              <span className="text-neutral-400">Delivery Próprio</span>
              <span className="font-mono text-white font-bold">{formatBRL(faturamentoDelivery)}</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between text-xs">
              <span className="text-neutral-400">Retirada Balcão</span>
              <span className="font-mono text-white font-bold">{formatBRL(faturamentoRetirada)}</span>
            </div>
          </div>

          {renderMiniPainelSenhas()}
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // 5. LAYOUT: MODULAR GRID (Painel BI com Blocos Analíticos)
  // =========================================================================
  const renderModularGridLayout = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Bloco 1: Faturamento & Performance Financeira */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                1. PERFORMANCE FINANCEIRA
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">AUDITADO</span>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-mono block">FATURAMENTO CONFIRMADO</span>
              <span className="text-3xl font-black text-amber-400 font-mono tabular-nums">
                {formatBRL(totalFaturamento)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase block font-mono">A Faturar</span>
                <span className="font-bold text-amber-300 font-mono">{formatBRL(totalAFaturar)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase block font-mono">Ticket Médio</span>
                <span className="font-bold text-white font-mono">{formatBRL(ticketMedio)}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('caixa')}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono font-bold uppercase border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Abrir Módulo Caixa</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bloco 2: Cozinha KDS & Produção */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                2. COZINHA & KDS
              </h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 font-bold">AO VIVO</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center my-3">
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[9px] text-neutral-400 uppercase font-mono block">Fila</span>
              <span className="text-2xl font-mono font-black text-amber-400">{pendentesKds}</span>
            </div>
            <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-900/60">
              <span className="text-[9px] text-amber-300 uppercase font-mono block">Preparo</span>
              <span className="text-2xl font-mono font-black text-amber-400">{emPreparoKds}</span>
            </div>
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-900/60">
              <span className="text-[9px] text-emerald-300 uppercase font-mono block">Prontos</span>
              <span className="text-2xl font-mono font-black text-emerald-400">{prontosKds}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('kds')}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono font-bold uppercase border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Abrir KDS Cozinha</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bloco 3: Salão & Mesas (20 Mesas) */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                3. SALÃO & MESAS
              </h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">{taxaOcupacao}% OCUPADO</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-neutral-900 rounded-xl flex justify-between items-center">
              <span className="text-neutral-400">Mesas Ocupadas:</span>
              <span className="font-mono font-bold text-amber-400">{ocupadas} mesas</span>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl flex justify-between items-center">
              <span className="text-neutral-400">Pedindo Conta:</span>
              <span className="font-mono font-bold text-purple-400">{conta} mesas</span>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl flex justify-between items-center">
              <span className="text-neutral-400">Mesas Livres:</span>
              <span className="font-mono font-bold text-emerald-400">{livres} de 20 mesas</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('mesas')}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono font-bold uppercase border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Gerenciar Salão</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bloco 4: Meios de Pagamento (3D Pie / Donut) */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                4. FORMAS DE PAGAMENTO
              </h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 font-bold">{paymentSlices.length} MEIOS</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {paymentSlices.map((s) => (
              <div key={s.id} className="p-2 bg-neutral-900 rounded-xl flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-bold text-neutral-200 uppercase">{s.label}</span>
                </div>
                <div className="font-mono">
                  <span className="text-neutral-400 mr-2">{s.percent.toFixed(0)}%</span>
                  <span className="font-bold text-white">{formatBRL(s.valor)}</span>
                </div>
              </div>
            ))}
            {paymentSlices.length === 0 && (
              <div className="py-6 text-center text-xs text-neutral-500 font-mono">
                Sem recebimentos registrados hoje
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onNavigate('caixa')}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono font-bold uppercase border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Conferência de Caixa</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bloco 5: Delivery & Logística */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                5. LOGÍSTICA DELIVERY
              </h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 font-bold">{deliveryOrders.length} CONCLUÍDOS</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-neutral-900 rounded-xl flex justify-between items-center">
              <span className="text-neutral-400">Faturado em Entregas:</span>
              <span className="font-mono font-bold text-amber-400">{formatBRL(faturamentoDelivery)}</span>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl flex justify-between items-center">
              <span className="text-neutral-400">Taxas Arrecadadas:</span>
              <span className="font-mono font-bold text-emerald-400">{formatBRL(totalTaxasEntrega)}</span>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl flex justify-between items-center">
              <span className="text-neutral-400">Em Trânsito com Motoboy:</span>
              <span className="font-mono font-bold text-cyan-400">{deliveryEmRota.length} pedidos</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('caixa')}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono font-bold uppercase border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Conferir Entregas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bloco 6: Estoque & Insumos */}
      <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                6. ESTOQUE & INSUMOS
              </h3>
            </div>
            <span className={`text-[10px] font-mono font-bold ${
              criticalStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {criticalStockItems.length > 0 ? `${criticalStockItems.length} ALERTAS` : 'EM DIA'}
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {criticalStockItems.slice(0, 4).map((it) => (
              <div key={it.id} className="p-2 bg-red-950/30 border border-red-800/60 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-white uppercase truncate max-w-[150px]">{it.item_nome}</span>
                <span className="font-mono text-red-300 text-[11px] font-bold">
                  {it.quantidade_atual} {it.unidade_medida}
                </span>
              </div>
            ))}
            {criticalStockItems.length === 0 && (
              <div className="py-6 text-center text-xs text-emerald-400 font-mono flex items-center justify-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>Níveis de estoque controlados</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onNavigate('estoque')}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono font-bold uppercase border border-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Gerenciar Estoque</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bloco 7: Mini Painel de Senhas (TV e Chamadas) */}
      {renderMiniPainelSenhas()}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner com Seletor Direto de Layout FIFA */}
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
            onClick={() => onNavigate('caixa')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 uppercase cursor-pointer"
            title="Abrir módulo do caixa diário e conferência"
          >
            <Banknote className="w-4 h-4" />
            <span>Caixa</span>
          </button>

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
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 uppercase cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>Novo Pedido (PDV)</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE LAYOUT VISUAL (5 ESTILOS FIFA) */}
      <div className="bg-neutral-850 p-3.5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-neutral-300">
          <LayoutDashboard className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Layout da Dashboard:</span>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {[
            { id: 'stripe' as DashboardLayoutTipo, label: '🥇 Stripe Executive', icon: LayoutDashboard },
            { id: 'command' as DashboardLayoutTipo, label: '⚡ Command Center', icon: Terminal },
            { id: 'shopify' as DashboardLayoutTipo, label: '📦 Shopify Merchant', icon: ShoppingCart },
            { id: 'minimalist' as DashboardLayoutTipo, label: '🍃 Hospitality', icon: Coffee },
            { id: 'modular' as DashboardLayoutTipo, label: '🧩 Modular Grid', icon: Grid3X3 },
          ].map((lo) => {
            const isSelected = layoutAtual === lo.id;
            const Icon = lo.icon;
            return (
              <button
                key={lo.id}
                type="button"
                onClick={() => handleSelectLayout(lo.id)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-black font-black shadow-md scale-105'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                }`}
                title={`Alternar para layout ${lo.label}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lo.label}</span>
                {isSelected && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}
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

      {/* Semáforo da Operação */}
      {renderSemaforo()}

      {/* Controle de Caixa Diário */}
      {renderCaixaBar()}

      {/* Emergency Kill Switches */}
      {renderKillSwitches()}

      {/* RENDERIZAÇÃO CONDICIONAL DOS 5 LAYOUTS */}
      {layoutAtual === 'stripe' && renderStripeExecutiveLayout()}
      {layoutAtual === 'command' && renderCommandCenterLayout()}
      {layoutAtual === 'shopify' && renderShopifyMerchantLayout()}
      {layoutAtual === 'minimalist' && renderHospitalityMinimalistLayout()}
      {layoutAtual === 'modular' && renderModularGridLayout()}

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
                className="text-neutral-400 hover:text-white cursor-pointer"
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
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
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
                className="text-neutral-400 hover:text-white cursor-pointer"
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
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
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
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
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

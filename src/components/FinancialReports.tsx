import React, { useState, useMemo } from 'react';
import {
  Pedido,
  CaixaDiario,
  Cliente,
  ConfiguracoesSistema,
} from '../types';
import { formatBRL, formatTime, isSalaoPedido } from '../utils/formatters';
import {
  FileText,
  DollarSign,
  Calendar,
  Printer,
  Download,
  CreditCard,
  Banknote,
  Bike,
  Utensils,
  Store,
  PieChart,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FinancialReportsProps {
  pedidos: Pedido[];
  caixa: CaixaDiario;
  clientes: Cliente[];
  configuracoes?: ConfiguracoesSistema;
  onPrintThermalReceipt?: (pedido: any) => void;
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({
  pedidos = [],
  caixa,
  clientes = [],
  configuracoes,
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoje' | 'ontem' | '7dias' | 'mes'>('hoje');
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Filtro de data flexível
  const hojeIso = new Date().toISOString().split('T')[0];
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (!p || p.status === 'cancelado') return false;
      const dataPed = (p.criado_em || '').split('T')[0] || hojeIso;

      if (periodoFiltro === 'hoje') {
        return dataPed === (caixa?.data_caixa || hojeIso);
      }
      if (periodoFiltro === 'ontem') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return dataPed === d.toISOString().split('T')[0];
      }
      if (periodoFiltro === '7dias') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return dataPed >= d.toISOString().split('T')[0];
      }
      if (periodoFiltro === 'mes') {
        return dataPed.startsWith(hojeIso.slice(0, 7));
      }
      return true;
    });
  }, [pedidos, periodoFiltro, caixa?.data_caixa, hojeIso]);

  // Regra de Faturamento: pedidos confirmados/conferidos
  const pedidosFaturados = pedidosFiltrados.filter((p) => {
    if (p.tipo === 'delivery') return p.conferencia_entrega === 'conferido';
    return (
      (p.pagamentos && p.pagamentos.some((pg) => Number(pg.valor) > 0)) ||
      p.pagamento_confirmado === true
    );
  });

  const totalFaturado = pedidosFaturados.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const totalTaxas = pedidosFaturados
    .filter((p) => p.tipo === 'delivery')
    .reduce((acc, p) => acc + (Number(p.taxa_entrega) || 0), 0);

  // Breakdown por Canais de Venda
  const canalDelivery = pedidosFaturados.filter((p) => p.tipo === 'delivery');
  const canalSalao = pedidosFaturados.filter((p) => isSalaoPedido(p));
  const canalBalcao = pedidosFaturados.filter(
    (p) => p.tipo === 'retirada' || (p.tipo as string) === 'balcao' || (p.tipo as string) === 'balcão'
  );

  const fatDelivery = canalDelivery.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const fatSalao = canalSalao.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  const fatBalcao = canalBalcao.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);

  // Breakdown por Formas de Pagamento
  const totaisPagamentos: Record<string, number> = {
    pix: 0,
    dinheiro: 0,
    cartao_debito: 0,
    cartao_credito: 0,
    vale_refeicao: 0,
    mensalista: 0,
  };

  pedidosFaturados.forEach((p) => {
    if (p.pagamentos && p.pagamentos.length > 0) {
      p.pagamentos.forEach((pg) => {
        const raw = (pg.forma || '').toLowerCase();
        if (raw.includes('pix')) totaisPagamentos.pix += Number(pg.valor);
        else if (raw.includes('dinheiro')) totaisPagamentos.dinheiro += Number(pg.valor);
        else if (raw.includes('debito') || raw.includes('débito')) totaisPagamentos.cartao_debito += Number(pg.valor);
        else if (raw.includes('credito') || raw.includes('crédito')) totaisPagamentos.cartao_credito += Number(pg.valor);
        else if (raw.includes('vale') || raw.includes('refeicao') || raw.includes('refeição')) totaisPagamentos.vale_refeicao += Number(pg.valor);
        else if (raw.includes('mensal')) totaisPagamentos.mensalista += Number(pg.valor);
      });
    }
  });

  // Movimentações de Suprimento e Sangria
  const suprimentos = (caixa?.movimentacoes || []).filter((m) => m.tipo === 'suprimento');
  const sangrias = (caixa?.movimentacoes || []).filter((m) => m.tipo === 'sangria');
  const totalSuprimentos = suprimentos.reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  const totalSangrias = sangrias.reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  const dinheiroEsperadoGaveta = (Number(caixa?.valor_abertura) || 0) + totaisPagamentos.dinheiro + totalSuprimentos - totalSangrias;

  // Exportação em PDF A4 alinhada ao topo
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const element = document.getElementById('relatorio-financeiro-print');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
      pdf.save(`Relatorio_Financeiro_Kaipira_${hojeIso}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header com Filtros de Período e Ações */}
      <div className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 mb-1">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Módulo de Gestão Financeira & DRE</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Relatórios de Fechamento & Canais
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Demonstrativo auditado de receitas, faturamento por meio de pagamento, sangrias e canais de venda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Período */}
          <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: 'ontem', label: 'Ontem' },
              { id: '7dias', label: '7 Dias' },
              { id: 'mes', label: 'Mês' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodoFiltro(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  periodoFiltro === p.id
                    ? 'bg-amber-500 text-black font-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPDF ? 'Gerando...' : 'Exportar PDF A4'}</span>
          </button>
        </div>
      </div>

      {/* Relatório Visual e Imprimível */}
      <div
        id="relatorio-financeiro-print"
        className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md space-y-6 text-white"
      >
        {/* Cabeçalho Oficial do Relatório */}
        <div className="border-b border-neutral-800 pb-4 text-center">
          <h3 className="text-lg font-black uppercase tracking-wider text-amber-400">
            {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            {configuracoes?.endereco || 'AVENIDA POMPÉIA, 1018 - PIRACICABIRIM'} - {configuracoes?.cidade || 'PIRACICABA'} - SP
          </p>
          <span className="inline-block mt-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs font-mono font-bold text-neutral-300">
            DEMONSTRATIVO CONSOLIDADO DO TURNO: {periodoFiltro.toUpperCase()} ({hojeIso})
          </span>
        </div>

        {/* 1. Balanço da Gaveta / Caixa Físico */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-500" />
            <span>1. Balanço do Caixa Físico (Gaveta em Dinheiro)</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase font-mono block">Fundo Inicial</span>
              <span className="text-base font-black text-white font-mono">{formatBRL(caixa?.valor_abertura || 0)}</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-emerald-400 uppercase font-mono block">(+) Dinheiro Entradas</span>
              <span className="text-base font-black text-emerald-400 font-mono">+{formatBRL(totaisPagamentos.dinheiro)}</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-cyan-400 uppercase font-mono block">(+) Suprimentos</span>
              <span className="text-base font-black text-cyan-400 font-mono">+{formatBRL(totalSuprimentos)}</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-red-400 uppercase font-mono block">(-) Sangrias/Retiradas</span>
              <span className="text-base font-black text-red-400 font-mono">-{formatBRL(totalSangrias)}</span>
            </div>
          </div>
          <div className="p-4 bg-neutral-900 rounded-xl border border-amber-500/30 flex justify-between items-center">
            <span className="text-xs font-black uppercase text-neutral-200">Saldo Esperado em Dinheiro na Gaveta:</span>
            <span className="text-xl font-black text-amber-400 font-mono tabular-nums">{formatBRL(dinheiroEsperadoGaveta)}</span>
          </div>
        </div>

        {/* 2. Faturamento por Meio de Pagamento */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-500" />
            <span>2. Faturamento por Forma de Pagamento (Auditado)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'PIX (Chave / QR Code)', val: totaisPagamentos.pix, color: 'text-cyan-400' },
              { label: 'Cartão de Débito', val: totaisPagamentos.cartao_debito, color: 'text-blue-400' },
              { label: 'Cartão de Crédito', val: totaisPagamentos.cartao_credito, color: 'text-amber-400' },
              { label: 'Vale Refeição / VR', val: totaisPagamentos.vale_refeicao, color: 'text-purple-400' },
              { label: 'Dinheiro (Espécie)', val: totaisPagamentos.dinheiro, color: 'text-emerald-400' },
              { label: 'Mensalistas (A Faturar)', val: totaisPagamentos.mensalista, color: 'text-pink-400' },
            ].map((fp, i) => (
              <div key={i} className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                <span className="font-bold text-neutral-300 uppercase">{fp.label}</span>
                <span className={`font-mono font-black ${fp.color} tabular-nums text-sm`}>{formatBRL(fp.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Desempenho por Canal de Venda */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span>3. Distribuição por Canal de Atendimento</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase">
                <Bike className="w-4 h-4 text-amber-500" />
                <span>Delivery Próprio</span>
              </div>
              <span className="text-xl font-black text-white font-mono">{formatBRL(fatDelivery)}</span>
              <span className="text-[11px] text-neutral-400 font-mono">{canalDelivery.length} entregas • Taxas: {formatBRL(totalTaxas)}</span>
            </div>

            <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase">
                <Utensils className="w-4 h-4 text-cyan-500" />
                <span>Salão (20 Mesas)</span>
              </div>
              <span className="text-xl font-black text-white font-mono">{formatBRL(fatSalao)}</span>
              <span className="text-[11px] text-neutral-400 font-mono">{canalSalao.length} comandas pagas</span>
            </div>

            <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase">
                <Store className="w-4 h-4 text-emerald-500" />
                <span>Retirada Balcão</span>
              </div>
              <span className="text-xl font-black text-white font-mono">{formatBRL(fatBalcao)}</span>
              <span className="text-[11px] text-neutral-400 font-mono">{canalBalcao.length} pedidos retirados</span>
            </div>
          </div>
        </div>

        {/* Resumo Geral Consolidado */}
        <div className="p-5 bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900 rounded-2xl border border-amber-500/40 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider block">FATURAMENTO BRUTO TOTAL</span>
            <span className="text-3xl font-black text-white font-mono">{formatBRL(totalFaturado)}</span>
          </div>
          <div className="text-right text-xs font-mono text-neutral-400">
            <span>{pedidosFaturados.length} pedidos auditados no período selecionado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

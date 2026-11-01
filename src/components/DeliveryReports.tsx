import React, { useState, useMemo } from 'react';
import { Pedido, ConfiguracoesSistema } from '../types';
import { formatBRL } from '../utils/formatters';
import {
  Bike,
  MapPin,
  Printer,
  Eye,
  UserCheck,
} from 'lucide-react';
import { imprimirRelatorioLimpo } from '../utils/printReport';

interface DeliveryReportsProps {
  pedidos: Pedido[];
  configuracoes?: ConfiguracoesSistema;
  onPrintThermal?: (conteudoHtml: string) => void;
}

interface AcertoMotoboy {
  nome: string;
  totalEntregas: number;
  totalTaxasDevidas: number;
  dinheiroCobradoNaMao: number;
  totalFaturadoOnlineOuMaquininha: number;
  saldoAcertoFinal: number; // dinheiroCobradoNaMao - totalTaxasDevidas
  pedidos: Pedido[];
}

export const DeliveryReports: React.FC<DeliveryReportsProps> = ({
  pedidos = [],
  configuracoes,
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoje' | 'ontem' | '7dias' | 'mes'>('hoje');
  const [modoVisualizacao, setModoVisualizacao] = useState(false);

  const hojeIso = new Date().toISOString().split('T')[0];

  // Filtro de pedidos delivery no período
  const entregasPeriodo = useMemo(() => {
    return pedidos.filter((p) => {
      if (!p || p.tipo !== 'delivery' || p.status === 'cancelado') return false;
      const dataPed = (p.criado_em || '').split('T')[0] || hojeIso;

      if (periodoFiltro === 'hoje') return dataPed === hojeIso;
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
  }, [pedidos, periodoFiltro, hojeIso]);

  // Cálculo consolidado de acerto por motoboy
  const consolidadoMotoboys = useMemo(() => {
    const mapa = new Map<string, AcertoMotoboy>();

    entregasPeriodo.forEach((p) => {
      const nome = (p.entregador_nome || 'NÃO ATRIBUÍDO').trim().toUpperCase();
      if (!mapa.has(nome)) {
        mapa.set(nome, {
          nome,
          totalEntregas: 0,
          totalTaxasDevidas: 0,
          dinheiroCobradoNaMao: 0,
          totalFaturadoOnlineOuMaquininha: 0,
          saldoAcertoFinal: 0,
          pedidos: [],
        });
      }

      const item = mapa.get(nome)!;
      item.totalEntregas += 1;
      item.totalTaxasDevidas += Number(p.taxa_entrega || 0);
      item.pedidos.push(p);

      // Checa quanto o motoboy recebeu em dinheiro físico na mão
      let valorDinheiroPedido = 0;
      if (p.pagamentos && p.pagamentos.length > 0) {
        p.pagamentos.forEach((pg) => {
          const forma = (pg.forma || '').toLowerCase();
          if (forma.includes('dinheiro')) {
            valorDinheiroPedido += Number(pg.valor || 0);
          } else {
            item.totalFaturadoOnlineOuMaquininha += Number(pg.valor || 0);
          }
        });
      } else if (p.forma_pagamento && (p.forma_pagamento as string).toLowerCase().includes('dinheiro')) {
        valorDinheiroPedido += Number(p.valor_total || 0);
      } else {
        item.totalFaturadoOnlineOuMaquininha += Number(p.valor_total || 0);
      }

      item.dinheiroCobradoNaMao += valorDinheiroPedido;
      item.saldoAcertoFinal = item.dinheiroCobradoNaMao - item.totalTaxasDevidas;
    });

    return Array.from(mapa.values()).sort((a, b) => b.totalEntregas - a.totalEntregas);
  }, [entregasPeriodo]);

  // Mapa de entregas por bairro de Piracicaba
  const entregasPorBairro = useMemo(() => {
    const mapaBairros: Record<string, { total: number; taxas: number; faturamento: number }> = {};
    entregasPeriodo.forEach((p) => {
      const bairro = (p.cliente?.bairro || (p as any).bairro || 'PIRACICABA').trim().toUpperCase();
      if (!mapaBairros[bairro]) {
        mapaBairros[bairro] = { total: 0, taxas: 0, faturamento: 0 };
      }
      mapaBairros[bairro].total += 1;
      mapaBairros[bairro].taxas += Number(p.taxa_entrega || 0);
      mapaBairros[bairro].faturamento += Number(p.valor_total || 0);
    });

    return Object.entries(mapaBairros)
      .map(([bairro, info]) => ({ bairro, ...info }))
      .sort((a, b) => b.total - a.total);
  }, [entregasPeriodo]);

  // Impressão Térmica do Fechamento do Motoboy
  const handlePrintAcertoMotoboy = (m: AcertoMotoboy) => {
    const printWindow = window.open('', '', 'width=380,height=600');
    if (!printWindow) return;

    const linhasPedidos = m.pedidos
      .map(
        (p) => `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
          <span>#${p.codigo_senha || p.id} - ${p.cliente?.bairro || 'PIRA'}</span>
          <span>${formatBRL(p.valor_total)} (Taxa: ${formatBRL(p.taxa_entrega || 0)})</span>
        </div>`
      )
      .join('');

    const htmlContent = `
      <html>
        <head>
          <title>Acerto - ${m.nome}</title>
          <style>
            body { font-family: monospace; width: 72mm; margin: 0; padding: 4mm; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">${configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}</div>
          <div class="center" style="font-size: 11px;">FECHAMENTO & ACERTO DE MOTOBOY</div>
          <div class="center" style="font-size: 11px;">DATA: ${hojeIso}</div>
          <div class="border"></div>
          <div class="bold" style="font-size: 13px;">ENTREGADOR: ${m.nome}</div>
          <div>TOTAL DE CORRIDAS: ${m.totalEntregas} entregas</div>
          <div class="border"></div>
          <div class="bold" style="font-size: 11px; margin-bottom: 4px;">LISTAGEM DE PEDIDOS:</div>
          ${linhasPedidos}
          <div class="border"></div>
          <div class="row">
            <span>(+) TOTAL TAXAS ENTREGADOR:</span>
            <span class="bold">${formatBRL(m.totalTaxasDevidas)}</span>
          </div>
          <div class="row">
            <span>(-) DINHEIRO RECEBIDO EM MÃOS:</span>
            <span class="bold">${formatBRL(m.dinheiroCobradoNaMao)}</span>
          </div>
          <div class="border"></div>
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>${m.saldoAcertoFinal >= 0 ? 'MOTOBOY DEVOLVE AO CAIXA:' : 'CAIXA PAGA AO MOTOBOY:'}</span>
            <span>${formatBRL(Math.abs(m.saldoAcertoFinal))}</span>
          </div>
          <div class="border"></div>
          <br/><br/>
          <div class="center" style="font-size: 10px;">___________________________________</div>
          <div class="center" style="font-size: 10px;">ASSINATURA DO ENTREGADOR</div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Superior & Filtros */}
      <div className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 mb-1">
            <Bike className="w-4 h-4 text-amber-500" />
            <span>Módulo de Logística & Expedição</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Acerto de Motoboys & Bairros
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Conferência de corridas, dinheiro recebido em mãos, taxas arrecadadas e mapa de entregas de Piracicaba.
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

          <div className="flex items-center gap-2">
            {/* Botão 1: Visualizar */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('area-conteudo-relatorio');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                setModoVisualizacao(true);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 border transition-all cursor-pointer ${
                modoVisualizacao
                  ? 'bg-amber-500 text-black border-amber-500 shadow-sm'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Visualizar</span>
            </button>

            {/* Botão 2: Imprimir (Gera PDF / Impressão Nativa sem oklch) */}
            <button
              type="button"
              onClick={() => {
                const element = document.getElementById('area-conteudo-relatorio');
                if (!element) return;
                imprimirRelatorioLimpo('Relatorio_Logistica_Motoboys_Kaipira', element.innerHTML);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal: 1. Cards de Acerto por Motoboy & 2. Tabela de Bairros */}
      <div
        id="area-conteudo-relatorio"
        className="pt-0 mt-0 grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Coluna Esquerda: Acerto Individual dos Motoboys (7 colunas) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-neutral-300 uppercase tracking-wider flex items-center gap-2 font-mono">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Conferência Individual por Entregador ({consolidadoMotoboys.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {consolidadoMotoboys.map((m) => (
              <div
                key={m.nome}
                className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col gap-4 hover:border-amber-500/40 transition-all"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase">{m.nome}</h4>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {m.totalEntregas} entregas finalizadas
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrintAcertoMotoboy(m)}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    title="Imprimir cupom de acerto na impressora térmica"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Imprimir Acerto</span>
                  </button>
                </div>

                {/* Métricas do Motoboy */}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase block">Taxas a Pagar</span>
                    <span className="text-sm font-black text-emerald-400">{formatBRL(m.totalTaxasDevidas)}</span>
                  </div>
                  <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase block">Dinheiro em Mãos</span>
                    <span className="text-sm font-black text-amber-400">{formatBRL(m.dinheiroCobradoNaMao)}</span>
                  </div>
                  <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase block">
                      {m.saldoAcertoFinal >= 0 ? 'Devolver p/ Caixa' : 'Caixa Paga'}
                    </span>
                    <span
                      className={`text-sm font-black ${
                        m.saldoAcertoFinal >= 0 ? 'text-cyan-400' : 'text-purple-400'
                      }`}
                    >
                      {formatBRL(Math.abs(m.saldoAcertoFinal))}
                    </span>
                  </div>
                </div>

                {/* Snippet com as últimas entregas */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase font-mono">
                    Últimas Corridas:
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {m.pedidos.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="p-1.5 bg-neutral-900/60 rounded-lg flex justify-between items-center text-[11px] font-mono text-neutral-300"
                      >
                        <span>
                          #{p.codigo_senha || p.id} • {p.cliente?.bairro || 'PIRACICABA'}
                        </span>
                        <span className="text-white font-bold">
                          {formatBRL(p.valor_total)} (Taxa: {formatBRL(p.taxa_entrega || 0)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {consolidadoMotoboys.length === 0 && (
              <div className="bg-neutral-850 p-8 rounded-2xl border border-neutral-800 text-center text-xs text-neutral-500 font-mono">
                Nenhuma entrega registrada no período selecionado.
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Mapa de Entregas por Bairro de Piracicaba (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-neutral-300 uppercase tracking-wider flex items-center gap-2 font-mono">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Entregas por Região / Bairro ({entregasPorBairro.length})</span>
            </h3>
          </div>

          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-md space-y-3">
            <div className="flex justify-between items-center text-xs pb-3 border-b border-neutral-800 font-mono text-neutral-400">
              <span>BAIRRO</span>
              <span>PEDIDOS / TAXAS</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 font-mono text-xs">
              {entregasPorBairro.map((b) => (
                <div
                  key={b.bairro}
                  className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white uppercase block">{b.bairro}</span>
                    <span className="text-[10px] text-neutral-400">
                      Total Faturado: {formatBRL(b.faturamento)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold block mb-0.5">
                      {b.total} {b.total === 1 ? 'pedido' : 'pedidos'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      Taxas: {formatBRL(b.taxas)}
                    </span>
                  </div>
                </div>
              ))}

              {entregasPorBairro.length === 0 && (
                <div className="py-8 text-center text-xs text-neutral-500 font-mono">
                  Sem dados de entrega por bairro no período.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

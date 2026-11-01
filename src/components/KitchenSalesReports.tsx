import React, { useState, useMemo } from 'react';
import { Pedido, Mesa, ItemEstoque, ConfiguracoesSistema, Produto } from '../types';
import { formatBRL, isSalaoPedido } from '../utils/formatters';
import {
  ChefHat,
  Utensils,
  Boxes,
  Award,
  Clock,
  Printer,
  Eye,
} from 'lucide-react';
import { imprimirRelatorioLimpo } from '../utils/printReport';

interface KitchenSalesReportsProps {
  pedidos: Pedido[];
  mesas?: Mesa[];
  estoque: ItemEstoque[];
  produtos?: Produto[];
  configuracoes?: ConfiguracoesSistema;
}

interface ItemCurvaABC {
  id: number | string;
  nome: string;
  quantidade: number;
  faturamentoTotal: number;
  percentualFaturamento: number;
  classificacao: 'A' | 'B' | 'C';
}

export const KitchenSalesReports: React.FC<KitchenSalesReportsProps> = ({
  pedidos = [],
  mesas = [],
  estoque = [],
  produtos = [],
  configuracoes,
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoje' | 'ontem' | '7dias' | 'mes'>('hoje');
  const [modoVisualizacao, setModoVisualizacao] = useState(false);

  const hojeIso = new Date().toISOString().split('T')[0];

  // Filtro temporal dos pedidos válidos (não cancelados)
  const pedidosValidos = useMemo(() => {
    return pedidos.filter((p) => {
      if (!p || p.status === 'cancelado') return false;
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

  // 1. CÁLCULO DA CURVA ABC DE PRODUTOS
  const { itensCurvaABC, totalFaturadoGeral } = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantidade: number; faturamentoTotal: number }>();
    let totalFat = 0;
    let totalQtd = 0;

    pedidosValidos.forEach((p) => {
      (p.itens || []).forEach((it) => {
        // Ignora metadados internos de entrega
        if ((it as any).nome === '__META_DELIVERY__' || (it as any).produto_nome === '__META_DELIVERY__') return;

        const chave = (it.produto_nome || 'Item Não Identificado').trim().toUpperCase();
        const qtd = Number(it.quantidade) || 1;
        const totalItem = (Number(it.preco_unitario) || 0) * qtd;

        totalFat += totalItem;
        totalQtd += qtd;

        if (!mapa.has(chave)) {
          mapa.set(chave, { nome: chave, quantidade: 0, faturamentoTotal: 0 });
        }
        const ref = mapa.get(chave)!;
        ref.quantidade += qtd;
        ref.faturamentoTotal += totalItem;
      });
    });

    // Ordenação decrescente por faturamento para classificar em A, B ou C
    const listaOrdenada = Array.from(mapa.values()).sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);

    let acumuladoPercent = 0;
    const resultado: ItemCurvaABC[] = listaOrdenada.map((item, idx) => {
      const perc = totalFat > 0 ? (item.faturamentoTotal / totalFat) * 100 : 0;
      acumuladoPercent += perc;

      // Curva ABC: A até 70%, B de 70% a 90%, C os 10% restantes
      let classificacao: 'A' | 'B' | 'C' = 'C';
      if (acumuladoPercent <= 70 || idx === 0) {
        classificacao = 'A';
      } else if (acumuladoPercent <= 90) {
        classificacao = 'B';
      }

      return {
        id: idx + 1,
        nome: item.nome,
        quantidade: item.quantidade,
        faturamentoTotal: item.faturamentoTotal,
        percentualFaturamento: perc,
        classificacao,
      };
    });

    return {
      itensCurvaABC: resultado,
      totalFaturadoGeral: totalFat,
      totalItensVendidos: totalQtd,
    };
  }, [pedidosValidos]);

  // 2. CONSUMO DO SALÃO / MESAS
  const relatorioSalao = useMemo(() => {
    const pedidosSalao = pedidosValidos.filter((p) => isSalaoPedido(p));
    const totalSalao = pedidosSalao.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
    const totalComandas = pedidosSalao.length;
    const ticketMedioSalao = totalComandas > 0 ? totalSalao / totalComandas : 0;

    // Horários de maior pico por faixa de hora
    const mapaHoras: Record<string, number> = {};
    pedidosSalao.forEach((p) => {
      if (p.criado_em) {
        const hora = new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit' }) + 'h';
        mapaHoras[hora] = (mapaHoras[hora] || 0) + 1;
      }
    });

    const picosOrdenados = Object.entries(mapaHoras)
      .map(([hora, total]) => ({ hora, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalSalao,
      totalComandas,
      ticketMedioSalao,
      picosOrdenados,
    };
  }, [pedidosValidos]);

  // 3. USO E ESTIMATIVA DE INSUMOS
  const estimativaInsumos = useMemo(() => {
    // Estimativa de consumo de insumos básicos com base nas marmitas e pratos caipiras
    const totalMarmitas = itensCurvaABC
      .filter((it) => it.nome.includes('MARMITEX') || it.nome.includes('EXECUTIV'))
      .reduce((acc, it) => acc + it.quantidade, 0);

    const totalFeijoadas = itensCurvaABC
      .filter((it) => it.nome.includes('FEIJOADA'))
      .reduce((acc, it) => acc + it.quantidade, 0);

    const totalFrango = itensCurvaABC
      .filter((it) => it.nome.includes('FRANGO'))
      .reduce((acc, it) => acc + it.quantidade, 0);

    const totalPorcos = itensCurvaABC
      .filter((it) => it.nome.includes('COSTELA') || it.nome.includes('TORRESMO') || it.nome.includes('BISTECA'))
      .reduce((acc, it) => acc + it.quantidade, 0);

    return {
      totalMarmitas,
      totalFeijoadas,
      totalFrango,
      totalPorcos,
    };
  }, [itensCurvaABC]);

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Superior & Filtros */}
      <div className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 mb-1">
            <ChefHat className="w-4 h-4 text-amber-500" />
            <span>Módulo de Performance Gastronômica</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Curva ABC, Salão & Insumos da Cozinha
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Classificação ABC dos pratos campeões de venda, pico de mesas no salão e impacto no estoque.
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
                imprimirRelatorioLimpo('Relatorio_CurvaABC_Cozinha_Kaipira', element.innerHTML);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Relatório Imprimível / Tela */}
      <div
        id="area-conteudo-relatorio"
        className="pt-0 mt-0 bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md space-y-6 text-white"
      >
        {/* Cabeçalho */}
        <div className="border-b border-neutral-800 pb-4 text-center">
          <h3 className="text-lg font-black uppercase tracking-wider text-amber-400">
            {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            CURVA ABC DE PRODUTOS & ANÁLISE DE CONSUMO DO SALÃO • {periodoFiltro.toUpperCase()} ({hojeIso})
          </p>
        </div>

        {/* CURVA ABC DE PRODUTOS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-2 font-mono">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Curva ABC dos Produtos Mais Vendidos ({itensCurvaABC.length} Itens)</span>
            </h4>
            <span className="text-xs font-mono text-neutral-400">
              Total Faturado em Itens: <strong className="text-white">{formatBRL(totalFaturadoGeral)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold uppercase">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Produto / Prato</th>
                  <th className="p-3 text-center">Classe</th>
                  <th className="p-3 text-right">Qtd Saída</th>
                  <th className="p-3 text-right">Total Faturado</th>
                  <th className="p-3 text-right">% Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80 bg-neutral-950/40">
                {itensCurvaABC.map((item, idx) => {
                  let badgeCor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                  if (item.classificacao === 'B') badgeCor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                  if (item.classificacao === 'C') badgeCor = 'bg-neutral-800 text-neutral-400 border-neutral-700';

                  return (
                    <tr key={item.nome} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="p-3 font-bold text-neutral-500">#{idx + 1}</td>
                      <td className="p-3 font-bold text-white uppercase font-sans">{item.nome}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${badgeCor}`}>
                          CLASSE {item.classificacao}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-amber-400">{item.quantidade} un</td>
                      <td className="p-3 text-right font-black text-white">{formatBRL(item.faturamentoTotal)}</td>
                      <td className="p-3 text-right text-neutral-400">{item.percentualFaturamento.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {itensCurvaABC.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-neutral-500">
                      Nenhum item vendido no período filtrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-400 pt-1 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <strong>Classe A:</strong> Campeões (70% do faturamento)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <strong>Classe B:</strong> Intermediários (20% do faturamento)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
              <strong>Classe C:</strong> Cauda longa (10% do faturamento)
            </span>
          </div>
        </div>

        {/* RELATÓRIO DO SALÃO & CRUZAMENTO DE ESTOQUE (2 COLUNAS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Coluna 1: Consumo do Salão / Mesas */}
          <div className="p-5 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-4">
            <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2 font-mono">
              <Utensils className="w-4 h-4 text-cyan-400" />
              <span>Consumo & Permanência no Salão (20 Mesas)</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase block">Ticket Médio Salão</span>
                <span className="text-base font-black text-cyan-400 tabular-nums">
                  {formatBRL(relatorioSalao.ticketMedioSalao)}
                </span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase block">Total Contas Salão</span>
                <span className="text-base font-black text-white tabular-nums">
                  {relatorioSalao.totalComandas} comandas
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-neutral-400 uppercase font-mono block">
                Horários de Maior Pico no Salão:
              </span>
              <div className="space-y-1.5">
                {relatorioSalao.picosOrdenados.slice(0, 4).map((pico) => (
                  <div
                    key={pico.hora}
                    className="p-2 bg-neutral-950 rounded-lg flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-neutral-300 font-bold flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Faixa das {pico.hora}
                    </span>
                    <span className="text-cyan-400 font-bold">{pico.total} pedidos registrados</span>
                  </div>
                ))}
                {relatorioSalao.picosOrdenados.length === 0 && (
                  <span className="text-xs text-neutral-500 font-mono">Sem dados de horário no período.</span>
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Estimativa de Insumos da Cozinha */}
          <div className="p-5 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-4">
            <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-2 font-mono">
              <Boxes className="w-4 h-4 text-amber-500" />
              <span>Estimativa de Baixas de Insumos da Cozinha</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase block">Embalagens Marmitex</span>
                <span className="text-base font-black text-amber-400 tabular-nums">
                  ~{estimativaInsumos.totalMarmitas} unidades
                </span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase block">Pratos Feijoada</span>
                <span className="text-base font-black text-emerald-400 tabular-nums">
                  {estimativaInsumos.totalFeijoadas} porções
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase font-mono block">
                Itens Críticos em Estoque Atual:
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {estoque
                  .filter((it) => it.quantidade_atual <= it.estoque_minimo)
                  .map((it) => (
                    <div
                      key={it.id}
                      className="p-1.5 bg-red-950/30 border border-red-900/60 rounded-lg flex justify-between items-center text-[11px] font-mono text-red-300"
                    >
                      <span className="truncate">{it.item_nome}</span>
                      <span className="font-bold">
                        {it.quantidade_atual} {it.unidade_medida} (Mín: {it.estoque_minimo})
                      </span>
                    </div>
                  ))}
                {estoque.filter((it) => it.quantidade_atual <= it.estoque_minimo).length === 0 && (
                  <div className="p-2 text-center text-xs text-emerald-400 font-mono">
                    Todos os insumos com estoque acima do mínimo.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

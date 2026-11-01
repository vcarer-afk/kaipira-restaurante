import React, { useState } from 'react';
import { Pedido, StatusPedido, Produto, ItemEstoque } from '../types';
import { formatTime, playAlertChime, isSalaoPedido } from '../utils/formatters';
import { ItemDeducaoCalculada, calcularDeducoesDoPedido } from '../utils/stockDeduction';
import { processarBaixaEstoquePedido } from '../services/supabaseClient';
import {
  Clock,
  ChefHat,
  Check,
  Printer,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  PackageCheck,
} from 'lucide-react';

interface KitchenKDSProps {
  pedidos: Pedido[];
  produtos?: Produto[];
  estoque?: ItemEstoque[];
  onUpdateStockItem?: (id: number, data: Partial<ItemEstoque>) => Promise<void>;
  onUpdateStatus: (
    id: number,
    status: StatusPedido,
    entregador?: string,
    estoque_baixado?: boolean
  ) => void;
  onPrintReceipt: (pedido: Pedido) => void;
}

interface ToastAlert {
  id: string;
  mensagem: string;
  tipo: 'alerta' | 'aviso';
}

export const KitchenKDS: React.FC<KitchenKDSProps> = ({
  pedidos,
  produtos,
  estoque = [],
  onUpdateStockItem,
  onUpdateStatus,
  onPrintReceipt,
}) => {
  // Helper para garantir exibição da descrição completa do produto em todas as telas
  const getProductDescription = (it: { produto_id?: number; produto_nome?: string }) => {
    if (it.produto_nome && !it.produto_nome.trim().startsWith('#') && !it.produto_nome.toLowerCase().startsWith('prod #')) {
      return it.produto_nome;
    }
    if (produtos && it.produto_id) {
      const match = produtos.find((p) => p.id === it.produto_id);
      if (match?.nome) return match.nome;
    }
    return it.produto_nome || `Item #${it.produto_id || '?'}`;
  };

  // IDs de pedidos confirmados como retirados para remoção imediata da lista do KDS
  const [retiradosLocais, setRetiradosLocais] = useState<number[]>([]);

  // Diálogo de confirmação para insumos zerados ou negativos
  const [pedidoPendenteConfirmacao, setPedidoPendenteConfirmacao] = useState<{
    pedido: Pedido;
    insumosCriticos: ItemDeducaoCalculada[];
    todasDeducoes: ItemDeducaoCalculada[];
  } | null>(null);

  // Alertas toast para avisos de estoque mínimo
  const [toastAlerts, setToastAlerts] = useState<ToastAlert[]>([]);

  const dismissToast = (id: string) => {
    setToastAlerts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filter only active kitchen orders excluding those already marked as withdrawn
  const activeOrders = pedidos.filter(
    (p) =>
      ['pendente', 'em_preparacao', 'pronto'].includes(p.status) &&
      !retiradosLocais.includes(p.id)
  );

  const pendentes = activeOrders.filter((p) => p.status === 'pendente');
  const emPreparo = activeOrders.filter((p) => p.status === 'em_preparacao');
  const prontos = activeOrders.filter((p) => p.status === 'pronto');

  const getElapsedTimeMinutes = (createdIso: string) => {
    const diffMs = Date.now() - new Date(createdIso).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  /**
   * Finaliza o pedido como pronto e atualiza a flag de idempotência estoque_baixado
   */
  const concluirPedidoPronto = (pedido: Pedido) => {
    onUpdateStatus(pedido.id, 'pronto', undefined, true);
    playAlertChime('ready');
    if (pedido.tipo === 'delivery') {
      setRetiradosLocais((prev) => [...prev, pedido.id]);
    }
  };

  /**
   * Executa a baixa das deduções de estoque após aprovação (ou direto se nenhum negativo)
   */
  const executarBaixaEstoqueConfirmada = async (dados: {
    pedido: Pedido;
    insumosCriticos: ItemDeducaoCalculada[];
    todasDeducoes: ItemDeducaoCalculada[];
  }) => {
    const { pedido, todasDeducoes } = dados;
    setPedidoPendenteConfirmacao(null);

    const novosAlertas: ToastAlert[] = [];

    // 1. Atualizar cada item de estoque no estado e Supabase
    for (const d of todasDeducoes) {
      const saldoAnterior = Number(d.quantidade_atual) || 0;
      const novoSaldo = Number((saldoAnterior - Number(d.quantidade_debitar)).toFixed(2));

      if (onUpdateStockItem) {
        await onUpdateStockItem(Number(d.item_estoque_id), { quantidade_atual: novoSaldo });
      }

      // Verificação de Estoque Mínimo (ficara_abaixo_minimo)
      if (d.ficara_abaixo_minimo) {
        novosAlertas.push({
          id: `min-${d.item_estoque_id}-${Date.now()}-${Math.random()}`,
          tipo: 'aviso',
          mensagem: `Atenção! Estoque mínimo alcançado para ${d.item_nome} (Restam: ${novoSaldo} ${d.unidade_medida}).`,
        });
      }
    }

    // 2. Persistir no Supabase através do motor de baixa
    await processarBaixaEstoquePedido(pedido.id, todasDeducoes);

    // 3. Disparar toasts de estoque mínimo
    if (novosAlertas.length > 0) {
      setToastAlerts((prev) => [...prev, ...novosAlertas]);
      setTimeout(() => {
        setToastAlerts((prev) => prev.slice(novosAlertas.length));
      }, 7000);
    }

    // 4. Conclui pedido como pronto
    concluirPedidoPronto(pedido);
  };

  const handleAdvanceStatus = async (pedido: Pedido) => {
    if (pedido.status === 'pendente') {
      onUpdateStatus(pedido.id, 'em_preparacao');
      return;
    }

    if (pedido.status === 'em_preparacao') {
      // 1. Verificação de idempotência: não processar baixa duas vezes no mesmo pedido
      if (pedido.estoque_baixado) {
        concluirPedidoPronto(pedido);
        return;
      }

      // 2. Calcular deduções do pedido pela Ficha Técnica, Revenda e Combos
      const todasDeducoes = calcularDeducoesDoPedido(pedido, produtos || [], estoque || []);

      // 3. Filtrar insumos zerados ou que ficarão negativos (ficara_negativo: true)
      const insumosCriticos = todasDeducoes.filter((d) => d.ficara_negativo);

      if (insumosCriticos.length > 0) {
        setPedidoPendenteConfirmacao({
          pedido,
          insumosCriticos,
          todasDeducoes,
        });
        return;
      }

      // Se nenhum insumo ficar negativo, executa a dedução imediatamente
      await executarBaixaEstoqueConfirmada({
        pedido,
        insumosCriticos: [],
        todasDeducoes,
      });
    }
  };

  const handleConfirmarRetirada = (pedido: Pedido) => {
    // Remove imediatamente da lista do KDS
    setRetiradosLocais((prev) => [...prev, pedido.id]);
    playAlertChime('ready');
    const novoStatus: StatusPedido = pedido.tipo === 'delivery' ? 'a_caminho' : 'entregue';
    onUpdateStatus(pedido.id, novoStatus);
  };

  const renderOrderCard = (p: Pedido) => {
    const mins = getElapsedTimeMinutes(p.criado_em);
    const isDelayed = mins >= 25;

    return (
      <div
        key={p.id}
        className={`bg-neutral-850 rounded-xl border flex flex-col justify-between overflow-hidden shadow-md transition-all ${
          isDelayed
            ? 'border-red-600/80 ring-1 ring-red-500/50'
            : p.status === 'em_preparacao'
            ? 'border-amber-600/60'
            : p.status === 'pronto'
            ? 'border-emerald-600/60'
            : 'border-neutral-700'
        }`}
      >
        {/* Card Header */}
        <div
          className={`px-3 py-2 flex items-center justify-between text-xs font-bold ${
            p.status === 'pronto'
              ? 'bg-emerald-950/80 text-emerald-300'
              : p.status === 'em_preparacao'
              ? 'bg-amber-950/80 text-amber-300'
              : 'bg-neutral-800 text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-black tabular-nums">
              #{p.codigo_senha}
            </span>
            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/40">
              {isSalaoPedido(p) ? `MESA ${p.mesa_id || '?'}` : (p.tipo || '').toUpperCase()}
            </span>
            {p.estoque_baixado && (
              <span
                className="text-[9px] px-1 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono font-bold flex items-center gap-0.5"
                title="Insumos debitados do estoque com sucesso"
              >
                <PackageCheck className="w-3 h-3" />
                ESTOQUE OK
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 tabular-nums text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span className={isDelayed ? 'text-red-400 font-black' : ''}>
              {mins}m ({formatTime(p.criado_em)})
            </span>
            {isDelayed && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 ml-0.5" />
            )}
          </div>
        </div>

        {/* Card Content - Items */}
        <div className="p-3 space-y-2 flex-1">
          {p.cliente && (
            <div className="text-[11px] font-semibold text-neutral-300 uppercase pb-1 border-b border-neutral-800">
              CLIENTE: {p.cliente.nome}
            </div>
          )}

          <div className="space-y-2">
            {p.itens.map((it, idx) => (
              <div
                key={idx}
                className="bg-neutral-900/90 p-2 rounded-lg border border-neutral-800/80"
              >
                <div className="flex items-start justify-between text-xs font-bold text-white uppercase">
                  <span>
                    <span className="text-amber-400 font-black text-sm mr-1.5">
                      {it.quantidade}x
                    </span>{' '}
                    <span className="text-neutral-100 font-black tracking-wide">
                      {getProductDescription(it)}
                    </span>
                  </span>
                </div>

                {it.opcionais_selecionados && it.opcionais_selecionados.length > 0 && (
                  <div className="text-[10px] text-amber-300/90 font-semibold pl-4 mt-0.5 uppercase">
                    {it.opcionais_selecionados.map((op, oIdx) => (
                      <span key={oIdx} className="block">
                        + {op.nome}
                      </span>
                    ))}
                  </div>
                )}

                {it.observacao && (
                  <div className="text-[11px] font-bold text-amber-400 bg-amber-950/40 border-l-2 border-amber-500 pl-2 py-0.5 mt-1 uppercase">
                    OBS: {it.observacao}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card Actions */}
        <div className="p-2.5 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2">
          <button
            onClick={() => onPrintReceipt(p)}
            title="Imprimir Comanda da Cozinha"
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>

          {p.status === 'pendente' && (
            <button
              onClick={() => handleAdvanceStatus(p)}
              className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors uppercase cursor-pointer"
            >
              <ChefHat className="w-4 h-4" />
              Iniciar Preparo
            </button>
          )}

          {p.status === 'em_preparacao' && (
            <button
              onClick={() => handleAdvanceStatus(p)}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors uppercase cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Marcar como Pronto!
            </button>
          )}

          {p.status === 'pronto' && (
            <button
              type="button"
              onClick={() => handleConfirmarRetirada(p)}
              title="Confirmar retirada pelo cliente ou garçom (remove imediatamente desta lista do KDS)"
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all uppercase shadow-md hover:scale-105 active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Retirada</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Toast Alerts para Avisos de Estoque Mínimo */}
      {toastAlerts.length > 0 && (
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
          {toastAlerts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-neutral-900 border border-amber-600/70 p-4 rounded-xl shadow-2xl flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-400">
                    Alerta de Estoque Mínimo
                  </h4>
                  <p className="text-xs font-bold text-neutral-200 mt-0.5">
                    {t.mensagem}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-neutral-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Diálogo de Confirmação: Insumos da Ficha Técnica Zerados ou Negativos */}
      {pedidoPendenteConfirmacao && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-amber-500/50 p-6 rounded-2xl max-w-md w-full shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0"/>
              <h3 className="text-base font-black uppercase">Insumo com Stock Zerado</h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Os seguintes insumos da ficha técnica estão zerados ou ficarão negativos:
            </p>

            <div className="space-y-1.5 max-h-40 overflow-y-auto bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs font-mono">
              {pedidoPendenteConfirmacao.insumosCriticos.map((ins) => (
                <div key={ins.item_estoque_id} className="flex justify-between items-center text-red-400">
                  <span>{ins.item_nome}</span>
                  <span className="font-bold">Atual: {ins.quantidade_atual} {ins.unidade_medida} | Baixa: -{ins.quantidade_debitar}</span>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-amber-300">
              Deseja continuar e registar o saldo negativo?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPedidoPendenteConfirmacao(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Não (Voltar)
              </button>
              <button
                type="button"
                onClick={() => executarBaixaEstoqueConfirmada(pedidoPendenteConfirmacao)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Sim (Continuar)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KDS Header summary */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold tracking-tight text-white uppercase flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-500" />
            <span>KDS - Monitor da Cozinha</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Atualização em tempo real via Nuvem · Baixa Automática de Insumos & Controle de Estoque
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center gap-1.5">
            <span>Fila Pendente:</span>
            <span className="text-amber-400 text-sm tabular-nums font-black">
              {pendentes.length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 flex items-center gap-1.5">
            <span>No Fogo:</span>
            <span className="text-amber-400 text-sm tabular-nums font-black">
              {emPreparo.length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-center gap-1.5">
            <span>Prontos:</span>
            <span className="text-emerald-400 text-sm tabular-nums font-black">
              {prontos.length}
            </span>
          </div>
        </div>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Col 1: Pendentes */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-neutral-300 uppercase">
            <span>1. Aguardando Início ({pendentes.length})</span>
          </div>
          <div className="space-y-3">
            {pendentes.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                NENHUM PEDIDO AGUARDANDO
              </div>
            ) : (
              pendentes.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Col 2: Em Preparo */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-amber-400 uppercase">
            <span>2. Cozinha / Preparando ({emPreparo.length})</span>
          </div>
          <div className="space-y-3">
            {emPreparo.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                COZINHA LIVRE NO MOMENTO
              </div>
            ) : (
              emPreparo.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Col 3: Prontos */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-emerald-400 uppercase">
            <span>3. Prontos para Retirada ({prontos.length})</span>
            {prontos.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  prontos.forEach(handleConfirmarRetirada);
                }}
                className="text-[11px] text-emerald-300 hover:text-white underline font-bold cursor-pointer normal-case"
                title="Confirmar retirada de todos os pedidos prontos de uma vez"
              >
                Confirmar todas as retiradas
              </button>
            )}
          </div>
          <div className="space-y-3">
            {prontos.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                NENHUM PEDIDO AGUARDANDO RETIRADA
              </div>
            ) : (
              prontos.map(renderOrderCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const KitchenDisplay = KitchenKDS;

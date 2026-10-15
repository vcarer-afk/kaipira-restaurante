import React, { useState } from 'react';
import { Pedido, StatusPedido } from '../types';
import { formatTime, playAlertChime } from '../utils/formatters';
import { Clock, ChefHat, Check, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface KitchenKDSProps {
  pedidos: Pedido[];
  onUpdateStatus: (id: number, status: StatusPedido) => void;
  onPrintReceipt: (pedido: Pedido) => void;
}

export const KitchenKDS: React.FC<KitchenKDSProps> = ({
  pedidos,
  onUpdateStatus,
  onPrintReceipt,
}) => {
  // IDs de pedidos confirmados como retirados para remoção imediata da lista do KDS
  const [retiradosLocais, setRetiradosLocais] = useState<number[]>([]);

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

  const handleAdvanceStatus = (pedido: Pedido) => {
    if (pedido.status === 'pendente') {
      onUpdateStatus(pedido.id, 'em_preparacao');
    } else if (pedido.status === 'em_preparacao') {
      onUpdateStatus(pedido.id, 'pronto');
      playAlertChime('ready');
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
              {p.tipo === 'salão' ? `MESA ${p.mesa_id || '?'}` : p.tipo.toUpperCase()}
            </span>
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
                    <span className="text-amber-400 font-black text-sm mr-1">
                      {it.quantidade}x
                    </span>{' '}
                    {it.produto_nome}
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
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {p.status === 'pendente' && (
            <button
              onClick={() => handleAdvanceStatus(p)}
              className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors uppercase"
            >
              <ChefHat className="w-4 h-4" />
              Iniciar Preparo
            </button>
          )}

          {p.status === 'em_preparacao' && (
            <button
              onClick={() => handleAdvanceStatus(p)}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors uppercase"
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
    <div className="flex flex-col gap-4">
      {/* KDS Header summary */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold tracking-tight text-white uppercase flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-500" />
            <span>KDS - Monitor da Cozinha</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Atualização em tempo real via Nuvem · Cozinheira Chefe & Assistentes
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

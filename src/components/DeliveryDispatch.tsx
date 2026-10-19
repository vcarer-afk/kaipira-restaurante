import React, { useState } from 'react';
import { Pedido, Produto } from '../types';
import { formatBRL, formatTime } from '../utils/formatters';
import { Bike, Navigation, CheckCircle2, Clock, Printer, MapPin, Phone, AlertCircle, ShoppingBag } from 'lucide-react';

interface DeliveryDispatchProps {
  pedidos: Pedido[];
  produtos?: Produto[];
  onUpdateStatus: (id: number, status: 'a_caminho' | 'entregue', entregador?: string) => void;
  onPrintReceipt: (pedido: Pedido) => void;
}

export const DeliveryDispatch: React.FC<DeliveryDispatchProps> = ({
  pedidos,
  produtos = [],
  onUpdateStatus,
  onPrintReceipt,
}) => {
  const [selectedEntregador, setSelectedEntregador] = useState<string>('RODRIGO MOTOBOY');

  const getProductDescription = (it: { produto_id?: number; produto_nome?: string }): string => {
    if (
      it.produto_nome &&
      !it.produto_nome.startsWith('#') &&
      !it.produto_nome.toLowerCase().startsWith('prod #') &&
      !it.produto_nome.toLowerCase().startsWith('produto #') &&
      it.produto_nome !== `#${it.produto_id}`
    ) {
      return it.produto_nome;
    }
    const pid = Number(it.produto_id);
    if (pid && produtos && produtos.length > 0) {
      const match = produtos.find((pr) => Number(pr.id) === pid);
      if (match && match.nome) return match.nome;
    }
    return it.produto_nome || (pid ? `PRODUTO #${pid}` : 'REFEIÇÃO TRADICIONAL KAIPIRA');
  };

  // Filter only delivery orders
  const deliveryOrders = pedidos.filter((p) => p.tipo === 'delivery');

  const prontosParaSair = deliveryOrders.filter((p) => p.status === 'pronto');
  const aCaminho = deliveryOrders.filter((p) => p.status === 'a_caminho');
  const entregues = deliveryOrders.filter((p) => p.status === 'entregue').slice(0, 10);

  const handleDespachar = (pedido: Pedido) => {
    onUpdateStatus(pedido.id, 'a_caminho', selectedEntregador);
  };

  const handleConfirmarEntrega = (pedido: Pedido) => {
    onUpdateStatus(pedido.id, 'entregue');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Expedition Header */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <Bike className="w-5 h-5 text-amber-500" />
            <span>Módulo de Expedição & Delivery Próprio (Piracicaba)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Controle de motoboys, saídas, rotas por bairro e confirmação de entrega
          </p>
        </div>

        {/* Motoboy selector */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded-lg text-xs">
          <span className="text-neutral-400 font-medium">Entregador Padrão:</span>
          <select
            value={selectedEntregador}
            onChange={(e) => setSelectedEntregador(e.target.value.toUpperCase())}
            className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer uppercase text-xs"
          >
            <option value="RODRIGO MOTOBOY" className="bg-neutral-800 text-white">
              RODRIGO (MOTOBOY PRÓPRIO KAIPIRA)
            </option>
            <option value="MOTOBOY TERCERIZADO (APP)" className="bg-neutral-800 text-white">
              MOTOBOY TERCEIRIZADO / APP
            </option>
            <option value="MARCOS EXPRESS" className="bg-neutral-800 text-white">
              MARCOS EXPRESS
            </option>
          </select>
        </div>
      </div>

      {/* 3 Columns: Aguardando Saída | A Caminho | Entregues Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Col 1: Aguardando Saída */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-amber-400 uppercase">
            <span>1. Prontos para Despacho ({prontosParaSair.length})</span>
          </div>

          <div className="space-y-3">
            {prontosParaSair.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                NENHUM PEDIDO AGUARDANDO SAÍDA
              </div>
            ) : (
              prontosParaSair.map((p) => (
                <div
                  key={p.id}
                  className="bg-neutral-850 rounded-xl border border-neutral-700 p-4 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <span className="text-sm font-black text-amber-400 font-mono">
                      SENHA #{p.codigo_senha}
                    </span>
                    <span className="text-xs font-bold text-white tabular-nums">
                      {formatBRL(p.valor_total)}
                    </span>
                  </div>

                  {p.cliente && (
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-neutral-100 uppercase">
                        {p.cliente.nome}
                      </div>
                      <div className="flex items-center gap-1 text-neutral-400">
                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{p.cliente.telefone}</span>
                      </div>
                      <div className="flex items-start gap-1 text-neutral-300">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span>
                            {p.cliente.endereco}, Nº {p.cliente.numero}
                          </span>
                          {p.cliente.complemento && <span> ({p.cliente.complemento})</span>}
                          <div className="text-[11px] text-amber-400 font-bold">
                            BAIRRO: {p.cliente.bairro} · CEP: {p.cliente.cep}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lista de Produtos com Descrição Completa */}
                  {p.itens && p.itens.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        <ShoppingBag className="w-3 h-3 text-amber-500" />
                        <span>Itens do Pedido ({p.itens.reduce((s, it) => s + it.quantidade, 0)}):</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                        {p.itens.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-neutral-200">
                              <strong className="text-amber-400 font-mono">{it.quantidade}x</strong>{' '}
                              {getProductDescription(it)}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-300 font-semibold tabular-nums shrink-0">
                              {formatBRL(it.preco_unitario * it.quantidade)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-1.5 border-t border-neutral-800 flex justify-between text-[10.5px] font-mono text-neutral-400">
                        <span>Taxa Entrega: +{formatBRL(p.taxa_entrega || 0)}</span>
                        <span className="font-bold text-white">Total: {formatBRL(p.valor_total)}</span>
                      </div>
                    </div>
                  )}

                  {/* Change warning */}
                  {p.precisa_troco && p.troco_para && (
                    <div className="p-2 rounded bg-amber-950/60 border border-amber-800 text-[11px] text-amber-300 flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        LEVAR TROCO DE {formatBRL(p.troco_para - p.valor_total)} (P/ {formatBRL(p.troco_para)})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                    <button
                      onClick={() => onPrintReceipt(p)}
                      title="Imprimir Comanda de Entrega"
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDespachar(p)}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors uppercase"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Despachar ({selectedEntregador.split(' ')[0]})
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Col 2: A Caminho */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-cyan-400 uppercase">
            <span>2. A Caminho / Na Rua ({aCaminho.length})</span>
          </div>

          <div className="space-y-3">
            {aCaminho.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                NENHUM MOTOBOY NA RUA NO MOMENTO
              </div>
            ) : (
              aCaminho.map((p) => (
                <div
                  key={p.id}
                  className="bg-neutral-850 rounded-xl border border-cyan-800/60 p-4 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-cyan-400 font-mono">
                        SENHA #{p.codigo_senha}
                      </span>
                      <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded font-bold uppercase">
                        {p.entregador_nome || 'MOTOBOY'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white tabular-nums">
                      {formatBRL(p.valor_total)}
                    </span>
                  </div>

                  {p.cliente && (
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white uppercase">
                        {p.cliente.nome}
                      </div>
                      <div className="text-neutral-400">
                        {p.cliente.endereco}, Nº {p.cliente.numero} - {p.cliente.bairro}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        TEL: {p.cliente.telefone}
                      </div>
                    </div>
                  )}

                  {/* Lista de Produtos com Descrição Completa e Valores */}
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      <ShoppingBag className="w-3 h-3 text-cyan-500" />
                      <span>Itens ({p.itens && p.itens.length > 0 ? p.itens.reduce((s, it) => s + it.quantidade, 0) : 1}):</span>
                    </div>

                    {p.itens && p.itens.length > 0 ? (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                        {p.itens.map((it, idx) => {
                          const itemTotal = it.preco_unitario > 0
                            ? it.preco_unitario * it.quantidade
                            : Math.max(0, p.valor_total - (p.taxa_entrega || 0));

                          return (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-neutral-200">
                                <strong className="text-cyan-400 font-mono">{it.quantidade}x</strong>{' '}
                                {getProductDescription(it)}
                              </span>
                              <span className="text-[11px] font-mono text-neutral-300 font-semibold tabular-nums shrink-0">
                                {formatBRL(itemTotal)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1 py-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-200">
                            <strong className="text-cyan-400 font-mono">1x</strong> Pedido Delivery #{p.codigo_senha || p.id}
                          </span>
                          <span className="text-[11px] font-mono text-neutral-300 font-semibold tabular-nums shrink-0">
                            {formatBRL(Math.max(0, p.valor_total - (p.taxa_entrega || 0)))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Saiu às: {formatTime(p.atualizado_em)}</span>
                    {p.pagamentos[0] && (
                      <span className="uppercase font-bold text-neutral-300">
                        {p.pagamentos[0].forma.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                    <button
                      onClick={() => onPrintReceipt(p)}
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConfirmarEntrega(p)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors uppercase"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Entrega Realizada
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Col 3: Entregues Recentes */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-emerald-400 uppercase">
            <span>3. Entregues Recentemente ({entregues.length})</span>
          </div>

          <div className="space-y-3">
            {entregues.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                NENHUMA ENTREGA FINALIZADA HOJE AINDA
              </div>
            ) : (
              entregues.map((p) => (
                <div
                  key={p.id}
                  className="bg-neutral-850 rounded-xl border border-neutral-750 p-4 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        SENHA #{p.codigo_senha}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Pedido #{p.id}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white tabular-nums">
                      {formatBRL(p.valor_total)}
                    </span>
                  </div>

                  {p.cliente && (
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-neutral-100 uppercase">
                        {p.cliente.nome}
                      </div>
                      <div className="flex items-center gap-1 text-neutral-400">
                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{p.cliente.telefone}</span>
                      </div>
                      <div className="flex items-start gap-1 text-neutral-300">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span>
                            {p.cliente.endereco}, Nº {p.cliente.numero}
                          </span>
                          {p.cliente.complemento && <span> ({p.cliente.complemento})</span>}
                          <div className="text-[11px] text-emerald-400 font-bold">
                            BAIRRO: {p.cliente.bairro} · CEP: {p.cliente.cep}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] bg-neutral-900/80 px-2.5 py-1.5 rounded-lg border border-neutral-800 text-neutral-300">
                    <Bike className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Entregador: <strong className="text-cyan-300 font-bold">{p.entregador_nome || 'MOTOBOY PRÓPRIO'}</strong></span>
                  </div>

                  {/* Lista de Produtos com Descrição Completa e Valores */}
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      <ShoppingBag className="w-3 h-3 text-emerald-500" />
                      <span>Produtos Entregues ({p.itens && p.itens.length > 0 ? p.itens.reduce((s, it) => s + it.quantidade, 0) : 1}):</span>
                    </div>

                    {p.itens && p.itens.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                        {p.itens.map((it, idx) => {
                          const itemTotal = it.preco_unitario > 0
                            ? it.preco_unitario * it.quantidade
                            : Math.max(0, p.valor_total - (p.taxa_entrega || 0));

                          return (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-neutral-200">
                                <strong className="text-emerald-400 font-mono">{it.quantidade}x</strong>{' '}
                                {getProductDescription(it)}
                              </span>
                              <span className="text-[11px] font-mono text-neutral-300 font-semibold tabular-nums shrink-0">
                                {formatBRL(itemTotal)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1 py-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-200">
                            <strong className="text-emerald-400 font-mono">1x</strong> Pedido Delivery #{p.codigo_senha || p.id}
                          </span>
                          <span className="text-[11px] font-mono text-neutral-300 font-semibold tabular-nums shrink-0">
                            {formatBRL(Math.max(0, p.valor_total - (p.taxa_entrega || 0)))}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-neutral-800 flex justify-between text-[10.5px] font-mono text-neutral-400">
                      <span>Taxa Entrega: +{formatBRL(p.taxa_entrega || 0)}</span>
                      <span className="font-bold text-white">Total: {formatBRL(p.valor_total)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Finalizado às: {formatTime(p.atualizado_em)}</span>
                    {p.pagamentos && p.pagamentos[0] && (
                      <span className="uppercase font-bold text-neutral-300">
                        {p.pagamentos[0].forma.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800">
                    <button
                      onClick={() => onPrintReceipt(p)}
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                      title="Reimprimir Comprovante de Entrega"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {p.conferencia_entrega === 'conferido' ? (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Conferido pelo Caixa</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pendente Conferência no Caixa</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

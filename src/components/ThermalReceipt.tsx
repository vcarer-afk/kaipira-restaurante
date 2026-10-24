import React from 'react';
import { Pedido, ConfiguracoesSistema, Produto } from '../types';
import { formatBRL, formatDateTime } from '../utils/formatters';
import { Printer, X } from 'lucide-react';

interface ThermalReceiptProps {
  pedido: Pedido | null;
  onClose: () => void;
  configuracoes?: ConfiguracoesSistema;
  produtos?: Produto[];
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ pedido, onClose, configuracoes, produtos }) => {
  if (!pedido) return null;

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-850">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-neutral-200">
              Comanda Térmica (80mm) - Senha #{pedido.codigo_senha}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview Body */}
        <div className="overflow-y-auto p-4 bg-neutral-950 flex justify-center">
          <div
            id="thermal-print-area"
            className="w-[78mm] bg-white text-black p-4 font-mono text-[11px] leading-snug shadow-md rounded-xs border border-neutral-300"
          >
            <div className="text-center pb-2 border-b border-dashed border-black">
              <h2 className="text-sm font-bold tracking-tight uppercase">
                {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
              </h2>
              <p className="text-[10px] uppercase">DESDE 2013 - ESPALHANDO SABOR</p>
              <p className="text-[10px] uppercase">
                {configuracoes?.endereco
                  ? `${configuracoes.endereco}${configuracoes.numero ? `, ${configuracoes.numero}` : ''} - ${configuracoes.bairro || ''} (${configuracoes.cidade || 'PIRACICABA'} - ${configuracoes.uf || 'SP'})`
                  : 'PIRACICABA - SP'}
              </p>
              {configuracoes?.telefone && (
                <p className="text-[10px] uppercase">TEL: {configuracoes.telefone}</p>
              )}
            </div>

            <div className="py-2 border-b border-dashed border-black text-center">
              <span className="text-xs uppercase tracking-wider font-bold">
                {pedido.tipo.toUpperCase()}
              </span>
              <div className="text-2xl font-black my-1">
                SENHA #{pedido.codigo_senha}
              </div>
              {pedido.mesa_id && (
                <div className="text-sm font-bold bg-neutral-200 py-0.5 mt-1">
                  MESA: {pedido.mesa_id}
                </div>
              )}
              <div className="text-[10px] text-neutral-600 mt-1">
                {formatDateTime(pedido.criado_em)}
              </div>
            </div>

            {/* Customer Details for Delivery / Balcao */}
            {pedido.cliente && (
              <div className="py-2 border-b border-dashed border-black text-[10px]">
                <p className="font-bold">CLIENTE: {pedido.cliente.nome}</p>
                <p>TEL: {pedido.cliente.telefone}</p>
                {pedido.tipo === 'delivery' && (
                  <>
                    <p className="font-semibold mt-1">
                      END: {pedido.cliente.endereco}, Nº {pedido.cliente.numero}
                    </p>
                    {pedido.cliente.complemento && <p>COMPL: {pedido.cliente.complemento}</p>}
                    <p>BAIRRO: {pedido.cliente.bairro} - PIRACICABA</p>
                    <p>CEP: {pedido.cliente.cep}</p>
                  </>
                )}
              </div>
            )}

            {/* Order Items */}
            <div className="py-2 border-b border-dashed border-black">
              <div className="flex justify-between font-bold text-[10px] mb-1">
                <span>QTD · PRODUTO / DESCRIÇÃO</span>
                <span className="text-right">UNIT · SUBTOTAL</span>
              </div>
              <div className="space-y-2">
                {pedido.itens.map((it, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="flex justify-between items-start">
                      <span className="font-bold">
                        {it.quantidade}x {getProductDescription(it)}
                      </span>
                      <div className="text-right shrink-0">
                        <span className="tabular-nums font-bold block">
                          {formatBRL(it.preco_unitario * it.quantidade)}
                        </span>
                        <span className="text-[9.5px] text-neutral-600 block">
                          ({it.quantidade}x {formatBRL(it.preco_unitario)})
                        </span>
                      </div>
                    </div>

                    {it.opcionais_selecionados && it.opcionais_selecionados.length > 0 && (
                      <div className="pl-2 text-[10px] text-neutral-700">
                        {it.opcionais_selecionados.map((op, oIdx) => (
                          <div key={oIdx} className="flex justify-between">
                            <span>+ {op.nome}</span>
                            <span>{op.preco_adicional > 0 ? formatBRL(op.preco_adicional) : 'GRÁTIS'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {it.observacao && (
                      <div className="pl-2 mt-0.5 text-[10px] font-bold text-black border-l-2 border-black">
                        OBS: {it.observacao}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>SUBTOTAL PRODUTOS:</span>
                <span className="tabular-nums font-bold">
                  {formatBRL(pedido.itens.reduce((acc, it) => acc + it.preco_unitario * it.quantidade, 0))}
                </span>
              </div>
              {pedido.taxa_entrega > 0 && (
                <div className="flex justify-between">
                  <span>TAXA DE ENTREGA:</span>
                  <span className="tabular-nums font-bold">{formatBRL(pedido.taxa_entrega)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-black">
                <span>TOTAL GERAL:</span>
                <span className="tabular-nums">{formatBRL(pedido.valor_total)}</span>
              </div>

              {pedido.precisa_troco && pedido.troco_para && (
                <div className="pt-1 text-[10px] font-bold">
                  <div className="flex justify-between">
                    <span>TROCO PARA:</span>
                    <span className="tabular-nums">{formatBRL(pedido.troco_para)}</span>
                  </div>
                  <div className="flex justify-between text-red-700">
                    <span>LEVAR DE TROCO:</span>
                    <span className="tabular-nums">
                      {formatBRL(pedido.troco_para - pedido.valor_total)}
                    </span>
                  </div>
                </div>
              )}

              {pedido.pagamentos && pedido.pagamentos.length > 0 && (
                <div className="pt-1 text-[10px]">
                  <span className="font-bold">FORMA DE PAGAMENTO: </span>
                  {pedido.pagamentos.map((p, idx) => (
                    <span key={idx} className="uppercase font-semibold">
                      {p.forma.replace('_', ' ')} ({formatBRL(p.valor)})
                    </span>
                  ))}
                </div>
              )}

              {pedido.entregador_nome && (
                <div className="text-[10px] font-bold pt-1">
                  ENTREGADOR: {pedido.entregador_nome}
                </div>
              )}
            </div>

            <div className="text-center pt-2 text-[9px] text-neutral-600">
              <p>OBRIGADO PELA PREFERÊNCIA!</p>
              <p>O VERDADEIRO SABOR DO INTERIOR PAULISTA</p>
              <p className="mt-1 font-mono">SISTEMA RESTAURANTE KAIPIRA</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-850 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Comanda Térmica
          </button>
        </div>
      </div>
    </div>
  );
};

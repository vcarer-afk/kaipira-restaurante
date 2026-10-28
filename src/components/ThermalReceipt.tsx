import React from 'react';
import { Pedido, ConfiguracoesSistema, Produto, Cliente } from '../types';
import { formatBRL, formatDateTime } from '../utils/formatters';
import { Printer, X } from 'lucide-react';

interface ThermalReceiptProps {
  pedido: Pedido | null;
  onClose: () => void;
  configuracoes?: ConfiguracoesSistema;
  produtos?: Produto[];
  clientes?: Cliente[];
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ pedido, onClose, configuracoes, produtos, clientes }) => {
  if (!pedido) return null;

  const pedAny = pedido as any;

  // Extrai eventual backup de metadados salvo em itens
  const metaItem = (pedido.itens || [])
    .flatMap((it) => it.opcionais_selecionados || [])
    .find((op: any) => op && (op.nome === '__META_DELIVERY__' || op.id === -999));
  const metaCliente = (metaItem as any)?.dados_cliente;

  const clienteResolved =
    pedido.cliente ||
    (clientes && pedido.cliente_id ? clientes.find((c) => String(c.id) === String(pedido.cliente_id)) : undefined) ||
    metaCliente;

  const clienteData =
    clienteResolved ||
    pedAny.cliente ||
    pedAny.dados_cliente ||
    pedAny.cliente_dados ||
    metaCliente ||
    {};

  const rawNome = (
    clienteData.nome ||
    metaCliente?.nome ||
    pedAny.cliente_nome ||
    pedAny.nome ||
    ''
  ).trim();

  const isGenericOrUnidentified =
    !rawNome ||
    rawNome.toUpperCase().includes('NÃO IDENTIFICADO') ||
    rawNome.toUpperCase().includes('NAO IDENTIFICADO');

  const clienteNome = !isGenericOrUnidentified
    ? rawNome
    : pedido.tipo === 'delivery'
    ? 'CLIENTE DELIVERY'
    : 'CONSUMIDOR BALCÃO';

  const clienteTelefone =
    clienteData.telefone ||
    metaCliente?.telefone ||
    pedAny.telefone ||
    pedAny.cliente_telefone ||
    '';

  const clienteEndereco =
    clienteData.endereco ||
    metaCliente?.endereco ||
    pedAny.endereco ||
    pedAny.rua ||
    pedAny.logradouro ||
    '';

  const clienteNumero =
    clienteData.numero ||
    metaCliente?.numero ||
    pedAny.numero ||
    'S/N';

  const clienteComplemento =
    clienteData.complemento ||
    metaCliente?.complemento ||
    pedAny.complemento ||
    '';

  const clienteBairro =
    clienteData.bairro ||
    metaCliente?.bairro ||
    pedAny.bairro ||
    'PIRACICABA';

  const clienteCep =
    clienteData.cep ||
    metaCliente?.cep ||
    pedAny.cep ||
    '';

  const getEnderecoCompleto = (p: Pedido): string => {
    // 1. Tentar endereço dentro do objeto cliente ou metadados
    const cli = p.cliente || clienteResolved || metaCliente;
    const partesCli: string[] = [];
    if (cli?.endereco) partesCli.push(cli.endereco);
    if (cli?.numero) partesCli.push(`Nº ${cli.numero}`);
    if (cli?.complemento) partesCli.push(`(${cli.complemento})`);
    if (partesCli.length > 0) return partesCli.join(', ');

    // 2. Tentar campos diretos na raiz do pedido (lançamentos de PDV/Vitrine)
    const pAny = p as any;
    if (pAny.endereco_entrega) return pAny.endereco_entrega;
    if (metaCliente?.enderecoCompleto) return metaCliente.enderecoCompleto;
    if (pAny.endereco) {
      const num = pAny.numero ? `, Nº ${pAny.numero}` : '';
      const comp = pAny.complemento ? ` (${pAny.complemento})` : '';
      return `${pAny.endereco}${num}${comp}`;
    }

    return 'ENDEREÇO NÃO INFORMADO';
  };

  const getBairroCidade = (p: Pedido): string => {
    const cli = p.cliente || clienteResolved || metaCliente;
    const pAny = p as any;
    const bairro = cli?.bairro || metaCliente?.bairro || pAny.bairro || 'PIRACICABA';
    const cidade = cli?.cidade || metaCliente?.cidade || pAny.cidade || configuracoes?.cidade || 'PIRACICABA';
    const cep = cli?.cep || metaCliente?.cep || pAny.cep;
    return `${bairro} - ${cidade}${cep ? ` (CEP: ${cep})` : ''}`;
  };

  const getTelefoneContato = (p: Pedido): string => {
    return p.cliente?.telefone || clienteResolved?.telefone || metaCliente?.telefone || (p as any).telefone || (p as any).whatsapp || '';
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs print:bg-transparent print:p-0 print:static print:inset-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-area, #thermal-receipt-area * {
            visibility: visible !important;
          }
          #thermal-receipt-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 76mm !important; /* Compatibilidade perfeita para bobinas de 80mm e 58mm */
            margin: 0 auto !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:border-none print:shadow-none print:max-w-none print:max-h-none print:bg-transparent">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-850 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-neutral-200">
              Comanda Térmica (76/80mm) - Senha #{pedido.codigo_senha}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer print:hidden"
            title="Fechar comprovante"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview Body */}
        <div className="overflow-y-auto p-4 bg-neutral-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            id="thermal-receipt-area"
            className="w-[76mm] max-w-[76mm] bg-white text-black p-4 font-mono text-xs leading-snug shadow-md rounded-xs border border-neutral-300 print:shadow-none print:border-none print:p-1"
          >
            <div className="text-center pb-2 border-b border-dashed border-black">
              <h2 className="text-sm font-bold tracking-tight uppercase text-black">
                {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
              </h2>
              <p className="text-[10px] uppercase text-black">DESDE 2013 - ESPALHANDO SABOR</p>
              <p className="text-[10px] uppercase text-black">
                {configuracoes?.endereco
                  ? `${configuracoes.endereco}${configuracoes.numero ? `, ${configuracoes.numero}` : ''} - ${configuracoes.bairro || ''} (${configuracoes.cidade || 'PIRACICABA'} - ${configuracoes.uf || 'SP'})`
                  : 'PIRACICABA - SP'}
              </p>
              {configuracoes?.telefone && (
                <p className="text-[10px] uppercase text-black">TEL: {configuracoes.telefone}</p>
              )}
            </div>

            <div className="py-2 border-b border-dashed border-black text-center">
              <span className="text-xs uppercase tracking-wider font-bold text-black">
                {pedido.tipo.toUpperCase()}
              </span>
              <div className="text-2xl font-black my-1 text-black">
                SENHA #{pedido.codigo_senha}
              </div>
              {pedido.mesa_id && (
                <div className="text-sm font-bold bg-neutral-200 text-black py-0.5 mt-1 border border-black">
                  MESA: {pedido.mesa_id}
                </div>
              )}
              <div className="text-[10px] text-black mt-1">
                {formatDateTime(pedido.criado_em)}
              </div>
            </div>

            {/* Customer Details for Delivery / Balcao */}
            {(pedido.tipo === 'delivery' || !!clienteNome) && (
              <div className="py-2 border-b border-dashed border-black text-[11px] text-black space-y-0.5">
                <p className="font-bold">CLIENTE: {clienteNome}</p>
                {pedido.tipo === 'delivery' ? (
                  <>
                    <p className="font-semibold">
                      END: {getEnderecoCompleto(pedido)}
                    </p>
                    <p>BAIRRO: {getBairroCidade(pedido)}</p>
                    {getTelefoneContato(pedido) && (
                      <p className="font-bold">TEL: {getTelefoneContato(pedido)}</p>
                    )}
                  </>
                ) : (
                  (clienteTelefone || getTelefoneContato(pedido)) && (
                    <p>TEL: {clienteTelefone || getTelefoneContato(pedido)}</p>
                  )
                )}
              </div>
            )}

            {/* Order Items */}
            <div className="py-2 border-b border-dashed border-black">
              <div className="flex justify-between font-bold text-[10px] mb-1.5 text-black border-b border-black pb-0.5">
                <span>QTD · ITEM / PRODUTO</span>
                <span className="text-right">TOTAL</span>
              </div>
              <div className="space-y-2">
                {pedido.itens.map((it, idx) => (
                  <div key={idx} className="text-xs text-black">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-bold">
                        {it.quantidade}x {getProductDescription(it)}
                      </span>
                      <div className="text-right shrink-0">
                        <span className="tabular-nums font-bold block">
                          {formatBRL(it.preco_unitario * it.quantidade)}
                        </span>
                        <span className="text-[10px] text-black block">
                          ({it.quantidade}x {formatBRL(it.preco_unitario)})
                        </span>
                      </div>
                    </div>

                    {it.opcionais_selecionados && it.opcionais_selecionados.length > 0 && (
                      <div className="pl-2 text-[10px] text-black">
                        {it.opcionais_selecionados
                          .filter((op) => op && op.nome !== '__META_DELIVERY__' && op.id !== -999)
                          .map((op, oIdx) => (
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
            <div className="py-2 border-b border-dashed border-black space-y-1 text-xs text-black">
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
              <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                <span>TOTAL GERAL:</span>
                <span className="tabular-nums">{formatBRL(pedido.valor_total)}</span>
              </div>

              {pedido.precisa_troco && pedido.troco_para && (
                <div className="pt-1 text-[11px] font-bold border-t border-dashed border-black">
                  <div className="flex justify-between">
                    <span>TROCO PARA:</span>
                    <span className="tabular-nums">{formatBRL(pedido.troco_para)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LEVAR DE TROCO:</span>
                    <span className="tabular-nums">
                      {formatBRL(pedido.troco_para - pedido.valor_total)}
                    </span>
                  </div>
                </div>
              )}

              {pedido.pagamentos && pedido.pagamentos.length > 0 && (
                <div className="pt-1 text-[10px]">
                  <span className="font-bold">PAGAMENTO: </span>
                  {pedido.pagamentos.map((p, idx) => (
                    <span key={idx} className="uppercase font-semibold block">
                      • {p.forma.replace('_', ' ')}: {formatBRL(p.valor)}
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

            <div className="text-center pt-2 text-[10px] text-black">
              <p className="font-bold">OBRIGADO PELA PREFERÊNCIA!</p>
              <p>O VERDADEIRO SABOR DO INTERIOR PAULISTA</p>
              <p className="mt-0.5 text-[9px] font-mono">SISTEMA RESTAURANTE KAIPIRA</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-850 flex items-center justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors cursor-pointer print:hidden"
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer print:hidden"
          >
            <Printer className="w-4 h-4" />
            Imprimir Comanda Térmica
          </button>
        </div>
      </div>
    </div>
  );
};

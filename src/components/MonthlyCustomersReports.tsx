import React, { useState, useMemo } from 'react';
import { Pedido, Cliente, ConfiguracoesSistema, CaixaDiario } from '../types';
import { formatBRL } from '../utils/formatters';
import {
  Briefcase,
  Download,
  Printer,
  Search,
  MessageCircle,
  FileText,
  Building2,
  ArrowRight,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface MonthlyCustomersReportsProps {
  clientes: Cliente[];
  pedidos: Pedido[];
  caixa?: CaixaDiario;
  configuracoes?: ConfiguracoesSistema;
  onNavigate?: (tab: any) => void;
}

export const MonthlyCustomersReports: React.FC<MonthlyCustomersReportsProps> = ({
  clientes = [],
  pedidos = [],
  configuracoes,
  onNavigate,
}) => {
  const [busca, setBusca] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const hojeIso = new Date().toISOString().split('T')[0];

  // 1. Filtrar apenas clientes que são mensalistas ou que possuem saldo devedor em aberto
  const mensalistasList = useMemo(() => {
    return clientes.filter(
      (c) => Boolean(c.eh_mensalista) || (Number(c.saldo_devedor) || 0) > 0
    );
  }, [clientes]);

  const mensalistasFiltrados = useMemo(() => {
    if (!busca.trim()) return mensalistasList;
    const q = busca.toLowerCase().trim();
    return mensalistasList.filter(
      (c) =>
        (c.nome && c.nome.toLowerCase().includes(q)) ||
        (c.telefone && c.telefone.includes(q)) ||
        (c.bairro && c.bairro.toLowerCase().includes(q))
    );
  }, [mensalistasList, busca]);

  // Totais Gerais de Contas a Receber
  const totalEmAberto = useMemo(() => {
    return mensalistasList.reduce((acc, c) => acc + (Number(c.saldo_devedor) || 0), 0);
  }, [mensalistasList]);

  // 2. Histórico detalhado de pedidos faturados como 'mensalista' por cliente
  const historicoPedidosPorCliente = useMemo(() => {
    const mapa = new Map<string, Pedido[]>();
    pedidos.forEach((p) => {
      if (!p || p.status === 'cancelado') return;
      const ehVendaMensalista =
        (p.pagamentos && p.pagamentos.some((pg) => (pg.forma || '').toLowerCase().includes('mensal'))) ||
        ((p.forma_pagamento as string) || '').toLowerCase().includes('mensal');

      if (ehVendaMensalista && p.cliente_id) {
        if (!mapa.has(p.cliente_id)) {
          mapa.set(p.cliente_id, []);
        }
        mapa.get(p.cliente_id)!.push(p);
      }
    });
    return mapa;
  }, [pedidos]);

  // Cliente em destaque para Ficha Individual / Espelho da Conta
  const clienteSelecionado = useMemo(() => {
    if (!clienteSelecionadoId) return mensalistasList[0] || null;
    return mensalistasList.find((c) => c.id === clienteSelecionadoId) || null;
  }, [clienteSelecionadoId, mensalistasList]);

  const pedidosDoClienteSelecionado = useMemo(() => {
    if (!clienteSelecionado) return [];
    return historicoPedidosPorCliente.get(clienteSelecionado.id) || [];
  }, [clienteSelecionado, historicoPedidosPorCliente]);

  // Enviar extrato/resumo pelo WhatsApp
  const handleEnviarWhatsApp = (c: Cliente) => {
    const telefoneLimpo = (c.telefone || '').replace(/\D/g, '');
    if (!telefoneLimpo) {
      alert('Telefone do cliente não cadastrado.');
      return;
    }

    const mensagem = encodeURIComponent(
      `Olá, *${c.nome}*! Segue o resumo de sua conta mensalista no *${configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}*:\n\n` +
      `📅 *Data de Emissão:* ${new Date().toLocaleDateString('pt-BR')}\n` +
      `💰 *Saldo Devedor em Aberto:* ${formatBRL(c.saldo_devedor || 0)}\n\n` +
      `Para conferência detalhada dos itens ou acerto via PIX, favor entrar em contato. Agradecemos a preferência!`
    );

    window.open(`https://wa.me/55${telefoneLimpo}?text=${mensagem}`, '_blank');
  };

  // Impressão Térmica da Ficha Espelho do Mensalista
  const handlePrintFichaTermica = (c: Cliente, listaPeds: Pedido[]) => {
    const printWindow = window.open('', '', 'width=380,height=600');
    if (!printWindow) return;

    const linhas = listaPeds
      .map(
        (p) => `
        <div style="font-size: 11px; margin-bottom: 4px; border-bottom: 1px dotted #ccc; padding-bottom: 2px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>#${p.codigo_senha || p.id} (${(p.criado_em || '').split('T')[0]})</span>
            <span>${formatBRL(p.valor_total)}</span>
          </div>
          <div style="font-size: 10px; color: #333;">
            ${(p.itens || []).map((it) => `${it.quantidade}x ${it.produto_nome}`).join(', ')}
          </div>
        </div>`
      )
      .join('');

    const htmlContent = `
      <html>
        <head>
          <title>Ficha Mensalista - ${c.nome}</title>
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
          <div class="center" style="font-size: 11px;">EXTRATO INDIVIDUAL DE CONTA MENSALISTA</div>
          <div class="center" style="font-size: 11px;">EMISSÃO: ${hojeIso}</div>
          <div class="border"></div>
          <div class="bold" style="font-size: 12px;">CLIENTE: ${c.nome}</div>
          <div style="font-size: 11px;">TEL: ${c.telefone || 'Não informado'}</div>
          <div style="font-size: 11px;">END: ${c.endereco || ''}, ${c.numero || ''} - ${c.bairro || 'PIRACICABA'}</div>
          <div class="border"></div>
          <div class="bold" style="font-size: 11px; margin-bottom: 4px;">COMANDAS REGISTRADAS:</div>
          ${linhas || '<div style="font-size: 11px; text-align: center;">Nenhuma comanda vinculada no histórico imediato.</div>'}
          <div class="border"></div>
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>TOTAL DEVEDOR EM ABERTO:</span>
            <span>${formatBRL(c.saldo_devedor || 0)}</span>
          </div>
          <div class="border"></div>
          <br/><br/>
          <div class="center" style="font-size: 10px;">___________________________________</div>
          <div class="center" style="font-size: 10px;">ASSINATURA DO RESPONSÁVEL</div>
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

  // Exportação em PDF A4
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const element = document.getElementById('relatorio-mensalistas-print');
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
      pdf.save(`Relatorio_Mensalistas_${hojeIso}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF de mensalistas:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Superior & Ações */}
      <div className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 mb-1">
            <Briefcase className="w-4 h-4 text-amber-500" />
            <span>Módulo de Contas a Receber & Convênios</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Extrato Consolidado & Ficha de Mensalistas
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Gestão de saldos devedores, espelho de conta comanda por comanda, emissão de PDF e envio via WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPDF ? 'Gerando...' : 'Exportar Extrato A4'}</span>
          </button>
        </div>
      </div>

      {/* Grid Principal: 1. Lista Geral & 2. Ficha Espelho Individual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Extrato Consolidado de Clientes (7 colunas) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-neutral-300 uppercase tracking-wider flex items-center gap-2 font-mono">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Lista Consolidada de Mensalistas ({mensalistasFiltrados.length})</span>
            </h3>
            <span className="text-xs font-mono text-neutral-400">
              Total em Aberto: <strong className="text-amber-400">{formatBRL(totalEmAberto)}</strong>
            </span>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="BUSCAR MENSALISTA POR NOME, TELEFONE OU BAIRRO..."
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white uppercase placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Lista de Cards de Mensalistas */}
          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {mensalistasFiltrados.map((c) => {
              const isSelected = clienteSelecionado?.id === c.id;
              const saldo = Number(c.saldo_devedor) || 0;

              return (
                <div
                  key={c.id}
                  onClick={() => setClienteSelecionadoId(c.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 ${
                    isSelected
                      ? 'bg-neutral-800 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white uppercase text-xs truncate">
                          {c.nome}
                        </span>
                        {saldo > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-800 text-red-300 font-mono text-[9px] font-bold">
                            EM DÉBITO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-[9px] font-bold">
                            QUITADO
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400 font-mono block mt-0.5">
                        {c.telefone || 'Sem tel'} • {c.bairro || 'PIRACICABA'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-neutral-400 uppercase font-mono block">Saldo Devedor</span>
                      <span className="text-sm sm:text-base font-black text-amber-400 font-mono tabular-nums">
                        {formatBRL(saldo)}
                      </span>
                    </div>
                  </div>

                  {/* Ações Rápidas por Linha */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[11px]">
                    <span className="text-neutral-500 font-mono">
                      Clique para ver espelho detalhado
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnviarWhatsApp(c);
                        }}
                        className="p-1.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                        title="Enviar extrato por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {mensalistasFiltrados.length === 0 && (
              <div className="bg-neutral-850 p-8 rounded-2xl border border-neutral-800 text-center text-xs text-neutral-500 font-mono">
                Nenhum cliente mensalista encontrado.
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Ficha Individual / Espelho da Conta (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-neutral-300 uppercase tracking-wider flex items-center gap-2 font-mono">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Espelho Individual da Conta</span>
            </h3>
          </div>

          {clienteSelecionado ? (
            <div
              id="relatorio-mensalistas-print"
              className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-md space-y-4 text-white"
            >
              {/* Header do Espelho */}
              <div className="border-b border-neutral-800 pb-3 flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-black text-white uppercase">{clienteSelecionado.nome}</h4>
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                    Tel: {clienteSelecionado.telefone || 'Não informado'}
                  </p>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    {clienteSelecionado.endereco || ''}, {clienteSelecionado.numero || ''} - {clienteSelecionado.bairro || 'PIRACICABA'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrintFichaTermica(clienteSelecionado, pedidosDoClienteSelecionado)}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Imprimir espelho na impressora térmica"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Imprimir</span>
                </button>
              </div>

              {/* Saldo Destaque */}
              <div className="p-4 bg-neutral-900 rounded-xl border border-amber-500/30 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-neutral-300">Total a Liquidar:</span>
                <span className="text-xl font-black text-amber-400 font-mono tabular-nums">
                  {formatBRL(clienteSelecionado.saldo_devedor || 0)}
                </span>
              </div>

              {/* Lista de Comandas Vinculadas */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase font-mono block">
                  Comandas Registradas no Histórico:
                </span>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {pedidosDoClienteSelecionado.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80 flex flex-col gap-1.5 font-mono text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">
                          #{p.codigo_senha || p.id} • {(p.criado_em || '').split('T')[0]}
                        </span>
                        <span className="font-black text-amber-400">{formatBRL(p.valor_total)}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 font-sans line-clamp-2">
                        {(p.itens || []).map((it) => `${it.quantidade}x ${it.produto_nome}`).join(' • ')}
                      </div>
                    </div>
                  ))}

                  {pedidosDoClienteSelecionado.length === 0 && (
                    <div className="p-6 text-center text-xs text-neutral-500 font-mono bg-neutral-900/50 rounded-xl">
                      Nenhuma comanda vinculada diretamente no período recente. Saldo pode ter sido consolidado manualmente.
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Atalho para Quitar/Abater no Módulo de Mensalistas */}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('mensalistas')}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-bold uppercase border border-neutral-700/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Realizar Abatimento / Baixa Financeira</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              )}
            </div>
          ) : (
            <div className="bg-neutral-850 p-8 rounded-2xl border border-neutral-800 text-center text-xs text-neutral-500 font-mono">
              Selecione um cliente ao lado para visualizar a ficha de conta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

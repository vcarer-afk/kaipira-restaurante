import React, { useState } from 'react';
import { Mesa, Pedido, Reserva, FormaPagamento, Cliente, ConfiguracoesSistema } from '../types';
import { formatBRL, formatDateTime } from '../utils/formatters';
import { UpperInput } from './UpperInput';
import {
  Users,
  Utensils,
  Receipt,
  CheckCircle,
  Plus,
  CalendarCheck,
  DoorOpen,
  Printer,
  CreditCard,
  QrCode,
  DollarSign,
  Split,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  FileText,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Percent,
} from 'lucide-react';

interface TablesSaloonProps {
  mesas: Mesa[];
  pedidos: Pedido[];
  reservas: Reserva[];
  clientes?: Cliente[];
  configuracoes?: ConfiguracoesSistema;
  onOpenOrderForMesa: (mesaNum: number) => void;
  onUpdateMesaStatus: (mesaNum: number, status: Mesa['status'], cliente_nome?: string, pessoas?: number) => void;
  onFecharMesa: (
    mesaNum: number,
    pagamentos?: { forma: FormaPagamento; valor: number }[],
    clienteMensalistaId?: string,
    pedidosIds?: number[],
    troco?: number
  ) => Promise<void> | void;
  onCreateReserva: (reserva: Partial<Reserva>) => void;
  onPrintReceipt: (pedido: Pedido) => void;
}

interface PagamentoParcial {
  id: string;
  forma: FormaPagamento;
  valor: number;
}

export const TablesSaloon: React.FC<TablesSaloonProps> = ({
  mesas,
  pedidos,
  reservas,
  clientes = [],
  configuracoes,
  onOpenOrderForMesa,
  onUpdateMesaStatus,
  onFecharMesa,
  onCreateReserva,
  onPrintReceipt,
}) => {
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showReservaModal, setShowReservaModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'mapa' | 'reservas'>('mapa');

  // Reservation Form State
  const [resClienteNome, setResClienteNome] = useState('');
  const [resTelefone, setResTelefone] = useState('');
  const [resMesaId, setResMesaId] = useState(1);
  const [resDataHora, setResDataHora] = useState(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [resObs, setResObs] = useState('');

  // Table Opening Form State
  const [abrirClienteNome, setAbrirClienteNome] = useState('');
  const [abrirPessoas, setAbrirPessoas] = useState('2');

  // =========================================================================
  // MODAIS DE FECHAMENTO, CONFERÊNCIA E PAGAMENTO DA MESA
  // =========================================================================
  const [showPreContaModal, setShowPreContaModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const [closeSuccessMessage, setCloseSuccessMessage] = useState<string | null>(null);

  // Split bill state
  const [dividirConta, setDividirConta] = useState(false);
  const [dividirPessoas, setDividirPessoas] = useState<number>(2);

  // Service charge 10% state
  const [incluirTaxaServico, setIncluirTaxaServico] = useState(false);

  // Payment form state
  const [paymentMode, setPaymentMode] = useState<
    'cartao_credito' | 'cartao_debito' | 'pix' | 'dinheiro' | 'multiplo' | 'mensalista'
  >('pix');
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState('');
  const [selectedMensalistaId, setSelectedMensalistaId] = useState<string>('');
  const [pagamentosMultiplos, setPagamentosMultiplos] = useState<PagamentoParcial[]>([]);
  const [novaFormaMultiplo, setNovaFormaMultiplo] = useState<FormaPagamento>('pix');
  const [novoValorMultiplo, setNovoValorMultiplo] = useState('');

  // Filter orders for the selected table
  const currentMesaOrders = selectedMesa
    ? pedidos.filter(
        (p) =>
          p.mesa_id === selectedMesa.numero &&
          !['cancelado'].includes(p.status)
      )
    : [];

  // Active uncompleted orders
  const activeMesaOrders = currentMesaOrders.filter((p) => p.status !== 'entregue');

  // Table active orders to be paid (if all already marked entregue, use currentMesaOrders)
  const ordersToPay = activeMesaOrders.length > 0 ? activeMesaOrders : currentMesaOrders;

  // Calculate items and total consumption
  const mesaConsumoPratos = currentMesaOrders.reduce((acc, p) => acc + p.valor_total, 0);
  const taxaServicoValor = incluirTaxaServico ? Math.round(mesaConsumoPratos * 0.1 * 100) / 100 : 0;
  const mesaConsumoTotal = mesaConsumoPratos + taxaServicoValor;

  const valorPorPessoa =
    dividirConta && dividirPessoas > 0
      ? mesaConsumoTotal / dividirPessoas
      : mesaConsumoTotal;

  // Change calculation for cash payment
  const dinheiroEntregueNum = parseFloat(valorRecebidoDinheiro.replace(',', '.')) || 0;
  const trocoCalculado =
    paymentMode === 'dinheiro' && dinheiroEntregueNum > mesaConsumoTotal
      ? dinheiroEntregueNum - mesaConsumoTotal
      : 0;

  // Multi-payment calculations
  const totalPagoMultiplo = pagamentosMultiplos.reduce((sum, it) => sum + it.valor, 0);
  const restanteMultiplo = Math.max(0, mesaConsumoTotal - totalPagoMultiplo);

  // Mensalistas list
  const mensalistasDisponiveis = clientes.filter((c) => c.eh_mensalista);

  // Quick Open Table
  const handleOpenTable = () => {
    if (!selectedMesa) return;
    const nome = abrirClienteNome ? abrirClienteNome.toUpperCase().trim() : 'MESA OCUPADA';
    const numPessoas = Number(abrirPessoas || 2);
    onUpdateMesaStatus(selectedMesa.numero, 'ocupada', nome, numPessoas);
    setSelectedMesa({
      ...selectedMesa,
      status: 'ocupada',
      cliente_nome: nome,
      pessoas: numPessoas,
    });
    setAbrirClienteNome('');
  };

  // 1. SOLICITAR FECHAMENTO (PEDIR CONTA -> STATUS 'CONTA', AGUARDAR CLIENTE)
  const handleRequestBill = () => {
    if (!selectedMesa) return;
    onUpdateMesaStatus(selectedMesa.numero, 'conta');
    setSelectedMesa({ ...selectedMesa, status: 'conta' });
  };

  // REABRIR MESA (RETORNAR PARA 'OCUPADA')
  const handleReopenTable = () => {
    if (!selectedMesa) return;
    onUpdateMesaStatus(selectedMesa.numero, 'ocupada');
    setSelectedMesa({ ...selectedMesa, status: 'ocupada' });
  };

  // ABRIR TELA DE PAGAMENTOS
  const handleOpenPaymentScreen = () => {
    if (!selectedMesa) return;
    // Pre-populate split with table's people count
    if (selectedMesa.pessoas && selectedMesa.pessoas > 1) {
      setDividirPessoas(selectedMesa.pessoas);
    }
    // Pre-populate multi-payment if needed
    setPagamentosMultiplos([]);
    setValorRecebidoDinheiro('');
    // Pre-select mensalista if table client is mensalista
    const matchedMensalista = mensalistasDisponiveis.find(
      (m) => m.nome.toUpperCase() === (selectedMesa.cliente_nome || '').toUpperCase()
    );
    if (matchedMensalista) {
      setSelectedMensalistaId(matchedMensalista.id);
      setPaymentMode('mensalista');
    } else {
      setSelectedMensalistaId(mensalistasDisponiveis[0]?.id || '');
      setPaymentMode('pix');
    }

    setShowPaymentModal(true);
  };

  // ADICIONAR FORMA NO PAGAMENTO MÚLTIPLO
  const handleAddPagamentoMultiplo = () => {
    const val = parseFloat(novoValorMultiplo.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    const novo: PagamentoParcial = {
      id: 'pg-' + Date.now(),
      forma: novaFormaMultiplo,
      valor: val,
    };
    setPagamentosMultiplos((prev) => [...prev, novo]);
    setNovoValorMultiplo('');
  };

  const handleRemovePagamentoMultiplo = (id: string) => {
    setPagamentosMultiplos((prev) => prev.filter((p) => p.id !== id));
  };

  // BAIXAR, REGISTRAR E ZERAR MESA
  const handleFinalizarEFecharMesa = async () => {
    if (!selectedMesa) return;
    setIsProcessingClose(true);

    // Preparar lista de pagamentos realizados
    let pagamentosFinal: { forma: FormaPagamento; valor: number }[] = [];

    if (paymentMode === 'multiplo') {
      if (totalPagoMultiplo < mesaConsumoTotal - 0.05) {
        alert(
          `O VALOR PAGO (${formatBRL(totalPagoMultiplo)}) É INFERIOR AO TOTAL DA CONTA (${formatBRL(
            mesaConsumoTotal
          )}). ADICIONE OS PAGAMENTOS RESTANTES.`
        );
        setIsProcessingClose(false);
        return;
      }
      pagamentosFinal = pagamentosMultiplos.map((p) => ({ forma: p.forma, valor: p.valor }));
    } else if (paymentMode === 'dinheiro') {
      pagamentosFinal = [{ forma: 'dinheiro', valor: mesaConsumoTotal }];
    } else if (paymentMode === 'mensalista') {
      if (!selectedMensalistaId) {
        alert('POR FAVOR, SELECIONE O CLIENTE MENSALISTA PARA FATURAR A CONTA.');
        setIsProcessingClose(false);
        return;
      }
      pagamentosFinal = [{ forma: 'mensalista', valor: mesaConsumoTotal }];
    } else {
      pagamentosFinal = [{ forma: paymentMode, valor: mesaConsumoTotal }];
    }

    const pedidosIds = ordersToPay.map((o) => o.id);

    try {
      await onFecharMesa(
        selectedMesa.numero,
        pagamentosFinal,
        paymentMode === 'mensalista' ? selectedMensalistaId : undefined,
        pedidosIds,
        trocoCalculado
      );

      const mesaNum = selectedMesa.numero;
      setShowPaymentModal(false);
      setSelectedMesa(null);
      setCloseSuccessMessage(`MESA #${mesaNum} QUITADA, REGISTRADA E LIBERADA COM SUCESSO!`);
      setTimeout(() => setCloseSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Erro ao fechar mesa:', err);
      alert('ERRO AO REGISTRAR BAIXA DA MESA. TENTE NOVAMENTE.');
    } finally {
      setIsProcessingClose(false);
    }
  };

  const handleSubmitReserva = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resClienteNome || !resTelefone) {
      alert('PREENCHA O NOME E TELEFONE DO CLIENTE');
      return;
    }

    onCreateReserva({
      cliente_nome: resClienteNome.toUpperCase(),
      telefone: resTelefone,
      mesa_id: resMesaId,
      data_hora: new Date(resDataHora).toISOString(),
      observacoes: resObs.toUpperCase(),
    });

    setShowReservaModal(false);
    setResClienteNome('');
    setResTelefone('');
    setResObs('');
  };

  const livresCount = mesas.filter((m) => m.status === 'livre').length;
  const ocupadasCount = mesas.filter((m) => m.status === 'ocupada').length;
  const contaCount = mesas.filter((m) => m.status === 'conta').length;
  const reservadasCount = mesas.filter((m) => m.status === 'reservada').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Feedback Banner */}
      {closeSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-800 text-emerald-200 flex items-center justify-between text-xs font-bold uppercase shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{closeSuccessMessage}</span>
          </div>
          <button
            onClick={() => setCloseSuccessMessage(null)}
            className="text-neutral-400 hover:text-white px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar with KPI and reservation switch */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <Utensils className="w-5 h-5 text-amber-500" />
            <span>Salão do Restaurante Kaipira ({mesas.length} Mesas)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Atendimento presencial por garçom, comanda de mesa e fechamento completo de conta
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status KPI indicators */}
          <div className="flex items-center gap-1.5 text-xs font-bold mr-2">
            <span className="text-emerald-400">{livresCount} Livres</span>
            <span className="text-neutral-600">·</span>
            <span className="text-red-400">{ocupadasCount} Ocupadas</span>
            <span className="text-neutral-600">·</span>
            <span className="text-amber-400 font-extrabold animate-pulse">
              {contaCount} Aguardando Conta
            </span>
            <span className="text-neutral-600">·</span>
            <span className="text-purple-400">{reservadasCount} Reservas</span>
          </div>

          <button
            onClick={() => setActiveTab(activeTab === 'mapa' ? 'reservas' : 'mapa')}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 text-purple-400" />
            {activeTab === 'mapa' ? 'Ver Reservas' : 'Ver Mapa de Mesas'}
          </button>
        </div>
      </div>

      {activeTab === 'mapa' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Mesas Grid (8 cols) */}
          <div className="lg:col-span-8 bg-neutral-850 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-4">
              <span className="text-xs font-bold text-neutral-300 uppercase">
                Layout do Salão (Clique na mesa para abrir, lançar pratos ou fechar conta)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {mesas.map((m) => {
                const mesaOrders = pedidos.filter(
                  (p) => p.mesa_id === m.numero && !['cancelado', 'entregue'].includes(p.status)
                );
                const mesaTotal = mesaOrders.reduce((sum, p) => sum + p.valor_total, 0);

                let statusStyle = 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500';
                let badgeStyle = 'text-emerald-400 bg-emerald-950/60';
                let label = 'LIVRE';

                if (m.status === 'ocupada') {
                  statusStyle = 'border-red-800/80 bg-red-950/30 text-white hover:border-red-600';
                  badgeStyle = 'text-red-400 bg-red-950/80';
                  label = 'OCUPADA';
                } else if (m.status === 'conta') {
                  statusStyle =
                    'border-amber-500 bg-amber-950/40 text-white hover:border-amber-400 shadow-md ring-1 ring-amber-500/50';
                  badgeStyle = 'text-amber-300 bg-amber-900/90 animate-pulse font-black';
                  label = 'AGUARDANDO CLIENTE';
                } else if (m.status === 'reservada') {
                  statusStyle = 'border-purple-800/80 bg-purple-950/30 text-white hover:border-purple-600';
                  badgeStyle = 'text-purple-400 bg-purple-950/80';
                  label = 'RESERVA';
                }

                const isSelected = selectedMesa?.numero === m.numero;

                return (
                  <button
                    key={m.numero}
                    onClick={() => setSelectedMesa(m)}
                    className={`p-3 rounded-xl border flex flex-col justify-between text-left transition-all relative cursor-pointer ${statusStyle} ${
                      isSelected ? 'ring-2 ring-amber-400 scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-lg font-black font-mono">#{m.numero}</span>
                      <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${badgeStyle}`}>
                        {label}
                      </span>
                    </div>

                    <div className="my-2 text-[11px] truncate uppercase">
                      {m.cliente_nome ? (
                        <span className="font-bold text-neutral-200">{m.cliente_nome}</span>
                      ) : (
                        <span className="text-neutral-500">Mesa Livre</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] w-full">
                      {m.pessoas ? (
                        <span className="flex items-center gap-1 text-neutral-400">
                          <Users className="w-3 h-3" />
                          {m.pessoas}p
                        </span>
                      ) : (
                        <span className="text-neutral-500">4 lugares</span>
                      )}

                      {mesaTotal > 0 && (
                        <span className="font-bold text-amber-400 tabular-nums">
                          {formatBRL(mesaTotal)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Details Sidebar (4 cols) */}
          <div className="lg:col-span-4 bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between">
            {selectedMesa ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white font-mono">
                      MESA #{selectedMesa.numero}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-xs uppercase font-extrabold px-2 py-0.5 rounded ${
                          selectedMesa.status === 'conta'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            : selectedMesa.status === 'ocupada'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {selectedMesa.status === 'conta'
                          ? '🟡 AGUARDANDO CLIENTE / CONTA'
                          : selectedMesa.status}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenOrderForMesa(selectedMesa.numero)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar Prato
                  </button>
                </div>

                {/* If Mesa is Livre: Offer to open */}
                {selectedMesa.status === 'livre' && (
                  <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 space-y-3">
                    <span className="text-xs font-bold text-neutral-300 uppercase block">
                      Abrir Comanda para Esta Mesa:
                    </span>
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        NOME DO CLIENTE / FAMÍLIA:
                      </label>
                      <UpperInput
                        value={abrirClienteNome}
                        onChange={(e) => setAbrirClienteNome(e.target.value)}
                        placeholder="EX: DR. TOLEDO"
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        NÚMERO DE PESSOAS:
                      </label>
                      <select
                        value={abrirPessoas}
                        onChange={(e) => setAbrirPessoas(e.target.value)}
                        className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                          <option key={n} value={n}>
                            {n} Pessoas
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleOpenTable}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-colors shadow-md cursor-pointer"
                    >
                      Abrir Mesa #{selectedMesa.numero}
                    </button>
                  </div>
                )}

                {/* Table Active Consumption */}
                {selectedMesa.status !== 'livre' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs p-2.5 bg-neutral-900 rounded-lg border border-neutral-800">
                      <div>
                        <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                          Cliente / Ocupante:
                        </span>
                        <span className="font-extrabold text-white uppercase text-xs">
                          {selectedMesa.cliente_nome || 'NÃO INFORMADO'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                          Ocupação:
                        </span>
                        <span className="font-bold text-neutral-200 text-xs">
                          {selectedMesa.pessoas || 2} Pessoas
                        </span>
                      </div>
                    </div>

                    {/* Status Alert for 'conta' (Aguardando Cliente) */}
                    {selectedMesa.status === 'conta' && (
                      <div className="p-3 bg-amber-950/50 border border-amber-800/80 rounded-xl space-y-1.5 animate-in fade-in">
                        <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs uppercase">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
                          <span>Mesa em Fechamento · Aguardando Cliente</span>
                        </div>
                        <p className="text-[11px] text-amber-200/90">
                          A conta foi solicitada. O cliente está conferindo a pré-conta ou aguardando o recebimento.
                        </p>
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPreContaModal(true)}
                            className="text-[11px] text-amber-300 hover:text-white underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            Imprimir Pré-Conta
                          </button>
                          <span className="text-neutral-500">·</span>
                          <button
                            type="button"
                            onClick={handleReopenTable}
                            className="text-[11px] text-neutral-400 hover:text-white underline font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reabrir Mesa
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Orders list for this table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-300 uppercase">
                        <span>Comandas Lançadas:</span>
                        <span className="text-[11px] text-neutral-500 font-mono">
                          {currentMesaOrders.length} {currentMesaOrders.length === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      </div>

                      {currentMesaOrders.length === 0 ? (
                        <div className="text-xs text-neutral-500 italic p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-center">
                          Nenhum prato lançado ainda nesta mesa.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {currentMesaOrders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 text-xs space-y-1"
                            >
                              <div className="flex justify-between font-bold">
                                <span className="text-neutral-200">
                                  Senha #{ord.codigo_senha}{' '}
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                                      ord.status === 'entregue'
                                        ? 'bg-emerald-950 text-emerald-300'
                                        : 'bg-neutral-800 text-amber-400'
                                    }`}
                                  >
                                    {ord.status}
                                  </span>
                                </span>
                                <span className="tabular-nums text-amber-400 font-black">
                                  {formatBRL(ord.valor_total)}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                {ord.itens.map((it) => `${it.quantidade}x ${it.produto_nome}`).join(', ')}
                              </div>
                              <button
                                onClick={() => onPrintReceipt(ord)}
                                className="text-[10px] text-neutral-400 hover:text-amber-400 flex items-center gap-1 pt-1 cursor-pointer"
                              >
                                <Receipt className="w-3 h-3" />
                                Imprimir Comanda de Cozinha
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Total consumption */}
                    <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                      <div className="flex justify-between text-xs text-neutral-400">
                        <span>Total Consumo Mesa:</span>
                        <span className="text-base font-black text-amber-400 tabular-nums">
                          {formatBRL(mesaConsumoTotal)}
                        </span>
                      </div>
                      {selectedMesa.pessoas && selectedMesa.pessoas > 1 && (
                        <div className="flex justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-800">
                          <span>Estimativa por pessoa ({selectedMesa.pessoas}p):</span>
                          <span className="text-cyan-400 font-bold tabular-nums">
                            {formatBRL(mesaConsumoTotal / selectedMesa.pessoas)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions Workflow: Fechamento, Imprimir Pré-conta e Pagar */}
                    <div className="flex flex-col gap-2 pt-1">
                      {selectedMesa.status === 'ocupada' && (
                        <button
                          onClick={handleRequestBill}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Clock className="w-4 h-4" />
                          <span>Solicitar Fechamento (Pedir Conta)</span>
                        </button>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowPreContaModal(true)}
                          className="py-2.5 px-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Imprime a conferência da mesa para levar ao cliente"
                        >
                          <Printer className="w-4 h-4 text-cyan-400" />
                          <span>Imprimir Conta</span>
                        </button>

                        <button
                          onClick={handleOpenPaymentScreen}
                          className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Pagar & Fechar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-neutral-500">
                SELECIONE UMA MESA NO MAPA PARA VISUALIZAR, ATENDER OU FECHAR A CONTA
              </div>
            )}
          </div>
        </div>
      ) : (
        /* RESERVAS VIEW */
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-purple-400" />
              <span>Gerenciamento de Reservas de Mesas</span>
            </h3>

            <button
              onClick={() => setShowReservaModal(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Reserva
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reservas.length === 0 ? (
              <div className="col-span-3 py-8 text-center text-xs text-neutral-500">
                NENHUMA RESERVA AGENDADA
              </div>
            ) : (
              reservas.map((res) => (
                <div
                  key={res.id}
                  className="p-4 bg-neutral-900 rounded-xl border border-purple-900/60 flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white uppercase text-sm">
                        {res.cliente_nome}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-950 text-purple-300 border border-purple-800">
                        MESA #{res.mesa_id}
                      </span>
                    </div>

                    <div className="text-neutral-400 space-y-1 text-[11px]">
                      <div>TEL: {res.telefone}</div>
                      <div>HORÁRIO: {formatDateTime(res.data_hora)}</div>
                      {res.observacoes && (
                        <div className="text-neutral-300 uppercase font-medium">
                          OBS: {res.observacoes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">
                      STATUS: {res.status}
                    </span>
                    <button
                      onClick={() => onOpenOrderForMesa(res.mesa_id)}
                      className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
                    >
                      Abrir Mesa #{res.mesa_id}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: IMPRIMIR PRÉ-CONTA / CONFERÊNCIA DE MESA (80MM TÉRMICA)
          ========================================================================= */}
      {showPreContaModal && selectedMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-850">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-black text-white uppercase">
                  Conferência de Mesa #{selectedMesa.numero}
                </span>
              </div>
              <button
                onClick={() => setShowPreContaModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Thermal Receipt Area */}
            <div className="overflow-y-auto p-4 bg-neutral-950 flex justify-center flex-1">
              <div
                id="thermal-table-bill"
                className="w-[78mm] bg-white text-black p-4 font-mono text-[11px] leading-snug shadow-md rounded-xs border border-neutral-300"
              >
                <div className="text-center pb-2 border-b border-dashed border-black">
                  <h2 className="text-sm font-bold tracking-tight uppercase">
                    {configuracoes?.nomeRestaurante || 'RESTAURANTE KAIPIRA'}
                  </h2>
                  <p className="text-[10px] uppercase">COMIDA TÍPICA DA ROÇA NA COZINHA</p>
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
                    *** CONFERÊNCIA DE MESA ***
                  </span>
                  <div className="text-2xl font-black my-1">MESA #{selectedMesa.numero}</div>
                  <div className="text-[10px]">
                    CLIENTE: <strong className="uppercase">{selectedMesa.cliente_nome || 'CONSUMO SALÃO'}</strong>
                  </div>
                  {selectedMesa.pessoas && (
                    <div className="text-[10px]">OCUPANTES: {selectedMesa.pessoas} PESSOAS</div>
                  )}
                  <div className="text-[10px] text-neutral-600 mt-0.5">
                    EMISSÃO: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}
                  </div>
                </div>

                {/* Items Detail */}
                <div className="py-2 border-b border-dashed border-black">
                  <div className="flex justify-between font-bold text-[10px] mb-1">
                    <span>QTD · ITEM</span>
                    <span>VALOR</span>
                  </div>
                  <div className="space-y-1.5">
                    {currentMesaOrders.flatMap((ord) => ord.itens).length === 0 ? (
                      <div className="text-center italic text-neutral-500">Nenhum item lançado</div>
                    ) : (
                      currentMesaOrders.flatMap((ord) => ord.itens).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start text-[10px]">
                          <span className="truncate pr-2 font-medium">
                            {it.quantidade}x {it.produto_nome}
                          </span>
                          <span className="tabular-nums font-bold shrink-0">
                            {formatBRL(it.preco_unitario * it.quantidade)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>SUBTOTAL PRATOS:</span>
                    <span className="tabular-nums font-bold">{formatBRL(mesaConsumoPratos)}</span>
                  </div>

                  {incluirTaxaServico && (
                    <div className="flex justify-between text-neutral-700">
                      <span>SERVIÇO (10% OPCIONAL):</span>
                      <span className="tabular-nums font-bold">{formatBRL(taxaServicoValor)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                    <span>TOTAL GERAL:</span>
                    <span className="tabular-nums">{formatBRL(mesaConsumoTotal)}</span>
                  </div>

                  {dividirConta && dividirPessoas > 1 && (
                    <div className="pt-1.5 mt-1 border-t border-dashed border-black text-[10px] font-bold">
                      <div className="flex justify-between">
                        <span>DIVISÃO ({dividirPessoas} PESSOAS):</span>
                        <span className="tabular-nums">{formatBRL(valorPorPessoa)} cada</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* PIX QR info */}
                <div className="py-2 border-b border-dashed border-black text-center text-[10px]">
                  <p className="font-bold">ACEITAMOS PIX · CARTÃO · DINHEIRO</p>
                  <p className="mt-0.5">CHAVE PIX: CNPJ / EMAIL RESTAURANTE</p>
                </div>

                <div className="text-center pt-2 text-[9px] text-neutral-600">
                  <p>ESTE DOCUMENTO NÃO É DOCUMENTO FISCAL</p>
                  <p>OBRIGADO PELA PREFERÊNCIA!</p>
                  <p className="mt-1 font-mono">RESTAURANTE KAIPIRA</p>
                </div>
              </div>
            </div>

            {/* Footer Toolbar */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-850 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-neutral-300 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirTaxaServico}
                  onChange={(e) => setIncluirTaxaServico(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span>Incluir 10% Serviço</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreContaModal(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Agora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: TELA COMPLETA DE PAGAMENTO, DIVISÃO E FECHAMENTO DE MESA
          ========================================================================= */}
      {showPaymentModal && selectedMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-850">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/40">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">
                    Pagamento & Fechamento da Mesa #{selectedMesa.numero}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Cliente: <strong className="text-white uppercase">{selectedMesa.cliente_nome || 'SALÃO'}</strong> ·{' '}
                    {selectedMesa.pessoas || 2} Lugares
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {/* Financial Summary Box */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-neutral-400 uppercase font-bold block">
                    Valor Total da Mesa:
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">
                      {formatBRL(mesaConsumoTotal)}
                    </span>
                    {incluirTaxaServico && (
                      <span className="text-xs text-neutral-400">(inclui 10% de serviço)</span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Subtotal dos Pratos: {formatBRL(mesaConsumoPratos)}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-neutral-300 font-bold bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={incluirTaxaServico}
                      onChange={(e) => setIncluirTaxaServico(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span>Taxa de Serviço 10% ({formatBRL(mesaConsumoPratos * 0.1)})</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowPreContaModal(true)}
                    className="text-xs text-neutral-300 hover:text-white bg-neutral-850 hover:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Conferência / Pré-Conta</span>
                  </button>
                </div>
              </div>

              {/* 1. Opção: Dividir Conta? */}
              <div className="p-4 rounded-xl bg-neutral-850/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-black uppercase text-white">Dividir a Conta?</span>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-neutral-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dividirConta}
                      onChange={(e) => setDividirConta(e.target.checked)}
                      className="rounded text-purple-500 focus:ring-0"
                    />
                    <span>Ativar Divisão</span>
                  </label>
                </div>

                {dividirConta && (
                  <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-300 font-medium">Dividir em:</span>
                      <div className="flex items-center gap-1">
                        {[2, 3, 4, 5, 6].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setDividirPessoas(num)}
                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              dividirPessoas === num
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={dividirPessoas}
                          onChange={(e) => setDividirPessoas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-12 px-2 py-1 bg-neutral-900 border border-neutral-700 text-center text-xs font-mono font-bold text-white rounded-lg"
                        />
                        <span className="text-xs text-neutral-400">pessoas</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-purple-950/40 border border-purple-800/60 rounded-xl text-right">
                      <span className="text-[10px] text-purple-300 font-bold block uppercase">
                        Valor por Pessoa:
                      </span>
                      <span className="text-base font-black text-purple-200 tabular-nums">
                        {formatBRL(valorPorPessoa)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Seleção da Forma de Pagamento */}
              <div className="space-y-3">
                <span className="text-xs font-black uppercase text-neutral-300 block">
                  Escolha a Forma de Pagamento:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cartao_credito')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMode === 'cartao_credito'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-amber-300" />
                    <span className="text-xs font-black uppercase">Cartão Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('cartao_debito')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMode === 'cartao_debito'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-cyan-300" />
                    <span className="text-xs font-black uppercase">Cartão Débito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('pix')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMode === 'pix'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-black uppercase">PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('dinheiro')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMode === 'dinheiro'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <DollarSign className="w-5 h-5 text-emerald-300" />
                    <span className="text-xs font-black uppercase">Dinheiro (Espécie)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('multiplo')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMode === 'multiplo'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <Layers className="w-5 h-5 text-purple-300" />
                    <span className="text-xs font-black uppercase">Múltiplos / Combinação</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('mensalista')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMode === 'mensalista'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <UserCheck className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-black uppercase">Mensalista (Conta)</span>
                  </button>
                </div>

                {/* Detalhes específicos de cada forma */}
                {/* 1. DINHEIRO COM TROCO */}
                {paymentMode === 'dinheiro' && (
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 animate-in fade-in">
                    <span className="text-xs font-bold text-neutral-300 uppercase block">
                      Recebimento em Dinheiro & Troco:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-neutral-400 font-bold block mb-1">
                          VALOR RECEBIDO DO CLIENTE (R$):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-neutral-500 text-xs font-bold">R$</span>
                          <input
                            type="text"
                            value={valorRecebidoDinheiro}
                            onChange={(e) => setValorRecebidoDinheiro(e.target.value)}
                            placeholder={mesaConsumoTotal.toFixed(2)}
                            className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-emerald-400 font-mono font-bold rounded-lg text-sm focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 flex flex-col justify-center">
                        <span className="text-[11px] text-neutral-400 uppercase font-bold">
                          Troco a Devolver:
                        </span>
                        <span
                          className={`text-xl font-black font-mono tabular-nums ${
                            trocoCalculado > 0 ? 'text-amber-400' : 'text-neutral-500'
                          }`}
                        >
                          {formatBRL(trocoCalculado)}
                        </span>
                      </div>
                    </div>

                    {/* Quick suggestion buttons for cash */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-neutral-500 font-bold">Valores rápidos:</span>
                      {[
                        mesaConsumoTotal,
                        Math.ceil(mesaConsumoTotal / 10) * 10,
                        Math.ceil(mesaConsumoTotal / 50) * 50 || 50,
                        100,
                      ]
                        .filter((v, i, a) => a.indexOf(v) === i && v >= mesaConsumoTotal)
                        .map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setValorRecebidoDinheiro(val.toFixed(2))}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] font-mono font-bold cursor-pointer"
                          >
                            {formatBRL(val)}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* 2. PIX */}
                {paymentMode === 'pix' && (
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                    <div className="space-y-1 text-xs">
                      <span className="font-black text-emerald-400 uppercase flex items-center gap-1.5">
                        <QrCode className="w-4 h-4" />
                        Chave PIX Pronta para Cobrança
                      </span>
                      <p className="text-neutral-400">
                        Apresente a maquininha ou informe a chave PIX do restaurante para o cliente escanear e transferir.
                      </p>
                      <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-[11px] text-neutral-300 mt-2">
                        CHAVE: restaurante@kaipirapiracicaba.com.br (CNPJ)
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl flex flex-col items-center justify-center shrink-0 shadow-md">
                      <QrCode className="w-20 h-20 text-neutral-900" />
                      <span className="text-[9px] font-mono font-bold text-neutral-800 mt-1">
                        PIX {formatBRL(mesaConsumoTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. COMBINAÇÃO DE PAGAMENTOS (MÚLTIPLOS) */}
                {paymentMode === 'multiplo' && (
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-purple-300">
                        Lançamento de Múltiplas Formas de Pagamento:
                      </span>
                      <span
                        className={`text-xs font-black font-mono px-2 py-0.5 rounded ${
                          restanteMultiplo <= 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {restanteMultiplo <= 0 ? '✓ 100% QUITADO' : `FALTA: ${formatBRL(restanteMultiplo)}`}
                      </span>
                    </div>

                    {/* Form to add partial payment */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={novaFormaMultiplo}
                        onChange={(e) => setNovaFormaMultiplo(e.target.value as FormaPagamento)}
                        className="px-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-200 rounded-lg text-xs font-bold"
                      >
                        <option value="pix">PIX</option>
                        <option value="cartao_credito">Cartão Crédito</option>
                        <option value="cartao_debito">Cartão Débito</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>

                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-neutral-500 text-xs font-bold">R$</span>
                        <input
                          type="text"
                          value={novoValorMultiplo}
                          onChange={(e) => setNovoValorMultiplo(e.target.value)}
                          placeholder={restanteMultiplo > 0 ? restanteMultiplo.toFixed(2) : '0.00'}
                          className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-white font-mono font-bold rounded-lg text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddPagamentoMultiplo}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar</span>
                      </button>
                    </div>

                    {/* List of partial payments added */}
                    <div className="space-y-1.5 pt-1">
                      {pagamentosMultiplos.length === 0 ? (
                        <div className="text-[11px] text-neutral-500 italic p-2 bg-neutral-900 rounded-lg text-center">
                          Nenhum pagamento parcial adicionado ainda.
                        </div>
                      ) : (
                        pagamentosMultiplos.map((pg) => (
                          <div
                            key={pg.id}
                            className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg border border-neutral-800 text-xs"
                          >
                            <span className="font-bold uppercase text-neutral-200">
                              {pg.forma.replace('_', ' ')}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-black text-amber-400">
                                {formatBRL(pg.valor)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePagamentoMultiplo(pg.id)}
                                className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. MENSALISTA */}
                {paymentMode === 'mensalista' && (
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 animate-in fade-in">
                    <span className="text-xs font-black uppercase text-blue-400 block">
                      Faturar na Conta de Cliente Mensalista:
                    </span>

                    {mensalistasDisponiveis.length === 0 ? (
                      <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-200">
                        Nenhum cliente cadastrado como Mensalista no sistema. Cadastre clientes mensalistas na Central de Cadastros.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[11px] text-neutral-400 font-bold block">
                          SELECIONE O CLIENTE MENSALISTA:
                        </label>
                        <select
                          value={selectedMensalistaId}
                          onChange={(e) => setSelectedMensalistaId(e.target.value)}
                          className="w-full px-3 py-2.5 bg-neutral-850 border border-neutral-700 text-white rounded-xl text-xs font-bold"
                        >
                          {mensalistasDisponiveis.map((cli) => (
                            <option key={cli.id} value={cli.id}>
                              {cli.nome} · Saldo Devedor Atual: {formatBRL(cli.saldo_devedor || 0)}
                            </option>
                          ))}
                        </select>

                        <div className="p-2.5 bg-blue-950/30 border border-blue-800/50 rounded-xl text-[11px] text-blue-200">
                          ℹ️ O valor integral da conta (<strong>{formatBRL(mesaConsumoTotal)}</strong>) será acumulado no saldo devedor do mensalista e gravado na nuvem Supabase.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: Action Buttons */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-850 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Voltar (Aguardar Cliente)
              </button>

              <button
                type="button"
                onClick={handleFinalizarEFecharMesa}
                disabled={isProcessingClose}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-98 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5 text-white" />
                <span>
                  {isProcessingClose
                    ? 'Baixando e Liberando...'
                    : `Baixar, Registrar & Liberar Mesa #${selectedMesa.numero}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: NOVA RESERVA
          ========================================================================= */}
      {showReservaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitReserva}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-purple-400" />
                <span>Agendar Nova Reserva</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowReservaModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                NOME DO CLIENTE: *
              </label>
              <UpperInput
                required
                value={resClienteNome}
                onChange={setResClienteNome}
                placeholder="EX: FAMÍLIA PEREIRA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                TELEFONE: *
              </label>
              <input
                type="text"
                required
                value={resTelefone}
                onChange={(e) => setResTelefone(e.target.value)}
                placeholder="(19) 98765-4321"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  MESA:
                </label>
                <select
                  value={resMesaId}
                  onChange={(e) => setResMesaId(Number(e.target.value))}
                  className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white"
                >
                  {mesas.map((m) => (
                    <option key={m.numero} value={m.numero}>
                      Mesa #{m.numero} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  DATA & HORA:
                </label>
                <input
                  type="datetime-local"
                  value={resDataHora}
                  onChange={(e) => setResDataHora(e.target.value)}
                  className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white"
                >
                </input>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                OBSERVAÇÕES (OPCIONAL):
              </label>
              <UpperInput
                value={resObs}
                onChange={setResObs}
                placeholder="EX: ANIVERSÁRIO, 6 PESSOAS"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowReservaModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                Confirmar Reserva
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

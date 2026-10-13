import React, { useState } from 'react';
import { Mesa, Pedido, Reserva, FormaPagamento } from '../types';
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
} from 'lucide-react';

interface TablesSaloonProps {
  mesas: Mesa[];
  pedidos: Pedido[];
  reservas: Reserva[];
  onOpenOrderForMesa: (mesaNum: number) => void;
  onUpdateMesaStatus: (mesaNum: number, status: Mesa['status'], cliente_nome?: string, pessoas?: number) => void;
  onFecharMesa: (mesaNum: number) => void;
  onCreateReserva: (reserva: Partial<Reserva>) => void;
  onPrintReceipt: (pedido: Pedido) => void;
}

export const TablesSaloon: React.FC<TablesSaloonProps> = ({
  mesas,
  pedidos,
  reservas,
  onOpenOrderForMesa,
  onUpdateMesaStatus,
  onFecharMesa,
  onCreateReserva,
  onPrintReceipt,
}) => {
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showReservaModal, setShowReservaModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'mapa' | 'reservas'>('mapa');

  // New Reservation Form
  const [resClienteNome, setResClienteNome] = useState('');
  const [resTelefone, setResTelefone] = useState('');
  const [resMesaId, setResMesaId] = useState(1);
  const [resDataHora, setResDataHora] = useState(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [resObs, setResObs] = useState('');

  // Table Opening Form
  const [abrirClienteNome, setAbrirClienteNome] = useState('');
  const [abrirPessoas, setAbrirPessoas] = useState('2');

  // Filter orders for the selected table
  const currentMesaOrders = selectedMesa
    ? pedidos.filter(
        (p) =>
          p.mesa_id === selectedMesa.numero &&
          !['cancelado'].includes(p.status)
      )
    : [];

  const activeMesaOrders = currentMesaOrders.filter((p) => p.status !== 'entregue');

  const mesaConsumoTotal = currentMesaOrders.reduce((acc, p) => acc + p.valor_total, 0);

  const handleOpenTable = () => {
    if (!selectedMesa) return;
    onUpdateMesaStatus(
      selectedMesa.numero,
      'ocupada',
      abrirClienteNome ? abrirClienteNome.toUpperCase() : 'MESA OCUPADA',
      Number(abrirPessoas || 2)
    );
    setSelectedMesa({
      ...selectedMesa,
      status: 'ocupada',
      cliente_nome: abrirClienteNome ? abrirClienteNome.toUpperCase() : 'MESA OCUPADA',
      pessoas: Number(abrirPessoas || 2),
    });
    setAbrirClienteNome('');
  };

  const handleRequestBill = () => {
    if (!selectedMesa) return;
    onUpdateMesaStatus(selectedMesa.numero, 'conta');
    setSelectedMesa({ ...selectedMesa, status: 'conta' });
  };

  const handleFreeTable = () => {
    if (!selectedMesa) return;
    onFecharMesa(selectedMesa.numero);
    setSelectedMesa(null);
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
      {/* Top Bar with KPI and reservation switch */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <Utensils className="w-5 h-5 text-amber-500" />
            <span>Salão do Restaurante Kaipira (20 Mesas)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Atendimento presencial por garçom ou comanda de mesa
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status KPI indicators */}
          <div className="flex items-center gap-1.5 text-xs font-bold mr-2">
            <span className="text-emerald-400">{livresCount} Livres</span>
            <span className="text-neutral-600">·</span>
            <span className="text-red-400">{ocupadasCount} Ocupadas</span>
            <span className="text-neutral-600">·</span>
            <span className="text-amber-400">{contaCount} Conta</span>
            <span className="text-neutral-600">·</span>
            <span className="text-purple-400">{reservadasCount} Reservas</span>
          </div>

          <button
            onClick={() => setActiveTab(activeTab === 'mapa' ? 'reservas' : 'mapa')}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <CalendarCheck className="w-4 h-4 text-purple-400" />
            {activeTab === 'mapa' ? 'Ver Reservas' : 'Ver Mapa de Mesas'}
          </button>
        </div>
      </div>

      {activeTab === 'mapa' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 20 Mesas Grid (8 cols) */}
          <div className="lg:col-span-8 bg-neutral-850 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-4">
              <span className="text-xs font-bold text-neutral-300 uppercase">
                Layout do Salão (Clique na mesa para gerenciar ou lançar pedidos)
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
                  statusStyle = 'border-amber-600 bg-amber-950/30 text-white hover:border-amber-500';
                  badgeStyle = 'text-amber-400 bg-amber-950/80';
                  label = 'CONTA';
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
                    className={`p-3 rounded-xl border flex flex-col justify-between text-left transition-all relative ${statusStyle} ${
                      isSelected ? 'ring-2 ring-amber-400 scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-lg font-black font-mono">
                        #{m.numero}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${badgeStyle}`}>
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
                      DETALHES DA MESA #{selectedMesa.numero}
                    </h3>
                    <span className="text-xs uppercase font-bold text-amber-400">
                      STATUS: {selectedMesa.status}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenOrderForMesa(selectedMesa.numero)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
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
                    <UpperInput
                      label="NOME DO CLIENTE / FAMÍLIA:"
                      value={abrirClienteNome}
                      onChange={setAbrirClienteNome}
                      placeholder="EX: DR. TOLEDO"
                    />
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        NÚMERO DE PESSOAS:
                      </label>
                      <select
                        value={abrirPessoas}
                        onChange={(e) => setAbrirPessoas(e.target.value)}
                        className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                          <option key={n} value={n}>
                            {n} Pessoas
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleOpenTable}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-colors"
                    >
                      Abrir Mesa #{selectedMesa.numero}
                    </button>
                  </div>
                )}

                {/* Table Active Consumption */}
                {selectedMesa.status !== 'livre' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400">Cliente:</span>
                      <span className="font-bold text-white uppercase">
                        {selectedMesa.cliente_nome || 'NÃO INFORMADO'}
                      </span>
                    </div>

                    {/* Orders list for this table */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-neutral-300 uppercase block">
                        Comandas Lançadas:
                      </span>
                      {currentMesaOrders.length === 0 ? (
                        <div className="text-xs text-neutral-500 italic p-3 bg-neutral-900 rounded-lg">
                          Nenhum prato lançado ainda nesta mesa.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {currentMesaOrders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 text-xs space-y-1"
                            >
                              <div className="flex justify-between font-bold">
                                <span>Senha #{ord.codigo_senha} ({ord.status})</span>
                                <span className="tabular-nums text-amber-400">
                                  {formatBRL(ord.valor_total)}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                {ord.itens.map((it) => `${it.quantidade}x ${it.produto_nome}`).join(', ')}
                              </div>
                              <button
                                onClick={() => onPrintReceipt(ord)}
                                className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 pt-1"
                              >
                                <Receipt className="w-3 h-3" />
                                Imprimir Comanda
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
                        <span className="text-sm font-black text-amber-400 tabular-nums">
                          {formatBRL(mesaConsumoTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2">
                      {selectedMesa.status === 'ocupada' && (
                        <button
                          onClick={handleRequestBill}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase transition-colors"
                        >
                          Solicitar Fechamento (Pedir Conta)
                        </button>
                      )}

                      <button
                        onClick={handleFreeTable}
                        className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Fechar Conta & Liberar Mesa #{selectedMesa.numero}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-neutral-500">
                SELECIONE UMA MESA NO MAPA PARA VISUALIZAR OU ATENDER
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
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
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
                      className="text-xs text-amber-400 hover:underline font-bold"
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

      {/* NEW RESERVATION MODAL */}
      {showReservaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitReserva}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase">
                Nova Reserva de Mesa
              </h3>
              <button
                type="button"
                onClick={() => setShowReservaModal(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <UpperInput
              label="NOME DO CLIENTE / EMPRESA: *"
              value={resClienteNome}
              onChange={setResClienteNome}
              placeholder="EX: DR. CARLOS EDUARDO"
              required
            />

            <UpperInput
              label="TELEFONE DE CONTATO: *"
              maskType="phone"
              value={resTelefone}
              onChange={setResTelefone}
              placeholder="(19) 9-9999-9999"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  MESA (1 A 20):
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
                />
              </div>
            </div>

            <UpperInput
              label="OBSERVAÇÕES (OPCIONAL):"
              value={resObs}
              onChange={setResObs}
              placeholder="EX: ANIVERSÁRIO, 6 PESSOAS"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowReservaModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase"
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

import React, { useState } from 'react';
import { CaixaDiario, FormaPagamento } from '../types';
import { formatBRL, formatDateTime } from '../utils/formatters';
import { UpperInput } from './UpperInput';
import {
  Banknote,
  DollarSign,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';

interface CashRegisterProps {
  caixa: CaixaDiario;
  onAbrirCaixa: (valor: number, observacoes?: string) => void;
  onFecharCaixa: (valor: number, observacoes?: string) => void;
  onMovimentacao: (tipo: 'suprimento' | 'sangria', forma: FormaPagamento, valor: number, descricao: string) => void;
}

export const CashRegister: React.FC<CashRegisterProps> = ({
  caixa,
  onAbrirCaixa,
  onFecharCaixa,
  onMovimentacao,
}) => {
  // Modal states
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('250.00');
  const [obsAbertura, setObsAbertura] = useState('');

  const [showFecharModal, setShowFecharModal] = useState(false);
  const [valorFechamento, setValorFechamento] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');

  const [showMovModal, setShowMovModal] = useState(false);
  const [tipoMov, setTipoMov] = useState<'suprimento' | 'sangria'>('sangria');
  const [valorMov, setValorMov] = useState('');
  const [descMov, setDescMov] = useState('');

  // Computations
  const movs = caixa.movimentacoes || [];

  const totalPorForma = {
    dinheiro: 0,
    pix: 0,
    cartao_debito: 0,
    cartao_credito: 0,
    mensalista: 0,
  };

  let totalSangrias = 0;
  let totalSuprimentos = 0;

  movs.forEach((m) => {
    if (m.tipo === 'entrada_pedido') {
      if (m.forma && m.forma in totalPorForma) {
        totalPorForma[m.forma as keyof typeof totalPorForma] += m.valor;
      }
    } else if (m.tipo === 'sangria') {
      totalSangrias += m.valor;
    } else if (m.tipo === 'suprimento') {
      totalSuprimentos += m.valor;
    }
  });

  const totalVendas =
    totalPorForma.dinheiro +
    totalPorForma.pix +
    totalPorForma.cartao_debito +
    totalPorForma.cartao_credito +
    totalPorForma.mensalista;

  const dinheiroNaGaveta =
    (caixa.valor_abertura || 0) +
    totalPorForma.dinheiro +
    (totalSuprimentos - caixa.valor_abertura) -
    totalSangrias;

  const handleConfirmAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    onAbrirCaixa(Number(valorAbertura || 0), obsAbertura);
    setShowAbrirModal(false);
  };

  const handleConfirmFechar = (e: React.FormEvent) => {
    e.preventDefault();
    onFecharCaixa(Number(valorFechamento || dinheiroNaGaveta), obsFechamento);
    setShowFecharModal(false);
  };

  const handleConfirmMov = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorMov || !descMov) return;
    onMovimentacao(tipoMov, 'dinheiro', Number(valorMov), descMov);
    setShowMovModal(false);
    setValorMov('');
    setDescMov('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Caixa Header */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-extrabold text-white uppercase">
              Caixa Diário Único · Restaurante Kaipira
            </h2>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                caixa.status === 'aberto'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-red-950 text-red-400 border border-red-800'
              }`}
            >
              {caixa.status === 'aberto' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Data: {caixa.data_caixa} · Abertura às {caixa.aberto_em ? caixa.aberto_em.slice(11, 16) : '--:--'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {caixa.status === 'aberto' ? (
            <>
              <button
                onClick={() => {
                  setTipoMov('sangria');
                  setShowMovModal(true);
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-bold transition-colors"
              >
                Sangria / Suprimento
              </button>
              <button
                onClick={() => {
                  setValorFechamento(dinheiroNaGaveta.toFixed(2));
                  setShowFecharModal(true);
                }}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors uppercase"
              >
                <Lock className="w-3.5 h-3.5" />
                Fechar Caixa
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAbrirModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors uppercase"
            >
              <Unlock className="w-4 h-4" />
              Abrir Caixa do Dia
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Vendas */}
        <div className="bg-neutral-850 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-neutral-400 uppercase">
            Total Vendas Hoje:
          </span>
          <span className="text-xl font-black text-amber-400 tabular-nums mt-1">
            {formatBRL(totalVendas)}
          </span>
          <span className="text-[10px] text-neutral-500 mt-1">
            Salão + Delivery + Balcão
          </span>
        </div>

        {/* Dinheiro na gaveta */}
        <div className="bg-neutral-850 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-neutral-400 uppercase">
            Dinheiro Físico Gaveta:
          </span>
          <span className="text-xl font-black text-emerald-400 tabular-nums mt-1">
            {formatBRL(dinheiroNaGaveta)}
          </span>
          <span className="text-[10px] text-neutral-500 mt-1">
            Troco + Entradas - Sangrias
          </span>
        </div>

        {/* Fundo de Troco */}
        <div className="bg-neutral-850 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-neutral-400 uppercase">
            Fundo de Troco Inicial:
          </span>
          <span className="text-xl font-black text-neutral-200 tabular-nums mt-1">
            {formatBRL(caixa.valor_abertura || 0)}
          </span>
          <span className="text-[10px] text-neutral-500 mt-1">
            Moedas e cédulas miúdas
          </span>
        </div>

        {/* Sangrias Efetuadas */}
        <div className="bg-neutral-850 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-neutral-400 uppercase">
            Total de Sangrias:
          </span>
          <span className="text-xl font-black text-red-400 tabular-nums mt-1">
            {formatBRL(totalSangrias)}
          </span>
          <span className="text-[10px] text-neutral-500 mt-1">
            Retiradas de segurança
          </span>
        </div>
      </div>

      {/* Breakdown by Payment Method & Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Breakdown by Payment Method (4 cols) */}
        <div className="lg:col-span-4 bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-white uppercase border-b border-neutral-800 pb-2">
            Faturamento por Forma de Pagamento
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="font-semibold text-neutral-300">PIX (Banco)</span>
              <span className="font-black text-emerald-400 tabular-nums">
                {formatBRL(totalPorForma.pix)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="font-semibold text-neutral-300">Dinheiro (Espécie)</span>
              <span className="font-black text-white tabular-nums">
                {formatBRL(totalPorForma.dinheiro)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="font-semibold text-neutral-300">Cartão de Débito</span>
              <span className="font-black text-white tabular-nums">
                {formatBRL(totalPorForma.cartao_debito)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="font-semibold text-neutral-300">Cartão de Crédito</span>
              <span className="font-black text-white tabular-nums">
                {formatBRL(totalPorForma.cartao_credito)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="font-semibold text-amber-300">Mensalista (Faturado)</span>
              <span className="font-black text-amber-400 tabular-nums">
                {formatBRL(totalPorForma.mensalista)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Ledger / Movement Log (8 cols) */}
        <div className="lg:col-span-8 bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-xs font-bold text-white uppercase">
              Extrato Detalhado de Movimentações ({movs.length})
            </h3>
            <span className="text-[11px] text-neutral-400 font-mono">
              HORÁRIO DE BRASÍLIA
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {movs.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                NENHUMA MOVIMENTAÇÃO REGISTRADA NESTE CAIXA
              </div>
            ) : (
              [...movs].reverse().map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {m.tipo === 'sangria' ? (
                      <ArrowDownCircle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-white uppercase">
                        {m.descricao}
                      </div>
                      <div className="text-[10px] text-neutral-500 uppercase">
                        {m.hora} · FORMA: {m.forma || 'GERAL'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`font-black tabular-nums ${
                      m.tipo === 'sangria' ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {m.tipo === 'sangria' ? '-' : '+'} {formatBRL(m.valor)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ABRIR CAIXA MODAL */}
      {showAbrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAbrir}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase">
                Abertura do Caixa Diário
              </h3>
              <button
                type="button"
                onClick={() => setShowAbrirModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                FUNDO DE TROCO INICIAL EM DINHEIRO (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorAbertura}
                onChange={(e) => setValorAbertura(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-sm tabular-nums focus:outline-none"
              />
            </div>

            <UpperInput
              label="OBSERVAÇÕES DA ABERTURA:"
              value={obsAbertura}
              onChange={setObsAbertura}
              placeholder="EX: TROCO CONFERIDO EM MOEDAS E NOTAS"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAbrirModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Confirmar Abertura
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FECHAR CAIXA MODAL */}
      {showFecharModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmFechar}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase">
                Fechamento do Caixa Diário
              </h3>
              <button
                type="button"
                onClick={() => setShowFecharModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-neutral-850 rounded-lg border border-neutral-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Vendas do Dia:</span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {formatBRL(totalVendas)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Dinheiro Esperado na Gaveta:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {formatBRL(dinheiroNaGaveta)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                VALOR FÍSICO CONFERIDO NA GAVETA (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorFechamento}
                onChange={(e) => setValorFechamento(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-sm tabular-nums focus:outline-none"
              />
            </div>

            <UpperInput
              label="OBSERVAÇÕES DO FECHAMENTO:"
              value={obsFechamento}
              onChange={setObsFechamento}
              placeholder="EX: CAIXA BATIDO SEM DIFERENÇA"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowFecharModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Encerrar Caixa Diário
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SANGRIA / SUPRIMENTO MODAL */}
      {showMovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmMov}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase">
                Movimentação Avulsa de Caixa
              </h3>
              <button
                type="button"
                onClick={() => setShowMovModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1 uppercase">
                Tipo de Operação:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMov('sangria')}
                  className={`py-2 text-xs font-bold rounded-lg ${
                    tipoMov === 'sangria' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Sangria (Retirada)
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMov('suprimento')}
                  className={`py-2 text-xs font-bold rounded-lg ${
                    tipoMov === 'suprimento' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Suprimento (Entrada)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                VALOR (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorMov}
                onChange={(e) => setValorMov(e.target.value)}
                placeholder="Ex: 50.00"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-sm tabular-nums focus:outline-none"
              />
            </div>

            <UpperInput
              label="MOTIVO / DESCRIÇÃO: *"
              value={descMov}
              onChange={setDescMov}
              placeholder="EX: PAGAMENTO GÁS / REFORÇO DE TROCO"
              required
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowMovModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Salvar Movimentação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Cliente } from '../types';
import { formatBRL, consultarViaCep, cleanDigits } from '../utils/formatters';
import { UpperInput } from './UpperInput';
import {
  Briefcase,
  DollarSign,
  Search,
  CheckCircle,
  Plus,
  Phone,
  MapPin,
} from 'lucide-react';

interface MensalistasManagerProps {
  clientes: Cliente[];
  onAbaterSaldo: (clienteId: string, valor: number, forma: 'pix' | 'dinheiro' | 'cartao_debito') => void;
  onCadastrarCliente: (cliente: Partial<Cliente>) => void;
}

export const MensalistasManager: React.FC<MensalistasManagerProps> = ({
  clientes,
  onAbaterSaldo,
  onCadastrarCliente,
}) => {
  const [search, setSearch] = useState('');
  const [apenasComSaldo, setApenasComSaldo] = useState(false);

  // Abater Saldo modal
  const [abaterModalCliente, setAbaterModalCliente] = useState<Cliente | null>(null);
  const [valorAbater, setValorAbater] = useState('');
  const [formaAbater, setFormaAbater] = useState<'pix' | 'dinheiro' | 'cartao_debito'>('pix');

  // Novo Mensalista modal
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoCep, setNovoCep] = useState('13400-010');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [novoBairro, setNovoBairro] = useState('CENTRO');
  const [novoComplemento, setNovoComplemento] = useState('');
  const [isCepLoading, setIsCepLoading] = useState(false);

  const mensalistas = clientes.filter((c) => c.eh_mensalista || c.saldo_devedor > 0);

  const totalDevedorGeral = mensalistas.reduce((acc, c) => acc + (c.saldo_devedor || 0), 0);

  const filteredMensalistas = mensalistas.filter((c) => {
    if (apenasComSaldo && (c.saldo_devedor || 0) <= 0) return false;
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase()) && !c.telefone.includes(search)) {
      return false;
    }
    return true;
  });

  const handleBuscarCepModal = async (cep: string) => {
    const digits = cleanDigits(cep);
    if (digits.length !== 8) return;
    setIsCepLoading(true);
    try {
      const data = await consultarViaCep(digits);
      if (data && !data.erro) {
        setNovoEndereco(data.logradouro || '');
        setNovoBairro(data.bairro || 'CENTRO');
      }
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleOpenAbater = (cliente: Cliente) => {
    setAbaterModalCliente(cliente);
    setValorAbater(cliente.saldo_devedor.toFixed(2));
  };

  const handleConfirmAbater = (e: React.FormEvent) => {
    e.preventDefault();
    if (!abaterModalCliente || !valorAbater) return;
    const num = parseFloat(valorAbater);
    if (num <= 0) return;

    onAbaterSaldo(abaterModalCliente.id, num, formaAbater);
    setAbaterModalCliente(null);
  };

  const handleCriarMensalista = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome || !novoTelefone) {
      alert('PREENCHA O NOME E TELEFONE DO MENSALISTA');
      return;
    }

    onCadastrarCliente({
      nome: novoNome.toUpperCase(),
      telefone: novoTelefone,
      cep: novoCep,
      endereco: novoEndereco.toUpperCase(),
      numero: novoNumero.toUpperCase(),
      bairro: novoBairro.toUpperCase(),
      complemento: novoComplemento.toUpperCase(),
      eh_mensalista: true,
      saldo_devedor: 0,
    });

    setShowNovoModal(false);
    setNovoNome('');
    setNovoTelefone('');
    setNovoEndereco('');
    setNovoNumero('');
    setNovoComplemento('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header and Summary KPIs */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-500" />
            <span>Gestão de Mensalistas & Faturamento a Prazo</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Controle de contas correntes de empresas, escritórios e clientes fiados em Piracicaba
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-semibold">Total a Receber:</span>
            <span className="text-sm font-black text-amber-400 tabular-nums">
              {formatBRL(totalDevedorGeral)}
            </span>
          </div>

          <button
            onClick={() => setShowNovoModal(true)}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Mensalista
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-850 p-3 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
          <input
            type="text"
            placeholder="BUSCAR MENSALISTA POR NOME OU TELEFONE..."
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs uppercase text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 shrink-0">
          <input
            type="checkbox"
            checked={apenasComSaldo}
            onChange={(e) => setApenasComSaldo(e.target.checked)}
            className="accent-amber-500 rounded"
          />
          <span>Exibir apenas com saldo devedor</span>
        </label>
      </div>

      {/* Mensalistas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMensalistas.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-xs text-neutral-500 bg-neutral-850 rounded-xl border border-neutral-800">
            NENHUM MENSALISTA ENCONTRADO
          </div>
        ) : (
          filteredMensalistas.map((cli) => {
            const hasDebt = (cli.saldo_devedor || 0) > 0;

            return (
              <div
                key={cli.id}
                className={`bg-neutral-850 rounded-xl border p-4 flex flex-col justify-between gap-3 shadow-md ${
                  hasDebt ? 'border-amber-700/60' : 'border-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-800 pb-2">
                    <h3 className="text-xs font-black text-white uppercase leading-snug">
                      {cli.nome}
                    </h3>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tabular-nums shrink-0 ${
                        hasDebt ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-neutral-800 text-emerald-400'
                      }`}
                    >
                      {hasDebt ? 'EM ABERTO' : 'EM DIA'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-400 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>{cli.telefone}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <span>
                        {cli.endereco}, Nº {cli.numero} - {cli.bairro}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 block uppercase">
                      Saldo Devedor Acumulado:
                    </span>
                    <span
                      className={`text-base font-black tabular-nums ${
                        hasDebt ? 'text-amber-400' : 'text-neutral-400'
                      }`}
                    >
                      {formatBRL(cli.saldo_devedor || 0)}
                    </span>
                  </div>

                  {hasDebt && (
                    <button
                      onClick={() => handleOpenAbater(cli)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 uppercase transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Receber / Abater
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ABATER SALDO MODAL */}
      {abaterModalCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAbater}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase">
                  Recebimento de Mensalista
                </h3>
                <p className="text-xs text-neutral-400 uppercase mt-0.5">
                  {abaterModalCliente.nome}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbaterModalCliente(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-neutral-850 rounded-lg border border-neutral-800 flex justify-between items-center text-xs">
              <span className="text-neutral-400">Dívida Total em Aberto:</span>
              <span className="text-sm font-black text-amber-400 tabular-nums">
                {formatBRL(abaterModalCliente.saldo_devedor)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                VALOR A ABATER / RECEBER (R$): *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valorAbater}
                onChange={(e) => setValorAbater(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-sm tabular-nums focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1 uppercase">
                Forma de Recebimento no Caixa:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'pix', label: 'PIX' },
                  { id: 'dinheiro', label: 'DINHEIRO' },
                  { id: 'cartao_debito', label: 'DÉBITO' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormaAbater(f.id as any)}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                      formaAbater === f.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setAbaterModalCliente(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar Recebimento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* NOVO MENSALISTA MODAL */}
      {showNovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCriarMensalista}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase">
                Cadastrar Novo Mensalista
              </h3>
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <UpperInput
              label="RAZÃO SOCIAL / NOME DO CLIENTE: *"
              value={novoNome}
              onChange={setNovoNome}
              placeholder="EX: ESCRITÓRIO TOLEDO ADVOCACIA"
              required
            />

            <UpperInput
              label="TELEFONE / WHATSAPP: *"
              maskType="phone"
              value={novoTelefone}
              onChange={setNovoTelefone}
              placeholder="(19) 9-9999-9999"
              required
            />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <UpperInput
                  label="CEP (PIRACICABA): *"
                  maskType="cep"
                  value={novoCep}
                  onChange={(val) => {
                    setNovoCep(val);
                    if (cleanDigits(val).length === 8) handleBuscarCepModal(val);
                  }}
                  placeholder="13400-010"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => handleBuscarCepModal(novoCep)}
                disabled={isCepLoading}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg text-xs font-bold border border-neutral-700 h-[38px] shrink-0"
              >
                {isCepLoading ? '...' : 'ViaCEP'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <UpperInput
                  label="ENDEREÇO / RUA: *"
                  value={novoEndereco}
                  onChange={setNovoEndereco}
                  placeholder="RUA DO ROSÁRIO"
                  required
                />
              </div>
              <div>
                <UpperInput
                  label="NÚMERO: *"
                  value={novoNumero}
                  onChange={setNovoNumero}
                  placeholder="124"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <UpperInput
                label="BAIRRO: *"
                value={novoBairro}
                onChange={setNovoBairro}
                placeholder="CENTRO"
                required
              />
              <UpperInput
                label="COMPLEMENTO:"
                value={novoComplemento}
                onChange={setNovoComplemento}
                placeholder="SALA 42"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Cadastrar Mensalista
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

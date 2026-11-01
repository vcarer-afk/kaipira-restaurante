import React, { useState } from 'react';
import { Pedido, StatusPedido, Produto, ItemEstoque } from '../types';
import { formatTime, playAlertChime, isSalaoPedido } from '../utils/formatters';
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

interface ConfirmZeroModalData {
  pedido: Pedido;
  itemZerado: ItemEstoque;
  saldoAtual: number;
  todosDebitos: Array<{ item: ItemEstoque; debitQty: number }>;
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
  const [confirmZeroModal, setConfirmZeroModal] = useState<ConfirmZeroModalData | null>(null);

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
   * Mapeia os insumos que devem ser debitados do estoque para o pedido
   */
  const mapearDebitosPedido = (
    pedido: Pedido,
    listaEstoque: ItemEstoque[]
  ): Array<{ item: ItemEstoque; debitQty: number }> => {
    if (!listaEstoque || listaEstoque.length === 0) return [];
    const debitMap = new Map<number, { item: ItemEstoque; debitQty: number }>();

    const addDebit = (item: ItemEstoque, qtd: number) => {
      const existing = debitMap.get(item.id);
      if (existing) {
        existing.debitQty += qtd;
      } else {
        debitMap.set(item.id, { item, debitQty: qtd });
      }
    };

    // 1. Embalagem térmica de marmitex (Delivery ou refeições marmitex)
    const totalMarmitasOuDelivery = pedido.itens.reduce((acc, it) => {
      const nome = (it.produto_nome || '').toUpperCase();
      if (nome.includes('MARMITEX') || nome.includes('EXECUTIV') || pedido.tipo === 'delivery') {
        return acc + (Number(it.quantidade) || 1);
      }
      return acc;
    }, 0);

    if (totalMarmitasOuDelivery > 0) {
      const embItem = listaEstoque.find(
        (e) =>
          e.item_nome.includes('EMBALAGEM') ||
          e.item_nome.includes('MARMITEX')
      );
      if (embItem) {
        addDebit(embItem, totalMarmitasOuDelivery);
      }
    }

    // 2. Mapeamento por produtos e receitas típicas da culinária Kaipira
    pedido.itens.forEach((it) => {
      const nome = (it.produto_nome || '').toUpperCase();
      const qtd = Number(it.quantidade) || 1;

      // Correspondência direta
      const direto = listaEstoque.find(
        (e) =>
          e.item_nome === nome ||
          nome.includes(e.item_nome) ||
          e.item_nome.includes(nome)
      );
      if (direto) {
        addDebit(direto, qtd);
        return;
      }

      // Insumos por prato típico
      if (nome.includes('FEIJOADA')) {
        const feijaoPreto = listaEstoque.find((e) => e.item_nome.includes('FEIJÃO PRETO'));
        const torresmo = listaEstoque.find((e) => e.item_nome.includes('TORRESMO') || e.item_nome.includes('BARRIGA'));
        const couve = listaEstoque.find((e) => e.item_nome.includes('COUVE'));
        if (feijaoPreto) addDebit(feijaoPreto, qtd * 0.2);
        if (torresmo) addDebit(torresmo, qtd * 0.15);
        if (couve) addDebit(couve, qtd * 0.25);
      } else if (nome.includes('FRANGO')) {
        const frango = listaEstoque.find((e) => e.item_nome.includes('FRANGO'));
        const quiabo = listaEstoque.find((e) => e.item_nome.includes('QUIABO'));
        if (frango) addDebit(frango, qtd * 0.35);
        if (quiabo) addDebit(quiabo, qtd * 0.15);
      } else if (nome.includes('COSTEL')) {
        const costela = listaEstoque.find((e) => e.item_nome.includes('COSTELA'));
        const mandioca = listaEstoque.find((e) => e.item_nome.includes('MANDIOCA'));
        if (costela) addDebit(costela, qtd * 0.35);
        if (mandioca) addDebit(mandioca, qtd * 0.25);
      } else if (nome.includes('VIRADO')) {
        const feijaoCarioca = listaEstoque.find((e) => e.item_nome.includes('FEIJÃO CARIOCA'));
        const couve = listaEstoque.find((e) => e.item_nome.includes('COUVE'));
        if (feijaoCarioca) addDebit(feijaoCarioca, qtd * 0.2);
        if (couve) addDebit(couve, qtd * 0.25);
      } else if (nome.includes('TORRESMO')) {
        const torresmo = listaEstoque.find((e) => e.item_nome.includes('TORRESMO') || e.item_nome.includes('BARRIGA'));
        if (torresmo) addDebit(torresmo, qtd * 0.5);
      } else if (nome.includes('MANDIOCA')) {
        const mandioca = listaEstoque.find((e) => e.item_nome.includes('MANDIOCA'));
        if (mandioca) addDebit(mandioca, qtd * 0.4);
      } else if (nome.includes('MARMITEX') || nome.includes('EXECUTIV')) {
        const arroz = listaEstoque.find((e) => e.item_nome.includes('ARROZ'));
        const feijao = listaEstoque.find((e) => e.item_nome.includes('FEIJÃO'));
        if (arroz) addDebit(arroz, qtd * 0.2);
        if (feijao) addDebit(feijao, qtd * 0.15);
      }

      // Opcionais extras
      if (it.opcionais_selecionados && Array.isArray(it.opcionais_selecionados)) {
        it.opcionais_selecionados.forEach((op) => {
          const opNome = (op.nome || '').toUpperCase();
          if (opNome.includes('TORRESMO')) {
            const t = listaEstoque.find((e) => e.item_nome.includes('TORRESMO') || e.item_nome.includes('BARRIGA'));
            if (t) addDebit(t, 0.2 * qtd);
          } else if (opNome.includes('COUVE')) {
            const c = listaEstoque.find((e) => e.item_nome.includes('COUVE'));
            if (c) addDebit(c, 0.5 * qtd);
          } else if (opNome.includes('QUIABO')) {
            const q = listaEstoque.find((e) => e.item_nome.includes('QUIABO'));
            if (q) addDebit(q, 0.2 * qtd);
          } else if (opNome.includes('MANDIOCA')) {
            const m = listaEstoque.find((e) => e.item_nome.includes('MANDIOCA'));
            if (m) addDebit(m, 0.2 * qtd);
          }
        });
      }
    });

    return Array.from(debitMap.values());
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
   * Processa a dedução no estoque (permitindo saldo negativo) e dispara alertas de estoque mínimo
   */
  const processarBaixaEstoqueEConcluir = async (
    pedido: Pedido,
    debitos: Array<{ item: ItemEstoque; debitQty: number }>
  ) => {
    const novosAlertas: ToastAlert[] = [];

    for (const d of debitos) {
      const saldoAnterior = Number(d.item.quantidade_atual) || 0;
      // Permite saldo negativo (ex: -1, -2, -3) para não travar a cozinha enquanto os ajustes cadastrais não forem concluídos
      const novoSaldo = Number((saldoAnterior - d.debitQty).toFixed(2));

      if (onUpdateStockItem) {
        await onUpdateStockItem(d.item.id, { quantidade_atual: novoSaldo });
      }

      // Verificação de Estoque Mínimo (quantidade_atual <= estoque_minimo e quantidade_atual > 0)
      if (novoSaldo <= d.item.estoque_minimo && novoSaldo > 0) {
        novosAlertas.push({
          id: `min-${d.item.id}-${Date.now()}-${Math.random()}`,
          tipo: 'aviso',
          mensagem: `Atenção! Estoque mínimo alcançado para ${d.item.item_nome} (Restam: ${novoSaldo} ${d.item.unidade_medida}).`,
        });
      }
    }

    if (novosAlertas.length > 0) {
      setToastAlerts((prev) => [...prev, ...novosAlertas]);
      setTimeout(() => {
        setToastAlerts((prev) => prev.slice(novosAlertas.length));
      }, 7000);
    }

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

      // 2. Mapeamento de insumos a debitar
      const debitos = mapearDebitosPedido(pedido, estoque);

      // 3. Verificação de Insumo Zerado ou Negativo (quantidade_atual <= 0)
      const insumoZerado = debitos.find((d) => d.item.quantidade_atual <= 0);
      if (insumoZerado) {
        setConfirmZeroModal({
          pedido,
          itemZerado: insumoZerado.item,
          saldoAtual: insumoZerado.item.quantidade_atual,
          todosDebitos: debitos,
        });
        return;
      }

      // Prossiga normalmente caso nenhum insumo esteja zerado/negativo
      await processarBaixaEstoqueEConcluir(pedido, debitos);
    }
  };

  const handleAbortZeroModal = () => {
    // Se o operador selecionar "Não", aborte a ação e mantenha o pedido no status atual sem debitar estoque
    setConfirmZeroModal(null);
  };

  const handleConfirmZeroModal = async () => {
    // Se selecionar "Sim", prossiga com a operação normalmente, permitindo que a quantidade seja debitada ficando com saldo negativo
    if (!confirmZeroModal) return;
    const { pedido, todosDebitos } = confirmZeroModal;
    setConfirmZeroModal(null);
    await processarBaixaEstoqueEConcluir(pedido, todosDebitos);
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

      {/* Diálogo de Confirmação: Insumo Zerado ou Negativo */}
      {confirmZeroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-amber-600/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600/60 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Alerta de Estoque: Insumo Zerado
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pedido #{confirmZeroModal.pedido.codigo_senha} (
                  {confirmZeroModal.pedido.tipo.toUpperCase()})
                </p>
              </div>
            </div>

            {/* Mensagem Literal Exigida pela Regra de Negócio */}
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-sm font-bold text-neutral-200">
              Insumo{' '}
              <span className="text-amber-400 font-black">
                {confirmZeroModal.itemZerado.item_nome}
              </span>{' '}
              está zerado (saldo atual:{' '}
              <span className="text-red-400 font-mono font-black">
                {confirmZeroModal.saldoAtual}{' '}
                {confirmZeroModal.itemZerado.unidade_medida}
              </span>
              ). Continua? Sim ou Não
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              * Ao selecionar <strong className="text-white">"Sim"</strong>, a
              operação prosseguirá permitindo saldo negativo para não travar o
              preparo na cozinha. Ao selecionar{' '}
              <strong className="text-white">"Não"</strong>, a baixa será
              abortada mantendo o pedido em preparo.
            </p>

            {/* Botões Sim / Não */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={handleAbortZeroModal}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold text-xs uppercase transition-colors cursor-pointer"
              >
                Não (Abortar)
              </button>
              <button
                type="button"
                onClick={handleConfirmZeroModal}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                Sim (Prosseguir)
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

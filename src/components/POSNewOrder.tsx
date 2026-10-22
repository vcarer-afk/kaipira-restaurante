import React, { useState, useEffect } from 'react';
import {
  Produto,
  Categoria,
  Mesa,
  TipoPedido,
  FormaPagamento,
  BairroTaxa,
  Pedido,
  CardapioDiarioConfig,
  FormaPagamentoConfig,
} from '../types';
import { INITIAL_FORMAS_PAGAMENTO } from '../data/seedData';
import { UpperInput, UpperTextarea } from './UpperInput';
import { formatBRL, consultarViaCep, cleanDigits, playAlertChime } from '../utils/formatters';
import { criarPedidoSupabase } from '../services/supabaseClient';
import {
  Bike,
  Store,
  Utensils,
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Printer,
  CheckCircle2,
  Ban,
  Calendar,
  Sparkles,
  LayoutGrid,
  List,
  Layers,
  CreditCard,
  QrCode,
  AlertTriangle,
} from 'lucide-react';

interface CartItem {
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
  opcionais_selecionados: {
    id: number;
    nome: string;
    preco_adicional: number;
  }[];
}

interface POSNewOrderProps {
  produtos: Produto[];
  categorias: Categoria[];
  mesas: Mesa[];
  bairros: BairroTaxa[];
  selectedMesaNumber?: number;
  formasPagamento?: FormaPagamentoConfig[];
  onOrderCreated: (pedido: Pedido) => void;
  onPrintReceipt: (pedido: Pedido) => void;
  onTogglePauseProduto: (id: number) => void;
  cardapioDiario?: CardapioDiarioConfig;
  onOpenCardapioBuilder?: () => void;
}

export const POSNewOrder: React.FC<POSNewOrderProps> = ({
  produtos,
  categorias,
  mesas,
  bairros,
  selectedMesaNumber,
  formasPagamento = INITIAL_FORMAS_PAGAMENTO,
  onOrderCreated,
  onPrintReceipt,
  onTogglePauseProduto,
  cardapioDiario,
  onOpenCardapioBuilder,
}) => {
  // Order Mode
  const [tipoPedido, setTipoPedido] = useState<TipoPedido>(
    selectedMesaNumber ? 'salão' : 'delivery'
  );

  // Day of week filter (strictly current day of the week)
  const DIAS_NOMES: Record<number, string> = {
    1: 'SEGUNDA-FEIRA',
    2: 'TERÇA-FEIRA',
    3: 'QUARTA-FEIRA',
    4: 'QUINTA-FEIRA',
    5: 'SEXTA-FEIRA',
    6: 'SÁBADO',
    0: 'DOMINGO',
  };

  const rawDay = new Date().getDay();
  const todayDay = rawDay === 0 ? 1 : rawDay;
  const todayName = DIAS_NOMES[rawDay] || 'SEGUNDA-FEIRA';
  const [modoGerencialTodosDias, setModoGerencialTodosDias] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number>(todayDay);
  const [selectedCategoria, setSelectedCategoria] = useState<number | 'todas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // View Mode: 'bloco' vs 'lista'
  const [viewMode, setViewMode] = useState<'bloco' | 'lista'>('bloco');

  // Selected Mesa
  const [mesaId, setMesaId] = useState<number>(selectedMesaNumber || 1);

  // Delivery / Client Form
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteCep, setClienteCep] = useState('13400-010'); // Piracicaba Centro default sample
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [clienteNumero, setClienteNumero] = useState('');
  const [clienteBairro, setClienteBairro] = useState('CENTRO');
  const [clienteComplemento, setClienteComplemento] = useState('');
  const [isMensalista, setIsMensalista] = useState(false);
  const [taxaEntrega, setTaxaEntrega] = useState<number>(7.0);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState('');

  // Payment & Delivery logistics
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [trocoPara, setTrocoPara] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | ''>('');
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);
  const [motoboyTipo, setMotoboyTipo] = useState<'proprio' | 'app'>('proprio');

  // Multi-Payment state (Combinação de Pagamentos)
  const [pagamentosMultiplos, setPagamentosMultiplos] = useState<
    { id: string; forma: FormaPagamento; valor: number }[]
  >([]);
  const [novaFormaMultiplo, setNovaFormaMultiplo] = useState<FormaPagamento>('pix');
  const [novoValorMultiplo, setNovoValorMultiplo] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product Customizer Modal
  const [modalProduto, setModalProduto] = useState<Produto | null>(null);
  const [modalQuantidade, setModalQuantidade] = useState(1);
  const [modalObservacao, setModalObservacao] = useState('');
  const [modalOpcionais, setModalOpcionais] = useState<number[]>([]);

  useEffect(() => {
    if (selectedMesaNumber) {
      setTipoPedido('salão');
      setMesaId(selectedMesaNumber);
    }
  }, [selectedMesaNumber]);

  // Handle CEP lookup
  const handleBuscarCep = async (cepToSearch: string) => {
    const digits = cleanDigits(cepToSearch);
    if (digits.length !== 8) {
      setCepMessage('DIGITE OS 8 NÚMEROS DO CEP');
      return;
    }

    setIsCepLoading(true);
    setCepMessage('BUSCANDO ENDEREÇO EM PIRACICABA...');
    try {
      const data = await consultarViaCep(digits);
      if (data && !data.erro) {
        setClienteEndereco(data.logradouro || '');
        setClienteBairro(data.bairro || 'CENTRO');
        setCepMessage(`${data.localidade || 'PIRACICABA'} - ${data.uf || 'SP'}`);

        // Match neighborhood fee
        const matchedBairro = bairros.find(
          (b) => b.bairro.toUpperCase() === (data.bairro || '').toUpperCase()
        );
        if (matchedBairro) {
          setTaxaEntrega(matchedBairro.taxa);
        } else {
          setTaxaEntrega(10.0);
        }
      } else {
        setCepMessage('CEP NÃO ENCONTRADO NO VIACEP. PREENCHA MANUALMENTE.');
      }
    } catch {
      setCepMessage('FALHA AO CONSULTAR CEP');
    } finally {
      setIsCepLoading(false);
    }
  };

  // Open modal to configure dish
  const handleOpenCustomize = (prod: Produto) => {
    if (prod.pausado) return;
    setModalProduto(prod);
    setModalQuantidade(1);
    setModalObservacao('');
    setModalOpcionais([]);
  };

  const handleAddModalToCart = () => {
    if (!modalProduto) return;
    const precoUnitario =
      tipoPedido === 'delivery' ? modalProduto.preco_delivery : modalProduto.preco_salao;

    const selectedOps = (modalProduto.opcionais || [])
      .filter((op) => modalOpcionais.includes(op.id))
      .map((op) => ({
        id: op.id,
        nome: op.nome,
        preco_adicional: op.preco_adicional,
      }));

    const newItem: CartItem = {
      produto_id: modalProduto.id,
      produto_nome: modalProduto.nome,
      quantidade: modalQuantidade,
      preco_unitario: precoUnitario,
      observacao: modalObservacao ? modalObservacao.toUpperCase() : undefined,
      opcionais_selecionados: selectedOps,
    };

    setCart((prev) => [...prev, newItem]);
    setModalProduto(null);
  };

  // Cart operations
  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((it, i) => {
          if (i === index) {
            const newQty = it.quantidade + delta;
            return newQty > 0 ? { ...it, quantidade: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Calculate totals
  const subtotal = cart.reduce((acc, it) => {
    const itemBase = it.preco_unitario * it.quantidade;
    const itemOps = it.opcionais_selecionados.reduce(
      (opAcc, op) => opAcc + op.preco_adicional * it.quantidade,
      0
    );
    return acc + itemBase + itemOps;
  }, 0);

  const finalTaxa = tipoPedido === 'delivery' ? taxaEntrega : 0;
  const total = subtotal + finalTaxa;
  const trocoCalculado =
    precisaTroco && Number(trocoPara) > total ? Number(trocoPara) - total : 0;

  // Multi-Payment calculations
  const totalPagoMultiplo = pagamentosMultiplos.reduce((acc, p) => acc + p.valor, 0);
  const restanteMultiplo = Math.max(0, total - totalPagoMultiplo);

  const handleAddPagamentoMultiplo = () => {
    const val = parseFloat(novoValorMultiplo.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    setPagamentosMultiplos((prev) => [
      ...prev,
      {
        id: 'pg-pos-' + Date.now(),
        forma: novaFormaMultiplo,
        valor: val,
      },
    ]);
    setNovoValorMultiplo('');
  };

  const handleRemovePagamentoMultiplo = (id: string) => {
    setPagamentosMultiplos((prev) => prev.filter((p) => p.id !== id));
  };

  // Submit Order
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      alert('ADICIONE AO MENOS UM ITEM AO PEDIDO');
      return;
    }

    if (tipoPedido === 'delivery') {
      if (!clienteNome) {
        alert('POR FAVOR, INFORME O NOME DO CLIENTE');
        return;
      }
      if (!clienteTelefone) {
        alert('POR FAVOR, INFORME O TELEFONE COM MÁSCARA');
        return;
      }
      if (!clienteEndereco || !clienteNumero) {
        alert('POR FAVOR, INFORME O ENDEREÇO COMPLETO E NÚMERO');
        return;
      }
    }

    if (tipoPedido !== 'salão') {
      if (!formaPagamento || formaPagamento.trim() === '') {
        const msg = 'POR FAVOR, SELECIONE A FORMA DE PAGAMENTO ANTES DE FINALIZAR';
        setPaymentErrorMsg(msg);
        alert(msg);
        return;
      }

      if (formaPagamento === 'multiplo') {
        if (totalPagoMultiplo < total - 0.05) {
          const msg = `O VALOR PAGO (${formatBRL(totalPagoMultiplo)}) É INFERIOR AO TOTAL DO PEDIDO (${formatBRL(
            total
          )}). ADICIONE OS PAGAMENTOS RESTANTES.`;
          setPaymentErrorMsg(msg);
          alert(msg);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tipo: tipoPedido,
        mesa_id: tipoPedido === 'salão' ? mesaId : undefined,
        cliente:
          tipoPedido === 'delivery'
            ? {
                nome: clienteNome.toUpperCase(),
                telefone: clienteTelefone,
                cep: clienteCep,
                endereco: clienteEndereco.toUpperCase(),
                numero: clienteNumero.toUpperCase(),
                bairro: clienteBairro.toUpperCase(),
                complemento: clienteComplemento ? clienteComplemento.toUpperCase() : '',
                eh_mensalista: isMensalista,
              }
            : clienteNome
            ? {
                nome: clienteNome.toUpperCase(),
                telefone: clienteTelefone,
              }
            : undefined,
        itens: cart,
        taxa_entrega: finalTaxa,
        precisa_troco: tipoPedido !== 'salão' ? precisaTroco : false,
        troco_para: tipoPedido !== 'salão' && precisaTroco && trocoPara ? Number(trocoPara) : undefined,
        motoboy_tipo: tipoPedido === 'delivery' ? motoboyTipo : undefined,
        pagamento_imediato:
          tipoPedido !== 'salão'
            ? {
                forma: formaPagamento,
                valor: total,
              }
            : undefined,
      };

      // Quando pedido for para mesas, o pagamento será feito SOMENTE no fechamento da mesa
      const pagamentosArray =
        tipoPedido === 'salão'
          ? []
          : formaPagamento === 'multiplo'
          ? pagamentosMultiplos.map((p, idx) => ({
              id: Date.now() + idx,
              pedido_id: 0,
              forma: p.forma,
              valor: p.valor,
              criado_em: new Date().toISOString(),
            }))
          : [
              {
                id: Date.now(),
                pedido_id: 0,
                forma: formaPagamento,
                valor: total,
                criado_em: new Date().toISOString(),
              },
            ];

      // Para pedidos de balcão (retirada) com pagamento imediato: grava pagamento_confirmado: true
      const isBalcaoPago = tipoPedido === 'retirada' && pagamentosArray.length > 0;

      const formaEscolhidaFinal =
        tipoPedido !== 'salão'
          ? formaPagamento === 'multiplo'
            ? 'multiplo'
            : formaPagamento
          : undefined;

      const novoPedido = await criarPedidoSupabase({
        ...payload,
        status: 'pendente',
        valor_total: total,
        forma_pagamento: formaEscolhidaFinal,
        pagamentos: pagamentosArray,
        pagamento_confirmado: isBalcaoPago ? true : undefined,
      });

      playAlertChime('order');
      onOrderCreated(novoPedido);

      // Offer immediate print
      onPrintReceipt(novoPedido);

      // Reset cart and form
      setCart([]);
      setPagamentosMultiplos([]);
      setNovoValorMultiplo('');
      if (tipoPedido !== 'salão') {
        setClienteNome('');
        setClienteTelefone('');
        setClienteEndereco('');
        setClienteNumero('');
        setClienteComplemento('');
        setPrecisaTroco(false);
        setTrocoPara('');
        setFormaPagamento('');
        setPaymentErrorMsg(null);
      }
    } catch (err: any) {
      alert(`FALHA AO GRAVAR PEDIDO: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products: Bebidas (Cat 4) e Sobremesas (Cat 5) são SEMPRE FIXOS E DISPONÍVEIS
  const filteredProdutos = produtos.filter((prod) => {
    const isBebidaOuSobremesa = prod.categoria_id === 4 || prod.categoria_id === 5;

    // Se o cardápio diário estiver montado (cardapioDiario?.itens configurados com itens):
    const hasCardapioMontado = !!cardapioDiario?.itens && cardapioDiario.itens.length > 0;

    if (!isBebidaOuSobremesa && hasCardapioMontado && !modoGerencialTodosDias) {
      const itemConfig = cardapioDiario!.itens.find((it) => it.produto_id === prod.id);
      // Bloqueia a exibição de qualquer prato que não tenha sido expressamente ativado para o dia
      if (!itemConfig) return false;

      // Para pedidos de delivery ou retirada: exibe APENAS produtos com disponivel_delivery === true
      if (tipoPedido === 'delivery' || tipoPedido === 'retirada') {
        const isDelivery = !!itemConfig.disponivel_delivery || itemConfig.canal === 'delivery_balcao';
        if (!isDelivery) return false;
      } else if (tipoPedido === 'salão') {
        // Para pedidos de salão (mesas): exibe APENAS produtos com disponivel_salao === true
        const isSalao = !!itemConfig.disponivel_salao || itemConfig.canal === 'mesas';
        if (!isSalao) return false;
      }
    } else if (!isBebidaOuSobremesa) {
      // Se não houver cardápio ativo configurado ou for override gerencial:
      if (!modoGerencialTodosDias) {
        if (!prod.dia_semana.includes(todayDay)) {
          return false;
        }
      } else if (selectedDayFilter !== 0 && !prod.dia_semana.includes(selectedDayFilter)) {
        return false;
      }
    }

    // Category filter
    if (selectedCategoria !== 'todas' && prod.categoria_id !== selectedCategoria) {
      return false;
    }
    // Search
    if (
      searchQuery &&
      !prod.nome.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !prod.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Menu & Catalog Selection (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Order Mode Switcher */}
        <div className="bg-neutral-850 p-1.5 rounded-xl border border-neutral-800 flex items-center gap-1">
          <button
            onClick={() => setTipoPedido('delivery')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              tipoPedido === 'delivery'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>DELIVERY PRÓPRIO</span>
          </button>

          <button
            onClick={() => setTipoPedido('retirada')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              tipoPedido === 'retirada'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>RETIRADA BALCÃO</span>
          </button>

          <button
            onClick={() => setTipoPedido('salão')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              tipoPedido === 'salão'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>SALÃO (20 MESAS)</span>
          </button>
        </div>

        {/* Banner Exclusivo: Cardápio do Dia da Semana */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-600/20 border border-amber-500/40 rounded-lg text-amber-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase text-amber-400">
                    CARDÁPIO DO DIA: {todayName}
                  </span>
                  {cardapioDiario?.status === 'aberto' ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-bold uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      MONTAGEM DO DIA ATIVA ({cardapioDiario.itens.length} ITENS)
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800 font-bold uppercase">
                      FILTRO PADRÃO ({todayName})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {cardapioDiario?.status === 'aberto'
                    ? `Canal ${tipoPedido === 'salão' ? 'Salão (Pratos)' : 'Delivery/Balcão (Marmitex)'} sincronizado. Bebidas e sobremesas sempre ativas.`
                    : 'Exibindo pratos programados para hoje. Bebidas e sobremesas sempre ativas.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenCardapioBuilder && (
                <button
                  type="button"
                  onClick={onOpenCardapioBuilder}
                  className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Montar Cardápio de Hoje</span>
                </button>
              )}

              {/* Toggle for admin/manager override */}
              <label className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={modoGerencialTodosDias}
                  onChange={(e) => setModoGerencialTodosDias(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span className="text-[11px] font-semibold">Liberar Todos (Gerencial)</span>
              </label>
            </div>
          </div>

          {/* If Manager Mode enabled: show days selector */}
          {modoGerencialTodosDias && (
            <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-between gap-2 text-xs">
              <span className="text-[11px] text-amber-400 font-bold">Filtrar por outro dia:</span>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 1, label: 'SEG' },
                  { id: 2, label: 'TER' },
                  { id: 3, label: 'QUA' },
                  { id: 4, label: 'QUI' },
                  { id: 5, label: 'SEX' },
                  { id: 6, label: 'SÁB' },
                  { id: 0, label: 'TODOS' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDayFilter(d.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                      selectedDayFilter === d.id
                        ? 'bg-amber-500 text-neutral-950 font-black'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search bar, Category tabs & View Mode Switcher */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-neutral-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="BUSCAR PRATO, BEBIDA OU PORÇÃO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs uppercase text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedCategoria}
                onChange={(e) =>
                  setSelectedCategoria(
                    e.target.value === 'todas' ? 'todas' : Number(e.target.value)
                  )
                }
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 uppercase focus:outline-none"
              >
                <option value="todas">TODAS AS CATEGORIAS</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle: Blocos vs Lista */}
              <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('bloco')}
                  className={`px-2.5 py-1 rounded text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('lista')}
                  className={`px-2.5 py-1 rounded text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Catalog: Blocos (Cards Grid) vs Lista (Table) */}
        {viewMode === 'bloco' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
            {filteredProdutos.map((prod) => {
              const preco =
                tipoPedido === 'delivery' ? prod.preco_delivery : prod.preco_salao;

              return (
                <div
                  key={prod.id}
                  className={`bg-neutral-850 border rounded-xl p-3 flex flex-col justify-between transition-all ${
                    prod.pausado
                      ? 'border-red-900/50 opacity-60'
                      : 'border-neutral-800 hover:border-amber-600/50 hover:bg-neutral-800/80'
                  }`}
                >
                  <div>
                    <div className="w-full h-16 rounded-lg overflow-hidden mb-2 bg-neutral-900 border border-neutral-800 flex items-center justify-center relative">
                      {prod.url_imagem && prod.url_imagem.trim().length > 0 ? (
                        <img
                          src={prod.url_imagem}
                          alt={prod.nome}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center">
                          {prod.categoria_id === 2 ? (
                            <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                              <Bike className="w-5 h-5" />
                            </div>
                          ) : prod.categoria_id === 4 ? (
                            <div className="p-2 rounded-lg bg-blue-950/80 text-blue-400 border border-blue-800">
                              <Utensils className="w-5 h-5" />
                            </div>
                          ) : prod.categoria_id === 5 ? (
                            <div className="p-2 rounded-lg bg-pink-950/80 text-pink-400 border border-pink-800">
                              <Sparkles className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800">
                              <Utensils className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      )}

                      {prod.pausado && (
                        <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-red-400 font-extrabold text-xs tracking-wider uppercase">
                          <Ban className="w-4 h-4 mr-1" />
                          Esgotado no Dia
                        </div>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white uppercase leading-snug">
                        {prod.nome}
                      </h4>
                      <span className="text-xs font-black text-amber-400 tabular-nums whitespace-nowrap">
                        {formatBRL(preco)}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 uppercase">
                      {prod.descricao}
                    </p>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-500">
                      <span>
                        {tipoPedido === 'delivery' ? 'Preço Delivery' : 'Preço Salão'}
                      </span>
                      {prod.opcionais && prod.opcionais.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-neutral-400 font-medium">
                            +{prod.opcionais.length} opcionais
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-neutral-800">
                    {/* Quick pause toggle for inventory protection */}
                    <button
                      onClick={() => onTogglePauseProduto(prod.id)}
                      title={prod.pausado ? 'Despausar item' : 'Pausar item se esgotou'}
                      className={`text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors ${
                        prod.pausado
                          ? 'bg-red-950 text-red-300 hover:bg-red-900 border border-red-800'
                          : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {prod.pausado ? 'Pausado (Ativar)' : 'Pausar (Esgotou)'}
                    </button>

                    <button
                      onClick={() => handleOpenCustomize(prod)}
                      disabled={prod.pausado}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                        prod.pausado
                          ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-responsive-touch overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5">Prato / Descrição</th>
                  <th className="px-3 py-2.5">Categoria</th>
                  <th className="px-3 py-2.5 text-right">Preço</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredProdutos.map((prod) => {
                  const preco = tipoPedido === 'delivery' ? prod.preco_delivery : prod.preco_salao;
                  const catNome = categorias.find((c) => c.id === prod.categoria_id)?.nome || 'GERAL';
                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-neutral-850/60 transition-colors ${
                        prod.pausado ? 'opacity-60 bg-red-950/10' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center">
                            {prod.url_imagem && prod.url_imagem.trim().length > 0 ? (
                              <img
                                src={prod.url_imagem}
                                alt={prod.nome}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-lg object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="text-amber-500">
                                <Utensils className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white uppercase text-xs">
                              {prod.nome}
                            </div>
                            {prod.descricao && (
                              <div className="text-[10px] text-neutral-400 line-clamp-1 uppercase">
                                {prod.descricao}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {catNome}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-amber-400 font-mono tabular-nums whitespace-nowrap">
                        {formatBRL(preco)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onTogglePauseProduto(prod.id)}
                          className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase transition-colors cursor-pointer ${
                            prod.pausado
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {prod.pausado ? 'Esgotado' : 'Disponível'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenCustomize(prod)}
                          disabled={prod.pausado}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1 transition-colors ml-auto cursor-pointer ${
                            prod.pausado
                              ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RIGHT: Order Config, Address (ViaCEP) & Cart (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Customer / Table Information Block */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800">
          <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2">
            <h3 className="text-xs font-extrabold tracking-wider text-amber-500 uppercase">
              {tipoPedido === 'delivery'
                ? 'Dados de Entrega (Piracicaba)'
                : tipoPedido === 'salão'
                ? 'Identificação da Mesa'
                : 'Identificação do Cliente'}
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 uppercase">
              {tipoPedido}
            </span>
          </div>

          {/* Salão: Mesa Selector */}
          {tipoPedido === 'salão' && (
            <div className="mb-3">
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                SELECIONE A MESA (1 A 20):
              </label>
              <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto p-1 bg-neutral-900 rounded-lg border border-neutral-800">
                {mesas.map((m) => (
                  <button
                    key={m.numero}
                    onClick={() => setMesaId(m.numero)}
                    className={`py-1.5 rounded text-xs font-black transition-colors ${
                      mesaId === m.numero
                        ? 'bg-amber-500 text-neutral-950 ring-2 ring-amber-400'
                        : m.status === 'ocupada'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : m.status === 'conta'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    M#{m.numero}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <UpperInput
                  label="NOME DO CLIENTE NA MESA (OPCIONAL):"
                  value={clienteNome}
                  onChange={setClienteNome}
                  placeholder="EX: DR. MARCOS / FAMÍLIA SILVA"
                />
              </div>
            </div>
          )}

          {/* Delivery & Balcão Fields */}
          {tipoPedido !== 'salão' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <UpperInput
                  label="NOME COMPLETO: *"
                  value={clienteNome}
                  onChange={setClienteNome}
                  placeholder="EX: CARLOS SILVA"
                  required
                />
                <UpperInput
                  label="TELEFONE / WHATSAPP: *"
                  maskType="phone"
                  value={clienteTelefone}
                  onChange={setClienteTelefone}
                  placeholder="(19) 9-9999-9999"
                  required
                />
              </div>

              {/* Delivery ViaCEP Block */}
              {tipoPedido === 'delivery' && (
                <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <UpperInput
                        label="BUSCA POR CEP: *"
                        maskType="cep"
                        value={clienteCep}
                        onChange={(val) => {
                          setClienteCep(val);
                          if (cleanDigits(val).length === 8) {
                            handleBuscarCep(val);
                          }
                        }}
                        placeholder="13400-000"
                        helperText={cepMessage}
                      />
                    </div>
                    <button
                      onClick={() => handleBuscarCep(clienteCep)}
                      disabled={isCepLoading}
                      className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 h-[38px] transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" />
                      {isCepLoading ? 'Buscando...' : 'ViaCEP'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <UpperInput
                        label="ENDEREÇO / RUA: *"
                        value={clienteEndereco}
                        onChange={setClienteEndereco}
                        placeholder="RUA DO ROSÁRIO"
                        required
                      />
                    </div>
                    <div>
                      <UpperInput
                        label="NÚMERO: *"
                        value={clienteNumero}
                        onChange={setClienteNumero}
                        placeholder="124"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        BAIRRO PIRACICABA: *
                      </label>
                      <select
                        value={clienteBairro}
                        onChange={(e) => {
                          const newBairro = e.target.value;
                          setClienteBairro(newBairro);
                          const found = bairros.find((b) => b.bairro === newBairro);
                          if (found) setTaxaEntrega(found.taxa);
                        }}
                        className="w-full px-2 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs uppercase focus:outline-none"
                      >
                        {bairros.map((b) => (
                          <option key={b.bairro} value={b.bairro}>
                            {b.bairro} ({formatBRL(b.taxa)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <UpperInput
                        label="COMPLEMENTO / APTO:"
                        value={clienteComplemento}
                        onChange={setClienteComplemento}
                        placeholder="APTO 42 / BLOCO B"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
                    <span className="text-neutral-400">Taxa de Entrega:</span>
                    <span className="font-bold text-amber-400 tabular-nums">
                      {formatBRL(taxaEntrega)}
                    </span>
                  </div>
                </div>
              )}

              {/* Mensalista & Payment options */}
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={isMensalista}
                    onChange={(e) => {
                      setIsMensalista(e.target.checked);
                      if (e.target.checked) setFormaPagamento('mensalista');
                    }}
                    className="accent-amber-500 rounded"
                  />
                  <span>Cliente Mensalista (Conta Faturada)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* CART & SUMMARY BLOCK */}
        <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between flex-1">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2">
              <h3 className="text-xs font-extrabold tracking-wider text-amber-500 uppercase">
                Itens do Pedido ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-neutral-400 hover:text-red-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>

            {/* Cart Items list */}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                NENHUM ITEM ADICIONADO AINDA.
                <br />
                ESCOLHA OS PRATOS NO CARDÁPIO AO LADO.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cart.map((item, idx) => {
                  const itemOpsTotal = item.opcionais_selecionados.reduce(
                    (acc, op) => acc + op.preco_adicional,
                    0
                  );
                  const itemTotal = (item.preco_unitario + itemOpsTotal) * item.quantidade;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white uppercase">
                          {item.produto_nome}
                        </span>
                        <span className="font-bold text-neutral-200 tabular-nums">
                          {formatBRL(itemTotal)}
                        </span>
                      </div>

                      {item.opcionais_selecionados.length > 0 && (
                        <div className="text-[10px] text-neutral-400 pl-2">
                          {item.opcionais_selecionados.map((op, oIdx) => (
                            <span key={oIdx} className="block">
                              + {op.nome} ({op.preco_adicional > 0 ? formatBRL(op.preco_adicional) : 'GRÁTIS'})
                            </span>
                          ))}
                        </div>
                      )}

                      {item.observacao && (
                        <span className="text-[10px] text-amber-300 font-bold pl-2 uppercase">
                          OBS: {item.observacao}
                        </span>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 mt-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateItemQty(idx, -1)}
                            className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold tabular-nums">
                            {item.quantidade}
                          </span>
                          <button
                            onClick={() => handleUpdateItemQty(idx, 1)}
                            className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemoveCartItem(idx)}
                          className="text-neutral-500 hover:text-red-400 text-[11px]"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment & Change Block */}
          {cart.length > 0 && (
            <div className="pt-3 border-t border-neutral-800 mt-3 space-y-2">
              <div className="flex justify-between text-xs text-neutral-400">
                <span>Subtotal Itens:</span>
                <span className="tabular-nums font-semibold">{formatBRL(subtotal)}</span>
              </div>

              {tipoPedido === 'delivery' && (
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Taxa de Entrega:</span>
                  <span className="tabular-nums font-semibold">{formatBRL(finalTaxa)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-amber-400 pt-1 border-t border-neutral-800">
                <span>TOTAL DO PEDIDO:</span>
                <span className="tabular-nums text-base">{formatBRL(total)}</span>
              </div>

              {/* Payment selector or Table Notice */}
              {tipoPedido === 'salão' ? (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs space-y-1.5 animate-in fade-in">
                  <div className="font-black uppercase flex items-center gap-2 text-amber-400">
                    <Utensils className="w-4 h-4" />
                    <span>MESA #{mesaId} ABERTA · COMANDA EM CONSUMO</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Os itens serão adicionados à comanda da mesa. O pagamento é realizado <strong>somente no final, ao solicitar o fechamento da mesa</strong>, somando todos os itens com possibilidade de divisão por pessoas.
                  </p>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-neutral-300 uppercase">
                      Forma de Pagamento:
                    </label>
                    {!formaPagamento && (
                      <span className="text-[10px] font-black text-amber-400 uppercase animate-pulse">
                        * Seleção Obrigatória
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[11px]">
                    {formasPagamento
                      .filter((p) => p.ativo !== false)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setFormaPagamento(p.id as FormaPagamento);
                            setPaymentErrorMsg(null);
                          }}
                          className={`py-1.5 px-1 rounded text-center font-bold transition-colors cursor-pointer truncate ${
                            formaPagamento === p.id
                              ? 'bg-amber-600 text-white'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                          }`}
                          title={p.nome}
                        >
                          {p.nome.replace(' (ESPÉCIE)', '').replace(' (CHAVE / QR CODE)', '').replace(' (FATURADO EM CONTA)', '')}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormaPagamento('multiplo');
                        setPaymentErrorMsg(null);
                      }}
                      className={`py-1.5 px-1 rounded text-center font-bold transition-colors cursor-pointer ${
                        formaPagamento === 'multiplo'
                          ? 'bg-purple-600 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                      }`}
                    >
                      MÚLTIPLOS
                    </button>
                  </div>
                </div>
              )}

              {/* Múltiplos Pagamentos (Combinação de Pagamentos) */}
              {formaPagamento === 'multiplo' && (
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black uppercase text-purple-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      Combinação de Pagamentos
                    </span>
                    <span
                      className={`text-[10px] font-black font-mono px-2 py-0.5 rounded ${
                        restanteMultiplo <= 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {restanteMultiplo <= 0 ? '✓ 100% QUITADO' : `FALTA: ${formatBRL(restanteMultiplo)}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={novaFormaMultiplo}
                      onChange={(e) => setNovaFormaMultiplo(e.target.value as FormaPagamento)}
                      className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg text-xs font-bold"
                    >
                      {formasPagamento
                        .filter((fp) => fp.ativo !== false && fp.id !== 'multiplo')
                        .map((fp) => (
                          <option key={fp.id} value={fp.id}>
                            {fp.nome}
                          </option>
                        ))}
                    </select>

                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1.5 text-neutral-500 text-xs font-bold">R$</span>
                      <input
                        type="text"
                        value={novoValorMultiplo}
                        onChange={(e) => setNovoValorMultiplo(e.target.value)}
                        placeholder={restanteMultiplo > 0 ? restanteMultiplo.toFixed(2) : '0.00'}
                        className="w-full pl-8 pr-2 py-1.5 bg-neutral-800 border border-neutral-700 text-white font-mono font-bold rounded-lg text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddPagamentoMultiplo}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {/* List of partial payments */}
                  <div className="space-y-1 pt-1 max-h-28 overflow-y-auto">
                    {pagamentosMultiplos.length === 0 ? (
                      <div className="text-[10px] text-neutral-500 italic p-1.5 bg-neutral-950 rounded text-center">
                        Nenhum pagamento parcial adicionado ainda.
                      </div>
                    ) : (
                      pagamentosMultiplos.map((pg) => (
                        <div
                          key={pg.id}
                          className="flex items-center justify-between p-1.5 bg-neutral-950 rounded border border-neutral-800 text-[11px]"
                        >
                          <span className="font-bold uppercase text-neutral-300">
                            {pg.forma.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-amber-400">
                              {formatBRL(pg.valor)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePagamentoMultiplo(pg.id)}
                              className="text-neutral-500 hover:text-red-400 p-0.5 cursor-pointer"
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

              {/* Change (Troco) if Dinheiro */}
              {formaPagamento === 'dinheiro' && (
                <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={precisaTroco}
                      onChange={(e) => setPrecisaTroco(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    <span>Precisa de Troco?</span>
                  </label>

                  {precisaTroco && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-neutral-400 block">TROCO PARA (R$):</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 100.00"
                          value={trocoPara}
                          onChange={(e) => setTrocoPara(e.target.value)}
                          className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white tabular-nums focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <span className="text-[10px] text-neutral-400">LEVAR DE TROCO:</span>
                        <span className="text-xs font-bold text-red-400 tabular-nums">
                          {formatBRL(trocoCalculado)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Error Alert */}
              {paymentErrorMsg && tipoPedido !== 'salão' && (
                <div className="p-3 bg-red-950/90 border border-red-500 rounded-xl text-xs font-black text-red-200 uppercase flex items-center gap-2 animate-bounce my-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{paymentErrorMsg}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className={`w-full py-3 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-colors mt-2 cursor-pointer ${
                  tipoPedido === 'delivery'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : tipoPedido === 'salão'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {tipoPedido === 'delivery' ? (
                  <>
                    <Bike className="w-5 h-5" />
                    <span>
                      {isSubmitting
                        ? `ENVIANDO PARA ENTREGA... (${formatBRL(total)})`
                        : `ENVIAR PARA ENTREGA (${formatBRL(total)})`}
                    </span>
                  </>
                ) : tipoPedido === 'salão' ? (
                  <>
                    <Utensils className="w-5 h-5" />
                    <span>
                      {isSubmitting
                        ? 'ENVIANDO COMANDA...'
                        : `LANÇAR COMANDA NA MESA #${mesaId} (${formatBRL(total)})`}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {isSubmitting
                        ? 'FINALIZANDO PEDIDO...'
                        : `FINALIZAR E RECEBER (${formatBRL(total)})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DISH CUSTOMIZER MODAL */}
      {modalProduto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase">
                  {modalProduto.nome}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 uppercase">
                  {modalProduto.descricao}
                </p>
              </div>
              <span className="text-sm font-black text-amber-400 tabular-nums">
                {formatBRL(
                  tipoPedido === 'delivery'
                    ? modalProduto.preco_delivery
                    : modalProduto.preco_salao
                )}
              </span>
            </div>

            {/* Opcionais List */}
            {modalProduto.opcionais && modalProduto.opcionais.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase">
                  Adicionais e Opcionais da Fazenda:
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {modalProduto.opcionais.map((op) => (
                    <label
                      key={op.id}
                      className="flex items-center justify-between p-2 bg-neutral-800/80 rounded-lg text-xs cursor-pointer hover:bg-neutral-800"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modalOpcionais.includes(op.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalOpcionais((prev) => [...prev, op.id]);
                            } else {
                              setModalOpcionais((prev) => prev.filter((id) => id !== op.id));
                            }
                          }}
                          className="accent-amber-500"
                        />
                        <span className="text-neutral-200 uppercase font-medium">
                          {op.nome}
                        </span>
                      </div>
                      <span className="font-bold text-amber-400 tabular-nums">
                        {op.preco_adicional > 0 ? `+ ${formatBRL(op.preco_adicional)}` : 'GRÁTIS'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Special Instructions (Uppercase enforced) */}
            <div>
              <UpperTextarea
                label="OBSERVAÇÕES DO PRATO (EX: SEM CEBOLA, PONTO DA CARNE):"
                value={modalObservacao}
                onChange={setModalObservacao}
                placeholder="EX: CAPRICHAR NO TORRESMO E FEIJÃO BEM TEMPERADO"
                rows={2}
              />
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <span className="text-xs font-bold text-neutral-300">QUANTIDADE:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalQuantidade((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center font-bold text-lg text-neutral-200"
                >
                  -
                </button>
                <span className="w-8 text-center font-extrabold text-sm tabular-nums">
                  {modalQuantidade}
                </span>
                <button
                  onClick={() => setModalQuantidade((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center font-bold text-lg text-neutral-200"
                >
                  +
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setModalProduto(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddModalToCart}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Adicionar ao Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

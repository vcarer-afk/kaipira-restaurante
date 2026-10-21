import React, { useState, useEffect } from 'react';
import {
  Produto,
  Categoria,
  CardapioDiarioConfig,
  ItemCardapioDiario,
  Perfil,
} from '../types';
import { formatBRL } from '../utils/formatters';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Bike,
  Utensils,
  Check,
  Sparkles,
  ShoppingBag,
  Store,
  Cloud,
  X,
  Package,
  Flame,
  Plus,
  LayoutGrid,
  List,
} from 'lucide-react';

interface DailyMenuBuilderProps {
  produtos: Produto[];
  categorias: Categoria[];
  cardapioDiario: CardapioDiarioConfig;
  onSaveCardapio: (novo: CardapioDiarioConfig) => Promise<void>;
  currentPerfil?: Perfil;
  onClose?: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const DailyMenuBuilder: React.FC<DailyMenuBuilderProps> = ({
  produtos,
  categorias,
  cardapioDiario,
  onSaveCardapio,
  currentPerfil,
  onClose,
  onNavigateTab,
}) => {
  // Working list of active items for today with independent channel booleans
  const [selectedItems, setSelectedItems] = useState<ItemCardapioDiario[]>(() => {
    return (cardapioDiario.itens || []).map((it) => ({
      produto_id: it.produto_id,
      disponivel_delivery: !!it.disponivel_delivery || it.canal === 'delivery_balcao',
      disponivel_salao: !!it.disponivel_salao || it.canal === 'mesas',
    }));
  });

  const [statusAbertura, setStatusAbertura] = useState<'aguardando' | 'aberto'>(
    cardapioDiario.status || 'aguardando'
  );
  const [confirmadoEm, setConfirmadoEm] = useState<string | undefined>(
    cardapioDiario.confirmado_em
  );

  // Search and filter for available dishes (left column)
  const [searchLibrary, setSearchLibrary] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'pratos' | 'marmitex'>('todos');
  const [libraryViewMode, setLibraryViewMode] = useState<'blocos' | 'lista'>('blocos');

  // Saving state & visual feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Today's date calculations
  const now = new Date();
  const DIAS_EXTENSO = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const rawDayIndex = now.getDay();
  const diaSemanaIndex = rawDayIndex === 0 ? 1 : rawDayIndex;
  const nomeDiaSemana = DIAS_EXTENSO[rawDayIndex];
  const dataFormatada = `${nomeDiaSemana}, ${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')}/${now.getFullYear()}`;
  const dataHojeISO = now.toISOString().split('T')[0];

  // Sync internal state if external props change
  useEffect(() => {
    if (cardapioDiario.itens) {
      setSelectedItems(
        cardapioDiario.itens.map((it) => ({
          produto_id: it.produto_id,
          disponivel_delivery: !!it.disponivel_delivery || it.canal === 'delivery_balcao',
          disponivel_salao: !!it.disponivel_salao || it.canal === 'mesas',
        }))
      );
      setStatusAbertura(cardapioDiario.status || 'aguardando');
      setConfirmadoEm(cardapioDiario.confirmado_em);
    }
  }, [cardapioDiario]);

  // Filter ONLY Pratos e Marmitex (Categories 1, 2, 3).
  // Category 4 (Bebidas) and Category 5 (Sobremesas) are fixed and NEVER filtered here!
  const availableEligibleDishes = produtos.filter((p) => {
    const isBebidaOuDoce = p.categoria_id === 4 || p.categoria_id === 5;
    if (isBebidaOuDoce) return false;

    // Filter by type
    if (categoryFilter === 'marmitex') {
      if (p.categoria_id !== 2) return false;
    } else if (categoryFilter === 'pratos') {
      if (p.categoria_id !== 1 && p.categoria_id !== 3) return false;
    }

    // Filter by search
    if (searchLibrary.trim()) {
      const q = searchLibrary.toLowerCase();
      const matchNome = (p.nome || '').toLowerCase().includes(q);
      const matchDesc = (p.descricao || '').toLowerCase().includes(q);
      if (!matchNome && !matchDesc) return false;
    }

    return true;
  });

  // Check state of a product in today's menu
  const getItemConfig = (prodId: number): ItemCardapioDiario | undefined => {
    return selectedItems.find((it) => it.produto_id === prodId);
  };

  /**
   * TOGGLE INDEPENDENTE:
   * Permite que um item esteja em Delivery, em Mesas, ou em AMBOS simultaneamente!
   * Se já estiver em Delivery e o usuário clicar em Mesas, fica ativo para os dois.
   * Se clicar novamente em um canal ativo, desativa apenas aquele canal.
   */
  const handleToggleChannel = (prodId: number, channel: 'delivery' | 'mesas') => {
    setSelectedItems((prev) => {
      const existing = prev.find((it) => it.produto_id === prodId);

      if (!existing) {
        // Not in menu yet -> add with selected channel active
        return [
          ...prev,
          {
            produto_id: prodId,
            disponivel_delivery: channel === 'delivery',
            disponivel_salao: channel === 'mesas',
          },
        ];
      }

      // Existing item -> toggle target channel
      const updatedDelivery =
        channel === 'delivery' ? !existing.disponivel_delivery : existing.disponivel_delivery;
      const updatedSalao =
        channel === 'mesas' ? !existing.disponivel_salao : existing.disponivel_salao;

      // If both channels turned off, remove completely
      if (!updatedDelivery && !updatedSalao) {
        return prev.filter((it) => it.produto_id !== prodId);
      }

      // Otherwise update both channel flags
      return prev.map((it) =>
        it.produto_id === prodId
          ? {
              ...it,
              disponivel_delivery: updatedDelivery,
              disponivel_salao: updatedSalao,
            }
          : it
      );
    });
  };

  /**
   * Remove completamente o produto de ambos os canais do dia
   */
  const handleRemoveItem = (prodId: number) => {
    setSelectedItems((prev) => prev.filter((it) => it.produto_id !== prodId));
  };

  /**
   * Ativa ou desativa AMBOS os canais (Delivery E Mesas) simultaneamente
   */
  const handleToggleBothChannels = (prodId: number) => {
    setSelectedItems((prev) => {
      const existing = prev.find((it) => it.produto_id === prodId);
      if (existing && existing.disponivel_delivery && existing.disponivel_salao) {
        // Já está em ambos -> desativa (remove)
        return prev.filter((it) => it.produto_id !== prodId);
      }
      if (existing) {
        // Já está em um deles -> ativa os dois
        return prev.map((it) =>
          it.produto_id === prodId
            ? { ...it, disponivel_delivery: true, disponivel_salao: true }
            : it
        );
      }
      // Não estava no cardápio -> adiciona para ambos os canais
      return [
        ...prev,
        {
          produto_id: prodId,
          disponivel_delivery: true,
          disponivel_salao: true,
        },
      ];
    });
  };

  /**
   * Clique inteligente no card:
   * 1. Se não selecionado: ativa canal padrão (delivery para marmitex, mesas para pratos)
   * 2. Se já selecionado para um canal: ao clicar novamente, seleciona também o outro canal (disponível para AMBOS os cardápios!)
   * 3. Se já selecionado para ambos: desativa (remove)
   */
  const handleCardClick = (prod: Produto) => {
    const config = getItemConfig(prod.id);
    const isDelivery = !!config?.disponivel_delivery;
    const isSalao = !!config?.disponivel_salao;

    if (!isDelivery && !isSalao) {
      if (prod.categoria_id === 2) {
        handleToggleChannel(prod.id, 'delivery');
      } else {
        handleToggleChannel(prod.id, 'mesas');
      }
    } else if (isDelivery && !isSalao) {
      // Já está em delivery -> seleciona também para mesas!
      handleToggleChannel(prod.id, 'mesas');
    } else if (!isDelivery && isSalao) {
      // Já está em mesas -> seleciona também para delivery!
      handleToggleChannel(prod.id, 'delivery');
    } else {
      // Já está em ambos -> limpa
      handleRemoveItem(prod.id);
    }
  };

  // Helper: Auto-suggest items programmed for today's weekday
  const handleApplyWeekdaySuggestion = () => {
    const suggested: ItemCardapioDiario[] = [];

    produtos.forEach((prod) => {
      // Skip drinks & desserts
      if (prod.categoria_id === 4 || prod.categoria_id === 5) return;

      // Check if product is programmed for today
      if (prod.dia_semana && prod.dia_semana.includes(diaSemanaIndex)) {
        const isMarmita = prod.categoria_id === 2;
        suggested.push({
          produto_id: prod.id,
          disponivel_delivery: true,
          disponivel_salao: !isMarmita, // Pratos no salão, marmitex no delivery
        });
      }
    });

    if (suggested.length > 0) {
      setSelectedItems(suggested);
      setSaveSuccessMessage(
        `SUGESTÃO DE ${nomeDiaSemana.toUpperCase()} APLICADA COM ${suggested.length} ITENS!`
      );
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    }
  };

  // Helper: Clear all
  const handleClearAll = () => {
    setSelectedItems([]);
  };

  // MAIN ACTION: CONFIRMAR E ABRIR DIA
  const handleConfirmarEAbrirDia = async () => {
    if (selectedItems.length === 0) {
      alert('SELECIONE AO MENOS 1 PRATO OU MARMITEX PARA ABRIR O CARDÁPIO DO DIA.');
      return;
    }

    const hasDelivery = selectedItems.some((it) => it.disponivel_delivery);
    const hasMesas = selectedItems.some((it) => it.disponivel_salao);

    if (!hasDelivery && !hasMesas) {
      alert('ATIVE AO MENOS UM CANAL (DELIVERY OU MESAS) EM UM DOS PRATOS.');
      return;
    }

    setIsSaving(true);
    const timeIso = new Date().toISOString();
    const configAtualizada: CardapioDiarioConfig = {
      data: dataHojeISO,
      status: 'aberto',
      confirmado_em: timeIso,
      confirmado_por: currentPerfil?.nome || 'ADMINISTRADOR',
      itens: selectedItems,
    };

    try {
      await onSaveCardapio(configAtualizada);
      setStatusAbertura('aberto');
      setConfirmadoEm(timeIso);
      setSaveSuccessMessage(
        'CARDÁPIO DO DIA GRAVADO NO SUPABASE COM SUCESSO! OPERAÇÃO LIBERADA.'
      );
      setTimeout(() => setSaveSuccessMessage(null), 4500);
    } catch (err: any) {
      alert('FALHA AO GRAVAR CARDÁPIO DIÁRIO NO SUPABASE: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Separate lists for the two fixed right columns
  const deliveryItems = selectedItems.filter((it) => it.disponivel_delivery);
  const mesasItems = selectedItems.filter((it) => it.disponivel_salao);

  // Visual helper: Render product image or fallback icon badge
  const renderProductVisual = (prod: Produto) => {
    if (prod.url_imagem && prod.url_imagem.trim()) {
      return (
        <img
          src={prod.url_imagem}
          alt={prod.nome}
          className="w-11 h-11 rounded-xl object-cover shrink-0 border border-neutral-700 shadow-inner"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }

    const isMarmita = prod.categoria_id === 2;
    const isPorcao = prod.categoria_id === 3;

    if (isMarmita) {
      return (
        <div className="w-11 h-11 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-300 flex items-center justify-center shrink-0 shadow-inner">
          <Package className="w-5 h-5 text-cyan-400" />
        </div>
      );
    }

    if (isPorcao) {
      return (
        <div className="w-11 h-11 rounded-xl bg-orange-950/80 border border-orange-800 text-orange-300 flex items-center justify-center shrink-0 shadow-inner">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
      );
    }

    return (
      <div className="w-11 h-11 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
        <Utensils className="w-5 h-5 text-amber-400" />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 min-h-[calc(100vh-120px)] text-neutral-100 pb-10">
      {/* =========================================================================
          1. CABEÇALHO PRINCIPAL (TOPO)
          ========================================================================= */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-amber-600/15 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {dataFormatada}
              </span>

              {statusAbertura === 'aberto' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-700 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  CARDÁPIO ATIVO (DIA ABERTO)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase bg-amber-950/70 text-amber-300 border border-amber-800">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  AGUARDANDO ABERTURA (ANTES DAS 11H)
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-neutral-900 border border-neutral-700 text-neutral-400">
                <Cloud className="w-3 h-3 text-cyan-400" />
                TABELA SUPABASE: cardapio_diario
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              VAMOS MONTAR O CARDÁPIO DE HOJE
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-3xl">
              Defina os pratos e marmitex disponíveis hoje. Cada item pode ser ativado para <strong>Delivery/Retirada</strong>, para <strong>Consumo no Salão (Mesas)</strong> ou para <strong>ambos os canais simultaneamente</strong>.
            </p>
          </div>

          {/* Action Button: CONFIRMAR E ABRIR DIA */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase transition-colors"
              >
                Voltar
              </button>
            )}

            <button
              onClick={handleConfirmarEAbrirDia}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2.5 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{isSaving ? 'Gravando no Supabase...' : 'CONFIRMAR E ABRIR DIA'}</span>
            </button>
          </div>
        </div>

        {/* Confirmation banner if active */}
        {confirmadoEm && (
          <div className="mt-4 pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 gap-2">
            <span>
              Última abertura registrada:{' '}
              <strong className="text-neutral-200">
                {new Date(confirmadoEm).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>{' '}
              · por{' '}
              <strong className="text-amber-400 uppercase">
                {cardapioDiario.confirmado_por || 'ADMINISTRADOR'}
              </strong>
            </span>
            <div className="flex items-center gap-3 font-mono font-bold">
              <span className="text-cyan-400">📦 {deliveryItems.length} no Delivery</span>
              <span className="text-neutral-600">|</span>
              <span className="text-amber-400">🍽️ {mesasItems.length} nas Mesas</span>
            </div>
          </div>
        )}
      </div>

      {/* Visual Feedback Message */}
      {saveSuccessMessage && (
        <div className="p-3.5 bg-emerald-950/90 border border-emerald-800 rounded-xl text-xs font-black uppercase text-emerald-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          2. ÁREA CENTRAL: BIBLIOTECA (ESQUERDA) + DUAS COLUNAS FIXAS (DIREITA)
          ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 items-start">
        {/* =====================================================================
            COLUNA DA ESQUERDA (5 cols): BIBLIOTECA DE PRODUTOS DISPONÍVEIS
            ===================================================================== */}
        <div className="xl:col-span-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-md">
          {/* Header da Coluna */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block">
                BIBLIOTECA GERAL
              </span>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-tight flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>TODOS OS PRATOS E MARMITEX CADASTRADOS</span>
              </h2>
            </div>
            <span className="text-xs font-mono font-bold bg-neutral-800 px-2.5 py-1 rounded-lg text-neutral-300 border border-neutral-700">
              {availableEligibleDishes.length} itens
            </span>
          </div>

          {/* Quick Filter buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold uppercase">
            <button
              onClick={() => setCategoryFilter('todos')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'todos'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-850 text-neutral-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setCategoryFilter('pratos')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'pratos'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-850 text-neutral-400 hover:text-white'
              }`}
            >
              Pratos Principais
            </button>
            <button
              onClick={() => setCategoryFilter('marmitex')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'marmitex'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-850 text-neutral-400 hover:text-white'
              }`}
            >
              Marmitex / Delivery
            </button>
          </div>

          {/* Search bar + View Selector */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={searchLibrary}
                onChange={(e) => setSearchLibrary(e.target.value)}
                placeholder="BUSCAR PRATO OU MARMITEX PELO NOME..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>
            <div className="flex items-center bg-neutral-850 p-1 rounded-xl border border-neutral-700 shrink-0">
              <button
                type="button"
                onClick={() => setLibraryViewMode('blocos')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  libraryViewMode === 'blocos'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Exibição em Blocos (Cards)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLibraryViewMode('lista')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  libraryViewMode === 'lista'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Exibição em Lista (Tabela)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Helper Tools */}
          <div className="flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleApplyWeekdaySuggestion}
              className="text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 uppercase hover:underline cursor-pointer"
              title="Ativa os pratos programados para o dia de hoje"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sugerir para {nomeDiaSemana}</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-neutral-400 hover:text-red-400 font-bold uppercase hover:underline cursor-pointer"
            >
              Limpar Seleção
            </button>
          </div>

          {/* Multi-channel Selection Notice */}
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/50 text-[11px] text-purple-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>CANAL DUPLO LIBERADO:</strong> O mesmo item pode ser ativado para <strong>Delivery</strong>, <strong>Mesas</strong> ou <strong>Ambos</strong> simultaneamente.
            </span>
          </div>

          {/* List of Clickable Cards or Table */}
          {availableEligibleDishes.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs uppercase font-medium bg-neutral-850/40 rounded-xl border border-dashed border-neutral-800">
              Nenhum prato encontrado com o filtro aplicado.
            </div>
          ) : libraryViewMode === 'lista' ? (
            <div className="overflow-x-auto max-h-[640px] border border-neutral-800 rounded-xl">
              <table className="w-full text-left text-xs text-neutral-200">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] font-black border-b border-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5">Foto</th>
                    <th className="px-3 py-2.5">Prato / Categoria</th>
                    <th className="px-3 py-2.5">Preços</th>
                    <th className="px-3 py-2.5 text-right">Canais do Dia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/60">
                  {availableEligibleDishes.map((prod) => {
                    const config = getItemConfig(prod.id);
                    const isDelivery = !!config?.disponivel_delivery;
                    const isSalao = !!config?.disponivel_salao;
                    const isSelected = isDelivery || isSalao;
                    const cat = categorias.find((c) => c.id === prod.categoria_id);
                    const isMarmita = prod.categoria_id === 2;

                    return (
                      <tr
                        key={`list-${prod.id}`}
                        className={`hover:bg-neutral-800/50 transition-colors ${
                          isDelivery && isSalao
                            ? 'bg-purple-950/20'
                            : isDelivery
                            ? 'bg-cyan-950/20'
                            : isSalao
                            ? 'bg-amber-950/20'
                            : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                            {renderProductVisual(prod)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle min-w-[140px]">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider inline-block mb-0.5 ${
                              isMarmita
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {cat?.nome || 'CARDÁPIO'}
                          </span>
                          <h4 className="font-extrabold text-neutral-100 uppercase text-xs line-clamp-1">
                            {prod.nome}
                          </h4>
                        </td>
                        <td className="px-3 py-2.5 align-middle whitespace-nowrap font-mono text-[11px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-amber-400">
                              Salão: <strong>{formatBRL(prod.preco_salao)}</strong>
                            </span>
                            {prod.preco_delivery > 0 && (
                              <span className="text-cyan-400">
                                Deliv: <strong>{formatBRL(prod.preco_delivery)}</strong>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleChannel(prod.id, 'delivery')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                isDelivery
                                  ? 'bg-cyan-600 text-white shadow-xs'
                                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700'
                              }`}
                              title="Ativar no Delivery"
                            >
                              {isDelivery ? '✓ Deliv' : '+ Delivery'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleChannel(prod.id, 'mesas')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                isSalao
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700'
                              }`}
                              title="Ativar nas Mesas"
                            >
                              {isSalao ? '✓ Mesas' : '+ Mesas'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBothChannels(prod.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                isDelivery && isSalao
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-neutral-800 text-purple-300 hover:bg-neutral-700 border border-neutral-700'
                              }`}
                              title="Ativar em Ambos os canais"
                            >
                              {isDelivery && isSalao ? '✓ Ambos' : '+ Ambos'}
                            </button>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(prod.id)}
                                className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                title="Remover dos cardápios"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {availableEligibleDishes.map((prod) => {
                const config = getItemConfig(prod.id);
                const isDelivery = !!config?.disponivel_delivery;
                const isSalao = !!config?.disponivel_salao;
                const isSelected = isDelivery || isSalao;
                const cat = categorias.find((c) => c.id === prod.categoria_id);
                const isMarmita = prod.categoria_id === 2;

                return (
                  <div
                    key={prod.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-left ${
                      isDelivery && isSalao
                        ? 'bg-gradient-to-r from-cyan-950/30 via-neutral-850 to-amber-950/30 border-amber-600/60 shadow-md ring-1 ring-amber-500/30'
                        : isDelivery
                        ? 'bg-cyan-950/20 border-cyan-700/60 shadow-md ring-1 ring-cyan-500/20'
                        : isSalao
                        ? 'bg-amber-950/20 border-amber-700/60 shadow-md ring-1 ring-amber-500/20'
                        : 'bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {/* Top row: Icon + Details (Clickable to activate or add complementary channel) */}
                    <div
                      onClick={() => handleCardClick(prod)}
                      className="flex items-start gap-3 cursor-pointer group select-none"
                      title={
                        isDelivery && isSalao
                          ? 'Item ativo em ambos os cardápios. Clique para remover.'
                          : isDelivery
                          ? 'Ativo no Delivery. Clique novamente para ativar TAMBÉM nas Mesas!'
                          : isSalao
                          ? 'Ativo nas Mesas. Clique novamente para ativar TAMBÉM no Delivery!'
                          : 'Clique para ativar no cardápio de hoje'
                      }
                    >
                      {/* Product Visual Icon / Category */}
                      {renderProductVisual(prod)}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              isMarmita
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {cat?.nome || 'CARDÁPIO'}
                          </span>

                          {/* Channel status badges */}
                          {isDelivery && isSalao ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-700 flex items-center gap-1">
                              <span>📦 DELIVERY & 🍽️ MESAS (AMBOS)</span>
                            </span>
                          ) : isDelivery ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-700">
                              📦 NO DELIVERY / RETIRADA
                            </span>
                          ) : isSalao ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-700">
                              🍽️ NO SALÃO (MESAS)
                            </span>
                          ) : null}
                        </div>

                        <h4 className="font-extrabold text-neutral-100 uppercase text-xs line-clamp-1 group-hover:text-amber-300 transition-colors">
                          {prod.nome}
                        </h4>

                        <div className="flex items-center gap-3 text-[11px] font-mono mt-1 text-neutral-400">
                          {prod.preco_delivery > 0 && (
                            <span>
                              Delivery: <strong className="text-cyan-400">{formatBRL(prod.preco_delivery)}</strong>
                            </span>
                          )}
                          <span>
                            Salão: <strong className="text-amber-400">{formatBRL(prod.preco_salao)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom row: Direct Channel Toggles (Independent & Multi-Select) */}
                    <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                        {/* Delivery Button: Toggles Delivery ON/OFF */}
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(prod.id, 'delivery')}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isDelivery
                              ? 'bg-cyan-600 text-white shadow-md ring-1 ring-cyan-400'
                              : 'bg-neutral-800 hover:bg-cyan-950/70 hover:text-cyan-300 text-neutral-300 border border-neutral-700'
                          }`}
                          title={
                            isDelivery
                              ? 'Clique para desativar do Delivery'
                              : 'Clique para ativar no Delivery (pode ficar ativo em ambos!)'
                          }
                        >
                          <Bike className="w-3.5 h-3.5 shrink-0" />
                          <span>{isDelivery ? '✓ DELIVERY' : '+ DELIVERY'}</span>
                        </button>

                        {/* Mesas Button: Toggles Mesas ON/OFF */}
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(prod.id, 'mesas')}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isSalao
                              ? 'bg-amber-600 text-white shadow-md ring-1 ring-amber-400'
                              : 'bg-neutral-800 hover:bg-amber-950/70 hover:text-amber-300 text-neutral-300 border border-neutral-700'
                          }`}
                          title={
                            isSalao
                              ? 'Clique para desativar das Mesas'
                              : 'Clique para ativar nas Mesas (pode ficar ativo em ambos!)'
                          }
                        >
                          <Utensils className="w-3.5 h-3.5 shrink-0" />
                          <span>{isSalao ? '✓ MESAS' : '+ MESAS'}</span>
                        </button>

                        {/* Ambos Button: Toggles Both channels at once */}
                        <button
                          type="button"
                          onClick={() => handleToggleBothChannels(prod.id)}
                          className={`py-1.5 px-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isDelivery && isSalao
                              ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-400'
                              : 'bg-neutral-800 hover:bg-purple-950/70 hover:text-purple-300 text-neutral-400 border border-neutral-700'
                          }`}
                          title="Ativar ou desativar este prato em AMBOS os cardápios (Delivery + Mesas)"
                        >
                          <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                          <span>{isDelivery && isSalao ? '✓ AMBOS' : '+ AMBOS'}</span>
                        </button>
                      </div>

                      {/* Clear / Delete from both channels */}
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(prod.id)}
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remover de ambos os cardápios do dia"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =====================================================================
            COLUNA DA DIREITA (7 cols): DUAS COLUNAS FIXAS COM TÍTULOS DESTACADOS
            ===================================================================== */}
        <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ===================================================================
              COLUNA FIXA 1: 📦 DELIVERY / RETIRADA (Marmitex)
              =================================================================== */}
          <div className="bg-neutral-900 border border-cyan-800/60 rounded-2xl p-4 sm:p-5 flex flex-col shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-600/5 rounded-full blur-2xl pointer-events-none" />

            {/* Header Coluna 1 */}
            <div className="border-b border-neutral-800 pb-3 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <Bike className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">
                    📦 DELIVERY / RETIRADA (MARMITEX)
                  </h3>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {deliveryItems.length}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Disponível para atendentes no delivery próprio e retirada no balcão.
              </p>
            </div>

            {/* Content List */}
            <div className="flex-1 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {deliveryItems.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-xs uppercase bg-neutral-850/40 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center gap-2">
                  <Package className="w-8 h-8 text-neutral-600" />
                  <span>Nenhum item em Delivery / Retirada</span>
                  <span className="text-[10px] text-neutral-500">
                    Clique em <strong>[ + DELIVERY ]</strong> nos pratos da esquerda para alocar aqui.
                  </span>
                </div>
              ) : (
                deliveryItems.map((it) => {
                  const prod = produtos.find((p) => p.id === it.produto_id);
                  if (!prod) return null;

                  return (
                    <div
                      key={`deliv-card-${prod.id}`}
                      className="p-3 bg-neutral-850 rounded-xl border border-cyan-900/60 hover:border-cyan-700/80 flex flex-col justify-between gap-2.5 shadow-sm transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {renderProductVisual(prod)}
                          <div className="min-w-0">
                            <h5 className="font-extrabold text-neutral-100 text-xs uppercase line-clamp-2">
                              {prod.nome}
                            </h5>
                            <span className="text-xs font-mono font-bold text-cyan-400 block mt-0.5">
                              {formatBRL(prod.preco_delivery || prod.preco_salao)}
                            </span>
                          </div>
                        </div>

                        {/* Quick Deactivate from Delivery Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(prod.id, 'delivery')}
                          className="text-neutral-500 hover:text-red-400 p-1 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remover do Delivery"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom action: Quick Toggle Mesas */}
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(prod.id, 'mesas')}
                          className={`py-1 px-2.5 rounded-lg font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${
                            it.disponivel_salao
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                              : 'bg-neutral-800 hover:bg-amber-950/40 text-neutral-400 hover:text-amber-300 border border-neutral-700'
                          }`}
                          title="Ativa ou desativa a disponibilidade deste prato nas Mesas"
                        >
                          <Utensils className="w-3 h-3 text-amber-400" />
                          <span>{it.disponivel_salao ? '✓ Também nas Mesas' : '+ Ativar nas Mesas'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ===================================================================
              COLUNA FIXA 2: 🍽️ CONSUMO NAS MESAS (Pratos)
              =================================================================== */}
          <div className="bg-neutral-900 border border-amber-800/60 rounded-2xl p-4 sm:p-5 flex flex-col shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-600/5 rounded-full blur-2xl pointer-events-none" />

            {/* Header Coluna 2 */}
            <div className="border-b border-neutral-800 pb-3 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">
                    🍽️ CONSUMO NAS MESAS (PRATOS)
                  </h3>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black uppercase bg-amber-950 text-amber-300 border border-amber-800">
                  {mesasItems.length}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Disponível exclusivamente para garçons e mesas no salão.
              </p>
            </div>

            {/* Content List */}
            <div className="flex-1 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {mesasItems.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-xs uppercase bg-neutral-850/40 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center gap-2">
                  <Utensils className="w-8 h-8 text-neutral-600" />
                  <span>Nenhum item em Mesas</span>
                  <span className="text-[10px] text-neutral-500">
                    Clique em <strong>[ + MESAS ]</strong> nos pratos da esquerda para alocar aqui.
                  </span>
                </div>
              ) : (
                mesasItems.map((it) => {
                  const prod = produtos.find((p) => p.id === it.produto_id);
                  if (!prod) return null;

                  return (
                    <div
                      key={`mesas-card-${prod.id}`}
                      className="p-3 bg-neutral-850 rounded-xl border border-amber-900/60 hover:border-amber-700/80 flex flex-col justify-between gap-2.5 shadow-sm transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {renderProductVisual(prod)}
                          <div className="min-w-0">
                            <h5 className="font-extrabold text-neutral-100 text-xs uppercase line-clamp-2">
                              {prod.nome}
                            </h5>
                            <span className="text-xs font-mono font-bold text-amber-400 block mt-0.5">
                              {formatBRL(prod.preco_salao)}
                            </span>
                          </div>
                        </div>

                        {/* Quick Deactivate from Mesas Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(prod.id, 'mesas')}
                          className="text-neutral-500 hover:text-red-400 p-1 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remover das Mesas"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom action: Quick Toggle Delivery */}
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(prod.id, 'delivery')}
                          className={`py-1 px-2.5 rounded-lg font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${
                            it.disponivel_delivery
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700'
                              : 'bg-neutral-800 hover:bg-cyan-950/40 text-neutral-400 hover:text-cyan-300 border border-neutral-700'
                          }`}
                          title="Ativa ou desativa a disponibilidade deste prato no Delivery"
                        >
                          <Bike className="w-3 h-3 text-cyan-400" />
                          <span>{it.disponivel_delivery ? '✓ Também no Delivery' : '+ Ativar no Delivery'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

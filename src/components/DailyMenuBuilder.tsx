import React, { useState, useEffect } from 'react';
import {
  Produto,
  Categoria,
  CardapioDiarioConfig,
  ItemCardapioDiario,
  Perfil,
} from '../types';
import { formatBRL } from '../utils/formatters';
import { salvarCardapioDiarioSupabase } from '../services/supabaseClient';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Search,
  Bike,
  Utensils,
  Check,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Store,
  Layers,
  Cloud,
  X,
  AlertCircle,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ArrowRight,
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
  // Working list of active items for today
  const [selectedItems, setSelectedItems] = useState<ItemCardapioDiario[]>(
    cardapioDiario.itens || []
  );
  const [statusAbertura, setStatusAbertura] = useState<'aguardando' | 'aberto'>(
    cardapioDiario.status || 'aguardando'
  );
  const [confirmadoEm, setConfirmadoEm] = useState<string | undefined>(
    cardapioDiario.confirmado_em
  );

  // Search and filter for available dishes (left column)
  const [searchLibrary, setSearchLibrary] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'pratos' | 'marmitex'>('todos');

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
  const MESES_EXTENSO = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const rawDayIndex = now.getDay();
  const diaSemanaIndex = rawDayIndex === 0 ? 1 : rawDayIndex; // Default domingo to segunda
  const nomeDiaSemana = DIAS_EXTENSO[rawDayIndex];
  const dataFormatada = `${nomeDiaSemana}, ${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')}/${now.getFullYear()}`;
  const dataHojeISO = now.toISOString().split('T')[0];

  // Sync internal state if props change
  useEffect(() => {
    if (cardapioDiario.itens) {
      setSelectedItems(cardapioDiario.itens);
      setStatusAbertura(cardapioDiario.status);
      setConfirmadoEm(cardapioDiario.confirmado_em);
    }
  }, [cardapioDiario]);

  // Filter ONLY Pratos e Marmitex (Categories 1, 2, 3).
  // Category 4 (Bebidas) and Category 5 (Sobremesas) are fixed and NEVER filtered here!
  const availableEligibleDishes = produtos.filter((p) => {
    // Categories 1 = Pratos Principais, 2 = Marmitas/Executivos, 3 = Porções
    // Exclude category 4 (Bebidas) and 5 (Sobremesas)
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
      const matchNome = p.nome.toLowerCase().includes(q);
      const matchDesc = (p.descricao || '').toLowerCase().includes(q);
      if (!matchNome && !matchDesc) return false;
    }

    return true;
  });

  // Check whether a product is currently in today's menu
  const getItemConfig = (prodId: number): ItemCardapioDiario | undefined => {
    return selectedItems.find((it) => it.produto_id === prodId);
  };

  // Toggle or add item from library into today's menu
  const handleToggleAddFromLibrary = (prod: Produto) => {
    const existing = getItemConfig(prod.id);
    if (existing) {
      // Remove if already added
      setSelectedItems((prev) => prev.filter((it) => it.produto_id !== prod.id));
    } else {
      // Auto-assign channels based on category:
      // Marmitex (cat 2) defaults to delivery ON, salão OFF (or ON if desired)
      // Pratos (cat 1 or 3) defaults to salão ON and delivery ON
      const isMarmita = prod.categoria_id === 2;
      const newItem: ItemCardapioDiario = {
        produto_id: prod.id,
        disponivel_delivery: true,
        disponivel_salao: !isMarmita, // Marmitex focus on delivery, Pratos on both
      };
      setSelectedItems((prev) => [...prev, newItem]);
    }
  };

  // Toggle delivery switch for a specific item
  const handleToggleDelivery = (prodId: number) => {
    setSelectedItems((prev) =>
      prev.map((it) =>
        it.produto_id === prodId
          ? { ...it, disponivel_delivery: !it.disponivel_delivery }
          : it
      )
    );
  };

  // Toggle salão switch for a specific item
  const handleToggleSalao = (prodId: number) => {
    setSelectedItems((prev) =>
      prev.map((it) =>
        it.produto_id === prodId
          ? { ...it, disponivel_salao: !it.disponivel_salao }
          : it
      )
    );
  };

  // Remove item completely from today's active menu
  const handleRemoveItem = (prodId: number) => {
    setSelectedItems((prev) => prev.filter((it) => it.produto_id !== prodId));
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
          disponivel_salao: !isMarmita,
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

  // Helper: Select all items
  const handleSelectAllDishes = () => {
    const allItems: ItemCardapioDiario[] = availableEligibleDishes.map((p) => ({
      produto_id: p.id,
      disponivel_delivery: true,
      disponivel_salao: p.categoria_id !== 2,
    }));
    setSelectedItems(allItems);
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

    // Verify at least one item is active for delivery or salão
    const hasDelivery = selectedItems.some((it) => it.disponivel_delivery);
    const hasSalao = selectedItems.some((it) => it.disponivel_salao);

    if (!hasDelivery && !hasSalao) {
      alert('ATIVE AO MENOS UM CANAL (DELIVERY OU SALÃO) EM UM DOS PRATOS.');
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
      setSaveSuccessMessage('CARDÁPIO DO DIA CONFIRMADO E ABERTO COM SUCESSO NO SUPABASE!');
      setTimeout(() => setSaveSuccessMessage(null), 4500);
    } catch (err: any) {
      alert('FALHA AO GRAVAR CARDÁPIO DIÁRIO NO SUPABASE: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Channel Lists derived from selectedItems
  const deliveryItems = selectedItems.filter((it) => it.disponivel_delivery);
  const salaoItems = selectedItems.filter((it) => it.disponivel_salao);

  return (
    <div className="flex flex-col gap-5 min-h-[calc(100vh-120px)] text-neutral-100">
      {/* =========================================================================
          1. CABEÇALHO PRINCIPAL (TOPO)
          ========================================================================= */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow visual ambient */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-amber-600/15 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {dataFormatada}
              </span>

              {statusAbertura === 'aberto' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700 shadow-xs">
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
                100% SUPABASE NUVEM
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              VAMOS MONTAR O CARDÁPIO DE HOJE
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-3xl">
              Defina com 1 clique quais pratos e marmitex estarão disponíveis para venda hoje no <strong>Delivery próprio</strong> e no <strong>Salão (20 mesas)</strong>. Bebidas e sobremesas ficam sempre ativas sem triagem.
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
          <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
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
            <span className="font-mono text-emerald-400 font-bold">
              {deliveryItems.length} no Delivery · {salaoItems.length} no Salão
            </span>
          </div>
        )}
      </div>

      {/* Visual Feedback Message */}
      {saveSuccessMessage && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-xs font-black uppercase text-emerald-300 flex items-center justify-between shadow-lg">
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
          2. ÁREA CENTRAL: DIVIDIDA EM 2 COLUNAS GRANDES
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* =====================================================================
            COLUNA DA ESQUERDA (5 ou 6 cols): BIBLIOTECA DE PRODUTOS DISPONÍVEIS
            ===================================================================== */}
        <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-md">
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
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setCategoryFilter('pratos')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'pratos'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Pratos Principais
            </button>
            <button
              onClick={() => setCategoryFilter('marmitex')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'marmitex'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Marmitex / Delivery
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              value={searchLibrary}
              onChange={(e) => setSearchLibrary(e.target.value)}
              placeholder="BUSCAR PRATO OU MARMITEX PELO NOME..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
            />
          </div>

          {/* Quick Helper Tools */}
          <div className="flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleApplyWeekdaySuggestion}
              className="text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 uppercase hover:underline"
              title="Ativa os pratos programados para o dia de hoje"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sugerir para {nomeDiaSemana}</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAllDishes}
              className="text-neutral-400 hover:text-white font-bold uppercase hover:underline"
            >
              Adicionar Todos
            </button>
          </div>

          {/* List of Large Clickable Cards */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {availableEligibleDishes.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs uppercase font-medium">
                Nenhum prato encontrado com o filtro aplicado.
              </div>
            ) : (
              availableEligibleDishes.map((prod) => {
                const config = getItemConfig(prod.id);
                const isSelected = !!config;
                const cat = categorias.find((c) => c.id === prod.categoria_id);
                const isMarmita = prod.categoria_id === 2;

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleToggleAddFromLibrary(prod)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left group select-none ${
                      isSelected
                        ? 'bg-amber-950/25 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-neutral-850 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80'
                    }`}
                  >
                    {/* Visual Media / Icon */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-800 border border-neutral-700 relative flex items-center justify-center">
                        {prod.url_imagem ? (
                          <img
                            src={prod.url_imagem}
                            alt={prod.nome}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Utensils className="w-5 h-5 text-neutral-500" />
                        )}

                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-600/60 backdrop-blur-2xs flex items-center justify-center text-white font-black">
                            <Check className="w-6 h-6 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              isMarmita
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {cat?.nome || 'CARDÁPIO'}
                          </span>

                          {isSelected && (
                            <span className="text-[9px] font-bold text-emerald-400 uppercase">
                              • No Cardápio de Hoje
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-neutral-100 uppercase text-xs line-clamp-1 group-hover:text-amber-300 transition-colors">
                          {prod.nome}
                        </h4>

                        <div className="flex items-center gap-3 text-[11px] font-mono mt-1 text-neutral-400">
                          {prod.preco_delivery > 0 && (
                            <span>
                              Delivery: <strong className="text-emerald-400">{formatBRL(prod.preco_delivery)}</strong>
                            </span>
                          )}
                          <span>
                            Salão: <strong className="text-amber-400">{formatBRL(prod.preco_salao)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Icon */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-neutral-950 shadow-xs'
                            : 'bg-neutral-800 text-neutral-400 group-hover:bg-amber-600 group-hover:text-white'
                        }`}
                        title={isSelected ? 'Remover do Cardápio' : 'Adicionar ao Cardápio'}
                      >
                        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* =====================================================================
            COLUNA DA DIREITA (7 cols): CARDÁPIO ATIVO DO DIA (DIVIDIDA EM 2 SEÇÕES)
            ===================================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Top summary bar of Cardápio Ativo */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/40">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider block">
                  CONFIGURAÇÃO EM TEMPO REAL
                </span>
                <h3 className="text-sm font-extrabold text-white uppercase">
                  CARDÁPIO ATIVO DO DIA ({selectedItems.length} ITENS SELECIONADOS)
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 text-neutral-400 rounded-xl text-xs font-bold uppercase transition-colors"
                title="Limpar todos os itens selecionados"
              >
                Limpar
              </button>
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-500">
                <Utensils className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-white uppercase">
                Nenhum prato ativado para hoje ainda
              </h4>
              <p className="text-xs text-neutral-400 max-w-md">
                Clique nos cards da biblioteca à esquerda para incluir os pratos e marmitex no cardápio de hoje, ou clique no botão abaixo para carregar a sugestão programada:
              </p>
              <button
                type="button"
                onClick={handleApplyWeekdaySuggestion}
                className="mt-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Aplicar Sugestão de {nomeDiaSemana}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ===============================================================
                  SEÇÃO 1: 📦 ENTREGA & BALCÃO (Marmitex / Delivery)
                  =============================================================== */}
              <div className="bg-neutral-900 border border-cyan-800/40 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                      <Bike className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>📦 ENTREGA & BALCÃO (MARMITEX / DELIVERY)</span>
                      </h4>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        Estes itens aparecem para os atendentes lançarem em pedidos de delivery próprio e retirada.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {deliveryItems.length} Ativos
                  </span>
                </div>

                {deliveryItems.length === 0 ? (
                  <div className="p-4 bg-neutral-850/60 rounded-xl border border-dashed border-neutral-800 text-center text-xs text-neutral-500 uppercase">
                    Nenhum prato ativado para entrega/balcão. Use a chave 'Delivery' nos cards abaixo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {deliveryItems.map((it) => {
                      const prod = produtos.find((p) => p.id === it.produto_id);
                      if (!prod) return null;

                      return (
                        <div
                          key={`deliv-${prod.id}`}
                          className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2.5 shadow-sm hover:border-cyan-800/60 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold text-cyan-400 uppercase">
                                DELIVERY PRÓPRIO
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(prod.id)}
                                className="text-neutral-500 hover:text-red-400 p-0.5 transition-colors"
                                title="Remover completamente de hoje"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <h5 className="font-extrabold text-neutral-100 text-xs uppercase line-clamp-1">
                              {prod.nome}
                            </h5>
                            <span className="text-xs font-mono font-bold text-emerald-400 block mt-0.5">
                              {formatBRL(prod.preco_delivery || prod.preco_salao)}
                            </span>
                          </div>

                          {/* Quick Toggles on Card */}
                          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px]">
                            {/* Toggle Delivery */}
                            <button
                              type="button"
                              onClick={() => handleToggleDelivery(prod.id)}
                              className="flex items-center gap-1.5 text-cyan-300 font-bold uppercase hover:opacity-80"
                            >
                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                              <span>Marmitex Delivery: Ligado</span>
                            </button>

                            {/* Toggle Salão */}
                            <button
                              type="button"
                              onClick={() => handleToggleSalao(prod.id)}
                              className={`flex items-center gap-1 text-[10px] font-semibold uppercase ${
                                it.disponivel_salao ? 'text-amber-400' : 'text-neutral-500'
                              }`}
                            >
                              <span>{it.disponivel_salao ? '+ Salão On' : '+ Salão Off'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ===============================================================
                  SEÇÃO 2: 🍽️ CONSUMO NO SALÃO (Pratos / Mesas)
                  =============================================================== */}
              <div className="bg-neutral-900 border border-amber-800/40 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>🍽️ CONSUMO NO SALÃO (PRATOS / MESAS)</span>
                      </h4>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        Estes itens aparecem para os garçons e atendentes lançarem nas 20 mesas e comandas do salão.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-black uppercase bg-amber-950 text-amber-300 border border-amber-800">
                    {salaoItems.length} Ativos
                  </span>
                </div>

                {salaoItems.length === 0 ? (
                  <div className="p-4 bg-neutral-850/60 rounded-xl border border-dashed border-neutral-800 text-center text-xs text-neutral-500 uppercase">
                    Nenhum prato ativado para o Salão/Mesas. Use a chave 'Salão' nos cards.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {salaoItems.map((it) => {
                      const prod = produtos.find((p) => p.id === it.produto_id);
                      if (!prod) return null;

                      return (
                        <div
                          key={`salao-${prod.id}`}
                          className="p-3 bg-neutral-850 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2.5 shadow-sm hover:border-amber-800/60 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold text-amber-400 uppercase">
                                SALÃO (20 MESAS)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(prod.id)}
                                className="text-neutral-500 hover:text-red-400 p-0.5 transition-colors"
                                title="Remover completamente de hoje"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <h5 className="font-extrabold text-neutral-100 text-xs uppercase line-clamp-1">
                              {prod.nome}
                            </h5>
                            <span className="text-xs font-mono font-bold text-amber-400 block mt-0.5">
                              {formatBRL(prod.preco_salao)}
                            </span>
                          </div>

                          {/* Quick Toggles on Card */}
                          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px]">
                            {/* Toggle Salão */}
                            <button
                              type="button"
                              onClick={() => handleToggleSalao(prod.id)}
                              className="flex items-center gap-1.5 text-amber-300 font-bold uppercase hover:opacity-80"
                            >
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span>Prato Salão: Ligado</span>
                            </button>

                            {/* Toggle Delivery */}
                            <button
                              type="button"
                              onClick={() => handleToggleDelivery(prod.id)}
                              className={`flex items-center gap-1 text-[10px] font-semibold uppercase ${
                                it.disponivel_delivery ? 'text-cyan-400' : 'text-neutral-500'
                              }`}
                            >
                              <span>{it.disponivel_delivery ? '+ Delivery On' : '+ Delivery Off'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Informative notice on Bebidas & Doces */}
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-start gap-3 text-xs text-neutral-400 shadow-xs">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-neutral-200 uppercase block mb-0.5">
                    Nota Operacional sobre Bebidas & Sobremesas:
                  </strong>
                  Bebidas (Refrigerantes, Cervejas, Sucos, Água) e Sobremesas Caseiras (Pudim, Doce de Abóbora, etc.) permanecem sempre ativas automaticamente para todos os pedidos e não precisam passar pela montagem diária.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

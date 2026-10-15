import React, { useState, useEffect } from 'react';
import {
  Produto,
  Categoria,
  CardapioDiarioConfig,
  ItemCardapioDiario,
  CanalCardapio,
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
  AlertCircle,
  Package,
  Flame,
  ArrowRightLeft,
  Trash2,
  HelpCircle,
  ChefHat,
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
  // Working list of active items for today with exclusive channel ('delivery_balcao' | 'mesas')
  const [selectedItems, setSelectedItems] = useState<ItemCardapioDiario[]>(() => {
    return (cardapioDiario.itens || []).map((it) => ({
      produto_id: it.produto_id,
      canal: it.canal || (it.disponivel_delivery ? 'delivery_balcao' : 'mesas'),
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
  const diaSemanaIndex = rawDayIndex === 0 ? 1 : rawDayIndex; // Default domingo to segunda
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
          canal: it.canal || (it.disponivel_delivery ? 'delivery_balcao' : 'mesas'),
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

  // Check channel of a product in today's menu
  const getItemCanal = (prodId: number): CanalCardapio | null => {
    const found = selectedItems.find((it) => it.produto_id === prodId);
    return found ? found.canal : null;
  };

  /**
   * REGRA DE EXCLUSIVIDADE ABSOLUTA:
   * Define o canal de um produto exclusivamente para 'delivery_balcao' ou 'mesas'.
   * Se já estiver em outro canal, é removido de lá e alocado no novo.
   */
  const handleAssignCanal = (prodId: number, targetCanal: CanalCardapio) => {
    setSelectedItems((prev) => {
      // Remove any existing assignment for this product
      const filtered = prev.filter((it) => it.produto_id !== prodId);
      // Add product exclusively with targetCanal
      return [
        ...filtered,
        {
          produto_id: prodId,
          canal: targetCanal,
          disponivel_delivery: targetCanal === 'delivery_balcao',
          disponivel_salao: targetCanal === 'mesas',
        },
      ];
    });
  };

  /**
   * Remove completamente o produto do cardápio do dia
   */
  const handleRemoveItem = (prodId: number) => {
    setSelectedItems((prev) => prev.filter((it) => it.produto_id !== prodId));
  };

  /**
   * Alterna/Move o item para o outro canal exclusivo
   */
  const handleMoveChannel = (prodId: number) => {
    setSelectedItems((prev) =>
      prev.map((it) => {
        if (it.produto_id === prodId) {
          const novoCanal: CanalCardapio =
            it.canal === 'delivery_balcao' ? 'mesas' : 'delivery_balcao';
          return {
            produto_id: prodId,
            canal: novoCanal,
            disponivel_delivery: novoCanal === 'delivery_balcao',
            disponivel_salao: novoCanal === 'mesas',
          };
        }
        return it;
      })
    );
  };

  // Helper: Auto-suggest items programmed for today's weekday
  const handleApplyWeekdaySuggestion = () => {
    const suggested: ItemCardapioDiario[] = [];

    produtos.forEach((prod) => {
      // Skip drinks & desserts
      if (prod.categoria_id === 4 || prod.categoria_id === 5) return;

      // Check if product is programmed for today
      if (prod.dia_semana && prod.dia_semana.includes(diaSemanaIndex)) {
        // Marmitex (cat 2) goes to Delivery/Balcão; Pratos (cat 1 or 3) goes to Mesas
        const isMarmita = prod.categoria_id === 2;
        const canal: CanalCardapio = isMarmita ? 'delivery_balcao' : 'mesas';
        suggested.push({
          produto_id: prod.id,
          canal,
          disponivel_delivery: canal === 'delivery_balcao',
          disponivel_salao: canal === 'mesas',
        });
      }
    });

    if (suggested.length > 0) {
      setSelectedItems(suggested);
      setSaveSuccessMessage(
        `SUGESTÃO DE ${nomeDiaSemana.toUpperCase()} APLICADA COM ${suggested.length} ITENS DISTRIBUÍDOS!`
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

    const hasDelivery = selectedItems.some((it) => it.canal === 'delivery_balcao');
    const hasMesas = selectedItems.some((it) => it.canal === 'mesas');

    if (!hasDelivery && !hasMesas) {
      alert('DISTRIBUA AO MENOS UM ITEM PARA DELIVERY OU MESAS.');
      return;
    }

    setIsSaving(true);
    const timeIso = new Date().toISOString();
    const configAtualizada: CardapioDiarioConfig = {
      data: dataHojeISO,
      status: 'aberto',
      confirmado_em: timeIso,
      confirmado_por: currentPerfil?.nome || 'ADMINISTRADOR',
      itens: selectedItems.map((it) => ({
        produto_id: it.produto_id,
        canal: it.canal,
        disponivel_delivery: it.canal === 'delivery_balcao',
        disponivel_salao: it.canal === 'mesas',
      })),
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
  const deliveryItems = selectedItems.filter((it) => it.canal === 'delivery_balcao');
  const mesasItems = selectedItems.filter((it) => it.canal === 'mesas');

  // Visual helper: Render icon badge without relying on missing local images
  const renderProductVisual = (prod: Produto) => {
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
              Selecione quais Pratos e Marmitex serão vendidos hoje. Cada item é alocado de forma <strong>exclusiva</strong> no <strong>Delivery/Retirada</strong> ou nas <strong>Mesas</strong> (nunca nos dois). Bebidas e sobremesas ficam fixas em todos os canais.
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

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              value={searchLibrary}
              onChange={(e) => setSearchLibrary(e.target.value)}
              placeholder="BUSCAR PRATO OU MARMITEX PELO NOME..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
            />
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

          {/* List of Large Clickable Cards */}
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {availableEligibleDishes.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs uppercase font-medium bg-neutral-850/40 rounded-xl border border-dashed border-neutral-800">
                Nenhum prato encontrado com o filtro aplicado.
              </div>
            ) : (
              availableEligibleDishes.map((prod) => {
                const assignedCanal = getItemCanal(prod.id);
                const isSelected = assignedCanal !== null;
                const cat = categorias.find((c) => c.id === prod.categoria_id);
                const isMarmita = prod.categoria_id === 2;

                return (
                  <div
                    key={prod.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-left ${
                      assignedCanal === 'delivery_balcao'
                        ? 'bg-cyan-950/20 border-cyan-700/60 shadow-md ring-1 ring-cyan-500/20'
                        : assignedCanal === 'mesas'
                        ? 'bg-amber-950/20 border-amber-700/60 shadow-md ring-1 ring-amber-500/20'
                        : 'bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {/* Top row: Icon + Details */}
                    <div className="flex items-start gap-3">
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

                          {assignedCanal === 'delivery_balcao' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-700">
                              📦 NO DELIVERY / RETIRADA
                            </span>
                          )}

                          {assignedCanal === 'mesas' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-700">
                              🍽️ NO SALÃO (MESAS)
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-neutral-100 uppercase text-xs line-clamp-1">
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

                    {/* Bottom row: Direct Exclusive Action Buttons */}
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {/* + Delivery Button */}
                        <button
                          type="button"
                          onClick={() => handleAssignCanal(prod.id, 'delivery_balcao')}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            assignedCanal === 'delivery_balcao'
                              ? 'bg-cyan-600 text-white shadow-md'
                              : 'bg-neutral-800 hover:bg-cyan-950 hover:text-cyan-300 text-neutral-300 border border-neutral-700'
                          }`}
                          title="Aloca exclusivamente para Delivery / Balcão"
                        >
                          <Bike className="w-3.5 h-3.5 shrink-0" />
                          <span>{assignedCanal === 'delivery_balcao' ? '✓ Delivery' : '+ Delivery'}</span>
                        </button>

                        {/* + Mesas Button */}
                        <button
                          type="button"
                          onClick={() => handleAssignCanal(prod.id, 'mesas')}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            assignedCanal === 'mesas'
                              ? 'bg-amber-600 text-white shadow-md'
                              : 'bg-neutral-800 hover:bg-amber-950 hover:text-amber-300 text-neutral-300 border border-neutral-700'
                          }`}
                          title="Aloca exclusivamente para Consumo nas Mesas"
                        >
                          <Utensils className="w-3.5 h-3.5 shrink-0" />
                          <span>{assignedCanal === 'mesas' ? '✓ Mesas' : '+ Mesas'}</span>
                        </button>
                      </div>

                      {/* Quick Delete / Clear */}
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(prod.id)}
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remover do cardápio do dia"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
                Aparece no Atendimento para pedidos de entrega própria e balcão.
              </p>
            </div>

            {/* Content List */}
            <div className="flex-1 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {deliveryItems.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-xs uppercase bg-neutral-850/40 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center gap-2">
                  <Package className="w-8 h-8 text-neutral-600" />
                  <span>Nenhum item em Delivery / Retirada</span>
                  <span className="text-[10px] text-neutral-500">
                    Clique em <strong>[ + Delivery ]</strong> nos pratos da esquerda para alocar aqui.
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

                        {/* Quick Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(prod.id)}
                          className="text-neutral-500 hover:text-red-400 p-1 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remover do cardápio"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Action: Transfer Exclusively to Mesas */}
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleMoveChannel(prod.id)}
                          className="w-full py-1.5 px-2 bg-neutral-800 hover:bg-amber-950/70 hover:text-amber-300 text-neutral-300 border border-neutral-700 hover:border-amber-700 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Transfere este produto exclusivamente para as Mesas"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                          <span>Mover para Mesas 🍽️</span>
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
                Aparece exclusivamente para garçons e mesas no salão.
              </p>
            </div>

            {/* Content List */}
            <div className="flex-1 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {mesasItems.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-xs uppercase bg-neutral-850/40 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center gap-2">
                  <Utensils className="w-8 h-8 text-neutral-600" />
                  <span>Nenhum item em Mesas</span>
                  <span className="text-[10px] text-neutral-500">
                    Clique em <strong>[ + Mesas ]</strong> nos pratos da esquerda para alocar aqui.
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

                        {/* Quick Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(prod.id)}
                          className="text-neutral-500 hover:text-red-400 p-1 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remover do cardápio"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Action: Transfer Exclusively to Delivery */}
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleMoveChannel(prod.id)}
                          className="w-full py-1.5 px-2 bg-neutral-800 hover:bg-cyan-950/70 hover:text-cyan-300 text-neutral-300 border border-neutral-700 hover:border-cyan-700 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Transfere este produto exclusivamente para Delivery / Balcão"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-cyan-400" />
                          <span>Mover para Delivery 📦</span>
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

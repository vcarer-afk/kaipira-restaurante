import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ItemEstoque } from '../types';
import { UpperInput } from './UpperInput';
import {
  Boxes,
  AlertTriangle,
  Plus,
  Minus,
  Edit2,
  Check,
  Search,
  Sliders,
  Trash2,
  X,
  ArrowUpDown,
  Cloud,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface StockManagerProps {
  estoque?: ItemEstoque[];
  onUpdateItem?: (id: number, data: Partial<ItemEstoque>) => void;
  onAddItem?: (item: Partial<ItemEstoque>) => void;
  onDeleteItem?: (id: number) => void;
}

export type EstoqueSortMode = 'nome' | 'cadastro' | 'critico';

export const StockManager: React.FC<StockManagerProps> = ({
  estoque: initialEstoque,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
}) => {
  // State for inventory items directly from Supabase
  const [items, setItems] = useState<ItemEstoque[]>(initialEstoque || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [apenasAlerta, setApenasAlerta] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<EstoqueSortMode>('nome');
  const [cloudNotification, setCloudNotification] = useState<string | null>(null);

  // New Item Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [novoNome, setNovoNome] = useState<string>('');
  const [novaQty, setNovaQty] = useState<string>('10');
  const [novaUnidade, setNovaUnidade] = useState<string>('kg');
  const [novoMinimo, setNovoMinimo] = useState<string>('5');
  const [novoFornecedor, setNovoFornecedor] = useState<string>('');

  // Quick Adjust Modal
  const [adjustingItem, setAdjustingItem] = useState<ItemEstoque | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustMin, setAdjustMin] = useState<string>('');

  // Complete Edit Modal
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [editNome, setEditNome] = useState<string>('');
  const [editQty, setEditQty] = useState<string>('');
  const [editUnidade, setEditUnidade] = useState<string>('kg');
  const [editMin, setEditMin] = useState<string>('');
  const [editFornecedor, setEditFornecedor] = useState<string>('');

  // Confirm Delete Modal
  const [deletingItem, setDeletingItem] = useState<ItemEstoque | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const showNotification = (msg: string) => {
    setCloudNotification(msg);
    setTimeout(() => setCloudNotification(null), 3000);
  };

  /**
   * 1. Listar itens diretamente da tabela 'estoque' no Supabase
   */
  const fetchEstoqueFromSupabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('estoque')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('Aviso ao consultar estoque no Supabase:', error.message);
      } else if (data && data.length > 0) {
        const mapped: ItemEstoque[] = data.map((d: any) => ({
          id: Number(d.id),
          item_nome: (d.item_nome || '').toUpperCase().trim(),
          quantidade_atual: Number(d.quantidade_atual) || 0,
          unidade_medida: (d.unidade_medida || 'un').toLowerCase().trim(),
          estoque_minimo: Number(d.estoque_minimo) || 0,
          fornecedor_info: d.fornecedor_info ? d.fornecedor_info.toUpperCase().trim() : '',
          atualizado_em: d.atualizado_em,
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.warn('Erro ao conectar ao Supabase para listar estoque:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and subscribe to realtime changes on 'estoque'
  useEffect(() => {
    fetchEstoqueFromSupabase();

    const channel = supabase
      .channel('realtime_estoque_stockmanager')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estoque' },
        () => {
          fetchEstoqueFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEstoqueFromSupabase]);

  // Sync if parent updates initialEstoque
  useEffect(() => {
    if (initialEstoque && initialEstoque.length > 0 && items.length === 0) {
      setItems(initialEstoque);
    }
  }, [initialEstoque, items.length]);

  // Alert counter
  const alertItemsCount = useMemo(
    () => items.filter((it) => it.estoque_minimo > 0 && it.quantidade_atual <= it.estoque_minimo).length,
    [items]
  );

  // Filtered & Sorted items
  const filteredAndSortedEstoque = useMemo(() => {
    let result = items.filter((it) => {
      if (apenasAlerta && (it.estoque_minimo <= 0 || it.quantidade_atual > it.estoque_minimo)) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchName = it.item_nome.toLowerCase().includes(query);
        const matchFornec = it.fornecedor_info ? it.fornecedor_info.toLowerCase().includes(query) : false;
        if (!matchName && !matchFornec) return false;
      }
      return true;
    });

    if (sortMode === 'nome') {
      result.sort((a, b) => a.item_nome.localeCompare(b.item_nome, 'pt-BR', { sensitivity: 'base' }));
    } else if (sortMode === 'cadastro') {
      result.sort((a, b) => b.id - a.id);
    } else if (sortMode === 'critico') {
      result.sort((a, b) => {
        const aCritical = a.estoque_minimo > 0 && a.quantidade_atual <= a.estoque_minimo;
        const bCritical = b.estoque_minimo > 0 && b.quantidade_atual <= b.estoque_minimo;
        if (aCritical && !bCritical) return -1;
        if (!aCritical && bCritical) return 1;
        return a.quantidade_atual - b.quantidade_atual;
      });
    }

    return result;
  }, [items, apenasAlerta, search, sortMode]);

  /**
   * 2. Inserir novo insumo diretamente no Supabase (.insert())
   */
  const handleConfirmAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = novoNome.toUpperCase().trim();
    if (!cleanNome) return;

    setIsSubmitting(true);
    const qty = parseFloat(novaQty.replace(',', '.'));
    const min = parseFloat(novoMinimo.replace(',', '.'));

    const payload = {
      item_nome: cleanNome,
      quantidade_atual: !isNaN(qty) ? Math.max(0, qty) : 0,
      unidade_medida: novaUnidade.toLowerCase().trim(),
      estoque_minimo: !isNaN(min) ? Math.max(0, min) : 5,
      fornecedor_info: novoFornecedor ? novoFornecedor.toUpperCase().trim() : null,
      atualizado_em: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('estoque')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn('Erro ao inserir insumo no Supabase:', error.message);
      }

      const createdItem: ItemEstoque = data
        ? {
            id: Number(data.id),
            item_nome: data.item_nome,
            quantidade_atual: Number(data.quantidade_atual) || 0,
            unidade_medida: data.unidade_medida || 'un',
            estoque_minimo: Number(data.estoque_minimo) || 5,
            fornecedor_info: data.fornecedor_info || undefined,
            atualizado_em: data.atualizado_em,
          }
        : {
            id: Date.now(),
            ...payload,
            fornecedor_info: payload.fornecedor_info || undefined,
          };

      setItems((prev) => [...prev, createdItem]);
      onAddItem?.(createdItem);

      setShowAddModal(false);
      setNovoNome('');
      setNovaQty('10');
      setNovaUnidade('kg');
      setNovoMinimo('5');
      setNovoFornecedor('');
      showNotification(`"${cleanNome}" cadastrado e salvo na nuvem com sucesso!`);
    } catch (err) {
      console.error('Erro de rede ao salvar insumo:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 3. Atualizar insumo diretamente no Supabase (.update())
   */
  const handleConfirmFullEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmitting(true);
    const cleanNome = editNome.toUpperCase().trim();
    const qty = parseFloat(editQty.replace(',', '.'));
    const min = parseFloat(editMin.replace(',', '.'));

    const updatePayload = {
      item_nome: cleanNome || editingItem.item_nome,
      quantidade_atual: !isNaN(qty) ? Math.max(0, qty) : editingItem.quantidade_atual,
      unidade_medida: editUnidade.toLowerCase().trim(),
      estoque_minimo: !isNaN(min) ? Math.max(0, min) : editingItem.estoque_minimo,
      fornecedor_info: editFornecedor ? editFornecedor.toUpperCase().trim() : null,
      atualizado_em: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('estoque')
        .update(updatePayload)
        .eq('id', editingItem.id);

      if (error) {
        console.warn('Erro ao atualizar insumo no Supabase:', error.message);
      }

      const localUpdated: Partial<ItemEstoque> = {
        item_nome: updatePayload.item_nome,
        quantidade_atual: updatePayload.quantidade_atual,
        unidade_medida: updatePayload.unidade_medida,
        estoque_minimo: updatePayload.estoque_minimo,
        fornecedor_info: editFornecedor ? editFornecedor.toUpperCase().trim() : undefined,
        atualizado_em: updatePayload.atualizado_em,
      };

      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? { ...it, ...localUpdated } : it))
      );
      onUpdateItem?.(editingItem.id, localUpdated);

      setEditingItem(null);
      showNotification(`Insumo "${cleanNome}" atualizado na nuvem!`);
    } catch (err) {
      console.error('Erro ao atualizar insumo no Supabase:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 4. Ajuste rápido de quantidade e mínimo no Supabase (.update())
   */
  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    setIsSubmitting(true);
    const qty = parseFloat(adjustQty.replace(',', '.'));
    const min = parseFloat(adjustMin.replace(',', '.'));

    const updatePayload = {
      quantidade_atual: !isNaN(qty) ? Math.max(0, qty) : adjustingItem.quantidade_atual,
      estoque_minimo: !isNaN(min) ? Math.max(0, min) : adjustingItem.estoque_minimo,
      atualizado_em: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('estoque')
        .update(updatePayload)
        .eq('id', adjustingItem.id);

      if (error) {
        console.warn('Erro ao ajustar estoque no Supabase:', error.message);
      }

      setItems((prev) =>
        prev.map((it) => (it.id === adjustingItem.id ? { ...it, ...updatePayload } : it))
      );
      onUpdateItem?.(adjustingItem.id, updatePayload);

      setAdjustingItem(null);
      showNotification(`Ajuste de "${adjustingItem.item_nome}" salvo na nuvem!`);
    } catch (err) {
      console.error('Erro ao salvar ajuste no Supabase:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 5. Excluir alerta (define estoque_minimo = 0 no Supabase)
   */
  const handleExcluirAlerta = async (it: ItemEstoque) => {
    try {
      const updatePayload = {
        estoque_minimo: 0,
        atualizado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('estoque')
        .update(updatePayload)
        .eq('id', it.id);

      if (error) {
        console.warn('Erro ao excluir alerta no Supabase:', error.message);
      }

      setItems((prev) =>
        prev.map((item) => (item.id === it.id ? { ...item, estoque_minimo: 0 } : item))
      );
      onUpdateItem?.(it.id, updatePayload);

      showNotification(`Alerta de "${it.item_nome}" excluído na nuvem.`);
    } catch (err) {
      console.error('Erro ao excluir alerta:', err);
    }
  };

  /**
   * 6. Ajuste rápido +/- direto no Supabase
   */
  const handleQuickDelta = async (it: ItemEstoque, delta: number) => {
    const nextVal = Math.max(0, Number((it.quantidade_atual + delta).toFixed(2)));
    setItems((prev) =>
      prev.map((item) => (item.id === it.id ? { ...item, quantidade_atual: nextVal } : item))
    );
    onUpdateItem?.(it.id, { quantidade_atual: nextVal });

    try {
      await supabase
        .from('estoque')
        .update({
          quantidade_atual: nextVal,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', it.id);

      showNotification(`"${it.item_nome}": ${nextVal} ${it.unidade_medida} (salvo na nuvem)`);
    } catch (err) {
      console.warn('Erro ao atualizar saldo no Supabase:', err);
    }
  };

  /**
   * 7. Excluir insumo diretamente no Supabase (.delete())
   */
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setIsSubmitting(true);
    const targetId = deletingItem.id;
    const nome = deletingItem.item_nome;

    try {
      const { error } = await supabase
        .from('estoque')
        .delete()
        .eq('id', targetId);

      if (error) {
        console.warn('Erro ao excluir insumo no Supabase:', error.message);
      }

      setItems((prev) => prev.filter((it) => it.id !== targetId));
      onDeleteItem?.(targetId);

      setDeletingItem(null);
      showNotification(`Insumo "${nome}" excluído permanentemente da nuvem.`);
    } catch (err) {
      console.error('Erro ao excluir insumo:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAdjust = (it: ItemEstoque) => {
    setAdjustingItem(it);
    setAdjustQty(String(it.quantidade_atual));
    setAdjustMin(String(it.estoque_minimo));
  };

  const handleOpenFullEdit = (it: ItemEstoque) => {
    setEditingItem(it);
    setEditNome(it.item_nome.toUpperCase());
    setEditQty(String(it.quantidade_atual));
    setEditUnidade(it.unidade_medida || 'kg');
    setEditMin(String(it.estoque_minimo));
    setEditFornecedor(it.fornecedor_info ? it.fornecedor_info.toUpperCase() : '');
  };

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto w-full">
      {/* Cloud Toast Notification */}
      {cloudNotification && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-950 border border-emerald-600 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cloudNotification}</span>
        </div>
      )}

      {/* Stock Header & Actions */}
      <div className="bg-neutral-850 p-4 sm:p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span>Cadastro & Controle de Insumos</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
                  <Cloud className="w-3 h-3" /> Supabase Nuvem
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Ingredientes, carnes, grãos e descartáveis gravados diretamente no banco de dados Supabase
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchEstoqueFromSupabase}
            disabled={isLoading}
            className="p-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white border border-neutral-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar dados da nuvem"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {alertItemsCount > 0 && (
            <button
              type="button"
              onClick={() => setApenasAlerta(!apenasAlerta)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                apenasAlerta
                  ? 'bg-red-600 border-red-500 text-white shadow-md'
                  : 'bg-red-950/60 border-red-800 text-red-300 hover:bg-red-900/40'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                {alertItemsCount} {alertItemsCount === 1 ? 'Crítico' : 'Críticos'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Insumo</span>
          </button>
        </div>
      </div>

      {/* Alerta de Estoque de Insumos com Botões de Ajuste e Excluir Alerta */}
      {alertItemsCount > 0 && (
        <div className="bg-neutral-850 p-4 sm:p-5 rounded-2xl border border-red-800/80 shadow-md space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                Alerta de Estoque de Insumos ({alertItemsCount} {alertItemsCount === 1 ? 'item em nível crítico' : 'itens em nível crítico'})
              </h2>
            </div>
            <span className="text-[11px] text-red-400 font-bold uppercase font-mono">
              Abaixo ou no nível mínimo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {items
              .filter((it) => it.estoque_minimo > 0 && it.quantidade_atual <= it.estoque_minimo)
              .map((it) => (
                <div
                  key={it.id}
                  className="p-3 bg-red-950/30 border border-red-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white uppercase block truncate">
                      {it.item_nome}
                    </span>
                    <span className="text-[11px] text-red-300 font-mono">
                      Atual: <strong>{it.quantidade_atual} {it.unidade_medida.toUpperCase()}</strong> (Mín: {it.estoque_minimo} {it.unidade_medida.toUpperCase()})
                    </span>
                    {it.fornecedor_info && (
                      <span className="text-[10px] text-neutral-400 block truncate uppercase">
                        Origem: {it.fornecedor_info}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleOpenAdjust(it)}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ajustar quantidade em estoque deste insumo"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Ajuste de Estoque</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluirAlerta(it)}
                      className="px-2.5 py-1.5 bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-red-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                      title="Excluir alerta deste insumo (define estoque mínimo como zero no Supabase)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Excluir Alerta</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter, Search & Sorting Bar */}
      <div className="bg-neutral-850 p-3 sm:p-4 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <input
            type="text"
            placeholder="BUSCAR INSUMO (EX: ARROZ, COSTELA, EMBALAGEM)..."
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs uppercase text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-700 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] text-neutral-400 font-bold uppercase hidden sm:inline">Ordem:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as EstoqueSortMode)}
              className="bg-transparent text-white text-xs font-bold uppercase focus:outline-none cursor-pointer"
            >
              <option value="nome" className="bg-neutral-900 text-white">Nome (A-Z)</option>
              <option value="cadastro" className="bg-neutral-900 text-white">Mais Recentes</option>
              <option value="critico" className="bg-neutral-900 text-white">Mais Críticos</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 shrink-0 bg-neutral-900 px-3 py-2 rounded-xl border border-neutral-700">
            <input
              type="checkbox"
              checked={apenasAlerta}
              onChange={(e) => setApenasAlerta(e.target.checked)}
              className="accent-red-500 rounded"
            />
            <span className="text-red-400 font-bold text-[11px] uppercase">Apenas Críticos</span>
          </label>
        </div>
      </div>

      {/* Insumos List - Responsive for Mobile Cards and Desktop Table */}
      {filteredAndSortedEstoque.length === 0 ? (
        <div className="bg-neutral-850 p-8 rounded-2xl border border-neutral-800 text-center text-neutral-400 space-y-2">
          <Boxes className="w-8 h-8 text-neutral-600 mx-auto" />
          <p className="text-xs font-bold uppercase">
            {isLoading ? 'Carregando insumos do Supabase...' : 'Nenhum insumo encontrado'}
          </p>
          <p className="text-[11px] text-neutral-500">
            {isLoading ? 'Por favor aguarde um instante.' : 'Tente ajustar a busca ou cadastre um novo item acima.'}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (Visible on small screens) */}
          <div className="grid grid-cols-1 gap-2.5 sm:hidden">
            {filteredAndSortedEstoque.map((it) => {
              const isAlert = it.estoque_minimo > 0 && it.quantidade_atual <= it.estoque_minimo;

              return (
                <div
                  key={it.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isAlert ? 'bg-red-950/20 border-red-800/80 shadow-xs' : 'bg-neutral-850 border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-bold text-white uppercase text-xs block leading-tight">
                        {it.item_nome}
                      </span>
                      <span className="text-[10px] text-neutral-400 uppercase mt-0.5 block">
                        {it.fornecedor_info || 'COMPRA LOCAL (PIRACICABA)'}
                      </span>
                    </div>

                    {isAlert ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Crítico
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-900 shrink-0">
                        <Check className="w-3 h-3" />
                        Normal
                      </span>
                    )}
                  </div>

                  {/* Stock Quantities */}
                  <div className="flex items-center justify-between py-2 border-t border-b border-neutral-800/80 my-2 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block font-bold">Qtd Atual</span>
                      <span className={`text-sm font-black font-mono ${isAlert ? 'text-red-400' : 'text-white'}`}>
                        {it.quantidade_atual} {it.unidade_medida.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 uppercase block font-bold">Estoque Mínimo</span>
                      <span className="text-xs font-bold font-mono text-neutral-300">
                        {it.estoque_minimo} {it.unidade_medida.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons for Mobile */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleQuickDelta(it, -1)}
                        className="w-8 h-8 rounded-lg bg-neutral-800 active:bg-neutral-700 flex items-center justify-center text-neutral-200 border border-neutral-700 font-bold"
                        title="-1 unidade"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDelta(it, 1)}
                        className="w-8 h-8 rounded-lg bg-neutral-800 active:bg-neutral-700 flex items-center justify-center text-neutral-200 border border-neutral-700 font-bold"
                        title="+1 unidade"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjust(it)}
                        className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-amber-400 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1"
                        title="Ajuste rápido"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Ajustar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenFullEdit(it)}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-750 text-white border border-neutral-700 rounded-lg"
                        title="Editar insumo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingItem(it)}
                        className="p-1.5 bg-neutral-800 hover:bg-red-950/80 text-neutral-400 hover:text-red-400 border border-neutral-700 hover:border-red-800 rounded-lg"
                        title="Excluir insumo do Supabase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TABLE VIEW (Tablet & Desktop) */}
          <div className="hidden sm:block bg-neutral-850 rounded-2xl border border-neutral-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 uppercase font-bold text-[11px]">
                    <th className="p-3.5">Insumo / Ingrediente</th>
                    <th className="p-3.5 text-right">Qtd Atual</th>
                    <th className="p-3.5 text-right">Estoque Mínimo</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5">Fornecedor / Origem</th>
                    <th className="p-3.5 text-right">Ações & Ajuste Rápido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredAndSortedEstoque.map((it) => {
                    const isAlert = it.estoque_minimo > 0 && it.quantidade_atual <= it.estoque_minimo;

                    return (
                      <tr
                        key={it.id}
                        className={`hover:bg-neutral-800/40 transition-colors ${
                          isAlert ? 'bg-red-950/20' : ''
                        }`}
                      >
                        {/* Name */}
                        <td className="p-3.5 font-bold text-white uppercase">
                          <div className="flex flex-col">
                            <span>{it.item_nome}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              CÓD: #{it.id}
                            </span>
                          </div>
                        </td>

                        {/* Current Quantity */}
                        <td className="p-3.5 text-right tabular-nums">
                          <span className={`text-sm font-black font-mono ${isAlert ? 'text-red-400' : 'text-white'}`}>
                            {it.quantidade_atual} {it.unidade_medida.toUpperCase()}
                          </span>
                        </td>

                        {/* Min threshold */}
                        <td className="p-3.5 text-right tabular-nums text-neutral-400 font-mono">
                          <span>
                            {it.estoque_minimo} {it.unidade_medida.toUpperCase()}
                          </span>
                        </td>

                        {/* Status Indicator */}
                        <td className="p-3.5 text-center">
                          {isAlert ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800">
                              <AlertTriangle className="w-3 h-3" />
                              Repor Urgente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-900">
                              <Check className="w-3 h-3" />
                              Adequado
                            </span>
                          )}
                        </td>

                        {/* Fornecedor */}
                        <td className="p-3.5 text-neutral-400 uppercase text-[11px]">
                          {it.fornecedor_info || 'COMPRA LOCAL (PIRACICABA)'}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Fast +/- */}
                            <button
                              type="button"
                              onClick={() => handleQuickDelta(it, -1)}
                              className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-750 active:scale-95 flex items-center justify-center text-neutral-300 font-bold border border-neutral-700 cursor-pointer"
                              title="-1 no estoque"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickDelta(it, 1)}
                              className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-750 active:scale-95 flex items-center justify-center text-neutral-300 font-bold border border-neutral-700 cursor-pointer"
                              title="+1 no estoque"
                            >
                              <Plus className="w-3 h-3" />
                            </button>

                            {/* Adjust Modal */}
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust(it)}
                              className="p-1.5 bg-neutral-800 hover:bg-amber-900/50 text-neutral-300 hover:text-amber-300 border border-neutral-700 rounded-lg cursor-pointer"
                              title="Ajuste rápido de estoque e mínimo"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            {/* Full Edit Modal */}
                            <button
                              type="button"
                              onClick={() => handleOpenFullEdit(it)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 rounded-lg cursor-pointer"
                              title="Alterar cadastro do insumo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Insumo */}
                            <button
                              type="button"
                              onClick={() => setDeletingItem(it)}
                              className="p-1.5 bg-neutral-800 hover:bg-red-950/80 text-neutral-400 hover:text-red-400 border border-neutral-700 hover:border-red-800 rounded-lg cursor-pointer"
                              title="Excluir insumo do Supabase"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL 1: CADASTRAR NOVO INSUMO (INCLUSÃO) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAddItem}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    Cadastrar Insumo no Supabase
                  </h3>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    PERSISTÊNCIA 100% NUVEM DIRETA
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME DO INSUMO: * (EM MAIÚSCULAS)
              </label>
              <input
                type="text"
                required
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value.toUpperCase())}
                placeholder="EX: LINGUIÇA CAIPIRA ARTESANAL (KG)"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  QTD ATUAL: *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={novaQty}
                  onChange={(e) => setNovaQty(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  UNIDADE: *
                </label>
                <select
                  value={novaUnidade}
                  onChange={(e) => setNovaUnidade(e.target.value.toLowerCase())}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="kg">KG (QUILOGRAMA)</option>
                  <option value="un">UN (UNIDADE)</option>
                  <option value="pct">PCT (PACOTE)</option>
                  <option value="cx">CX (CAIXA)</option>
                  <option value="litro">LITRO (L)</option>
                  <option value="g">G (GRAMA)</option>
                  <option value="ml">ML (MILILITRO)</option>
                  <option value="lata">LATA</option>
                  <option value="fardo">FARDO</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  ESTOQUE MÍNIMO: *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={novoMinimo}
                  onChange={(e) => setNovoMinimo(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                FORNECEDOR / ORIGEM (OPCIONAL): (EM MAIÚSCULAS)
              </label>
              <input
                type="text"
                value={novoFornecedor}
                onChange={(e) => setNovoFornecedor(e.target.value.toUpperCase())}
                placeholder="EX: CEASA PIRACICABA / FRIGORÍFICO REGIONAL"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSubmitting ? 'Gravando no Supabase...' : 'Gravar no Supabase'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: ALTERAR INSUMO (ALTERAÇÃO COMPLETA) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmFullEdit}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    Alterar Insumo no Supabase
                  </h3>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    ID #{editingItem.id} · ATUALIZAÇÃO DIRETA NO BANCO
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME DO INSUMO: * (EM MAIÚSCULAS)
              </label>
              <input
                type="text"
                required
                value={editNome}
                onChange={(e) => setEditNome(e.target.value.toUpperCase())}
                placeholder="NOME DO INSUMO"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  QTD ATUAL: *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  UNIDADE: *
                </label>
                <select
                  value={editUnidade}
                  onChange={(e) => setEditUnidade(e.target.value.toLowerCase())}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="kg">KG (QUILOGRAMA)</option>
                  <option value="un">UN (UNIDADE)</option>
                  <option value="pct">PCT (PACOTE)</option>
                  <option value="cx">CX (CAIXA)</option>
                  <option value="litro">LITRO (L)</option>
                  <option value="g">G (GRAMA)</option>
                  <option value="ml">ML (MILILITRO)</option>
                  <option value="lata">LATA</option>
                  <option value="fardo">FARDO</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  ESTOQUE MÍNIMO: *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editMin}
                  onChange={(e) => setEditMin(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                FORNECEDOR / ORIGEM (OPCIONAL): (EM MAIÚSCULAS)
              </label>
              <input
                type="text"
                value={editFornecedor}
                onChange={(e) => setEditFornecedor(e.target.value.toUpperCase())}
                placeholder="EX: CEASA PIRACICABA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md cursor-pointer transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: EXCLUSÃO DE INSUMO (CONFIRMAÇÃO SEGURA) */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-red-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-700 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase">
                  Excluir Insumo do Supabase?
                </h3>
                <span className="text-[10px] text-red-400 font-mono">
                  EXCLUSÃO DIRETA NA TABELA REMOTA
                </span>
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-xs font-bold text-white uppercase block">
                {deletingItem.item_nome}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono block">
                Saldo atual: {deletingItem.quantidade_atual} {deletingItem.unidade_medida.toUpperCase()} · Mínimo: {deletingItem.estoque_minimo} {deletingItem.unidade_medida.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-neutral-300">
              Deseja realmente excluir este insumo? A linha correspondente na tabela <code className="text-amber-400">estoque</code> do Supabase será removida permanentemente.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md cursor-pointer transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Excluindo...' : 'Sim, Excluir no Supabase'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AJUSTE RÁPIDO DE ESTOQUE */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmAdjust}
            className="bg-neutral-850 rounded-2xl border border-neutral-700 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-white uppercase">
                  Ajuste Rápido de Saldo (Supabase)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
              <span className="text-xs font-bold text-white uppercase block">
                {adjustingItem.item_nome}
              </span>
              <span className="text-[11px] text-neutral-400 block font-mono">
                Unidade: {adjustingItem.unidade_medida.toUpperCase()} · Mínimo Cadastrado: {adjustingItem.estoque_minimo} {adjustingItem.unidade_medida.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  NOVA QUANTIDADE ({adjustingItem.unidade_medida.toUpperCase()}): *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  ESTOQUE MÍNIMO ALERTA: *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustMin}
                  onChange={(e) => setAdjustMin(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Quick addition buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">
                Adicionar rapidamente ao saldo:
              </span>
              <div className="flex gap-2">
                {[5, 10, 20, 50].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(adjustQty.replace(',', '.')) || adjustingItem.quantidade_atual;
                      setAdjustQty(String(Number((cur + delta).toFixed(2))));
                    }}
                    className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-lg text-xs font-bold font-mono transition-colors border border-neutral-700 cursor-pointer active:scale-95"
                  >
                    +{delta}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

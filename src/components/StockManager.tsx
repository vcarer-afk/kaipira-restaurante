import React, { useState } from 'react';
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
  CheckCircle,
} from 'lucide-react';

interface StockManagerProps {
  estoque: ItemEstoque[];
  onUpdateItem: (id: number, data: Partial<ItemEstoque>) => void;
  onAddItem: (item: Partial<ItemEstoque>) => void;
}

export const StockManager: React.FC<StockManagerProps> = ({
  estoque,
  onUpdateItem,
  onAddItem,
}) => {
  const [search, setSearch] = useState('');
  const [apenasAlerta, setApenasAlerta] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editMin, setEditMin] = useState('');

  // New Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaQty, setNovaQty] = useState('10');
  const [novaUnidade, setNovaUnidade] = useState('kg');
  const [novoMinimo, setNovoMinimo] = useState('5');
  const [novoFornecedor, setNovoFornecedor] = useState('');

  const alertItemsCount = estoque.filter((it) => it.quantidade_atual <= it.estoque_minimo).length;

  const filteredEstoque = estoque.filter((it) => {
    if (apenasAlerta && it.quantidade_atual > it.estoque_minimo) return false;
    if (search && !it.item_nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleStartEdit = (it: ItemEstoque) => {
    setEditingId(it.id);
    setEditQty(String(it.quantidade_atual));
    setEditMin(String(it.estoque_minimo));
  };

  const handleSaveEdit = (id: number) => {
    onUpdateItem(id, {
      quantidade_atual: Number(editQty || 0),
      estoque_minimo: Number(editMin || 0),
    });
    setEditingId(null);
  };

  const handleQuickDelta = (it: ItemEstoque, delta: number) => {
    const nextVal = Math.max(0, it.quantidade_atual + delta);
    onUpdateItem(it.id, { quantidade_atual: nextVal });
  };

  const handleConfirmAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome) return;

    onAddItem({
      item_nome: novoNome.toUpperCase(),
      quantidade_atual: Number(novaQty || 0),
      unidade_medida: novaUnidade.toLowerCase(),
      estoque_minimo: Number(novoMinimo || 5),
      fornecedor_info: novoFornecedor.toUpperCase(),
    });

    setShowAddModal(false);
    setNovoNome('');
    setNovoFornecedor('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stock Header & Alerts */}
      <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            <span>Controle de Estoque Simplificado & Insumos</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Acompanhamento diário de carnes, grãos, embalagens e ingredientes da cozinha
          </p>
        </div>

        <div className="flex items-center gap-3">
          {alertItemsCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-700 text-red-300 text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{alertItemsCount} itens no Estoque Mínimo!</span>
            </div>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Insumo
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-neutral-850 p-3 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
          <input
            type="text"
            placeholder="BUSCAR INSUMO (EX: ARROZ, COSTELA, EMBALAGEM)..."
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs uppercase text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 shrink-0">
          <input
            type="checkbox"
            checked={apenasAlerta}
            onChange={(e) => setApenasAlerta(e.target.checked)}
            className="accent-red-500 rounded"
          />
          <span className="text-red-400 font-bold">Ver apenas itens em nível crítico</span>
        </label>
      </div>

      {/* Inventory Table */}
      <div className="bg-neutral-850 rounded-xl border border-neutral-800 overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/70 text-neutral-400 uppercase font-bold text-[11px]">
              <th className="p-3">Insumo / Ingrediente</th>
              <th className="p-3 text-right">Qtd Atual</th>
              <th className="p-3 text-right">Estoque Mínimo</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3">Fornecedor (Piracicaba/Região)</th>
              <th className="p-3 text-right">Ajuste Rápido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filteredEstoque.map((it) => {
              const isAlert = it.quantidade_atual <= it.estoque_minimo;
              const isEditing = editingId === it.id;

              return (
                <tr
                  key={it.id}
                  className={`hover:bg-neutral-800/40 transition-colors ${
                    isAlert ? 'bg-red-950/20' : ''
                  }`}
                >
                  <td className="p-3 font-bold text-white uppercase">
                    {it.item_nome}
                  </td>

                  {/* Quantity */}
                  <td className="p-3 text-right tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.5"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="w-16 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-white rounded text-xs text-right font-bold"
                      />
                    ) : (
                      <span className={`text-sm font-black ${isAlert ? 'text-red-400' : 'text-white'}`}>
                        {it.quantidade_atual} {it.unidade_medida}
                      </span>
                    )}
                  </td>

                  {/* Min threshold */}
                  <td className="p-3 text-right tabular-nums text-neutral-400">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.5"
                        value={editMin}
                        onChange={(e) => setEditMin(e.target.value)}
                        className="w-16 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-white rounded text-xs text-right font-bold"
                      />
                    ) : (
                      <span>
                        {it.estoque_minimo} {it.unidade_medida}
                      </span>
                    )}
                  </td>

                  {/* Status Indicator */}
                  <td className="p-3 text-center">
                    {isAlert ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        Repor Urgente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-900">
                        <Check className="w-3 h-3" />
                        Adequado
                      </span>
                    )}
                  </td>

                  {/* Fornecedor */}
                  <td className="p-3 text-neutral-400 uppercase text-[11px]">
                    {it.fornecedor_info || 'COMPRA LOCAL'}
                  </td>

                  {/* Quick +/- Action */}
                  <td className="p-3 text-right">
                    {isEditing ? (
                      <button
                        onClick={() => handleSaveEdit(it.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                      >
                        Salvar
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleQuickDelta(it, -1)}
                          className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-750 flex items-center justify-center text-neutral-300 font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleQuickDelta(it, 1)}
                          className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-750 flex items-center justify-center text-neutral-300 font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(it)}
                          className="p-1 text-neutral-400 hover:text-white"
                          title="Editar valor exato"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* NEW ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAddItem}
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase">
                Cadastrar Insumo de Estoque
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <UpperInput
              label="NOME DO INSUMO: *"
              value={novoNome}
              onChange={setNovoNome}
              placeholder="EX: LINGUIÇA CAIPIRA ARTESANAL (KG)"
              required
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  QTD ATUAL:
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={novaQty}
                  onChange={(e) => setNovaQty(e.target.value)}
                  className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 text-white rounded text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  UNIDADE:
                </label>
                <select
                  value={novaUnidade}
                  onChange={(e) => setNovaUnidade(e.target.value)}
                  className="w-full p-1.5 bg-neutral-800 border border-neutral-700 text-white rounded text-xs uppercase"
                >
                  <option value="kg">KG</option>
                  <option value="un">UNIDADE</option>
                  <option value="pct">PACOTE</option>
                  <option value="cx">CAIXA</option>
                  <option value="litro">LITRO</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  MÍNIMO:
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={novoMinimo}
                  onChange={(e) => setNovoMinimo(e.target.value)}
                  className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 text-white rounded text-xs"
                />
              </div>
            </div>

            <UpperInput
              label="FORNECEDOR / ORIGEM (OPCIONAL):"
              value={novoFornecedor}
              onChange={setNovoFornecedor}
              placeholder="EX: CEASA PIRACICABA"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Cadastrar Item
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

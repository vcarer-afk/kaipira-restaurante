import { Pedido, Produto, ItemEstoque, IngredienteComposicao } from '../types';

export interface ItemDeducaoCalculada {
  item_estoque_id: number | string;
  item_nome: string;
  quantidade_debitar: number;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  ficara_negativo: boolean;
  ficara_abaixo_minimo: boolean;
}

export const calcularDeducoesDoPedido = (
  pedido: Pedido,
  produtos: Produto[] = [],
  estoque: ItemEstoque[] = []
): ItemDeducaoCalculada[] => {
  const mapaDeducoes = new Map<number | string, {
    item_estoque_id: number | string;
    item_nome: string;
    quantidade_debitar: number;
    unidade_medida: string;
    quantidade_atual: number;
    estoque_minimo: number;
  }>();

  const mapaProdutos = new Map<number | string, Produto>();
  produtos.forEach((p) => {
    mapaProdutos.set(p.id, p);
    mapaProdutos.set(String(p.id), p);
    if (p.nome) {
      mapaProdutos.set(p.nome.trim().toUpperCase(), p);
    }
  });

  const mapaEstoque = new Map<number | string, ItemEstoque>();
  estoque.forEach((e) => {
    mapaEstoque.set(e.id, e);
    mapaEstoque.set(String(e.id), e);
  });

  // Percorre os itens do pedido
  (pedido.itens || []).forEach((itemPed) => {
    // Ignora metadados internos de entrega
    if ((itemPed as any).nome === '__META_DELIVERY__' || (itemPed as any).produto_nome === '__META_DELIVERY__') return;

    const qtdComprada = Number(itemPed.quantidade) || 1;
    const produtoBase =
      (itemPed.produto_id && (mapaProdutos.get(itemPed.produto_id) || mapaProdutos.get(String(itemPed.produto_id)))) ||
      (itemPed.produto_nome && mapaProdutos.get(itemPed.produto_nome.trim().toUpperCase()));

    if (!produtoBase) return;

    // CASO 1: Produto PRONTO (Revenda Direta: Bebidas, Doces)
    if (produtoBase.tipo_produto === 'pronto' && produtoBase.item_estoque_id) {
      const itemEst = mapaEstoque.get(produtoBase.item_estoque_id) || mapaEstoque.get(String(produtoBase.item_estoque_id));
      if (itemEst) {
        const id = itemEst.id;
        const anterior = mapaDeducoes.get(id);
        const qtdDeb = (anterior ? anterior.quantidade_debitar : 0) + qtdComprada;

        mapaDeducoes.set(id, {
          item_estoque_id: id,
          item_nome: itemEst.item_nome,
          quantidade_debitar: qtdDeb,
          unidade_medida: itemEst.unidade_medida || 'un',
          quantidade_atual: Number(itemEst.quantidade_atual) || 0,
          estoque_minimo: Number(itemEst.estoque_minimo) || 0,
        });
      }
    }

    // CASO 2: Produto PREPARADO (Cozinha: Marmitex, Prato Feito, Porção com Ficha Técnica)
    else if (produtoBase.tipo_produto === 'preparado' && produtoBase.composicao && produtoBase.composicao.length > 0) {
      produtoBase.composicao.forEach((ingrediente: IngredienteComposicao) => {
        if (!ingrediente.item_estoque_id) return;
        const itemEst = mapaEstoque.get(ingrediente.item_estoque_id) || mapaEstoque.get(String(ingrediente.item_estoque_id));
        if (!itemEst) return;

        const id = itemEst.id;
        const qtdNecessaria = (Number(ingrediente.quantidade) || 0) * qtdComprada;
        const anterior = mapaDeducoes.get(id);
        const qtdDeb = (anterior ? anterior.quantidade_debitar : 0) + qtdNecessaria;

        mapaDeducoes.set(id, {
          item_estoque_id: id,
          item_nome: itemEst.item_nome,
          quantidade_debitar: qtdDeb,
          unidade_medida: ingrediente.unidade_medida || itemEst.unidade_medida || 'un',
          quantidade_atual: Number(itemEst.quantidade_atual) || 0,
          estoque_minimo: Number(itemEst.estoque_minimo) || 0,
        });
      });
    }

    // CASO 3: COMBO
    else if (produtoBase.tipo_produto === 'combo' && produtoBase.composicao) {
      produtoBase.composicao.forEach((comp) => {
        if (comp.produto_filho_id) {
          const prodFilho = mapaProdutos.get(comp.produto_filho_id) || mapaProdutos.get(String(comp.produto_filho_id));
          if (prodFilho) {
            // Se o filho for pronto
            if (prodFilho.tipo_produto === 'pronto' && prodFilho.item_estoque_id) {
              const itemEst = mapaEstoque.get(prodFilho.item_estoque_id) || mapaEstoque.get(String(prodFilho.item_estoque_id));
              if (itemEst) {
                const id = itemEst.id;
                const deb = (Number(comp.quantidade) || 1) * qtdComprada;
                const anterior = mapaDeducoes.get(id);
                mapaDeducoes.set(id, {
                  item_estoque_id: id,
                  item_nome: itemEst.item_nome,
                  quantidade_debitar: (anterior ? anterior.quantidade_debitar : 0) + deb,
                  unidade_medida: itemEst.unidade_medida || 'un',
                  quantidade_atual: Number(itemEst.quantidade_atual) || 0,
                  estoque_minimo: Number(itemEst.estoque_minimo) || 0,
                });
              }
            }
            // Se o filho for preparado
            else if (prodFilho.tipo_produto === 'preparado' && prodFilho.composicao) {
              prodFilho.composicao.forEach((ing) => {
                if (!ing.item_estoque_id) return;
                const itemEst = mapaEstoque.get(ing.item_estoque_id) || mapaEstoque.get(String(ing.item_estoque_id));
                if (!itemEst) return;
                const id = itemEst.id;
                const deb = (Number(ing.quantidade) || 0) * (Number(comp.quantidade) || 1) * qtdComprada;
                const anterior = mapaDeducoes.get(id);
                mapaDeducoes.set(id, {
                  item_estoque_id: id,
                  item_nome: itemEst.item_nome,
                  quantidade_debitar: (anterior ? anterior.quantidade_debitar : 0) + deb,
                  unidade_medida: ing.unidade_medida || itemEst.unidade_medida || 'un',
                  quantidade_atual: Number(itemEst.quantidade_atual) || 0,
                  estoque_minimo: Number(itemEst.estoque_minimo) || 0,
                });
              });
            }
          }
        }
      });
    }
  });

  return Array.from(mapaDeducoes.values()).map((d) => {
    const saldoFinal = d.quantidade_atual - d.quantidade_debitar;
    return {
      ...d,
      ficara_negativo: d.quantidade_atual <= 0 || saldoFinal < 0,
      ficara_abaixo_minimo: saldoFinal <= d.estoque_minimo && saldoFinal >= 0,
    };
  });
};

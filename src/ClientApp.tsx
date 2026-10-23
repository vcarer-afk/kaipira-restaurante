import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  ShoppingBag,
  Search,
  Clock,
  Phone,
  MapPin,
  Plus,
  AlertCircle,
  Flame,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  Produto,
  Categoria,
  ConfiguracoesSistema,
  CardapioDiarioConfig,
} from './types';
import {
  fetchConfiguracoesFromSupabase,
  fetchProdutosSupabase,
  fetchCategoriasSupabase,
  fetchCardapioDiarioSupabase,
} from './services/supabaseClient';
import { formatBRL } from './utils/formatters';

export default function ClientApp() {
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesSistema | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cardapioDiario, setCardapioDiario] = useState<CardapioDiarioConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Interface states
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | 'todos'>('todos');
  const [busca, setBusca] = useState<string>('');
  const [carrinhoItensCount, setCarrinhoItensCount] = useState<number>(0);
  const [carrinhoTotal, setCarrinhoTotal] = useState<number>(0);

  // Fetch de dados do Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [confRes, prodsRes, catsRes, cardapioRes] = await Promise.allSettled([
          fetchConfiguracoesFromSupabase(),
          fetchProdutosSupabase(),
          fetchCategoriasSupabase(),
          fetchCardapioDiarioSupabase(),
        ]);

        if (!isMounted) return;

        if (confRes.status === 'fulfilled' && confRes.value) {
          setConfiguracoes(confRes.value);
        }
        if (prodsRes.status === 'fulfilled' && prodsRes.value) {
          setProdutos(prodsRes.value);
        }
        if (catsRes.status === 'fulfilled' && catsRes.value) {
          setCategorias(catsRes.value);
        }
        if (cardapioRes.status === 'fulfilled' && cardapioRes.value) {
          setCardapioDiario(cardapioRes.value);
        }
      } catch (err) {
        console.warn('Erro ao carregar cardápio para o cliente:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Regra de Filtro de Produtos para Delivery do Cliente:
  // (categoria_id === 4 || categoria_id === 5) OU (está presente em cardapioDiario.itens E possui disponivel_delivery === true)
  const produtosDisponiveis = useMemo(() => {
    return produtos.filter((p) => {
      if (p.pausado) return false;

      const isCategoriaFixa = Number(p.categoria_id) === 4 || Number(p.categoria_id) === 5;
      const isInCardapioDelivery = cardapioDiario?.itens?.some(
        (it) => Number(it.produto_id) === Number(p.id) && it.disponivel_delivery === true
      );

      return isCategoriaFixa || !!isInCardapioDelivery;
    });
  }, [produtos, cardapioDiario]);

  // Produtos filtrados por categoria selecionada e texto de busca
  const produtosFiltrados = useMemo(() => {
    return produtosDisponiveis.filter((p) => {
      const matchCat =
        categoriaAtiva === 'todos' || Number(p.categoria_id) === Number(categoriaAtiva);

      const q = busca.toLowerCase().trim();
      const matchBusca =
        !q ||
        (p.nome && p.nome.toLowerCase().includes(q)) ||
        (p.descricao && p.descricao.toLowerCase().includes(q));

      return matchCat && matchBusca;
    });
  }, [produtosDisponiveis, categoriaAtiva, busca]);

  // Handler de demonstração para o botão Adicionar (carrinho funcional será integrado no próximo passo)
  const handleAdicionarItem = (produto: Produto) => {
    const preco = Number(produto.preco_delivery) || Number(produto.preco_salao) || 0;
    setCarrinhoItensCount((prev) => prev + 1);
    setCarrinhoTotal((prev) => prev + preco);
  };

  // Se o carregamento terminou e o cardapioDiario não estiver 'aberto', exibe a tela de Restaurante Fechado
  const isAberto = cardapioDiario && cardapioDiario.status === 'aberto';

  if (!loading && !isAberto) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
        {/* Header Superior */}
        <header className="bg-neutral-900/90 border-b border-neutral-800 p-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-white uppercase">
                  {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
                </h1>
                <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">
                  Tradição e Sabor da Roça
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="text-neutral-500 hover:text-neutral-300 p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Acesso Administrativo"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </header>

        {/* Ecrã de Restaurante Fechado */}
        <main className="flex-1 max-w-md mx-auto p-6 flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-500 shadow-2xl">
              <Clock className="w-12 h-12 stroke-[1.5]" />
            </div>
            <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider">
              Fechado
            </span>
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">
            Restaurante Fechado no Momento
          </h2>

          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            Nosso cardápio do dia ainda não foi liberado para delivery ou nosso horário de atendimento foi encerrado.
          </p>

          <div className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 text-left space-y-3 mb-6">
            <div className="flex items-start gap-3 text-xs text-neutral-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block uppercase">Horário de Funcionamento:</strong>
                <span>
                  {configuracoes?.horarioFuncionamento || 'Segunda a Sábado — Almoço das 11:00 às 14:00'}
                </span>
              </div>
            </div>

            {configuracoes?.telefone && (
              <div className="flex items-center gap-3 text-xs text-neutral-300">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <strong className="text-white block uppercase">Contato & WhatsApp:</strong>
                  <span>{configuracoes.telefone}</span>
                </div>
              </div>
            )}

            {configuracoes?.endereco && (
              <div className="flex items-center gap-3 text-xs text-neutral-300">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <strong className="text-white block uppercase">Endereço:</strong>
                  <span>
                    {configuracoes.endereco}, {configuracoes.numero} - {configuracoes.bairro}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black font-black uppercase rounded-xl text-xs tracking-wider transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            Verificar Novamente
          </button>
        </main>

        {/* Rodapé */}
        <footer className="p-4 text-center border-t border-neutral-900 text-[11px] text-neutral-600">
          © {new Date().getFullYear()} {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'} · Cardápio Digital
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-black pb-28">
      {/* Top Header Mobile-First */}
      <header className="bg-neutral-900/95 border-b border-neutral-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white uppercase">
                  {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
                </h1>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Aberto
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium">
                {configuracoes?.horarioFuncionamento || 'Almoço das 11h às 14h'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Acesso Administrativo"
            >
              <Lock className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar marmita, prato ou bebida..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-800/80 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Categorias em Horizontal Scroll */}
        <div className="border-t border-neutral-800/80 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-2">
            <button
              onClick={() => setCategoriaAtiva('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase whitespace-nowrap transition-all cursor-pointer ${
                categoriaAtiva === 'todos'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              Todos ({produtosDisponiveis.length})
            </button>

            {categorias.map((cat) => {
              const count = produtosDisponiveis.filter(
                (p) => Number(p.categoria_id) === Number(cat.id)
              ).length;
              if (count === 0 && categoriaAtiva !== cat.id) return null;

              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase whitespace-nowrap transition-all cursor-pointer ${
                    categoriaAtiva === cat.id
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                  }`}
                >
                  {cat.nome} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal: Lista de Produtos */}
      <main className="max-w-2xl mx-auto px-4 py-5 flex-1 w-full">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Carregando Cardápio do Dia...
            </span>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-3 bg-neutral-900/50 rounded-2xl border border-neutral-800 p-6">
            <UtensilsCrossed className="w-10 h-10 stroke-[1.5] text-neutral-600" />
            <h3 className="text-sm font-black uppercase text-neutral-300">
              Nenhum produto encontrado
            </h3>
            <p className="text-xs text-neutral-500 max-w-xs">
              {busca
                ? 'Tente buscar com outros termos ou selecione outra categoria.'
                : 'Não há itens disponíveis no cardápio de delivery para esta categoria hoje.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {produtosFiltrados.map((prod) => {
              const preco = Number(prod.preco_delivery) || Number(prod.preco_salao) || 0;
              const cat = categorias.find((c) => Number(c.id) === Number(prod.categoria_id));

              return (
                <div
                  key={prod.id}
                  className="bg-neutral-900 rounded-2xl border border-neutral-800/90 p-3.5 flex flex-col justify-between hover:border-neutral-700 transition-all shadow-sm"
                >
                  <div className="flex gap-3">
                    {/* Imagem do Produto */}
                    <div className="w-20 h-20 rounded-xl bg-neutral-800 shrink-0 overflow-hidden relative border border-neutral-700/60 flex items-center justify-center">
                      {prod.url_imagem ? (
                        <img
                          src={prod.url_imagem}
                          alt={prod.nome}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <UtensilsCrossed className="w-7 h-7 text-neutral-600" />
                      )}
                    </div>

                    {/* Dados do Produto */}
                    <div className="flex-1 min-w-0">
                      {cat && (
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block mb-0.5 truncate">
                          {cat.nome}
                        </span>
                      )}
                      <h4 className="text-xs font-black text-white uppercase leading-snug line-clamp-2">
                        {prod.nome}
                      </h4>
                      {prod.descricao && (
                        <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                          {prod.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Preço e Botão Adicionar */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-800/80">
                    <div>
                      <span className="text-[10px] text-neutral-500 font-bold uppercase block">
                        Preço Unitário
                      </span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        {formatBRL(preco)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAdicionarItem(prod)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Barra Inferior Sticky com Esqueleto Visual do Carrinho */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 border-t border-neutral-800 backdrop-blur-md p-3.5 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-neutral-800 rounded-xl text-amber-400 border border-neutral-700">
              <ShoppingBag className="w-5 h-5" />
              {carrinhoItensCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black min-w-[18px] text-center shadow-md">
                  {carrinhoItensCount}
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-black text-white block uppercase">
                {carrinhoItensCount === 0
                  ? 'Sacola Vazia'
                  : `${carrinhoItensCount} ${carrinhoItensCount === 1 ? 'item' : 'itens'}`}
              </span>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {formatBRL(carrinhoTotal)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={carrinhoItensCount === 0}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              carrinhoItensCount > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
            }`}
          >
            <span>Ver Sacola</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

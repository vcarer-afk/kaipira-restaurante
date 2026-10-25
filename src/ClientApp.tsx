import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  UtensilsCrossed,
  ShoppingBag,
  Search,
  Clock,
  Phone,
  MapPin,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Lock,
  Check,
  CreditCard,
  Banknote,
  QrCode,
  Bike,
  Sparkles,
  RefreshCw,
  X,
  Send,
} from 'lucide-react';
import {
  Produto,
  Categoria,
  ConfiguracoesSistema,
  CardapioDiarioConfig,
  BairroTaxa,
  FormaPagamentoConfig,
  Cliente,
  Pedido,
  Opcional,
  CaixaDiario,
} from './types';
import {
  fetchConfiguracoesFromSupabase,
  fetchProdutosSupabase,
  fetchCategoriasSupabase,
  fetchCardapioDiarioSupabase,
  fetchBairrosSupabase,
  fetchFormasPagamentoSupabase,
  fetchCaixaDiarioSupabase,
  salvarClienteSupabase,
  criarPedidoSupabase,
} from './services/supabaseClient';
import { supabase } from './lib/supabase';
import { formatBRL, formatPhone, cleanDigits, formatCep } from './utils/formatters';

// Interface do item no carrinho do cliente
interface CartItem {
  cartItemId: string;
  produto: Produto;
  quantidade: number;
  observacao: string;
  opcionaisSelecionados: Opcional[];
  precoUnitario: number;
}

// Passos do fluxo de compra
type CheckoutStep = 'menu' | 'cart' | 'checkout' | 'success';

function isUUID(str?: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export default function ClientApp() {
  // Dados do Servidor / Nuvem
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesSistema | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cardapioDiario, setCardapioDiario] = useState<CardapioDiarioConfig | null>(null);
  const [caixa, setCaixa] = useState<CaixaDiario | null>(null);
  const [bairros, setBairros] = useState<BairroTaxa[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);

  // Navegação e Filtros da Vitrine
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('menu');
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | 'todos'>('todos');
  const [busca, setBusca] = useState<string>('');

  // Estado do Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modal de Opcionais ao Adicionar
  const [selectedProdutoOpcionais, setSelectedProdutoOpcionais] = useState<Produto | null>(null);
  const [tempOpcionais, setTempOpcionais] = useState<Opcional[]>([]);
  const [tempObservacao, setTempObservacao] = useState<string>('');
  const [tempQuantidade, setTempQuantidade] = useState<number>(1);

  // Dados do Checkout (Cliente e Entrega)
  const [clienteTelefone, setClienteTelefone] = useState<string>('');
  const [clienteNome, setClienteNome] = useState<string>('');
  const [clienteCep, setClienteCep] = useState<string>('');
  const [clienteRua, setClienteRua] = useState<string>('');
  const [clienteNumero, setClienteNumero] = useState<string>('');
  const [clienteBairro, setClienteBairro] = useState<string>('');
  const [clienteComplemento, setClienteComplemento] = useState<string>('');
  const [clienteMatchedId, setClienteMatchedId] = useState<string | null>(null);
  const [isSearchingPhone, setIsSearchingPhone] = useState<boolean>(false);
  const [isSearchingCep, setIsSearchingCep] = useState<boolean>(false);
  const [taxaEntrega, setTaxaEntrega] = useState<number>(0);

  // Pagamento
  const [metodoPagamento, setMetodoPagamento] = useState<string>('pix');
  const [precisaTroco, setPrecisaTroco] = useState<boolean>(false);
  const [trocoPara, setTrocoPara] = useState<string>('');

  // Status de Submissão e Pedido Concluído
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pedidoConcluido, setPedidoConcluido] = useState<Pedido | null>(null);

  // Carregamento de dados com suporte a recarga silenciosa
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshingStatus(true);

      const [confRes, prodsRes, catsRes, cardapioRes, bairrosRes, formasRes, caixaRes] =
        await Promise.allSettled([
          fetchConfiguracoesFromSupabase(),
          fetchProdutosSupabase(),
          fetchCategoriasSupabase(),
          fetchCardapioDiarioSupabase(),
          fetchBairrosSupabase(),
          fetchFormasPagamentoSupabase(),
          fetchCaixaDiarioSupabase(),
        ]);

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
      if (bairrosRes.status === 'fulfilled' && bairrosRes.value) {
        setBairros(bairrosRes.value);
      }
      if (formasRes.status === 'fulfilled' && formasRes.value) {
        setFormasPagamento(formasRes.value.filter((f) => f.ativo));
      }
      if (caixaRes.status === 'fulfilled' && caixaRes.value) {
        setCaixa(caixaRes.value);
      }
    } catch (err) {
      console.warn('Erro ao carregar vitrine do cliente:', err);
    } finally {
      setLoading(false);
      setIsRefreshingStatus(false);
    }
  }, []);

  // Acompanhamento em tempo real do pedido concluído via Supabase Realtime
  useEffect(() => {
    if (!pedidoConcluido?.id) return;

    const trackingChannel = supabase
      .channel(`pedido_tracking_${pedidoConcluido.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${pedidoConcluido.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setPedidoConcluido((prev) => (prev ? { ...prev, ...payload.new } : payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      trackingChannel.unsubscribe();
    };
  }, [pedidoConcluido?.id]);

  const handleRefreshPedidoStatus = async () => {
    if (!pedidoConcluido?.id) return;
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoConcluido.id)
        .single();
      if (!error && data) {
        setPedidoConcluido((prev) => (prev ? { ...prev, ...data } : data));
      }
    } catch (err) {
      console.warn('Erro ao atualizar status do pedido:', err);
    }
  };

  // Carregamento inicial de dados e sincronização em tempo real (Supabase Realtime)
  useEffect(() => {
    loadData();

    // Sincronização Realtime via canal unificado do Supabase
    const channel = supabase
      .channel('restaurante_kaipira_cloud_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes' },
        async (payload: any) => {
          if (payload.new) {
            const loaded = payload.new.dados ? { ...payload.new.dados, ...payload.new } : payload.new;
            setConfiguracoes((prev) => ({ ...prev, ...loaded }));
          } else {
            const conf = await fetchConfiguracoesFromSupabase();
            if (conf) setConfiguracoes(conf);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cardapio_diario' },
        async () => {
          const cd = await fetchCardapioDiarioSupabase();
          if (cd) setCardapioDiario(cd);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caixa_diario' },
        async (payload: any) => {
          if (payload.new) {
            setCaixa(payload.new as CaixaDiario);
          } else {
            const cx = await fetchCaixaDiarioSupabase();
            if (cx) setCaixa(cx);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        async () => {
          const prs = await fetchProdutosSupabase();
          if (prs) setProdutos(prs);
        }
      )
      .on('broadcast', { event: 'configuracoes_alteradas' }, (payload: any) => {
        if (payload?.payload) {
          setConfiguracoes((prev) => ({ ...prev, ...payload.payload }));
        }
      })
      .on('broadcast', { event: 'kill_switch_toggled' }, (payload: any) => {
        if (payload?.payload) {
          setConfiguracoes((prev) => ({ ...prev, ...payload.payload }));
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadData]);

  // Cardápio Efetivo: espelho das configuracoes ou cardapioDiario
  const cardapioEfetivo = configuracoes?.cardapio_diario_cache?.status === 'publicado' 
    ? configuracoes.cardapio_diario_cache 
    : cardapioDiario;

  const statusCardapioStr = (cardapioEfetivo?.status || '').toLowerCase();

  // Regra de Filtro de Produtos para Vitrine / Delivery do Cliente:
  // 1. Exibe os pratos presentes no cardápio diário selecionado (com disponivel_delivery === true)
  // 2. Libera também todas as bebidas cadastradas e ativas (não pausadas) para venda no site
  const produtosDisponiveis = useMemo(() => {
    return produtos.filter((p) => {
      // Se produto está pausado/esgotado no cadastro, nunca aparece
      if (p.pausado) return false;

      // Identifica se o produto é da categoria Bebidas
      const cat = categorias.find((c) => Number(c.id) === Number(p.categoria_id));
      const catNome = (cat?.nome || '').toLowerCase();
      const isBebida =
        Number(p.categoria_id) === 4 ||
        catNome.includes('bebida') ||
        catNome.includes('refrigerante') ||
        catNome.includes('suco') ||
        catNome.includes('cerveja') ||
        catNome.includes('água') ||
        catNome.includes('agua');

      // Se for bebida disponível, está sempre liberada para venda no site
      if (isBebida) {
        return true;
      }

      // Para pratos e itens do cardápio do dia, valida se o cardápio está ativo e o item liberado
      if (!cardapioEfetivo?.itens || cardapioEfetivo.itens.length === 0) {
        return false;
      }

      return cardapioEfetivo.itens.some(
        (it) => Number(it.produto_id) === Number(p.id) && it.disponivel_delivery === true
      );
    });
  }, [produtos, categorias, cardapioEfetivo]);

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

  // Cálculos do Carrinho
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.precoUnitario * it.quantidade, 0);
  }, [cart]);

  const cartTotalItens = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.quantidade, 0);
  }, [cart]);

  const cartTotalComEntrega = useMemo(() => {
    return cartSubtotal + taxaEntrega;
  }, [cartSubtotal, taxaEntrega]);

  // Função para calcular a Taxa Mágica do Bairro
  const calcularTaxaParaBairro = (nomeBairro: string): number => {
    if (!nomeBairro || bairros.length === 0) {
      const outros = bairros.find((b) => normalizeStr(b.bairro).includes('outros'));
      return outros ? outros.taxa : 0;
    }

    const buscado = normalizeStr(nomeBairro);
    // 1. Correspondência exata
    const match = bairros.find((b) => normalizeStr(b.bairro) === buscado);
    if (match) return match.taxa;

    // 2. Correspondência parcial
    const matchParcial = bairros.find((b) => {
      const bNorm = normalizeStr(b.bairro);
      return bNorm.includes(buscado) || buscado.includes(bNorm);
    });
    if (matchParcial) return matchParcial.taxa;

    // 3. Fallback "OUTROS" ou 0
    const outros = bairros.find((b) => normalizeStr(b.bairro).includes('outros'));
    return outros ? outros.taxa : 0;
  };

  // Handler para iniciar adição do produto ao carrinho
  const handleIniciarAdicionar = (produto: Produto) => {
    if (produto.opcionais && produto.opcionais.length > 0) {
      setSelectedProdutoOpcionais(produto);
      setTempOpcionais([]);
      setTempObservacao('');
      setTempQuantidade(1);
    } else {
      adicionarAoCarrinho(produto, [], '', 1);
    }
  };

  // Adiciona item efetivamente ao carrinho
  const adicionarAoCarrinho = (
    produto: Produto,
    opcionais: Opcional[],
    observacao: string,
    quantidade: number
  ) => {
    const precoBase = Number(produto.preco_delivery) || Number(produto.preco_salao) || 0;
    const precoOpcionais = opcionais.reduce((acc, op) => acc + (Number(op.preco_adicional) || 0), 0);
    const precoUnitarioTotal = precoBase + precoOpcionais;

    const opcKey = opcionais.map((o) => o.id).sort().join('-');
    const cartItemId = `${produto.id}_${opcKey}_${observacao.trim()}`;

    setCart((prevCart) => {
      const index = prevCart.findIndex((item) => item.cartItemId === cartItemId);
      if (index >= 0) {
        const updated = [...prevCart];
        updated[index].quantidade += quantidade;
        return updated;
      }
      return [
        ...prevCart,
        {
          cartItemId,
          produto,
          quantidade,
          observacao: observacao.trim(),
          opcionaisSelecionados: opcionais,
          precoUnitario: precoUnitarioTotal,
        },
      ];
    });

    setSelectedProdutoOpcionais(null);
  };

  // Ajustar quantidade no carrinho
  const handleAtualizarQuantidade = (cartItemId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const novaQtd = item.quantidade + delta;
            return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remover item do carrinho
  const handleRemoverItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((it) => it.cartItemId !== cartItemId));
  };

  // Busca do Cliente no Supabase pelo Telefone com normalização estrita
  const handleBuscarClientePorTelefone = async (telValue: string) => {
    const cleanInput = telValue.replace(/\D/g, '');
    if (cleanInput.length < 10) return;

    setIsSearchingPhone(true);
    try {
      const { data: clients } = await supabase
        .from('clientes')
        .select('*')
        .limit(200);

      if (clients && clients.length > 0) {
        const c = clients.find(
          (cli: Cliente) => (cli.telefone || '').replace(/\D/g, '') === cleanInput
        );

        if (c) {
          setClienteMatchedId(c.id);
          if (c.nome) setClienteNome(c.nome);
          if (c.cep) setClienteCep(c.cep);
          if (c.endereco) setClienteRua(c.endereco);
          if (c.numero) setClienteNumero(c.numero);
          if (c.bairro) {
            setClienteBairro(c.bairro);
            const taxa = calcularTaxaParaBairro(c.bairro);
            setTaxaEntrega(taxa);
          }
          if (c.complemento) setClienteComplemento(c.complemento);
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar cliente por telefone:', err);
    } finally {
      setIsSearchingPhone(false);
    }
  };

  // Busca de Endereço via CEP (ViaCEP)
  const handleBuscarViaCep = async (cepValue: string) => {
    const digits = cleanDigits(cepValue);
    if (digits.length !== 8) return;

    setIsSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();

      if (data.erro) {
        alert('CEP não encontrado ou inválido. Por favor, verifique o número digitado.');
        return;
      }

      if (data.logradouro) setClienteRua(data.logradouro.toUpperCase());
      if (data.bairro) {
        const bairroNome = data.bairro.toUpperCase();
        setClienteBairro(bairroNome);
        const taxa = calcularTaxaParaBairro(bairroNome);
        setTaxaEntrega(taxa);
      }
    } catch (err) {
      console.warn('Erro ao consultar ViaCEP:', err);
      alert('Não foi possível consultar o CEP no momento. Por favor, preencha o endereço manualmente.');
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Alteração manual do Bairro
  const handleAlterarBairro = (novoBairro: string) => {
    setClienteBairro(novoBairro);
    const taxa = calcularTaxaParaBairro(novoBairro);
    setTaxaEntrega(taxa);
  };

  // Submissão do Pedido ao Supabase
  const handleFinalizarPedido = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Sua sacola está vazia.');
      setCheckoutStep('menu');
      return;
    }

    if (!clienteTelefone.trim() || cleanDigits(clienteTelefone).length < 10) {
      alert('Por favor, informe um telefone válido com DDD para contato.');
      return;
    }

    if (!clienteNome.trim()) {
      alert('Por favor, informe seu nome completo.');
      return;
    }

    if (!clienteRua.trim() || !clienteNumero.trim() || !clienteBairro.trim()) {
      alert('Por favor, preencha todos os campos do endereço (Rua, Número e Bairro).');
      return;
    }

    if (metodoPagamento === 'dinheiro' && precisaTroco) {
      const trocoNum = parseFloat(trocoPara.replace(',', '.'));
      if (isNaN(trocoNum) || trocoNum < cartTotalComEntrega) {
        alert(
          `O valor do troco deve ser maior que o total do pedido (${formatBRL(cartTotalComEntrega)}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Criar ou Atualizar Cliente na Nuvem (tabela 'clientes')
      const clientePayload: Partial<Cliente> = {
        id: clienteMatchedId || undefined,
        nome: clienteNome.toUpperCase().trim(),
        telefone: formatPhone(clienteTelefone),
        cep: clienteCep ? formatCep(clienteCep) : '13400-000',
        endereco: clienteRua.toUpperCase().trim(),
        numero: clienteNumero.toUpperCase().trim(),
        bairro: clienteBairro.toUpperCase().trim(),
        complemento: clienteComplemento ? clienteComplemento.toUpperCase().trim() : undefined,
        eh_mensalista: false,
      };

      const cliRes = await salvarClienteSupabase(clientePayload);
      const clienteSalvo = cliRes.data;

      // 2. Montar Pedido e Enviar via criarPedidoSupabase (tabelas 'pedidos', 'itens_pedido' e 'pagamentos')
      const trocoCalculado =
        metodoPagamento === 'dinheiro' && precisaTroco
          ? parseFloat(trocoPara.replace(',', '.'))
          : undefined;

      const pedidoPayload = {
        tipo: 'delivery' as const,
        status: 'pendente' as const,
        cliente_id: clienteSalvo?.id && isUUID(clienteSalvo.id) ? clienteSalvo.id : undefined,
        cliente: clienteSalvo || clientePayload,
        taxa_entrega: taxaEntrega,
        valor_total: cartTotalComEntrega,
        precisa_troco: metodoPagamento === 'dinheiro' && precisaTroco,
        troco_para: trocoCalculado,
        forma_pagamento: metodoPagamento,
        pagamentos: [
          {
            forma: metodoPagamento,
            valor: cartTotalComEntrega,
          },
        ],
        itens: cart.map((it) => ({
          produto_id: it.produto.id,
          produto_nome: it.produto.nome,
          quantidade: it.quantidade,
          preco_unitario: it.precoUnitario,
          observacao: it.observacao ? it.observacao.toUpperCase().trim() : undefined,
          opcionais_selecionados:
            it.opcionaisSelecionados.length > 0
              ? it.opcionaisSelecionados.map((op) => ({
                  id: op.id,
                  nome: op.nome,
                  preco_adicional: op.preco_adicional,
                }))
              : undefined,
        })),
      };

      const pedidoCriado = await criarPedidoSupabase(pedidoPayload);

      setPedidoConcluido(pedidoCriado);
      setCart([]);
      setCheckoutStep('success');
    } catch (err: any) {
      console.error('Erro ao finalizar pedido:', err);
      alert(
        'Ocorreu um erro ao registrar seu pedido. Por favor, tente novamente ou entre em contato pelo WhatsApp.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Condição de Abertura da Vitrine do Cliente com Kill Switch
  const isCaixaAberto = caixa ? (caixa?.status || '').toLowerCase() === 'aberto' : true;
  const isDeliverySiteAtivo = configuracoes ? configuracoes?.delivery_site_ativo !== false : true;
  const isCardapioAtivo = ['publicado', 'aberto', 'confirmado'].includes((cardapioEfetivo?.status || '').toLowerCase()) || true;

  // Vitrine respeita o Kill Switch de entregas e status do caixa
  const isVitrineAberta = isDeliverySiteAtivo && isCaixaAberto;

  if (!loading && !isVitrineAberta) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
        <header className="bg-neutral-900/90 border-b border-neutral-800 p-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.jpg"
                alt={configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
                className="w-10 h-10 object-cover rounded-xl border border-amber-500/50 shadow-md"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                }}
              />
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

        <main className="flex-1 max-w-md mx-auto p-6 flex flex-col items-center justify-center text-center">
          <div className="flex justify-center mb-5">
            <img
              src="/logo.jpg"
              alt={configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
              className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>

          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-500 shadow-2xl">
              <Clock className="w-10 h-10 stroke-[1.5]" />
            </div>
            <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider">
              Fechado
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mb-2">
            Restaurante Fechado no momento
          </h2>

          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            {!isCaixaAberto
              ? 'O caixa diário ainda não foi aberto no painel administrativo.'
              : !isCardapioAtivo
              ? 'O cardápio do dia ainda não foi confirmado pelo gerente.'
              : !isDeliverySiteAtivo
              ? 'No momento as entregas pelo site estão pausadas.'
              : 'Aguarde a liberação do atendimento para efetuar seu pedido.'}
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
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshingStatus}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black font-black uppercase rounded-xl text-xs tracking-wider transition-all shadow-lg shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
            <span>{isRefreshingStatus ? 'Consultando Supabase...' : 'Atualizar Status'}</span>
          </button>
        </main>

        {/* Rodapé com Diagnóstico em Tempo Real para Testes e Produção */}
        <footer className="p-4 border-t border-neutral-900 bg-neutral-950 text-[11px] text-neutral-400 flex flex-col items-center gap-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${
                isCaixaAberto
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-red-950/80 text-red-300 border-red-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isCaixaAberto ? 'bg-emerald-400' : 'bg-red-400'}`} />
              Caixa: {isCaixaAberto ? 'ABERTO' : 'FECHADO'}
            </span>

            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${
                isCardapioAtivo
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isCardapioAtivo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              Cardápio: {isCardapioAtivo ? 'CONFIRMADO' : 'AGUARDANDO'}
            </span>

            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${
                isDeliverySiteAtivo
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isDeliverySiteAtivo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              Entregas Site: {isDeliverySiteAtivo ? 'ATIVO' : 'PAUSADO'}
            </span>
          </div>

          <div className="text-[10px] text-neutral-600">
            © {new Date().getFullYear()} {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'} · Cardápio Digital
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // TELA DE SUCESSO (PEDIDO REALIZADO)
  // =========================================================================
  if (checkoutStep === 'success' && pedidoConcluido) {
    const whatsAppNumero = cleanDigits(configuracoes?.telefone || '19999999999');
    const msgWhats = encodeURIComponent(
      `Olá, fiz o pedido #${pedidoConcluido.codigo_senha || pedidoConcluido.id} no site do ${
        configuracoes?.nomeRestaurante || 'Restaurante Kaipira'
      }! Gostaria de acompanhar a entrega.`
    );

    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
        <header className="bg-neutral-900/90 border-b border-neutral-800 p-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-black font-black">
                <Flame className="w-5 h-5" />
              </div>
              <h1 className="text-sm font-black uppercase tracking-tight text-white">
                {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
              </h1>
            </div>
            <Link to="/admin" className="text-neutral-500 hover:text-white p-2">
              <Lock className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-md mx-auto p-5 w-full flex flex-col justify-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider">
              Pedido Enviado para a Cozinha
            </span>

            <h2 className="text-2xl font-black uppercase text-white mt-3 mb-1">
              Obrigado, {clienteNome.split(' ')[0]}!
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              Seu pedido já está registrado no nosso sistema e já está sendo preparado.
            </p>

            {/* Número / Senha do Pedido */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 mb-5">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">
                Número do seu Pedido / Senha
              </span>
              <span className="text-3xl font-black text-amber-400 font-mono">
                #{pedidoConcluido.codigo_senha || pedidoConcluido.id}
              </span>
              <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 mt-2">
                <Bike className="w-4 h-4 text-amber-500" />
                <span>Previsão de entrega: <strong>35 a 50 minutos</strong></span>
              </div>
            </div>

            {/* Resumo do Pedido */}
            <div className="text-left text-xs bg-neutral-950/50 rounded-xl p-3.5 border border-neutral-800/80 space-y-2 mb-6">
              <div className="flex justify-between text-neutral-400 pb-2 border-b border-neutral-800">
                <span>Forma de Pagamento:</span>
                <strong className="text-white uppercase">
                  {pedidoConcluido.forma_pagamento?.replace('_', ' ') || 'A combinar'}
                </strong>
              </div>
              <div className="flex justify-between text-neutral-400 pb-2 border-b border-neutral-800">
                <span>Entrega em:</span>
                <strong className="text-white truncate max-w-[200px]">
                  {clienteRua}, {clienteNumero} - {clienteBairro}
                </strong>
              </div>
              <div className="flex justify-between text-neutral-300 font-bold pt-1">
                <span>Total a Pagar:</span>
                <span className="text-amber-400 font-mono text-sm font-black">
                  {formatBRL(pedidoConcluido.valor_total)}
                </span>
              </div>
            </div>

            {/* ============================================================= */}
            {/* NOVO: Acompanhamento em Tempo Real na Vitrine do Cliente      */}
            {/* ============================================================= */}
            {(() => {
              const statusPedido = (pedidoConcluido.status || 'pendente').toLowerCase();
              let currentStep = 1;
              if (statusPedido === 'entregue') {
                currentStep = 4;
              } else if (statusPedido === 'a_caminho' || statusPedido === 'pronto') {
                currentStep = 3;
              } else if (statusPedido === 'em_preparacao') {
                currentStep = 2;
              } else {
                currentStep = 1;
              }

              const etapasTracking = [
                { id: 1, label: 'Pedido Confirmado', desc: 'Pedido recebido com sucesso na cozinha' },
                { id: 2, label: 'Preparando', desc: 'No fogão a lenha sendo preparado com carinho' },
                { id: 3, label: 'A Caminho', desc: 'Saiu para entrega com o nosso motoboy' },
                { id: 4, label: 'Entregue', desc: 'Pedido entregue com sucesso no seu endereço' },
              ];

              return (
                <div className="bg-neutral-950 border border-amber-500/50 rounded-2xl p-4 mb-5 text-left shadow-xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                        Acompanhe sua entrega
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Tempo Real</span>
                    </span>
                  </div>

                  {/* Fluxo Sequencial Exato: Pedido Confirmado ➔ Preparando ➔ A Caminho ➔ Entregue */}
                  <div className="bg-neutral-900/80 rounded-xl p-2.5 border border-neutral-800 mb-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight text-neutral-400">
                      <span className={currentStep >= 1 ? 'text-amber-400 font-bold' : 'text-neutral-500'}>
                        Pedido Confirmado
                      </span>
                      <span className="text-neutral-600 font-bold text-xs">➔</span>
                      <span className={currentStep >= 2 ? 'text-amber-400 font-bold' : 'text-neutral-500'}>
                        Preparando
                      </span>
                      <span className="text-neutral-600 font-bold text-xs">➔</span>
                      <span className={currentStep >= 3 ? 'text-amber-400 font-bold' : 'text-neutral-500'}>
                        A Caminho
                      </span>
                      <span className="text-neutral-600 font-bold text-xs">➔</span>
                      <span className={currentStep >= 4 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                        Entregue
                      </span>
                    </div>

                    {/* Barra de Progresso Sequencial */}
                    <div className="relative flex items-center justify-between mt-3 px-1">
                      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-neutral-800 z-0">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                          style={{
                            width:
                              currentStep === 1
                                ? '0%'
                                : currentStep === 2
                                ? '33%'
                                : currentStep === 3
                                ? '66%'
                                : '100%',
                          }}
                        />
                      </div>

                      {etapasTracking.map((etp) => {
                        const isDone = currentStep > etp.id;
                        const isCurrent = currentStep === etp.id;
                        return (
                          <div key={etp.id} className="relative z-10 flex flex-col items-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                                isDone
                                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                                  : isCurrent
                                  ? 'bg-amber-500 text-black ring-4 ring-amber-500/30 animate-pulse font-extrabold'
                                  : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                              }`}
                            >
                              {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : etp.id}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card do Status Atual */}
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold uppercase text-white flex items-center gap-1.5">
                        {currentStep === 1 && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                        {currentStep === 2 && <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                        {currentStep === 3 && <Bike className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />}
                        {currentStep === 4 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>Status: {etapasTracking[currentStep - 1].label}</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold">
                        {pedidoConcluido.status?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-neutral-400 text-[11px] leading-relaxed">
                      {etapasTracking[currentStep - 1].desc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshPedidoStatus}
                    className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-lg text-[10px] font-bold uppercase border border-neutral-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-500" />
                    <span>Atualizar Status</span>
                  </button>
                </div>
              );
            })()}

            {/* Botões de Ação */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleRefreshPedidoStatus}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black uppercase rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Bike className="w-4 h-4" />
                <span>Acompanhe sua entrega</span>
              </button>
              {whatsAppNumero && (
                <a
                  href={`https://wa.me/55${whatsAppNumero}?text=${msgWhats}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Acompanhar pelo WhatsApp</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setPedidoConcluido(null);
                  setCheckoutStep('menu');
                }}
                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fazer Novo Pedido
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // TELA DE CARRINHO / SACOLA
  // =========================================================================
  if (checkoutStep === 'cart') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-black">
        {/* Top Header */}
        <header className="bg-neutral-900/95 border-b border-neutral-800 sticky top-0 z-30 p-4 backdrop-blur-md">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setCheckoutStep('menu')}
              className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white uppercase transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Cardápio</span>
            </button>
            <h1 className="text-sm font-black uppercase tracking-wider text-white">
              Sua Sacola ({cartTotalItens})
            </h1>
            <div className="w-16" />
          </div>
        </header>

        {/* Lista de Itens */}
        <main className="max-w-2xl mx-auto p-4 flex-1 w-full space-y-4 pb-32">
          {cart.length === 0 ? (
            <div className="py-24 text-center text-neutral-500 flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="w-12 h-12 stroke-[1.5] text-neutral-600" />
              <p className="text-sm font-bold uppercase text-neutral-400">Sua sacola está vazia</p>
              <button
                onClick={() => setCheckoutStep('menu')}
                className="mt-2 px-5 py-2.5 bg-amber-500 text-black text-xs font-black uppercase rounded-xl"
              >
                Escolher Pratos
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-white uppercase leading-snug">
                          {item.produto.nome}
                        </h4>

                        {item.opcionaisSelecionados.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.opcionaisSelecionados.map((op) => (
                              <span
                                key={op.id}
                                className="px-2 py-0.5 rounded-md bg-neutral-800 text-amber-400 text-[10px] font-bold uppercase"
                              >
                                + {op.nome} ({formatBRL(op.preco_adicional)})
                              </span>
                            ))}
                          </div>
                        )}

                        {item.observacao && (
                          <p className="text-[11px] text-neutral-400 italic mt-1 bg-neutral-950/60 px-2 py-1 rounded-md border border-neutral-800/60">
                            Obs: {item.observacao}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoverItem(item.cartItemId)}
                        className="text-neutral-500 hover:text-red-400 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Remover produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-800/80">
                      <span className="text-sm font-black text-amber-400 font-mono">
                        {formatBRL(item.precoUnitario * item.quantidade)}
                      </span>

                      {/* Stepper de Quantidade */}
                      <div className="flex items-center gap-2 bg-neutral-800 rounded-xl p-1 border border-neutral-700">
                        <button
                          onClick={() => handleAtualizarQuantidade(item.cartItemId, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-neutral-700/60 hover:bg-neutral-600 text-white cursor-pointer transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-black text-white w-5 text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => handleAtualizarQuantidade(item.cartItemId, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-neutral-700/60 hover:bg-neutral-600 text-white cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão Adicionar mais itens */}
              <button
                type="button"
                onClick={() => setCheckoutStep('menu')}
                className="w-full py-2.5 border border-dashed border-neutral-700 hover:border-amber-500 text-neutral-400 hover:text-amber-400 text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Mais Itens ao Pedido</span>
              </button>

              {/* Resumo */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-xs space-y-2 mt-4">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal dos Itens:</span>
                  <span className="font-mono text-white font-bold">{formatBRL(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Taxa de Entrega:</span>
                  <span className="text-neutral-500">Calculada na próxima etapa</span>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Footer de Ação */}
        {cart.length > 0 && (
          <aside className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 border-t border-neutral-800 backdrop-blur-md p-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Subtotal</span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  {formatBRL(cartSubtotal)}
                </span>
              </div>
              <button
                onClick={() => setCheckoutStep('checkout')}
                className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black uppercase text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                <span>Avançar para Entrega</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </aside>
        )}
      </div>
    );
  }

  // =========================================================================
  // TELA DE CHECKOUT (ENTREGA, VIACEP E PAGAMENTO)
  // =========================================================================
  if (checkoutStep === 'checkout') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-black pb-36">
        <header className="bg-neutral-900/95 border-b border-neutral-800 sticky top-0 z-30 p-4 backdrop-blur-md">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setCheckoutStep('cart')}
              className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white uppercase transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar à Sacola</span>
            </button>
            <h1 className="text-sm font-black uppercase tracking-wider text-white">
              Entrega & Pagamento
            </h1>
            <div className="w-16" />
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4 flex-1 w-full space-y-5">
          <form onSubmit={handleFinalizarPedido} className="space-y-5">
            {/* 1. SEÇÃO DE IDENTIFICAÇÃO DO CLIENTE */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xs">
                  1
                </div>
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Identificação do Cliente
                </h3>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                  WhatsApp / Celular com DDD: *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={clienteTelefone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setClienteTelefone(formatted);
                    }}
                    onBlur={() => handleBuscarClientePorTelefone(clienteTelefone)}
                    placeholder="(19) 9-9999-9999"
                    className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  {isSearchingPhone && (
                    <RefreshCw className="w-4 h-4 text-amber-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  Se você já fez pedidos antes, seus dados de entrega serão carregados automaticamente.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                  Seu Nome Completo: *
                </label>
                <input
                  type="text"
                  required
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value.toUpperCase())}
                  placeholder="EX: MARIA APARECIDA DA SILVA"
                  className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* 2. SEÇÃO DE ENDEREÇO DE ENTREGA (VIACEP & BAIRRO MÁGICO) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xs">
                  2
                </div>
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Endereço para Entrega
                </h3>
              </div>

              {/* CEP com Busca ViaCEP */}
              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                  CEP de Piracicaba (opcional):
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={clienteCep}
                      onChange={(e) => {
                        const masked = formatCep(e.target.value);
                        setClienteCep(masked);
                        if (cleanDigits(masked).length === 8) {
                          handleBuscarViaCep(masked);
                        }
                      }}
                      onBlur={() => handleBuscarViaCep(clienteCep)}
                      placeholder="13400-000"
                      className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    {isSearchingCep && (
                      <RefreshCw className="w-4 h-4 text-amber-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuscarViaCep(clienteCep)}
                    className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-bold uppercase rounded-xl transition-colors cursor-pointer"
                  >
                    Buscar CEP
                  </button>
                </div>
              </div>

              {/* Rua e Número */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                    Rua / Avenida: *
                  </label>
                  <input
                    type="text"
                    required
                    value={clienteRua}
                    onChange={(e) => setClienteRua(e.target.value.toUpperCase())}
                    placeholder="EX: RUA GOVERNADOR PEDRO DE TOLEDO"
                    className="w-full px-3.5 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                    Número: *
                  </label>
                  <input
                    type="text"
                    required
                    value={clienteNumero}
                    onChange={(e) => setClienteNumero(e.target.value.toUpperCase())}
                    placeholder="EX: 1250"
                    className="w-full px-3.5 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Bairro com Cálculo de Taxa Mágica */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                  Bairro (Piracicaba): *
                </label>

                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={clienteBairro}
                    onChange={(e) => handleAlterarBairro(e.target.value.toUpperCase())}
                    placeholder="DIGITE O BAIRRO (EX: CENTRO, VILA REZENDE...)"
                    className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />

                  {/* Seletor rápido de bairros se houver cadastrados */}
                  {bairros.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase shrink-0">
                        Ou selecione:
                      </span>
                      <select
                        value={clienteBairro}
                        onChange={(e) => handleAlterarBairro(e.target.value)}
                        className="w-full px-2 py-1 bg-neutral-850 border border-neutral-700 rounded-lg text-xs text-neutral-200 uppercase focus:outline-none"
                      >
                        <option value="">SELECIONE DA LISTA DE PIRACICABA...</option>
                        {bairros.map((b) => (
                          <option key={b.bairro} value={b.bairro}>
                            {b.bairro} — {formatBRL(b.taxa)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Badge da Taxa de Entrega Calculada */}
                  <div className="flex items-center justify-between p-2.5 bg-neutral-950/80 rounded-xl border border-neutral-800 text-xs">
                    <span className="text-neutral-400 flex items-center gap-1.5 font-bold">
                      <Bike className="w-4 h-4 text-amber-500" />
                      Taxa de Entrega para este Bairro:
                    </span>
                    <span className="font-mono text-amber-400 font-black">
                      {taxaEntrega === 0 ? 'GRÁTIS' : formatBRL(taxaEntrega)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Complemento */}
              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1 uppercase">
                  Complemento / Ponto de Referência (opcional):
                </label>
                <input
                  type="text"
                  value={clienteComplemento}
                  onChange={(e) => setClienteComplemento(e.target.value.toUpperCase())}
                  placeholder="EX: APTO 42 BLOCO B / EM FRENTE À PADARIA"
                  className="w-full px-3.5 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* 3. SEÇÃO DE FORMA DE PAGAMENTO */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xs">
                  3
                </div>
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Como Deseja Pagar?
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* PIX */}
                <label
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    metodoPagamento === 'pix'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-neutral-850 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="forma_pg"
                    value="pix"
                    checked={metodoPagamento === 'pix'}
                    onChange={() => setMetodoPagamento('pix')}
                    className="sr-only"
                  />
                  <QrCode className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div>
                    <strong className="text-xs uppercase block">PIX</strong>
                    <span className="text-[10px] text-neutral-400 block">
                      Chave informada no pedido ou na entrega
                    </span>
                  </div>
                </label>

                {/* Dinheiro */}
                <label
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    metodoPagamento === 'dinheiro'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-neutral-850 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="forma_pg"
                    value="dinheiro"
                    checked={metodoPagamento === 'dinheiro'}
                    onChange={() => setMetodoPagamento('dinheiro')}
                    className="sr-only"
                  />
                  <Banknote className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="text-xs uppercase block">Dinheiro em Espécie</strong>
                    <span className="text-[10px] text-neutral-400 block">Pagar na entrega ao motoboy</span>
                  </div>
                </label>

                {/* Cartão de Crédito */}
                <label
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    metodoPagamento === 'cartao_credito'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-neutral-850 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="forma_pg"
                    value="cartao_credito"
                    checked={metodoPagamento === 'cartao_credito'}
                    onChange={() => setMetodoPagamento('cartao_credito')}
                    className="sr-only"
                  />
                  <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <strong className="text-xs uppercase block">Cartão de Crédito</strong>
                    <span className="text-[10px] text-neutral-400 block">Levar maquininha na entrega</span>
                  </div>
                </label>

                {/* Cartão de Débito */}
                <label
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    metodoPagamento === 'cartao_debito'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-neutral-850 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="forma_pg"
                    value="cartao_debito"
                    checked={metodoPagamento === 'cartao_debito'}
                    onChange={() => setMetodoPagamento('cartao_debito')}
                    className="sr-only"
                  />
                  <CreditCard className="w-5 h-5 text-blue-400 shrink-0" />
                  <div>
                    <strong className="text-xs uppercase block">Cartão de Débito</strong>
                    <span className="text-[10px] text-neutral-400 block">Levar maquininha na entrega</span>
                  </div>
                </label>

                {/* Vale Refeição */}
                <label
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all sm:col-span-2 ${
                    metodoPagamento === 'vale_refeicao'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-neutral-850 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="forma_pg"
                    value="vale_refeicao"
                    checked={metodoPagamento === 'vale_refeicao'}
                    onChange={() => setMetodoPagamento('vale_refeicao')}
                    className="sr-only"
                  />
                  <UtensilsCrossed className="w-5 h-5 text-purple-400 shrink-0" />
                  <div>
                    <strong className="text-xs uppercase block">Vale Refeição / Alimentação</strong>
                    <span className="text-[10px] text-neutral-400 block">
                      Alelo, Ticket, Sodexo, VR Benefícios (Levar maquininha)
                    </span>
                  </div>
                </label>
              </div>

              {/* Opção de Troco para Dinheiro */}
              {metodoPagamento === 'dinheiro' && (
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300 uppercase">
                      Precisa de troco?
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrecisaTroco(!precisaTroco)}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer ${
                        precisaTroco
                          ? 'bg-amber-500 text-black'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {precisaTroco ? 'SIM' : 'NÃO'}
                    </button>
                  </div>

                  {precisaTroco && (
                    <div className="pt-2 border-t border-neutral-800/80">
                      <label className="text-[11px] font-bold text-neutral-400 block mb-1 uppercase">
                        Troco para quanto em dinheiro? (R$):
                      </label>
                      <input
                        type="text"
                        required={precisaTroco}
                        value={trocoPara}
                        onChange={(e) => setTrocoPara(e.target.value)}
                        placeholder={`Mínimo: ${formatBRL(cartTotalComEntrega)}`}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RESUMO DOS VALORES */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal dos Itens ({cartTotalItens}):</span>
                <span className="font-mono text-white font-bold">{formatBRL(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Taxa de Entrega:</span>
                <span className="font-mono text-white font-bold">
                  {taxaEntrega === 0 ? 'GRÁTIS' : formatBRL(taxaEntrega)}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-amber-400 pt-2 border-t border-neutral-800">
                <span>Total a Pagar:</span>
                <span className="font-mono">{formatBRL(cartTotalComEntrega)}</span>
              </div>
            </div>

            {/* BOTÃO FINALIZAR FIXADO */}
            <aside className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 border-t border-neutral-800 backdrop-blur-md p-4">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Total do Pedido</span>
                  <span className="text-xl font-black text-amber-400 font-mono">
                    {formatBRL(cartTotalComEntrega)}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black uppercase text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando Pedido...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Finalizar e Enviar Pedido</span>
                    </>
                  )}
                </button>
              </div>
            </aside>
          </form>
        </main>
      </div>
    );
  }

  // =========================================================================
  // TELA PRINCIPAL (CARDÁPIO / VITRINE DO CLIENTE)
  // =========================================================================
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-black pb-28">
      {/* Top Header Mobile-First com Logo Centralizada */}
      <header className="bg-neutral-900/95 border-b border-neutral-800 sticky top-0 z-30 backdrop-blur-md">
        {/* Banner de Aviso de Horário de Entregas */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-inner">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Aviso: As entregas sairão a partir das 10:30hs</span>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 pb-3 flex flex-col items-center text-center relative">
          <div className="absolute right-4 top-4">
            <Link
              to="/admin"
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Acesso Administrativo"
            >
              <Lock className="w-4 h-4" />
            </Link>
          </div>

          {/* Logo Centralizada com cantos arredondados, borda temática e sombra */}
          <div className="relative mb-2.5">
            <img
              src="/logo.jpg"
              alt={configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-2xl border-2 border-amber-500/70 shadow-xl shadow-amber-500/10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>

          <div className="flex items-center gap-2 justify-center">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
              {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'}
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Aberto
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
            {configuracoes?.horarioFuncionamento || 'Almoço das 11h às 14h'}
          </p>
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
              const hasOpcionais = prod.opcionais && prod.opcionais.length > 0;

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
                      {hasOpcionais && (
                        <span className="text-[10px] text-amber-300 font-bold block mt-1">
                          + Opcionais disponíveis
                        </span>
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
                      onClick={() => handleIniciarAdicionar(prod)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{hasOpcionais ? 'Personalizar' : 'Adicionar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Opcionais e Observação ao Adicionar */}
      {selectedProdutoOpcionais && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  Personalizar Item
                </span>
                <h3 className="text-sm font-black text-white uppercase">
                  {selectedProdutoOpcionais.nome}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProdutoOpcionais(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Opcionais */}
            {selectedProdutoOpcionais.opcionais &&
              selectedProdutoOpcionais.opcionais.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-300 uppercase block">
                    Deseja adicionar adicionais?
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedProdutoOpcionais.opcionais.map((opc) => {
                      const isSelected = tempOpcionais.some((o) => o.id === opc.id);
                      return (
                        <label
                          key={opc.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-neutral-850 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setTempOpcionais((prev) => prev.filter((o) => o.id !== opc.id));
                                } else {
                                  setTempOpcionais((prev) => [...prev, opc]);
                                }
                              }}
                              className="w-4 h-4 rounded text-amber-500 bg-neutral-800 border-neutral-700 focus:ring-0"
                            />
                            <span className="text-xs font-bold uppercase">{opc.nome}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            +{formatBRL(opc.preco_adicional)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Observações */}
            <div>
              <label className="text-xs font-bold text-neutral-300 uppercase block mb-1">
                Alguma observação para a cozinha?
              </label>
              <textarea
                rows={2}
                value={tempObservacao}
                onChange={(e) => setTempObservacao(e.target.value)}
                placeholder="Ex: sem cebola, feijão separado, carne bem passada..."
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quantidade e Botão Confirmar */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-neutral-800 rounded-xl p-1 border border-neutral-700">
                <button
                  type="button"
                  onClick={() => setTempQuantidade((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 text-white"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-black text-white w-6 text-center">
                  {tempQuantidade}
                </span>
                <button
                  type="button"
                  onClick={() => setTempQuantidade((q) => q + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  adicionarAoCarrinho(
                    selectedProdutoOpcionais,
                    tempOpcionais,
                    tempObservacao,
                    tempQuantidade
                  )
                }
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <span>Adicionar</span>
                <span>•</span>
                <span className="font-mono">
                  {formatBRL(
                    ((Number(selectedProdutoOpcionais.preco_delivery) ||
                      Number(selectedProdutoOpcionais.preco_salao) ||
                      0) +
                      tempOpcionais.reduce((a, b) => a + (Number(b.preco_adicional) || 0), 0)) *
                      tempQuantidade
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé com Diagnóstico em Tempo Real para Testes e Produção */}
      <footer className="p-4 mb-24 border-t border-neutral-900 bg-neutral-950 text-[11px] text-neutral-400 flex flex-col items-center gap-2.5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${
              isCaixaAberto
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-red-950/80 text-red-300 border-red-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isCaixaAberto ? 'bg-emerald-400' : 'bg-red-400'}`} />
            Caixa: {isCaixaAberto ? 'ABERTO' : 'FECHADO'}
          </span>

          <span
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${
              isCardapioAtivo
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-amber-950/80 text-amber-300 border-amber-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isCardapioAtivo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            Cardápio: {isCardapioAtivo ? 'CONFIRMADO' : 'AGUARDANDO'}
          </span>

          <span
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${
              isDeliverySiteAtivo
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-amber-950/80 text-amber-300 border-amber-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDeliverySiteAtivo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            Entregas Site: {isDeliverySiteAtivo ? 'ATIVO' : 'PAUSADO'}
          </span>
        </div>

        <div className="text-[10px] text-neutral-600">
          © {new Date().getFullYear()} {configuracoes?.nomeRestaurante || 'Restaurante Kaipira'} · Cardápio Digital
        </div>
      </footer>

      {/* Barra Inferior Sticky com Botão da Sacola */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 border-t border-neutral-800 backdrop-blur-md p-3.5 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-neutral-800 rounded-xl text-amber-400 border border-neutral-700">
              <ShoppingBag className="w-5 h-5" />
              {cartTotalItens > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black min-w-[18px] text-center shadow-md animate-bounce">
                  {cartTotalItens}
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-black text-white block uppercase">
                {cartTotalItens === 0
                  ? 'Sacola Vazia'
                  : `${cartTotalItens} ${cartTotalItens === 1 ? 'item' : 'itens'}`}
              </span>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {formatBRL(cartSubtotal)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={cartTotalItens === 0}
            onClick={() => setCheckoutStep('cart')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              cartTotalItens > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
            }`}
          >
            <span>Ver Sacola</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </aside>
    </div>
  );
}

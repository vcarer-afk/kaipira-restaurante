import React, { useState, useEffect, useCallback } from 'react';
import {
  Produto,
  Categoria,
  Mesa,
  Cliente,
  ItemEstoque,
  Perfil,
  UsuarioSistema,
  CaixaDiario,
  Pedido,
  Reserva,
  BairroTaxa,
  TipoUsuario,
  StatusPedido,
  ConfiguracoesSistema,
  CardapioDiarioConfig,
  FormaPagamento,
  FormaPagamentoConfig,
  MovimentacaoCaixa,
  Pagamento,
} from './types';
import { Header, ActiveTab } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { CadastrosHub } from './components/CadastrosHub';
import { DailyMenuBuilder } from './components/DailyMenuBuilder';
import { SettingsManager } from './components/SettingsManager';
import { SlideMenuRight } from './components/SlideMenuRight';
import { POSNewOrder } from './components/POSNewOrder';
import { KitchenKDS } from './components/KitchenKDS';
import { LedPanel } from './components/LedPanel';
import { DeliveryDispatch } from './components/DeliveryDispatch';
import { TablesSaloon } from './components/TablesSaloon';
import { MensalistasManager } from './components/MensalistasManager';
import { StockManager } from './components/StockManager';
import { CashRegister } from './components/CashRegister';
import { ThermalReceipt } from './components/ThermalReceipt';
import { SupabaseInfoModal } from './components/SupabaseInfoModal';
import { playAlertChime } from './utils/formatters';
import { THEMES } from './utils/theme';

// Seed data fallbacks if server offline
import {
  INITIAL_CATEGORIAS,
  INITIAL_PRODUTOS,
  INITIAL_MESAS,
  INITIAL_CLIENTES,
  INITIAL_PERFIS,
  INITIAL_USUARIOS,
  INITIAL_CAIXA,
  INITIAL_PEDIDOS,
  BAIRROS_PIRACICABA,
  INITIAL_CONFIGURACOES,
  INITIAL_FORMAS_PAGAMENTO,
} from './data/seedData';
import { supabase } from './lib/supabase';
import {
  fetchConfiguracoesFromSupabase,
  saveConfiguracoesToSupabase,
  atualizarStatusPedidoSupabase,
  atualizarMesaSupabase,
  fecharMesaSupabase,
  atualizarItemEstoqueSupabase,
  adicionarItemEstoqueSupabase,
  excluirItemEstoqueSupabase,
  abrirCaixaSupabase,
  fecharCaixaSupabase,
  registrarMovimentacaoCaixaSupabase,
  criarReservaSupabase,
  abaterSaldoMensalistaSupabase,
  fetchUsuariosSupabase,
  garantirMasterSupabase,
  salvarCardapioDiarioSupabase,
  fetchCardapioDiarioSupabase,
  salvarClienteSupabase,
  excluirClienteSupabase,
  salvarProdutoSupabase,
  excluirProdutoSupabase,
  salvarMesaSupabase,
  excluirMesaSupabase,
  fetchCategoriasSupabase,
  salvarCategoriaSupabase,
  excluirCategoriaSupabase,
  fetchProdutosSupabase,
  fetchBairrosSupabase,
  salvarBairrosSupabase,
  resetarMesasVaziasSupabase,
  fetchFormasPagamentoSupabase,
  salvarFormaPagamentoSupabase,
  excluirFormaPagamentoSupabase,
  fetchPedidosSupabase,
  registrarMultiplasMovimentacoesCaixaSupabase,
  registrarPagamentosMesaSupabase,
  conferirEntregaPedidoSupabase,
} from './services/supabaseClient';

// Helper para enriquecer e garantir a descrição/nome completo do produto em todo o sistema
export function enrichPedidosWithProductNames(peds: Pedido[], prods: Produto[]): Pedido[] {
  const prodMap = new Map<number, string>();
  prods.forEach((p) => prodMap.set(p.id, p.nome));
  INITIAL_PRODUTOS.forEach((p) => {
    if (!prodMap.has(p.id)) prodMap.set(p.id, p.nome);
  });

  return peds.map((ped) => ({
    ...ped,
    itens: (ped.itens || []).map((it) => {
      const isCodeOnly =
        !it.produto_nome ||
        it.produto_nome.trim().startsWith('#') ||
        it.produto_nome.toLowerCase().startsWith('prod #') ||
        it.produto_nome.toLowerCase().startsWith('produto #');
      const foundName = it.produto_id ? prodMap.get(it.produto_id) : undefined;
      return {
        ...it,
        produto_nome: isCodeOnly && foundName ? foundName : (it.produto_nome || foundName || `Produto #${it.produto_id || '?'}`),
      };
    }),
  }));
}

export default function App() {
  // Authentication State (In-Memory / Cloud Session - ZERO localStorage)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentPerfil, setCurrentPerfil] = useState<Perfil | undefined>(undefined);
  const [currentRole, setCurrentRole] = useState<TipoUsuario>('admin');

  // Navigation & Menu Settings
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState<boolean>(false);
  const [selectedMesaNumber, setSelectedMesaNumber] = useState<number | undefined>(undefined);

  // Cloud Application State (100% Nuvem Supabase)
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesSistema>(INITIAL_CONFIGURACOES);
  const [isCloudConfigLoading, setIsCloudConfigLoading] = useState<boolean>(true);
  const [cloudConfigSyncedAt, setCloudConfigSyncedAt] = useState<Date | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>(INITIAL_CATEGORIAS);
  const [produtos, setProdutos] = useState<Produto[]>(INITIAL_PRODUTOS);
  const [mesas, setMesas] = useState<Mesa[]>(INITIAL_MESAS);
  const [clientes, setClientes] = useState<Cliente[]>(INITIAL_CLIENTES);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(INITIAL_USUARIOS);
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]); // 100% da nuvem Supabase - zero mock/local
  const [caixa, setCaixa] = useState<CaixaDiario>(INITIAL_CAIXA);
  const [pedidos, setPedidos] = useState<Pedido[]>([]); // 100% da nuvem - sem pedidos mock locais em mesas
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bairros, setBairros] = useState<BairroTaxa[]>(BAIRROS_PIRACICABA);
  const [cardapioDiario, setCardapioDiario] = useState<CardapioDiarioConfig>({
    data: new Date().toISOString().split('T')[0],
    status: 'aguardando',
    itens: [],
  });
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoConfig[]>(INITIAL_FORMAS_PAGAMENTO);

  // Modals
  const [printReceiptPedido, setPrintReceiptPedido] = useState<Pedido | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Lunch Hours evaluation (11:00 to 14:00, Monday to Saturday)
  const [isLunchTime, setIsLunchTime] = useState(true);

  useEffect(() => {
    const checkLunch = () => {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const inHours = day >= 1 && day <= 6 && hour >= 11 && hour < 14;
      setIsLunchTime(inHours || true);
    };
    checkLunch();
    const interval = setInterval(checkLunch, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update browser document title based on cloud configuracoes
  useEffect(() => {
    if (configuracoes?.nomeRestaurante) {
      document.title = `${configuracoes.nomeRestaurante} - Gestão & Delivery (${configuracoes.cidade || 'Piracicaba'} - ${configuracoes.uf || 'SP'})`;
    }
  }, [configuracoes?.nomeRestaurante, configuracoes?.cidade, configuracoes?.uf]);

  // Dedicated fetch to load cloud configuracoes directly from Supabase
  const fetchCloudConfiguracoes = useCallback(async () => {
    setIsCloudConfigLoading(true);
    try {
      const data = await fetchConfiguracoesFromSupabase();
      if (data && typeof data === 'object' && data.nomeRestaurante) {
        setConfiguracoes((prev) => ({ ...prev, ...data }));
        setCloudConfigSyncedAt(new Date());
      }
    } catch (err) {
      console.warn('Conectando às configurações no Supabase...', err);
    } finally {
      setIsCloudConfigLoading(false);
    }
  }, []);

  // Fetch full cloud state from Supabase on load
  const fetchCloudState = useCallback(async () => {
    try {
      await fetchCloudConfiguracoes();

      // Query Supabase tables directly (100% cloud, no static /api 405 error)
      const [pedidosData, mesasRes, estoqueRes, caixaRes, reservasRes, clientesRes] = await Promise.allSettled([
        fetchPedidosSupabase(),
        supabase.from('mesas').select('*'),
        supabase.from('estoque').select('*').order('id', { ascending: true }),
        supabase.from('caixa_diario').select('*').order('id', { ascending: false }).limit(1),
        supabase.from('reservas').select('*').order('id', { ascending: false }),
        supabase.from('clientes').select('*').order('nome', { ascending: true }),
      ]);

      const rawCloudPeds = pedidosData.status === 'fulfilled' && pedidosData.value ? pedidosData.value : [];
      const cloudPeds = enrichPedidosWithProductNames(rawCloudPeds, produtos);
      setPedidos(cloudPeds);

      if (mesasRes.status === 'fulfilled' && mesasRes.value.data && mesasRes.value.data.length > 0) {
        const rawMesas = mesasRes.value.data as any[];
        const cloudPedidos = cloudPeds;
        const cloudReservas = (reservasRes.status === 'fulfilled' && reservasRes.value.data) ? (reservasRes.value.data as Reserva[]) : [];
        const hojeStr = new Date().toISOString().split('T')[0];

        const mappedMesas: Mesa[] = rawMesas.map((m) => {
          const num = Number(m.numero || m.id);
          const activeOrder = cloudPedidos.find(
            (p) =>
              p.mesa_id === num &&
              p.status !== 'cancelado' &&
              (!p.pagamentos || p.pagamentos.length === 0)
          );
          const activeReserva = cloudReservas.find(
            (r) =>
              Number(r.mesa_id) === num &&
              r.status !== 'cancelada' &&
              r.status !== 'concluida' &&
              (!r.data_hora || r.data_hora.startsWith(hojeStr))
          );

          let status: Mesa['status'] = 'livre';
          let cliente_nome: string | undefined = undefined;
          let pessoas: number | undefined = undefined;

          // Se tiver pedido em andamento no salão hoje na nuvem ou mesa estiver ocupada/conta
          if (activeOrder || m.status === 'ocupada' || m.status === 'conta') {
            status = m.status === 'conta' ? 'conta' : 'ocupada';
            cliente_nome = m.cliente_nome || activeOrder?.cliente?.nome || 'MESA OCUPADA';
            pessoas = m.pessoas ? Number(m.pessoas) : 2;
          } else if (activeReserva || m.status === 'reservada') {
            // Se tiver reserva confirmada ou pendente
            status = 'reservada';
            cliente_nome = activeReserva ? `RESERVA: ${activeReserva.cliente_nome.toUpperCase()}` : m.cliente_nome;
            pessoas = activeReserva?.pessoas || m.pessoas || 4;
          } else {
            // Padrão do Restaurante Kaipira: por padrão ao abrir o restaurante as mesas estarão sempre vazias
            status = 'livre';
            cliente_nome = undefined;
            pessoas = undefined;
          }

          return {
            id: Number(m.id || num),
            numero: num,
            status,
            cliente_nome,
            pessoas,
          };
        });

        mappedMesas.sort((a, b) => a.numero - b.numero);
        setMesas(mappedMesas);
      }
      if (estoqueRes.status === 'fulfilled') {
        if (estoqueRes.value.error) {
          console.warn('Aviso ao consultar estoque no Supabase:', estoqueRes.value.error.message);
        } else if (estoqueRes.value.data) {
          const mappedEstoque: ItemEstoque[] = (estoqueRes.value.data as any[]).map((d: any) => ({
            id: Number(d.id),
            item_nome: (d.item_nome || '').toUpperCase().trim(),
            quantidade_atual: Number(d.quantidade_atual) || 0,
            unidade_medida: (d.unidade_medida || 'un').toLowerCase().trim(),
            estoque_minimo: Number(d.estoque_minimo) || 0,
            fornecedor_info: d.fornecedor_info ? d.fornecedor_info.toUpperCase().trim() : '',
            atualizado_em: d.atualizado_em,
          }));
          setEstoque(mappedEstoque);
        }
      }
      if (caixaRes.status === 'fulfilled' && caixaRes.value.data && caixaRes.value.data.length > 0) {
        const row = caixaRes.value.data[0];
        if (row.dados) {
          setCaixa(row.dados);
        } else {
          const valAbertura = row.valor_abertura !== undefined && row.valor_abertura !== null
            ? Number(row.valor_abertura)
            : (row.valor_apertura !== undefined && row.valor_apertura !== null ? Number(row.valor_apertura) : 250);

          let savedMovs: MovimentacaoCaixa[] = [];
          try {
            const rawLocal = localStorage.getItem('kaipira_caixa_movs');
            if (rawLocal) {
              const parsed = JSON.parse(rawLocal);
              if (Array.isArray(parsed) && parsed.length > 0) savedMovs = parsed;
            }
          } catch {}

          setCaixa((prev) => ({
            ...prev,
            id: row.id || prev.id,
            data_caixa: row.data_caixa || prev.data_caixa,
            status: row.status || prev.status,
            valor_abertura: valAbertura,
            valor_fechamento: row.valor_fechamento !== null && row.valor_fechamento !== undefined ? Number(row.valor_fechamento) : undefined,
            observacoes: row.observacoes || prev.observacoes,
            movimentacoes: savedMovs.length > 0 ? savedMovs : (prev.movimentacoes || []),
          }));
        }
      }
      if (reservasRes.status === 'fulfilled' && reservasRes.value.data && reservasRes.value.data.length > 0) {
        setReservas(reservasRes.value.data as Reserva[]);
      }
      if (clientesRes.status === 'fulfilled' && clientesRes.value.data && clientesRes.value.data.length > 0) {
        setClientes(clientesRes.value.data as Cliente[]);
      }

      // Carrega categorias da nuvem Supabase (100% cloud)
      try {
        const cloudCats = await fetchCategoriasSupabase();
        if (cloudCats && cloudCats.length > 0) {
          setCategorias(cloudCats);
        }
      } catch (err) {
        console.warn('Conectando a categorias do Supabase...', err);
      }

      // Carrega produtos da nuvem Supabase (100% cloud)
      try {
        const cloudProds = await fetchProdutosSupabase();
        if (cloudProds && cloudProds.length > 0) {
          setProdutos(cloudProds);
          setPedidos((prev) => enrichPedidosWithProductNames(prev, cloudProds));
        }
      } catch (err) {
        console.warn('Conectando a produtos do Supabase...', err);
      }

      // Carrega bairros da nuvem Supabase (100% cloud)
      try {
        const cloudBairros = await fetchBairrosSupabase();
        if (cloudBairros && cloudBairros.length > 0) {
          setBairros(cloudBairros);
        }
      } catch (err) {
        console.warn('Conectando a bairros do Supabase...', err);
      }

      // Carrega usuários da nuvem Supabase
      try {
        const users = await fetchUsuariosSupabase();
        if (users && users.length > 0) {
          setUsuarios(users);
        }
      } catch (err) {
        console.warn('Conectando a usuarios do Supabase...', err);
      }

      // Carrega cardápio diário da nuvem Supabase
      try {
        const cd = await fetchCardapioDiarioSupabase();
        if (cd) {
          setCardapioDiario(cd);
        }
      } catch (err) {
        console.warn('Conectando ao cardápio diário no Supabase...', err);
      }

      // Carrega formas de pagamento da nuvem Supabase (100% cloud)
      try {
        const fps = await fetchFormasPagamentoSupabase();
        if (fps && fps.length > 0) {
          setFormasPagamento(fps);
        }
      } catch (err) {
        console.warn('Conectando a formas de pagamento no Supabase...', err);
      }
    } catch (err) {
      console.warn('Conectando às tabelas em nuvem do Supabase...', err);
    } finally {
      setIsCloudConfigLoading(false);
    }
  }, [fetchCloudConfiguracoes]);

  useEffect(() => {
    // Priority: always load cloud settings immediately on device start
    fetchCloudConfiguracoes();
    fetchCloudState();

    let channel: any = null;
    try {
      // Connect to Supabase Realtime channel (works in static hosting like GitHub Pages)
      channel = supabase
        .channel('restaurante_kaipira_cloud_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'configuracoes' },
          (payload: any) => {
            if (payload.new) {
              const loaded = payload.new.dados || payload.new;
              setConfiguracoes((prev) => ({ ...prev, ...loaded }));
              setCloudConfigSyncedAt(new Date());
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
          { event: '*', schema: 'public', table: 'usuarios' },
          async () => {
            const updated = await fetchUsuariosSupabase();
            if (updated && updated.length > 0) {
              setUsuarios(updated);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pedidos' },
          (payload: any) => {
            if (payload.new) {
              const novoPedido: Pedido = payload.new;
              setPedidos((prev) => [novoPedido, ...prev.filter((p) => p.id !== novoPedido.id)]);
              playAlertChime('order');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pedidos' },
          (payload: any) => {
            if (payload.new) {
              const updated: Pedido = payload.new;
              setPedidos((prev) =>
                prev.map((p) => {
                  if (p.id !== updated.id) return p;
                  return {
                    ...p,
                    ...updated,
                    itens: updated.itens && updated.itens.length > 0 ? updated.itens : p.itens,
                    pagamentos: updated.pagamentos && updated.pagamentos.length > 0 ? updated.pagamentos : p.pagamentos,
                  };
                })
              );
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mesas' },
          (payload: any) => {
            if (payload.new) {
              const updatedMesa: Mesa = payload.new;
              setMesas((prev) => prev.map((m) => (m.numero === updatedMesa.numero ? { ...m, ...updatedMesa } : m)));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'estoque' },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old) {
              const targetId = Number(payload.old.id);
              setEstoque((prev) => prev.filter((it) => it.id !== targetId));
            } else if (payload.new) {
              const item: ItemEstoque = {
                id: Number(payload.new.id),
                item_nome: (payload.new.item_nome || '').toUpperCase().trim(),
                quantidade_atual: Number(payload.new.quantidade_atual) || 0,
                unidade_medida: (payload.new.unidade_medida || 'un').toLowerCase().trim(),
                estoque_minimo: Number(payload.new.estoque_minimo) || 0,
                fornecedor_info: payload.new.fornecedor_info ? payload.new.fornecedor_info.toUpperCase().trim() : '',
                atualizado_em: payload.new.atualizado_em,
              };
              setEstoque((prev) => {
                const exists = prev.some((it) => it.id === item.id);
                if (exists) {
                  return prev.map((it) => (it.id === item.id ? item : it));
                }
                return [...prev, item];
              });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase Realtime não disponível:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchCloudConfiguracoes, fetchCloudState]);

  // Handle Login Success
  const handleLoginSuccess = (perfil: Perfil) => {
    setIsAuthenticated(true);
    setCurrentPerfil(perfil);
    setCurrentRole(perfil.cargo);

    if (perfil.cargo === 'master' || perfil.cargo === 'admin') {
      setActiveTab('dashboard');
    } else if (perfil.cargo === 'cozinha') {
      setActiveTab('kds');
    } else if (perfil.cargo === 'garcom') {
      setActiveTab('mesas');
    } else if (perfil.cargo === 'entregador') {
      setActiveTab('expedicao');
    } else {
      setActiveTab('pdv');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPerfil(undefined);
    setIsSlideMenuOpen(false);
    setActiveTab('dashboard');
  };

  const handleRoleChange = (role: TipoUsuario) => {
    setCurrentRole(role);
    if (currentPerfil) {
      setCurrentPerfil({ ...currentPerfil, cargo: role });
    }
    if (role === 'master' || role === 'admin') setActiveTab('dashboard');
    else if (role === 'cozinha') setActiveTab('kds');
    else if (role === 'garcom') setActiveTab('mesas');
    else if (role === 'entregador') setActiveTab('expedicao');
    else if (role === 'atendente') setActiveTab('pdv');
  };

  // Save Settings to cloud directly via Supabase with immediate visual response
  const handleSaveConfiguracoes = async (novas: ConfiguracoesSistema) => {
    setConfiguracoes(novas);
    try {
      const saved = await saveConfiguracoesToSupabase(novas);
      setConfiguracoes(saved);
      setCloudConfigSyncedAt(new Date());
    } catch (err) {
      console.error('Erro ao persistir configurações na nuvem:', err);
    }
  };

  // Order status updates via Supabase
  const handleUpdateOrderStatus = async (id: number, status: StatusPedido, entregador?: string) => {
    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, status };
          if (entregador) updated.entregador_nome = entregador;
          // Quando motoboy confirmar entrega, fica pendente de conferência pelo caixa
          if (p.tipo === 'delivery' && status === 'entregue') {
            updated.conferencia_entrega = 'pendente';
          }
          return updated;
        }
        return p;
      })
    );
    await atualizarStatusPedidoSupabase(id, status, entregador);
  };

  // Conferência de entrega pelo Gerente ou Supervisor no Caixa
  const handleConferirEntrega = async (pedidoId: number, conferidoPor: string) => {
    const pedidoAlvo = pedidos.find((p) => p.id === pedidoId);
    if (!pedidoAlvo) return;

    const agora = new Date().toISOString();

    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? {
              ...p,
              conferencia_entrega: 'conferido',
              conferido_por: conferidoPor,
              conferido_em: agora,
            }
          : p
      )
    );

    // Persistir conferência no banco Supabase
    await conferirEntregaPedidoSupabase(pedidoId, conferidoPor);

    // REGRA: Somente entrará no faturamento diário se estiver conferido pelo gerente ou supervisor
    // Lança agora as entradas de pagamento do delivery no caixa diário
    if (caixa && caixa.status === 'aberto') {
      const pgs =
        pedidoAlvo.pagamentos && pedidoAlvo.pagamentos.length > 0
          ? pedidoAlvo.pagamentos.filter((pg) => pg.valor > 0)
          : [{ forma: 'dinheiro', valor: pedidoAlvo.valor_total }];

      await handleRegistrarMultiplasMovimentacoesCaixa(
        pgs.map((pg) => ({
          tipo: 'entrada_pedido' as const,
          forma: pg.forma,
          valor: pg.valor,
          descricao: `PEDIDO #${pedidoAlvo.id} (DELIVERY CONFERIDO - ${conferidoPor.toUpperCase()})`,
        }))
      );
    }

    playAlertChime();
  };

  // Table status updates via Supabase
  const handleUpdateMesaStatus = async (
    numero: number,
    status: Mesa['status'],
    cliente_nome?: string,
    pessoas?: number
  ) => {
    setMesas((prev) =>
      prev.map((m) => (m.numero === numero ? { ...m, status, cliente_nome, pessoas } : m))
    );
    await atualizarMesaSupabase(numero, status, cliente_nome, pessoas);
  };

  const handleFecharMesa = async (
    numero: number,
    pagamentos?: { forma: FormaPagamento; valor: number }[],
    clienteMensalistaId?: string,
    pedidosIds?: number[],
    troco?: number
  ) => {
    // 1. Zera e libera a mesa localmente e na nuvem Supabase
    setMesas((prev) =>
      prev.map((m) =>
        m.numero === numero
          ? { ...m, status: 'livre', cliente_nome: undefined, pessoas: undefined }
          : m
      )
    );
    await fecharMesaSupabase(numero);

    // 2. Conclui os pedidos vinculados à mesa
    if (pedidosIds && pedidosIds.length > 0) {
      setPedidos((prev) =>
        prev.map((p) => {
          if (!pedidosIds.includes(p.id)) return p;
          const formattedPagamentos: Pagamento[] = pagamentos
            ? pagamentos.map((pg, idx) => ({
                id: Date.now() + idx,
                pedido_id: p.id,
                forma: pg.forma,
                valor: pg.valor,
                criado_em: new Date().toISOString(),
              }))
            : p.pagamentos;
          return { ...p, status: 'entregue' as StatusPedido, pagamentos: formattedPagamentos };
        })
      );
      for (const pId of pedidosIds) {
        await atualizarStatusPedidoSupabase(pId, 'entregue');
      }
    }

    // 3. Se houver débito em conta de mensalista, atualiza saldo devedor
    if (clienteMensalistaId && pagamentos) {
      const valorMensalista = pagamentos
        .filter((pg) => pg.forma === 'mensalista')
        .reduce((acc, pg) => acc + pg.valor, 0);

      if (valorMensalista > 0) {
        setClientes((prev) =>
          prev.map((c) =>
            c.id === clienteMensalistaId
              ? { ...c, saldo_devedor: (c.saldo_devedor || 0) + valorMensalista }
              : c
          )
        );
        const cli = clientes.find((c) => c.id === clienteMensalistaId);
        if (cli) {
          await salvarClienteSupabase({
            id: cli.id,
            saldo_devedor: (cli.saldo_devedor || 0) + valorMensalista,
          });
        }
      }
    }

    // 4. Registra movimentações no faturamento do caixa (Dinheiro, PIX, Débito, Crédito, etc.)
    if (pagamentos && pagamentos.length > 0) {
      const validPgs = pagamentos.filter((pg) => pg.valor > 0);
      if (validPgs.length > 0) {
        await handleRegistrarMultiplasMovimentacoesCaixa(
          validPgs.map((pg) => ({
            tipo: 'entrada_pedido' as const,
            forma: pg.forma,
            valor: pg.valor,
            descricao: `FECHAMENTO MESA #${numero} (${String(pg.forma).toUpperCase().replace('_', ' ')})`,
          }))
        );
      }
    }

    // Persiste pagamentos da mesa no banco de dados Supabase
    if (pedidosIds && pedidosIds.length > 0 && pagamentos && pagamentos.length > 0) {
      await registrarPagamentosMesaSupabase(pedidosIds, pagamentos);
    }
  };

  // Toggle quick pause for product
  const handleTogglePauseProduto = async (id: number) => {
    setProdutos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, pausado: !p.pausado } : p))
    );
    try {
      const prod = produtos.find((p) => p.id === id);
      if (prod) {
        await supabase.from('produtos').update({ pausado: !prod.pausado }).eq('id', id);
      }
    } catch {}
  };

  // Stock & Insumos operations via Supabase (100% Nuvem - Sem registros locais)
  const handleUpdateStockItem = async (
    id: number,
    data: Partial<ItemEstoque>,
    fromStockManager = false
  ) => {
    setEstoque((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
    // Se a chamada veio do StockManager (que já executou o .update() no Supabase),
    // não precisamos executar uma segunda query de update no banco.
    if (!fromStockManager) {
      await atualizarItemEstoqueSupabase(id, data);
    }
  };

  const handleAddStockItem = async (data: Partial<ItemEstoque>) => {
    // Se o item já foi persistido no Supabase pelo StockManager (já possui ID gerado pela nuvem),
    // NÃO executamos um segundo insert no banco de dados. Apenas sincronizamos o estado se necessário.
    if (data.id) {
      setEstoque((prev) => {
        if (prev.some((it) => it.id === data.id)) return prev;
        return [...prev, data as ItemEstoque];
      });
      return;
    }

    const res = await adicionarItemEstoqueSupabase(data);
    if (res.success && res.data) {
      setEstoque((prev) => {
        if (prev.some((it) => it.id === res.data!.id)) return prev;
        return [...prev, res.data!];
      });
    }
  };

  const handleDeleteStockItem = async (id: number) => {
    setEstoque((prev) => prev.filter((it) => it.id !== id));
  };

  // Mensalistas operations via Supabase
  const handleAbaterSaldoMensalista = async (
    clienteId: string,
    valor: number,
    _forma: 'pix' | 'dinheiro' | 'cartao_debito'
  ) => {
    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? { ...c, saldo_devedor: Math.max(0, c.saldo_devedor - valor) }
          : c
      )
    );
    await abaterSaldoMensalistaSupabase(clienteId, valor);
    if (caixa && caixa.status === 'aberto' && valor > 0) {
      const cli = clientes.find((c) => c.id === clienteId);
      await handleMovimentacaoCaixa(
        'entrada_pedido',
        _forma,
        valor,
        `ABATIMENTO MENSALISTA: ${cli?.nome || 'CLIENTE'}`
      );
    }
  };

  const handleCadastrarCliente = async (clienteData: Partial<Cliente>) => {
    await handleSaveCliente(clienteData);
  };

  const handleSaveCliente = async (clienteData: Partial<Cliente>) => {
    const res = await salvarClienteSupabase(clienteData);
    const saved = res.data || {
      id: clienteData.id || 'c-' + Date.now(),
      nome: (clienteData.nome || '').toUpperCase().trim(),
      telefone: clienteData.telefone || '',
      cep: clienteData.cep || '13400-010',
      endereco: (clienteData.endereco || '').toUpperCase().trim(),
      numero: (clienteData.numero || '').toUpperCase().trim(),
      bairro: (clienteData.bairro || '').toUpperCase().trim(),
      complemento: (clienteData.complemento || '').toUpperCase().trim(),
      eh_mensalista: !!clienteData.eh_mensalista,
      saldo_devedor: Number(clienteData.saldo_devedor) || 0,
      criado_em: clienteData.criado_em || new Date().toISOString(),
    };

    setClientes((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      if (exists) {
        return prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c));
      }
      return [saved, ...prev];
    });
  };

  const handleDeleteCliente = async (id: string) => {
    await excluirClienteSupabase(id);
    setClientes((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveProduto = async (prodData: Partial<Produto>) => {
    const res = await salvarProdutoSupabase(prodData);
    const saved = res.data || {
      id: prodData.id || Date.now(),
      categoria_id: Number(prodData.categoria_id) || 1,
      nome: (prodData.nome || '').toUpperCase().trim(),
      descricao: (prodData.descricao || '').toUpperCase().trim(),
      preco_salao: Number(prodData.preco_salao) || 0,
      preco_delivery: Number(prodData.preco_delivery) || Number(prodData.preco_salao) || 0,
      dia_semana: prodData.dia_semana || [1, 2, 3, 4, 5, 6],
      pausado: !!prodData.pausado,
      criado_em: prodData.criado_em || new Date().toISOString(),
    };

    setProdutos((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p));
      }
      return [...prev, saved];
    });
  };

  const handleDeleteProduto = async (id: number) => {
    await excluirProdutoSupabase(id);
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveMesa = async (mesaData: Partial<Mesa>) => {
    const res = await salvarMesaSupabase(mesaData);
    const saved = res.data || {
      id: mesaData.id || Number(mesaData.numero),
      numero: Number(mesaData.numero),
      status: mesaData.status || 'livre',
      cliente_nome: (mesaData.cliente_nome || '').toUpperCase().trim() || undefined,
      pessoas: Number(mesaData.pessoas) || 2,
    };

    setMesas((prev) => {
      const exists = prev.some((m) => m.numero === saved.numero);
      if (exists) {
        return prev.map((m) => (m.numero === saved.numero ? { ...m, ...saved } : m));
      }
      return [...prev, saved].sort((a, b) => a.numero - b.numero);
    });
  };

  const handleDeleteMesa = async (numero: number) => {
    await excluirMesaSupabase(numero);
    setMesas((prev) => prev.filter((m) => m.numero !== numero));
  };

  // Categories CRUD (100% Nuvem Supabase)
  const handleSaveCategoria = async (catData: Partial<Categoria>) => {
    const res = await salvarCategoriaSupabase(catData);
    const saved = res.data || {
      id: catData.id || Date.now(),
      nome: (catData.nome || '').toUpperCase().trim(),
      ordem: catData.ordem || 0,
    };
    setCategorias((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      if (exists) {
        return prev.map((c) => (c.id === saved.id ? saved : c));
      }
      return [...prev, saved].sort((a, b) => a.ordem - b.ordem);
    });
  };

  const handleDeleteCategoria = async (id: number) => {
    await excluirCategoriaSupabase(id);
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  };

  // Bairros & Taxas CRUD (100% Nuvem Supabase)
  const handleSaveBairro = async (bairroData: Partial<BairroTaxa>, originalNome?: string) => {
    const nomeLimpo = (bairroData.bairro || '').toUpperCase().trim();
    const taxaNum = Number(bairroData.taxa) || 0;
    const novoBairro: BairroTaxa = { bairro: nomeLimpo, taxa: taxaNum };

    let novos: BairroTaxa[] = [];
    if (originalNome) {
      novos = bairros.map((b) => (b.bairro.toUpperCase() === originalNome.toUpperCase() ? novoBairro : b));
    } else {
      const exists = bairros.some((b) => b.bairro.toUpperCase() === nomeLimpo);
      if (exists) {
        novos = bairros.map((b) => (b.bairro.toUpperCase() === nomeLimpo ? novoBairro : b));
      } else {
        novos = [...bairros, novoBairro];
      }
    }
    setBairros(novos);
    await salvarBairrosSupabase(novos);
  };

  const handleDeleteBairro = async (bairroNome: string) => {
    const novos = bairros.filter((b) => b.bairro.toUpperCase() !== bairroNome.toUpperCase());
    setBairros(novos);
    await salvarBairrosSupabase(novos);
  };

  // Cash Register functional operations via Supabase
  const handleAbrirCaixa = async (valor: number, observacoes?: string) => {
    const novo = await abrirCaixaSupabase(valor, observacoes);
    setCaixa(novo);
    // Padrão do Restaurante Kaipira: ao abrir o restaurante as mesas estarão vazias (a não ser que estejam reservadas)
    try {
      const mesasReset = await resetarMesasVaziasSupabase(mesas, reservas);
      setMesas(mesasReset);
    } catch (err) {
      console.warn('Aviso ao resetar mesas na abertura do caixa:', err);
    }
  };

  const handleResetarMesasVazias = async () => {
    try {
      const mesasReset = await resetarMesasVaziasSupabase(mesas, reservas);
      setMesas(mesasReset);
    } catch (err) {
      console.warn('Aviso ao resetar mesas vazias:', err);
    }
  };

  const handleFecharCaixa = async (valor: number, observacoes?: string) => {
    const fechado = await fecharCaixaSupabase(caixa, valor, observacoes);
    setCaixa(fechado);
  };

  const handleRegistrarMultiplasMovimentacoesCaixa = async (
    movsParaRegistrar: Array<{
      tipo: 'entrada_pedido' | 'suprimento' | 'sangria';
      forma: FormaPagamento;
      valor: number;
      descricao: string;
    }>
  ) => {
    if (!movsParaRegistrar || movsParaRegistrar.length === 0) return;

    const baseTimestamp = Date.now();
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novasMovs: MovimentacaoCaixa[] = movsParaRegistrar.map((m, idx) => ({
      id: baseTimestamp + idx,
      tipo: m.tipo,
      forma: String(m.forma || 'outro').toLowerCase().trim(),
      valor: Number(m.valor) || 0,
      descricao: m.descricao.toUpperCase().trim(),
      hora,
    }));

    // Atualização atômica do estado React para garantir que todas as formas (dinheiro, pix, etc.) fiquem salvas
    setCaixa((prevCaixa) => {
      const mergedMovs = [...(prevCaixa.movimentacoes || []), ...novasMovs];
      try {
        localStorage.setItem('kaipira_caixa_movs', JSON.stringify(mergedMovs));
      } catch {}
      return {
        ...prevCaixa,
        movimentacoes: mergedMovs,
      };
    });

    // Sincroniza em nuvem no Supabase
    await registrarMultiplasMovimentacoesCaixaSupabase(caixa, movsParaRegistrar);
  };

  const handleMovimentacaoCaixa = async (
    tipo: 'entrada_pedido' | 'suprimento' | 'sangria',
    forma: any,
    valor: number,
    descricao: string
  ) => {
    await handleRegistrarMultiplasMovimentacoesCaixa([
      { tipo, forma, valor, descricao },
    ]);
  };

  // Formas de Pagamento operations via Supabase (100% Nuvem)
  const handleSaveFormaPagamento = async (item: Partial<FormaPagamentoConfig>) => {
    const atualizado = await salvarFormaPagamentoSupabase(item, formasPagamento);
    setFormasPagamento(atualizado);
  };

  const handleDeleteFormaPagamento = async (id: string) => {
    const atualizado = await excluirFormaPagamentoSupabase(id, formasPagamento);
    setFormasPagamento(atualizado);
  };

  // Reservations via Supabase
  const handleCreateReserva = async (resData: Partial<Reserva>) => {
    const nova = await criarReservaSupabase(resData);
    setReservas((prev) => [...prev, nova]);
  };

  // Cardápio Diário operations via Supabase
  const handleSaveCardapioDiario = async (novo: CardapioDiarioConfig) => {
    setCardapioDiario(novo);
    await salvarCardapioDiarioSupabase(novo);
  };

  const pendingKdsCount = pedidos.filter((p) => ['pendente', 'em_preparacao'].includes(p.status)).length;

  // IF NOT AUTHENTICATED -> SHOW LOGIN SCREEN FIRST
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} usuarios={usuarios} />;
  }

  const currentTheme = THEMES[configuracoes.padraoCor] || THEMES.ambar;

  return (
    <div className={`min-h-screen ${currentTheme.bgTone || 'bg-neutral-900'} ${currentTheme.fontStyle || 'font-sans'} text-neutral-100 flex flex-col transition-colors duration-200`}>
      {/* Top Bar Header with Configurable Menu Position and Theme */}
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'pdv') setSelectedMesaNumber(undefined);
        }}
        currentRole={currentRole}
        currentPerfil={currentPerfil}
        onChangeRole={handleRoleChange}
        isLunchTime={isLunchTime}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenSlideMenu={() => setIsSlideMenuOpen(true)}
        pendingKdsCount={pendingKdsCount}
        posicaoMenu={configuracoes.posicaoMenu}
        padraoCor={configuracoes.padraoCor}
        configuracoes={configuracoes}
        isCloudConfigLoading={isCloudConfigLoading}
        cloudConfigSyncedAt={cloudConfigSyncedAt}
        onRefreshCloudConfig={fetchCloudConfiguracoes}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Admin Dashboard */}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            pedidos={pedidos}
            mesas={mesas}
            caixa={caixa}
            estoque={estoque}
            clientes={clientes}
            configuracoes={configuracoes}
            onNavigate={(tab) => {
              setActiveTab(tab);
              if (tab !== 'pdv') setSelectedMesaNumber(undefined);
            }}
            onAbrirCaixa={handleAbrirCaixa}
            onFecharCaixa={handleFecharCaixa}
            onMovimentacao={handleMovimentacaoCaixa}
            onUpdateStockItem={handleUpdateStockItem}
          />
        )}

        {/* Central de Cadastros */}
        {activeTab === 'cadastros' && (
          <CadastrosHub
            usuarios={usuarios}
            onReloadUsuarios={async () => {
              const u = await fetchUsuariosSupabase();
              setUsuarios(u);
            }}
            currentPerfil={currentPerfil}
            clientes={clientes}
            produtos={produtos}
            categorias={categorias}
            mesas={mesas}
            bairros={bairros}
            estoque={estoque}
            formasPagamento={formasPagamento}
            onSaveFormaPagamento={handleSaveFormaPagamento}
            onDeleteFormaPagamento={handleDeleteFormaPagamento}
            onUpdateStockItem={handleUpdateStockItem}
            onAddItemStock={handleAddStockItem}
            onDeleteItemStock={handleDeleteStockItem}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              if (tab !== 'pdv') setSelectedMesaNumber(undefined);
            }}
            onSaveCliente={handleSaveCliente}
            onDeleteCliente={handleDeleteCliente}
            onSaveProduto={handleSaveProduto}
            onDeleteProduto={handleDeleteProduto}
            onSaveMesa={handleSaveMesa}
            onDeleteMesa={handleDeleteMesa}
            onSaveCategoria={handleSaveCategoria}
            onDeleteCategoria={handleDeleteCategoria}
            onSaveBairro={handleSaveBairro}
            onDeleteBairro={handleDeleteBairro}
            onCadastrarCliente={handleCadastrarCliente}
            onTogglePauseProduto={handleTogglePauseProduto}
          />
        )}

        {/* Montagem do Cardápio Diário do Restaurante */}
        {activeTab === 'cardapio-dia' && (
          <DailyMenuBuilder
            produtos={produtos}
            categorias={categorias}
            cardapioDiario={cardapioDiario}
            onSaveCardapio={handleSaveCardapioDiario}
            currentPerfil={currentPerfil}
            onClose={() => setActiveTab('dashboard')}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              if (tab !== 'pdv') setSelectedMesaNumber(undefined);
            }}
          />
        )}

        {/* Configurações do Sistema */}
        {activeTab === 'configuracoes' && (
          <SettingsManager
            configuracoes={configuracoes}
            onSaveConfiguracoes={handleSaveConfiguracoes}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            onReloadCloudConfig={fetchCloudConfiguracoes}
            isCloudConfigLoading={isCloudConfigLoading}
            cloudConfigSyncedAt={cloudConfigSyncedAt}
          />
        )}

        {/* PDV / Atendimento */}
        {activeTab === 'pdv' && (
          <POSNewOrder
            produtos={produtos}
            categorias={categorias}
            mesas={mesas}
            bairros={bairros}
            selectedMesaNumber={selectedMesaNumber}
            formasPagamento={formasPagamento}
            onOrderCreated={async (novo) => {
              const enrichedNovo = enrichPedidosWithProductNames([novo], produtos)[0] || novo;
              setPedidos((prev) => [enrichedNovo, ...prev.filter((p) => p.id !== novo.id)]);

              // Toda vez que lançado um pedido na mesa, marca a mesa como ocupada no estado e no Supabase
              if (novo.tipo === 'salão' && novo.mesa_id) {
                const mesaNum = Number(novo.mesa_id);
                const mesaAtual = mesas.find((m) => m.numero === mesaNum);
                const cliNome = novo.cliente?.nome || mesaAtual?.cliente_nome || 'MESA OCUPADA';
                await handleUpdateMesaStatus(mesaNum, 'ocupada', cliNome, mesaAtual?.pessoas || 2);
              }

              // Quando pedido tiver pagamentos imediatos (apenas balcão ou salão; delivery entra somente após conferência pelo gerente/supervisor)
              if (
                novo.tipo !== 'delivery' &&
                caixa &&
                caixa.status === 'aberto' &&
                novo.pagamentos &&
                novo.pagamentos.length > 0
              ) {
                const validPgs = novo.pagamentos.filter((pg) => pg.valor > 0);
                if (validPgs.length > 0) {
                  await handleRegistrarMultiplasMovimentacoesCaixa(
                    validPgs.map((pg) => ({
                      tipo: 'entrada_pedido' as const,
                      forma: pg.forma,
                      valor: pg.valor,
                      descricao: `PEDIDO #${novo.id} (${novo.tipo.toUpperCase()})`,
                    }))
                  );
                }
              }
            }}
            onPrintReceipt={(p) => setPrintReceiptPedido(p)}
            onTogglePauseProduto={handleTogglePauseProduto}
            cardapioDiario={cardapioDiario}
            onOpenCardapioBuilder={() => setActiveTab('cardapio-dia')}
          />
        )}

        {/* KDS Cozinha */}
        {activeTab === 'kds' && (
          <KitchenKDS
            pedidos={pedidos}
            produtos={produtos}
            onUpdateStatus={handleUpdateOrderStatus}
            onPrintReceipt={(p) => setPrintReceiptPedido(p)}
          />
        )}

        {/* LED Panel */}
        {activeTab === 'led' && <LedPanel pedidos={pedidos} />}

        {/* Mesas & Salão */}
        {activeTab === 'mesas' && (
          <TablesSaloon
            mesas={mesas}
            pedidos={pedidos}
            reservas={reservas}
            produtos={produtos}
            clientes={clientes}
            configuracoes={configuracoes}
            formasPagamento={formasPagamento}
            onOpenOrderForMesa={(num) => {
              setSelectedMesaNumber(num);
              setActiveTab('pdv');
            }}
            onUpdateMesaStatus={handleUpdateMesaStatus}
            onFecharMesa={handleFecharMesa}
            onCreateReserva={handleCreateReserva}
            onPrintReceipt={(p) => setPrintReceiptPedido(p)}
            onResetMesas={handleResetarMesasVazias}
          />
        )}

        {/* Expedição Delivery */}
        {activeTab === 'expedicao' && (
          <DeliveryDispatch
            pedidos={pedidos}
            onUpdateStatus={handleUpdateOrderStatus}
            onPrintReceipt={(p) => setPrintReceiptPedido(p)}
          />
        )}

        {/* Mensalistas */}
        {activeTab === 'mensalistas' && (
          <MensalistasManager
            clientes={clientes}
            onAbaterSaldo={handleAbaterSaldoMensalista}
            onCadastrarCliente={handleCadastrarCliente}
          />
        )}

        {/* Estoque */}
        {activeTab === 'estoque' && (
          <StockManager
            estoque={estoque}
            onUpdateItem={handleUpdateStockItem}
            onAddItem={handleAddStockItem}
            onDeleteItem={handleDeleteStockItem}
          />
        )}

        {/* Caixa Diário */}
        {activeTab === 'caixa' && (
          <CashRegister
            caixa={caixa}
            formasPagamento={formasPagamento}
            pedidos={pedidos}
            produtos={produtos}
            configuracoes={configuracoes}
            currentRole={currentRole}
            currentPerfil={currentPerfil}
            usuarios={usuarios}
            onAbrirCaixa={handleAbrirCaixa}
            onFecharCaixa={handleFecharCaixa}
            onMovimentacao={handleMovimentacaoCaixa}
            onConferirEntrega={handleConferirEntrega}
          />
        )}
      </main>

      {/* Slide Navigation Menu (Configurable Left or Right) */}
      <SlideMenuRight
        isOpen={isSlideMenuOpen}
        onClose={() => setIsSlideMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'pdv') setSelectedMesaNumber(undefined);
        }}
        currentRole={currentRole}
        currentPerfil={currentPerfil}
        onChangeRole={handleRoleChange}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onLogout={handleLogout}
        pendingKdsCount={pendingKdsCount}
        posicaoMenu={configuracoes.posicaoMenu}
        padraoCor={configuracoes.padraoCor}
      />

      {/* Thermal Receipt Print Modal */}
      <ThermalReceipt
        pedido={printReceiptPedido}
        produtos={produtos}
        onClose={() => setPrintReceiptPedido(null)}
        configuracoes={configuracoes}
      />

      {/* Supabase SQL DDL Modal */}
      <SupabaseInfoModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
}

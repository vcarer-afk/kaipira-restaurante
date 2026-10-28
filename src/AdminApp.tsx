import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { playAlertChime, isSalaoPedido } from './utils/formatters';
import { THEMES } from './utils/theme';

// Configurações e dados estáticos essenciais
import {
  INITIAL_USUARIOS,
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
  conferirEntregasConsolidadasSupabase,
  subscribeActiveConnections,
  zerarFinanceiroDiaSupabase,
  logoutSupabase,
} from './services/supabaseClient';

// Helper para enriquecer a descrição/nome completo do produto usando estritamente os produtos cadastrados na nuvem
export function enrichPedidosWithProductNames(peds: Pedido[], prods: Produto[]): Pedido[] {
  const prodMap = new Map<number, Produto>();
  prods.forEach((p) => prodMap.set(Number(p.id), p));

  return peds.map((ped) => ({
    ...ped,
    itens: (ped.itens || []).map((it) => {
      const pId = Number(it.produto_id);
      const prod = pId ? prodMap.get(pId) : undefined;
      const isCodeOnly =
        !it.produto_nome ||
        it.produto_nome.trim().startsWith('#') ||
        it.produto_nome.toLowerCase().startsWith('prod #') ||
        it.produto_nome.toLowerCase().startsWith('produto #');
      const foundName = prod?.nome;
      const unitPrice =
        Number(it.preco_unitario) ||
        (prod ? Number(prod.preco_delivery || prod.preco_salao || 0) : 0);

      return {
        ...it,
        produto_nome:
          isCodeOnly && foundName
            ? foundName
            : (it.produto_nome || foundName || `Produto #${it.produto_id || '1'}`),
        preco_unitario: unitPrice,
      };
    }),
  }));
}

export default function AdminApp() {
  // Authentication State (In-Memory / Cloud Session - ZERO localStorage)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentPerfil, setCurrentPerfil] = useState<Perfil | undefined>(undefined);
  const [currentRole, setCurrentRole] = useState<TipoUsuario>('admin');

  // Conexões ativas no sistema em tempo real
  const [activeConnectionsCount, setActiveConnectionsCount] = useState<number>(1);

  // Navigation & Menu Settings com persistência em localStorage e blindagem contra reset em foco/mudança de aba
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('kaipira_admin_active_tab') as ActiveTab;
    return saved || 'dashboard';
  });

  const setActiveTab = useCallback((newTab: ActiveTab) => {
    setActiveTabState(newTab);
    localStorage.setItem('kaipira_admin_active_tab', newTab);
  }, []);

  // Blindagem de rota: recuperar e manter a aba ativa ao alternar janelas ou recuperar foco
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        const saved = localStorage.getItem('kaipira_admin_active_tab') as ActiveTab;
        if (saved && saved !== activeTab) {
          setActiveTab(saved);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [activeTab]);

  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState<boolean>(false);
  const [selectedMesaNumber, setSelectedMesaNumber] = useState<number | undefined>(undefined);

  // Cloud Application State (100% Nuvem Supabase)
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesSistema>(INITIAL_CONFIGURACOES);
  const [isCloudConfigLoading, setIsCloudConfigLoading] = useState<boolean>(true);
  const [cloudConfigSyncedAt, setCloudConfigSyncedAt] = useState<Date | null>(null);

  // Status de sincronização em tempo real com a nuvem ('sincronizado' | 'reconectando')
  const [syncStatus, setSyncStatus] = useState<'sincronizado' | 'reconectando'>('sincronizado');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(INITIAL_USUARIOS);
  const [caixa, setCaixa] = useState<CaixaDiario>({
    id: 1,
    data_caixa: new Date().toLocaleDateString('en-CA'),
    valor_abertura: 0.0,
    status: 'aberto',
    observacoes: '',
    aberto_em: new Date().toISOString(),
    movimentacoes: [],
  });
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bairros, setBairros] = useState<BairroTaxa[]>([]);
  const [cardapioDiario, setCardapioDiario] = useState<CardapioDiarioConfig>({
    data: new Date().toLocaleDateString('en-CA'),
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

  // Conexões ativas de dispositivos em tempo real pela internet (Supabase Presence)
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = subscribeActiveConnections(
      currentPerfil?.nome || 'Operador Kaipira',
      (count) => {
        setActiveConnectionsCount(count);
      }
    );
    return () => unsub();
  }, [isAuthenticated, currentPerfil]);

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
        setConfiguracoes((prev) => ({
          ...prev,
          ...data,
          delivery_site_ativo:
            data.delivery_site_ativo !== undefined ? data.delivery_site_ativo : (prev.delivery_site_ativo ?? true),
          delivery_interno_ativo:
            data.delivery_interno_ativo !== undefined ? data.delivery_interno_ativo : (prev.delivery_interno_ativo ?? true),
        }));
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
      setSyncStatus('sincronizado');
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
        const hojeStr = new Date().toLocaleDateString('en-CA');

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
      } else if (mesasRes.status === 'fulfilled') {
        setMesas([]);
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
        if (row.dados && typeof row.dados === 'object' && row.dados.valor_abertura !== undefined) {
          setCaixa(row.dados);
        } else {
          const valAbertura = row.valor_abertura !== undefined && row.valor_abertura !== null
            ? Number(row.valor_abertura)
            : (row.valor_apertura !== undefined && row.valor_apertura !== null ? Number(row.valor_apertura) : 0);

          const cloudMovs: MovimentacaoCaixa[] = Array.isArray(row.movimentacoes) ? row.movimentacoes : [];
          setCaixa({
            id: row.id || 1,
            data_caixa: row.data_caixa || new Date().toLocaleDateString('en-CA'),
            status: (row.status as any) || 'aberto',
            valor_abertura: isNaN(valAbertura) ? 0 : valAbertura,
            valor_fechamento: row.valor_fechamento !== null && row.valor_fechamento !== undefined ? Number(row.valor_fechamento) : undefined,
            observacoes: row.observacoes || '',
            movimentacoes: cloudMovs,
            aberto_em: row.aberto_em || new Date().toISOString(),
          });
        }
      } else {
        setCaixa({
          id: 1,
          data_caixa: new Date().toLocaleDateString('en-CA'),
          valor_abertura: 0.0,
          status: 'aberto',
          observacoes: '',
          aberto_em: new Date().toISOString(),
          movimentacoes: [],
        });
      }
      if (reservasRes.status === 'fulfilled' && reservasRes.value.data) {
        setReservas(reservasRes.value.data as Reserva[]);
      }
      if (clientesRes.status === 'fulfilled') {
        setClientes((clientesRes.value.data as Cliente[]) || []);
      }

      // Carrega categorias da nuvem Supabase (100% cloud)
      try {
        const cloudCats = await fetchCategoriasSupabase();
        setCategorias(cloudCats || []);
      } catch (err) {
        console.warn('Conectando a categorias do Supabase...', err);
        setCategorias([]);
      }

      // Carrega produtos da nuvem Supabase (100% cloud)
      try {
        const cloudProds = await fetchProdutosSupabase();
        setProdutos(cloudProds || []);
        setPedidos((prev) => enrichPedidosWithProductNames(prev, cloudProds || []));
      } catch (err) {
        console.warn('Conectando a produtos do Supabase...', err);
        setProdutos([]);
      }

      // Carrega bairros da nuvem Supabase (100% cloud)
      try {
        const cloudBairros = await fetchBairrosSupabase();
        setBairros(cloudBairros || []);
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
      setSyncStatus('reconectando');
    } finally {
      setIsCloudConfigLoading(false);
    }
  }, [fetchCloudConfiguracoes]);

  // Gerenciamento de Sessão de Autenticação Real do Supabase (RLS Ativo)
  useEffect(() => {
    // Verifica se já existe uma sessão ativa ao carregar a página
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        // Extrair o nome/cargo baseando-se no email do usuário
        const email = session.user.email || '';
        let cargoAferido: any = 'atendente';
        if (email.startsWith('admin') || email.startsWith('master')) cargoAferido = 'admin';
        else if (email.startsWith('supervisor') || email.startsWith('vlademir')) cargoAferido = 'supervisor';
        else if (email.startsWith('cozinha')) cargoAferido = 'cozinha';
        else if (email.startsWith('garcom')) cargoAferido = 'garcom';
        else if (email.startsWith('entregador')) cargoAferido = 'entregador';

        setCurrentPerfil({
          id: session.user.id,
          nome: email.split('@')[0].toUpperCase(),
          email,
          cargo: cargoAferido,
          criado_em: session.user.created_at || new Date().toISOString(),
        });
        setCurrentRole(cargoAferido);
        fetchCloudState();

        const savedTab = localStorage.getItem('kaipira_admin_active_tab') as ActiveTab | null;
        if (savedTab) {
          setActiveTab(savedTab);
        } else if (cargoAferido === 'master' || cargoAferido === 'admin' || cargoAferido === 'supervisor') {
          setActiveTab('dashboard');
        } else if (cargoAferido === 'cozinha') {
          setActiveTab('kds');
        } else if (cargoAferido === 'garcom') {
          setActiveTab('mesas');
        } else if (cargoAferido === 'entregador') {
          setActiveTab('expedicao');
        } else {
          setActiveTab('pdv');
        }
      }
    });

    // Escuta mudanças de login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        const email = session.user.email || '';
        let cargoAferido: any = 'atendente';
        if (email.startsWith('admin') || email.startsWith('master')) cargoAferido = 'admin';
        else if (email.startsWith('supervisor') || email.startsWith('vlademir')) cargoAferido = 'supervisor';
        else if (email.startsWith('cozinha')) cargoAferido = 'cozinha';
        else if (email.startsWith('garcom')) cargoAferido = 'garcom';
        else if (email.startsWith('entregador')) cargoAferido = 'entregador';

        setCurrentPerfil({
          id: session.user.id,
          nome: email.split('@')[0].toUpperCase(),
          email,
          cargo: cargoAferido,
          criado_em: session.user.created_at || new Date().toISOString(),
        });
        setCurrentRole(cargoAferido);
        fetchCloudState();

        const savedTab = localStorage.getItem('kaipira_admin_active_tab') as ActiveTab | null;
        if (savedTab) {
          setActiveTab(savedTab);
        } else if (event === 'SIGNED_IN') {
          if (cargoAferido === 'master' || cargoAferido === 'admin' || cargoAferido === 'supervisor') {
            setActiveTab('dashboard');
          } else if (cargoAferido === 'cozinha') {
            setActiveTab('kds');
          } else if (cargoAferido === 'garcom') {
            setActiveTab('mesas');
          } else if (cargoAferido === 'entregador') {
            setActiveTab('expedicao');
          } else {
            setActiveTab('pdv');
          }
        }
      } else {
        setPedidos([]); 
        setMesas([]); 
        setCurrentPerfil(undefined);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchCloudState]);

  useEffect(() => {
    // Priority: always load cloud settings immediately on device start
    fetchCloudConfiguracoes();
    fetchCloudState();

    let channel: any = null;
    try {
      // Connect to Supabase Realtime channel (works in static hosting like GitHub Pages)
      channel = supabase
        .channel('restaurante_kaipira_cloud_sync')
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setActiveConnectionsCount(Math.max(1, count));
        })
        .on('presence', { event: 'join' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setActiveConnectionsCount(Math.max(1, count));
        })
        .on('presence', { event: 'leave' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setActiveConnectionsCount(Math.max(1, count));
        })
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
          'broadcast',
          { event: 'novo_pedido' },
          (payload: any) => {
            if (payload.payload) {
              const novoPedido: Pedido = payload.payload;
              setPedidos((prev) => [novoPedido, ...prev.filter((p) => p.id !== novoPedido.id)]);
              playAlertChime('order');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'pedidos' },
          (payload: any) => {
            if (payload.old && payload.old.id) {
              const deletedId = Number(payload.old.id);
              setPedidos((prev) => prev.filter((p) => p.id !== deletedId));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pagamentos' },
          async () => {
            try {
              const peds = await fetchPedidosSupabase();
              if (peds) {
                setPedidos(enrichPedidosWithProductNames(peds, produtos));
              }
            } catch {}
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'caixa_diario' },
          (payload: any) => {
            if (payload.new) {
              const row = payload.new;
              if (row.dados && typeof row.dados === 'object' && row.dados.valor_abertura !== undefined) {
                setCaixa(row.dados);
              } else {
                const valAbertura = row.valor_abertura !== undefined && row.valor_abertura !== null
                  ? Number(row.valor_abertura)
                  : (row.valor_apertura !== undefined && row.valor_apertura !== null ? Number(row.valor_apertura) : 0);
                const cloudMovs: MovimentacaoCaixa[] = Array.isArray(row.movimentacoes) ? row.movimentacoes : [];
                setCaixa({
                  id: row.id || 1,
                  data_caixa: row.data_caixa || new Date().toLocaleDateString('en-CA'),
                  status: (row.status as any) || 'aberto',
                  valor_abertura: isNaN(valAbertura) ? 0 : valAbertura,
                  valor_fechamento: row.valor_fechamento !== null && row.valor_fechamento !== undefined ? Number(row.valor_fechamento) : undefined,
                  observacoes: row.observacoes || '',
                  movimentacoes: cloudMovs,
                  aberto_em: row.aberto_em || new Date().toISOString(),
                });
              }
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
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            setSyncStatus('sincronizado');
            try {
              await channel.track({
                online_em: new Date().toISOString(),
                device: navigator.userAgent.slice(0, 30),
              });
            } catch {}
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setSyncStatus('reconectando');
          }
        });
    } catch (err) {
      console.warn('Supabase Realtime não disponível:', err);
      setSyncStatus('reconectando');
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchCloudConfiguracoes, fetchCloudState]);

  // 1. Blindagem de Conexão Mobile (Tratamento de Tela Bloqueada e Segundo Plano)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        // Ao reabrir o celular ou voltar para a aba, força atualização imediata da nuvem
        fetchCloudState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, fetchCloudState]);

  // 2. Timer de contingência (polling) de segurança a cada 6 segundos
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      try {
        const peds = await fetchPedidosSupabase();
        if (peds) {
          setPedidos((prev) => enrichPedidosWithProductNames(peds, produtos));
          setSyncStatus('sincronizado');
        }
      } catch (err) {
        setSyncStatus('reconectando');
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isAuthenticated, produtos]);

  // 3. Detecção de conexão de rede do navegador (online/offline)
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('sincronizado');
      fetchCloudState();
    };
    const handleOffline = () => {
      setSyncStatus('reconectando');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchCloudState]);

  const handleLogout = async () => {
    try {
      await logoutSupabase();
    } catch (err) {
      console.warn('Erro ao realizar logout do Supabase:', err);
    }
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
    if (role === 'master' || role === 'admin' || role === 'supervisor') setActiveTab('dashboard');
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
  const handleConferirEntrega = async (
    pedidoId: number,
    conferidoPor: string,
    formaFinal?: string
  ) => {
    const pedidoAlvo = pedidos.find((p) => p.id === pedidoId);
    if (!pedidoAlvo) return;

    const agora = new Date().toISOString();
    const formaEscolhida =
      formaFinal ||
      pedidoAlvo.forma_pagamento ||
      pedidoAlvo.pagamentos?.[0]?.forma ||
      'dinheiro';

    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? {
              ...p,
              conferencia_entrega: 'conferido',
              conferido_por: conferidoPor,
              conferido_em: agora,
              pagamento_confirmado: true,
              forma_pagamento: formaEscolhida,
              pagamentos: [
                {
                  id: p.pagamentos?.[0]?.id || Date.now(),
                  pedido_id: p.id,
                  forma: formaEscolhida,
                  valor: p.valor_total,
                  criado_em: p.pagamentos?.[0]?.criado_em || agora,
                },
              ],
            }
          : p
      )
    );

    // Persistir conferência no banco Supabase com a forma de pagamento final confirmada
    await conferirEntregaPedidoSupabase(pedidoId, conferidoPor, formaEscolhida);

    playAlertChime();
  };

  // Consolidação e Pagamento Múltiplo de Entregas pelo Gerente ou Supervisor no Caixa
  const handleConferirEntregasConsolidadas = async (
    pedidoIds: number[],
    pagamentosFracionados: { forma: FormaPagamento; valor: number }[],
    conferidoPor: string
  ) => {
    const agora = new Date().toISOString();
    const responsavel = conferidoPor || currentPerfil?.nome || 'GERENTE GERAL';
    const formaPrincipal = pagamentosFracionados[0]?.forma || 'dinheiro';

    const pedidosAlvo = pedidos.filter((p) => pedidoIds.includes(p.id));
    const totalConsolidado = pedidosAlvo.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);

    // 1. Atualizar todos os pedidos selecionados no estado local
    // Substitui estritamente o array pagamentos anterior pelos pagamentos auditados (proporcionalmente)
    setPedidos((prev) =>
      prev.map((p) => {
        if (!pedidoIds.includes(p.id)) return p;
        const valorPed = Number(p.valor_total) || 0;
        const peso = totalConsolidado > 0 ? valorPed / totalConsolidado : 1 / pedidosAlvo.length;

        const novosPagamentos: Pagamento[] = pagamentosFracionados.map((pg, idx) => ({
          id: Date.now() + p.id * 100 + idx,
          pedido_id: p.id,
          forma: pg.forma,
          valor: Math.round(Number(pg.valor) * peso * 100) / 100,
          criado_em: agora,
        }));

        return {
          ...p,
          conferencia_entrega: 'conferido',
          conferido_por: responsavel,
          conferido_em: agora,
          pagamento_confirmado: true,
          forma_pagamento: formaPrincipal,
          pagamentos: novosPagamentos,
        };
      })
    );

    // 2. Registrar entradas no caixa diário para cada fração de pagamento
    if (caixa && caixa.status === 'aberto') {
      const pedsDesc = pedidoIds
        .map((id) => {
          const ped = pedidos.find((p) => p.id === id);
          return `#${ped?.codigo_senha || id}`;
        })
        .join(', ');

      for (const pg of pagamentosFracionados) {
        if (pg.valor > 0) {
          await handleMovimentacaoCaixa(
            'entrada_pedido',
            pg.forma,
            pg.valor,
            `PAGAMENTO CONSOLIDADO: ${pedsDesc}`
          );
        }
      }
    }

    // 3. Sincronizar em lote no Supabase
    await conferirEntregasConsolidadasSupabase(pedidoIds, pagamentosFracionados, responsavel);

    playAlertChime();
  };

  // Confirmação de recebimento/pagamento de pedido (Balcão, Salão ou Delivery)
  const handleConfirmarPagamentoPedido = async (
    pedidoId: number,
    forma?: FormaPagamento,
    conferidoPor?: string
  ) => {
    const pedidoAlvo = pedidos.find((p) => p.id === pedidoId);
    if (!pedidoAlvo) return;

    const agora = new Date().toISOString();
    const responsavel = conferidoPor || currentPerfil?.nome || 'OPERADOR CAIXA';

    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? {
              ...p,
              pagamento_confirmado: true,
              conferencia_entrega: p.tipo === 'delivery' ? 'conferido' : p.conferencia_entrega,
              conferido_por: responsavel,
              conferido_em: agora,
            }
          : p
      )
    );

    if (pedidoAlvo.tipo === 'delivery') {
      await conferirEntregaPedidoSupabase(pedidoId, responsavel);
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
      prev.map((m) => (m.numero === numero || m.id === numero ? { ...m, status, cliente_nome, pessoas } : m))
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
    // 1. PRIMEIRO: Conclui os pedidos vinculados à mesa e atualiza no Supabase
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
          return {
            ...p,
            status: 'entregue' as StatusPedido,
            pagamentos: formattedPagamentos,
            pagamento_confirmado: true,
          };
        })
      );
      for (const pId of pedidosIds) {
        await atualizarStatusPedidoSupabase(pId, 'entregue');
      }
    }

    // 2. SEGUNDO: Insere os pagamentos no banco Supabase
    if (pedidosIds && pedidosIds.length > 0 && pagamentos && pagamentos.length > 0) {
      await registrarPagamentosMesaSupabase(pedidosIds, pagamentos);
    }

    // Se houver débito em conta de mensalista, atualiza saldo devedor
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

    // 3. TERCEIRO E ÚLTIMO: Libera a mesa no banco Supabase e atualiza o estado local setMesas
    await fecharMesaSupabase(numero);
    setMesas((prev) =>
      prev.map((m) =>
        m.numero === numero || m.id === numero
          ? { ...m, status: 'livre', cliente_nome: undefined, pessoas: undefined }
          : m
      )
    );
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
    const cli = clientes.find((c) => c.id === clienteId);
    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? { ...c, saldo_devedor: Math.max(0, (c.saldo_devedor || 0) - valor) }
          : c
      )
    );
    await abaterSaldoMensalistaSupabase(clienteId, valor, cli);
    if (caixa && caixa.status === 'aberto' && valor > 0) {
      await handleMovimentacaoCaixa(
        'suprimento',
        _forma,
        valor,
        `RECEBIMENTO MENSALISTA: ${cli?.nome || 'CLIENTE'}`
      );
    }
  };

  const handleCadastrarCliente = async (clienteData: Partial<Cliente>) => {
    await handleSaveCliente(clienteData);
  };

  const handleSaveCliente = async (clienteData: Partial<Cliente>) => {
    const res = await salvarClienteSupabase(clienteData);
    const saved = res.data || {
      id: clienteData.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now()),
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

  const handleDeleteCliente = async (id: string): Promise<boolean> => {
    const res = await excluirClienteSupabase(id);
    if (!res.success) {
      const isFk =
        res.error?.includes('23503') ||
        res.error?.toLowerCase().includes('foreign key') ||
        res.error?.toLowerCase().includes('violates') ||
        res.error?.toLowerCase().includes('referenc');
      alert(
        isFk
          ? 'NÃO É POSSÍVEL EXCLUIR ESTE CLIENTE: existem pedidos ou movimentações vinculadas a ele no banco de dados da nuvem.'
          : `Erro ao excluir cliente no Supabase: ${res.error || 'Falha na comunicação'}`
      );
      return false;
    }
    setClientes((prev) => prev.filter((c) => c.id !== id));
    return true;
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
      url_imagem: prodData.url_imagem,
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

  const handleDeleteProduto = async (id: number): Promise<boolean> => {
    const res = await excluirProdutoSupabase(id);
    if (!res.success) {
      const isFk =
        res.error?.includes('23503') ||
        res.error?.toLowerCase().includes('foreign key') ||
        res.error?.toLowerCase().includes('violates') ||
        res.error?.toLowerCase().includes('referenc');
      alert(
        isFk
          ? 'NÃO É POSSÍVEL EXCLUIR ESTE PRODUTO: existem pedidos ou itens vinculados a ele no banco de dados da nuvem.'
          : `Erro ao excluir produto no Supabase: ${res.error || 'Falha na comunicação'}`
      );
      return false;
    }
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    return true;
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

  const handleDeleteCategoria = async (id: number): Promise<boolean> => {
    const res = await excluirCategoriaSupabase(id);
    if (!res.success) {
      const isFk =
        res.error?.includes('23503') ||
        res.error?.toLowerCase().includes('foreign key') ||
        res.error?.toLowerCase().includes('violates') ||
        res.error?.toLowerCase().includes('referenc');
      alert(
        isFk
          ? 'NÃO É POSSÍVEL EXCLUIR ESTA CATEGORIA: existem produtos vinculados a ela no banco de dados da nuvem.'
          : `Erro ao excluir categoria no Supabase: ${res.error || 'Falha na comunicação'}`
      );
      return false;
    }
    setCategorias((prev) => prev.filter((c) => c.id !== id));
    return true;
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

    // Atualiza também o cardapioDiario para status: 'aguardando' no Supabase
    const cardapioAguardando: CardapioDiarioConfig = { ...cardapioDiario, status: 'aguardando' };
    setCardapioDiario(cardapioAguardando);
    try {
      await salvarCardapioDiarioSupabase(cardapioAguardando);
    } catch (cErr) {
      console.warn('Aviso ao definir cardápio para aguardando:', cErr);
    }

    // Desativa as vendas na vitrine e no PDV e espelha cardápio em aguardando
    await handleSaveConfiguracoes({
      ...configuracoes,
      delivery_site_ativo: false,
      delivery_interno_ativo: false,
      cardapio_diario_cache: cardapioAguardando,
    });
  };

  const handleZerarFinanceiroDia = async () => {
    try {
      const zerado = await zerarFinanceiroDiaSupabase(caixa);
      // Força o caixa a ficar fechado no sistema
      setCaixa({ ...zerado, status: 'fechado', valor_fechamento: 0 });
      setPedidos([]);
      setMesas((prev) =>
        prev.map((m) => ({
          ...m,
          status: 'livre',
          cliente_nome: undefined,
          pessoas: undefined,
        }))
      );

      // Atualiza também o cardapioDiario para status: 'aguardando' no Supabase
      const cardapioAguardando: CardapioDiarioConfig = { ...cardapioDiario, status: 'aguardando' };
      setCardapioDiario(cardapioAguardando);
      try {
        await salvarCardapioDiarioSupabase(cardapioAguardando);
      } catch (cErr) {
        console.warn('Aviso ao definir cardápio para aguardando:', cErr);
      }

      // Desativa as vendas na vitrine e no PDV e espelha cardápio em aguardando
      await handleSaveConfiguracoes({
        ...configuracoes,
        delivery_site_ativo: false,
        delivery_interno_ativo: false,
        cardapio_diario_cache: cardapioAguardando,
      });
    } catch (err) {
      console.error('Erro ao zerar financeiro do dia:', err);
    }
  };

  // Rotina Administrativa: Kill Switches de Delivery
  const handleToggleKillSwitch = async (chave: 'delivery_site_ativo' | 'delivery_interno_ativo') => {
    const atual = configuracoes[chave] !== false;
    const novasConfig: ConfiguracoesSistema = {
      ...configuracoes,
      [chave]: !atual,
    };
    setConfiguracoes(novasConfig);
    await handleSaveConfiguracoes(novasConfig);
  };

  // Rotina Administrativa: Alternar entre Modo Produção e Modo Testes
  const handleToggleModoOperacao = async (novoModo: 'producao' | 'testes') => {
    const novasConfig: ConfiguracoesSistema = { ...configuracoes, modoOperacao: novoModo };
    await handleSaveConfiguracoes(novasConfig);
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

  const handleSaveCardapioDiario = async (novo: CardapioDiarioConfig) => {
    const cardapioPublicado: CardapioDiarioConfig = {
      ...novo,
      status: 'publicado',
      data: new Date().toISOString().split('T')[0],
      confirmado_em: new Date().toISOString(),
    };
    setCardapioDiario(cardapioPublicado);
    try {
      await salvarCardapioDiarioSupabase(cardapioPublicado);
    } catch (e) {
      console.warn('Fallback cardapio_diario:', e);
    }

    // Salva junto nas configurações (que já sincroniza 100% com a Vitrine)
    const novasConfig: ConfiguracoesSistema = {
      ...configuracoes,
      delivery_site_ativo: true,
      delivery_interno_ativo: true,
      cardapio_diario_cache: cardapioPublicado,
    };
    await handleSaveConfiguracoes(novasConfig);
  };

  // Cardápio efetivo estável: se o cardápio diário ou o cache em configurações estiver publicado para a data corrente (data_caixa ou hoje), mantém ativo
  const cardapioEfetivo: CardapioDiarioConfig = useMemo(() => {
    const hoje = caixa?.data_caixa || new Date().toLocaleDateString('en-CA');
    const hojeIso = new Date().toISOString().split('T')[0];

    const isStateAtivo = ['publicado', 'aberto', 'confirmado'].includes((cardapioDiario?.status || '').toLowerCase());
    if (isStateAtivo && (cardapioDiario?.data === hoje || cardapioDiario?.data === hojeIso || !cardapioDiario?.data)) {
      return cardapioDiario;
    }

    const cache = configuracoes?.cardapio_diario_cache;
    const isCacheAtivo = ['publicado', 'aberto', 'confirmado'].includes((cache?.status || '').toLowerCase());
    if (isCacheAtivo && cache && (cache.data === hoje || cache.data === hojeIso || !cache.data)) {
      return cache;
    }

    return cardapioDiario;
  }, [cardapioDiario, configuracoes?.cardapio_diario_cache, caixa?.data_caixa]);

  const pendingKdsCount = (pedidos || []).filter((p) => ['pendente', 'em_preparacao'].includes(p.status)).length;
  const deliveryProntosCount = (pedidos || []).filter((p) => p.tipo === 'delivery' && p.status === 'pronto').length;

  // IF NOT AUTHENTICATED -> SHOW LOGIN SCREEN FIRST
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const currentTheme = THEMES[configuracoes.padraoCor] || THEMES.ambar;

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden ${currentTheme.bgTone || 'bg-neutral-900'} ${currentTheme.fontStyle || 'font-sans'} ${configuracoes.padraoCor === 'windows11' ? 'theme-windows11' : ''} text-neutral-100 flex flex-col transition-colors duration-200`}>
      {/* Top Bar Header with Configurable Menu Position and Theme */}
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'pdv') setSelectedMesaNumber(undefined);
        }}
        currentRole={currentRole}
        currentPerfil={currentPerfil}
        isLunchTime={isLunchTime}
        onOpenSlideMenu={() => setIsSlideMenuOpen(true)}
        pendingKdsCount={pendingKdsCount}
        deliveryProntosCount={deliveryProntosCount}
        activeConnectionsCount={activeConnectionsCount}
        posicaoMenu={configuracoes.posicaoMenu}
        padraoCor={configuracoes.padraoCor}
        configuracoes={configuracoes}
        isCloudConfigLoading={isCloudConfigLoading}
        cloudConfigSyncedAt={cloudConfigSyncedAt}
        onRefreshCloudConfig={fetchCloudConfiguracoes}
        syncStatus={syncStatus}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full max-w-full mx-auto p-4 sm:p-6 overflow-x-hidden">
        {/* Admin Dashboard */}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            pedidos={pedidos}
            mesas={mesas}
            caixa={caixa}
            estoque={estoque}
            clientes={clientes}
            configuracoes={configuracoes}
            cardapioDiario={cardapioEfetivo}
            onNavigate={(tab) => {
              setActiveTab(tab);
              if (tab !== 'pdv') setSelectedMesaNumber(undefined);
            }}
            onAbrirCaixa={handleAbrirCaixa}
            onFecharCaixa={handleFecharCaixa}
            onMovimentacao={handleMovimentacaoCaixa}
            onUpdateStockItem={handleUpdateStockItem}
            currentRole={currentPerfil?.cargo || currentRole}
            onZerarFinanceiro={handleZerarFinanceiroDia}
            onToggleModoOperacao={handleToggleModoOperacao}
            onConfirmarPagamento={handleConfirmarPagamentoPedido}
            onToggleKillSwitch={handleToggleKillSwitch}
            onSaveConfiguracoes={handleSaveConfiguracoes}
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
            cardapioDiario={cardapioEfetivo}
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
            caixa={caixa}
            configuracoes={configuracoes}
            currentRole={currentRole}
            clientes={clientes}
            onSaveCliente={handleSaveCliente}
            onSaveBairro={handleSaveBairro}
            onOrderCreated={async (novo) => {
              // Se for retirada (balcão) com pagamento imediato, confirma pagamento no ato
              const isConfirmadoBalcao =
                novo.tipo === 'retirada' &&
                novo.pagamentos &&
                novo.pagamentos.some((pg) => pg.valor > 0);

              const enrichedNovo = enrichPedidosWithProductNames([novo], produtos)[0] || novo;
              const finalNovo = isConfirmadoBalcao
                ? { ...enrichedNovo, pagamento_confirmado: true }
                : enrichedNovo;

              setPedidos((prev) => [finalNovo, ...prev.filter((p) => p.id !== novo.id)]);

              // Toda vez que lançado um pedido na mesa, marca a mesa como ocupada no estado e no Supabase
              if (isSalaoPedido(novo) && novo.mesa_id) {
                const mesaNum = Number(novo.mesa_id);
                const mesaAtual = mesas.find((m) => m.numero === mesaNum || m.id === mesaNum);
                const cliNome = novo.cliente?.nome || mesaAtual?.cliente_nome || 'MESA OCUPADA';
                await handleUpdateMesaStatus(mesaAtual?.numero || mesaNum, 'ocupada', cliNome, mesaAtual?.pessoas || 2);
              }
            }}
            onPrintReceipt={(p) => setPrintReceiptPedido(p)}
            onTogglePauseProduto={handleTogglePauseProduto}
            cardapioDiario={cardapioEfetivo}
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
        {(activeTab === 'led' || activeTab === 'senhas') && (
          <LedPanel
            pedidos={pedidos}
            configuracoes={configuracoes}
            onOpenSettings={() => setActiveTab('configuracoes')}
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {/* Mesas & Salão */}
        {activeTab === 'mesas' && (
          <TablesSaloon
            mesas={mesas}
            pedidos={pedidos}
            reservas={reservas}
            produtos={produtos}
            clientes={clientes}
            caixa={caixa}
            cardapioDiario={cardapioEfetivo}
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
            produtos={produtos}
            usuarios={usuarios}
            clientes={clientes}
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
            mesas={mesas}
            clientes={clientes}
            onAbrirCaixa={handleAbrirCaixa}
            onFecharCaixa={handleFecharCaixa}
            onMovimentacao={handleMovimentacaoCaixa}
            onConferirEntrega={handleConferirEntrega}
            onConferirEntregasConsolidadas={handleConferirEntregasConsolidadas}
            onConfirmarPagamento={handleConfirmarPagamentoPedido}
          />
        )}
      </main>

      {/* Rodapé com Indicador Visual Discreto de Sincronização em Nuvem (Mobile & Desktop) */}
      <footer className="w-full bg-neutral-900/90 border-t border-neutral-800/80 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          {syncStatus === 'sincronizado' ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-bold text-[11px] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>Sincronizado via Nuvem</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/90 border border-amber-600 text-amber-300 font-black text-[11px] animate-pulse shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span>Reconectando à Nuvem...</span>
            </div>
          )}
          <span className="text-[10px] text-neutral-500 font-mono hidden md:inline">
            · Conexão direta Supabase Realtime
          </span>
        </div>
        <div className="text-[10px] text-neutral-500 font-mono text-center sm:text-right">
          <span>{configuracoes.nomeRestaurante || 'RESTAURANTE KAIPIRA'} · {configuracoes.cidade || 'PIRACICABA'} - {configuracoes.uf || 'SP'}</span>
        </div>
      </footer>

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
        onLogout={handleLogout}
        pendingKdsCount={pendingKdsCount}
        deliveryProntosCount={deliveryProntosCount}
        posicaoMenu={configuracoes.posicaoMenu}
        padraoCor={configuracoes.padraoCor}
      />

      {/* Thermal Receipt Print Modal */}
      <ThermalReceipt
        pedido={printReceiptPedido}
        produtos={produtos}
        clientes={clientes}
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

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

// Seed data fallbacks if server offline
import {
  INITIAL_CATEGORIAS,
  INITIAL_PRODUTOS,
  INITIAL_MESAS,
  INITIAL_CLIENTES,
  INITIAL_ESTOQUE,
  INITIAL_PERFIS,
  INITIAL_USUARIOS,
  INITIAL_CAIXA,
  INITIAL_PEDIDOS,
  BAIRROS_PIRACICABA,
  INITIAL_CONFIGURACOES,
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
  abrirCaixaSupabase,
  fecharCaixaSupabase,
  registrarMovimentacaoCaixaSupabase,
  criarReservaSupabase,
  abaterSaldoMensalistaSupabase,
  fetchUsuariosSupabase,
  garantirMasterSupabase,
  salvarCardapioDiarioSupabase,
  fetchCardapioDiarioSupabase,
} from './services/supabaseClient';

export default function App() {
  // Authentication State (In-Memory / Cloud Session - ZERO localStorage)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentPerfil, setCurrentPerfil] = useState<Perfil | undefined>(undefined);
  const [currentRole, setCurrentRole] = useState<TipoUsuario>('admin');

  // Navigation & Menu Settings
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState<boolean>(false);
  const [selectedMesaNumber, setSelectedMesaNumber] = useState<number | undefined>(undefined);

  // Cloud Application State
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesSistema>(INITIAL_CONFIGURACOES);
  const [isCloudConfigLoading, setIsCloudConfigLoading] = useState<boolean>(true);
  const [cloudConfigSyncedAt, setCloudConfigSyncedAt] = useState<Date | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>(INITIAL_CATEGORIAS);
  const [produtos, setProdutos] = useState<Produto[]>(INITIAL_PRODUTOS);
  const [mesas, setMesas] = useState<Mesa[]>(INITIAL_MESAS);
  const [clientes, setClientes] = useState<Cliente[]>(INITIAL_CLIENTES);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(INITIAL_USUARIOS);
  const [estoque, setEstoque] = useState<ItemEstoque[]>(INITIAL_ESTOQUE);
  const [caixa, setCaixa] = useState<CaixaDiario>(INITIAL_CAIXA);
  const [pedidos, setPedidos] = useState<Pedido[]>(INITIAL_PEDIDOS);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bairros, setBairros] = useState<BairroTaxa[]>(BAIRROS_PIRACICABA);
  const [cardapioDiario, setCardapioDiario] = useState<CardapioDiarioConfig>({
    data: new Date().toISOString().split('T')[0],
    status: 'aguardando',
    itens: [],
  });

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
      const [pedidosRes, mesasRes, estoqueRes, caixaRes, reservasRes, clientesRes] = await Promise.allSettled([
        supabase.from('pedidos').select('*').order('criado_em', { ascending: false }),
        supabase.from('mesas').select('*').order('numero', { ascending: true }),
        supabase.from('estoque').select('*').order('id', { ascending: true }),
        supabase.from('caixa_diario').select('*').order('id', { ascending: false }).limit(1),
        supabase.from('reservas').select('*').order('id', { ascending: false }),
        supabase.from('clientes').select('*').order('nome', { ascending: true }),
      ]);

      if (pedidosRes.status === 'fulfilled' && pedidosRes.value.data && pedidosRes.value.data.length > 0) {
        setPedidos(pedidosRes.value.data as Pedido[]);
      }
      if (mesasRes.status === 'fulfilled' && mesasRes.value.data && mesasRes.value.data.length > 0) {
        setMesas(mesasRes.value.data as Mesa[]);
      }
      if (estoqueRes.status === 'fulfilled' && estoqueRes.value.data && estoqueRes.value.data.length > 0) {
        setEstoque(estoqueRes.value.data as ItemEstoque[]);
      }
      if (caixaRes.status === 'fulfilled' && caixaRes.value.data && caixaRes.value.data.length > 0) {
        const row = caixaRes.value.data[0];
        if (row.dados) {
          setCaixa(row.dados);
        } else {
          setCaixa((prev) => ({
            ...prev,
            status: row.status || prev.status,
            valor_abertura: Number(row.valor_abertura) || prev.valor_abertura,
            valor_fechamento: row.valor_fechamento ? Number(row.valor_fechamento) : undefined,
          }));
        }
      }
      if (reservasRes.status === 'fulfilled' && reservasRes.value.data && reservasRes.value.data.length > 0) {
        setReservas(reservasRes.value.data as Reserva[]);
      }
      if (clientesRes.status === 'fulfilled' && clientesRes.value.data && clientesRes.value.data.length > 0) {
        setClientes(clientesRes.value.data as Cliente[]);
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
              setPedidos((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
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
            if (payload.new) {
              const updatedItem: ItemEstoque = payload.new;
              setEstoque((prev) => prev.map((it) => (it.id === updatedItem.id ? { ...it, ...updatedItem } : it)));
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

  // Save Settings to cloud directly via Supabase
  const handleSaveConfiguracoes = async (novas: ConfiguracoesSistema) => {
    const saved = await saveConfiguracoesToSupabase(novas);
    setConfiguracoes(saved);
    setCloudConfigSyncedAt(new Date());
  };

  // Order status updates via Supabase
  const handleUpdateOrderStatus = async (id: number, status: StatusPedido, entregador?: string) => {
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, entregador_nome: entregador } : p))
    );
    await atualizarStatusPedidoSupabase(id, status, entregador);
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

  const handleFecharMesa = async (numero: number) => {
    setMesas((prev) =>
      prev.map((m) => (m.numero === numero ? { ...m, status: 'livre', cliente_nome: undefined, pessoas: undefined } : m))
    );
    await fecharMesaSupabase(numero);
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

  // Stock operations via Supabase
  const handleUpdateStockItem = async (id: number, data: Partial<ItemEstoque>) => {
    setEstoque((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
    await atualizarItemEstoqueSupabase(id, data);
  };

  const handleAddStockItem = async (data: Partial<ItemEstoque>) => {
    const novo = await adicionarItemEstoqueSupabase(data);
    setEstoque((prev) => [...prev, novo]);
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
  };

  const handleCadastrarCliente = async (clienteData: Partial<Cliente>) => {
    const novo: Cliente = {
      id: 'c-' + Date.now(),
      nome: (clienteData.nome || '').toUpperCase(),
      telefone: clienteData.telefone || '',
      cep: clienteData.cep || '',
      endereco: (clienteData.endereco || '').toUpperCase(),
      numero: (clienteData.numero || '').toUpperCase(),
      bairro: (clienteData.bairro || '').toUpperCase(),
      complemento: (clienteData.complemento || '').toUpperCase(),
      eh_mensalista: !!clienteData.eh_mensalista,
      saldo_devedor: 0,
      criado_em: new Date().toISOString(),
    };
    setClientes((prev) => [novo, ...prev]);
    try {
      await supabase.from('clientes').insert(novo);
    } catch (err) {
      console.warn('Erro ao salvar cliente no Supabase:', err);
    }
  };

  // Cash Register functional operations via Supabase
  const handleAbrirCaixa = async (valor: number, observacoes?: string) => {
    const novo = await abrirCaixaSupabase(valor, observacoes);
    setCaixa(novo);
  };

  const handleFecharCaixa = async (valor: number, observacoes?: string) => {
    const fechado = await fecharCaixaSupabase(caixa, valor, observacoes);
    setCaixa(fechado);
  };

  const handleMovimentacaoCaixa = async (
    tipo: 'suprimento' | 'sangria',
    forma: any,
    valor: number,
    descricao: string
  ) => {
    const atualizado = await registrarMovimentacaoCaixaSupabase(
      caixa,
      tipo,
      forma,
      valor,
      descricao
    );
    setCaixa(atualizado);
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

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col">
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
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              if (tab !== 'pdv') setSelectedMesaNumber(undefined);
            }}
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
            onOrderCreated={(novo) => {
              setPedidos((prev) => [novo, ...prev]);
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
            onOpenOrderForMesa={(num) => {
              setSelectedMesaNumber(num);
              setActiveTab('pdv');
            }}
            onUpdateMesaStatus={handleUpdateMesaStatus}
            onFecharMesa={handleFecharMesa}
            onCreateReserva={handleCreateReserva}
            onPrintReceipt={(p) => setPrintReceiptPedido(p)}
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
          />
        )}

        {/* Caixa Diário */}
        {activeTab === 'caixa' && (
          <CashRegister
            caixa={caixa}
            onAbrirCaixa={handleAbrirCaixa}
            onFecharCaixa={handleFecharCaixa}
            onMovimentacao={handleMovimentacaoCaixa}
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

import React, { useState, useEffect, useCallback } from 'react';
import {
  Produto,
  Categoria,
  Mesa,
  Cliente,
  ItemEstoque,
  Perfil,
  CaixaDiario,
  Pedido,
  Reserva,
  BairroTaxa,
  TipoUsuario,
  StatusPedido,
  ConfiguracoesSistema,
} from './types';
import { Header, ActiveTab } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
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
  INITIAL_CAIXA,
  INITIAL_PEDIDOS,
  BAIRROS_PIRACICABA,
  INITIAL_CONFIGURACOES,
} from './data/seedData';

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
  const [estoque, setEstoque] = useState<ItemEstoque[]>(INITIAL_ESTOQUE);
  const [caixa, setCaixa] = useState<CaixaDiario>(INITIAL_CAIXA);
  const [pedidos, setPedidos] = useState<Pedido[]>(INITIAL_PEDIDOS);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bairros, setBairros] = useState<BairroTaxa[]>(BAIRROS_PIRACICABA);

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

  // Dedicated fetch to load cloud configuracoes immediately on any device
  const fetchCloudConfiguracoes = useCallback(async () => {
    setIsCloudConfigLoading(true);
    try {
      const res = await fetch('/api/configuracoes', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && data.nomeRestaurante) {
          setConfiguracoes((prev) => ({ ...prev, ...data }));
          setCloudConfigSyncedAt(new Date());
        }
      }
    } catch (err) {
      console.warn('Conectando às configurações em nuvem...', err);
    } finally {
      setIsCloudConfigLoading(false);
    }
  }, []);

  // Fetch full cloud state on load
  const fetchCloudState = useCallback(async () => {
    try {
      const res = await fetch('/api/state', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.configuracoes) {
          setConfiguracoes(data.configuracoes);
          setCloudConfigSyncedAt(new Date());
        }
        if (data.categorias) setCategorias(data.categorias);
        if (data.produtos) setProdutos(data.produtos);
        if (data.mesas) setMesas(data.mesas);
        if (data.clientes) setClientes(data.clientes);
        if (data.estoque) setEstoque(data.estoque);
        if (data.caixa) setCaixa(data.caixa);
        if (data.pedidos) setPedidos(data.pedidos);
        if (data.reservas) setReservas(data.reservas);
        if (data.bairros) setBairros(data.bairros);
      }
    } catch (err) {
      console.warn('Conectando ao backend em nuvem...', err);
    } finally {
      setIsCloudConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    // Priority: always load cloud settings immediately on device start
    fetchCloudConfiguracoes();
    fetchCloudState();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.addEventListener('SETTINGS_UPDATED', (e: MessageEvent) => {
        try {
          const novasConfig = JSON.parse(e.data);
          setConfiguracoes(novasConfig);
          setCloudConfigSyncedAt(new Date());
        } catch {}
      });

      eventSource.addEventListener('ORDER_CREATED', (e: MessageEvent) => {
        try {
          const novoPedido: Pedido = JSON.parse(e.data);
          setPedidos((prev) => [novoPedido, ...prev.filter((p) => p.id !== novoPedido.id)]);
          playAlertChime('order');
        } catch {}
      });

      eventSource.addEventListener('ORDER_STATUS_UPDATED', (e: MessageEvent) => {
        try {
          const updated: Pedido = JSON.parse(e.data);
          setPedidos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        } catch {}
      });

      eventSource.addEventListener('TABLE_UPDATED', (e: MessageEvent) => {
        try {
          const updatedMesa: Mesa = JSON.parse(e.data);
          setMesas((prev) => prev.map((m) => (m.numero === updatedMesa.numero ? updatedMesa : m)));
        } catch {}
      });

      eventSource.addEventListener('PRODUCT_PAUSED', (e: MessageEvent) => {
        try {
          const updatedProd: Produto = JSON.parse(e.data);
          setProdutos((prev) => prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)));
        } catch {}
      });

      eventSource.addEventListener('STOCK_UPDATED', (e: MessageEvent) => {
        try {
          const updatedItem: ItemEstoque = JSON.parse(e.data);
          setEstoque((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
        } catch {}
      });

      eventSource.addEventListener('CASH_OPENED', (e: MessageEvent) => {
        try {
          setCaixa(JSON.parse(e.data));
        } catch {}
      });

      eventSource.addEventListener('CASH_CLOSED', (e: MessageEvent) => {
        try {
          setCaixa(JSON.parse(e.data));
        } catch {}
      });

      eventSource.addEventListener('CASH_MOVEMENT', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.caixa) setCaixa(payload.caixa);
        } catch {}
      });
    } catch (err) {
      console.warn('SSE Realtime não disponível:', err);
    }

    return () => {
      eventSource?.close();
    };
  }, [fetchCloudState]);

  // Handle Login Success
  const handleLoginSuccess = (perfil: Perfil) => {
    setIsAuthenticated(true);
    setCurrentPerfil(perfil);
    setCurrentRole(perfil.cargo);

    if (perfil.cargo === 'admin') {
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
    if (role === 'admin') setActiveTab('dashboard');
    else if (role === 'cozinha') setActiveTab('kds');
    else if (role === 'garcom') setActiveTab('mesas');
    else if (role === 'entregador') setActiveTab('expedicao');
    else if (role === 'atendente') setActiveTab('pdv');
  };

  // Save Settings to cloud
  const handleSaveConfiguracoes = async (novas: ConfiguracoesSistema) => {
    const res = await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novas),
    });
    if (!res.ok) throw new Error('Falha ao gravar configurações na nuvem');
    const saved = await res.json();
    setConfiguracoes(saved);
    setCloudConfigSyncedAt(new Date());
  };

  // Order status updates
  const handleUpdateOrderStatus = async (id: number, status: StatusPedido, entregador?: string) => {
    try {
      const res = await fetch(`/api/pedidos/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, entregador_nome: entregador }),
      });
      if (res.ok) {
        const updated: Pedido = await res.json();
        setPedidos((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    } catch {
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status, entregador_nome: entregador } : p))
      );
    }
  };

  // Table status updates
  const handleUpdateMesaStatus = async (
    numero: number,
    status: Mesa['status'],
    cliente_nome?: string,
    pessoas?: number
  ) => {
    try {
      const res = await fetch(`/api/mesas/${numero}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cliente_nome, pessoas }),
      });
      if (res.ok) {
        const updated: Mesa = await res.json();
        setMesas((prev) => prev.map((m) => (m.numero === numero ? updated : m)));
      }
    } catch {
      setMesas((prev) =>
        prev.map((m) => (m.numero === numero ? { ...m, status, cliente_nome, pessoas } : m))
      );
    }
  };

  const handleFecharMesa = async (numero: number) => {
    try {
      const res = await fetch(`/api/mesas/${numero}/fechar`, { method: 'POST' });
      if (res.ok) {
        setMesas((prev) =>
          prev.map((m) => (m.numero === numero ? { ...m, status: 'livre', cliente_nome: undefined, pessoas: undefined } : m))
        );
        fetchCloudState();
      }
    } catch {
      setMesas((prev) =>
        prev.map((m) => (m.numero === numero ? { ...m, status: 'livre', cliente_nome: undefined } : m))
      );
    }
  };

  // Toggle quick pause for product
  const handleTogglePauseProduto = async (id: number) => {
    try {
      const res = await fetch(`/api/produtos/${id}/pausar`, { method: 'PUT' });
      if (res.ok) {
        const updated: Produto = await res.json();
        setProdutos((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    } catch {
      setProdutos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, pausado: !p.pausado } : p))
      );
    }
  };

  // Stock
  const handleUpdateStockItem = async (id: number, data: Partial<ItemEstoque>) => {
    try {
      const res = await fetch(`/api/estoque/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated: ItemEstoque = await res.json();
        setEstoque((prev) => prev.map((it) => (it.id === id ? updated : it)));
      }
    } catch {
      setEstoque((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
    }
  };

  const handleAddStockItem = async (data: Partial<ItemEstoque>) => {
    try {
      const res = await fetch('/api/estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const novo: ItemEstoque = await res.json();
        setEstoque((prev) => [...prev, novo]);
      }
    } catch {
      const novo: ItemEstoque = {
        id: Date.now(),
        item_nome: data.item_nome || '',
        quantidade_atual: data.quantidade_atual || 0,
        unidade_medida: data.unidade_medida || 'un',
        estoque_minimo: data.estoque_minimo || 5,
        fornecedor_info: data.fornecedor_info,
        atualizado_em: new Date().toISOString(),
      };
      setEstoque((prev) => [...prev, novo]);
    }
  };

  // Mensalistas
  const handleAbaterSaldoMensalista = async (clienteId: string, valor: number, forma: 'pix' | 'dinheiro' | 'cartao_debito') => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/abater-saldo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor_pago: valor, forma }),
      });
      if (res.ok) {
        const updated: Cliente = await res.json();
        setClientes((prev) => prev.map((c) => (c.id === clienteId ? updated : c)));
        fetchCloudState();
      }
    } catch {
      setClientes((prev) =>
        prev.map((c) =>
          c.id === clienteId
            ? { ...c, saldo_devedor: Math.max(0, c.saldo_devedor - valor) }
            : c
        )
      );
    }
  };

  const handleCadastrarCliente = (clienteData: Partial<Cliente>) => {
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
  };

  // Cash Register functional operations
  const handleAbrirCaixa = async (valor: number, observacoes?: string) => {
    try {
      const res = await fetch('/api/caixa/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor_abertura: valor, observacoes }),
      });
      if (res.ok) setCaixa(await res.json());
    } catch {
      setCaixa({
        id: Date.now(),
        data_caixa: new Date().toISOString().split('T')[0],
        valor_abertura: valor,
        status: 'aberto',
        observacoes,
        aberto_em: new Date().toISOString(),
        movimentacoes: [],
      });
    }
  };

  const handleFecharCaixa = async (valor: number, observacoes?: string) => {
    try {
      const res = await fetch('/api/caixa/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor_fechamento: valor, observacoes }),
      });
      if (res.ok) setCaixa(await res.json());
    } catch {
      setCaixa((prev) => ({
        ...prev,
        status: 'fechado',
        valor_fechamento: valor,
        fechado_em: new Date().toISOString(),
      }));
    }
  };

  const handleMovimentacaoCaixa = async (
    tipo: 'suprimento' | 'sangria',
    forma: any,
    valor: number,
    descricao: string
  ) => {
    try {
      const res = await fetch('/api/caixa/movimentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, forma, valor, descricao }),
      });
      if (res.ok) setCaixa(await res.json());
    } catch {
      const novaMov = {
        id: Date.now(),
        tipo,
        forma,
        valor,
        descricao,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setCaixa((prev) => ({
        ...prev,
        movimentacoes: [...prev.movimentacoes, novaMov],
      }));
    }
  };

  // Reservations
  const handleCreateReserva = async (resData: Partial<Reserva>) => {
    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resData),
      });
      if (res.ok) {
        const nova = await res.json();
        setReservas((prev) => [...prev, nova]);
        fetchCloudState();
      }
    } catch {
      const nova: Reserva = {
        id: Date.now(),
        cliente_nome: resData.cliente_nome || '',
        telefone: resData.telefone || '',
        mesa_id: resData.mesa_id || 1,
        data_hora: resData.data_hora || new Date().toISOString(),
        status: 'confirmada',
        observacoes: resData.observacoes,
      };
      setReservas((prev) => [...prev, nova]);
    }
  };

  const pendingKdsCount = pedidos.filter((p) => ['pendente', 'em_preparacao'].includes(p.status)).length;

  // IF NOT AUTHENTICATED -> SHOW LOGIN SCREEN FIRST
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
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

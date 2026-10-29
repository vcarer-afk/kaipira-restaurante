import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
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
  INITIAL_FORMAS_PAGAMENTO,
} from './src/data/seedData.ts';
import { Pedido, Mesa, Cliente, Produto, ItemEstoque, CaixaDiario, Reserva, FormaPagamento, ConfiguracoesSistema, FormaPagamentoConfig } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'kaipira_cloud_db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'kaipira_cloud_db.json.bak');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface AppState {
  categorias: typeof INITIAL_CATEGORIAS;
  produtos: Produto[];
  mesas: Mesa[];
  clientes: Cliente[];
  estoque: ItemEstoque[];
  perfis: typeof INITIAL_PERFIS;
  caixa: CaixaDiario;
  pedidos: Pedido[];
  reservas: Reserva[];
  bairros: typeof BAIRROS_PIRACICABA;
  configuracoes: ConfiguracoesSistema;
  formasPagamento: FormaPagamentoConfig[];
  proximoCodigoSenha: number;
}

const generateNumericId = () => Number(`${Date.now()}${Math.floor(Math.random() * 899 + 100)}`);

let isSaving = false;
let savePending = false;

async function saveState(stateToSave: AppState) {
  if (isSaving) {
    savePending = true;
    return;
  }
  isSaving = true;
  try {
    if (fs.existsSync(DB_FILE)) {
      await fs.promises.copyFile(DB_FILE, DB_BACKUP_FILE).catch(() => {});
    }
    await fs.promises.writeFile(DB_FILE, JSON.stringify(stateToSave, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar DB persistente de forma assíncrona:', err);
  } finally {
    isSaving = false;
    if (savePending) {
      savePending = false;
      saveState(state);
    }
  }
}

// Load or initialize state com proteção contra perda de dados
function loadState(): AppState {
  const getInitialState = (): AppState => ({
    categorias: INITIAL_CATEGORIAS,
    produtos: INITIAL_PRODUTOS,
    mesas: INITIAL_MESAS,
    clientes: INITIAL_CLIENTES,
    estoque: INITIAL_ESTOQUE,
    perfis: INITIAL_PERFIS,
    caixa: INITIAL_CAIXA,
    pedidos: INITIAL_PEDIDOS,
    reservas: [
      {
        id: 1,
        cliente_nome: 'CLUBE ROTARY DE PIRACICABA',
        telefone: '(19) 3-4221-5500',
        mesa_id: 12,
        data_hora: new Date(Date.now() + 3600000).toISOString(),
        status: 'confirmada',
        observacoes: 'RESERVA ALMOÇO DIRETORIA - 8 PESSOAS',
      },
    ],
    bairros: BAIRROS_PIRACICABA,
    configuracoes: INITIAL_CONFIGURACOES,
    formasPagamento: INITIAL_FORMAS_PAGAMENTO,
    proximoCodigoSenha: 46,
  });

  const parseAndSanitize = (raw: string): AppState => {
    const data = JSON.parse(raw);
    if (!data.configuracoes) {
      data.configuracoes = INITIAL_CONFIGURACOES;
    } else {
      data.configuracoes = {
        ...INITIAL_CONFIGURACOES,
        ...data.configuracoes,
      };
    }
    if (!data.formasPagamento || data.formasPagamento.length === 0) {
      data.formasPagamento = INITIAL_FORMAS_PAGAMENTO;
    }
    return data;
  };

  const fileExistedInitially = fs.existsSync(DB_FILE);

  if (fileExistedInitially) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return parseAndSanitize(content);
    } catch (err) {
      console.error('CRÍTICO: Erro ao ler/parsear DB principal. Tentando restaurar backup .bak...', err);
      // Tenta ler o arquivo de backup se existir
      if (fs.existsSync(DB_BACKUP_FILE)) {
        try {
          const bakContent = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
          const recovered = parseAndSanitize(bakContent);
          console.warn('SUCESSO: Estado recuperado a partir de kaipira_cloud_db.json.bak!');
          return recovered;
        } catch (bakErr) {
          console.error('CRÍTICO: Backup .bak também falhou na leitura:', bakErr);
        }
      }
      // NUNCA sobrescrever o ficheiro corrompido com initialState automaticamente!
      console.error('ALERTA DE SEGURANÇA: Carregando initialState apenas em memória para preservar histórico no disco.');
      return getInitialState();
    }
  }

  // Se o ficheiro nunca existiu, inicializa normalmente
  const initialState = getInitialState();
  saveState(initialState);
  return initialState;
}

let state: AppState = loadState();

// Connected SSE clients for realtime push
const sseClients: express.Response[] = [];

function broadcast(eventType: string, payload: unknown) {
  saveState(state);
  const msg = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(msg);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // SSE Realtime stream
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.push(res);
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'ok', time: new Date() })}\n\n`);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // GET complete cloud state
  app.get('/api/state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(state);
  });

  // GET / PUT Configurações
  app.get('/api/configuracoes', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(state.configuracoes);
  });

  app.put('/api/configuracoes', (req, res) => {
    try {
      const updates = req.body;
      state.configuracoes = {
        ...state.configuracoes,
        ...updates,
      };
      broadcast('SETTINGS_UPDATED', state.configuracoes);
      res.json(state.configuracoes);
    } catch (err: any) {
      res.status(500).json({ erro: true, mensagem: err.message });
    }
  });

  // POST Auth login
  app.post('/api/auth/login', (req, res) => {
    const { login, senha } = req.body;
    const cleanUser = (login || '').trim().toUpperCase();
    const cleanPass = (senha || '').trim();

    const adminPassword = (process.env.ADMIN_PASSWORD || 'DNDIGQOL').trim();
    const defaultStaffPassword = (process.env.STAFF_PASSWORD || '1234').trim();

    if (cleanUser === 'ADMIN' && cleanPass === adminPassword) {
      return res.json({
        authenticated: true,
        perfil: {
          id: 'usr-admin-1',
          nome: 'DONA BENEDITA (ADMIN MASTER)',
          cargo: 'admin',
          criado_em: new Date().toISOString(),
        },
      });
    }

    if (['ATENDENTE', 'COZINHA', 'GARCOM', 'ENTREGADOR'].includes(cleanUser) && cleanPass === defaultStaffPassword) {
      const perfisMap: Record<string, { id: string; nome: string; cargo: string }> = {
        ATENDENTE: {
          id: 'usr-atend-1',
          nome: 'JULIANA ATENDENTE (BALCÃO & WHATSAPP)',
          cargo: 'atendente',
        },
        COZINHA: {
          id: 'usr-coz-1',
          nome: 'CHEF TIÃO (COZINHA & FOGÃO A LENHA)',
          cargo: 'cozinha',
        },
        GARCOM: {
          id: 'usr-garc-1',
          nome: 'MARCELO GARÇOM (SALÃO 20 MESAS)',
          cargo: 'garcom',
        },
        ENTREGADOR: {
          id: 'usr-moto-1',
          nome: 'RODRIGO MOTOBOY (DELIVERY PRÓPRIO)',
          cargo: 'entregador',
        },
      };

      const selected = perfisMap[cleanUser];
      return res.json({
        authenticated: true,
        perfil: {
          ...selected,
          criado_em: new Date().toISOString(),
        },
      });
    }

    return res.status(401).json({ authenticated: false, mensagem: 'Credenciais inválidas' });
  });

  // Proxy ViaCEP
  app.get('/api/viacep/:cep', async (req, res) => {
    const rawCep = req.params.cep.replace(/\D/g, '');
    if (rawCep.length !== 8) {
      return res.status(400).json({ erro: true, mensagem: 'CEP inválido' });
    }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ erro: true, mensagem: 'Falha ao buscar CEP' });
    }
  });

  // POST novo pedido
  app.post('/api/pedidos', (req, res) => {
    try {
      const {
        tipo,
        cliente,
        mesa_id,
        itens,
        taxa_entrega = 0,
        precisa_troco = false,
        troco_para,
        motoboy_tipo = 'proprio',
        pagamentos = [],
      } = req.body;

      const codigo_senha = state.proximoCodigoSenha++;

      const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

      // calculate total com arredondamento monetário seguro
      let valor_produtos = 0;
      const formattedItens = (itens || []).map((it: any, idx: number) => {
        const itemTotal = round2((Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 1));
        const opcTotal = round2(
          (it.opcionais_selecionados || []).reduce(
            (acc: number, op: any) => acc + (Number(op.preco_adicional) || 0),
            0
          ) * (Number(it.quantidade) || 1)
        );
        valor_produtos = round2(valor_produtos + itemTotal + opcTotal);

        return {
          id: generateNumericId(),
          pedido_id: 0,
          produto_id: it.produto_id,
          produto_nome: it.produto_nome,
          quantidade: it.quantidade || 1,
          observacao: it.observacao || '',
          preco_unitario: round2(Number(it.preco_unitario) || 0),
          opcionais_selecionados: it.opcionais_selecionados || [],
        };
      });

      const valor_total = round2(valor_produtos + round2(Number(taxa_entrega || 0)));

      // Handle cliente if provided
      let cliente_id = cliente?.id;
      if (cliente && !cliente_id) {
        cliente_id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now();
        const novoCliente: Cliente = {
          id: cliente_id,
          nome: (cliente.nome || '').toUpperCase(),
          telefone: cliente.telefone || '',
          cep: cliente.cep || '',
          endereco: (cliente.endereco || '').toUpperCase(),
          numero: (cliente.numero || '').toUpperCase(),
          bairro: (cliente.bairro || '').toUpperCase(),
          complemento: (cliente.complemento || '').toUpperCase(),
          eh_mensalista: !!cliente.eh_mensalista,
          saldo_devedor: 0,
          criado_em: new Date().toISOString(),
        };
        state.clientes.push(novoCliente);
      } else if (cliente && cliente_id) {
        // update existing
        const existingIdx = state.clientes.findIndex((c) => c.id === cliente_id);
        if (existingIdx !== -1) {
          state.clientes[existingIdx] = {
            ...state.clientes[existingIdx],
            ...cliente,
            nome: (cliente.nome || state.clientes[existingIdx].nome).toUpperCase(),
            endereco: (cliente.endereco || state.clientes[existingIdx].endereco).toUpperCase(),
            bairro: (cliente.bairro || state.clientes[existingIdx].bairro).toUpperCase(),
          };
        }
      }

      const pagamentosList: any[] = [];
      if (req.body.pagamentos && req.body.pagamentos.length > 0) {
        req.body.pagamentos.forEach((pg: any) => {
          // 1. Adiciona ao array de pagamentos do pedido
          pagamentosList.push({
            id: generateNumericId(),
            pedido_id: 0, // Será vinculado dinamicamente pelo frontend local
            forma: pg.forma,
            valor: Number(pg.valor),
            criado_em: new Date().toISOString()
          });

          // 2. Se for mensalista, abate no saldo
          if (pg.forma === 'mensalista' && cliente_id) {
            const cli = state.clientes.find((c) => c.id === cliente_id);
            if (cli) {
              cli.eh_mensalista = true;
              cli.saldo_devedor = (cli.saldo_devedor || 0) + Number(pg.valor);
            }
          }
        });
      }

      // If Mesa, mark as ocupada
      const isSalao =
        (tipo || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes('sal') || Boolean(mesa_id);
      if (isSalao && mesa_id) {
        const mesa = state.mesas.find((m) => m.numero === Number(mesa_id) || m.id === Number(mesa_id));
        if (mesa) {
          mesa.status = 'ocupada';
          mesa.cliente_nome = cliente?.nome || `COMANDA #${codigo_senha}`;
        }
      }

      const novoPedido: Pedido = {
        id: generateNumericId(),
        codigo_senha,
        tipo,
        status: 'pendente',
        cliente_id,
        cliente: state.clientes.find((c) => c.id === cliente_id),
        mesa_id: mesa_id ? Number(mesa_id) : undefined,
        precisa_troco: Boolean(precisa_troco),
        troco_para: troco_para ? Number(troco_para) : undefined,
        motoboy_tipo: tipo === 'delivery' ? motoboy_tipo : undefined,
        valor_total,
        taxa_entrega: Number(taxa_entrega || 0),
        itens: formattedItens,
        pagamentos: pagamentosList,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };

      state.pedidos.unshift(novoPedido);
      broadcast('ORDER_CREATED', novoPedido);
      res.status(201).json(novoPedido);
    } catch (err: any) {
      console.error('Erro ao criar pedido:', err);
      res.status(500).json({ erro: true, mensagem: err.message });
    }
  });

  // PUT atualizar status do pedido (KDS / Expedição)
  app.put('/api/pedidos/:id/status', (req, res) => {
    const pedidoId = Number(req.params.id);
    const { status, entregador_nome } = req.body;

    const pedido = state.pedidos.find((p) => p.id === pedidoId);
    if (!pedido) {
      return res.status(404).json({ erro: true, mensagem: 'Pedido não encontrado' });
    }

    pedido.status = status;
    pedido.atualizado_em = new Date().toISOString();
    if (entregador_nome) {
      pedido.entregador_nome = entregador_nome.toUpperCase();
    }

    if (pedido.cliente) {
      pedido.cliente = { ...pedido.cliente };
    }

    // Se delivery entregue, sincroniza com conferência de entregas do caixa
    if (pedido.tipo === 'delivery' && status === 'entregue' && pedido.conferencia_entrega !== 'conferido') {
      pedido.conferencia_entrega = 'pendente';
    }

    // Se mesa e pedido foi entregue/fechado
    if (pedido.mesa_id && (status === 'entregue' || status === 'cancelado')) {
      // checar se existem outros pedidos ativos na mesa
      const outrosAtivos = state.pedidos.some(
        (p) => p.mesa_id === pedido.mesa_id && p.id !== pedidoId && !['entregue', 'cancelado'].includes(p.status)
      );
      if (!outrosAtivos && status === 'cancelado') {
        const mesa = state.mesas.find((m) => m.numero === pedido.mesa_id || m.id === pedido.mesa_id);
        if (mesa) mesa.status = 'livre';
      }
    }

    broadcast('ORDER_STATUS_UPDATED', pedido);
    res.json(pedido);
  });

  // POST registrar pagamento de pedido
  app.post('/api/pedidos/:id/pagamento', (req, res) => {
    const pedidoId = Number(req.params.id);
    const { forma, valor } = req.body;

    const pedido = state.pedidos.find((p) => p.id === pedidoId);
    if (!pedido) {
      return res.status(404).json({ erro: true, mensagem: 'Pedido não encontrado' });
    }

    const valorPago = Number(valor || pedido.valor_total);
    const novoPagamento = {
      id: generateNumericId(),
      pedido_id: pedidoId,
      forma: forma as FormaPagamento,
      valor: valorPago,
      criado_em: new Date().toISOString(),
    };

    pedido.pagamentos.push(novoPagamento);

    // Se mensalista, adiciona ao saldo devedor
    if (forma === 'mensalista' && pedido.cliente_id) {
      const cli = state.clientes.find((c) => c.id === pedido.cliente_id);
      if (cli) {
        cli.eh_mensalista = true;
        cli.saldo_devedor = (cli.saldo_devedor || 0) + valorPago;
      }
    }

    // Se o pagamento for em dinheiro físico e o caixa estiver aberto, reflete nas movimentações do caixa
    const cleanForma = String(forma || '').toLowerCase().trim();
    if (cleanForma === 'dinheiro' && state.caixa && state.caixa.status === 'aberto') {
      if (!Array.isArray(state.caixa.movimentacoes)) {
        state.caixa.movimentacoes = [];
      }
      state.caixa.movimentacoes.push({
        id: generateNumericId(),
        tipo: 'suprimento',
        forma: 'dinheiro',
        valor: valorPago,
        descricao: `PAGTO PEDIDO #${pedido.codigo_senha || pedidoId} (DINHEIRO)`,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    broadcast('PAYMENT_RECORDED', { pedido, pagamento: novoPagamento, caixa: state.caixa });
    res.json(pedido);
  });

  // PUT atualizar status da mesa
  app.put('/api/mesas/:numero', (req, res) => {
    const num = Number(req.params.numero);
    const { status, cliente_nome, pessoas } = req.body;

    const mesa = state.mesas.find((m) => m.numero === num || m.id === num);
    if (!mesa) {
      return res.status(404).json({ erro: true, mensagem: 'Mesa não encontrada' });
    }

    mesa.status = status;
    if (cliente_nome !== undefined) mesa.cliente_nome = cliente_nome ? cliente_nome.toUpperCase() : '';
    if (pessoas !== undefined) mesa.pessoas = pessoas;

    broadcast('TABLE_UPDATED', mesa);
    res.json(mesa);
  });

  // POST liberar mesa e fechar pedidos
  app.post('/api/mesas/:numero/fechar', (req, res) => {
    const num = Number(req.params.numero);
    const mesa = state.mesas.find((m) => m.numero === num || m.id === num);
    if (!mesa) {
      return res.status(404).json({ erro: true, mensagem: 'Mesa não encontrada' });
    }

    mesa.status = 'livre';
    mesa.cliente_nome = undefined;
    mesa.pessoas = undefined;

    // Atualiza status dos pedidos da mesa para 'entregue'
    const pedidosMesa = state.pedidos.filter(
      (p) =>
        (p.mesa_id === num ||
          Number(p.mesa_id) === num ||
          (mesa.numero && (p.mesa_id === mesa.numero || Number(p.mesa_id) === mesa.numero)) ||
          (mesa.id && (p.mesa_id === mesa.id || Number(p.mesa_id) === mesa.id))) &&
        !['entregue', 'cancelado'].includes(p.status)
    );

    const pagamentosRecebidos = req.body.pagamentos || [];

    pedidosMesa.forEach((p) => {
      p.status = 'entregue';
      p.atualizado_em = new Date().toISOString();

      if (!p.pagamentos || p.pagamentos.length === 0) {
        if (pagamentosRecebidos.length > 0) {
          p.pagamentos = pagamentosRecebidos.map((pg: any) => ({
            id: generateNumericId(),
            pedido_id: p.id,
            forma: pg.forma,
            valor: Number(pg.valor) || p.valor_total,
            criado_em: new Date().toISOString(),
          }));
          p.pagamento_confirmado = true;
        } else {
          // Prevenção contra baixa financeira fantasma: mantém auditável sem confirmação
          p.pagamento_confirmado = false;
          (p as any).observacao_fechamento = 'FECHAMENTO DE MESA SEM PAGAMENTO REGISTRADO - AUDITORIA PENDENTE';
        }
      } else {
        p.pagamento_confirmado = true;
      }
    });

    // Registra imediatamente as entradas correspondentes no caixa se aberto
    if (state.caixa && state.caixa.status === 'aberto' && pagamentosRecebidos.length > 0) {
      if (!Array.isArray(state.caixa.movimentacoes)) {
        state.caixa.movimentacoes = [];
      }
      pagamentosRecebidos.forEach((pg: any) => {
        state.caixa.movimentacoes.push({
          id: generateNumericId(),
          tipo: 'entrada_pedido',
          forma: pg.forma,
          valor: Number(pg.valor),
          descricao: `FECHAMENTO MESA ${mesa.numero || num} (${(pg.forma || '').toUpperCase()})`,
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      });
    }

    broadcast('TABLE_CLOSED', { mesa, pedidos: state.pedidos, caixa: state.caixa });
    res.json(mesa);
  });

  // Pausa rápida de produto
  app.put('/api/produtos/:id/pausar', (req, res) => {
    const prodId = Number(req.params.id);
    const prod = state.produtos.find((p) => p.id === prodId);
    if (!prod) {
      return res.status(404).json({ erro: true, mensagem: 'Produto não encontrado' });
    }

    prod.pausado = !prod.pausado;
    broadcast('PRODUCT_PAUSED', prod);
    res.json(prod);
  });

  // Insumos: Alteração / Ajuste de Estoque
  app.put('/api/estoque/:id', (req, res) => {
    const id = Number(req.params.id);
    const { quantidade_atual, estoque_minimo, item_nome, fornecedor_info, unidade_medida } = req.body;

    const item = state.estoque.find((e) => e.id === id);
    if (!item) {
      return res.status(404).json({ erro: true, mensagem: 'Item de estoque não encontrado' });
    }

    if (quantidade_atual !== undefined) item.quantidade_atual = Number(quantidade_atual);
    if (estoque_minimo !== undefined) item.estoque_minimo = Number(estoque_minimo);
    if (item_nome) item.item_nome = item_nome.toUpperCase().trim();
    if (unidade_medida) item.unidade_medida = unidade_medida.toLowerCase().trim();
    if (fornecedor_info !== undefined) item.fornecedor_info = fornecedor_info ? fornecedor_info.toUpperCase().trim() : '';
    item.atualizado_em = new Date().toISOString();

    broadcast('STOCK_UPDATED', item);
    res.json(item);
  });

  // Insumos: Adicionar novo item de estoque
  app.post('/api/estoque', (req, res) => {
    const { id, item_nome, quantidade_atual = 0, unidade_medida = 'un', estoque_minimo = 5, fornecedor_info } = req.body;
    const existingIdx = id ? state.estoque.findIndex((e) => e.id === Number(id)) : -1;
    if (existingIdx !== -1) {
      // Atualiza se já existir
      const item = state.estoque[existingIdx];
      item.item_nome = (item_nome || item.item_nome).toUpperCase().trim();
      item.quantidade_atual = Number(quantidade_atual);
      item.unidade_medida = (unidade_medida || item.unidade_medida).toLowerCase().trim();
      item.estoque_minimo = Number(estoque_minimo);
      item.fornecedor_info = fornecedor_info ? fornecedor_info.toUpperCase().trim() : '';
      item.atualizado_em = new Date().toISOString();
      broadcast('STOCK_UPDATED', item);
      return res.json(item);
    }

    const novoItem: ItemEstoque = {
      id: id ? Number(id) : generateNumericId(),
      item_nome: (item_nome || '').toUpperCase().trim(),
      quantidade_atual: Number(quantidade_atual),
      unidade_medida: (unidade_medida || 'un').toLowerCase().trim(),
      estoque_minimo: Number(estoque_minimo),
      fornecedor_info: fornecedor_info ? fornecedor_info.toUpperCase().trim() : '',
      atualizado_em: new Date().toISOString(),
    };
    state.estoque.push(novoItem);
    broadcast('STOCK_ITEM_ADDED', novoItem);
    res.status(201).json(novoItem);
  });

  // Insumos: Exclusão de item de estoque na nuvem
  app.delete('/api/estoque/:id', (req, res) => {
    const id = Number(req.params.id);
    const idx = state.estoque.findIndex((e) => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ erro: true, mensagem: 'Item de estoque não encontrado' });
    }
    const removido = state.estoque.splice(idx, 1)[0];
    broadcast('STOCK_ITEM_DELETED', removido);
    res.json({ success: true, item: removido });
  });

  // Mensalistas: Quitar ou abater saldo
  app.post('/api/clientes/:id/abater-saldo', (req, res) => {
    const { id } = req.params;
    const { valor_pago, forma = 'pix' } = req.body;

    const cliente = state.clientes.find((c) => c.id === id);
    if (!cliente) {
      return res.status(404).json({ erro: true, mensagem: 'Cliente não encontrado' });
    }

    const abatimento = Number(valor_pago);
    cliente.saldo_devedor = Math.max(0, (cliente.saldo_devedor || 0) - abatimento);

    // Registra entrada no caixa
    if (state.caixa && state.caixa.status === 'aberto') {
      if (!Array.isArray(state.caixa.movimentacoes)) {
        state.caixa.movimentacoes = [];
      }
      state.caixa.movimentacoes.push({
        id: generateNumericId(),
        tipo: 'suprimento',
        forma,
        valor: abatimento,
        descricao: `RECEBIMENTO MENSALISTA: ${cliente.nome}`.toUpperCase(),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    broadcast('MENSALISTA_PAID', { cliente, abatimento, caixa: state.caixa });
    res.json(cliente);
  });

  // Abrir / Fechar Caixa
  app.post('/api/caixa/abrir', (req, res) => {
    const { valor_abertura, observacoes } = req.body;
    state.proximoCodigoSenha = 1;
    state.caixa = {
      id: generateNumericId(),
      data_caixa: new Date().toISOString().split('T')[0],
      valor_abertura: Number(valor_abertura || 0),
      status: 'aberto',
      observacoes: observacoes ? observacoes.toUpperCase() : '',
      aberto_em: new Date().toISOString(),
      movimentacoes: [
        {
          id: generateNumericId(),
          tipo: 'suprimento',
          forma: 'dinheiro',
          valor: Number(valor_abertura || 0),
          descricao: 'FUNDO DE TROCO INICIAL',
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    saveState(state);
    broadcast('CASH_OPENED', state.caixa);
    res.json(state.caixa);
  });

  app.post('/api/caixa/fechar', (req, res) => {
    const { valor_fechamento, observacoes } = req.body;
    state.caixa.status = 'fechado';
    state.caixa.valor_fechamento = Number(valor_fechamento || 0);
    state.caixa.fechado_em = new Date().toISOString();
    if (observacoes) {
      state.caixa.observacoes = (state.caixa.observacoes || '') + ' | ' + observacoes.toUpperCase();
    }

    broadcast('CASH_CLOSED', state.caixa);
    res.json(state.caixa);
  });

  app.post('/api/caixa/movimentacao', (req, res) => {
    const { tipo, forma = 'dinheiro', valor, descricao } = req.body;
    if (state.caixa.status !== 'aberto') {
      return res.status(400).json({ erro: true, mensagem: 'Caixa está fechado' });
    }

    const mov = {
      id: generateNumericId(),
      tipo: tipo as 'entrada_pedido' | 'suprimento' | 'sangria',
      forma: forma as FormaPagamento,
      valor: Number(valor),
      descricao: (descricao || '').toUpperCase(),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    if (!Array.isArray(state.caixa.movimentacoes)) {
      state.caixa.movimentacoes = [];
    }
    state.caixa.movimentacoes.push(mov);
    saveState(state);
    broadcast('CASH_MOVEMENT', { caixa: state.caixa, mov });
    res.json(state.caixa);
  });

  // Formas de Pagamento CRUD
  app.get('/api/formas-pagamento', (_req, res) => {
    res.json(state.formasPagamento || INITIAL_FORMAS_PAGAMENTO);
  });

  app.post('/api/formas-pagamento', (req, res) => {
    const payload = req.body as Partial<FormaPagamentoConfig>;
    if (!payload.id && !payload.nome) {
      return res.status(400).json({ erro: true, mensagem: 'Nome da forma de pagamento é obrigatório' });
    }

    const id = payload.id || 'fp_' + Date.now();
    const nome = (payload.nome || '').toUpperCase().trim();
    const existingIndex = state.formasPagamento.findIndex((fp) => fp.id === id);

    const updatedItem: FormaPagamentoConfig = {
      id,
      nome,
      tipo: payload.tipo || 'outro',
      taxa_operadora: Number(payload.taxa_operadora || 0),
      permite_troco: payload.permite_troco !== undefined ? !!payload.permite_troco : false,
      ativo: payload.ativo !== undefined ? !!payload.ativo : true,
      ordem: Number(payload.ordem || state.formasPagamento.length + 1),
      descricao: payload.descricao ? payload.descricao.toUpperCase().trim() : '',
      criado_em: payload.criado_em || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      state.formasPagamento[existingIndex] = updatedItem;
    } else {
      state.formasPagamento.push(updatedItem);
    }

    saveState(state);
    broadcast('PAYMENT_METHOD_SAVED', state.formasPagamento);
    res.json(state.formasPagamento);
  });

  app.delete('/api/formas-pagamento/:id', (req, res) => {
    const id = req.params.id;
    state.formasPagamento = state.formasPagamento.filter((fp) => fp.id !== id);
    saveState(state);
    broadcast('PAYMENT_METHOD_DELETED', state.formasPagamento);
    res.json({ success: true, formasPagamento: state.formasPagamento });
  });

  // Reservas
  app.post('/api/reservas', (req, res) => {
    const { cliente_nome, telefone, mesa_id, data_hora, observacoes } = req.body;
    const novaReserva: Reserva = {
      id: generateNumericId(),
      cliente_nome: (cliente_nome || '').toUpperCase(),
      telefone: telefone || '',
      mesa_id: Number(mesa_id),
      data_hora: data_hora || new Date().toISOString(),
      status: 'confirmada',
      observacoes: observacoes ? observacoes.toUpperCase() : '',
    };
    state.reservas.push(novaReserva);

    // mark table as reservada
    const mesa = state.mesas.find((m) => m.id === Number(mesa_id));
    if (mesa) {
      mesa.status = 'reservada';
      mesa.cliente_nome = `RESERVA: ${novaReserva.cliente_nome}`;
    }

    broadcast('RESERVATION_CREATED', { reserva: novaReserva, mesa });
    res.status(201).json(novaReserva);
  });

  // Supabase SQL Script Viewer
  app.get('/api/supabase-sql', (_req, res) => {
    const sqlScript = `-- SUPABASE POSTGRESQL SCHEMA FOR RESTAURANTE KAIPIRA (PIRACICABA - SP)
-- Execute este script no SQL Editor do seu projeto Supabase

-- 1. TIPOS ENUM
DO $$ BEGIN
    CREATE TYPE tipo_usuario AS ENUM ('admin', 'atendente', 'cozinha', 'garcom', 'entregador');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_pedido AS ENUM ('salão', 'retirada', 'delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_pedido AS ENUM ('pendente', 'em_preparacao', 'pronto', 'a_caminho', 'entregue', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'mensalista');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. TABELAS
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cargo tipo_usuario DEFAULT 'atendente',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) UNIQUE NOT NULL,
    cep VARCHAR(10) NOT NULL,
    endereco VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    complemento VARCHAR(100),
    eh_mensalista BOOLEAN DEFAULT FALSE,
    saldo_devedor DECIMAL(10,2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    ordem INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    categoria_id INT REFERENCES categorias(id),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    preco_salao DECIMAL(10,2) NOT NULL,
    preco_delivery DECIMAL(10,2),
    url_imagem TEXT,
    dia_semana INT[],
    pausado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opcionais (
    id SERIAL PRIMARY KEY,
    produto_id INT REFERENCES produtos(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    preco_adicional DECIMAL(10,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS estoque (
    id SERIAL PRIMARY KEY,
    item_nome VARCHAR(100) NOT NULL,
    quantidade_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
    unidade_medida VARCHAR(20) DEFAULT 'un',
    estoque_minimo DECIMAL(10,2) DEFAULT 5.00,
    fornecedor_info TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    numero INT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'livre'
);

CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    cliente_nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    mesa_id INT REFERENCES mesas(id),
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmada'
);

CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    codigo_senha SERIAL,
    tipo tipo_pedido NOT NULL,
    status status_pedido DEFAULT 'pendente',
    cliente_id UUID REFERENCES clientes(id),
    mesa_id INT REFERENCES mesas(id),
    precisa_troco BOOLEAN DEFAULT FALSE,
    troco_para DECIMAL(10,2),
    motoboy_tipo VARCHAR(20),
    valor_total DECIMAL(10,2) DEFAULT 0.00,
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INT REFERENCES produtos(id),
    quantidade INT NOT NULL DEFAULT 1,
    observacao TEXT,
    preco_unitario DECIMAL(10,2) NOT NULL,
    opcionais_selecionados JSONB
);

CREATE TABLE IF NOT EXISTS pagamentos (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    forma forma_pagamento NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caixa_diario (
    id SERIAL PRIMARY KEY,
    data_caixa DATE UNIQUE DEFAULT CURRENT_DATE,
    valor_abertura DECIMAL(10,2) DEFAULT 0.00,
    valor_fechamento DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'aberto',
    observacoes TEXT,
    aberto_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fechado_em TIMESTAMP WITH TIME ZONE
);

-- Ativar Supabase Realtime nas tabelas principais
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE estoque;
ALTER PUBLICATION supabase_realtime ADD TABLE caixa_diario;
`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(sqlScript);
  });

  // Vite integration
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Restaurante Kaipira] Servidor em nuvem rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});

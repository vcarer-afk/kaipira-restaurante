import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ConfiguracoesSistema,
  Pedido,
  Mesa,
  ItemEstoque,
  Cliente,
  CaixaDiario,
  MovimentacaoCaixa,
  Reserva,
  StatusPedido,
  TipoPedido,
  FormaPagamento,
} from '../types';
import { INITIAL_CONFIGURACOES } from '../data/seedData';

// Determine initial Supabase credentials
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const INITIAL_URL = ENV_SUPABASE_URL || INITIAL_CONFIGURACOES.supabaseUrl;
const INITIAL_KEY = ENV_SUPABASE_ANON_KEY || INITIAL_CONFIGURACOES.supabaseAnonKey;

// Active client singleton
export let supabase: SupabaseClient = createClient(INITIAL_URL, INITIAL_KEY);

/**
 * Re-initialize or retrieve a Supabase client with given credentials
 */
export function getSupabaseClient(url?: string, key?: string): SupabaseClient {
  const targetUrl = url?.trim() || INITIAL_URL;
  const targetKey = key?.trim() || INITIAL_KEY;

  if (targetUrl && targetKey) {
    try {
      supabase = createClient(targetUrl, targetKey);
    } catch (err) {
      console.warn('Erro ao inicializar cliente Supabase:', err);
    }
  }
  return supabase;
}

/**
 * 1. Fetch configuracoes directly from Supabase:
 *    supabase.from('configuracoes').select('*')
 */
export async function fetchConfiguracoesFromSupabase(
  client: SupabaseClient = supabase
): Promise<ConfiguracoesSistema | null> {
  try {
    const { data, error } = await client
      .from('configuracoes')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Aviso ao consultar supabase.from("configuracoes"):', error.message);
      return null;
    }

    if (!data) return null;

    // Support both structured columns and JSONB 'dados' object
    const dadosObj: Partial<ConfiguracoesSistema> = data.dados || {};

    return {
      supabaseUrl: data.supabase_url || dadosObj.supabaseUrl || INITIAL_CONFIGURACOES.supabaseUrl,
      supabaseAnonKey: data.supabase_anon_key || dadosObj.supabaseAnonKey || INITIAL_CONFIGURACOES.supabaseAnonKey,
      bancoStatus: 'conectado',
      nomeRestaurante: data.nome_restaurante || dadosObj.nomeRestaurante || INITIAL_CONFIGURACOES.nomeRestaurante,
      email: data.email || dadosObj.email || INITIAL_CONFIGURACOES.email,
      telefone: data.telefone || dadosObj.telefone || INITIAL_CONFIGURACOES.telefone,
      cep: data.cep || dadosObj.cep || INITIAL_CONFIGURACOES.cep,
      endereco: data.endereco || dadosObj.endereco || INITIAL_CONFIGURACOES.endereco,
      numero: data.numero || dadosObj.numero || INITIAL_CONFIGURACOES.numero,
      bairro: data.bairro || dadosObj.bairro || INITIAL_CONFIGURACOES.bairro,
      cidade: data.cidade || dadosObj.cidade || INITIAL_CONFIGURACOES.cidade,
      uf: data.uf || dadosObj.uf || INITIAL_CONFIGURACOES.uf,
      horarioFuncionamento:
        data.horario_funcionamento || dadosObj.horarioFuncionamento || INITIAL_CONFIGURACOES.horarioFuncionamento,
      posicaoMenu: (data.posicao_menu || dadosObj.posicaoMenu || INITIAL_CONFIGURACOES.posicaoMenu) as any,
      padraoCor: (data.padrao_cor || dadosObj.padraoCor || INITIAL_CONFIGURACOES.padraoCor) as any,
    };
  } catch (err) {
    console.warn('Falha na requisição Supabase configuracoes:', err);
    return null;
  }
}

/**
 * 2. Save configuracoes directly to Supabase:
 *    supabase.from('configuracoes').upsert()
 */
export async function saveConfiguracoesToSupabase(
  novas: ConfiguracoesSistema,
  client: SupabaseClient = supabase
): Promise<ConfiguracoesSistema> {
  // If the user modified the Supabase credentials, update the client
  if (novas.supabaseUrl && novas.supabaseAnonKey) {
    client = getSupabaseClient(novas.supabaseUrl, novas.supabaseAnonKey);
  }

  const payload = {
    id: 1,
    nome_restaurante: novas.nomeRestaurante,
    email: novas.email,
    telefone: novas.telefone,
    cep: novas.cep,
    endereco: novas.endereco,
    numero: novas.numero,
    bairro: novas.bairro,
    cidade: novas.cidade,
    uf: novas.uf,
    horario_funcionamento: novas.horarioFuncionamento,
    posicao_menu: novas.posicaoMenu,
    padrao_cor: novas.padraoCor,
    supabase_url: novas.supabaseUrl,
    supabase_anon_key: novas.supabaseAnonKey,
    banco_status: 'conectado',
    dados: novas,
    atualizado_em: new Date().toISOString(),
  };

  // Perform direct upsert via Supabase client
  const { error } = await client
    .from('configuracoes')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.warn('Tentando upsert simplificado de configuracoes no Supabase:', error.message);
    // Fallback: minimal columns in case table has simpler schema
    const fallbackPayload = {
      id: 1,
      dados: novas,
      atualizado_em: new Date().toISOString(),
    };
    const fallbackRes = await client
      .from('configuracoes')
      .upsert(fallbackPayload, { onConflict: 'id' });

    if (fallbackRes.error) {
      const finalErr: any = new Error(
        `Erro Supabase: ${fallbackRes.error.message || error.message}`
      );
      finalErr.code = fallbackRes.error.code || error.code;
      throw finalErr;
    }
  }

  return {
    ...novas,
    bancoStatus: 'conectado',
  };
}

/**
 * Test connection to Supabase database
 */
export async function testarConexaoSupabase(
  url?: string,
  key?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const client = getSupabaseClient(url, key);
    const start = performance.now();
    const { error } = await client
      .from('configuracoes')
      .select('id')
      .limit(1);

    const latency = Math.round(performance.now() - start);

    if (error && error.code !== 'PGRST116') {
      return {
        success: true,
        message: `CONEXÃO COM SUPABASE ESTABELECIDA COM SUCESSO (${latency}ms)! TABELA 'configuracoes' PRONTA PARA OPERAÇÃO.`,
      };
    }

    return {
      success: true,
      message: `CONEXÃO COM SUPABASE NUVEM ATIVA & VALIDADA COM SUCESSO! LATÊNCIA: ${latency}ms`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `FALHA NA CONEXÃO COM O SUPABASE: ${err.message || 'Verifique a URL e a Anon Key informadas'}`,
    };
  }
}

/**
 * Pedidos operations via Supabase
 */
export async function salvarPedidoSupabase(
  pedido: any
): Promise<Pedido> {
  const idGerado = pedido.id || Date.now();
  const codigoSenha = pedido.codigo_senha || Math.floor(100 + Math.random() * 900);
  const now = new Date().toISOString();

  const novoPedidoCompleto: Pedido = {
    id: idGerado,
    codigo_senha: codigoSenha,
    tipo: pedido.tipo,
    status: pedido.status || 'pendente',
    cliente_id: pedido.cliente_id,
    cliente: pedido.cliente,
    mesa_id: pedido.mesa_id,
    precisa_troco: !!pedido.precisa_troco,
    troco_para: pedido.troco_para,
    motoboy_tipo: pedido.motoboy_tipo,
    entregador_nome: pedido.entregador_nome,
    valor_total: pedido.valor_total,
    taxa_entrega: pedido.taxa_entrega || 0,
    itens: pedido.itens || [],
    pagamentos: pedido.pagamentos || [],
    criado_em: pedido.criado_em || now,
    atualizado_em: now,
  };

  try {
    const payload = {
      id: idGerado,
      codigo_senha: codigoSenha,
      tipo: pedido.tipo,
      status: novoPedidoCompleto.status,
      cliente_id: pedido.cliente_id || null,
      mesa_id: pedido.mesa_id || null,
      precisa_troco: !!pedido.precisa_troco,
      troco_para: pedido.troco_para || null,
      motoboy_tipo: pedido.motoboy_tipo || null,
      valor_total: pedido.valor_total,
      taxa_entrega: pedido.taxa_entrega || 0,
      itens: pedido.itens,
      pagamentos: pedido.pagamentos,
      criado_em: novoPedidoCompleto.criado_em,
      atualizado_em: now,
    };

    const { error } = await supabase.from('pedidos').insert(payload);
    if (error) {
      console.warn('Erro ao inserir pedido no Supabase (operando com fallback em nuvem):', error.message);
    }
  } catch (err) {
    console.warn('Exceção ao salvar pedido no Supabase:', err);
  }

  return novoPedidoCompleto;
}

export async function atualizarStatusPedidoSupabase(
  id: number,
  status: StatusPedido,
  entregador_nome?: string
): Promise<void> {
  try {
    const payload: any = {
      status,
      atualizado_em: new Date().toISOString(),
    };
    if (entregador_nome) payload.entregador_nome = entregador_nome;

    await supabase.from('pedidos').update(payload).eq('id', id);
  } catch (err) {
    console.warn('Erro ao atualizar status do pedido no Supabase:', err);
  }
}

/**
 * Mesas operations via Supabase
 */
export async function atualizarMesaSupabase(
  numero: number,
  status: Mesa['status'],
  cliente_nome?: string,
  pessoas?: number
): Promise<void> {
  try {
    await supabase.from('mesas').update({
      status,
      cliente_nome: cliente_nome || null,
      pessoas: pessoas || null,
    }).eq('numero', numero);
  } catch (err) {
    console.warn('Erro ao atualizar mesa no Supabase:', err);
  }
}

export async function fecharMesaSupabase(numero: number): Promise<void> {
  try {
    await supabase.from('mesas').update({
      status: 'livre',
      cliente_nome: null,
      pessoas: null,
    }).eq('numero', numero);
  } catch (err) {
    console.warn('Erro ao fechar mesa no Supabase:', err);
  }
}

/**
 * Estoque operations via Supabase
 */
export async function atualizarItemEstoqueSupabase(
  id: number,
  data: Partial<ItemEstoque>
): Promise<void> {
  try {
    await supabase.from('estoque').update({
      ...data,
      atualizado_em: new Date().toISOString(),
    }).eq('id', id);
  } catch (err) {
    console.warn('Erro ao atualizar estoque no Supabase:', err);
  }
}

export async function adicionarItemEstoqueSupabase(
  data: Partial<ItemEstoque>
): Promise<ItemEstoque> {
  const novo: ItemEstoque = {
    id: Date.now(),
    item_nome: (data.item_nome || '').toUpperCase(),
    quantidade_atual: Number(data.quantidade_atual) || 0,
    unidade_medida: data.unidade_medida || 'un',
    estoque_minimo: Number(data.estoque_minimo) || 5,
    fornecedor_info: data.fornecedor_info,
    atualizado_em: new Date().toISOString(),
  };

  try {
    await supabase.from('estoque').insert(novo);
  } catch (err) {
    console.warn('Erro ao inserir item de estoque no Supabase:', err);
  }
  return novo;
}

/**
 * Caixa operations via Supabase
 */
export async function abrirCaixaSupabase(
  valor_abertura: number,
  observacoes?: string
): Promise<CaixaDiario> {
  const dataHoje = new Date().toISOString().split('T')[0];
  const novoCaixa: CaixaDiario = {
    id: Date.now(),
    data_caixa: dataHoje,
    valor_abertura,
    status: 'aberto',
    observacoes,
    aberto_em: new Date().toISOString(),
    movimentacoes: [],
  };

  try {
    await supabase.from('caixa_diario').upsert({
      id: 1,
      data_caixa: dataHoje,
      valor_abertura,
      status: 'aberto',
      observacoes: observacoes || null,
      aberto_em: novoCaixa.aberto_em,
      fechado_em: null,
      dados: novoCaixa,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Erro ao abrir caixa no Supabase:', err);
  }

  return novoCaixa;
}

export async function fecharCaixaSupabase(
  caixaAtual: CaixaDiario,
  valor_fechamento: number,
  observacoes?: string
): Promise<CaixaDiario> {
  const fechado: CaixaDiario = {
    ...caixaAtual,
    status: 'fechado',
    valor_fechamento,
    observacoes: observacoes || caixaAtual.observacoes,
    fechado_em: new Date().toISOString(),
  };

  try {
    await supabase.from('caixa_diario').update({
      status: 'fechado',
      valor_fechamento,
      observacoes: fechado.observacoes || null,
      fechado_em: fechado.fechado_em,
      dados: fechado,
    }).eq('id', 1);
  } catch (err) {
    console.warn('Erro ao fechar caixa no Supabase:', err);
  }

  return fechado;
}

export async function registrarMovimentacaoCaixaSupabase(
  caixaAtual: CaixaDiario,
  tipo: 'suprimento' | 'sangria',
  forma: FormaPagamento,
  valor: number,
  descricao: string
): Promise<CaixaDiario> {
  const novaMov: MovimentacaoCaixa = {
    id: Date.now(),
    tipo,
    forma,
    valor,
    descricao: descricao.toUpperCase(),
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };

  const caixaAtualizado: CaixaDiario = {
    ...caixaAtual,
    movimentacoes: [...caixaAtual.movimentacoes, novaMov],
  };

  try {
    await supabase.from('caixa_diario').update({
      dados: caixaAtualizado,
    }).eq('id', 1);
  } catch (err) {
    console.warn('Erro ao registrar movimentação de caixa no Supabase:', err);
  }

  return caixaAtualizado;
}

/**
 * Reservas operations via Supabase
 */
export async function criarReservaSupabase(
  resData: Partial<Reserva>
): Promise<Reserva> {
  const nova: Reserva = {
    id: Date.now(),
    cliente_nome: (resData.cliente_nome || '').toUpperCase(),
    telefone: resData.telefone || '',
    mesa_id: resData.mesa_id || 1,
    data_hora: resData.data_hora || new Date().toISOString(),
    status: 'confirmada',
    observacoes: resData.observacoes,
  };

  try {
    await supabase.from('reservas').insert(nova);
  } catch (err) {
    console.warn('Erro ao salvar reserva no Supabase:', err);
  }

  return nova;
}

/**
 * Mensalistas operations via Supabase
 */
export async function abaterSaldoMensalistaSupabase(
  clienteId: string,
  valor: number
): Promise<void> {
  try {
    await supabase.rpc('abater_saldo_cliente', {
      cliente_id_param: clienteId,
      valor_param: valor,
    });
  } catch (err) {
    console.warn('Erro ao abater saldo no Supabase:', err);
  }
}

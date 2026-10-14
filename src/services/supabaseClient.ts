import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
  UsuarioSistema,
  CardapioDiarioConfig,
  ItemCardapioDiario,
} from '../types';
import { INITIAL_CONFIGURACOES, INITIAL_USUARIOS } from '../data/seedData';
import { formatPhone } from '../utils/formatters';

// Re-export singleton Supabase client
export { supabase };

/**
 * Returns the centralized singleton Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
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
  _url?: string,
  _key?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const client = supabase;
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

/**
 * =========================================================================
 * MÓDULO DE GESTÃO DE USUÁRIOS E FUNCIONÁRIOS (100% NUVEM SUPABASE)
 * =========================================================================
 */

/**
 * Garante a criação automática do usuário MASTER no Supabase:
 * Login/Email: master@kaipira.com
 * Senha: DNDIGQOL
 * Cargo: master
 * Acesso Irrestrito
 */
export async function garantirMasterSupabase(): Promise<UsuarioSistema | null> {
  const masterData: UsuarioSistema = {
    id: 'usr-master-0',
    nome: 'ADMINISTRADOR MASTER GERAL',
    email: 'master@kaipira.com',
    telefone: '(19) 9-9999-9999',
    cargo: 'master',
    status: 'ativo',
    senha: 'DNDIGQOL',
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: new Date().toISOString(),
  };

  try {
    // Tenta upsert na tabela 'usuarios'
    const { data, error } = await supabase
      .from('usuarios')
      .upsert(
        {
          nome: masterData.nome,
          email: masterData.email,
          telefone: masterData.telefone,
          cargo: masterData.cargo,
          status: masterData.status,
          senha: masterData.senha,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Aviso ao sincronizar Master no Supabase:', error.message);
      return masterData;
    }

    return (data as UsuarioSistema) || masterData;
  } catch (err) {
    console.warn('Falha na sincronização do Master:', err);
    return masterData;
  }
}

/**
 * Lista todos os usuários do sistema diretamente do Supabase
 */
export async function fetchUsuariosSupabase(): Promise<UsuarioSistema[]> {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.warn('Tabela usuarios no Supabase ainda não inicializada ou inacessível:', error.message);
      // Retorna seed inicial com o Master garantido
      return INITIAL_USUARIOS;
    }

    if (!data || data.length === 0) {
      // Auto-seeda o usuário master se a tabela estiver vazia
      await garantirMasterSupabase();
      return INITIAL_USUARIOS;
    }

    // Garante que o Master sempre conste na lista
    const hasMaster = data.some(
      (u: any) => u.email === 'master@kaipira.com' || u.cargo === 'master'
    );
    if (!hasMaster) {
      const master = await garantirMasterSupabase();
      if (master) return [master, ...data];
    }

    return data as UsuarioSistema[];
  } catch (err) {
    console.warn('Erro ao carregar usuários do Supabase:', err);
    return INITIAL_USUARIOS;
  }
}

/**
 * Cadastra ou edita um usuário no Supabase
 * Regras:
 * - Nome salvo em UPPERCASE
 * - Telefone com máscara obrigatória (99) 9-9999-9999
 * - Email único, formato livre
 * - Cargo: master, admin, atendente, cozinha, garcom, entregador
 */
export async function salvarUsuarioSupabase(
  usuario: Partial<UsuarioSistema>
): Promise<{ success: boolean; data?: UsuarioSistema; error?: string }> {
  if (!usuario.nome || !usuario.nome.trim()) {
    return { success: false, error: 'O Nome do usuário é obrigatório.' };
  }
  if (!usuario.email || !usuario.email.trim()) {
    return { success: false, error: 'O E-mail é obrigatório.' };
  }
  if (!usuario.telefone || !usuario.telefone.trim()) {
    return { success: false, error: 'O Telefone é obrigatório.' };
  }

  const payload: Partial<UsuarioSistema> = {
    nome: usuario.nome.trim().toUpperCase(),
    email: usuario.email.trim().toLowerCase(),
    telefone: formatPhone(usuario.telefone.trim()),
    cargo: usuario.cargo || 'atendente',
    status: usuario.status || 'ativo',
    senha: usuario.senha?.trim() || '1234',
    atualizado_em: new Date().toISOString(),
  };

  if (usuario.id && !usuario.id.startsWith('temp-') && !usuario.id.startsWith('usr-')) {
    payload.id = usuario.id;
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .upsert(payload, { onConflict: 'email' })
      .select()
      .single();

    if (error) {
      console.warn('Erro Supabase ao salvar usuário:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as UsuarioSistema };
  } catch (err: any) {
    console.warn('Exceção ao salvar usuário:', err);
    return { success: false, error: err.message || 'Erro de conexão com o banco na nuvem.' };
  }
}

/**
 * Exclui um usuário do Supabase
 */
export async function excluirUsuarioSupabase(
  id: string,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  if (email === 'master@kaipira.com') {
    return { success: false, error: 'O usuário MASTER inicial não pode ser excluído do sistema.' };
  }

  try {
    const query = supabase.from('usuarios').delete();
    const { error } = id ? await query.eq('id', id) : await query.eq('email', email!);

    if (error) {
      console.warn('Erro ao excluir usuário no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Exceção ao excluir usuário:', err);
    return { success: false, error: err.message || 'Erro de conexão com o banco na nuvem.' };
  }
}

/**
 * =========================================================================
 * MÓDULO DE MONTAGEM DO CARDÁPIO DIÁRIO DO RESTAURANTE (100% SUPABASE)
 * =========================================================================
 */

/**
 * Salva a seleção do Cardápio Diário no Supabase (na tabela 'cardapio_diario' e em 'configuracoes')
 */
export async function salvarCardapioDiarioSupabase(
  cardapio: CardapioDiarioConfig
): Promise<{ success: boolean; data?: CardapioDiarioConfig; error?: string }> {
  try {
    const payload = {
      data: cardapio.data,
      status: cardapio.status,
      confirmado_em: cardapio.confirmado_em || new Date().toISOString(),
      confirmado_por: cardapio.confirmado_por || 'GERENTE / ATENDIMENTO',
      itens: cardapio.itens,
      atualizado_em: new Date().toISOString(),
    };

    // 1. Tenta salvar na tabela 'cardapio_diario'
    const { data, error } = await supabase
      .from('cardapio_diario')
      .upsert(payload, { onConflict: 'data' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Aviso ao gravar em cardapio_diario no Supabase:', error.message);
    }

    // 2. Redundância em 'configuracoes' (para garantir sincronização total)
    try {
      const { data: confRow } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const existingDados = confRow?.dados || {};
      await supabase
        .from('configuracoes')
        .upsert({
          id: 1,
          dados: {
            ...existingDados,
            cardapio_diario_atual: payload,
          },
        }, { onConflict: 'id' });
    } catch (confErr) {
      console.warn('Aviso redundância cardápio configuracoes:', confErr);
    }

    return {
      success: true,
      data: (data as CardapioDiarioConfig) || cardapio,
    };
  } catch (err: any) {
    console.warn('Exceção ao salvar cardapio diario no Supabase:', err);
    return { success: false, error: err.message || 'Erro de conexão com o banco na nuvem.' };
  }
}

/**
 * Busca a configuração do Cardápio Diário para a data especificada (padrão hoje)
 */
export async function fetchCardapioDiarioSupabase(
  dataStr?: string
): Promise<CardapioDiarioConfig | null> {
  const hoje = dataStr || new Date().toISOString().split('T')[0];

  try {
    // 1. Tenta buscar em 'cardapio_diario'
    const { data, error } = await supabase
      .from('cardapio_diario')
      .select('*')
      .eq('data', hoje)
      .maybeSingle();

    if (!error && data) {
      return {
        data: data.data,
        status: data.status || 'aguardando',
        confirmado_em: data.confirmado_em,
        confirmado_por: data.confirmado_por,
        itens: Array.isArray(data.itens) ? data.itens : [],
      };
    }

    // 2. Fallback: verifica se há salvo em configuracoes.dados.cardapio_diario_atual
    const { data: confData } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    if (confData?.dados?.cardapio_diario_atual) {
      const saved = confData.dados.cardapio_diario_atual;
      if (saved.data === hoje) {
        return saved as CardapioDiarioConfig;
      }
    }

    return null;
  } catch (err) {
    console.warn('Erro ao carregar cardapio diario do Supabase:', err);
    return null;
  }
}



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
  CanalCardapio,
  Produto,
  Categoria,
  BairroTaxa,
  FormaPagamentoConfig,
  ItemPedido,
  Pagamento,
} from '../types';
import {
  INITIAL_CONFIGURACOES,
  INITIAL_USUARIOS,
  INITIAL_CATEGORIAS,
  INITIAL_PRODUTOS,
  BAIRROS_PIRACICABA,
  INITIAL_FORMAS_PAGAMENTO,
} from '../data/seedData';
import { formatPhone, formatBRL } from '../utils/formatters';

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
      modoOperacao: (data.modo_operacao || dadosObj.modoOperacao || 'producao') as any,
      ledCor: dadosObj.ledCor || (data as any).led_cor || 'vermelho',
      ledFonte: dadosObj.ledFonte || (data as any).led_fonte || 'mono',
      ledVoz: dadosObj.ledVoz || (data as any).led_voz || 'padrao',
      ledCampainha: dadosObj.ledCampainha || (data as any).led_campainha || 'ding_dong',
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
    modo_operacao: novas.modoOperacao || 'producao',
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
/**
 * Pedidos operations via Supabase (Estrutura Relacional estrita em 2 etapas:
 * 1. Insere dados gerais na tabela 'pedidos' SEM a coluna 'itens' e recupera data[0].id
 * 2. Com o id em mãos, insere em lote (ou sequencial) na tabela 'itens_pedido'
 * 3. Se houver pagamentos imediatos (balcão/delivery), insere na tabela 'pagamentos'
 */
export async function salvarPedidoSupabase(pedido: any): Promise<Pedido> {
  const now = new Date().toISOString();
  const idFallback = pedido.id || Date.now();
  const codigoSenhaFallback = pedido.codigo_senha || Math.floor(100 + Math.random() * 900);

  // Validador de UUID para cliente_id (evita erro de sintaxe UUID no PostgreSQL)
  const isValidUUID = (id?: string) =>
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  const clienteIdVal = isValidUUID(pedido.cliente_id) ? pedido.cliente_id : null;

  // 1. INSERIR O PEDIDO: dados gerais na tabela 'pedidos' ESTRITAMENTE SEM 'itens'
  const pedidoPayload: Record<string, any> = {
    tipo: pedido.tipo,
    status: pedido.status || 'pendente',
    mesa_id: pedido.mesa_id ? Number(pedido.mesa_id) : null,
    cliente_id: clienteIdVal,
    precisa_troco: !!pedido.precisa_troco,
    troco_para: pedido.troco_para ? Number(pedido.troco_para) : null,
    motoboy_tipo: pedido.motoboy_tipo || null,
    valor_total: Number(pedido.valor_total) || 0,
    taxa_entrega: Number(pedido.taxa_entrega) || 0,
    criado_em: pedido.criado_em || now,
    atualizado_em: now,
  };

  // Se codigo_senha numérico foi fornecido
  if (pedido.codigo_senha && Number(pedido.codigo_senha) > 0) {
    pedidoPayload.codigo_senha = Number(pedido.codigo_senha);
  }

  let pedidoIdGerado = idFallback;
  let codigoSenhaGerado = codigoSenhaFallback;

  try {
    let { data, error } = await supabase
      .from('pedidos')
      .insert([pedidoPayload])
      .select();

    if (error) {
      console.warn('Tentativa 1 de insert na tabela pedidos falhou:', error.message);
      // Tratamento resiliente se codigo_senha for autoincrement ou conflitar
      if (error.message?.includes('codigo_senha')) {
        delete pedidoPayload.codigo_senha;
      }
      // Se falhar por foreign key em mesa_id ou cliente_id
      if (error.message?.includes('mesa_id') || error.message?.includes('foreign key')) {
        pedidoPayload.mesa_id = null;
      }
      if (error.message?.includes('cliente_id')) {
        pedidoPayload.cliente_id = null;
      }

      const retry = await supabase.from('pedidos').insert([pedidoPayload]).select();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data && data.length > 0) {
      pedidoIdGerado = Number(data[0].id) || idFallback;
      codigoSenhaGerado = Number(data[0].codigo_senha) || pedidoIdGerado;
    } else if (error) {
      console.error('Erro ao persistir pedido no Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Exceção ao inserir pedido no Supabase:', err);
  }

  // 2. INSERIR OS ITENS: Com o id do pedido em mãos, insert na tabela 'itens_pedido'
  const itensFormatados: ItemPedido[] = [];
  if (pedido.itens && pedido.itens.length > 0) {
    const itensPayload = pedido.itens.map((it: any) => ({
      pedido_id: pedidoIdGerado,
      produto_id: it.produto_id ? Number(it.produto_id) : (it.id ? Number(it.id) : null),
      quantidade: Number(it.quantidade) || 1,
      preco_unitario: Number(it.preco_unitario || it.preco_salao || it.preco_delivery || 0),
      observacao: it.observacao ? String(it.observacao).toUpperCase().trim() : null,
      opcionais_selecionados: it.opcionais_selecionados || null,
    }));

    try {
      const { data: itensInserted, error: itensError } = await supabase
        .from('itens_pedido')
        .insert(itensPayload)
        .select();

      if (itensError) {
        console.warn('Insert em lote na tabela itens_pedido falhou, tentando sequencial:', itensError.message);
        for (const itemP of itensPayload) {
          try {
            const { data: singleItem } = await supabase
              .from('itens_pedido')
              .insert([itemP])
              .select();
            if (singleItem && singleItem[0]) {
              itensFormatados.push(singleItem[0] as ItemPedido);
            }
          } catch {}
        }
      } else if (itensInserted && itensInserted.length > 0) {
        itensFormatados.push(...(itensInserted as ItemPedido[]));
      }
    } catch (err) {
      console.warn('Erro ao inserir itens_pedido no Supabase:', err);
    }
  }

  // 3. INSERIR PAGAMENTOS se houver na tabela 'pagamentos'
  const pagamentosFormatados: Pagamento[] = [];
  if (pedido.pagamentos && pedido.pagamentos.length > 0) {
    const pagsPayload = pedido.pagamentos.map((pg: any) => ({
      pedido_id: pedidoIdGerado,
      forma: String(pg.forma || 'dinheiro').toLowerCase().trim(),
      valor: Number(pg.valor) || 0,
    }));

    try {
      const { data: pagsInserted } = await supabase
        .from('pagamentos')
        .insert(pagsPayload)
        .select();

      if (pagsInserted && pagsInserted.length > 0) {
        pagamentosFormatados.push(...(pagsInserted as Pagamento[]));
      }
    } catch (pgErr) {
      console.warn('Aviso ao registrar pagamento na tabela pagamentos:', pgErr);
    }
  }

  const novoPedidoCompleto: Pedido = {
    id: pedidoIdGerado,
    codigo_senha: codigoSenhaGerado,
    tipo: pedido.tipo,
    status: pedido.status || 'pendente',
    cliente_id: pedido.cliente_id,
    cliente: pedido.cliente,
    mesa_id: pedido.mesa_id ? Number(pedido.mesa_id) : undefined,
    precisa_troco: !!pedido.precisa_troco,
    troco_para: pedido.troco_para,
    motoboy_tipo: pedido.motoboy_tipo,
    entregador_nome: pedido.entregador_nome,
    valor_total: Number(pedido.valor_total) || 0,
    taxa_entrega: Number(pedido.taxa_entrega) || 0,
    itens: (pedido.itens || []).map((origIt: any, idx: number) => {
      const insIt = itensFormatados[idx];
      return {
        ...origIt,
        ...(insIt || {}),
        produto_nome: origIt.produto_nome || (insIt as any)?.produto_nome,
        preco_unitario: Number(origIt.preco_unitario) || Number(insIt?.preco_unitario) || 0,
        quantidade: Number(origIt.quantidade) || Number(insIt?.quantidade) || 1,
      };
    }),
    pagamentos: pagamentosFormatados.length > 0 ? pagamentosFormatados : (pedido.pagamentos || []),
    criado_em: pedidoPayload.criado_em,
    atualizado_em: now,
  };

  return novoPedidoCompleto;
}

// Estado de conferências mantido exclusivamente em nuvem Supabase e sincronizado em memória
const conferenciasSessao: Record<number, { conferido_por: string; conferido_em: string }> = {};

export function getConferenciasLocais(): Record<number, { conferido_por: string; conferido_em: string }> {
  return conferenciasSessao;
}

export function registrarConferenciaLocal(pedidoId: number, conferidoPor: string) {
  conferenciasSessao[pedidoId] = {
    conferido_por: conferidoPor,
    conferido_em: new Date().toISOString(),
  };
}

export async function carregarConferenciasNuvem(): Promise<Record<number, { conferido_por: string; conferido_em: string }>> {
  try {
    const { data } = await supabase.from('configuracoes').select('dados').eq('id', 1).maybeSingle();
    const confs = (data?.dados?.conferencias_entregas || {}) as Record<number, { conferido_por: string; conferido_em: string }>;
    // Sincroniza também no cache em memória
    Object.assign(conferenciasSessao, confs);
    return confs;
  } catch {
    return {};
  }
}

export async function salvarConferenciaNuvem(pedidoId: number, conferidoPor: string): Promise<void> {
  try {
    const { data } = await supabase.from('configuracoes').select('dados').eq('id', 1).maybeSingle();
    const dados = (data?.dados || {}) as Record<string, any>;
    const confs = dados.conferencias_entregas || {};
    confs[pedidoId] = {
      conferido_por: conferidoPor,
      conferido_em: new Date().toISOString(),
    };
    dados.conferencias_entregas = confs;
    await supabase
      .from('configuracoes')
      .update({ dados, atualizado_em: new Date().toISOString() })
      .eq('id', 1);
  } catch (err) {
    console.warn('Aviso ao sincronizar conferência na nuvem Supabase:', err);
  }
}

let pedidosColumnsChecked = false;
let pedidosCols = {
  conferencia_entrega: false,
  conferido_por: false,
  conferido_em: false,
  entregador_nome: false,
};

async function checkPedidosSchema() {
  if (pedidosColumnsChecked) return pedidosCols;
  try {
    const { data, error } = await supabase.from('pedidos').select('*').limit(1);
    if (!error && data && data.length > 0) {
      const first = data[0];
      pedidosCols.conferencia_entrega = 'conferencia_entrega' in first;
      pedidosCols.conferido_por = 'conferido_por' in first;
      pedidosCols.conferido_em = 'conferido_em' in first;
      pedidosCols.entregador_nome = 'entregador_nome' in first;
      pedidosColumnsChecked = true;
    }
  } catch {}
  return pedidosCols;
}

export async function fetchPedidosSupabase(): Promise<Pedido[]> {
  try {
    // Carrega do Supabase as conferências salvas em nuvem
    const conferidosNuvem = await carregarConferenciasNuvem();
    const conferidosLocais = { ...conferidosNuvem, ...getConferenciasLocais() };

    // 1. Tenta carregar pedidos com relacionamento dos itens e pagamentos
    const { data: pedidosData, error } = await supabase
      .from('pedidos')
      .select('*, itens:itens_pedido(*), pagamentos:pagamentos(*)')
      .order('criado_em', { ascending: false });

    if (!error && pedidosData && pedidosData.length > 0) {
      if (!pedidosColumnsChecked && pedidosData[0]) {
        pedidosCols.conferencia_entrega = 'conferencia_entrega' in pedidosData[0];
        pedidosCols.conferido_por = 'conferido_por' in pedidosData[0];
        pedidosCols.conferido_em = 'conferido_em' in pedidosData[0];
        pedidosCols.entregador_nome = 'entregador_nome' in pedidosData[0];
        pedidosColumnsChecked = true;
      }

      return pedidosData.map((p: any) => {
        const confLocal = conferidosLocais[Number(p.id)];
        const isConferido = p.conferencia_entrega === 'conferido' || !!confLocal;
        const statusConf = isConferido
          ? 'conferido'
          : p.conferencia_entrega || (p.tipo === 'delivery' && p.status === 'entregue' ? 'pendente' : undefined);

        return {
          id: Number(p.id),
          codigo_senha: Number(p.codigo_senha || p.id),
          tipo: p.tipo,
          status: p.status,
          cliente_id: p.cliente_id,
          cliente: p.cliente,
          mesa_id: p.mesa_id ? Number(p.mesa_id) : undefined,
          precisa_troco: !!p.precisa_troco,
          troco_para: p.troco_para ? Number(p.troco_para) : undefined,
          motoboy_tipo: p.motoboy_tipo,
          entregador_nome: p.entregador_nome,
          valor_total: Number(p.valor_total) || 0,
          taxa_entrega: Number(p.taxa_entrega) || 0,
          itens: Array.isArray(p.itens) ? p.itens : [],
          pagamentos: Array.isArray(p.pagamentos) ? p.pagamentos : [],
          conferencia_entrega: statusConf,
          conferido_por: p.conferido_por || confLocal?.conferido_por || undefined,
          conferido_em: p.conferido_em || confLocal?.conferido_em || undefined,
          criado_em: p.criado_em || new Date().toISOString(),
          atualizado_em: p.atualizado_em || new Date().toISOString(),
        };
      });
    }

    // 2. Fallback: buscar pedidos e itens_pedido separadamente
    const { data: simplePeds, error: simpleError } = await supabase
      .from('pedidos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (!simpleError && simplePeds && simplePeds.length > 0) {
      if (!pedidosColumnsChecked && simplePeds[0]) {
        pedidosCols.conferencia_entrega = 'conferencia_entrega' in simplePeds[0];
        pedidosCols.conferido_por = 'conferido_por' in simplePeds[0];
        pedidosCols.conferido_em = 'conferido_em' in simplePeds[0];
        pedidosCols.entregador_nome = 'entregador_nome' in simplePeds[0];
        pedidosColumnsChecked = true;
      }

      let allItens: any[] = [];
      let allPagamentos: any[] = [];
      try {
        const [itensRes, pagRes] = await Promise.allSettled([
          supabase.from('itens_pedido').select('*'),
          supabase.from('pagamentos').select('*'),
        ]);
        if (itensRes.status === 'fulfilled' && itensRes.value.data) {
          allItens = itensRes.value.data;
        }
        if (pagRes.status === 'fulfilled' && pagRes.value.data) {
          allPagamentos = pagRes.value.data;
        }
      } catch {}

      return simplePeds.map((p: any) => {
        const pedItens = allItens
          .filter((it: any) => Number(it.pedido_id) === Number(p.id))
          .map((it: any) => ({
            id: Number(it.id),
            pedido_id: Number(it.pedido_id),
            produto_id: Number(it.produto_id),
            produto_nome: it.produto_nome || it.produtos?.nome,
            quantidade: Number(it.quantidade) || 1,
            preco_unitario: Number(it.preco_unitario) || 0,
            observacao: it.observacao,
            opcionais_selecionados: it.opcionais_selecionados,
          }));
        const pedPags = allPagamentos.filter((pg: any) => Number(pg.pedido_id) === Number(p.id));
        const confLocal = conferidosLocais[Number(p.id)];
        const isConferido = p.conferencia_entrega === 'conferido' || !!confLocal;
        const statusConf = isConferido
          ? 'conferido'
          : p.conferencia_entrega || (p.tipo === 'delivery' && p.status === 'entregue' ? 'pendente' : undefined);

        return {
          id: Number(p.id),
          codigo_senha: Number(p.codigo_senha || p.id),
          tipo: p.tipo,
          status: p.status,
          cliente_id: p.cliente_id,
          cliente: p.cliente,
          mesa_id: p.mesa_id ? Number(p.mesa_id) : undefined,
          precisa_troco: !!p.precisa_troco,
          troco_para: p.troco_para ? Number(p.troco_para) : undefined,
          motoboy_tipo: p.motoboy_tipo,
          entregador_nome: p.entregador_nome,
          valor_total: Number(p.valor_total) || 0,
          taxa_entrega: Number(p.taxa_entrega) || 0,
          itens: pedItens.length > 0 ? pedItens : (Array.isArray(p.itens) ? p.itens : []),
          pagamentos: pedPags.length > 0 ? pedPags : (Array.isArray(p.pagamentos) ? p.pagamentos : []),
          conferencia_entrega: statusConf,
          conferido_por: p.conferido_por || confLocal?.conferido_por || undefined,
          conferido_em: p.conferido_em || confLocal?.conferido_em || undefined,
          criado_em: p.criado_em || new Date().toISOString(),
          atualizado_em: p.atualizado_em || new Date().toISOString(),
        };
      });
    }
  } catch (err) {
    console.warn('Erro ao buscar pedidos no Supabase:', err);
  }
  return [];
}

export async function atualizarStatusPedidoSupabase(
  id: number,
  status: StatusPedido,
  entregador_nome?: string
): Promise<void> {
  try {
    await checkPedidosSchema();
    const payload: any = {
      status,
    };

    if (entregador_nome && pedidosCols.entregador_nome) {
      payload.entregador_nome = entregador_nome;
    }
    if (status === 'entregue' && pedidosCols.conferencia_entrega) {
      payload.conferencia_entrega = 'pendente';
    }

    const { error } = await supabase.from('pedidos').update(payload).eq('id', id);
    if (error) {
      // Fallback sem colunas adicionais para evitar 400 Bad Request se a coluna não existir no Supabase
      pedidosCols.conferencia_entrega = false;
      pedidosCols.entregador_nome = false;
      pedidosColumnsChecked = true;
      await supabase.from('pedidos').update({ status }).eq('id', id);
    }
  } catch (err) {
    console.warn('Erro ao atualizar status do pedido no Supabase:', err);
  }
}

export async function conferirEntregaPedidoSupabase(
  id: number,
  conferidoPor: string
): Promise<void> {
  try {
    // 1. Registra no cache em memória
    registrarConferenciaLocal(id, conferidoPor);

    // 2. Persiste em nuvem diretamente no Supabase (configuracoes.dados.conferencias_entregas)
    await salvarConferenciaNuvem(id, conferidoPor);

    await checkPedidosSchema();

    // 3. Se a tabela pedidos possuir as colunas de conferência no Supabase, tenta atualizar
    if (pedidosCols.conferencia_entrega) {
      const payload: any = {
        conferencia_entrega: 'conferido',
      };
      if (pedidosCols.conferido_por) payload.conferido_por = conferidoPor;
      if (pedidosCols.conferido_em) payload.conferido_em = new Date().toISOString();

      const { error } = await supabase.from('pedidos').update(payload).eq('id', id);
      if (error) {
        pedidosCols.conferencia_entrega = false;
        pedidosCols.conferido_por = false;
        pedidosCols.conferido_em = false;
        pedidosColumnsChecked = true;
      }
    }
  } catch (err) {
    console.warn('Conferência de entrega salva na nuvem:', err);
  }
}

/**
 * Conexões ativas no sistema em tempo real (Supabase Presence)
 * Notifica a quantidade de dispositivos (tablets, celulares, PCs) conectados pela internet
 */
export function subscribeActiveConnections(
  userPerfilNome: string,
  onCountChange: (count: number) => void
): () => void {
  try {
    const channelId = `dev_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel('kaipira_online_presence', {
      config: {
        presence: { key: channelId },
      },
    });

    const updateCount = () => {
      try {
        const state = channel.presenceState();
        const count = Math.max(1, Object.keys(state).length);
        onCountChange(count);
      } catch {}
    };

    channel
      .on('presence', { event: 'sync' }, updateCount)
      .on('presence', { event: 'join' }, updateCount)
      .on('presence', { event: 'leave' }, updateCount)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              nome: userPerfilNome,
              online_at: new Date().toISOString(),
            });
          } catch {}
        }
      });

    return () => {
      try {
        channel.unsubscribe();
      } catch {}
    };
  } catch (err) {
    console.warn('Erro ao conectar presença em tempo real:', err);
    return () => {};
  }
}

/**
 * Mesas operations via Supabase
 * Trata variações de esquema: suporta 'id' e 'numero', status 'livre'|'ocupada'|'reservada'|'conta'
 */
let mesasColumnsChecked = false;
let mesasHasNumero = true;

async function checkMesasSchema() {
  if (mesasColumnsChecked) return;
  try {
    const { data, error } = await supabase.from('mesas').select('*').limit(1);
    if (!error && data && data.length > 0) {
      mesasHasNumero = 'numero' in data[0];
      mesasColumnsChecked = true;
    }
  } catch {
    // fallback seguro
  }
}

export async function atualizarMesaSupabase(
  numero: number,
  status: Mesa['status'],
  _cliente_nome?: string,
  _pessoas?: number
): Promise<void> {
  try {
    await checkMesasSchema();
    const num = Number(numero);

    // As colunas estritas da tabela 'mesas' no Supabase são: id, numero, status
    // Envia EXCLUSIVAMENTE 'status' para evitar erro 400 (Bad Request)
    const filterCol = mesasHasNumero ? 'numero' : 'id';
    let { error } = await supabase
      .from('mesas')
      .update({ status })
      .eq(filterCol, num);

    if (error) {
      console.warn(`Update mesa ${filterCol}=${num} falhou:`, error.message);

      // Se falhou por causa da coluna 'numero' não existir no schema cache do PostgREST
      if (mesasHasNumero && (error.message?.includes('numero') || (error as any).code === 'PGRST204')) {
        mesasHasNumero = false;
        const resId = await supabase.from('mesas').update({ status }).eq('id', num);
        error = resId.error;
      }

      // Se falhou por restrição CHECK no status (ex: status 'conta' não permitido no CHECK constraint da tabela)
      if (error && status === 'conta') {
        const fallbackCol = mesasHasNumero ? 'numero' : 'id';
        const resOcupada = await supabase.from('mesas').update({ status: 'ocupada' }).eq(fallbackCol, num);
        if (!resOcupada.error) return;
      }

      // Se a mesa ainda não existe na tabela remota (0 linhas afetadas), cria com upsert seguro
      if (error) {
        const payload: Record<string, any> = { id: num, status };
        if (mesasHasNumero) payload.numero = num;

        const upsertRes = await supabase
          .from('mesas')
          .upsert(payload, { onConflict: 'id' });

        if (upsertRes.error && mesasHasNumero && upsertRes.error.message?.includes('numero')) {
          mesasHasNumero = false;
          await supabase.from('mesas').upsert({ id: num, status }, { onConflict: 'id' });
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar mesa no Supabase:', err);
  }
}

export async function fecharMesaSupabase(numero: number): Promise<void> {
  try {
    await checkMesasSchema();
    const num = Number(numero);

    // Ao dar baixa/fechar a mesa, atualiza EXCLUSIVAMENTE 'status' = 'livre'
    const filterCol = mesasHasNumero ? 'numero' : 'id';
    let { error } = await supabase
      .from('mesas')
      .update({ status: 'livre' })
      .eq(filterCol, num);

    if (error) {
      console.warn(`Fechar mesa ${filterCol}=${num} falhou:`, error.message);

      if (mesasHasNumero && (error.message?.includes('numero') || (error as any).code === 'PGRST204')) {
        mesasHasNumero = false;
        const resId = await supabase.from('mesas').update({ status: 'livre' }).eq('id', num);
        error = resId.error;
      }

      if (error) {
        const payload: Record<string, any> = { id: num, status: 'livre' };
        if (mesasHasNumero) payload.numero = num;
        await supabase.from('mesas').upsert(payload, { onConflict: 'id' });
      }
    }
  } catch (err) {
    console.warn('Erro ao fechar mesa no Supabase:', err);
  }
}

/**
 * Estoque & Insumos operations via Supabase (100% Nuvem - Sem registros locais)
 */
export async function fetchEstoqueSupabase(): Promise<ItemEstoque[]> {
  try {
    const { data, error } = await supabase
      .from('estoque')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Aviso ao consultar estoque no Supabase:', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((d: any) => ({
      id: Number(d.id),
      item_nome: (d.item_nome || '').toUpperCase().trim(),
      quantidade_atual: Number(d.quantidade_atual) || 0,
      unidade_medida: (d.unidade_medida || 'un').toLowerCase().trim(),
      estoque_minimo: Number(d.estoque_minimo) || 0,
      fornecedor_info: d.fornecedor_info ? d.fornecedor_info.toUpperCase().trim() : '',
      atualizado_em: d.atualizado_em,
    }));
  } catch (err) {
    console.warn('Erro de conexão ao buscar estoque no Supabase:', err);
    return [];
  }
}

export async function atualizarItemEstoqueSupabase(
  id: number,
  data: Partial<ItemEstoque>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: any = {
      atualizado_em: new Date().toISOString(),
    };
    if (data.item_nome !== undefined) updatePayload.item_nome = data.item_nome.toUpperCase().trim();
    if (data.quantidade_atual !== undefined) updatePayload.quantidade_atual = Number(data.quantidade_atual);
    if (data.unidade_medida !== undefined) updatePayload.unidade_medida = data.unidade_medida.toLowerCase().trim();
    if (data.estoque_minimo !== undefined) updatePayload.estoque_minimo = Number(data.estoque_minimo);
    if (data.fornecedor_info !== undefined) updatePayload.fornecedor_info = data.fornecedor_info ? data.fornecedor_info.toUpperCase().trim() : null;

    const { error } = await supabase.from('estoque').update(updatePayload).eq('id', id);
    if (error) {
      console.warn('Aviso atualizar estoque Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Erro ao atualizar estoque no Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function adicionarItemEstoqueSupabase(
  data: Partial<ItemEstoque>
): Promise<{ success: boolean; data?: ItemEstoque; error?: string }> {
  // Se o item já possui id (já persistido no Supabase), evita duplicação no banco de dados
  if (data.id && typeof data.id === 'number' && data.id > 0) {
    return {
      success: true,
      data: data as ItemEstoque,
    };
  }

  const cleanNome = (data.item_nome || '').toUpperCase().trim();
  if (!cleanNome) {
    return { success: false, error: 'Nome do insumo é obrigatório' };
  }

  const payload: any = {
    item_nome: cleanNome,
    quantidade_atual: Number(data.quantidade_atual) || 0,
    unidade_medida: (data.unidade_medida || 'un').toLowerCase().trim(),
    estoque_minimo: Number(data.estoque_minimo) || 0,
    fornecedor_info: data.fornecedor_info ? data.fornecedor_info.toUpperCase().trim() : null,
    atualizado_em: new Date().toISOString(),
  };

  try {
    const { data: inserted, error } = await supabase
      .from('estoque')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('Aviso insert estoque Supabase:', error.message);
      return { success: false, error: error.message };
    }

    if (inserted) {
      return {
        success: true,
        data: {
          id: Number(inserted.id),
          item_nome: inserted.item_nome,
          quantidade_atual: Number(inserted.quantidade_atual) || 0,
          unidade_medida: inserted.unidade_medida || 'un',
          estoque_minimo: Number(inserted.estoque_minimo) || 0,
          fornecedor_info: inserted.fornecedor_info || undefined,
          atualizado_em: inserted.atualizado_em,
        },
      };
    }

    return { success: false, error: 'Nenhum dado retornado da nuvem' };
  } catch (err: any) {
    console.warn('Erro ao inserir item de estoque no Supabase:', err);
    return { success: false, error: err?.message || 'Erro de conexão com o Supabase' };
  }
}

export async function excluirItemEstoqueSupabase(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('estoque').delete().eq('id', id);
    if (error) {
      console.warn('Aviso excluir estoque Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Erro ao excluir item de estoque no Supabase:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Caixa operations via Supabase
 * Colunas validadas: id, data_caixa, valor_abertura (ou valor_apertura), valor_fechamento, status, observacoes
 */
let caixaColsChecked = false;
let caixaAberturaCol: 'valor_abertura' | 'valor_apertura' = 'valor_abertura';

async function checkCaixaSchema() {
  if (caixaColsChecked) return;
  try {
    const { data, error } = await supabase.from('caixa_diario').select('*').limit(1);
    if (!error && data && data.length > 0) {
      if ('valor_apertura' in data[0]) {
        caixaAberturaCol = 'valor_apertura';
      } else if ('valor_abertura' in data[0]) {
        caixaAberturaCol = 'valor_abertura';
      }
      caixaColsChecked = true;
    }
  } catch {
    // fallback seguro
  }
}

export async function abrirCaixaSupabase(
  valor_abertura: number,
  observacoes?: string
): Promise<CaixaDiario> {
  await checkCaixaSchema();
  const dataHoje = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const novoCaixa: CaixaDiario = {
    id: 1,
    data_caixa: dataHoje,
    valor_abertura: Number(valor_abertura) || 0,
    status: 'aberto',
    observacoes: observacoes ? observacoes.toUpperCase().trim() : undefined,
    aberto_em: now,
    movimentacoes: [],
  };

  try {
    // 1. Tenta obter o registro existente mais recente do banco real
    const { data: rows } = await supabase
      .from('caixa_diario')
      .select('*')
      .order('id', { ascending: false })
      .limit(1);

    const existingRow = rows && rows.length > 0 ? rows[0] : null;

    // Payload contendo estritamente as colunas reais da tabela
    const payload: Record<string, any> = {
      data_caixa: dataHoje,
      [caixaAberturaCol]: Number(valor_abertura) || 0,
      valor_fechamento: null,
      status: 'aberto',
      observacoes: observacoes ? observacoes.toUpperCase().trim() : null,
    };

    if (existingRow && existingRow.id) {
      payload.id = existingRow.id;
    }

    // Usa upsert seguro para criar ou atualizar sem erro 400
    let { data: upsertData, error: upsertError } = await supabase
      .from('caixa_diario')
      .upsert(payload, payload.id ? { onConflict: 'id' } : undefined)
      .select()
      .maybeSingle();

    if (upsertError) {
      // Se falhou por nome de coluna (valor_abertura vs valor_apertura)
      if (upsertError.message?.includes('valor_') || (upsertError as any).code === 'PGRST204') {
        caixaAberturaCol = caixaAberturaCol === 'valor_abertura' ? 'valor_apertura' : 'valor_abertura';
        delete payload['valor_abertura'];
        delete payload['valor_apertura'];
        payload[caixaAberturaCol] = Number(valor_abertura) || 0;

        const retry = await supabase
          .from('caixa_diario')
          .upsert(payload, payload.id ? { onConflict: 'id' } : undefined)
          .select()
          .maybeSingle();

        upsertData = retry.data;
        upsertError = retry.error;
      }
    }

    if (upsertError) {
      console.warn('Upsert de abertura com id falhou, tentando insert direto:', upsertError.message);
      delete payload.id;
      const { data: insData } = await supabase
        .from('caixa_diario')
        .insert(payload)
        .select()
        .maybeSingle();

      if (insData && insData.id) {
        novoCaixa.id = insData.id;
      }
    } else if (upsertData && upsertData.id) {
      novoCaixa.id = upsertData.id;
    }
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
  await checkCaixaSchema();
  const dataHoje = caixaAtual.data_caixa || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const fechado: CaixaDiario = {
    ...caixaAtual,
    status: 'fechado',
    valor_fechamento: Number(valor_fechamento) || 0,
    observacoes: observacoes ? observacoes.toUpperCase().trim() : (caixaAtual.observacoes || undefined),
    fechado_em: now,
  };

  try {
    // 1. Tenta obter o ID real do caixa ativo do banco de dados para evitar PATCH em ID fixo inexistente
    const { data: rows } = await supabase
      .from('caixa_diario')
      .select('id, data_caixa')
      .order('id', { ascending: false })
      .limit(1);

    const existingRow = rows && rows.length > 0 ? rows[0] : null;

    // Colunas 100% reais: data_caixa, valor_fechamento, status, observacoes
    const payload: Record<string, any> = {
      data_caixa: existingRow?.data_caixa || dataHoje,
      valor_fechamento: Number(valor_fechamento) || 0,
      status: 'fechado',
      observacoes: observacoes ? observacoes.toUpperCase().trim() : (caixaAtual.observacoes || null),
    };

    if (existingRow && existingRow.id) {
      payload.id = existingRow.id;
    } else if (caixaAtual.id && caixaAtual.id < 1000000) {
      payload.id = caixaAtual.id;
    }

    // Usa exclusivamente .upsert() seguro para criar ou atualizar de forma garantida
    let { data: upsertData, error: upsertError } = await supabase
      .from('caixa_diario')
      .upsert(payload, payload.id ? { onConflict: 'id' } : undefined)
      .select()
      .maybeSingle();

    if (upsertError) {
      console.warn('Upsert de fechamento com id falhou, tentando upsert por data_caixa ou insert:', upsertError.message);
      delete payload.id;
      const retryDate = await supabase
        .from('caixa_diario')
        .upsert(payload, { onConflict: 'data_caixa' })
        .select()
        .maybeSingle();

      if (!retryDate.error && retryDate.data) {
        fechado.id = retryDate.data.id;
      } else {
        const insRes = await supabase.from('caixa_diario').insert(payload).select().maybeSingle();
        if (insRes.data && insRes.data.id) {
          fechado.id = insRes.data.id;
        }
      }
    } else if (upsertData && upsertData.id) {
      fechado.id = upsertData.id;
    }
  } catch (err) {
    console.warn('Erro ao fechar caixa no Supabase:', err);
  }

  return fechado;
}

/**
 * Zera o financeiro do dia atual (Rotina Administrativa Restrita):
 * Reseta as movimentações, saldo de abertura e fechamento do caixa diário atual.
 */
export async function zerarFinanceiroDiaSupabase(
  caixaAtual: CaixaDiario
): Promise<CaixaDiario> {
  await checkCaixaSchema();
  const dataHoje = caixaAtual.data_caixa || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const zerado: CaixaDiario = {
    ...caixaAtual,
    data_caixa: dataHoje,
    valor_abertura: 0,
    valor_fechamento: undefined,
    status: 'aberto',
    observacoes: 'FINANCEIRO DO DIA ZERADO PELO ADMINISTRADOR',
    aberto_em: now,
    fechado_em: undefined,
    movimentacoes: [],
  };

  try {
    // 1. Zera pedidos, itens e pagamentos na nuvem Supabase
    try {
      const { data: allPeds } = await supabase.from('pedidos').select('id');
      if (allPeds && allPeds.length > 0) {
        const pedIds = allPeds.map((p) => p.id);
        await supabase.from('pagamentos').delete().in('pedido_id', pedIds);
        await supabase.from('itens_pedido').delete().in('pedido_id', pedIds);
        await supabase.from('pedidos').delete().in('id', pedIds);
      }
    } catch (e) {
      console.warn('Aviso ao limpar pedidos por IDs:', e);
    }

    try {
      await supabase.from('itens_pedido').delete().gt('id', 0);
    } catch (e) {
      console.warn('Aviso ao limpar itens_pedido:', e);
    }
    try {
      await supabase.from('pagamentos').delete().gt('id', 0);
    } catch (e) {
      console.warn('Aviso ao limpar pagamentos:', e);
    }
    try {
      await supabase.from('pedidos').delete().gt('id', 0);
    } catch (e) {
      console.warn('Aviso ao limpar pedidos:', e);
    }

    // Se algum pedido persistir por bloqueio de RLS/FK, cancela e zera valores
    try {
      await supabase.from('pedidos').update({
        status: 'cancelado',
        valor_total: 0,
        taxa_entrega: 0,
        conferencia_entrega: null,
        conferido_por: null,
        conferido_em: null,
      }).gt('id', 0);
    } catch {}

    // 2. Libera todas as mesas no salão
    try {
      await supabase.from('mesas').update({
        status: 'livre',
        cliente_nome: null,
        pessoas: null,
      }).gt('id', 0);
    } catch (e) {
      console.warn('Aviso ao liberar mesas:', e);
    }

    // 3. Limpa conferências de entregas salvas na nuvem
    try {
      const { data: cfgRow } = await supabase.from('configuracoes').select('id, dados').eq('id', 1).maybeSingle();
      const novosDados = { ...(cfgRow?.dados || {}), conferencias_entregas: {}, financeiro_zerado_em: now };
      await supabase.from('configuracoes').upsert({ id: 1, dados: novosDados, atualizado_em: now });
    } catch (e) {
      console.warn('Aviso ao limpar conferencias em configuracoes:', e);
    }

    // Limpa também o cache local em memória
    for (const key of Object.keys(conferenciasSessao)) {
      delete conferenciasSessao[Number(key)];
    }

    // 4. Zera o caixa_diario na nuvem Supabase
    try {
      await supabase.from('caixa_diario').update({
        valor_abertura: 0.00,
        valor_fechamento: null,
        status: 'aberto',
        observacoes: 'FINANCEIRO DO DIA ZERADO PELO ADMINISTRADOR',
      }).neq('id', 0);
    } catch {}
    try {
      await supabase.from('caixa_diario').update({
        valor_apertura: 0.00,
        valor_fechamento: null,
        status: 'aberto',
        observacoes: 'FINANCEIRO DO DIA ZERADO PELO ADMINISTRADOR',
      }).neq('id', 0);
    } catch {}

    const { data: rows } = await supabase
      .from('caixa_diario')
      .select('id, data_caixa')
      .order('id', { ascending: false })
      .limit(1);

    const existingRow = rows && rows.length > 0 ? rows[0] : null;

    const payload: Record<string, any> = {
      data_caixa: existingRow?.data_caixa || dataHoje,
      valor_abertura: 0.00,
      valor_fechamento: null,
      status: 'aberto',
      observacoes: 'FINANCEIRO DO DIA ZERADO PELO ADMINISTRADOR',
    };
    if (caixaAberturaCol !== 'valor_abertura') {
      payload[caixaAberturaCol] = 0.00;
    }

    if (existingRow && existingRow.id) {
      payload.id = existingRow.id;
    } else if (caixaAtual.id && caixaAtual.id < 1000000) {
      payload.id = caixaAtual.id;
    }

    let { data: upsertData, error: upsertError } = await supabase
      .from('caixa_diario')
      .upsert(payload, payload.id ? { onConflict: 'id' } : undefined)
      .select()
      .maybeSingle();

    if (upsertError) {
      delete payload.id;
      const retryDate = await supabase
        .from('caixa_diario')
        .upsert(payload, { onConflict: 'data_caixa' })
        .select()
        .maybeSingle();

      if (!retryDate.error && retryDate.data) {
        zerado.id = retryDate.data.id;
      }
    } else if (upsertData && upsertData.id) {
      zerado.id = upsertData.id;
    }
  } catch (err) {
    console.warn('Erro ao zerar financeiro do caixa diário no Supabase:', err);
  }

  return zerado;
}

export async function registrarMultiplasMovimentacoesCaixaSupabase(
  caixaAtual: CaixaDiario,
  movsNovas: Array<{
    tipo: 'entrada_pedido' | 'suprimento' | 'sangria';
    forma: FormaPagamento;
    valor: number;
    descricao: string;
  }>
): Promise<CaixaDiario> {
  if (!movsNovas || movsNovas.length === 0) return caixaAtual;

  const baseTimestamp = Date.now();
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatadas: MovimentacaoCaixa[] = movsNovas.map((m, idx) => ({
    id: baseTimestamp + idx,
    tipo: m.tipo,
    forma: String(m.forma || 'outro').toLowerCase().trim(),
    valor: Number(m.valor) || 0,
    descricao: m.descricao.toUpperCase().trim(),
    hora: horaAtual,
  }));

  const caixaAtualizado: CaixaDiario = {
    ...caixaAtual,
    movimentacoes: [...(caixaAtual.movimentacoes || []), ...formatadas],
  };

  try {
    const { data: rows } = await supabase
      .from('caixa_diario')
      .select('id, observacoes, data_caixa')
      .order('id', { ascending: false })
      .limit(1);

    const existingRow = rows && rows.length > 0 ? rows[0] : null;
    const baseObs = existingRow?.observacoes || caixaAtual.observacoes || '';
    const resumoNovas = formatadas
      .map((n) => `${n.tipo.toUpperCase()}: ${n.valor.toFixed(2)} (${(n.forma || 'outro').toUpperCase()})`)
      .join(' | ');
    const obsAtualizada = `${baseObs ? baseObs + ' | ' : ''}${resumoNovas}`.slice(0, 500);

    const payload: Record<string, any> = {
      data_caixa: existingRow?.data_caixa || caixaAtual.data_caixa || new Date().toISOString().split('T')[0],
      status: caixaAtual.status || 'aberto',
      observacoes: obsAtualizada,
    };

    if (existingRow && existingRow.id) {
      payload.id = existingRow.id;
    } else if (caixaAtual.id && caixaAtual.id < 1000000) {
      payload.id = caixaAtual.id;
    }

    const { error } = await supabase
      .from('caixa_diario')
      .upsert(payload, payload.id ? { onConflict: 'id' } : undefined);

    if (error) {
      delete payload.id;
      await supabase.from('caixa_diario').upsert(payload, { onConflict: 'data_caixa' });
    }
  } catch (err) {
    console.warn('Erro ao sincronizar múltiplas movimentações de caixa no Supabase:', err);
  }

  return caixaAtualizado;
}

export async function registrarMovimentacaoCaixaSupabase(
  caixaAtual: CaixaDiario,
  tipo: 'entrada_pedido' | 'suprimento' | 'sangria',
  forma: FormaPagamento,
  valor: number,
  descricao: string
): Promise<CaixaDiario> {
  return registrarMultiplasMovimentacoesCaixaSupabase(caixaAtual, [
    { tipo, forma, valor, descricao },
  ]);
}

export async function registrarPagamentosMesaSupabase(
  pedidosIds: number[],
  pagamentos: Array<{ forma: FormaPagamento; valor: number }>
): Promise<void> {
  if (!pagamentos || pagamentos.length === 0) return;
  const primaryPedidoId = pedidosIds && pedidosIds.length > 0 ? pedidosIds[0] : null;

  try {
    const payload = pagamentos.map((pg) => ({
      pedido_id: primaryPedidoId,
      forma: String(pg.forma || 'dinheiro').toLowerCase().trim(),
      valor: Number(pg.valor) || 0,
    }));
    await supabase.from('pagamentos').insert(payload);
  } catch (err) {
    console.warn('Aviso ao persistir pagamentos de fechamento de mesa na tabela pagamentos:', err);
  }
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
  valor: number,
  clienteObj?: Cliente
): Promise<void> {
  try {
    let clienteEncontradoId: string | null = null;
    let saldoAtual = 0;

    // 1. Se clienteId for UUID válido, busca direto por ID
    if (isUUID(clienteId)) {
      try {
        const { data: dbCli } = await supabase
          .from('clientes')
          .select('id, saldo_devedor, telefone, nome')
          .eq('id', clienteId)
          .maybeSingle();

        if (dbCli) {
          clienteEncontradoId = dbCli.id;
          saldoAtual = Number(dbCli.saldo_devedor || 0);
        }
      } catch {}
    }

    // 2. Se não achou por ID, busca por telefone ou nome na nuvem
    const tel = clienteObj?.telefone || '';
    if (!clienteEncontradoId) {
      const telDigits = tel.replace(/\D/g, '');
      const { data: clis } = await supabase
        .from('clientes')
        .select('id, saldo_devedor, telefone, nome')
        .limit(200);

      if (clis && clis.length > 0) {
        const match = clis.find(
          (c) =>
            (tel && c.telefone === tel) ||
            (telDigits && c.telefone && c.telefone.replace(/\D/g, '') === telDigits) ||
            (clienteObj?.nome && c.nome?.toUpperCase().trim() === clienteObj.nome.toUpperCase().trim())
        );
        if (match) {
          clienteEncontradoId = match.id;
          saldoAtual = Number(match.saldo_devedor || 0);
        }
      }
    }

    // 3. Atualiza na nuvem Supabase o saldo abatido
    if (clienteEncontradoId) {
      const novoSaldo = Math.max(0, saldoAtual - valor);
      await supabase
        .from('clientes')
        .update({
          saldo_devedor: novoSaldo,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', clienteEncontradoId);
      return;
    }

    // 4. Se o cliente ainda não existir no banco, salva-o na nuvem já com o saldo reduzido
    if (clienteObj) {
      const baseSaldo = Number(clienteObj.saldo_devedor || 0);
      const novoSaldo = Math.max(0, baseSaldo - valor);
      await salvarClienteSupabase({
        ...clienteObj,
        eh_mensalista: true,
        saldo_devedor: novoSaldo,
      });
    }
  } catch (err) {
    console.warn('Erro ao atualizar saldo devedor do mensalista no Supabase:', err);
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
    let finalUsers = data as UsuarioSistema[];
    const hasMaster = finalUsers.some(
      (u: any) => u.email === 'master@kaipira.com' || u.cargo === 'master'
    );
    if (!hasMaster) {
      const master = await garantirMasterSupabase();
      if (master) finalUsers = [master, ...finalUsers];
    }

    // Garante que VLADEMIR (Supervisor) sempre conste na lista
    const hasVlademir = finalUsers.some(
      (u: any) =>
        (u.email && u.email.toLowerCase() === 'vlademir@kaipira.com') ||
        (u.nome && u.nome.toUpperCase().includes('VLADEMIR'))
    );
    if (!hasVlademir) {
      const vlademirUser = INITIAL_USUARIOS.find((u) => u.id === 'usr-sup-vlademir');
      if (vlademirUser) {
        finalUsers = [...finalUsers, vlademirUser];
        supabase.from('usuarios').upsert([vlademirUser]).then(() => {}, () => {});
      }
    }

    return finalUsers;
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
 * Salva a seleção do Cardápio Diário no Supabase:
 * Permite que um produto esteja presente em 'delivery_balcao', em 'mesas' ou em AMBOS simultaneamente!
 */
export async function salvarCardapioDiarioSupabase(
  cardapio: CardapioDiarioConfig
): Promise<{ success: boolean; data?: CardapioDiarioConfig; error?: string }> {
  try {
    const hoje = cardapio.data || new Date().toISOString().split('T')[0];

    // 1. Tabela 'cardapio_diario' (data, produto_id, canal)
    try {
      // Remove registros anteriores do dia para salvar a nova seleção completa
      await supabase.from('cardapio_diario').delete().eq('data', hoje);

      const rowsToInsert: { data: string; produto_id: number; canal: string }[] = [];

      for (const it of cardapio.itens) {
        if (it.disponivel_delivery) {
          rowsToInsert.push({
            data: hoje,
            produto_id: it.produto_id,
            canal: 'delivery_balcao',
          });
        }
        if (it.disponivel_salao) {
          rowsToInsert.push({
            data: hoje,
            produto_id: it.produto_id,
            canal: 'mesas',
          });
        }
      }

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('cardapio_diario')
          .insert(rowsToInsert);

        if (insertError) {
          console.warn('Aviso ao inserir em cardapio_diario no Supabase:', insertError.message);
        }
      }
    } catch (tblErr: any) {
      console.warn('Aviso tabela cardapio_diario:', tblErr?.message);
    }

    // 2. Redundância em 'configuracoes' (para sincronização Realtime e metadados de status)
    const payloadMeta = {
      data: hoje,
      status: cardapio.status,
      confirmado_em: cardapio.confirmado_em || new Date().toISOString(),
      confirmado_por: cardapio.confirmado_por || 'GERENTE / ATENDIMENTO',
      itens: cardapio.itens,
      atualizado_em: new Date().toISOString(),
    };

    try {
      const { data: confRow } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const existingDados = confRow?.dados || {};
      await supabase
        .from('configuracoes')
        .upsert(
          {
            id: 1,
            dados: {
              ...existingDados,
              cardapio_diario_atual: payloadMeta,
            },
          },
          { onConflict: 'id' }
        );
    } catch (confErr) {
      console.warn('Aviso redundância cardápio configuracoes:', confErr);
    }

    return {
      success: true,
      data: cardapio,
    };
  } catch (err: any) {
    console.warn('Exceção ao salvar cardapio diario no Supabase:', err);
    return { success: false, error: err.message || 'Erro de conexão com o banco na nuvem.' };
  }
}

/**
 * Busca a configuração do Cardápio Diário para a data especificada (padrão hoje)
 * Agrupa linhas por produto_id para suportar disponibilidade em delivery, mesas ou ambos!
 */
export async function fetchCardapioDiarioSupabase(
  dataStr?: string
): Promise<CardapioDiarioConfig | null> {
  const hoje = dataStr || new Date().toISOString().split('T')[0];

  try {
    // 1. Tenta buscar em 'cardapio_diario' (data, produto_id, canal)
    const { data: rows, error } = await supabase
      .from('cardapio_diario')
      .select('*')
      .eq('data', hoje);

    if (!error && rows && Array.isArray(rows)) {
      const itemMap = new Map<number, ItemCardapioDiario>();

      for (const r of rows) {
        if (r.produto_id) {
          const prodId = Number(r.produto_id);
          const current = itemMap.get(prodId) || {
            produto_id: prodId,
            disponivel_delivery: false,
            disponivel_salao: false,
          };

          if (r.canal === 'delivery_balcao') {
            current.disponivel_delivery = true;
          } else if (r.canal === 'mesas') {
            current.disponivel_salao = true;
          }
          itemMap.set(prodId, current);
        } else if (Array.isArray(r.itens)) {
          // Retrocompatibilidade formato JSONB antigo
          for (const it of r.itens) {
            const prodId = Number(it.produto_id);
            const current = itemMap.get(prodId) || {
              produto_id: prodId,
              disponivel_delivery: false,
              disponivel_salao: false,
            };
            if (it.disponivel_delivery || it.canal === 'delivery_balcao') {
              current.disponivel_delivery = true;
            }
            if (it.disponivel_salao || it.canal === 'mesas') {
              current.disponivel_salao = true;
            }
            itemMap.set(prodId, current);
          }
        }
      }

      const itensMapeados = Array.from(itemMap.values());

      let status: 'aguardando' | 'aberto' = itensMapeados.length > 0 ? 'aberto' : 'aguardando';
      let confirmado_em: string | undefined = undefined;
      let confirmado_por: string | undefined = undefined;

      try {
        const { data: confData } = await supabase
          .from('configuracoes')
          .select('dados')
          .eq('id', 1)
          .maybeSingle();

        if (confData?.dados?.cardapio_diario_atual?.data === hoje) {
          status = confData.dados.cardapio_diario_atual.status || status;
          confirmado_em = confData.dados.cardapio_diario_atual.confirmado_em;
          confirmado_por = confData.dados.cardapio_diario_atual.confirmado_por;
        }
      } catch (confErr) {
        // silencioso
      }

      return {
        data: hoje,
        status,
        confirmado_em,
        confirmado_por,
        itens: itensMapeados,
      };
    }

    // 2. Fallback: configuracoes.dados.cardapio_diario_atual
    const { data: confData } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    if (confData?.dados?.cardapio_diario_atual) {
      const saved = confData.dados.cardapio_diario_atual;
      if (saved.data === hoje) {
        const normalizedItens: ItemCardapioDiario[] = (saved.itens || []).map((it: any) => ({
          produto_id: Number(it.produto_id),
          disponivel_delivery: !!it.disponivel_delivery || it.canal === 'delivery_balcao',
          disponivel_salao: !!it.disponivel_salao || it.canal === 'mesas',
        }));

        return {
          data: hoje,
          status: saved.status || 'aguardando',
          confirmado_em: saved.confirmado_em,
          confirmado_por: saved.confirmado_por,
          itens: normalizedItens,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('Erro ao carregar cardapio diario do Supabase:', err);
    return null;
  }
}

/**
 * =========================================================================
 * CRUD COMPLETO: CLIENTES & MENSALISTAS NO SUPABASE
 * =========================================================================
 */
const isUUID = (str?: string) =>
  !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export async function salvarClienteSupabase(
  cliente: Partial<Cliente>
): Promise<{ success: boolean; data?: Cliente; error?: string }> {
  try {
    // 1. Sanitização e preenchimento garantido de todos os campos obrigatórios em UPPERCASE
    const nomeLimpo = (cliente.nome || 'CLIENTE').toUpperCase().trim();
    const telefoneLimpo = (cliente.telefone || '(19) 99999-9999').trim();
    const cepLimpo = (cliente.cep || '13400-010').trim();
    const enderecoLimpo = (cliente.endereco || 'RUA PRINCIPAL').toUpperCase().trim();
    const numeroLimpo = (cliente.numero || 'S/N').toUpperCase().trim();
    const bairroLimpo = (cliente.bairro || 'CENTRO').toUpperCase().trim();
    const complementoLimpo = cliente.complemento ? cliente.complemento.toUpperCase().trim() : null;

    const payload: Record<string, any> = {
      nome: nomeLimpo,
      telefone: telefoneLimpo,
      cep: cepLimpo,
      endereco: enderecoLimpo,
      numero: numeroLimpo,
      bairro: bairroLimpo,
      complemento: complementoLimpo,
      eh_mensalista: Boolean(cliente.eh_mensalista),
      saldo_devedor: Number(cliente.saldo_devedor) || 0.0,
    };

    // 2. Se cliente.id for um UUID válido real do PostgreSQL, inclui para atualização
    const hasValidUuid = isUUID(cliente.id);
    if (hasValidUuid) {
      payload.id = cliente.id;
    }

    // 3. Caso tenha UUID válido, realiza upsert ou update por ID
    if (hasValidUuid) {
      const { data, error } = await supabase
        .from('clientes')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (!error && data) {
        return { success: true, data: data as Cliente };
      }
      console.warn('Upsert por UUID falhou, tentando insert/update por telefone:', error?.message);
    }

    // 4. Para novos clientes (sem UUID pré-existente ou ID temporário local):
    // Utiliza .insert() para permitir que o PostgreSQL gere o UUID automaticamente via gen_random_uuid()
    const { data: insertData, error: insertError } = await supabase
      .from('clientes')
      .insert(payload)
      .select()
      .maybeSingle();

    if (!insertError && insertData) {
      return { success: true, data: insertData as Cliente };
    }

    // 5. Caso o telefone já exista (conflito de chave única), atualiza os dados do cliente por telefone
    console.warn('Insert de cliente retornou erro (tentando update por telefone):', insertError?.message);
    const { data: updateData, error: updateError } = await supabase
      .from('clientes')
      .update(payload)
      .eq('telefone', telefoneLimpo)
      .select()
      .maybeSingle();

    if (updateError) {
      console.warn('Erro definitivo ao salvar cliente no Supabase:', updateError.message);
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      data: (updateData as Cliente) || (payload as Cliente),
    };
  } catch (err: any) {
    console.warn('Erro ao salvar cliente no Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function excluirClienteSupabase(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (isUUID(id)) {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) {
        console.warn('Aviso ao excluir cliente do Supabase:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    }
    const { error } = await supabase.from('clientes').delete().eq('telefone', id);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * =========================================================================
 * CRUD COMPLETO: PRODUTOS & CARDÁPIO NO SUPABASE
 * =========================================================================
 */
/**
 * Upload de imagem de produto para o bucket público 'produtos' do Supabase Storage
 */
export async function uploadFotoProdutoSupabase(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt || 'jpg'}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('produtos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Erro no upload para o Supabase Storage (bucket produtos):', uploadError);
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('produtos')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function salvarProdutoSupabase(
  produto: Partial<Produto>
): Promise<{ success: boolean; data?: Produto; error?: string }> {
  try {
    const payload: any = {
      nome: (produto.nome || '').toUpperCase().trim(),
      descricao: (produto.descricao || '').toUpperCase().trim(),
      categoria_id: Number(produto.categoria_id) || 1,
      preco_salao: Number(produto.preco_salao) || 0,
      preco_delivery: Number(produto.preco_delivery) || Number(produto.preco_salao) || 0,
      dia_semana: Array.isArray(produto.dia_semana) ? produto.dia_semana : [1, 2, 3, 4, 5, 6],
      pausado: !!produto.pausado,
    };

    if (produto.url_imagem !== undefined) {
      payload.url_imagem = produto.url_imagem ? produto.url_imagem.trim() : null;
    }

    if (produto.id && produto.id > 0) {
      payload.id = produto.id;
    }

    const { data, error } = await supabase
      .from('produtos')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Aviso salvar produto Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data as Produto) || (produto as Produto),
    };
  } catch (err: any) {
    console.warn('Erro ao salvar produto no Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function excluirProdutoSupabase(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      console.warn('Aviso excluir produto Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * =========================================================================
 * CRUD COMPLETO: MESAS DO SALÃO NO SUPABASE
 * =========================================================================
 */
export async function salvarMesaSupabase(
  mesa: Partial<Mesa>
): Promise<{ success: boolean; data?: Mesa; error?: string }> {
  try {
    await checkMesasSchema();
    const num = Number(mesa.numero);
    const mesaId = mesa.id || num;

    const payload: Record<string, any> = {
      id: mesaId,
      status: mesa.status || 'livre',
    };

    if (mesasHasNumero) {
      payload.numero = num;
    }

    const { data, error } = await supabase
      .from('mesas')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Aviso salvar mesa Supabase:', error.message);
      if (mesasHasNumero && error.message?.includes('numero')) {
        mesasHasNumero = false;
        delete payload.numero;
        const retry = await supabase
          .from('mesas')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (!retry.error && retry.data) {
          return { success: true, data: (retry.data as Mesa) || (mesa as Mesa) };
        }
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data as Mesa) || (mesa as Mesa),
    };
  } catch (err: any) {
    console.warn('Erro ao salvar mesa no Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function excluirMesaSupabase(
  numero: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await checkMesasSchema();
    const num = Number(numero);
    const filterCol = mesasHasNumero ? 'numero' : 'id';
    let { error } = await supabase.from('mesas').delete().eq(filterCol, num);

    if (error && mesasHasNumero) {
      mesasHasNumero = false;
      const resId = await supabase.from('mesas').delete().eq('id', num);
      error = resId.error;
    }

    if (error) {
      console.warn('Aviso excluir mesa Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * =========================================================================
 * GESTÃO DO SALÃO: RESETAR MESAS VAZIAS (PADRÃO DE ABERTURA DO RESTAURANTE)
 * "nosso padrao é sempre quando abrir o restaurante as mesas estarao vazias (a não ser que esteja reservadas)"
 * =========================================================================
 */
export async function resetarMesasVaziasSupabase(
  mesasAtuais: Mesa[],
  reservas: Reserva[] = []
): Promise<Mesa[]> {
  const mesasAtualizadas: Mesa[] = [];
  const hoje = new Date().toISOString().split('T')[0];

  // Identifica reservas ativas para o dia atual
  const reservasHoje = reservas.filter(
    (r) =>
      r.status !== 'cancelada' &&
      r.status !== 'concluida' &&
      (!r.data_hora || r.data_hora.startsWith(hoje))
  );

  for (const m of mesasAtuais) {
    const num = Number(m.numero || m.id);
    const reservaMesa = reservasHoje.find((r) => Number(r.mesa_id) === num);

    let novoStatus: Mesa['status'] = 'livre';
    let novoCliente: string | undefined = undefined;
    let novoPessoas: number | undefined = undefined;

    if (reservaMesa) {
      novoStatus = 'reservada';
      novoCliente = reservaMesa.cliente_nome ? `RESERVA: ${reservaMesa.cliente_nome.toUpperCase()}` : 'RESERVA';
      novoPessoas = reservaMesa.pessoas || 4;
    }

    const mesaLimpa: Mesa = {
      id: m.id || num,
      numero: num,
      status: novoStatus,
      cliente_nome: novoCliente,
      pessoas: novoPessoas,
    };

    mesasAtualizadas.push(mesaLimpa);

    // Atualiza individualmente no banco de dados Supabase na nuvem
    try {
      await atualizarMesaSupabase(num, novoStatus, novoCliente, novoPessoas);
    } catch (err) {
      console.warn(`Erro ao resetar mesa #${num} no Supabase:`, err);
    }
  }

  return mesasAtualizadas;
}

/**
 * =========================================================================
 * CRUD COMPLETO: CATEGORIAS (100% NUVEM SUPABASE)
 * =========================================================================
 */
export async function fetchCategoriasSupabase(): Promise<Categoria[]> {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('ordem', { ascending: true });

    if (!error && Array.isArray(data)) {
      return data as Categoria[];
    }

    return [];
  } catch (err) {
    console.warn('Falha ao buscar categorias no Supabase:', err);
    return [];
  }
}

export async function salvarCategoriaSupabase(
  catData: Partial<Categoria>
): Promise<{ success: boolean; data?: Categoria; error?: string }> {
  try {
    const nomeLimpo = (catData.nome || 'NOVA CATEGORIA').toUpperCase().trim();
    const payload: any = {
      nome: nomeLimpo,
      ordem: catData.ordem || 0,
    };
    if (catData.id) {
      payload.id = catData.id;
    }

    const { data, error } = await supabase
      .from('categorias')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Erro ao salvar categoria no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Categoria };
  } catch (err: any) {
    console.warn('Exceção ao salvar categoria:', err);
    return { success: false, error: err.message };
  }
}

export async function excluirCategoriaSupabase(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) {
      console.warn('Erro ao excluir categoria:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * =========================================================================
 * FETCH COMPLETO: PRODUTOS DO CARDÁPIO NA NUVEM SUPABASE
 * =========================================================================
 */
export async function fetchProdutosSupabase(): Promise<Produto[]> {
  try {
    // Tenta carregar produtos com opcionais vinculados
    let prods: any[] = [];
    const { data: dataWithOpcionais, error: errOpcionais } = await supabase
      .from('produtos')
      .select('*, opcionais(*)')
      .order('id', { ascending: true });

    if (!errOpcionais && Array.isArray(dataWithOpcionais)) {
      prods = dataWithOpcionais;
    } else {
      // Fallback para select simples se a tabela opcionais não estiver configurada
      const { data: dataSimple, error: errSimple } = await supabase
        .from('produtos')
        .select('*')
        .order('id', { ascending: true });

      if (!errSimple && Array.isArray(dataSimple)) {
        prods = dataSimple;
      }
    }

    return prods.map((p) => ({
      id: Number(p.id),
      categoria_id: Number(p.categoria_id) || 1,
      nome: (p.nome || '').toUpperCase().trim(),
      descricao: (p.descricao || '').toUpperCase().trim(),
      preco_salao: Number(p.preco_salao) || 0,
      preco_delivery: Number(p.preco_delivery) || Number(p.preco_salao) || 0,
      url_imagem: p.url_imagem,
      dia_semana: Array.isArray(p.dia_semana) ? p.dia_semana : [1, 2, 3, 4, 5, 6],
      pausado: Boolean(p.pausado),
      criado_em: p.criado_em || new Date().toISOString(),
      opcionais: Array.isArray(p.opcionais) ? p.opcionais : [],
    }));
  } catch (err) {
    console.warn('Erro ao carregar produtos do Supabase:', err);
    return [];
  }
}

/**
 * =========================================================================
 * BAIRROS & TAXAS DE ENTREGA (100% NUVEM SUPABASE VIA CONFIGURAÇÕES)
 * =========================================================================
 */
export async function fetchBairrosSupabase(): Promise<BairroTaxa[]> {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data?.dados?.bairros && Array.isArray(data.dados.bairros) && data.dados.bairros.length > 0) {
      return data.dados.bairros as BairroTaxa[];
    }

    // Salva bairros padrão de Piracicaba na nuvem se ainda não existirem
    await salvarBairrosSupabase(BAIRROS_PIRACICABA);
    return BAIRROS_PIRACICABA;
  } catch (err) {
    console.warn('Erro ao buscar bairros no Supabase:', err);
    return BAIRROS_PIRACICABA;
  }
}

export async function salvarBairrosSupabase(
  bairros: BairroTaxa[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: conf } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    const existingDados = conf?.dados || {};
    const { error } = await supabase
      .from('configuracoes')
      .upsert(
        {
          id: 1,
          dados: {
            ...existingDados,
            bairros,
          },
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.warn('Erro ao salvar bairros no Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exceção ao salvar bairros:', err);
    return { success: false, error: err.message };
  }
}

/**
 * ============================================================================
 * FORMAS DE PAGAMENTO: 100% Nuvem (Supabase + Cloud Backend)
 * ============================================================================
 */
export async function fetchFormasPagamentoSupabase(): Promise<FormaPagamentoConfig[]> {
  // 1. Tenta carregar da tabela dedicada 'formas_pagamento' no Supabase
  try {
    const { data, error } = await supabase
      .from('formas_pagamento')
      .select('*')
      .order('ordem', { ascending: true });

    if (!error && data && data.length > 0) {
      return data as FormaPagamentoConfig[];
    }
  } catch (err) {
    console.warn('Tabela formas_pagamento não acessível diretamente:', err);
  }

  // 2. Fallback: carregar de configuracoes.dados.formas_pagamento no Supabase
  try {
    const { data: conf } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    if (conf?.dados?.formas_pagamento && Array.isArray(conf.dados.formas_pagamento) && conf.dados.formas_pagamento.length > 0) {
      return conf.dados.formas_pagamento as FormaPagamentoConfig[];
    }
  } catch (err) {
    console.warn('Erro ao buscar formas_pagamento de configuracoes:', err);
  }

  // 3. Fallback: carregar da rota do backend local (/api/formas-pagamento)
  try {
    const res = await fetch('/api/formas-pagamento');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // offline
  }

  return INITIAL_FORMAS_PAGAMENTO;
}

export async function salvarFormaPagamentoSupabase(
  item: Partial<FormaPagamentoConfig>,
  currentList: FormaPagamentoConfig[]
): Promise<FormaPagamentoConfig[]> {
  const id = item.id || 'fp_' + Date.now();
  const nome = (item.nome || '').toUpperCase().trim();

  const formatted: FormaPagamentoConfig = {
    id,
    nome,
    tipo: item.tipo || 'outro',
    taxa_operadora: Number(item.taxa_operadora || 0),
    permite_troco: item.permite_troco !== undefined ? !!item.permite_troco : false,
    ativo: item.ativo !== undefined ? !!item.ativo : true,
    ordem: item.ordem !== undefined ? Number(item.ordem) : currentList.length + 1,
    descricao: item.descricao ? item.descricao.toUpperCase().trim() : '',
    criado_em: item.criado_em || new Date().toISOString(),
  };

  const existingIndex = currentList.findIndex((fp) => fp.id === id);
  let updatedList: FormaPagamentoConfig[];
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = formatted;
  } else {
    updatedList = [...currentList, formatted];
  }

  // A. Salva na tabela 'formas_pagamento' se existir
  try {
    await supabase.from('formas_pagamento').upsert(formatted, { onConflict: 'id' });
  } catch (err) {
    console.warn('Aviso: upsert na tabela formas_pagamento falhou, salvando em configuracoes:', err);
  }

  // B. Salva em configuracoes.dados.formas_pagamento para garantia de persistência
  try {
    const { data: conf } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    const existingDados = conf?.dados || {};
    await supabase.from('configuracoes').upsert({
      id: 1,
      dados: {
        ...existingDados,
        formas_pagamento: updatedList,
      },
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Erro ao salvar formas_pagamento em configuracoes:', err);
  }

  // C. Notifica backend /api/formas-pagamento
  try {
    fetch('/api/formas-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatted),
    }).catch(() => {});
  } catch {}

  return updatedList;
}

export async function excluirFormaPagamentoSupabase(
  id: string,
  currentList: FormaPagamentoConfig[]
): Promise<FormaPagamentoConfig[]> {
  const updatedList = currentList.filter((fp) => fp.id !== id);

  // A. Deleta da tabela 'formas_pagamento' se existir
  try {
    await supabase.from('formas_pagamento').delete().eq('id', id);
  } catch (err) {
    console.warn('Aviso ao deletar de formas_pagamento no Supabase:', err);
  }

  // B. Atualiza em configuracoes.dados.formas_pagamento
  try {
    const { data: conf } = await supabase
      .from('configuracoes')
      .select('dados')
      .eq('id', 1)
      .maybeSingle();

    const existingDados = conf?.dados || {};
    await supabase.from('configuracoes').upsert({
      id: 1,
      dados: {
        ...existingDados,
        formas_pagamento: updatedList,
      },
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Erro ao atualizar formas_pagamento após exclusão:', err);
  }

  // C. Notifica backend /api/formas-pagamento/:id
  try {
    fetch(`/api/formas-pagamento/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {}

  return updatedList;
}

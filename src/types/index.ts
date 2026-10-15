export type TipoUsuario = 'master' | 'admin' | 'atendente' | 'cozinha' | 'garcom' | 'entregador';
export type TipoPedido = 'salão' | 'retirada' | 'delivery';
export type StatusPedido = 'pendente' | 'em_preparacao' | 'pronto' | 'a_caminho' | 'entregue' | 'cancelado';
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'mensalista';

export interface UsuarioSistema {
  id: string;
  nome: string; // UPPERCASE
  email: string; // único, formato livre
  telefone: string; // com máscara (99) 9-9999-9999
  cargo: TipoUsuario;
  status: 'ativo' | 'inativo';
  senha?: string;
  criado_em: string;
  atualizado_em?: string;
}

export interface Perfil {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cargo: TipoUsuario;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  complemento?: string;
  eh_mensalista: boolean;
  saldo_devedor: number;
  criado_em: string;
}

export interface Categoria {
  id: number;
  nome: string;
  ordem: number;
}

export interface Opcional {
  id: number;
  produto_id: number;
  nome: string;
  preco_adicional: number;
}

export interface Produto {
  id: number;
  categoria_id: number;
  nome: string;
  descricao: string;
  preco_salao: number;
  preco_delivery: number;
  url_imagem?: string;
  dia_semana: number[]; // [1..6] (1 = Segunda, 6 = Sábado)
  pausado: boolean;
  criado_em: string;
  opcionais?: Opcional[];
}

export type CanalCardapio = 'delivery_balcao' | 'mesas';

export interface ItemCardapioDiario {
  produto_id: number;
  canal: CanalCardapio; // 'delivery_balcao' ou 'mesas' (exclusivo)
  disponivel_delivery?: boolean;
  disponivel_salao?: boolean;
}

export interface CardapioDiarioConfig {
  data: string; // YYYY-MM-DD
  status: 'aguardando' | 'aberto';
  confirmado_em?: string;
  confirmado_por?: string;
  itens: ItemCardapioDiario[];
}

export interface ItemEstoque {
  id: number;
  item_nome: string;
  quantidade_atual: number;
  unidade_medida: string;
  estoque_minimo: number;
  fornecedor_info?: string;
  atualizado_em: string;
}

export interface Mesa {
  id: number;
  numero: number;
  status: 'livre' | 'ocupada' | 'reservada' | 'conta';
  cliente_nome?: string;
  pessoas?: number;
}

export interface Reserva {
  id: number;
  cliente_nome: string;
  telefone: string;
  mesa_id: number;
  data_hora: string;
  status: 'confirmada' | 'cancelada' | 'concluida';
  observacoes?: string;
}

export interface ItemPedido {
  id: number;
  pedido_id: number;
  produto_id: number;
  produto_nome?: string;
  quantidade: number;
  observacao?: string;
  preco_unitario: number;
  opcionais_selecionados?: {
    id: number;
    nome: string;
    preco_adicional: number;
  }[];
}

export interface Pagamento {
  id: number;
  pedido_id: number;
  forma: FormaPagamento;
  valor: number;
  criado_em: string;
}

export interface Pedido {
  id: number;
  codigo_senha: number;
  tipo: TipoPedido;
  status: StatusPedido;
  cliente_id?: string;
  cliente?: Cliente;
  mesa_id?: number;
  precisa_troco: boolean;
  troco_para?: number;
  motoboy_tipo?: 'proprio' | 'app' | 'terceiro';
  entregador_nome?: string;
  valor_total: number;
  taxa_entrega: number;
  itens: ItemPedido[];
  pagamentos: Pagamento[];
  criado_em: string;
  atualizado_em: string;
}

export interface MovimentacaoCaixa {
  id: number;
  tipo: 'entrada_pedido' | 'suprimento' | 'sangria';
  forma?: FormaPagamento;
  valor: number;
  descricao: string;
  hora: string;
  pedido_id?: number;
}

export interface CaixaDiario {
  id: number;
  data_caixa: string;
  valor_abertura: number;
  valor_fechamento?: number;
  status: 'aberto' | 'fechado';
  observacoes?: string;
  aberto_em: string;
  fechado_em?: string;
  movimentacoes: MovimentacaoCaixa[];
}

export interface BairroTaxa {
  bairro: string;
  taxa: number;
}

export type PosicaoMenu = 'direita' | 'esquerda' | 'topo';
export type PadraoCor = 'ambar' | 'terracota' | 'verde' | 'carvao' | 'cafe';

export interface ConfiguracoesSistema {
  // Banco de Dados
  supabaseUrl: string;
  supabaseAnonKey: string;
  bancoStatus: 'conectado' | 'pendente' | 'erro';
  // Dados do Restaurante
  nomeRestaurante: string;
  email: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  horarioFuncionamento: string;
  // Tela e Layout
  posicaoMenu: PosicaoMenu;
  padraoCor: PadraoCor;
}

import React, { useState, useRef } from 'react';
import {
  UsuarioSistema,
  TipoUsuario,
  Cliente,
  Produto,
  Categoria,
  Mesa,
  Perfil,
  BairroTaxa,
  ItemEstoque,
  FormaPagamentoConfig,
} from '../types';
import { StockManager } from './StockManager';
import { formatPhone, formatBRL } from '../utils/formatters';
import { UpperInput, UpperTextarea } from './UpperInput';
import {
  salvarUsuarioSupabase,
  excluirUsuarioSupabase,
  garantirMasterSupabase,
  salvarClienteSupabase,
  excluirClienteSupabase,
  salvarProdutoSupabase,
  excluirProdutoSupabase,
  uploadFotoProdutoSupabase,
  salvarMesaSupabase,
  excluirMesaSupabase,
  excluirCategoriaSupabase,
} from '../services/supabaseClient';
import {
  Users,
  UserCheck,
  UserPlus,
  Crown,
  Search,
  Edit2,
  Trash2,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  FileCode,
  Utensils,
  ShoppingBag,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCog,
  Briefcase,
  Store,
  Sparkles,
  LayoutGrid,
  List,
  Plus,
  X,
  Package,
  Flame,
  Coffee,
  Cake,
  Ban,
  CheckCircle,
  Tag,
  MapPin,
  Sliders,
  DollarSign,
  ArrowUpDown,
  Boxes,
  CreditCard,
  Camera,
  Image,
  Upload,
  Loader2,
} from 'lucide-react';

interface CadastrosHubProps {
  usuarios: UsuarioSistema[];
  onReloadUsuarios: () => Promise<void>;
  currentPerfil?: Perfil;
  clientes: Cliente[];
  produtos: Produto[];
  categorias: Categoria[];
  mesas: Mesa[];
  bairros?: BairroTaxa[];
  estoque?: ItemEstoque[];
  formasPagamento?: FormaPagamentoConfig[];
  onUpdateStockItem?: (id: number, data: Partial<ItemEstoque>) => void;
  onAddItemStock?: (item: Partial<ItemEstoque>) => void;
  onDeleteItemStock?: (id: number) => void;
  onOpenSupabaseModal: () => void;
  onNavigateTab: (tab: any) => void;
  onSaveCliente?: (c: Partial<Cliente>) => Promise<void>;
  onDeleteCliente?: (id: string) => Promise<boolean | void>;
  onSaveProduto?: (p: Partial<Produto>) => Promise<void>;
  onDeleteProduto?: (id: number) => Promise<boolean | void>;
  onSaveMesa?: (m: Partial<Mesa>) => Promise<void>;
  onDeleteMesa?: (numero: number) => Promise<void>;
  onSaveCategoria?: (cat: Partial<Categoria>) => Promise<void>;
  onDeleteCategoria?: (id: number) => Promise<boolean | void>;
  onSaveBairro?: (b: Partial<BairroTaxa>, originalNome?: string) => Promise<void>;
  onDeleteBairro?: (bairro: string) => Promise<void>;
  onSaveFormaPagamento?: (fp: Partial<FormaPagamentoConfig>) => Promise<void>;
  onDeleteFormaPagamento?: (id: string) => Promise<void>;
  onCadastrarCliente?: (c: Partial<Cliente>) => void;
  onTogglePauseProduto?: (id: number) => void;
}

export type CadastrosSubTab =
  | 'usuarios'
  | 'clientes'
  | 'produtos'
  | 'mesas'
  | 'categorias'
  | 'bairros'
  | 'insumos'
  | 'formas_pagamento'
  | 'sql';

export const CadastrosHub: React.FC<CadastrosHubProps> = ({
  usuarios,
  onReloadUsuarios,
  currentPerfil,
  clientes,
  produtos,
  categorias,
  mesas,
  bairros = [],
  estoque = [],
  formasPagamento = [],
  onUpdateStockItem,
  onAddItemStock,
  onDeleteItemStock,
  onOpenSupabaseModal,
  onNavigateTab,
  onSaveCliente,
  onDeleteCliente,
  onSaveProduto,
  onDeleteProduto,
  onSaveMesa,
  onDeleteMesa,
  onSaveCategoria,
  onDeleteCategoria,
  onSaveBairro,
  onDeleteBairro,
  onSaveFormaPagamento,
  onDeleteFormaPagamento,
  onTogglePauseProduto,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CadastrosSubTab>('usuarios');

  // View Mode state (Bloco vs Lista) for every single cadastre block
  const [usuariosViewMode, setUsuariosViewMode] = useState<'bloco' | 'lista'>('bloco');
  const [clientesViewMode, setClientesViewMode] = useState<'bloco' | 'lista'>('bloco');
  const [produtosViewMode, setProdutosViewMode] = useState<'bloco' | 'lista'>('bloco');
  const [mesasViewMode, setMesasViewMode] = useState<'bloco' | 'lista'>('bloco');
  const [categoriasViewMode, setCategoriasViewMode] = useState<'bloco' | 'lista'>('bloco');
  const [bairrosViewMode, setBairrosViewMode] = useState<'bloco' | 'lista'>('bloco');

  // Sort Mode state (Inicialmente organizadas por Nome/Descrição A-Z, com opção por Ordem de Cadastro)
  const [usuariosSortMode, setUsuariosSortMode] = useState<'nome' | 'cadastro'>('nome');
  const [clientesSortMode, setClientesSortMode] = useState<'nome' | 'cadastro'>('nome');
  const [produtosSortMode, setProdutosSortMode] = useState<'nome' | 'cadastro'>('nome');
  const [mesasSortMode, setMesasSortMode] = useState<'nome' | 'cadastro'>('nome');
  const [categoriasSortMode, setCategoriasSortMode] = useState<'nome' | 'cadastro'>('nome');
  const [bairrosSortMode, setBairrosSortMode] = useState<'nome' | 'cadastro'>('nome');

  // Global Feedback Notification
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // =========================================================================
  // 1. USUÁRIOS STATE & MODAL
  // =========================================================================
  const [userSearch, setUserSearch] = useState('');
  const [filterCargo, setFilterCargo] = useState<string>('todos');
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formUserNome, setFormUserNome] = useState('');
  const [formUserEmail, setFormUserEmail] = useState('');
  const [formUserTelefone, setFormUserTelefone] = useState('');
  const [formUserCargo, setFormUserCargo] = useState<TipoUsuario>('atendente');
  const [formUserSenha, setFormUserSenha] = useState('1234');
  const [formUserStatus, setFormUserStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UsuarioSistema | null>(null);
  const [isSeedingMaster, setIsSeedingMaster] = useState(false);

  // =========================================================================
  // 2. CLIENTES STATE & MODAL
  // =========================================================================
  const [clientSearch, setClientSearch] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formClientNome, setFormClientNome] = useState('');
  const [formClientTelefone, setFormClientTelefone] = useState('');
  const [formClientCep, setFormClientCep] = useState('13400-010');
  const [formClientEndereco, setFormClientEndereco] = useState('');
  const [formClientNumero, setFormClientNumero] = useState('');
  const [formClientBairro, setFormClientBairro] = useState('CENTRO');
  const [formClientComplemento, setFormClientComplemento] = useState('');
  const [formClientEhMensalista, setFormClientEhMensalista] = useState(false);
  const [formClientSaldoDevedor, setFormClientSaldoDevedor] = useState('0');
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null);

  // =========================================================================
  // 3. PRODUTOS STATE & MODAL
  // =========================================================================
  const [prodSearch, setProdSearch] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | 'todas'>('todas');
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [formProdNome, setFormProdNome] = useState('');
  const [formProdDescricao, setFormProdDescricao] = useState('');
  const [formProdCategoriaId, setFormProdCategoriaId] = useState<number>(1);
  const [formProdPrecoSalao, setFormProdPrecoSalao] = useState('');
  const [formProdPrecoDelivery, setFormProdPrecoDelivery] = useState('');
  const [formProdDiasSemana, setFormProdDiasSemana] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [formProdPausado, setFormProdPausado] = useState(false);
  const [formProdUrlImagem, setFormProdUrlImagem] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadImageError, setUploadImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productToDelete, setProductToDelete] = useState<Produto | null>(null);

  // =========================================================================
  // 4. MESAS STATE & MODAL
  // =========================================================================
  const [showMesaModal, setShowMesaModal] = useState(false);
  const [isEditingMesa, setIsEditingMesa] = useState(false);
  const [formMesaNumero, setFormMesaNumero] = useState('');
  const [formMesaStatus, setFormMesaStatus] = useState<Mesa['status']>('livre');
  const [formMesaPessoas, setFormMesaPessoas] = useState('2');
  const [formMesaCliente, setFormMesaCliente] = useState('');
  const [mesaToDelete, setMesaToDelete] = useState<Mesa | null>(null);

  // =========================================================================
  // 5. CATEGORIAS STATE & MODAL
  // =========================================================================
  const [categoriaSearch, setCategoriaSearch] = useState('');
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [isEditingCategoria, setIsEditingCategoria] = useState(false);
  const [editingCategoriaId, setEditingCategoriaId] = useState<number | null>(null);
  const [formCategoriaNome, setFormCategoriaNome] = useState('');
  const [formCategoriaOrdem, setFormCategoriaOrdem] = useState('1');
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null);

  // =========================================================================
  // 6. BAIRROS STATE & MODAL
  // =========================================================================
  const [bairroSearch, setBairroSearch] = useState('');
  const [showBairroModal, setShowBairroModal] = useState(false);
  const [isEditingBairro, setIsEditingBairro] = useState(false);
  const [editingBairroOriginalNome, setEditingBairroOriginalNome] = useState<string | null>(null);
  const [formBairroNome, setFormBairroNome] = useState('');
  const [formBairroTaxa, setFormBairroTaxa] = useState('7.00');
  const [bairroToDelete, setBairroToDelete] = useState<BairroTaxa | null>(null);

  // =========================================================================
  // 7. FORMAS DE PAGAMENTO STATE & MODAL
  // =========================================================================
  const [formasPagamentoViewMode, setFormasPagamentoViewMode] = useState<'bloco' | 'lista'>('bloco');
  const [formasPagamentoSortMode, setFormasPagamentoSortMode] = useState<'ordem' | 'nome'>('ordem');
  const [fpSearch, setFpSearch] = useState('');
  const [fpFilterStatus, setFpFilterStatus] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [showFpModal, setShowFpModal] = useState(false);
  const [isEditingFp, setIsEditingFp] = useState(false);
  const [editingFpId, setEditingFpId] = useState<string | null>(null);
  const [formFpNome, setFormFpNome] = useState('');
  const [formFpTipo, setFormFpTipo] = useState<FormaPagamentoConfig['tipo']>('outro');
  const [formFpTaxa, setFormFpTaxa] = useState('0.00');
  const [formFpPermiteTroco, setFormFpPermiteTroco] = useState(false);
  const [formFpAtivo, setFormFpAtivo] = useState(true);
  const [formFpOrdem, setFormFpOrdem] = useState('1');
  const [formFpDescricao, setFormFpDescricao] = useState('');
  const [fpToDelete, setFpToDelete] = useState<FormaPagamentoConfig | null>(null);

  // SQL Copy state
  const [copiedSql, setCopiedSql] = useState(false);

  // =========================================================================
  // USUÁRIOS HANDLERS
  // =========================================================================
  const filteredUsuarios = usuarios.filter((u) => {
    if (filterCargo !== 'todos' && u.cargo !== filterCargo) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      const matchNome = (u.nome || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchTel = (u.telefone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      if (!matchNome && !matchEmail && !matchTel) return false;
    }
    return true;
  });

  // Todas as listas organizadas inicialmente por Nome / Descrição (A-Z) ou por Ordem de Cadastro
  const sortedUsuarios = [...filteredUsuarios].sort((a, b) => {
    if (usuariosSortMode === 'nome') {
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    return new Date(a.criado_em || 0).getTime() - new Date(b.criado_em || 0).getTime();
  });

  const filteredClientes = clientes.filter((c) => {
    if (!clientSearch) return true;
    const q = clientSearch.toLowerCase();
    return (c.nome || '').toLowerCase().includes(q) || (c.telefone || '').includes(q);
  });
  const sortedClientes = [...filteredClientes].sort((a, b) => {
    if (clientesSortMode === 'nome') {
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    return new Date(a.criado_em || 0).getTime() - new Date(b.criado_em || 0).getTime();
  });

  const filteredProdutos = produtos.filter((p) => {
    if (selectedCategoriaId !== 'todas' && p.categoria_id !== selectedCategoriaId)
      return false;
    if (prodSearch) {
      const q = prodSearch.toLowerCase();
      return (
        (p.nome || '').toLowerCase().includes(q) ||
        (p.descricao || '').toLowerCase().includes(q)
      );
    }
    return true;
  });
  const sortedProdutos = [...filteredProdutos].sort((a, b) => {
    if (produtosSortMode === 'nome') {
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    return a.id - b.id;
  });

  const sortedMesas = [...mesas].sort((a, b) => {
    if (mesasSortMode === 'nome') {
      return a.numero - b.numero;
    }
    return (a.id || a.numero) - (b.id || b.numero);
  });

  const filteredCategorias = categorias.filter((cat) => {
    if (!categoriaSearch) return true;
    return (cat.nome || '').toLowerCase().includes(categoriaSearch.toLowerCase());
  });
  const sortedCategorias = [...filteredCategorias].sort((a, b) => {
    if (categoriasSortMode === 'nome') {
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    return (a.ordem || a.id) - (b.ordem || b.id);
  });

  const filteredBairros = bairros.filter((b) => {
    if (!bairroSearch) return true;
    return (b.bairro || '').toLowerCase().includes(bairroSearch.toLowerCase());
  });
  const sortedBairros = [...filteredBairros].sort((a, b) => {
    if (bairrosSortMode === 'nome') {
      return (a.bairro || '').localeCompare(b.bairro || '', 'pt-BR');
    }
    return 0;
  });

  const openNewUserModal = () => {
    setIsEditingUser(false);
    setEditingUserId(null);
    setFormUserNome('');
    setFormUserEmail('');
    setFormUserTelefone('');
    setFormUserCargo('atendente');
    setFormUserSenha('1234');
    setFormUserStatus('ativo');
    setShowFormPassword(false);
    setFeedbackMessage(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (u: UsuarioSistema) => {
    setIsEditingUser(true);
    setEditingUserId(u.id);
    setFormUserNome(u.nome || '');
    setFormUserEmail(u.email || '');
    setFormUserTelefone(u.telefone || '');
    setFormUserCargo(u.cargo);
    setFormUserSenha(u.senha || 'DNDIGQOL');
    setFormUserStatus(u.status || 'ativo');
    setShowFormPassword(false);
    setFeedbackMessage(null);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (!formUserNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME É OBRIGATÓRIO (SERÁ SALVO EM MAIÚSCULAS).' });
      return;
    }
    if (!formUserEmail.trim() || !formUserEmail.includes('@')) {
      setFeedbackMessage({ type: 'error', text: 'INFORME UM E-MAIL VÁLIDO.' });
      return;
    }
    if (!formUserTelefone.trim() || formUserTelefone.replace(/\D/g, '').length < 10) {
      setFeedbackMessage({ type: 'error', text: 'INFORME O TELEFONE COMPLETO COM DDD.' });
      return;
    }

    setIsSaving(true);
    const payload: Partial<UsuarioSistema> = {
      id: editingUserId || undefined,
      nome: formUserNome.toUpperCase().trim(),
      email: formUserEmail.trim().toLowerCase(),
      telefone: formatPhone(formUserTelefone),
      cargo: formUserCargo,
      senha: formUserSenha,
      status: formUserStatus,
    };

    const res = await salvarUsuarioSupabase(payload);
    setIsSaving(false);

    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: isEditingUser ? 'USUÁRIO ATUALIZADO NO SUPABASE COM SUCESSO!' : 'NOVO USUÁRIO SALVO NO SUPABASE!',
      });
      setShowUserModal(false);
      await onReloadUsuarios();
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'FALHA AO GRAVAR NO SUPABASE.' });
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.cargo === 'master' || userToDelete.email === 'master@kaipira.com') {
      alert('O USUÁRIO MASTER NÃO PODE SER EXCLUÍDO DO SISTEMA POR SEGURANÇA.');
      setUserToDelete(null);
      return;
    }

    setIsSaving(true);
    const res = await excluirUsuarioSupabase(userToDelete.id);
    setIsSaving(false);
    setUserToDelete(null);

    if (res.success) {
      setFeedbackMessage({ type: 'success', text: 'USUÁRIO EXCLUÍDO DO SUPABASE COM SUCESSO.' });
      await onReloadUsuarios();
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'FALHA AO EXCLUIR NO SUPABASE.' });
    }
  };

  const handleSeedMasterNow = async () => {
    setIsSeedingMaster(true);
    setFeedbackMessage(null);
    try {
      await garantirMasterSupabase();
      await onReloadUsuarios();
      setFeedbackMessage({
        type: 'success',
        text: 'USUÁRIO MASTER (master@kaipira.com / DNDIGQOL) SINCRONIZADO NO SUPABASE COM SUCESSO!',
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'ERRO AO SINCRONIZAR MASTER: ' + err.message });
    } finally {
      setIsSeedingMaster(false);
    }
  };

  // =========================================================================
  // CLIENTES HANDLERS
  // =========================================================================
  const openNewClientModal = () => {
    setIsEditingClient(false);
    setEditingClientId(null);
    setFormClientNome('');
    setFormClientTelefone('');
    setFormClientCep('13400-010');
    setFormClientEndereco('RUA DO ROSÁRIO');
    setFormClientNumero('1240');
    setFormClientBairro('CENTRO');
    setFormClientComplemento('');
    setFormClientEhMensalista(false);
    setFormClientSaldoDevedor('0');
    setFeedbackMessage(null);
    setShowClientModal(true);
  };

  const openEditClientModal = (c: Cliente) => {
    setIsEditingClient(true);
    setEditingClientId(c.id);
    setFormClientNome(c.nome || '');
    setFormClientTelefone(c.telefone || '');
    setFormClientCep(c.cep || '13400-010');
    setFormClientEndereco(c.endereco || '');
    setFormClientNumero(c.numero || '');
    setFormClientBairro(c.bairro || 'CENTRO');
    setFormClientComplemento(c.complemento || '');
    setFormClientEhMensalista(!!c.eh_mensalista);
    setFormClientSaldoDevedor(String(c.saldo_devedor || 0));
    setFeedbackMessage(null);
    setShowClientModal(true);
  };

  const handleSaveClientForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME DO CLIENTE É OBRIGATÓRIO.' });
      return;
    }
    if (!formClientTelefone.trim() || formClientTelefone.replace(/\D/g, '').length < 10) {
      setFeedbackMessage({ type: 'error', text: 'INFORME O TELEFONE COMPLETO COM DDD.' });
      return;
    }

    setIsSaving(true);
    const clientPayload: Partial<Cliente> = {
      id: editingClientId || undefined,
      nome: formClientNome.toUpperCase().trim(),
      telefone: formatPhone(formClientTelefone),
      cep: formClientCep.trim(),
      endereco: formClientEndereco.toUpperCase().trim(),
      numero: formClientNumero.toUpperCase().trim(),
      bairro: formClientBairro.toUpperCase().trim(),
      complemento: formClientComplemento.toUpperCase().trim(),
      eh_mensalista: formClientEhMensalista,
      saldo_devedor: Number(formClientSaldoDevedor) || 0,
    };

    if (onSaveCliente) {
      await onSaveCliente(clientPayload);
    } else {
      await salvarClienteSupabase(clientPayload);
    }
    setIsSaving(false);
    setShowClientModal(false);
    setFeedbackMessage({
      type: 'success',
      text: isEditingClient ? 'CLIENTE ATUALIZADO NO SUPABASE COM SUCESSO!' : 'CLIENTE CADASTRADO NO SUPABASE!',
    });
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsSaving(true);
    let ok: boolean | void = true;
    if (onDeleteCliente) {
      ok = await onDeleteCliente(clientToDelete.id);
    } else {
      const res = await excluirClienteSupabase(clientToDelete.id);
      ok = res.success;
    }
    setIsSaving(false);
    setClientToDelete(null);
    if (ok !== false) {
      setFeedbackMessage({ type: 'success', text: 'CLIENTE EXCLUÍDO DO SUPABASE COM SUCESSO.' });
    }
  };

  // =========================================================================
  // PRODUTOS HANDLERS
  // =========================================================================
  const openNewProductModal = () => {
    setIsEditingProduct(false);
    setEditingProductId(null);
    setFormProdNome('');
    setFormProdDescricao('');
    setFormProdCategoriaId(1);
    setFormProdPrecoSalao('');
    setFormProdPrecoDelivery('');
    setFormProdDiasSemana([1, 2, 3, 4, 5, 6]);
    setFormProdPausado(false);
    setFormProdUrlImagem('');
    setUploadImageError(null);
    setFeedbackMessage(null);
    setShowProductModal(true);
  };

  const openEditProductModal = (p: Produto) => {
    setIsEditingProduct(true);
    setEditingProductId(p.id);
    setFormProdNome(p.nome || '');
    setFormProdDescricao(p.descricao || '');
    setFormProdCategoriaId(p.categoria_id || 1);
    setFormProdPrecoSalao(String(p.preco_salao || ''));
    setFormProdPrecoDelivery(String(p.preco_delivery || ''));
    setFormProdDiasSemana(p.dia_semana || [1, 2, 3, 4, 5, 6]);
    setFormProdPausado(!!p.pausado);
    setFormProdUrlImagem(p.url_imagem || '');
    setUploadImageError(null);
    setFeedbackMessage(null);
    setShowProductModal(true);
  };

  const handleUploadProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    setIsUploadingImage(true);
    setUploadImageError(null);
    try {
      const publicUrl = await uploadFotoProdutoSupabase(file);
      setFormProdUrlImagem(publicUrl);
    } catch (err: any) {
      console.error('Erro no upload de foto do produto:', err);
      const msg = err.message || 'Falha no upload para o bucket produtos';
      setUploadImageError(msg);
      alert('Erro ao enviar imagem para o Supabase Storage: ' + msg);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProdNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME DO PRODUTO É OBRIGATÓRIO.' });
      return;
    }
    const precoSalao = parseFloat(formProdPrecoSalao.replace(',', '.'));
    if (isNaN(precoSalao) || precoSalao <= 0) {
      setFeedbackMessage({ type: 'error', text: 'INFORME UM PREÇO DE SALÃO VÁLIDO.' });
      return;
    }
    const precoDeliv = formProdPrecoDelivery
      ? parseFloat(formProdPrecoDelivery.replace(',', '.'))
      : precoSalao;

    setIsSaving(true);
    const prodPayload: Partial<Produto> = {
      id: editingProductId || undefined,
      nome: formProdNome.toUpperCase().trim(),
      descricao: formProdDescricao.toUpperCase().trim(),
      categoria_id: formProdCategoriaId,
      preco_salao: precoSalao,
      preco_delivery: precoDeliv,
      dia_semana: formProdDiasSemana,
      pausado: formProdPausado,
      url_imagem: formProdUrlImagem ? formProdUrlImagem.trim() : undefined,
    };

    if (onSaveProduto) {
      await onSaveProduto(prodPayload);
    } else {
      await salvarProdutoSupabase(prodPayload);
    }
    setIsSaving(false);
    setShowProductModal(false);
    setFeedbackMessage({
      type: 'success',
      text: isEditingProduct ? 'PRATO/PRODUTO ATUALIZADO NO SUPABASE!' : 'NOVO PRATO SALVO NO SUPABASE!',
    });
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsSaving(true);
    let ok: boolean | void = true;
    if (onDeleteProduto) {
      ok = await onDeleteProduto(productToDelete.id);
    } else {
      const res = await excluirProdutoSupabase(productToDelete.id);
      ok = res.success;
    }
    setIsSaving(false);
    setProductToDelete(null);
    if (ok !== false) {
      setFeedbackMessage({ type: 'success', text: 'PRODUTO EXCLUÍDO DO SUPABASE COM SUCESSO.' });
    }
  };

  // =========================================================================
  // MESAS HANDLERS
  // =========================================================================
  const openNewMesaModal = () => {
    setIsEditingMesa(false);
    // Suggest next table number
    const maxNum = mesas.reduce((max, m) => Math.max(max, m.numero), 0);
    setFormMesaNumero(String(maxNum + 1));
    setFormMesaStatus('livre');
    setFormMesaPessoas('4');
    setFormMesaCliente('');
    setFeedbackMessage(null);
    setShowMesaModal(true);
  };

  const openEditMesaModal = (m: Mesa) => {
    setIsEditingMesa(true);
    setFormMesaNumero(String(m.numero));
    setFormMesaStatus(m.status);
    setFormMesaPessoas(String(m.pessoas || 2));
    setFormMesaCliente(m.cliente_nome || '');
    setFeedbackMessage(null);
    setShowMesaModal(true);
  };

  const handleSaveMesaForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(formMesaNumero, 10);
    if (isNaN(num) || num <= 0) {
      setFeedbackMessage({ type: 'error', text: 'NÚMERO DE MESA INVÁLIDO.' });
      return;
    }

    setIsSaving(true);
    const mesaPayload: Partial<Mesa> = {
      numero: num,
      status: formMesaStatus,
      pessoas: parseInt(formMesaPessoas, 10) || 2,
      cliente_nome: formMesaCliente.toUpperCase().trim() || undefined,
    };

    if (onSaveMesa) {
      await onSaveMesa(mesaPayload);
    } else {
      await salvarMesaSupabase(mesaPayload);
    }
    setIsSaving(false);
    setShowMesaModal(false);
    setFeedbackMessage({
      type: 'success',
      text: isEditingMesa ? `MESA ${num} ATUALIZADA NO SUPABASE!` : `MESA ${num} CADASTRADA NO SUPABASE!`,
    });
  };

  const handleConfirmDeleteMesa = async () => {
    if (!mesaToDelete) return;
    setIsSaving(true);
    if (onDeleteMesa) {
      await onDeleteMesa(mesaToDelete.numero);
    } else {
      await excluirMesaSupabase(mesaToDelete.numero);
    }
    setIsSaving(false);
    setMesaToDelete(null);
    setFeedbackMessage({ type: 'success', text: `MESA ${mesaToDelete.numero} EXCLUÍDA DO SUPABASE COM SUCESSO.` });
  };

  // =========================================================================
  // CATEGORIAS HANDLERS
  // =========================================================================
  const openNewCategoriaModal = () => {
    setIsEditingCategoria(false);
    setEditingCategoriaId(null);
    setFormCategoriaNome('');
    const maxOrd = categorias.reduce((max, c) => Math.max(max, c.ordem), 0);
    setFormCategoriaOrdem(String(maxOrd + 1));
    setFeedbackMessage(null);
    setShowCategoriaModal(true);
  };

  const openEditCategoriaModal = (cat: Categoria) => {
    setIsEditingCategoria(true);
    setEditingCategoriaId(cat.id);
    setFormCategoriaNome(cat.nome);
    setFormCategoriaOrdem(String(cat.ordem));
    setFeedbackMessage(null);
    setShowCategoriaModal(true);
  };

  const handleSaveCategoriaForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoriaNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME DA CATEGORIA É OBRIGATÓRIO.' });
      return;
    }
    setIsSaving(true);
    const payload: Partial<Categoria> = {
      id: editingCategoriaId || undefined,
      nome: formCategoriaNome.toUpperCase().trim(),
      ordem: parseInt(formCategoriaOrdem, 10) || 1,
    };
    if (onSaveCategoria) {
      await onSaveCategoria(payload);
    }
    setIsSaving(false);
    setShowCategoriaModal(false);
    setFeedbackMessage({
      type: 'success',
      text: isEditingCategoria ? 'CATEGORIA ATUALIZADA COM SUCESSO!' : 'NOVA CATEGORIA CADASTRADA COM SUCESSO!',
    });
  };

  const handleConfirmDeleteCategoria = async () => {
    if (!categoriaToDelete) return;
    setIsSaving(true);
    let ok: boolean | void = true;
    if (onDeleteCategoria) {
      ok = await onDeleteCategoria(categoriaToDelete.id);
    } else {
      const res = await excluirCategoriaSupabase(categoriaToDelete.id);
      ok = res.success;
    }
    setIsSaving(false);
    setCategoriaToDelete(null);
    if (ok !== false) {
      setFeedbackMessage({ type: 'success', text: 'CATEGORIA EXCLUÍDA COM SUCESSO.' });
    }
  };

  // =========================================================================
  // BAIRROS & TAXAS DE ENTREGA HANDLERS
  // =========================================================================
  const openNewBairroModal = () => {
    setIsEditingBairro(false);
    setEditingBairroOriginalNome(null);
    setFormBairroNome('');
    setFormBairroTaxa('8.00');
    setFeedbackMessage(null);
    setShowBairroModal(true);
  };

  const openEditBairroModal = (b: BairroTaxa) => {
    setIsEditingBairro(true);
    setEditingBairroOriginalNome(b.bairro);
    setFormBairroNome(b.bairro);
    setFormBairroTaxa(String(b.taxa));
    setFeedbackMessage(null);
    setShowBairroModal(true);
  };

  const handleSaveBairroForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBairroNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME DO BAIRRO É OBRIGATÓRIO.' });
      return;
    }
    const taxaNum = parseFloat(formBairroTaxa.replace(',', '.'));
    if (isNaN(taxaNum) || taxaNum < 0) {
      setFeedbackMessage({ type: 'error', text: 'INFORME UMA TAXA DE ENTREGA VÁLIDA (R$).' });
      return;
    }
    setIsSaving(true);
    const payload: Partial<BairroTaxa> = {
      bairro: formBairroNome.toUpperCase().trim(),
      taxa: taxaNum,
    };
    if (onSaveBairro) {
      await onSaveBairro(payload, editingBairroOriginalNome || undefined);
    }
    setIsSaving(false);
    setShowBairroModal(false);
    setFeedbackMessage({
      type: 'success',
      text: isEditingBairro ? 'TAXA DO BAIRRO ATUALIZADA COM SUCESSO!' : 'NOVO BAIRRO CADASTRADO COM SUCESSO!',
    });
  };

  const handleConfirmDeleteBairro = async () => {
    if (!bairroToDelete) return;
    setIsSaving(true);
    if (onDeleteBairro) {
      await onDeleteBairro(bairroToDelete.bairro);
    }
    setIsSaving(false);
    setBairroToDelete(null);
    setFeedbackMessage({ type: 'success', text: `BAIRRO ${bairroToDelete.bairro} EXCLUÍDO COM SUCESSO.` });
  };

  // =========================================================================
  // FORMAS DE PAGAMENTO HANDLERS
  // =========================================================================
  const filteredFormasPagamento = formasPagamento
    .filter((fp) => {
      if (fpFilterStatus === 'ativas' && !fp.ativo) return false;
      if (fpFilterStatus === 'inativas' && fp.ativo) return false;
      if (fpSearch) {
        const s = fpSearch.toUpperCase();
        return (
          fp.nome.toUpperCase().includes(s) ||
          fp.id.toUpperCase().includes(s) ||
          fp.tipo.toUpperCase().includes(s) ||
          (fp.descricao && fp.descricao.toUpperCase().includes(s))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (formasPagamentoSortMode === 'nome') {
        return a.nome.localeCompare(b.nome);
      }
      return (a.ordem || 99) - (b.ordem || 99);
    });

  const openAddFpModal = () => {
    setIsEditingFp(false);
    setEditingFpId(null);
    setFormFpNome('');
    setFormFpTipo('cartao_credito');
    setFormFpTaxa('2.50');
    setFormFpPermiteTroco(false);
    setFormFpAtivo(true);
    setFormFpOrdem(String(formasPagamento.length + 1));
    setFormFpDescricao('');
    setFeedbackMessage(null);
    setShowFpModal(true);
  };

  const openEditFpModal = (fp: FormaPagamentoConfig) => {
    setIsEditingFp(true);
    setEditingFpId(fp.id);
    setFormFpNome(fp.nome);
    setFormFpTipo(fp.tipo);
    setFormFpTaxa(String(fp.taxa_operadora || 0));
    setFormFpPermiteTroco(!!fp.permite_troco);
    setFormFpAtivo(fp.ativo !== false);
    setFormFpOrdem(String(fp.ordem || 1));
    setFormFpDescricao(fp.descricao || '');
    setFeedbackMessage(null);
    setShowFpModal(true);
  };

  const handleToggleStatusFp = async (fp: FormaPagamentoConfig) => {
    setIsSaving(true);
    if (onSaveFormaPagamento) {
      await onSaveFormaPagamento({
        ...fp,
        ativo: !fp.ativo,
      });
    }
    setIsSaving(false);
    setFeedbackMessage({
      type: 'success',
      text: `FORMA DE PAGAMENTO "${fp.nome}" ${!fp.ativo ? 'ATIVADA' : 'INATIVADA'} COM SUCESSO!`,
    });
  };

  const handleSaveFpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFpNome.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O NOME DA FORMA DE PAGAMENTO É OBRIGATÓRIO.' });
      return;
    }

    const taxaNum = parseFloat(formFpTaxa.replace(',', '.'));
    const ordemNum = parseInt(formFpOrdem, 10) || 1;

    setIsSaving(true);
    const id = isEditingFp && editingFpId ? editingFpId : formFpNome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const payload: Partial<FormaPagamentoConfig> = {
      id,
      nome: formFpNome.toUpperCase().trim(),
      tipo: formFpTipo,
      taxa_operadora: isNaN(taxaNum) ? 0 : taxaNum,
      permite_troco: formFpPermiteTroco,
      ativo: formFpAtivo,
      ordem: ordemNum,
      descricao: formFpDescricao ? formFpDescricao.toUpperCase().trim() : undefined,
    };

    if (onSaveFormaPagamento) {
      await onSaveFormaPagamento(payload);
    }
    setIsSaving(false);
    setShowFpModal(false);
    setFeedbackMessage({
      type: 'success',
      text: isEditingFp
        ? 'FORMA DE PAGAMENTO ATUALIZADA COM SUCESSO!'
        : 'NOVA FORMA DE PAGAMENTO CADASTRADA COM SUCESSO!',
    });
  };

  const handleConfirmDeleteFp = async () => {
    if (!fpToDelete) return;
    setIsSaving(true);
    if (onDeleteFormaPagamento) {
      await onDeleteFormaPagamento(fpToDelete.id);
    }
    setIsSaving(false);
    setFpToDelete(null);
    setFeedbackMessage({
      type: 'success',
      text: `FORMA DE PAGAMENTO "${fpToDelete.nome}" EXCLUÍDA COM SUCESSO.`,
    });
  };

  // Helper visual category icon for products
  const renderProductCategoryVisual = (catId: number) => {
    switch (catId) {
      case 2:
        return (
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        );
      case 3:
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-950/80 border border-orange-800 text-orange-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        );
      case 4:
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-400 flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
        );
      case 5:
        return (
          <div className="w-10 h-10 rounded-xl bg-pink-950/80 border border-pink-800 text-pink-400 flex items-center justify-center shrink-0">
            <Cake className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
        );
    }
  };

  // Badge cargo renderer
  const renderCargoBadge = (cargo: TipoUsuario) => {
    switch (cargo) {
      case 'master':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/50 shadow-xs">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            MASTER (GERAL)
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <UserCog className="w-3 h-3 text-purple-400" />
            ADMINISTRADOR
          </span>
        );
      case 'atendente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <UserCheck className="w-3 h-3 text-blue-400" />
            ATENDENTE
          </span>
        );
      case 'cozinha':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-orange-500/20 text-orange-300 border border-orange-500/30">
            <Utensils className="w-3 h-3 text-orange-400" />
            COZINHA
          </span>
        );
      case 'garcom':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Store className="w-3 h-3 text-emerald-400" />
            GARÇOM
          </span>
        );
      case 'entregador':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <Briefcase className="w-3 h-3 text-cyan-400" />
            ENTREGADOR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-300">
            {cargo}
          </span>
        );
    }
  };

  const sqlDDL = `-- =========================================================================
-- TABELAS DE CADASTROS DO RESTAURANTE KAIPIRA NO SUPABASE
-- =========================================================================

-- 1. ENUM E TABELA DE USUÁRIOS
DO $$ BEGIN
    CREATE TYPE tipo_usuario AS ENUM ('master', 'admin', 'atendente', 'cozinha', 'garcom', 'entregador');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TYPE tipo_usuario ADD VALUE IF NOT EXISTS 'master';

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefone VARCHAR(25) NOT NULL,
    cargo VARCHAR(50) NOT NULL DEFAULT 'atendente',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    senha VARCHAR(100) NOT NULL DEFAULT 'DNDIGQOL',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEED MASTER
INSERT INTO usuarios (nome, email, telefone, cargo, status, senha)
VALUES ('ADMINISTRADOR MASTER GERAL', 'master@kaipira.com', '(19) 9-9999-9999', 'master', 'ativo', 'DNDIGQOL')
ON CONFLICT (email) DO UPDATE SET cargo = 'master', senha = 'DNDIGQOL', status = 'ativo', atualizado_em = NOW();

-- 2. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(25) UNIQUE NOT NULL,
    cep VARCHAR(10) NOT NULL DEFAULT '13400-010',
    endereco VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    complemento VARCHAR(100),
    eh_mensalista BOOLEAN DEFAULT FALSE,
    saldo_devedor DECIMAL(10,2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE PRODUTOS & CARDÁPIO
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    categoria_id INT NOT NULL DEFAULT 1,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    preco_salao DECIMAL(10,2) NOT NULL,
    preco_delivery DECIMAL(10,2) NOT NULL,
    dia_semana INT[] DEFAULT '{1,2,3,4,5,6}',
    pausado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE MESAS
CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    numero INT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'livre',
    cliente_nome VARCHAR(150),
    pessoas INT DEFAULT 2
);

-- 5. TABELA DE CARDÁPIO DIÁRIO (CANAL 'delivery_balcao' OU 'mesas')
CREATE TABLE IF NOT EXISTS cardapio_diario (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    produto_id INT NOT NULL,
    canal VARCHAR(30) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_cardapio_data_produto_canal UNIQUE (data, produto_id, canal)
);

-- 6. TABELA DE CATEGORIAS DO CARDÁPIO
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ordem INT DEFAULT 1
);

-- 7. TABELA DE BAIRROS & TAXAS DE ENTREGA (PIRACICABA)
CREATE TABLE IF NOT EXISTS bairros_taxas (
    bairro VARCHAR(100) PRIMARY KEY,
    taxa DECIMAL(10,2) NOT NULL DEFAULT 7.00
);

-- 8. TABELA DE FORMAS DE PAGAMENTO
CREATE TABLE IF NOT EXISTS formas_pagamento (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'outro',
    taxa_operadora DECIMAL(5,2) DEFAULT 0.00,
    permite_troco BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    ordem INT DEFAULT 1,
    descricao TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
`;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Top Banner: Central de Cadastros */}
      <div className="bg-neutral-850 rounded-2xl border border-neutral-800 p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial from-amber-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 tracking-wider mb-1">
              <Users className="w-4 h-4 text-amber-500" />
              <span>PAINEL DE CADASTROS DO APP · RESTAURANTE KAIPIRA</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-bold ml-2">
                <Cloud className="w-3 h-3 text-emerald-400" />
                100% NUVEM SUPABASE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              Central Integrada de Cadastros
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Gerencie todos os cadastros essenciais: Usuários & Equipe, Clientes, Pratos do Cardápio e Mesas do Salão. Disponível em <strong>Blocos</strong> e <strong>Lista</strong> com inclusão, alteração e exclusão ativas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSeedMasterNow}
              disabled={isSeedingMaster}
              className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              title="Garante que o usuário MASTER esteja sincronizado no Supabase"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              {isSeedingMaster ? 'Sincronizando Master...' : 'Setup Master na Nuvem'}
            </button>

            <button
              onClick={() => setActiveSubTab('sql')}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Script SQL Supabase</span>
            </button>
          </div>
        </div>

        {/* Global Stats bar */}
        {/* Global Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-neutral-800 text-xs">
          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Usuários / Equipe</span>
            <span className="text-lg font-black text-white">{usuarios.length}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {usuarios.filter((u) => u.status !== 'inativo').length} ativos
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Clientes Cadastrados</span>
            <span className="text-lg font-black text-white">{clientes.length}</span>
            <span className="text-[10px] text-cyan-400 block mt-0.5">
              {clientes.filter((c) => c.eh_mensalista).length} mensalistas
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Cardápio & Pratos</span>
            <span className="text-lg font-black text-white">{produtos.length}</span>
            <span className="text-[10px] text-amber-400 block mt-0.5">
              {produtos.filter((p) => !p.pausado).length} disponíveis
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Mesas do Salão</span>
            <span className="text-lg font-black text-white">{mesas.length}</span>
            <span className="text-[10px] text-purple-400 block mt-0.5">
              {mesas.filter((m) => m.status === 'livre').length} livres
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Categorias</span>
            <span className="text-lg font-black text-white">{categorias.length}</span>
            <span className="text-[10px] text-orange-400 block mt-0.5">organizadas</span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Bairros & Entregas</span>
            <span className="text-lg font-black text-white">{bairros.length}</span>
            <span className="text-[10px] text-blue-400 block mt-0.5">rotas delivery</span>
          </div>

          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 uppercase font-bold block">Insumos & Estoque</span>
            <span className="text-lg font-black text-white">{estoque.length}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {estoque.filter((it) => it.estoque_minimo > 0 && it.quantidade_atual <= it.estoque_minimo).length > 0
                ? `${estoque.filter((it) => it.estoque_minimo > 0 && it.quantidade_atual <= it.estoque_minimo).length} em alerta crítico`
                : '100% monitorado'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Feedback notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold uppercase transition-all shadow-lg ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : 'bg-red-950/90 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-neutral-400 hover:text-white px-2 py-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveSubTab('usuarios')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'usuarios'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <UserCog className="w-4 h-4" />
          <span>1. Usuários & Equipe ({usuarios.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('clientes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'clientes'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Clientes & Mensalistas ({clientes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('produtos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'produtos'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>3. Cardápio & Pratos ({produtos.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('mesas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'mesas'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>4. Mesas do Salão ({mesas.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('categorias')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'categorias'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>5. Categorias ({categorias.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('bairros')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'bairros'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>6. Bairros & Taxas ({bairros.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('insumos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'insumos'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>7. Insumos & Estoque ({estoque.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('formas_pagamento')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'formas_pagamento'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>8. Formas de Pagamento ({formasPagamento.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sql')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeSubTab === 'sql'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-neutral-850 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>9. Esquema SQL Supabase</span>
        </button>
      </div>

      {/* =========================================================================
          ABA 1: USUÁRIOS & FUNCIONÁRIOS
          ========================================================================= */}
      {activeSubTab === 'usuarios' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <UserCog className="w-4 h-4 text-amber-400" />
                <span>Gestão de Usuários & Perfis (CRUD na Nuvem)</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cadastre e gerencie funcionários, atendentes, garçons, equipe da cozinha e o acesso Master.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setUsuariosViewMode('bloco')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    usuariosViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos / Cards"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUsuariosViewMode('lista')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    usuariosViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista / Tabela"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Botão Novo Usuário */}
              <button
                type="button"
                onClick={openNewUserModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="BUSCAR USUÁRIO POR NOME, E-MAIL OU TELEFONE..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>

            <select
              value={filterCargo}
              onChange={(e) => setFilterCargo(e.target.value)}
              className="px-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-200 rounded-xl text-xs uppercase"
            >
              <option value="todos">TODOS OS CARGOS ({usuarios.length})</option>
              <option value="master">MASTER</option>
              <option value="admin">ADMINISTRADOR</option>
              <option value="atendente">ATENDENTE</option>
              <option value="cozinha">COZINHA</option>
              <option value="garcom">GARÇOM</option>
              <option value="entregador">ENTREGADOR</option>
            </select>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 bg-neutral-850 border border-neutral-700 rounded-xl px-3 py-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-neutral-400 font-bold uppercase text-[11px] hidden sm:inline">Ordem:</span>
              <select
                value={usuariosSortMode}
                onChange={(e) => setUsuariosSortMode(e.target.value as 'nome' | 'cadastro')}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer uppercase"
              >
                <option value="nome" className="bg-neutral-850 text-white">Nome (A-Z)</option>
                <option value="cadastro" className="bg-neutral-850 text-white">Ordem de Cadastro</option>
              </select>
            </div>
          </div>

          {/* CONTENT: BLOCOS OU LISTA */}
          {usuariosViewMode === 'bloco' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedUsuarios.map((u) => {
                const isMaster = u.cargo === 'master' || u.email === 'master@kaipira.com';
                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-xs ${
                      isMaster
                        ? 'bg-gradient-to-br from-amber-950/30 to-neutral-850 border-amber-600/50 shadow-md ring-1 ring-amber-500/20'
                        : 'bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        {renderCargoBadge(u.cargo)}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.status === 'inativo'
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {u.status || 'ativo'}
                        </span>
                      </div>

                      <h4 className="font-black text-white text-sm uppercase truncate mb-1">
                        {u.nome}
                      </h4>

                      <div className="space-y-1 text-neutral-400 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span>{u.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span>{formatPhone(u.telefone)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-neutral-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditUserModal(u)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Editar</span>
                      </button>

                      {!isMaster && (
                        <button
                          type="button"
                          onClick={() => setUserToDelete(u)}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-red-950/80 hover:text-red-300 text-neutral-400 border border-neutral-700 hover:border-red-800 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Nome do Funcionário</th>
                    <th className="px-4 py-3">Cargo</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900">
                  {sortedUsuarios.map((u) => {
                    const isMaster = u.cargo === 'master' || u.email === 'master@kaipira.com';
                    return (
                      <tr key={u.id} className="hover:bg-neutral-850/50">
                        <td className="px-4 py-3 font-bold text-neutral-100 uppercase">{u.nome}</td>
                        <td className="px-4 py-3">{renderCargoBadge(u.cargo)}</td>
                        <td className="px-4 py-3 font-mono text-neutral-300">{u.email}</td>
                        <td className="px-4 py-3 font-mono text-neutral-300">{formatPhone(u.telefone)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              u.status === 'inativo'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {u.status || 'ativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                              title="Editar usuário"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                            {!isMaster && (
                              <button
                                type="button"
                                onClick={() => setUserToDelete(u)}
                                className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                title="Excluir usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 2: CLIENTES & MENSALISTAS
          ========================================================================= */}
      {activeSubTab === 'clientes' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Cadastro de Clientes & Mensalistas</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Base cadastral de Piracicaba para delivery rápido, histórico e mensalistas com saldo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setClientesViewMode('bloco')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    clientesViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClientesViewMode('lista')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    clientesViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Botão Novo Cliente */}
              <button
                type="button"
                onClick={openNewClientModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Cliente</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="BUSCAR CLIENTE POR NOME OU TELEFONE..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 bg-neutral-850 border border-neutral-700 rounded-xl px-3 py-2 text-xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-neutral-400 font-bold uppercase text-[11px] hidden sm:inline">Ordem:</span>
              <select
                value={clientesSortMode}
                onChange={(e) => setClientesSortMode(e.target.value as 'nome' | 'cadastro')}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer uppercase"
              >
                <option value="nome" className="bg-neutral-850 text-white">Nome (A-Z)</option>
                <option value="cadastro" className="bg-neutral-850 text-white">Ordem de Cadastro</option>
              </select>
            </div>
          </div>

          {/* CONTENT: BLOCOS OU LISTA */}
          {clientesViewMode === 'bloco' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedClientes.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-neutral-850 border border-neutral-800 hover:border-neutral-700 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-neutral-300 font-bold flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-neutral-500" />
                          {formatPhone(c.telefone)}
                        </span>
                        {c.eh_mensalista && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800 font-black uppercase">
                            MENSALISTA
                          </span>
                        )}
                      </div>

                      <h4 className="font-black text-white text-sm uppercase truncate mb-1">
                        {c.nome}
                      </h4>

                      <p className="text-neutral-400 text-[11px] uppercase line-clamp-2">
                        {c.bairro} · {c.endereco}, {c.numero} {c.complemento ? `(${c.complemento})` : ''}
                      </p>

                      {c.eh_mensalista && (
                        <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400">Saldo Devedor:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {formatBRL(c.saldo_devedor || 0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-neutral-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditClientModal(c)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setClientToDelete(c)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-red-950/80 hover:text-red-300 text-neutral-400 border border-neutral-700 hover:border-red-800 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Nome do Cliente</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Bairro / Endereço</th>
                    <th className="px-4 py-3">Mensalista</th>
                    <th className="px-4 py-3 text-right">Saldo Devedor</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900">
                  {sortedClientes.map((c) => (
                      <tr key={c.id} className="hover:bg-neutral-850/50">
                        <td className="px-4 py-3 font-bold text-neutral-200 uppercase">{c.nome}</td>
                        <td className="px-4 py-3 font-mono text-neutral-300">{formatPhone(c.telefone)}</td>
                        <td className="px-4 py-3 text-neutral-400 uppercase">
                          {c.bairro} - {c.endereco}, {c.numero}
                        </td>
                        <td className="px-4 py-3">
                          {c.eh_mensalista ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800 font-bold uppercase">
                              Sim
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[11px]">Não</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                          {formatBRL(c.saldo_devedor || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditClientModal(c)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                              title="Editar cliente"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setClientToDelete(c)}
                              className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                              title="Excluir cliente"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 3: CARDÁPIO & PRODUTOS
          ========================================================================= */}
      {activeSubTab === 'produtos' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>Cadastro de Produtos & Pratos do Cardápio</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Pratos típicos caipiras, marmitex executivas, porções da cozinha e bebidas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setProdutosViewMode('bloco')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    produtosViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProdutosViewMode('lista')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    produtosViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Botão Novo Produto */}
              <button
                type="button"
                onClick={openNewProductModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Prato / Item</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('cardapio-dia')}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-amber-300 border border-neutral-700 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Montar Cardápio de Hoje</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="BUSCAR PRATO OU PRODUTO..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>

            <select
              value={selectedCategoriaId}
              onChange={(e) =>
                setSelectedCategoriaId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))
              }
              className="px-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-200 rounded-xl text-xs uppercase"
            >
              <option value="todas">TODAS AS CATEGORIAS ({produtos.length})</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 bg-neutral-850 border border-neutral-700 rounded-xl px-3 py-2 text-xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-neutral-400 font-bold uppercase text-[11px] hidden sm:inline">Ordem:</span>
              <select
                value={produtosSortMode}
                onChange={(e) => setProdutosSortMode(e.target.value as 'nome' | 'cadastro')}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer uppercase"
              >
                <option value="nome" className="bg-neutral-850 text-white">Nome / Descrição (A-Z)</option>
                <option value="cadastro" className="bg-neutral-850 text-white">Ordem de Cadastro</option>
              </select>
            </div>
          </div>

          {/* CONTENT: BLOCOS OU LISTA */}
          {produtosViewMode === 'bloco' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedProdutos.map((p) => {
                  const cat = categorias.find((c) => c.id === p.categoria_id);
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl bg-neutral-850 border flex flex-col justify-between gap-3 text-xs transition-all ${
                        p.pausado
                          ? 'border-red-900/60 opacity-70'
                          : 'border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-start gap-3 mb-2">
                          {renderProductCategoryVisual(p.categoria_id)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-neutral-800 text-neutral-300 border border-neutral-700">
                                {cat?.nome || 'CARDÁPIO'}
                              </span>
                              {p.pausado && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-950 text-red-300 border border-red-800 flex items-center gap-1">
                                  <Ban className="w-3 h-3" />
                                  ESGOTADO
                                </span>
                              )}
                            </div>
                            <h4 className="font-black text-white text-sm uppercase line-clamp-1">
                              {p.nome}
                            </h4>
                          </div>
                        </div>

                        {p.descricao && (
                          <p className="text-neutral-400 text-[11px] line-clamp-2 mb-2 uppercase">
                            {p.descricao}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px] font-mono mt-1 pt-2 border-t border-neutral-800">
                          <span>
                            Salão: <strong className="text-amber-400">{formatBRL(p.preco_salao)}</strong>
                          </span>
                          <span>
                            Delivery:{' '}
                            <strong className="text-cyan-400">{formatBRL(p.preco_delivery)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                        {onTogglePauseProduto && (
                          <button
                            type="button"
                            onClick={() => onTogglePauseProduto(p.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                              p.pausado
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {p.pausado ? 'Despausar' : 'Pausar'}
                          </button>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => openEditProductModal(p)}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-amber-400" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setProductToDelete(p)}
                            className="p-1.5 bg-neutral-800 hover:bg-red-950/80 text-neutral-400 hover:text-red-300 border border-neutral-700 hover:border-red-800 rounded-lg transition-colors cursor-pointer"
                            title="Excluir produto"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Produto / Prato</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Preço Salão</th>
                    <th className="px-4 py-3">Preço Delivery</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900">
                  {sortedProdutos.map((p) => {
                      const cat = categorias.find((c) => c.id === p.categoria_id);
                      return (
                        <tr key={p.id} className="hover:bg-neutral-850/50">
                          <td className="px-4 py-3 font-bold text-neutral-100 uppercase">{p.nome}</td>
                          <td className="px-4 py-3 uppercase text-neutral-400">{cat?.nome || '-'}</td>
                          <td className="px-4 py-3 font-mono text-amber-400 font-bold">
                            {formatBRL(p.preco_salao)}
                          </td>
                          <td className="px-4 py-3 font-mono text-cyan-400 font-bold">
                            {formatBRL(p.preco_delivery)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                p.pausado
                                  ? 'bg-red-950 text-red-300 border border-red-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {p.pausado ? 'Pausado' : 'Disponível'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditProductModal(p)}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                                title="Editar produto"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setProductToDelete(p)}
                                className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                title="Excluir produto"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 4: MESAS DO SALÃO
          ========================================================================= */}
      {activeSubTab === 'mesas' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>Cadastro e Gestão das Mesas do Salão</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Layout de atendimento presencial do Restaurante Kaipira. Cadastre, edite status e gerencie mesas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setMesasViewMode('bloco')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    mesasViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMesasViewMode('lista')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    mesasViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Seletor de Ordenação */}
              <div className="flex items-center gap-1.5 bg-neutral-850 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-neutral-400 font-bold uppercase text-[11px] hidden sm:inline">Ordem:</span>
                <select
                  value={mesasSortMode}
                  onChange={(e) => setMesasSortMode(e.target.value as 'nome' | 'cadastro')}
                  className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer uppercase"
                >
                  <option value="nome" className="bg-neutral-850 text-white">Número (1, 2, 3...)</option>
                  <option value="cadastro" className="bg-neutral-850 text-white">Ordem de Cadastro</option>
                </select>
              </div>

              {/* Botão Nova Mesa */}
              <button
                type="button"
                onClick={openNewMesaModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Mesa</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('mesas')}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold uppercase transition-all shadow-sm cursor-pointer"
              >
                Abrir Salão de Mesas
              </button>
            </div>
          </div>

          {/* CONTENT: BLOCOS OU LISTA */}
          {mesasViewMode === 'bloco' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {sortedMesas.map((m) => {
                const statusColor =
                  m.status === 'ocupada'
                    ? 'border-amber-600/70 bg-amber-950/20'
                    : m.status === 'conta'
                    ? 'border-purple-600/70 bg-purple-950/20'
                    : m.status === 'reservada'
                    ? 'border-blue-600/70 bg-blue-950/20'
                    : 'border-neutral-800 bg-neutral-850 hover:border-neutral-700';

                return (
                  <div
                    key={m.numero}
                    className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 text-xs transition-all ${statusColor}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-black text-white text-base">Mesa {m.numero}</span>
                        <div
                          className={`w-3 h-3 rounded-full ${
                            m.status === 'ocupada'
                              ? 'bg-amber-400'
                              : m.status === 'conta'
                              ? 'bg-purple-400'
                              : m.status === 'reservada'
                              ? 'bg-blue-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                      </div>

                      <div className="space-y-1 text-[11px] text-neutral-400">
                        <div>
                          Status:{' '}
                          <strong className="uppercase text-neutral-200">{m.status}</strong>
                        </div>
                        <div>Capacidade: {m.pessoas || 2} pessoas</div>
                        {m.cliente_nome && (
                          <div className="text-amber-400 font-bold uppercase truncate">
                            {m.cliente_nome}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => openEditMesaModal(m)}
                        className="flex-1 py-1 px-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMesaToDelete(m)}
                        className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                        title="Excluir mesa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Número da Mesa</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Capacidade</th>
                    <th className="px-4 py-3">Cliente Alocado</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900">
                  {sortedMesas.map((m) => (
                    <tr key={m.numero} className="hover:bg-neutral-850/50">
                      <td className="px-4 py-3 font-black text-neutral-100 uppercase">
                        Mesa {m.numero}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.status === 'ocupada'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : m.status === 'conta'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : m.status === 'reservada'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-300">{m.pessoas || 2} pessoas</td>
                      <td className="px-4 py-3 font-bold text-amber-400 uppercase">
                        {m.cliente_nome || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditMesaModal(m)}
                            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                            title="Editar mesa"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMesaToDelete(m)}
                            className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                            title="Excluir mesa"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 5: CATEGORIAS DO CARDÁPIO
          ========================================================================= */}
      {activeSubTab === 'categorias' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>Cadastro e Gestão de Categorias do Cardápio</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Organize as seções do restaurante: Pratos, Marmitex, Porções, Bebidas e Sobremesas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setCategoriasViewMode('bloco')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    categoriasViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoriasViewMode('lista')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    categoriasViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Botão Nova Categoria */}
              <button
                type="button"
                onClick={openNewCategoriaModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Categoria</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={categoriaSearch}
                onChange={(e) => setCategoriaSearch(e.target.value)}
                placeholder="BUSCAR CATEGORIA..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 bg-neutral-850 border border-neutral-700 rounded-xl px-3 py-2 text-xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-neutral-400 font-bold uppercase text-[11px] hidden sm:inline">Ordem:</span>
              <select
                value={categoriasSortMode}
                onChange={(e) => setCategoriasSortMode(e.target.value as 'nome' | 'cadastro')}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer uppercase"
              >
                <option value="nome" className="bg-neutral-850 text-white">Nome (A-Z)</option>
                <option value="cadastro" className="bg-neutral-850 text-white">Ordem no Cardápio</option>
              </select>
            </div>
          </div>

          {/* CONTENT: BLOCOS OU LISTA */}
          {categoriasViewMode === 'bloco' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedCategorias.map((cat) => {
                  const qtdProdutos = produtos.filter((p) => p.categoria_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-2xl bg-neutral-850 border border-neutral-800 hover:border-neutral-700 flex flex-col justify-between gap-3 text-xs transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-amber-400 border border-neutral-700">
                            ORDEM #{cat.ordem}
                          </span>
                          <span className="text-neutral-400 text-[11px] font-bold">
                            {qtdProdutos} {qtdProdutos === 1 ? 'prato vinculado' : 'pratos vinculados'}
                          </span>
                        </div>

                        <h4 className="font-black text-white text-sm uppercase mb-1 flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{cat.nome}</span>
                        </h4>
                      </div>

                      <div className="pt-2.5 border-t border-neutral-800 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCategoriaModal(cat)}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-amber-400" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategoriaToDelete(cat)}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-red-950/80 hover:text-red-300 text-neutral-400 border border-neutral-700 hover:border-red-800 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Nome da Categoria</th>
                    <th className="px-4 py-3">Ordem no Cardápio</th>
                    <th className="px-4 py-3">Pratos Cadastrados</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900">
                  {sortedCategorias.map((cat) => {
                      const qtdProdutos = produtos.filter((p) => p.categoria_id === cat.id).length;
                      return (
                        <tr key={cat.id} className="hover:bg-neutral-850/50">
                          <td className="px-4 py-3 font-mono text-neutral-400">#{cat.id}</td>
                          <td className="px-4 py-3 font-black text-neutral-100 uppercase">{cat.nome}</td>
                          <td className="px-4 py-3 font-mono font-bold text-amber-400">Ordem {cat.ordem}</td>
                          <td className="px-4 py-3 text-neutral-300 font-bold">{qtdProdutos} pratos</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditCategoriaModal(cat)}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                                title="Editar categoria"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCategoriaToDelete(cat)}
                                className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                title="Excluir categoria"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 6: BAIRROS & TAXAS DE ENTREGA (DELIVERY)
          ========================================================================= */}
      {activeSubTab === 'bairros' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Cadastro de Bairros & Taxas de Entrega de Piracicaba</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Valores de entrega cobrados por bairro nas rotas de motoboy e delivery próprio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setBairrosViewMode('bloco')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    bairrosViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Blocos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBairrosViewMode('lista')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    bairrosViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Botão Novo Bairro */}
              <button
                type="button"
                onClick={openNewBairroModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Bairro</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={bairroSearch}
                onChange={(e) => setBairroSearch(e.target.value)}
                placeholder="BUSCAR BAIRRO DE PIRACICABA..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-100 rounded-xl text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
              />
            </div>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 bg-neutral-850 border border-neutral-700 rounded-xl px-3 py-2 text-xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-neutral-400 font-bold uppercase text-[11px] hidden sm:inline">Ordem:</span>
              <select
                value={bairrosSortMode}
                onChange={(e) => setBairrosSortMode(e.target.value as 'nome' | 'cadastro')}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer uppercase"
              >
                <option value="nome" className="bg-neutral-850 text-white">Nome do Bairro (A-Z)</option>
                <option value="cadastro" className="bg-neutral-850 text-white">Ordem de Cadastro</option>
              </select>
            </div>
          </div>

          {/* CONTENT: BLOCOS OU LISTA */}
          {bairrosViewMode === 'bloco' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {sortedBairros.map((b) => (
                  <div
                    key={b.bairro}
                    className="p-4 rounded-2xl bg-neutral-850 border border-neutral-800 hover:border-neutral-700 flex flex-col justify-between gap-3 text-xs transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 text-neutral-400">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Piracicaba / Região</span>
                      </div>
                      <h4 className="font-black text-white text-sm uppercase truncate mb-2">
                        {b.bairro}
                      </h4>
                      <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800/80 flex items-center justify-between">
                        <span className="text-neutral-400 text-[11px] uppercase font-bold">Taxa Delivery:</span>
                        <span className="font-mono text-cyan-400 font-extrabold text-sm">
                          {formatBRL(b.taxa)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-neutral-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditBairroModal(b)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBairroToDelete(b)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-red-950/80 hover:text-red-300 text-neutral-400 border border-neutral-700 hover:border-red-800 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[11px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Nome do Bairro</th>
                    <th className="px-4 py-3">Cidade / UF</th>
                    <th className="px-4 py-3">Taxa de Entrega</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900">
                  {sortedBairros.map((b) => (
                      <tr key={b.bairro} className="hover:bg-neutral-850/50">
                        <td className="px-4 py-3 font-black text-neutral-100 uppercase">{b.bairro}</td>
                        <td className="px-4 py-3 text-neutral-400 uppercase font-mono">PIRACICABA - SP</td>
                        <td className="px-4 py-3 font-mono font-bold text-cyan-400">
                          {formatBRL(b.taxa)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditBairroModal(b)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                              title="Editar bairro"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setBairroToDelete(b)}
                              className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                              title="Excluir bairro"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 7: INSUMOS & ESTOQUE (100% NUVEM)
          ========================================================================= */}
      {activeSubTab === 'insumos' && (
        <div className="space-y-4">
          <StockManager
            estoque={estoque}
            onUpdateItem={onUpdateStockItem || (() => {})}
            onAddItem={onAddItemStock || (() => {})}
            onDeleteItem={onDeleteItemStock || (() => {})}
          />
        </div>
      )}

      {/* =========================================================================
          ABA 8: FORMAS DE PAGAMENTO & RECEBIMENTOS
          ========================================================================= */}
      {activeSubTab === 'formas_pagamento' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span>Cadastro de Formas de Pagamento & Recebimentos ({filteredFormasPagamento.length})</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Utilizado no faturamento das mesas, fechamento de contas, balcão e delivery. Sincronizado 100% em nuvem.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddFpModal}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Forma de Pagamento</span>
            </button>
          </div>

          {/* Search, Filter & View Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="BUSCAR FORMA DE PAGAMENTO OU TIPO..."
                  value={fpSearch}
                  onChange={(e) => setFpSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-850 border border-neutral-700 text-white rounded-xl text-xs uppercase placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                />
                {fpSearch && (
                  <button
                    type="button"
                    onClick={() => setFpSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={fpFilterStatus}
                onChange={(e) => setFpFilterStatus(e.target.value as any)}
                aria-label="Filtrar formas de pagamento por status"
                className="px-3 py-2 bg-neutral-850 border border-neutral-700 rounded-xl text-xs text-white uppercase font-bold focus:outline-none"
              >
                <option value="todas">TODAS</option>
                <option value="ativas">ATIVAS</option>
                <option value="inativas">INATIVAS</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() =>
                  setFormasPagamentoSortMode((prev) => (prev === 'ordem' ? 'nome' : 'ordem'))
                }
                className="px-3 py-2 bg-neutral-850 border border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Alternar ordenação"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
                <span>{formasPagamentoSortMode === 'ordem' ? 'Ordem' : 'Nome A-Z'}</span>
              </button>

              <div className="flex items-center bg-neutral-850 border border-neutral-700 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setFormasPagamentoViewMode('bloco')}
                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    formasPagamentoViewMode === 'bloco'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Blocos"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFormasPagamentoViewMode('lista')}
                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    formasPagamentoViewMode === 'lista'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Cards (Blocos) View */}
          {formasPagamentoViewMode === 'bloco' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredFormasPagamento.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-neutral-500 bg-neutral-850/50 rounded-xl border border-neutral-800">
                  NENHUMA FORMA DE PAGAMENTO ENCONTRADA.
                </div>
              ) : (
                filteredFormasPagamento.map((fp) => (
                  <div
                    key={fp.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      fp.ativo
                        ? 'bg-neutral-850/90 border-neutral-750 hover:border-amber-600/60 shadow-sm'
                        : 'bg-neutral-900/60 border-neutral-800/80 opacity-70'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-mono text-[10px] text-neutral-500 uppercase block">
                              ORDEM #{fp.ordem || 1} · {fp.id}
                            </span>
                            <h4 className="text-sm font-black text-white uppercase leading-snug">
                              {fp.nome}
                            </h4>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            fp.ativo
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                          }`}
                        >
                          {fp.ativo ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-neutral-300 pt-2 border-t border-neutral-800">
                        <div className="flex justify-between">
                          <span className="text-neutral-500 text-[11px] uppercase">Tipo:</span>
                          <span className="font-bold uppercase text-neutral-200">{fp.tipo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 text-[11px] uppercase">Taxa Operadora:</span>
                          <span className="font-bold text-amber-400 font-mono">
                            {fp.taxa_operadora ? `${fp.taxa_operadora}%` : '0.0% (Isento)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 text-[11px] uppercase">Permite Troco:</span>
                          <span className="font-bold text-neutral-200">
                            {fp.permite_troco ? 'SIM (ESPÉCIE)' : 'NÃO'}
                          </span>
                        </div>
                        {fp.descricao && (
                          <p className="text-[11px] text-neutral-400 italic pt-1 border-t border-neutral-800/60 uppercase">
                            {fp.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800 mt-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatusFp(fp)}
                        className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          fp.ativo
                            ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                            : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {fp.ativo ? 'Inativar' : 'Ativar'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditFpModal(fp)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                          title="Editar forma de pagamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFpToDelete(fp)}
                          className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                          title="Excluir forma de pagamento"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Table (Lista) View */
            <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-850 text-neutral-400 uppercase text-[10px] font-black tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="p-3">Ordem</th>
                    <th className="p-3">Nome da Forma</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Taxa Operadora</th>
                    <th className="p-3">Troco</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300">
                  {filteredFormasPagamento.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-neutral-500 italic">
                        NENHUMA FORMA DE PAGAMENTO ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    filteredFormasPagamento.map((fp) => (
                      <tr key={fp.id} className="hover:bg-neutral-850/60 transition-colors">
                        <td className="p-3 font-mono font-bold text-neutral-400">#{fp.ordem || 1}</td>
                        <td className="p-3 font-extrabold text-white uppercase">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{fp.nome}</span>
                          </div>
                        </td>
                        <td className="p-3 uppercase font-semibold text-neutral-400">{fp.tipo}</td>
                        <td className="p-3 font-mono font-bold text-amber-400">
                          {fp.taxa_operadora ? `${fp.taxa_operadora}%` : '0%'}
                        </td>
                        <td className="p-3 font-medium">
                          {fp.permite_troco ? (
                            <span className="text-emerald-400 font-bold">SIM</span>
                          ) : (
                            <span className="text-neutral-500">NÃO</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              fp.ativo
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                            }`}
                          >
                            {fp.ativo ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleStatusFp(fp)}
                              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer"
                            >
                              {fp.ativo ? 'Inativar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditFpModal(fp)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer"
                              title="Editar forma de pagamento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFpToDelete(fp)}
                              className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                              title="Excluir forma de pagamento"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 9: SCRIPT SQL SUPABASE
          ========================================================================= */}
      {activeSubTab === 'sql' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Script SQL de Tabelas & Cadastros para o Supabase</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Estrutura completa das tabelas `usuarios`, `clientes`, `produtos`, `mesas` e `cardapio_diario`.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(sqlDDL);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2500);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copiado!' : 'Copiar Script SQL'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Ver Schema Geral
              </button>
            </div>
          </div>

          <pre className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 font-mono text-[11px] text-neutral-300 overflow-x-auto leading-relaxed max-h-[450px]">
            {sqlDDL}
          </pre>
        </div>
      )}

      {/* =========================================================================
          MODAIS DE CADASTRO / EDIÇÃO / EXCLUSÃO
          ========================================================================= */}

      {/* MODAL 1: USUÁRIO */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveUser}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <UserCog className="w-4 h-4 text-amber-500" />
                <span>{isEditingUser ? 'Editar Usuário do Sistema' : 'Novo Cadastro de Usuário'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME COMPLETO: * (SERÁ SALVO EM MAIÚSCULAS)
              </label>
              <UpperInput
                required
                value={formUserNome}
                onChange={(e) => setFormUserNome(e.target.value)}
                placeholder="EX: JOÃO DA SILVA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                E-MAIL / LOGIN: *
              </label>
              <input
                type="email"
                required
                value={formUserEmail}
                onChange={(e) => setFormUserEmail(e.target.value)}
                placeholder="usuario@kaipira.com"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                TELEFONE: * (MÁSCARA OBRIGATÓRIA)
              </label>
              <input
                type="tel"
                required
                value={formUserTelefone}
                onChange={(e) => setFormUserTelefone(formatPhone(e.target.value))}
                placeholder="(19) 9-9999-9999"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                CARGO / PERFIL DE ACESSO: *
              </label>
              <select
                value={formUserCargo}
                onChange={(e) => setFormUserCargo(e.target.value as TipoUsuario)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs uppercase"
              >
                <option value="atendente">ATENDENTE (BALCÃO / TELEFONE / PDV)</option>
                <option value="garcom">GARÇOM (SALÃO & 20 MESAS)</option>
                <option value="cozinha">COZINHA (KDS)</option>
                <option value="entregador">ENTREGADOR (MOTOBOYS & ROTAS)</option>
                <option value="admin">ADMIN (GERENTE / CAIXA / RELATÓRIOS)</option>
                <option value="master">MASTER (LIVRE ACESSO IRRESTRITO A TUDO)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                SENHA DE ACESSO: *
              </label>
              <div className="relative">
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  required
                  value={formUserSenha}
                  onChange={(e) => setFormUserSenha(e.target.value)}
                  placeholder="SENHA"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="absolute right-3 top-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                STATUS DA CONTA:
              </label>
              <div className="flex items-center gap-4 text-xs font-bold uppercase">
                <label className="flex items-center gap-2 cursor-pointer text-emerald-400">
                  <input
                    type="radio"
                    name="formUserStatus"
                    value="ativo"
                    checked={formUserStatus === 'ativo'}
                    onChange={() => setFormUserStatus('ativo')}
                    className="accent-amber-500"
                  />
                  <span>Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-red-400">
                  <input
                    type="radio"
                    name="formUserStatus"
                    value="inativo"
                    checked={formUserStatus === 'inativo'}
                    onChange={() => setFormUserStatus('inativo')}
                    className="accent-amber-500"
                  />
                  <span>Inativo</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando no Supabase...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CLIENTE */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveClientForm}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>{isEditingClient ? 'Editar Cliente' : 'Novo Cliente'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME COMPLETO / RAZÃO SOCIAL: *
              </label>
              <UpperInput
                required
                value={formClientNome}
                onChange={(e) => setFormClientNome(e.target.value)}
                placeholder="EX: MARIA DA ROÇA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  TELEFONE / WHATSAPP: *
                </label>
                <input
                  type="tel"
                  required
                  value={formClientTelefone}
                  onChange={(e) => setFormClientTelefone(formatPhone(e.target.value))}
                  placeholder="(19) 9-9999-9999"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  CEP PIRACICABA:
                </label>
                <input
                  type="text"
                  value={formClientCep}
                  onChange={(e) => setFormClientCep(e.target.value)}
                  placeholder="13400-010"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  ENDEREÇO / RUA:
                </label>
                <UpperInput
                  value={formClientEndereco}
                  onChange={(e) => setFormClientEndereco(e.target.value)}
                  placeholder="RUA DO ROSÁRIO"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  NÚMERO:
                </label>
                <UpperInput
                  value={formClientNumero}
                  onChange={(e) => setFormClientNumero(e.target.value)}
                  placeholder="1240"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  BAIRRO:
                </label>
                <UpperInput
                  value={formClientBairro}
                  onChange={(e) => setFormClientBairro(e.target.value)}
                  placeholder="CENTRO"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  COMPLEMENTO:
                </label>
                <UpperInput
                  value={formClientComplemento}
                  onChange={(e) => setFormClientComplemento(e.target.value)}
                  placeholder="APTO 42"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer text-purple-300">
                <input
                  type="checkbox"
                  checked={formClientEhMensalista}
                  onChange={(e) => setFormClientEhMensalista(e.target.checked)}
                  className="accent-purple-500 w-4 h-4"
                />
                <span>Cliente Mensalista (Conta Mensal)</span>
              </label>

              {formClientEhMensalista && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-400">Saldo Inicial:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formClientSaldoDevedor}
                    onChange={(e) => setFormClientSaldoDevedor(e.target.value)}
                    className="w-24 px-2 py-1 bg-neutral-800 border border-neutral-700 text-amber-400 font-mono rounded text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando...' : 'Salvar Cliente'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: PRODUTO / PRATO */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProductForm}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                <span>{isEditingProduct ? 'Editar Prato / Produto' : 'Novo Prato / Produto'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME DO PRATO / PRODUTO: *
              </label>
              <UpperInput
                required
                value={formProdNome}
                onChange={(e) => setFormProdNome(e.target.value)}
                placeholder="EX: FEIJOADA COMPLETA DA FAZENDA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                CATEGORIA: *
              </label>
              <select
                value={formProdCategoriaId}
                onChange={(e) => setFormProdCategoriaId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs uppercase"
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                DESCRIÇÃO / INGREDIENTES:
              </label>
              <UpperTextarea
                rows={2}
                value={formProdDescricao}
                onChange={(e) => setFormProdDescricao(e.target.value)}
                placeholder="EX: FEIJÃO PRETO SELECIONADO COM CARNES NOBRES..."
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  PREÇO SALÃO (R$): *
                </label>
                <input
                  type="text"
                  required
                  value={formProdPrecoSalao}
                  onChange={(e) => setFormProdPrecoSalao(e.target.value)}
                  placeholder="49.90"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-amber-400 font-mono font-bold rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  PREÇO DELIVERY (R$):
                </label>
                <input
                  type="text"
                  value={formProdPrecoDelivery}
                  onChange={(e) => setFormProdPrecoDelivery(e.target.value)}
                  placeholder="44.90"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-cyan-400 font-mono font-bold rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Campo de Upload de Foto do Produto (Supabase Storage) */}
            <div className="bg-neutral-850/80 border border-neutral-700/80 p-3.5 rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase">
                  <Cloud className="w-4 h-4 text-amber-500" />
                  <span>Foto do Produto (Supabase Storage):</span>
                </label>
                {formProdUrlImagem && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormProdUrlImagem('');
                      setUploadImageError(null);
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                  >
                    Remover Foto
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {formProdUrlImagem ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700 shrink-0 shadow-xs relative">
                    <img
                      src={formProdUrlImagem}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-neutral-800 border border-dashed border-neutral-700 flex flex-col items-center justify-center shrink-0 text-neutral-500">
                    <ShoppingBag className="w-6 h-6 text-neutral-600 mb-0.5" />
                    <span className="text-[9px] font-bold">SEM FOTO</span>
                  </div>
                )}

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleUploadProductImage}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isUploadingImage
                          ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Enviando Imagem...' : 'Enviar Imagem'}</span>
                    </button>
                    {formProdUrlImagem && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Imagem Salva
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formProdUrlImagem}
                    onChange={(e) => setFormProdUrlImagem(e.target.value)}
                    placeholder="URL pública da foto no Supabase ou envie pelo botão acima..."
                    className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-[11px] truncate"
                  />
                  {uploadImageError && (
                    <span className="text-[10px] text-red-400 font-semibold">{uploadImageError}</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                DIAS DE PROGRAMAÇÃO DA SEMANA:
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase">
                {[
                  { dia: 1, label: 'Seg' },
                  { dia: 2, label: 'Ter' },
                  { dia: 3, label: 'Qua' },
                  { dia: 4, label: 'Qui' },
                  { dia: 5, label: 'Sex' },
                  { dia: 6, label: 'Sáb' },
                ].map(({ dia, label }) => {
                  const isChecked = formProdDiasSemana.includes(dia);
                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => {
                        setFormProdDiasSemana((prev) =>
                          isChecked ? prev.filter((d) => d !== dia) : [...prev, dia]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        isChecked
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={formProdPausado}
                  onChange={(e) => setFormProdPausado(e.target.checked)}
                  className="accent-red-500 w-4 h-4"
                />
                <span>Pausar / Marcar como Esgotado</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando...' : 'Salvar Prato'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: MESA */}
      {showMesaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveMesaForm}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-500" />
                <span>{isEditingMesa ? 'Editar Mesa' : 'Nova Mesa'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMesaModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NÚMERO DA MESA: *
              </label>
              <input
                type="number"
                required
                min={1}
                value={formMesaNumero}
                onChange={(e) => setFormMesaNumero(e.target.value)}
                placeholder="EX: 21"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                STATUS ATUAL:
              </label>
              <select
                value={formMesaStatus}
                onChange={(e) => setFormMesaStatus(e.target.value as Mesa['status'])}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs uppercase"
              >
                <option value="livre">LIVRE</option>
                <option value="ocupada">OCUPADA</option>
                <option value="conta">CONTA SOLICITADA</option>
                <option value="reservada">RESERVADA</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                CAPACIDADE DE PESSOAS:
              </label>
              <input
                type="number"
                min={1}
                value={formMesaPessoas}
                onChange={(e) => setFormMesaPessoas(e.target.value)}
                placeholder="4"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME DO CLIENTE / COMANDA (SE OCUPADA/RESERVADA):
              </label>
              <UpperInput
                value={formMesaCliente}
                onChange={(e) => setFormMesaCliente(e.target.value)}
                placeholder="EX: FAMÍLIA SILVA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowMesaModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando...' : 'Salvar Mesa'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: USUÁRIO */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Operação irreversível no Supabase</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir permanentemente o funcionário{' '}
              <strong className="text-white uppercase font-black">{userToDelete.nome}</strong> (
              <span className="font-mono text-neutral-400">{userToDelete.email}</span>)?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: CLIENTE */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Operação irreversível no Supabase</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir o cadastro do cliente{' '}
              <strong className="text-white uppercase font-black">{clientToDelete.nome}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClient}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: PRODUTO */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Remover prato do cardápio do sistema</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir o produto{' '}
              <strong className="text-white uppercase font-black">{productToDelete.nome}</strong> do cardápio?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: MESA */}
      {mesaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Remover mesa do salão</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir a <strong className="text-white uppercase font-black">Mesa {mesaToDelete.numero}</strong> do salão?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setMesaToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMesa}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CATEGORIA */}
      {showCategoriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveCategoriaForm}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-500" />
                <span>{isEditingCategoria ? 'Editar Categoria do Cardápio' : 'Nova Categoria'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCategoriaModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME DA CATEGORIA: * (EM MAIÚSCULAS)
              </label>
              <UpperInput
                required
                value={formCategoriaNome}
                onChange={(e) => setFormCategoriaNome(e.target.value)}
                placeholder="EX: PRATOS EXECUTIVOS DA CASA"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                ORDEM DE EXIBIÇÃO NO CARDÁPIO:
              </label>
              <input
                type="number"
                min={1}
                value={formCategoriaOrdem}
                onChange={(e) => setFormCategoriaOrdem(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Define a ordem sequencial em que a seção aparece no cardápio e nos pedidos.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowCategoriaModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando...' : 'Salvar Categoria'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: CATEGORIA */}
      {categoriaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Remover categoria do sistema</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir a categoria{' '}
              <strong className="text-white uppercase font-black">{categoriaToDelete.nome}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setCategoriaToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategoria}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: BAIRRO & TAXA */}
      {showBairroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveBairroForm}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                <span>{isEditingBairro ? 'Editar Bairro / Taxa de Entrega' : 'Novo Bairro para Delivery'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBairroModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                NOME DO BAIRRO (PIRACICABA): * (EM MAIÚSCULAS)
              </label>
              <UpperInput
                required
                value={formBairroNome}
                onChange={(e) => setFormBairroNome(e.target.value)}
                placeholder="EX: VILA REZENDE"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                TAXA DE ENTREGA (R$): *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-neutral-500 text-xs font-bold">R$</span>
                <input
                  type="text"
                  required
                  value={formBairroTaxa}
                  onChange={(e) => setFormBairroTaxa(e.target.value)}
                  placeholder="8.00"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-cyan-400 font-mono font-bold rounded-lg text-xs"
                />
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Valor cobrado automaticamente no cálculo de pedidos para este bairro.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowBairroModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando...' : 'Salvar Bairro'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: BAIRRO */}
      {bairroToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Remover bairro do delivery</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir a rota de entrega do bairro{' '}
              <strong className="text-white uppercase font-black">{bairroToDelete.bairro}</strong> (Taxa:{' '}
              {formatBRL(bairroToDelete.taxa)})?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setBairroToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBairro}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: FORMA DE PAGAMENTO (INCLUSÃO / EDIÇÃO)
          ========================================================================= */}
      {showFpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveFpSubmit}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-amber-500">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-base font-black text-white uppercase">
                  {isEditingFp ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFpModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <UpperInput
              label="Nome da Forma de Pagamento: *"
              value={formFpNome}
              onChange={setFormFpNome}
              placeholder="EX: CARTÃO ELO CRÉDITO, TICKET REFEIÇÃO, PIX BRADESCO..."
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1 uppercase">
                  Categoria / Tipo: *
                </label>
                <select
                  value={formFpTipo}
                  onChange={(e) => setFormFpTipo(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs uppercase font-bold focus:outline-none"
                >
                  <option value="dinheiro">DINHEIRO (ESPÉCIE)</option>
                  <option value="pix">PIX (TRANSFERÊNCIA)</option>
                  <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                  <option value="cartao_credito">CARTÃO DE CRÉDITO</option>
                  <option value="vale_refeicao">VALE REFEIÇÃO / TICKET</option>
                  <option value="mensalista">MENSALISTA (FATURADO)</option>
                  <option value="outro">OUTRO / VOUCHER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1 uppercase">
                  Taxa da Operadora (%):
                </label>
                <input
                  type="text"
                  value={formFpTaxa}
                  onChange={(e) => setFormFpTaxa(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs font-mono font-bold focus:outline-none"
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Ex: 1.99 para 1.99% descontado na maquininha
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1 uppercase">
                  Ordem de Exibição:
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={formFpOrdem}
                  onChange={(e) => setFormFpOrdem(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="flex flex-col justify-center gap-2 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFpPermiteTroco}
                    onChange={(e) => setFormFpPermiteTroco(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span>Permite Troco em Dinheiro</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-neutral-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFpAtivo}
                    onChange={(e) => setFormFpAtivo(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span className={formFpAtivo ? 'text-emerald-400' : 'text-neutral-400'}>
                    Forma de Pagamento Ativa
                  </span>
                </label>
              </div>
            </div>

            <UpperInput
              label="Descrição / Detalhes (Opcional):"
              value={formFpDescricao}
              onChange={setFormFpDescricao}
              placeholder="EX: TAXA APLICADA DIRETO PELA OPERADORA STONE / CIELO..."
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 mt-2">
              <button
                type="button"
                onClick={() => setShowFpModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSaving ? 'Gravando em Nuvem...' : 'Salvar Forma de Pagamento'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO: FORMA DE PAGAMENTO */}
      {fpToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase">Confirmar Exclusão</h3>
                <span className="text-xs text-neutral-400">Remover forma de pagamento</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Deseja realmente excluir a forma de pagamento{' '}
              <strong className="text-white uppercase font-black">{fpToDelete.nome}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setFpToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFp}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSaving ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

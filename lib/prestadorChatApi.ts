import { supabase } from './supabase';

export interface MensagemChat {
  id: string;
  conversa_id: string;
  remetente_id: string;
  remetente_tipo: 'sindico' | 'prestador' | 'sistema';
  remetente_nome: string;
  texto: string;
  anexos?: Array<{ url: string; tipo: string; nome?: string }>;
  criado_em: string;
  lida: boolean;
}

export interface ConversaItemPrestador {
  id: string;
  solicitacao_id: string;
  solicitacao_titulo: string;
  condominio_id: string;
  condominio_nome: string;
  sindico_nome: string;
  sindico_foto_url?: string | null;
  ultima_mensagem_texto: string;
  ultima_mensagem_em: string;
  nao_lidas_count: number;
}

/**
 * 1. LISTAR CONVERSAS DO PRESTADOR
 */
export async function listarConversasDoPrestador(
  prestadorId: string
): Promise<ConversaItemPrestador[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Busca conversas onde prestador_id = prestadorId ou membro_b_id = user.id
    const { data: convs, error } = await supabase
      .from('chat_conversas')
      .select(`
        id,
        solicitacao_id,
        condominio_id,
        prestador_id,
        ultima_mensagem_texto,
        ultima_mensagem_em,
        solicitacao:solicitacoes (
          id,
          titulo,
          categoria,
          condominio:condominios (
            id,
            nome
          )
        )
      `)
      .or(`prestador_id.eq.${prestadorId},membro_b_id.eq.${user.id}`)
      .order('ultima_mensagem_em', { ascending: false });

    if (error || !convs) {
      console.warn('[PrestadorChatAPI] Falha ao listar conversas:', error);
      return [];
    }

    const lista: ConversaItemPrestador[] = [];
    for (const c of convs) {
      const s = (c as any).solicitacao;
      const condo = s?.condominio;

      // Busca contagem de não lidas
      let unread = 0;
      try {
        const { count } = await supabase
          .from('chat_mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('conversa_id', c.id)
          .neq('remetente_id', user.id)
          .eq('lida', false);
        unread = count || 0;
      } catch (_) {}

      lista.push({
        id: c.id,
        solicitacao_id: c.solicitacao_id,
        solicitacao_titulo: s?.titulo || 'Serviço Predial',
        condominio_id: c.condominio_id,
        condominio_nome: condo?.nome || 'Condomínio Residencial',
        sindico_nome: 'Síndico / Gestor',
        ultima_mensagem_texto: c.ultima_mensagem_texto || 'Toque para conversar com o síndico',
        ultima_mensagem_em: c.ultima_mensagem_em || new Date().toISOString(),
        nao_lidas_count: unread,
      });
    }

    return lista;
  } catch (err) {
    console.error('[PrestadorChatAPI] Erro ao carregar conversas:', err);
    return [];
  }
}

/**
 * 2. CARREGAR MENSAGENS DE UMA CONVERSA
 */
export async function carregarMensagensConversa(
  conversaId: string
): Promise<MensagemChat[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('chat_mensagens')
      .select('*')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
      .limit(100);

    if (error || !data) return [];
    return data.map((m: any) => {
      const sender = m.remetente_id || m.sender_id;
      const isMine = sender === user?.id;
      return {
        id: m.id,
        conversa_id: m.conversa_id,
        remetente_id: sender,
        remetente_tipo: isMine ? 'prestador' : 'sindico',
        remetente_nome: isMine ? 'Eu' : 'Síndico',
        texto: m.conteudo || m.conteudo_texto || m.texto || '',
        anexos: m.anexo_url ? [{ url: m.anexo_url, tipo: 'imagem', nome: m.anexo_nome }] : [],
        criado_em: m.criado_em,
        lida: Boolean(m.lida),
      };
    });
  } catch (err) {
    console.error('[PrestadorChatAPI] Erro ao carregar mensagens:', err);
    return [];
  }
}

/**
 * 3. ENVIAR MENSAGEM NO CHAT
 */
export async function enviarMensagemPrestador(params: {
  conversaId: string;
  texto: string;
  prestadorNome: string;
}): Promise<{ sucesso: boolean; mensagem?: MensagemChat; erro?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const novaMensagem = {
      conversa_id: params.conversaId,
      remetente_id: user.id,
      sender_id: user.id,
      conteudo: params.texto.trim(),
      conteudo_texto: params.texto.trim(),
      tipo_mensagem: 'texto',
      tipo: 'texto',
      criado_em: new Date().toISOString(),
      lida: false,
    };

    const { data, error } = await supabase
      .from('chat_mensagens')
      .insert(novaMensagem)
      .select('*')
      .single();

    if (error) throw error;

    // Atualiza preview na tabela chat_conversas
    try {
      await supabase
        .from('chat_conversas')
        .update({
          ultima_mensagem_texto: params.texto.trim(),
          ultima_mensagem_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', params.conversaId);
    } catch (_) {}

    return {
      sucesso: true,
      mensagem: {
        id: data.id,
        conversa_id: data.conversa_id,
        remetente_id: user.id,
        remetente_tipo: 'prestador',
        remetente_nome: 'Eu',
        texto: data.conteudo || data.conteudo_texto || params.texto.trim(),
        criado_em: data.criado_em,
        lida: false,
      },
    };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Falha ao enviar mensagem.' };
  }
}

/**
 * 4. INICIAR OU LOCALIZAR CONVERSA DE UM PEDIDO
 */
export async function obterOuCriarConversaPedido(
  solicitacaoId: string,
  prestadorId: string,
  condominioId?: string | null
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Tenta encontrar conversa existente
    const { data: existente } = await supabase
      .from('chat_conversas')
      .select('id')
      .eq('solicitacao_id', solicitacaoId)
      .eq('prestador_id', prestadorId)
      .maybeSingle();

    if (existente?.id) return existente.id;

    // Busca detalhes da solicitação se condomínio ou síndico não informados
    let condoId = condominioId && condominioId.trim() ? condominioId.trim() : null;
    let sindicoUserId: string | null = null;
    if (solicitacaoId) {
      const { data: sol } = await supabase
        .from('solicitacoes')
        .select('condominio_id, solicitado_por')
        .eq('id', solicitacaoId)
        .maybeSingle();
      if (sol) {
        if (!condoId && sol.condominio_id) condoId = sol.condominio_id;
        sindicoUserId = sol.solicitado_por;
      }
    }

    // 2. Se não existir, cria nova conversa vinculada
    const { data: criada, error } = await supabase
      .from('chat_conversas')
      .insert({
        solicitacao_id: solicitacaoId,
        condominio_id: condoId,
        prestador_id: prestadorId,
        tipo_conversa: 'pedido_prestador',
        membro_a_id: user?.id,
        membro_b_id: sindicoUserId,
        criado_por: user?.id,
        ultima_mensagem_texto: 'Canal de chat iniciado com o síndico.',
        ultima_mensagem_em: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !criada) {
      console.warn('[PrestadorChatAPI] Erro ao inserir conversa:', error);
      return null;
    }
    return criada.id;
  } catch (err) {
    console.error('[PrestadorChatAPI] Erro ao obter/criar conversa:', err);
    return null;
  }
}

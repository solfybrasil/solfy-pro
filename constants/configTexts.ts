// ─────────────────────────────────────────────────────────────────────────────
//  Solfy Condo — Arquivo Central de Textos de Configurações (pt-BR)
//  Regra B13: Textos curtos, sem jargão, sem tom de acusação, nada fixo nas telas
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG_TEXTS = {
  comum: {
    voltar: 'Voltar',
    salvar: 'Salvar alterações',
    salvando: 'Salvando...',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
    tentarDeNovo: 'Tentar de novo',
    fechar: 'Fechar',
    emBreveBadge: 'Em breve',
    emBreveAvisoPadrao: 'Este recurso está em preparação e será liberado em breve.',
    offlineBannerTitulo: 'Você está sem conexão',
    offlineBannerSubtitulo: 'Mostrando os últimos dados salvos neste aparelho. Alterações exigem internet.',
    offlineBloqueioEscrita: 'Sem conexão no momento. Conecte-se à internet para salvar alterações.',
    erroCarregarTitulo: 'Não foi possível carregar as informações',
    erroGenericoServidor: 'Não conseguimos concluir esta ação agora. Tente novamente em instantes.',
    alteracoesNaoSalvasTitulo: 'Descartar alterações?',
    alteracoesNaoSalvasSubtitulo: 'Você fez alterações que ainda não foram salvas. Deseja sair mesmo assim?',
    descartar: 'Descartar e sair',
    continuarEditando: 'Continuar editando',
  },

  cabecalho: {
    tituloTela: 'Configurações',
    subtituloTela: 'Conta, condomínio e preferências',
    seloVerificado: 'Cadastro verificado',
    seloEmAnalise: 'Cadastro em análise',
    completePerfilTitulo: 'Complete seu perfil profissional',
    completePerfilBotao: 'Completar agora',
    semCondominioAtivo: 'Condomínio em vinculação',
  },

  busca: {
    placeholder: 'Buscar em configurações (ex.: senha, mandato, foto)...',
    limpar: 'Limpar busca',
    vazioTitulo: 'Nenhum item encontrado',
    vazioSubtitulo: 'Tente buscar por outro termo, como "perfil", "senha" ou "tema".',
  },

  grupos: {
    conta: 'CONTA & GOVERNANÇA',
    preferencias: 'PREFERÊNCIAS',
    suporte: 'SUPORTE & PRIVACIDADE',
  },

  linhas: {
    meu_perfil: {
      titulo: 'Meu Perfil',
      subtitulo: 'Foto, telefone, apresentação e dados verificados',
      keywords: 'nome foto avatar telefone cargo bio cpf documentos email',
    },
    seguranca_senha: {
      titulo: 'Segurança & Senha',
      subtitulo: 'Senha de acesso, verificação em 2 etapas e aparelhos',
      keywords: 'senha 2fa mfa sessao aparelhos desconectar seguranca',
    },
    mandato_vistorias: {
      titulo: 'Mandato & Vistorias',
      subtitulo: 'Vigência da ata, posse e termo de responsabilidade',
      keywords: 'mandato ata assembleia vistoria posse sindico',
    },
    meus_condominios: {
      titulo: 'Meus Condomínios',
      subtitulo: 'Condomínio ativo e regras operacionais',
      keywords: 'condominio unidades cnpj sla regras',
    },
    equipe_permissoes: {
      titulo: 'Equipe & Permissões',
      subtitulo: 'Subsíndico, conselho fiscal e zeladoria',
      keywords: 'equipe membros conselheiro zelador subsindico convite',
    },
    plano_pagamento: {
      titulo: 'Plano & Pagamento',
      subtitulo: 'Assinatura do condomínio e faturas',
      keywords: 'plano assinatura fatura boleto pix pagamento',
    },
    notificacoes: {
      titulo: 'Notificações',
      subtitulo: 'Alertas no aparelho, e-mail e horário silencioso',
      keywords: 'notificacoes push alertas silencio avisos',
    },
    tema: {
      titulo: 'Tema e Aparência',
      subtitulo: 'Modo claro, escuro ou automático do sistema',
      keywords: 'tema claro escuro aparencia',
    },
    idioma: {
      titulo: 'Idioma e Região',
      subtitulo: 'Idioma da interface e fuso horário',
      keywords: 'idioma portugues regiao fuso',
    },
    integracoes_whatsapp: {
      titulo: 'Integrações & WhatsApp',
      subtitulo: 'Conexões externas e avisos automatizados',
      keywords: 'whatsapp integracao erp portaria',
    },
    central_ajuda: {
      titulo: 'Central de Ajuda',
      subtitulo: 'Perguntas frequentes e guias rápidos para o síndico',
      keywords: 'ajuda faq duvidas suporte guia',
    },
    fale_conosco: {
      titulo: 'Fale Conosco',
      subtitulo: 'Atendimento direto com a equipe Solfy Condo',
      keywords: 'fale conosco suporte contato atendimento',
    },
    privacidade_lgpd: {
      titulo: 'Privacidade & LGPD',
      subtitulo: 'Seus dados, histórico de atividade e termos de uso',
      keywords: 'privacidade lgpd dados auditoria termos',
    },
    sobre_solfy: {
      titulo: 'Sobre a Solfy',
      subtitulo: 'Informações da versão, licenças e status do sistema',
      keywords: 'sobre versao build solfy',
    },
    acessibilidade: {
      titulo: 'Acessibilidade',
      subtitulo: 'Alto contraste, redução de movimento e transparência',
      keywords: 'acessibilidade contraste movimento animacao fonte visao',
    },
  },

  desconectar: {
    botao: 'Desconectar desta conta',
    botaoTodos: 'Sair de todos os dispositivos',
    confirmarTitulo: 'Deseja desconectar?',
    confirmarMensagem: 'Sua sessão neste aparelho será encerrada com segurança e os rascunhos locais serão limpos.',
    confirmarBotao: 'Desconectar',
    confirmarTodosTitulo: 'Sair de todos os aparelhos?',
    confirmarTodosMensagem: 'Todas as sessões abertas e notificações em outros dispositivos serão encerradas imediatamente.',
    confirmarTodosBotao: 'Encerrar tudo',
    sucessoAviso: 'Sessão encerrada com segurança.',
  },

  reautenticar: {
    titulo: 'Confirme sua senha',
    subtitulo: 'Por segurança, digite sua senha atual para continuar.',
    labelSenha: 'Sua senha atual',
    placeholderSenha: 'Digite sua senha',
    botaoConfirmar: 'Confirmar identidade',
    erroSenhaVazia: 'Digite sua senha atual para continuar.',
    erroSenhaIncorreta: 'A senha informada não confere. Tente novamente.',
  },

  meuPerfil: {
    titulo: 'Meu Perfil',
    subtitulo: 'Mantenha seus dados de contato atualizados para o condomínio.',
    progressoTitulo: 'Perfil profissional',
    progressoCompleto: 'Seu perfil profissional está completo.',
    fotoSecaoTitulo: 'Foto de perfil',
    fotoSecaoSubtitulo: 'JPG, PNG ou WEBP até 5 MB. A localização (EXIF) é removida automaticamente.',
    fotoTrocar: 'Trocar foto',
    fotoRemover: 'Remover foto',
    fotoConfirmarRemoverTitulo: 'Remover foto de perfil?',
    fotoConfirmarRemoverMsg: 'Sua foto atual será removida e substituída pelas suas iniciais.',
    fotoErroTamanho: 'A imagem escolhida passa de 5 MB. Escolha uma foto menor.',
    fotoErroFormato: 'Formato não suportado. Escolha uma imagem JPG, PNG ou WEBP.',
    fotoSucesso: 'Foto de perfil atualizada com sucesso.',
    fotoRemovidaSucesso: 'Foto de perfil removida.',

    secaoEditaveisTitulo: 'DADOS EDITÁVEIS',
    nomeExibicaoLabel: 'Nome de exibição',
    nomeExibicaoPlaceholder: 'Como você prefere ser chamado no app',
    nomeExibicaoAjuda: 'Entre 2 e 80 caracteres. Visível no cabeçalho do app.',
    nomeExibicaoErro: 'Informe um nome válido entre 2 e 80 caracteres, sem códigos ou tags.',

    telefoneLabel: 'Telefone de contato',
    telefonePlaceholder: '(11) 99999-9999',
    telefoneSeloNaoVerificado: 'Informado (não verificado por SMS)',
    telefoneAjuda: 'Formato brasileiro com DDD. No período Beta não enviamos código por SMS.',
    telefoneErro: 'Informe um telefone válido com DDD (10 ou 11 dígitos).',

    cargoLabel: 'Cargo ou função',
    cargoPlaceholder: 'Ex.: Síndico Profissional, Síndico Morador',
    cargoAjuda: 'Até 80 caracteres.',
    cargoErro: 'O cargo deve ter no máximo 80 caracteres.',

    bioLabel: 'Apresentação curta',
    bioPlaceholder: 'Conte brevemente sua experiência ou horários de atendimento ao condomínio',
    bioAjuda: 'Até 280 caracteres.',
    bioErro: 'A apresentação deve ter no máximo 280 caracteres.',

    preferenciaContatoLabel: 'Canal preferido para avisos operacionais',
    preferenciasContatoOpcoes: [
      { valor: 'whatsapp', label: 'WhatsApp' },
      { valor: 'chat_app', label: 'Chat no App' },
      { valor: 'email', label: 'E-mail' },
      { valor: 'telefone', label: 'Ligação' },
    ],

    salvarSucesso: 'Seu perfil foi atualizado com sucesso.',

    secaoEmailTitulo: 'E-MAIL DE ACESSO',
    emailAtualLabel: 'E-mail cadastrado',
    emailPendenteAviso: 'Confirmação pendente para o novo e-mail. Enquanto você não clicar no link enviado, o e-mail atual continua valendo.',
    emailBotaoAlterar: 'Trocar e-mail de acesso',
    emailModalTitulo: 'Trocar e-mail de acesso',
    emailModalSubtitulo: 'Enviaremos um link de confirmação para o novo endereço e um aviso de segurança para o e-mail atual.',
    emailNovoLabel: 'Novo endereço de e-mail',
    emailNovoPlaceholder: 'seu.novo@email.com.br',
    emailErroInvalido: 'Informe um endereço de e-mail válido e diferente do atual.',
    emailSucessoSolicitacao: 'Solicitação registrada! Confirme o link enviado ao novo e-mail.',

    secaoVerificadosTitulo: 'SEUS DADOS VERIFICADOS',
    secaoVerificadosExplicacao: 'Estes dados foram conferidos na aprovação do seu cadastro para garantir a segurança jurídica do condomínio. Para alterá-los, envie uma solicitação à equipe da Solfy.',
    seloVerificadoEm: 'Verificado em',
    seloAprovado: 'Verificado',
    nomeCompletoVerificadoLabel: 'Nome civil completo',
    cpfVerificadoLabel: 'CPF registrado',
    documentosVerificadosLabel: 'Documentos homologados no cadastro',
    botaoSolicitarAlteracao: 'Solicitar alteração cadastral',

    modalSolicitacaoTitulo: 'Solicitar alteração cadastral',
    modalSolicitacaoSubtitulo: 'Sua solicitação será analisada pela Mesa de Conferência da Solfy. Os dados atuais permanecem válidos até a aprovação.',
    solicitacaoCampoLabel: 'Qual dado precisa de atualização?',
    solicitacaoCamposOpcoes: [
      { valor: 'ata_mandato', label: 'Ata / Mandato' },
      { valor: 'nome_completo', label: 'Nome civil' },
      { valor: 'documento_identidade', label: 'Documento RG/CNH' },
      { valor: 'cpf', label: 'Correção de CPF' },
    ],
    solicitacaoValorPropostoLabel: 'Novo valor ou descrição do documento',
    solicitacaoValorPropostoPlaceholder: 'Ex.: Ata da Assembleia Ordinária de 10/10/2026',
    solicitacaoMotivoLabel: 'Motivo da alteração',
    solicitacaoMotivoPlaceholder: 'Explique com detalhes por que este dado verificado precisa ser atualizado (mínimo de 10 caracteres)',
    solicitacaoAnexoBotao: 'Anexar foto do comprovante (opcional)',
    solicitacaoAnexoTrocar: 'Trocar comprovante anexado',
    solicitacaoEnviarBotao: 'Enviar para análise',
    solicitacaoErroMotivo: 'Descreva o motivo com pelo menos 10 caracteres.',
    solicitacaoSucesso: 'Solicitação enviada para a Mesa de Conferência.',
    historicoSolicitacoesTitulo: 'Solicitações enviadas',
  },

  segurancaSenha: {
    titulo: 'Segurança & Senha',
    subtitulo: 'Proteção de nível financeiro para a conta do síndico.',

    secaoSenhaTitulo: 'ALTERAR SENHA DE ACESSO',
    secaoSenhaDescricao: 'Ao alterar sua senha, todas as outras sessões abertas em outros aparelhos serão encerradas automaticamente.',
    senhaAtualLabel: 'Senha atual',
    senhaAtualPlaceholder: 'Digite sua senha atual',
    novaSenhaLabel: 'Nova senha',
    novaSenhaPlaceholder: 'Mínimo de 8 caracteres',
    confirmarSenhaLabel: 'Confirmar nova senha',
    confirmarSenhaPlaceholder: 'Repita a nova senha',
    regrasSenhaTitulo: 'Requisitos de segurança da senha:',
    regraTamanho: 'Pelo menos 8 caracteres',
    regraMaiusculaMinuscula: 'Letras maiúsculas e minúsculas (A-z)',
    regraNumero: 'Pelo menos um número (0-9)',
    regraSimbolo: 'Pelo menos um símbolo especial (!@#$%&*)',
    forcaFraca: 'Fraca',
    forcaMedia: 'Média',
    forcaForte: 'Forte',
    forcaExcelente: 'Excelente',
    botaoAlterarSenha: 'Atualizar senha e desconectar outros aparelhos',
    erroSenhaAtualVazia: 'Informe sua senha atual.',
    erroNovaSenhaFraca: 'A nova senha precisa cumprir todos os requisitos de segurança.',
    erroConfirmacaoDiferente: 'A confirmação da nova senha não confere.',
    erroNovaIgualAtual: 'A nova senha deve ser diferente da senha atual.',
    sucessoSenhaAlterada: 'Senha alterada com sucesso! Outras sessões foram encerradas.',

    secaoMfaTitulo: 'VERIFICAÇÃO EM DUAS ETAPAS (2FA)',
    secaoMfaDescricao: 'Use um aplicativo autenticador (Google Authenticator, Authy, 1Password ou iCloud Keychain) para proteger sua conta com códigos temporários de 6 dígitos.',
    selo2faAtivo: 'Ativada (TOTP)',
    selo2faRecomendado: 'Recomendada para o síndico',
    selo2faObrigatorio: 'Obrigatória para o síndico',
    mfaExplicacaoAtivo: 'Sua conta está protegida por verificação em duas etapas. Um código de 6 dígitos será solicitado ao entrar.',
    mfaExplicacaoInativo: 'Ative o segundo fator de autenticação para impedir acessos não autorizados mesmo que alguém descubra sua senha.',
    botaoConfigurar2fa: 'Configurar aplicativo autenticador',
    botaoDesativar2fa: 'Desativar verificação em 2 etapas',
    passo1QrTitulo: '1. Escaneie o QR Code no seu app autenticador',
    passo1QrSubtitulo: 'Abra seu aplicativo autenticador, toque em adicionar conta (+) e aponte a câmera para o código abaixo:',
    passo2ChaveManualTitulo: 'Ou copie a chave de configuração manual:',
    botaoCopiarChave: 'Copiar chave secreta',
    chaveCopiadaAviso: 'Chave manual copiada para a área de transferência.',
    passo3CodigoTitulo: '2. Digite o primeiro código de 6 dígitos gerado pelo app',
    codigoTotpPlaceholder: '000000',
    botaoConfirmarAtivacao2fa: 'Confirmar e ativar 2FA',
    erroCodigoTotpInvalido: 'Digite o código numérico de 6 dígitos exibido no seu aplicativo autenticador.',
    sucesso2faAtivado: 'Verificação em duas etapas (2FA) ativada com sucesso!',
    sucesso2faDesativado: 'Verificação em duas etapas desativada.',

    recuperacao2faCardTitulo: 'Perdeu acesso ao aparelho autenticador?',
    recuperacao2faCardSubtitulo: 'Por segurança, não geramos códigos fixos que possam vazar. Se você trocar ou perder o celular sem transferir o autenticador, solicite a revalidação de identidade à Mesa de Conferência da Solfy.',
    botaoSolicitarRecuperacao2fa: 'Solicitar recuperação de 2FA ao Admin',
    modalRecuperacao2faTitulo: 'Recuperação de 2FA com revalidação',
    modalRecuperacao2faSubtitulo: 'Nossa equipe conferirá sua identidade cadastral para liberar o cadastramento de um novo autenticador.',
    recuperacaoMotivoLabel: 'Motivo da solicitação',
    recuperacaoMotivoPlaceholder: 'Explique o ocorrido (ex.: troquei de aparelho celular e não tenho mais acesso ao autenticador antigo)',
    sucessoRecuperacao2fa: 'Solicitação de recuperação de 2FA registrada na Mesa de Conferência.',

    secaoSessoesTitulo: 'SESSÕES E APARELHOS CONECTADOS',
    secaoSessoesDescricao: 'Aparelhos com sessão ativa na sua conta. Por privacidade, nunca armazenamos seu endereço IP completo.',
    seloEsteAparelho: 'Este aparelho',
    botaoEncerrarAparelho: 'Encerrar',
    confirmarEncerrarAparelhoTitulo: 'Encerrar acesso deste aparelho?',
    confirmarEncerrarAparelhoMsg: 'A sessão selecionada será desconectada imediatamente.',
    sucessoAparelhoEncerrado: 'Sessão encerrada com sucesso.',

    secaoTravaLocalTitulo: 'TRAVA DO APP NESTE APARELHO (SÓ LOCAL)',
    secaoTravaLocalDescricao: 'Exige confirmação ao reabrir o aplicativo neste dispositivo. Esta preferência fica salva apenas neste aparelho e nunca vai para o servidor.',
    travaLocalInterruptorLabel: 'Solicitar confirmação ao abrir o app',
    travaLocalTempoLabel: 'Tempo para bloquear após sair da tela',
    travaLocalOpcoesTempo: [
      { valor: 'imediato', label: 'Imediato' },
      { valor: '1min', label: 'Após 1 min' },
      { valor: '5min', label: 'Após 5 min' },
    ],
    travaLocalSalvaAviso: 'Preferência local de bloqueio atualizada neste aparelho.',

    secaoAvisosEmailTitulo: 'AVISOS DE SEGURANÇA POR E-MAIL',
    secaoAvisosEmailDescricao: 'Alertas críticos (troca de senha, alteração de 2FA, troca de e-mail e login em novo aparelho) são obrigatórios e permanecem sempre ativos para sua proteção.',
    seloObrigatorioAtivo: 'Obrigatório • Sempre ativo',

    secaoAtividadesTitulo: 'ATIVIDADE RECENTE DE SEGURANÇA',
    secaoAtividadesDescricao: 'Últimos eventos auditados na sua conta.',
  },

  notificacoes: {
    titulo: 'Notificações & Canais',
    subtitulo: 'Controle onde e quando receber avisos de pedidos, visitas e prazos',
    secaoCanaisTitulo: 'ONDE VOCÊ RECEBE CADA TIPO DE AVISO',
    secaoCanaisDescricao: 'Escolha os canais ativos para cada categoria de evento. Categorias de segurança e conformidade são obrigatórias para resguardar o condomínio.',
    canalApp: 'Central no App',
    canalPush: 'Notificação Push',
    canalEmail: 'E-mail',
    seloObrigatoria: 'Obrigatória',
    ajudaObrigatoria: 'Alertas de segurança e decisões de cadastro não podem ser desativados para sua proteção.',
    
    categorias: {
      pedidos_orcamentos: {
        titulo: 'Pedidos e orçamentos',
        descricao: 'Novas cotações recebidas, propostas de prestadores e chamados.',
      },
      visitas_execucao: {
        titulo: 'Visitas técnicas e execução',
        descricao: 'Agendamentos de visitas, lembretes de chegada e conclusão de obras.',
      },
      prazos: {
        titulo: 'Prazos de mandato e vistorias',
        descricao: 'Avisos de mandato a vencer, laudos e manutenções obrigatórias atrasadas.',
      },
      equipe_convites: {
        titulo: 'Equipe e convites',
        descricao: 'Novos membros que aceitaram convites no condomínio e alterações de função.',
      },
      comunicados_solfy: {
        titulo: 'Comunicados da Solfy',
        descricao: 'Novidades de plataforma, avisos no mural e orientações operacionais.',
      },
      seguranca_conta: {
        titulo: 'Segurança da conta',
        descricao: 'Trocas de senha, novo login em aparelho e alterações de 2FA.',
      },
      decisoes_cadastro: {
        titulo: 'Decisões cadastrais',
        descricao: 'Aprovações e solicitações respondidas pela Mesa de Conferência.',
      },
    },

    secaoSilenciosoTitulo: 'HORÁRIO SILENCIOSO',
    secaoSilenciosoDescricao: 'Durante este intervalo, as notificações push não emitem som nem vibração no aparelho. Todos os avisos continuam sendo guardados na Central do app.',
    silenciosoInterruptorLabel: 'Ativar horário silencioso',
    silenciosoHorarioInicioLabel: 'Início',
    silenciosoHorarioFimLabel: 'Término',
    silenciosoHorarioAjuda: 'Horários configurados no fuso oficial do seu condomínio.',

    secaoPrivacidadeTitulo: 'PRIVACIDADE & RESUMOS',
    secaoPrivacidadeDescricao: 'Controle o nível de detalhe exibido e a frequência de relatórios.',
    ocultarBloqueadaLabel: 'Ocultar conteúdo na tela bloqueada',
    ocultarBloqueadaDescricao: 'O push exibirá apenas texto genérico sem expor detalhes confidenciais.',
    resumoDiarioLabel: 'Resumo diário por e-mail',
    resumoDiarioDescricao: 'Em vez de avisos individuais imediatos, receba um compilado matinal dos comunicados.',

    secaoDispositivosTitulo: 'APARELHOS HABILITADOS',
    dispositivosConectadosTexto: 'aparelho(s) configurado(s) para receber notificações push desta conta.',
    
    botaoEnviarTeste: 'Enviar notificação de teste',
    enviandoTeste: 'Enviando teste...',
    sucessoTeste: 'Notificação de teste enviada! Verifique sua Central de Notificações e sua barra de status.',
    
    permissaoPushNegadaTitulo: 'Notificações push desativadas no aparelho',
    permissaoPushNegadaDescricao: 'Para receber avisos em tempo real, ative as permissões do Solfy Condo nos Ajustes do seu sistema operacional.',
    botaoAbrirAjustes: 'Abrir ajustes do sistema',
    
    centralTitulo: 'Central de Notificações',
    centralSubtitulo: 'Histórico auditável de avisos do seu condomínio',
    botaoMarcarTodasLidas: 'Marcar todas como lidas',
    marcadasTodasLidasAviso: 'Todas as notificações foram marcadas como lidas.',
    nenhumaNotificacaoTitulo: 'Nenhuma notificação no momento',
    nenhumaNotificacaoDescricao: 'Você está em dia. Quando houver novas cotações, visitas ou comunicados, eles aparecerão aqui.',
    filtroTodas: 'Todas',
    filtroNaoLidas: 'Não lidas',
    seloNaoLida: 'Nova',
  },

  aparencia: {
    titulo: 'Tema & Aparência',
    subtitulo: 'Escolha como o Solfy Condo é exibido no seu aparelho',
    modoAparenciaLabel: 'Modo de exibição',
    opcoes: {
      claro: {
        titulo: 'Claro',
        descricao: 'Fundo branco puro com detalhes em verde musgo',
      },
      escuro: {
        titulo: 'Escuro',
        descricao: 'Tons grafite e ardósia para ambientes com pouca luz',
      },
      sistema: {
        titulo: 'Sistema',
        descricao: 'Acompanha automaticamente os ajustes do seu aparelho',
      },
    },
    avisoEscuroHonesto: 'O tema escuro reduz a luminosidade e mantém os elementos em alto contraste.',
  },

  idiomaConfig: {
    titulo: 'Idioma & Região',
    subtitulo: 'Preferências regionais, formatos e linguagem do aplicativo',
    seletorIdiomaLabel: 'Idioma da interface',
    opcoes: {
      ptBR: {
        label: 'Português (Brasil)',
        ativo: true,
        detalhe: 'Idioma padrão homologado com termos jurídicos e condominiais do Brasil',
      },
      enUS: {
        label: 'English (US)',
        ativo: false,
        badge: 'Em breve',
        detalhe: 'Tradução do portal e termos em homologação para síndicos bilíngues',
      },
      esES: {
        label: 'Español',
        ativo: false,
        badge: 'Em breve',
        detalhe: 'Versão em espanhol em preparação regulatória',
      },
    },
    fusoHorarioTitulo: 'Fuso horário e convenções',
    fusoHorarioDesc: 'Horário de Brasília (America/Sao_Paulo). Formato de data em DD/MM/AAAA e moeda em Real (R$).',
  },

  acessibilidadeConfig: {
    titulo: 'Acessibilidade',
    subtitulo: 'Recursos para navegação clara, confortável e inclusiva',
    altoContraste: {
      titulo: 'Alto contraste',
      descricao: 'Reforça bordas, botões e saturação de textos para leitura mais nítida',
    },
    reduzirMovimento: {
      titulo: 'Reduzir movimento',
      descricao: 'Diminui animações de transição, rolagem e abertura de folhas',
    },
    reduzirTransparencia: {
      titulo: 'Reduzir transparência',
      descricao: 'Substitui vidros e fundos translúcidos por cores sólidas e opacas',
    },
  },

  rodape: {
    prefixoApp: 'Solfy Condo',
    versaoLabel: 'Versão',
    buildLabel: 'Build',
    ambienteDev: 'Ambiente de Desenvolvimento',
  },
} as const;

export function traduzirErroServidor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();

  if (lower.includes('network request failed') || lower.includes('failed to fetch') || lower.includes('offline')) {
    return CONFIG_TEXTS.comum.offlineBloqueioEscrita;
  }
  if (
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('invalid claim') ||
    lower.includes('session from session_id') ||
    lower.includes('sessão expirada') ||
    lower.includes('refresh token') ||
    lower.includes('invalid refresh')
  ) {
    return 'Sua sessão expirou por segurança. Por favor, desconecte e entre novamente com seu e-mail e senha.';
  }
  if (lower.includes('muitas tentativas') || lower.includes('limite de tentativas')) {
    return msg.replace(/^.*ERROR:\s*/i, '').trim();
  }
  if (lower.includes('invalid totp') || lower.includes('verification failed') || lower.includes('code has expired')) {
    return 'Código de 6 dígitos inválido ou expirado. Verifique o horário do seu aparelho e tente novamente.';
  }
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'A nova senha deve ser diferente da senha atual.';
  }
  if (lower.includes('weak_password') || lower.includes('pwned') || lower.includes('leaked')) {
    return 'Esta senha já apareceu em vazamentos públicos na internet. Escolha uma senha inédita e mais forte.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('senha')) {
    return CONFIG_TEXTS.reautenticar.erroSenhaIncorreta;
  }
  if (lower.includes('permission denied') || lower.includes('42501') || lower.includes('não é permitido')) {
    return msg.replace(/^.*ERROR:\s*/i, '').trim() || 'Você não tem permissão para realizar esta alteração.';
  }
  if (
    lower.includes('telefone') ||
    lower.includes('nome de exibição') ||
    lower.includes('marcações') ||
    lower.includes('já existe uma solicitação') ||
    lower.includes('motivo') ||
    lower.includes('tema inválido') ||
    lower.includes('idioma inválido')
  ) {
    return msg;
  }
  return CONFIG_TEXTS.comum.erroGenericoServidor;
}

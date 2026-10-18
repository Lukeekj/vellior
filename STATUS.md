# VELLIOR — estado verificado

## Implementado e verificado

- Site público VELLIOR e fluxo de conta publicados em `https://vellior.vercel.app/`.
- Supabase Auth conectado; login Google e login tradicional já foram verificados em sessão.
- Migração inicial aplicada no Supabase, com tabelas, restrições, índices e RLS.
- Papel administrativo provisionado diretamente no Supabase para a conta Google autorizada pelo proprietário; cadastro público não pode atribuir papel.
- Painel `admin.html` publicado e verificado com a sessão autorizada: dashboard sem vendas fictícias, consulta de pedidos/estoque, catálogo, formulário de criar/editar produto e avisos de estado das integrações.
- Controle de catálogo via RLS; pedidos e pagamentos são somente leitura no painel. O navegador não recebe service-role.
- Migração de baseline versionada em `supabase/migrations/202610140001_vellior_baseline.sql`.

## Implantado, mas ainda não validado de ponta a ponta

- Painel ganhou exclusão segura: produto ligado a pedido deve ser despublicado para preservar o histórico; produto sem pedido pode ser apagado. A ação ainda não foi exercitada com uma sessão de administrador.
- Edge Functions `newsletter`, `resend-admin` e `mercadopago-admin` estão ativas; tabelas de newsletter e limites de cadastro estão com RLS.
- Fluxo de newsletter no site/admin: boas-vindas, cancelamento, rascunhos com imagem e disparo explícito para inscritos ativos. Nenhum e-mail/campanha foi enviado como teste nesta revisão.
- Painel de credenciais/teste Mercado Pago configurado para guardar tokens privados no Vault; nenhuma credencial foi gravada e nenhuma cobrança foi criada.

## Implementado, mas aguardando credenciais/configuração

- E-mails dependem de chave Resend válida e endereço remetente de domínio verificado, que devem ser configurados em Administração > Configurações.
- Credenciais Mercado Pago precisam ser coladas no painel pelo administrador (a chave anteriormente compartilhada deve ser revogada/rotacionada). O teste disponível só consulta a conta e não cria cobrança.
- Google OAuth funciona com as credenciais já configuradas. Apple Sign In foi deixado de fora por decisão do proprietário.

## Ainda não implementado

- Checkout server-side, cobrança real Mercado Pago, webhook assinado, criação segura de pedidos, eventos automáticos de pagamento e e-mail de confirmação pós-pagamento.
- Reserva/baixa atômica de estoque, cupons, cálculo de frete, pagamentos, reembolsos e atualização logística.
- Gestão ampliada de clientes/conteúdo e edição de status de pedidos.
- Testes automatizados de segurança, concorrência e ponta a ponta em sandbox.

## Resultado dos testes desta revisão

- SQL de baseline: execução concluída sem erro no projeto Supabase.
- Provisionamento da conta: retorno confirmou uma linha com role `admin`.
- Navegação produção: `conta.html` mostrou o link administrativo para a sessão autorizada.
- Painel produção: autenticação e consulta do dashboard carregaram; pedidos = 0 e catálogo vazio conforme o banco.
- Formulário de produto: abriu e apresentou campos; não foi criado produto de teste para evitar dados artificiais na loja real.
- Migrações newsletter/Vault aplicadas sem erro; RLS ligado nas novas tabelas.
- Edge Functions `newsletter` (JWT desligado somente para endpoint público; ações admin validam JWT e papel), `resend-admin` e `mercadopago-admin` implantadas.
- Scripts inline de `index.html` e `admin.html` passaram pela validação de sintaxe do parser JavaScript; Vercel criou o deploy de produção como `READY` para o commit `72c9c49435fa742cf53e68694c334b40f5d4f8a3`.
- Não testados: envio Resend até destinatário real, campanhas, credenciais Mercado Pago (não salvas), checkout e cenários E2E. Não realizar cobrança real em teste.

## Próximos passos antes de vender

1. Rotacionar as credenciais que foram compartilhadas no chat e configurá-las no painel; verificar domínio remetente no Resend.
2. Implementar e testar Checkout Pro server-side, reserva transacional de estoque, webhook assinado e e-mail pós-pagamento.
3. Configurar notificações HTTPS do Mercado Pago; só então habilitar cobranças.
4. Executar testes de isolamento/RLS com conta cliente e testes concorrentes antes de aceitar pedidos pagos.



## Próxima alteração em revisão — opções, carrossel e admin

- Preparado em `codex/product-options-carousel-admin`: opções configuráveis por produto e seleção preservada na sacola/checkout; requer a migração SQL indicada em `PRODUCT_OPTIONS_AND_CAROUSEL.md`.
- Campo de frete no produto mostra indisponibilidade explicitamente; não calcula preço nem prazo.
- Carrossel configurável pelo admin e áreas separadas para Vitrine, Resend e Mercado Pago.
- Aguardando aplicação da migração no Supabase e teste visual/funcional com a conta administrativa. Não marcar a cotação de frete como ativa.

# Opções de produto e carrossel da VELLIOR

## O que esta alteração prepara

- Cada produto pode ter até oito grupos de opções, como COR, TAMANHO ou MODELO; cada grupo aceita até 30 valores.
- O cliente escolhe uma opção no detalhe do produto. A seleção fica registrada na sacola, permanece distinguível quando o mesmo produto é adicionado com escolhas diferentes e é mostrada no checkout.
- O campo de frete aparece no detalhe, mas informa claramente que a cotação está temporariamente indisponível.
- A página inicial aceita até oito banners configurados no admin, com imagem, etiqueta, título, texto e CTA. O carrossel avança em intervalo lento, tem controles manuais, pausa ao foco/hover e respeita `prefers-reduced-motion`.
- O admin separa Vitrine, Resend e Mercado Pago em áreas próprias.

## Ativar opções no Supabase

A migração `supabase/migrations/20261018064810_product_options.sql` já foi aplicada no projeto VELLIOR. A coluna `options` foi confirmada como JSONB não nulo com padrão `[]`; produtos existentes recebem uma lista vazia. A coluna é JSONB e já está protegida pelas políticas de linha da tabela `products`. Produtos existentes recebem uma lista vazia.

No admin, preencha uma opção por linha:

```text
COR: CRISTAL, NIQUEL, ROSA
TAMANHO: 16, 17, 18
```

Deixe o campo vazio quando o produto não tiver escolha. A quantidade continua sendo o estoque total do produto, compartilhada por todas as opções. Não há estoque individual por cor/modelo nesta versão; por isso a página exibe esse aviso.

## Carrossel e armazenamento

O admin envia imagens JPEG, PNG ou WebP (até 5 MB) para o bucket público `product-images` e salva os dados públicos em `store_settings` com a chave `home_carousel`. O administrador precisa de permissão de escrita nesse bucket e na tabela de configurações. O botão Salvar publica a ordem/textos; imagens já enviadas que forem removidas da lista podem permanecer no bucket até limpeza manual.

## Resend e Mercado Pago

Os formulários usam as Edge Functions existentes e guardam credenciais privadas no Vault; não colocam chaves no navegador ou na tabela pública. O remetente Resend precisa estar verificado no provedor. O Mercado Pago mantém seus controles e avisos atuais.

## Limitações e validação

- A migração foi aplicada no Supabase; a validação da interface no preview com uma sessão administrativa ainda está pendente.
- Opções são rótulos e valores de escolha; esta alteração não cria estoque ou preço distintos por variante.
- A cotação de frete é apenas uma área visual informativa e não consulta Correios/transportadora.
- O carrossel usa imagens públicas do bucket e não envia automaticamente newsletters.
- Os arquivos JavaScript foram verificados pelo parser do Node. O teste E2E com sessão admin, upload real, aplicação da migração e checagem visual em dispositivos ainda precisa ser feito no preview/produção antes do merge.

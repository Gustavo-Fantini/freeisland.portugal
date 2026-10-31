# Free Island Portugal

Landing independente de Portugal, baseada na versão brasileira
`Gustavo-Fantini/present@2536cf92da1f86ade6264760d59e90a435cb47e7`.
Mantém o visual, os dez guias públicos, autoria, política editorial, contacto,
privacidade e termos. Não inclui a loja Amazon.com.br nem convites ou métricas
brasileiras. Os exemplos editoriais usam euros e o contexto português.

## Publicar no Render

Este repositório contém um **Static Site**, sem dependências de instalação.
Usar a branch `main`, comando `node build.mjs` e diretório publicado `dist`.
O `render.yaml` já declara os rewrites `/r/*` e `/go/*` para `/r/index.html`.
Não configurar um rewrite geral para a homepage: páginas inexistentes devem
continuar a devolver 404 e o manifest deve ser JSON real.

O domínio previsto é `https://freeisland-portugal.onrender.com`.
Se o Render atribuir outro domínio, definir `FI_BASE_URL` com a origem HTTPS
real antes do build. O build atualiza canonical, Open Graph, sitemap e manifest.

É possível publicar antes de criar a operação. Nesse estado, os guias e todas
as páginas editoriais funcionam; os convites e as publicações mostram que a
comunidade está em preparação. Não são consultadas operações de outro país,
não são inventados produtos ou membros e não são recolhidas métricas.

## Ligar à operação portuguesa

Depois de criar a operação no Hunter, guardar a configuração **Landing e
Supabase** com este domínio e a conexão Supabase desejada. No Render definir:

| Variável pública | Valor |
| --- | --- |
| `FI_OPERATION_ID` | UUID real da operação criada no Hunter |
| `FI_OPERATION_SLUG` | Slug exato guardado no Hunter; o valor inicial é `free-island-portugal` |
| `FI_COUNTRY` | `PT` |
| `FI_API_URL` | `https://hunter.3-15-128-116.sslip.io` |
| `FI_BASE_URL` | Origem HTTPS real desta landing |

Repetir o deploy após guardar as variáveis. O ficheiro público
`/.well-known/freeisland.json` passa a conter a identidade real. No Hunter,
validar o domínio, sincronizar a configuração e concluir a validação/ativação
da operação. País `PT`, locale `pt-PT`, moeda `EUR` e timezone `Europe/Lisbon`
são verificados antes de mostrar dados. Um UUID ou domínio divergente bloqueia
as integrações, mantendo os guias disponíveis.

Não usar UUIDs de testes, nem o ID das operações brasileiras. Este repositório
não cria a operação automaticamente. A tag e os grupos são vinculados no
Hunter; não são determinados por nomes parecidos ou por fallbacks globais.

## Dados e grupos

O navegador usa somente a API pública:

```text
GET  /api/public/operations/{slug}/manifest
GET  /api/public/operations/{slug}/activity
GET  /api/public/operations/{slug}/routing?fresh=true
GET  /api/public/operations/{slug}/links/{link}
POST /api/public/operations/{slug}/events
```

A API consulta a conexão Supabase selecionada na operação e aplica o UUID em
produtos, links e métricas. A migração `international-v1` já foi aplicada no
projeto da automação; não é necessário reaplicá-la nem copiar o SQL brasileiro.
**Nunca colocar service-role keys, tokens internos, tokens de bots ou cookies
no Render deste site, no JavaScript ou neste repositório.** As cinco variáveis
acima são públicas e não incluem credenciais.

Os convites vêm dos destinos explicitamente vinculados à operação. A menor
prioridade numérica é consultada primeiro. Se o grupo 1 ficar com vaga, volta
a recebê-la. A página consulta ao carregar e antes de abrir o convite, renova
os dados enquanto está visível e ao regressar ao separador. Uma contagem
desconhecida ou desatualizada num grupo anterior não autoriza saltar para um
posterior. A soma apresentada corresponde a participantes nos grupos de
WhatsApp e não a pessoas únicas entre plataformas. Contagens desatualizadas
não são mostradas. Telegram e WhatsApp têm o mesmo destaque visual.

O feed mostra apenas publicações devolvidas para esta operação e moeda EUR.
Não reproduz preços ou stock da Amazon. Os links comerciais são identificados;
os links curtos são resolvidos pela API e limitados ao domínio da landing.
Não há catálogo ou link permanente para uma loja Amazon portuguesa.

## Métricas e consentimento

Os contadores agregados e os detalhes consentidos usam os RPCs da operação no
backend. Aceitar detalhes depois do acesso inicial não soma uma segunda visita.
O Pixel Meta usa somente o ID configurado no Hunter para esta operação e exige
consentimento publicitário separado. Global Privacy Control impede esse Pixel.
Não há Pixel brasileiro ou cliente Supabase legado embutido. Cliques em grupos
medem saída para o convite, não adesão confirmada.

## Amazon.es

A tag fornecida pelo administrador é `freeislandpor-21`. Foi cadastrada na
Central de Contas como **Amazon.es Portugal - candidatura em avaliacao**, sem
vínculo automático a operações. A comunicação recebida prevê revisão após as
três vendas; a aprovação final não foi marcada como confirmada. Quando essa
aprovação ocorrer, atualizar e testar a conta no Hunter antes de ativar o
programa. A tag não dá origem a uma loja pública Amazon nem comprova entrega
de qualquer produto em Portugal.

## Desenvolvimento e validação

```sh
npm test
npm run build
npm run audit
```

Os testes de contrato verificam identidade, isolamento, grupos cheios, retorno
de prioridade, contagens desconhecidas e URLs de produtos. A aceitação visual
usa `scripts/browser_acceptance.py` com Playwright, sem pedidos reais a grupos,
lojas ou trackers. Usa fixtures apenas em memória e não cria operações reais.

O site brasileiro e a sua base de métricas continuam independentes.

Referências de configuração: [Render Static Sites](https://render.com/docs/static-sites)
e [especificação do Blueprint](https://render.com/docs/blueprint-spec).
O estado de candidatura Amazon segue a comunicação recebida pelo administrador;
a [revisão do programa](https://afiliados.amazon.es/help/node/topic/G8TW5AE9XL2VX9VM)
é distinta da atribuição inicial da tag.

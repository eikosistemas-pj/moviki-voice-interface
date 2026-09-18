# O CRM DOS AGENTES — ponto de partida

**Para que serve este arquivo:** o Paulo pediu o CRM no fim de uma conversa que já
estava pesada, e pediu de propósito que a construção começasse **num chat novo**.
Chat novo começa sem memória. Este arquivo é a memória.

**Quem abrir o chat do CRM lê este arquivo primeiro, e depois o `ESTADO-DO-ZEUS.md`
deste mesmo repositório** — que conta o que o Zeus é hoje, e cujas decisões valem
aqui também.

Mesma regra dos outros repositórios: *o repositório é a única fonte da verdade.*

---

## 1. O que o Paulo pediu, nas palavras dele

> *"Eu estou precisando de um CRM para fazer a gestão de todos os agentes. Para
> colocar Zeus para tomar conta de todos eles dentro."*
>
> *"São as duas coisas. Só que o botão de acesso a elas vai estar somente no
> painel do dono. No painel do dono vai ter uma aba CRM, que é onde eu vou abrir
> e você vai construir tudo dentro."*

Três decisões já tomadas por ele, e que não se discutem mais:

| Decisão | O que significa |
|---|---|
| **São as duas coisas** | Posto de comando dos agentes **e** funil de lojistas |
| **A porta é o painel do dono** | Uma aba "CRM" lá dentro. Não é site novo, não é endereço novo |
| **Zeus toma conta de todos** | Ele supervisiona os outros agentes, não é só mais um da lista |

---

## 2. Onde isso mora — e por que não é aqui

**O CRM se constrói no `moviki-app`**, no painel do dono (a área `eikoadm`).
Não neste repositório.

O motivo não é organização, é chave: **o painel do dono já alcança o Firestore
com a credencial do Paulo.** Faturamento, assinante e lojista moram lá. Construir
o funil em qualquer outro lugar exigiria levar essa credencial para outro lugar —
e a regra que já está escrita no `ESTADO-DO-ZEUS.md` (seção 5.5) diz que isso não
acontece.

> **A VPS do Zeus nunca ganha a chave do Firestore.** Ela alcança o dinheiro de
> todo lojista. Essa decisão é anterior ao CRM e continua valendo depois dele.

---

## 3. As duas metades, e por que elas se juntam bem

### 3.1 Posto de comando dos agentes

Uma tela com todos os agentes lado a lado. O que ela precisa mostrar:

| Coluna | Por que ela existe |
|---|---|
| **Está de pé?** | Agente parado sem ninguém notar é o defeito mais caro que existe |
| **O que está fazendo agora** | Com o relógio: "há 7 minutos". Sem isso ele volta a inventar |
| **Gastou quanto hoje** | Cada agente é conta paga. Sem número, o custo só aparece na fatura |
| **O que deu errado** | A última falha, com o motivo. Não um "erro" genérico |
| **Ligar / desligar** | Poder desligar um agente sem SSH é metade do controle |

Os agentes de hoje: **Zeus** (comando), **atendente do WhatsApp** (`moviki-ai`),
**assistente de redes** (`moviki-assistente-social`), **robô do dinheiro**
(`moviki-robo`).

> **Cuidado que vai aparecer:** a tentação de cada agente publicar o estado do
> jeito dele. Não. **Um formato só, igual para todos** — senão cada agente novo
> vira um pedaço de tela novo, e em três agentes a tela vira colcha de retalho.
> Definir esse formato é a primeira tarefa técnica do projeto.

### 3.2 Funil de lojistas

Quem chegou, quem o atendente respondeu, quem respondeu de volta, quem virou
assinante, **e quem parou de responder** — essa última é a coluna que vira ação.

Isso sai do Firestore, que o painel do dono já lê.

### 3.3 O que junta as duas

É aqui que o CRM deixa de ser dois relatórios e vira uma coisa só:

**O agente que trabalhou aparece ao lado do resultado que ele deu.** "O atendente
falou com 24 lojistas esta semana; 3 viraram assinante; 8 pararam de responder."
Sem isso, o Paulo tem uma tela que diz que os agentes estão vivos e outra que diz
que o funil está travado, e nenhuma das duas diz se uma coisa causou a outra.

---

## 4. Como o painel vai enxergar o Zeus

O painel roda no navegador do Paulo. O Zeus roda na VPS, em
`https://zeus.moviki.com.br` (o cadeado subiu em 18/09/2026).

**Caminho recomendado:** o Zeus ganha uma rota de leitura — `GET /api/zeus/painel`
— que devolve o estado dele no formato comum da seção 3.1, **atrás do crachá que
já existe** (`servidor/porta.js`). A aba CRM chama essa rota direto.

Três coisas a acertar, e nenhuma é opcional:

1. **CORS.** O Zeus hoje só atende a própria tela. Vai precisar liberar a origem
   do painel do dono — **só ela**, nunca `*`.
2. **O crachá.** O Paulo já digita a senha do Zeus uma vez para usar a tela dele;
   a aba CRM vai precisar do mesmo crachá. Vale decidir se ele digita de novo ou
   se o painel guarda.
3. **A rota é de LEITURA.** Ligar e desligar agente é escrita, e escrita merece
   rota própria, com registro de quem mandou e por quê — ver 6.1, que já está
   decidido.

**Caminho alternativo, se o CORS virar dor:** o `moviki-robo` (que já tem a chave
do Firestore) busca o estado do Zeus e grava um resumo no Firestore; o painel lê
de lá, como já lê todo o resto. Mais peças, porém zero navegador falando com a
VPS. É o mesmo desenho já decidido na seção 5.5 do `ESTADO-DO-ZEUS.md` para os
números do negócio.

---

## 5. Por onde começar, na ordem

1. ✅ **Definir o formato comum de estado do agente.** Feito:
   [`FORMATO-DO-AGENTE.md`](./FORMATO-DO-AGENTE.md), neste repositório. Tudo
   depende dele, e por isso ele veio primeiro.
2. 🔜 **A aba CRM vazia no painel do dono**, com a navegação funcionando. Entrega
   pequena, mas é ela que prova que a porta está no lugar certo. **É o próximo
   passo, e ele é no `moviki-app`.**
3. ✅ **A rota `/api/zeus/painel`** no Zeus, devolvendo o formato do passo 1.
   Feita, atrás do crachá e com a origem liberada nominalmente. Junto veio o
   custo em reais (6.2), que não existia: o Zeus contava chamadas, não dinheiro.
4. **A tela dos agentes**, começando só com o Zeus. Um agente de verdade na tela
   vale mais que quatro planejados.
5. **Os outros três agentes**, um por vez, cada um publicando o mesmo formato.
6. **O funil de lojistas**, lendo o Firestore.
7. **Juntar as duas metades** (seção 3.3).
8. **Por último, o poder de desligar** (6.1). Deixado para o fim de propósito:
   é o único passo que age sobre o mundo em vez de só mostrar, e vale construir
   depois de a tela já estar mostrando a verdade — desligar com base em número
   errado é pior que não desligar.

> **Por que o Zeus primeiro:** ele é o único agente cujo estado já existe pronto e
> cujo código está à mão. Os outros vão exigir mexer em repositório que hoje não
> publica nada disso.

---

## 6. As três decisões do Paulo — 18/09/2026

Ele respondeu as três. Estão fechadas; não rediscutir no código.

### 6.1 🔴 O Zeus PODE desligar qualquer agente. Desligar o Zeus, só o dono.

> *"O Zeus vai ter poder de desligar qualquer agente que não estiver em
> conformidade ao plano de ação maior, que é o meu, do dono. Poder de desligar o
> Zeus, só eu, só o dono que tem."*

É o primeiro poder de **ação** que o Zeus ganha sobre o mundo — até aqui ele só
propunha (Pull Request) e falava. Isso muda o peso de um erro dele, e por isso
três coisas vêm junto, não depois:

| O que | Por quê |
|---|---|
| **Desligar sempre fica registrado** — qual agente, quando, e o motivo com todas as letras | Agente desligado sem rastro vira "por que o atendente parou ontem?" sem resposta |
| **Ele te chama NA HORA quando desliga** | Não entra no descanso de dez minutos nem na regra de "cada assunto fala uma vez". Desligar o atendente do WhatsApp deixa lojista sem resposta — isso não espera a próxima ronda |
| **Religar é SEU** | O Zeus desliga e te chama; quem liga de volta é você, pelo painel |

> **Sobre religar ser seu, e isto é recomendação minha, não decisão sua:** se ele
> pudesse ligar e desligar livremente, um agente em desacordo entraria num
> vai-e-vem — desliga, religa, desliga — e cada volta dessas é serviço caindo e
> voltando para o lojista. Com o religar na sua mão, o pior caso é um agente
> parado esperando você, que é barulhento mas não oscila. **Se você preferir que
> ele religue também, é só dizer e eu mudo.**

**A assimetria é a trava:** ele desliga os outros, e ninguém — nem ele — desliga o
Zeus a não ser o dono. Isso já estava no `ESTADO-DO-ZEUS.md` como "ele não mexe
em si mesmo"; aqui vira também botão que não existe na tela.

**O que é "não estar em conformidade" continua sendo julgamento dele**, e é aí que
mora o risco. A primeira versão deve pedir confirmação antes de desligar, e a
autonomia total vem depois que você vir o julgamento dele funcionando — na linha
do que você mesmo disse: *"aos poucos, quando a gente for vendo que ele está mais
inteligente, a gente vai soltando as responsabilidades."*

### 6.2 O custo aparece em REAIS

Não em "quanto do teto", não em tokens. **Reais.**

Duas consequências práticas: a conversão precisa de uma tabela de preço por
modelo que envelhece (guardar em um lugar só, fácil de atualizar), e o número
aparece numa tela que abre no celular — então é o gasto **de hoje** em destaque,
com o mês em segundo plano.

### 6.3 Quem abre o painel do dono: só o dono

Isso simplifica o desenho inteiro. Sem níveis de acesso, sem esconder dado de
cliente de ninguém, sem "o que este usuário pode ver".

**E é uma decisão a reexaminar se um dia entrar mais alguém** — porque o funil
mostra dado de lojista, e o LGPD não pergunta se a tela foi feita para uma pessoa
só.

## 7. O que já está decidido e vale aqui também

Do `ESTADO-DO-ZEUS.md`, sem precisar rediscutir:

- **A VPS nunca ganha a chave do Firestore** (5.5)
- **O Zeus nunca aprova nem junta Pull Request** — vale para qualquer botão que o
  CRM venha a ter. Repare que desligar agente (6.1) **não** abre exceção aqui:
  são poderes diferentes, e juntar na main continua sendo só do Paulo
- **O Zeus não mexe em si mesmo** nem no `moviki-robo`
- **Nunca clonar a voz do Paulo**
- **Ele não inventa.** A regra mais dura do prompt dele: não dizer que está
  trabalhando em algo que não está na lista. Num painel que mostra estado de
  agente, essa regra vira desenho: **campo sem dado aparece como "não sei", nunca
  como zero.** Zero e "não sei" são coisas diferentes, e confundir as duas num
  painel de controle é como o Zeus dizer que está trabalhando quando não está.

---

## 8. Como falar com o Paulo

Está no `CLAUDE.md` dos outros repositórios e no `ESTADO-DO-ZEUS.md`. O resumo:

- Ele **não é programador**. Português do Brasil, direto, tópicos curtos.
- **Nunca mostrar código na conversa.** A entrega é o Pull Request.
- Ele é direto e não tem paciência com rodeio.
- **Confira que o Pull Request entrou INTEIRO antes de avisar.** Aconteceu quatro
  vezes de ele aprovar enquanto ainda havia commit sendo empurrado, e metade do
  trabalho ficar de fora. Empurre tudo, confira, só então avise.

---

## 9. O que já está de pé — 18/09/2026, fim do dia

Este repositório entregou a parte dele. **O que falta agora é no `moviki-app`.**

| O quê | Onde | Estado |
|---|---|---|
| O formato comum do agente | [`FORMATO-DO-AGENTE.md`](./FORMATO-DO-AGENTE.md) | ✅ pronto |
| O retrato do Zeus nesse formato | `servidor/painel.js` | ✅ pronto |
| A rota que o painel consulta | `GET /api/zeus/painel` | ✅ pronta |
| O custo em reais (decisão 6.2) | `servidor/precos.js` + `servidor/gasto.js` | ✅ pronto |
| A aba CRM no painel do dono | `moviki-app` | 🔜 é o próximo |

### O que o Paulo precisa fazer para a janela abrir

Uma linha no `zeus.env` da VPS, com o endereço do painel do dono:

```
ZEUS_PAINEL_ORIGEM=https://painel.moviki.com.br
```

Sem ela, **nada quebra**: a tela do próprio Zeus continua igual, e a aba CRM é
que não consegue perguntar. Com `*` no lugar do endereço, o Zeus recusa de
propósito — `*` abriria a porta para qualquer página da internet perguntar em
nome dele.

E, se o dólar estiver muito diferente de R$ 5,60, `ZEUS_DOLAR=6.10` (ou o que
for) na mesma linha de raciocínio. É o único número da conta que muda sozinho.

### Três coisas que mudaram de estado, e vale saber

1. **O custo saiu do escuro.** O Zeus contava *chamadas* (o teto do dia) e não
   dinheiro. Uma conversa de duas frases e um trabalho de código contavam 1
   cada, e custam vinte vezes um do outro. Agora cada chamada paga —
   conversa, análise, trabalho, busca e ronda — vira centavo anotado.
2. **A tabela de preço mora num arquivo só** (`servidor/precos.js`), porque ela
   envelhece. Quando a Anthropic mudar o preço, mexe lá e acabou.
3. **Modelo desconhecido não ganha preço inventado.** Ele entra na conta como
   "sem preço" e o total aparece como incompleto. É a regra da seção 7 virando
   número: *zero e "não sei" são coisas diferentes.*

### O cuidado para quem pegar o passo 2

A aba CRM vai ser a primeira tela a mostrar estado de agente. **Ela mostra
`null` como "não sei", com essas palavras** — nunca como traço, zero ou espaço
em branco. Está escrito no `FORMATO-DO-AGENTE.md`, seção 1, e é a regra que não
pode ser perdida no caminho.

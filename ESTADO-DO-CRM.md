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
3. **A rota é de LEITURA.** Ligar e desligar agente é escrita, e escrita a partir
   do navegador merece decisão à parte — está na seção 6.

**Caminho alternativo, se o CORS virar dor:** o `moviki-robo` (que já tem a chave
do Firestore) busca o estado do Zeus e grava um resumo no Firestore; o painel lê
de lá, como já lê todo o resto. Mais peças, porém zero navegador falando com a
VPS. É o mesmo desenho já decidido na seção 5.5 do `ESTADO-DO-ZEUS.md` para os
números do negócio.

---

## 5. Por onde começar, na ordem

1. **Definir o formato comum de estado do agente.** Um documento curto, com os
   campos da seção 3.1. Tudo depende dele.
2. **A aba CRM vazia no painel do dono**, com a navegação funcionando. Entrega
   pequena, mas é ela que prova que a porta está no lugar certo.
3. **A rota `/api/zeus/painel`** no Zeus, devolvendo o formato do passo 1. O Zeus
   já sabe tudo que ela precisa: `servidor/estado.js` tem turno, tarefas em
   andamento com o relógio, falhas e contagem de chamadas do dia.
4. **A tela dos agentes**, começando só com o Zeus. Um agente de verdade na tela
   vale mais que quatro planejados.
5. **Os outros três agentes**, um por vez, cada um publicando o mesmo formato.
6. **O funil de lojistas**, lendo o Firestore.
7. **Juntar as duas metades** (seção 3.3).

> **Por que o Zeus primeiro:** ele é o único agente cujo estado já existe pronto e
> cujo código está à mão. Os outros vão exigir mexer em repositório que hoje não
> publica nada disso.

---

## 6. As perguntas que ainda são do Paulo

Não decidir isto no código. É dele:

1. **Desligar agente pela tela — pode?** Desligar o atendente do WhatsApp deixa
   lojista sem resposta. Se pode, tem que ter confirmação e ficar registrado quem
   desligou e quando.
2. **O custo aparece em reais ou em "quanto do teto"?** Reais é mais claro e
   expõe a conta numa tela que abre no celular.
3. **Quem mais abre o painel do dono?** Se for só ele, o desenho é um. Se um dia
   for mais alguém, o funil mostra dado de cliente para essa pessoa.

---

## 7. O que já está decidido e vale aqui também

Do `ESTADO-DO-ZEUS.md`, sem precisar rediscutir:

- **A VPS nunca ganha a chave do Firestore** (5.5)
- **O Zeus nunca aprova nem junta Pull Request** — vale para qualquer botão que o
  CRM venha a ter
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

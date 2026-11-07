# GarapaVR

Garapeiro: fliperama em VR para o Meta Quest 3 no navegador (WebXR), também joga no PC com o mouse.
Releitura do estilo dos balcões de bar dos fliperamas dos anos 80, numa barraca de garapa: o
jogador fica parado atrás de 3 ou 4 balcões em leque. Com a mão embaixo da moenda e o gatilho
apertado, o copo enche; ainda segurando, empurra a mão para a frente sobre o balcão e solta: o copo
desliza até o freguês (a força do empurrão define até onde vai). O freguês é empurrado para trás,
bebe e devolve o copo vazio, que tem que ser pego com a mão. 12 fases em 3 mundos (Feira do Bairro,
Festa Junina, Luau na Praia), a 4ª de cada um é chefe. Estrelas pelas vidas perdidas, modo
Fliperama (as 12 seguidas) com recorde de 3 letras. Tudo em português. Nomes, personagens e visual
próprios.

## Como rodar / jogar

**No Quest:** abrir no navegador do óculos **https://parappathe.github.io/GarapaVR/** e apertar
"Entrar em VR". Atualizar o site: commitar e rodar `python publicar.py GarapaVR` em `C:\claude code`.

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8871` (o painel de visualização
usa `.claude/launch.json`). `python serve.py --https` serve para abrir no Quest pela rede de casa
(porta 8443).

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Encher | Mão embaixo da moenda (anel colorido), gatilho ou grip apertado por 0,55 s | Clique e segure no anel |
| Servir | Ainda apertando, empurrar a mão para a frente sobre o balcão e soltar | Ainda segurando, arrastar o mouse para cima e soltar |
| Pegar copo vazio, moeda, busca-pé | Encostar a mão no objeto na ponta do balcão (primeiro metro) | Passar o mouse na ponta do balcão |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar com o controle e gatilho | Clique |
| FPS | Menu → FPS | Tecla F |

As duas mãos fazem tudo (uma enche enquanto a outra pega). O controle vibra ao encher, ao servir,
ao pegar e ao perder vida. Na pausa do VR, "Recentralizar" põe a cabeça no centro da barraca.

### Regras

- **Balcões** em leque (3 a 24° ou 4 a 22° um do outro), ponta a 60 cm do jogador, 3,4 a 4,2 m de
  comprimento, tampo a 1 m de altura. Porta no fim de cada um, por onde o freguês entra e sai.
- **Copo:** velocidade = empurrão da mão na direção do balcão x 1,6 (máx. 4,5 m/s), atrito
  1 m/s². Soltar fora do balcão derrama (não tira vida). Copo que passa do fim cai e **tira vida**.
  Copo parado no balcão fica lá até um freguês chegar nele.
- **Freguês** anda e para; pega o copo que chega nele (quem está bebendo deixa passar). É empurrado
  para trás (normal 1,5 m, sedento 0,85 m); passou da porta, vai embora atendido. Senão bebe e
  devolve o copo vazio, que vem deslizando: **pegar** com a mão; se cair, **tira vida**. Freguês que
  chega na ponta do balcão **tira vida**. Tipos: normal, sedento (volta pouco), apressado (anda 55%
  mais rápido).
- **Perdeu vida:** todos recuam até 70% do balcão, os copos somem e o jogo pausa 1,6 s. 3 vidas.
- **Festa Junina:** gorjeta (moeda que desliza até você, 500 pontos se pegar) e **busca-pé** (vem
  pelo balcão; apaga com um copo ou espanta com a mão; se chegar na ponta, estoura e tira vida).
- **Luau:** **gaivota** pousa num balcão por 5 s e rouba o copo cheio que passar por ela (não tira vida).
- **Chefes:** fase 4 **Excursão** (22 fregueses em sequência rápida); fase 8 **Boi-Bumbá** (no balcão 2,
  8 copos, cada copo empurra só 45 cm e ele devolve o vazio na hora); fase 12 **Seu Bocão** (12 copos,
  devolve dois vazios de cada vez e troca de balcão a cada 7 s com aviso de 1,3 s; os copos que iam
  para ele no balcão antigo ele leva junto).
- **Vence** quando todos os fregueses da fase foram embora. **Estrelas:** 3 sem perder vida, 2
  perdendo uma, 1 perdendo mais. Pontos: servir 50, freguês que vai embora 100, copo vazio pego 100,
  gorjeta 500, busca-pé 250/150, chefe 300 por copo e 3000 no fim, 1000 por vida que sobrou.
- **Fliperama:** as 12 seguidas com as vidas que sobraram (+1 a cada chefe), pontos somados,
  recorde de 3 letras (8 melhores). Progresso no navegador (localStorage `garapavr.v1`).

Fases (em `js/levels.js`): Feira: 1 Primeiro freguês, 2 Fila de domingo, 3 Hora do almoço,
4 Excursão. Junina: 5 Quadrilha, 6 Busca-pé, 7 Arraiá lotado, 8 Boi-Bumbá. Praia: 9 Gaivotas,
10 Maré cheia, 11 Luau, 12 Seu Bocão.

## Como testar

- `node tests/run.js` (ou `npm test`): fases, geometria do leque (ponto volta para o balcão certo,
  pontas no alcance), encher e deslizar (encher, derramar, copo parado, força x distância, copo que
  cai no fim), fregueses (pegar, empurrar, beber, devolver, vazio que cai, pegar com a mão, ir
  embora, chegar na ponta, fila, copo parado, quem bebe deixa passar), gorjeta, busca-pé, gaivota,
  chefes (Boi, Seu Bocão trocando de balcão e devolvendo dois copos, Excursão), vencer e perder, e o
  **robô**: duas mãos com limites humanos (2,4 m/s, empurrão até 2,6 m/s, decisão a cada 0,3 s, erro
  de força de 8%) joga as 12 fases com 5 sementes; tem que vencer todas e ter 2 estrelas em quase
  todas. Imprime as vidas perdidas por fase. Termina com "Tudo certo". Não toca som.
- No navegador (console): `dev.loadLevel(8)`, `dev.autoplay = true`, `dev.advance(20)`, `dev.state()`,
  `dev.arcade()`, `dev.snapshot()`, `dev.resetSave()`. `window.garapa` tem `game`, `save`, `sfx`, `robot`.
- **Só dá para testar no óculos:** se o gesto de empurrar o copo é natural e a força está boa (fator
  1,6), a altura da moenda e do balcão, pegar os copos com a mão, rastreamento de mãos (pinça),
  vibração, conforto e FPS.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", HUD do PC |
| `js/vec.js` | Vetores e aleatório com semente (igual ao TijoloVR). Sem navegador |
| `js/sim.js` | Regras: `Game` (balcões, mãos, encher, deslizar, fregueses, copos, gorjetas, busca-pés, gaivotas, chefes, vidas, pontos), `lanePoint`, `locate`. Sem navegador |
| `js/levels.js` | Os 3 mundos e as 12 fases, estrelas. Sem navegador |
| `js/robot.js` | Robô de duas mãos com limites humanos (testes, `dev.autoplay` e demonstração do menu). Sem navegador |
| `js/main.js` | Render, VR (mãos nos controles, gatilho/grip, vibração, recentralizar), mouse, menus, letreiro, eventos → sons e efeitos, `dev` |
| `js/scene.js` | Cenários (feira, festa junina, praia), barraca, balcões com moenda e porta, fregueses (bonecos por tipo e por mundo, Boi-Bumbá, Seu Bocão), copos, moedas, busca-pés, gaivotas, luvas, partículas, letreiro |
| `js/ui.js` | Painel de menu 3D em canvas e placas de texto |
| `js/audio.js` | Sons sintetizados com áudio 3D e baião por mundo |
| `js/save.js` | Progresso, recordes e opções |
| `tests/run.js` | Testes |
| `serve.py` | Servidor local sem cache (porta 8871, `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 |

Coordenadas: metros; chão em y = 0, jogador em x = 0, z = 0 olhando para -z. Posição num balcão é
`s` (0 = ponta perto do jogador, a 0,6 m do centro); `lanePoint(az, s, y)` dá o ponto 3D.

## Regras e convenções do projeto

- `vec.js`, `sim.js`, `levels.js` e `robot.js` não usam navegador nem Three.js (testes no Node).
- Mexeu em regras, fases ou robô: `node tests/run.js` e conferir as vidas perdidas do robô.
- Eventos do jogo (`game.events`) são a única ponte da lógica para som, vibração e efeitos.
- Física em passos fixos de 1/120 s; no navegador a posição da mão é interpolada dentro dos passos.

## Decisões

- O empurrão é medido como o maior avanço da mão nos últimos 4 passos (no quadro de soltar a mão
  costuma já ter parado).
- No PC a mão fica presa ao primeiro 0,85 m do balcão (o alcance do VR), mas a força vem do arrasto
  do mouse sem limite; o PC pega objetos num raio um pouco maior (26 cm contra 17 cm).
- Gaivota não tira vida (só faz perder o copo); o chefe Seu Bocão leva os copos do balcão antigo ao
  trocar (senão eles cairiam no fim e tirariam vida sem o jogador ter culpa).
- Estrelas por vidas perdidas (mais claro para quem joga do que tempo ou pontos).
- Desempenho de Quest: pixelRatio 1, foveação, partículas num só `Points`, 2 luzes sem sombra.
- Porta do servidor local 8871.

## Pendências / problemas conhecidos

- **Nada foi testado no Quest ainda**: gesto de encher e empurrar, força do empurrão, altura da
  moenda, pegar copos com a mão, rastreamento de mãos, vibração, conforto e FPS no óculos.
- Sons e música só foram checados por não dar erro; ninguém ouviu ainda.
- Dificuldade calibrada pelo robô (que perde vida quase só por mandar copo a mais); pode estar fácil
  ou difícil para gente.

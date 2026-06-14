# ⚔ Root — Sorteio de Facções & Liga SP

Ferramenta web para o jogo de tabuleiro **Root** (Leder Games), criada para a **Liga Root SP**.

🔗 Acesse em: [fsalencar.github.io/root-ligasp](https://fsalencar.github.io/root-ligasp)

---

## 🗂 Funcionalidades

| Aba | O que faz |
|---|---|
| ⚔ Sorteio de Facções | Sorteia facções seguindo as regras oficiais de Alcance da Leder Games |
| 🗺️ Sortear apenas Mapas e/ou Clareiras | Sorteia mapa e naipes das clareiras de forma independente |
| 🏆 Gerar Resultado para a Liga | Gera o texto formatado da partida, pronto para colar no WhatsApp |

---

## ⚔ Como usar — Sorteio de Facções

### 1. Número de jogadores

Selecione de **2 a 6 jogadores** clicando nos botões redondos.

### 2. Nome dos jogadores

Preencha o nome de cada participante. Se deixar em branco, aparece "Jogador 1", "Jogador 2" etc.

### 3. Componentes disponíveis

Marque quais expansões vocês têm na mesa:

| Expansão | Facções incluídas |
|---|---|
| Root — Jogo Base | Marqueses, Dinastia das Rapinas, Aliança da Floresta, Malandro |
| Expansão Ribeirinhos | Compania Ribeirinha, Lagartos Cultistas, Malandro 2 |
| Expansão Submundo | Ducado Subterrâneo, Conspiração Corvídea |
| Expansão Saqueadores | Senhor das Centenas, Guardiões de Ferro |
| Expansão Pátria | Diáspora dos Nenúfares, Conselho do Crepúsculo, Patifes da Floresta |

> **Malandro 2** aparece como sub-opção dentro de Ribeirinhos e só entra no sorteio se o Malandro 1 também estiver disponível.

### 4. Mapas disponíveis

Marque um ou mais mapas. Se marcar mais de um, o mapa também será **sorteado automaticamente**.

Mapas disponíveis: **Outono**, **Inverno**, **Lago**, **Montanha**.

### 5. Opções de sorteio

- **Sortear deck de cartas** — sorteia entre Deck Base e Exilados & Partisans
- **Garantir insurgentes** — aparece com 3 ou mais jogadores; permite forçar ao menos 1, 2 ou 3 facções insurgentes no grupo
- **Sortear naipes das clareiras** — distribui 🦊 Raposa, 🐭 Rato e 🐇 Coelho pelas clareiras do mapa
  - *Manter clareiras de canto:* mantém os cantos com os naipes do mapa oficial; desmarque para redistribuir tudo livremente

### 6. Sortear

Clique em **⚔ Sortear** e o resultado aparece abaixo com:

- **Ordem de preparação** — militantes primeiro, insurgentes depois (regra oficial)
- **Ordem de jogo** — sorteada aleatoriamente
- **Mapa sorteado** — se mais de um foi selecionado
- **Deck sorteado** — se a opção foi ativada
- **Diagrama de clareiras** — naipes coloridos sobre o mapa (se ativado)
- **Resumo** — alcance total e contagem de facções

---

## ⚔ Regra de Alcance

O sorteio segue as regras oficiais de Alcance mínimo por número de jogadores:

| Jogadores | Alcance mínimo |
|---|---|
| 2 | 17 |
| 3 | 18 |
| 4 | 21 |
| 5 | 25 |
| 6 | 28 |

> O sorteio garante ao menos **1 facção militante** no grupo e que a soma de alcance atinja o mínimo obrigatório.

---

## 🗺️ Como usar — Sortear apenas Mapas e/ou Clareiras

Use esta aba quando quiser sortear **somente o mapa e/ou as clareiras**, sem sortear facções.

1. Selecione um ou mais mapas
2. Ative o sorteio de clareiras se desejar
3. Clique em **🗺️ Sortear**
4. Use **↺ Sortear novamente** para rolar de novo sem reconfigurar

---

## 🏆 Como usar — Gerar Resultado para a Liga

### 1. Informações da partida

- **Local** — onde a partida aconteceu
- **Data** — preenchida automaticamente com hoje; clique para alterar
- **Mapa** — selecione o mapa utilizado na partida

### 2. Número de jogadores

Selecione de **3 a 6 jogadores**.

### 3. Jogadores

Para cada jogador preencha:

- **Nome**
- **Facção** *(facções já escolhidas somem para os outros jogadores)*
- Se escolher **Malandro** ou **Malandro 2**, selecione o tipo:
  - Andarilho, Árbitro, Aventureiro, Funileiro, Ladrão, Patife, Ronin, Saqueador ou Vagabundo
  - *(sem repetição entre os dois Malandros)*
- **Pontuação**
- **Iniciante?** *(disponível a partir do Jogador 2)*
- **Vitória por Domínio** ou **Derrota por Domínio** *(mutuamente exclusivos — dispensam pontuação)*

### 4. Gerar resultado

Clique em **📋 Gerar Resultado para a Liga**. O texto segue o formato oficial:

```
Casa do Felipe 24/05 | Mapa Outono
Vinicius Bárbaro (Iniciante) - Lagartos Cultistas Vitória por Domínio
Felipe Alencar - Guardiões de Ferro 28
Erick Oliveira (Iniciante) - Dinastia das Rapinas 24
Alexandre Chazan (Iniciante) - Marqueses 7
```

**Ordenação automática:**

- Vitória por Domínio → topo
- Maior pontuação → ordem decrescente
- Derrota por Domínio → sempre por último

### 5. Compartilhar

- **📋 Copiar** — copia o texto para colar onde quiser
- **📲 WhatsApp** — abre direto o WhatsApp com o texto preenchido

---

## 🎨 Legenda de cores — Clareiras

| Cor | Naipe |
|---|---|
| 🔴 Vermelho | Raposa |
| 🟠 Laranja | Rato |
| 🟡 Amarelo | Coelho |

---

## 🃏 Facções por tipo

| Facção | Tipo | Expansão |
|---|---|---|
| Marqueses | Militante | Base |
| Dinastia das Rapinas | Militante | Base |
| Aliança da Floresta | Insurgente | Base |
| Malandro / Malandro 2 | Insurgente | Base / Ribeirinhos |
| Compania Ribeirinha | Insurgente | Ribeirinhos |
| Lagartos Cultistas | Insurgente | Ribeirinhos |
| Ducado Subterrâneo | Militante | Submundo |
| Conspiração Corvídea | Insurgente | Submundo |
| Senhor das Centenas | Militante | Saqueadores |
| Guardiões de Ferro | Militante | Saqueadores |
| Diáspora dos Nenúfares | Militante | Pátria |
| Conselho do Crepúsculo | Insurgente | Pátria |
| Patifes da Floresta | Insurgente | Pátria |

---

## 🛠 Tecnologia

- HTML + CSS + JavaScript puro *(sem dependências externas)*
- Um único arquivo `index.html` — basta abrir no navegador ou hospedar em qualquer servidor estático

---

## 🔗 Links

- [Liga Root SP](https://taplink.cc/ligarootsp)
- [Manual oficial Root Base — Leder Games](https://cdn.shopify.com/s/files/1/0106/0162/7706/files/Root_Base_Law_Oct_2025.pdf)

---

*Criado por [Felipe Alencar @lipeowna](https://instagram.com/lipeowna) · Liga Root SP*

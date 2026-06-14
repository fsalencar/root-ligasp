# ⚔ Root — Sorteio de Facções & Liga SP

Ferramenta web para o jogo de tabuleiro **Root** (Leder Games), criada para a **Liga Root SP**.

🔗 Acesse em: [fsalencar.github.io/root-ligasp](https://fsalencar.github.io/root-ligasp)

---

## 🗂 Funcionalidades

| Aba | O que faz |
|---|---|
| ⚔ Sorteio de Facções | Sorteia facções seguindo as regras oficiais de Alcance da Leder Games |
| 🏆 Gerar Resultado para Liga | Gera o texto formatado da partida, pronto para colar no WhatsApp |

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

> **Malandro 2** aparece como sub-opção dentro de Ribeirinhos. Marque se quiser permitir dois Malandros na mesma partida.

### 4. Mapas disponíveis

Marque um ou mais mapas. Se marcar mais de um, o mapa também será **sorteado automaticamente**.

Mapas disponíveis: **Outono**, **Inverno**, **Lago**, **Montanha**.

### 5. Sorteio de clareiras *(opcional)*

Ative o toggle para sortear os naipes de cada clareira do mapa sorteado.

- 🦊 **Raposa** (vermelho)
- 🐭 **Rato** (laranja)
- 🐇 **Coelho** (amarelo)

> **Manter clareiras de canto:** mantém os cantos com os naipes do mapa oficial. Desmarque para redistribuir tudo livremente.

### 6. Sortear

Clique em **⚔ Sortear** e o resultado aparece abaixo com:

- **Ordem de preparação** — militantes primeiro, insurgentes depois (regra oficial)
- **Ordem de jogo** — sorteada aleatoriamente
- **Mapa sorteado** — se mais de um foi selecionado
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

## 🏆 Como usar — Resultado para Liga

### 1. Informações da partida

- **Local:** onde a partida aconteceu
- **Data:** preenchida automaticamente com hoje; clique para alterar

### 2. Jogadores

Para cada jogador preencha:

- **Nome**
- **Facção** *(facções já escolhidas somem para os outros jogadores)*
- Se escolher **Malandro** ou **Malandro 2**, selecione o tipo:
  - Andarilho, Árbitro, Aventureiro, Funileiro, Ladrão, Patife, Ronin, Saqueador ou Vagabundo
  - *(sem repetição entre os dois Malandros)*
- **Pontuação**
- **Iniciante?** *(disponível a partir do Jogador 2)*
- **Vitória por Domínio** ou **Derrota por Domínio** *(mutuamente exclusivos — dispensam pontuação)*

### 3. Gerar resultado

Clique em **📋 Gerar Resultado para Liga**.

O texto segue o formato oficial da liga:

```
Liv Toys 24/05
Vinicius Bárbaro (Iniciante) - Lagartos Cultistas Vitória por Domínio
Felipe Alencar - Guardiões de Ferro 28
Erick Oliveira (Iniciante) - Dinastia das Rapinas 24
Alexandre Chazan (Iniciante) - Marqueses 7
```

**Ordenação automática:**

- Vitória por Domínio → aparece no topo
- Maior pontuação → ordem decrescente
- Derrota por Domínio → sempre por último

### 4. Copiar

Clique em **📋 Copiar** para copiar o texto e colar direto no WhatsApp, Discord ou onde preferir.

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

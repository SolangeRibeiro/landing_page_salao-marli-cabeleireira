# Testes

Suíte que abre a página num navegador de verdade (Chromium, pelo Playwright) e
confere **97 verificações** — o tipo de coisa que não dá para garantir só lendo
o código.

## Instalação

Precisa de [Node.js](https://nodejs.org) e de Python 3 (que já vem no macOS e
no Linux). Uma vez só, na pasta do projeto:

```bash
npm install -D playwright
npx playwright install chromium
```

Isso baixa um navegador separado, usado só para testar. **O site continua sem
nenhuma dependência** — o Playwright não vai para o ar, serve apenas aqui.

## Como rodar

```bash
bash tests/rodar.sh
```

O script sobe um servidor local, roda a suíte e derruba o servidor no fim.
Leva cerca de 3 minutos. No final aparece quantas verificações passaram.

Se a porta 8000 estiver ocupada:

```bash
PORTA=8080 bash tests/rodar.sh
```

Para testar o site que já está no ar, em vez do local:

```bash
BASE=https://www.marlicabeleireira.com.br/ node tests/testes.js
```

## O que é verificado

| Seção | O que confere |
|---|---|
| 1. Carga | Nenhum erro de JavaScript, nenhum arquivo faltando |
| 2. Imagens | Todas carregam, todas têm `alt`, e as dimensões declaradas batem com o arquivo |
| 3. WhatsApp | Os 28 botões apontam para o número certo, e os botões de card enviam o nome do serviço |
| 4. Preços | Cada card bate com o catálogo de dados estruturados, e os valores citados nas respostas batem com a tabela |
| 5. Menu | Abre, fecha com Escape, fecha ao clicar fora e ao voltar para o computador |
| 6. Rolagem | Botão flutuante e cabeçalho reagem na hora certa |
| 7. Navegação | O link da seção atual fica marcado |
| 8. Animações | Todo bloco aparece ao percorrer a página |
| 9. Larguras | Sem rolagem lateral de 280px a 2560px |
| 10. Toque | Nenhum alvo interativo abaixo de 44px |
| 11. Acessibilidade | Teclado, um só `h1`, títulos sem salto, nada sem nome acessível |
| 12. Dúvidas | Perguntas começam fechadas e abrem ao clicar |
| 13. Rodapé e mapa | Ano preenchido, endereço correto, alternativa quando o mapa não carrega |
| 14. Movimento reduzido | Conteúdo visível para quem desliga animações |
| 15. Sem JavaScript | A página continua legível e os links de WhatsApp funcionam |
| 16. Link com `#` | Abrir a página já adiantada não deixa bloco invisível |
| 16b. Assinatura | O link da AXIS não é sobrescrito pelo número do salão |
| 17. Navegador antigo | Tudo funciona sem `IntersectionObserver` |
| 18. Desempenho | Só um ouvinte de rolagem registrado, não dois |
| 19. Medição | Desligada por padrão não carrega nada; ligada, registra o serviço certo a cada clique |
| 20. Imagens e prévia | Navegador recebe WebP, original existe como reserva, foto do topo baixada uma vez só, prévia de compartilhamento em 1200×630 |

## Quando rodar

Antes de publicar qualquer alteração — principalmente **ao mexer em preço**.
A seção 4 cruza o valor do card com o dos dados estruturados e com o que as
respostas dizem, que é exatamente onde um preço desatualizado costuma passar
despercebido e acabar aparecendo errado no Google.

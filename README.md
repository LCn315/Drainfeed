# Drainfeed

**A lista de espera que realmente acaba.** Acúmulo Saudável e Meta Diária.

## Como Utilizar:

1. **Navegador:**
   - Escolha um navegador para utilizar a extensão
   - Caso ele seja baseado no chrome, então estará pronto para seguir
   - Caso seja baseado em firefox, renomeie do arquivo manifestfirefox.json para manifest.json eo manifest.json original para qualquer outra coisa

2. **Backend:**
   - Entre na pasta `api` no seu terminal.
   - Rode `npm install`
   - Rode `node server.js`
   
3. **Instale a Extensão:**
   - Acesse as Extensões do seu navegador (Modo Desenvolvedor).
   - Carregue a pasta `extension` 
   - No Firefox, carregue o `manifest.json` via about:debugging.
   - No Chrome, entre na aba de extensões e ative o modo desenvolvedor, carregue a extensão sem compactar e selecione a pasta onde o manifest.json está

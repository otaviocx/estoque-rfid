# estoque-rfid

Este é um projeto de controle de estoque usando RFID acoplado a um arduino. Aqui se encontra o código de servidor que recebe a TAG do produto a ser inserido ou removido do estoque.

### Tecnologias utilizadas

* [NodeJS]    - para construção da API
* [Bower]     - gerenciamento de bibliotecas FrontEnd
* [Express]   - framework de auxílio
* [MongoDB]   - banco para cadastro e alteração das TAGs (produtos)
* [Bootstrap] - rendereização de interface

### Instalação

```sh
$ git clone [https://github.com/otaviocx/estoque-rfid.git] estoque-rfid
$ cd estoque-rfid
$ npm install
$ bower install
$ npm run dev
```

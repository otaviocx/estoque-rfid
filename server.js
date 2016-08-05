// módulos para o app
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient

// configuração do servidor
const portaDoServidor = 8080

// configuração do banco de dados
const databaseCredenciais = 'admin:mongo.oobj@';
const databaseUrl = databaseCredenciais + '127.0.0.1:27017/controle-de-estoque';
const collectionProdutos = 'produtos'
const collectionDurabilidade = 'durabilidades'

// apenas para remoção de problemas de CORS
const allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', 'example.com');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}

// variável de controle de acesso ao banco
var database

// configurando o app
app.use(bodyParser.urlencoded({ extended: true }))
app.use(allowCrossDomain);
app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs')

/**
 * Rota da página inicial
 */
app.get('/', (req, res) => {
    res.render('home')
})

/**
 * Roda para listagem dos produtos cadastrados no sistema
 */
app.get('/listagem', (req, res) => {
    database.collection(collectionProdutos).find().toArray((err, result) => {
        var content = {
            produtos: []
        }

        if (result) content.produtos = result
        res.render('lista', content)
    })
})

/**
 * Rota que cadastra uma nova TAG
 */
app.get('/cadastro', (req, res) => {
    database.collection(collectionProdutos).group(
        ['tagProduto', 'nomeProduto'], // agrupando por tagProduto e nomeProduto
        {}, // nenhum filtro visto que quero todos os produtos do banco
        { "quantidadeProduto": 0 }, // quero esse campo para todos os resultados retornados
        "function (obj, prev) { prev.quantidadeProduto++; }", // incrementando o campo falso
        function (err, results) {
            var content = {
                produtos: []
            }

            if (results && results.length > 0) content.produtos = results
            res.render('cadastro', content)
        })
})

/**
 * recalcula a durabilidade de um produto pela sua tag
 * considerando que uma nova inserção foi realizada
 */
function recalcularDurabilidadeEntrada(produto) {
    // se o produto existir e tiver durabilidade significa que podemos calcular
    // a data que este produto acabará no estoque
    if (produto && produto.durabilidade) {
        database.collection(collectionDurabilidade).findOne({ 'tagProduto': produto.tagProduto }, (err, durabilidade) => {
            // se conseguir encontrar o documento no banco aumenta sua quantidade e salva
            if (!err) {
                if (durabilidade) {
                    // carrega a durabilidade de um produto e recalcula a durabilidade para todos
                    produto.durabilidade = durabilidade.unidade
                    durabilidade.total = durabilidade.total + durabilidade.unidade
                } else {
                    console.log('Não consegui encontrar a durabilidade do produto ' + tagProduto)
                }
            }
        })
    }
}

/**
 * Rota que registra a entrada de um produto
 */
app.get('/entrada', (req, res) => {

    const tagProduto = req.query.tagProduto
    const dataAtual = new Date();
    const dataDeEntrada = dataAtual.getDay() + '/' +
        Number(dataAtual.getMonth() + 1) + '/' +
        dataAtual.getFullYear() + ' ' +
        dataAtual.getHours() + ':' +
        dataAtual.getMinutes() + ':' +
        dataAtual.getSeconds()

    database.collection(collectionProdutos).findOne({ 'tagProduto': tagProduto }, (err, produto) => {
        // se conseguir encontrar o documento no banco aumenta sua quantidade e salva
        if (!err) {
            // criando os dados do novo produto
            var novoProduto = {}
            novoProduto.nomeProduto = produto ? produto.nomeProduto : ''
            novoProduto.tagProduto = tagProduto
            novoProduto.dataEntrada = dataDeEntrada
            novoProduto.dataSaida = null
            novoProduto.durabilidade = produto ? recalcularDurabilidadeEntrada(tagProduto) : null

            database.collection(collectionProdutos).save(novoProduto, (err, result) => {
                if (err) {
                    console.log(err)
                    res.json({ success: false })
                } else {
                    res.json({ success: true })
                }
            })
        }
    })
})

/**
 * Rota que registra a saída de um produto
 */
app.get('/saida', (req, res) => {
    database.collection(collectionProdutos).findOne({ tagProduto: req.query.tagProduto }, (err, produto) => {
        // se conseguir encontrar o documento no banco diminui sua quantidade e salva
        if (!err) {
            produto.qtdProduto = Number(produto.qtdProduto) - 1
            database.collection(collectionProdutos).save(produto, (err, result) => {
                if (err) return console.log(err)
                res.redirect('/cadastro')
            })
        }
    })
})

/**
 * Rota que persiste no banco de dados um novo produto
 * com sua tag e nome, atualizando todos os demais produtos
 */
app.post('/salvarNome', (req, res) => {
    const produto = req.body

    if (!produto || !produto.tagProduto || !produto.nomeProduto || produto.nomeProduto === '') {
        res.json({ success: false })
        return
    }

    database.collection(collectionProdutos).save(req.body, (err, result) => {
        if (err) return console.log(err)

        console.log('produto persistido no banco!')
        res.redirect('/cadastro')
    })
})

/**
 * Rota que persiste no banco de dados um novo produto
 */
app.post('/salvar', (req, res) => {
    database.collection(collectionProdutos).save(req.body, (err, result) => {
        if (err) return console.log(err)

        console.log('produto persistido no banco!')
        res.redirect('/cadastro')
    })
})

/**
 * Rota que exclui um produto do banco
 */
app.get('/excluir', (req, res) => {
    database.collection(collectionProdutos).deleteOne({ tagProduto: req.query.tagProduto }, (err, result) => {
        if (err) return console.log(err)
        else {
            console.log('produto deletado!')
            res.redirect('/cadastro')
        }
    })
})

/**
 * Limpa todos os dados do banco de dados
 * Agiliza a questão do teste e amostra na hora da apresentação
 */
app.get('/limparBanco', (req, res) => {
    var isCollectionProdutosEsvaziada = false
    var isCollectionDurabilidadeEsvaziada = false

    database.collection(collectionProdutos).deleteMany({}, (err, result) => {
        if (err) return console.log(err)
        else isCollectionProdutosEsvaziada = true
    })

    database.collection(collectionDurabilidade).deleteMany({}, (err, result) => {
        if (err) return console.log(err)
        else isCollectionDurabilidadeEsvaziada = true
    })

    res.json({ success: isCollectionProdutosEsvaziada && isCollectionDurabilidadeEsvaziada });
})

/**
 * Conexão inicial com o banco e inicialização do servidor.
 */
MongoClient.connect('mongodb://' + databaseUrl, (err, db) => {
    if (err) {
        // se não conectar escreve o erro e finaliza
        console.log(err)
        process.exit()
    }

    // conexão bem sucedida com o banco
    database = db
    inicializarServidor()
})

/**
 * Inicializa o servidor na porta configurada
 */
function inicializarServidor() {
    app.listen(portaDoServidor, () => {
        console.log('Servidor iniciado na porta ' + portaDoServidor)
    })
}
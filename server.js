// módulos para o app
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient

// configuração do servidor
const portaDoServidor = 3000

// configuração do banco de dados
const dbCredenciais = 'admin:mongo.oobj@';
const dbUrl = dbCredenciais + '127.0.0.1:27017/controle-de-estoque';
const collectionProdutos = 'produtos'
const collectionDurabilidade = 'durabilidades'
var db

// configurando o app
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/bower_components', express.static(__dirname + '/bower_components'));
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
    db.collection(collectionProdutos).find().toArray((err, result) => {
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
    db.collection(collectionProdutos).find().toArray((err, result) => {
        var content = {
            produtos: []
        }

        if (result) content.produtos = result
        res.render('cadastro', content)
    })
})

/**
 * recalcula a durabilidade de um produto pela sua tag
 * considerando que uma nova inserção foi realizada
 */
function recalcularDurabilidade(produto) {
    // se o produto existir e tiver durabilidade significa que podemos calcular
    // a data que este produto acabará no estoque
    if (produto && produto.durabilidade) {
        db.collection(collectionDurabilidade).findOne({ 'tagProduto': tagProduto }, (err, durabilidade) => {
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

    var tagProduto = req.query.tagProduto
    var dataEntrada = new Date()

    db.collection(collectionProdutos).findOne({ 'tagProduto': tagProduto }, (err, produto) => {
        // se conseguir encontrar o documento no banco aumenta sua quantidade e salva
        if (!err) {
            // criando os dados do novo produto
            var novoProduto = {}
            novoProduto.nomeProduto = produto ? produto.nomeProduto : ''
            novoProduto.tagProduto = tagProduto
            novoProduto.dataEntrada = new Date()
            novoProduto.dataSaida = null
            novoProduto.durabilidade = produto ? recalcularDurabilidade(tagProduto) : null

            db.collection(collectionProdutos).save(produto, (err, result) => {
                if (err) return console.log(err)
                res.redirect('/cadastro')
            })
        }
    })
})

/**
 * Rota que registra a saída de um produto
 */
app.get('/saida', (req, res) => {
    db.collection(collectionProdutos).findOne({ tagProduto: req.query.tagProduto }, (err, produto) => {
        // se conseguir encontrar o documento no banco diminui sua quantidade e salva
        if (!err) {
            produto.qtdProduto = Number(produto.qtdProduto) - 1
            db.collection(collectionProdutos).save(produto, (err, result) => {
                if (err) return console.log(err)
                res.redirect('/cadastro')
            })
        }
    })
})

/**
 * Rota que persiste no banco de dados um novo produto
 */
app.post('/salvar', (req, res) => {
    db.collection(collectionProdutos).save(req.body, (err, result) => {
        if (err) return console.log(err)

        console.log('produto persistido no banco!')
        res.redirect('/cadastro')
    })
})

/**
 * Rota que exclui um produto do banco
 */
app.get('/excluir', (req, res) => {
    db.collection(collectionProdutos).deleteOne({ tagProduto: req.query.tagProduto }, (err, result) => {
        if (err) return console.log(err)
        else {
            console.log('produto deletado!')
            res.redirect('/cadastro')
        }
    })
})

/**
 * Conexão inicial com o banco e inicialização do servidor.
 */
MongoClient.connect('mongodb://' + dbUrl, (err, database) => {
    if (err) {
        // se não conectar escreve o erro e finaliza
        console.log(err)
        process.exit()
    }

    // conexão bem sucedida com o banco
    db = database
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
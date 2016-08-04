const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient
const collectionName = 'produtos'

var db

// configurando
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('home')
})

app.get('/listagem', (req, res) => {
    db.collection(collectionName).find().toArray((err, result) => {
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
    db.collection(collectionName).find().toArray((err, result) => {
        var content = {
            produtos: []
        }

        if (result) content.produtos = result
        res.render('cadastro', content)
    })
})

/**
 * Rota que registra a entrada de um produto
 */
app.get('/entrada', (req, res) => {
    db.collection(collectionName).findOne({ tagProduto: req.query.tagProduto }, (err, produto) => {
        // se conseguir encontrar o documento no banco aumenta sua quantidade e salva
        if (!err) {
            produto.qtdProduto = Number(produto.qtdProduto) + 1
            db.collection(collectionName).save(produto, (err, result) => {
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
    db.collection(collectionName).findOne({ tagProduto: req.query.tagProduto }, (err, produto) => {
        // se conseguir encontrar o documento no banco diminui sua quantidade e salva
        if (!err) {
            produto.qtdProduto = Number(produto.qtdProduto) - 1
            db.collection(collectionName).save(produto, (err, result) => {
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
    db.collection(collectionName).save(req.body, (err, result) => {
        if (err) return console.log(err)

        console.log('produto persistido no banco!')
        res.redirect('/cadastro')
    })
})

/**
 * Rota que exclui um produto do banco
 */
app.get('/excluir', (req, res) => {
    db.collection(collectionName).deleteOne({ tagProduto: req.query.tagProduto }, (err, result) => {
        if (err) return console.log(err)
        else {
            console.log('produto deletado!')
            res.redirect('/cadastro')
        }
    })
})

var dbCredenciais = 'admin:mongo.oobj@';
var dbUrl = dbCredenciais + '127.0.0.1:27017/controle-de-estoque';
//var dbUrl = '127.0.0.1:27017/estoque';

MongoClient.connect('mongodb://' + dbUrl, (err, database) => {
    if (err) {
        // se não conectar escreve o erro e finaliza
        console.log(err)
        process.exit()
    }
    
    // conexão bem sucedida com o banco
    db = database
    app.listen(3000, () => {
        console.log('listening on 3000')
    })
})

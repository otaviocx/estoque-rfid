// módulos para o app
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient

// configuração do servidor
const portaDoServidor = 8080

// configuração do banco de dados
const databaseUrl = '127.0.0.1:27017/estoque';
const collectionProdutos = 'produtos'
const collectionDurabilidade = 'durabilidades'
// fazer a contagem de quantos produtos devem ser contados para gerar a média
const collectionConfiguracoes = 'config'

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

function formatarData(data) {
    var meses = [
        "Janeiro", "Fevereiro", "Março",
        "Abril", "Maio", "Junho", "Julho",
        "Agosto", "Setembro", "Outubro",
        "Novembro", "Dezembro"
    ]

    var dia = data.getDate()
    var mesIndice = data.getMonth()
    var ano = data.getFullYear()
    var hora = data.getHours()
    var minutos = data.getMinutes()
    var segundos = data.getSeconds()

    return dia + ' de ' + meses[mesIndice] + ' de ' + ano + ' ' + hora + 'h ' + minutos + 'm ' + segundos + 's'
}

function milissegundosParaTempoLegivel(milissegundos) {

    function addZero(numero) {
        return (numero < 10 ? '0' : '') + numero;
    }

    var mili = milissegundos % 1000;
    milissegundos = (milissegundos - mili) / 1000;
    var segundos = milissegundos % 60;
    milissegundos = (milissegundos - segundos) / 60;
    var minutos = milissegundos % 60;
    var horas = (milissegundos - minutos) / 60;

    return addZero(horas) + 'h ' + addZero(minutos) + 'm ' + addZero(segundos) + 's';
}

/**
 * Roda para listagem dos produtos cadastrados no sistema
 */
app.get('/estoque', (req, res) => {
    database.collection(collectionProdutos).group(
        { 'nomeProduto': true }, // agrupando por nomeProduto
        { 'dataSaida': null }, // apenas os produtos que ainda não foram removidos
        { 'quantidadeProduto': 0, 'durabilidadeTotal': 0 }, // quero esse campo para todos os resultados retornados
        "function (obj, prev) { prev.quantidadeProduto++; prev.durabilidadeTotal += obj.durabilidade; prev.dataEntradaProd = obj.dataEntradaTimestamp; }", // quantidade e durabilidade
        function (err, results) {

            if (results) {
                results.forEach(function (resultado) {
                    var dataAtual = new Date();
                    var diferenca = -1

                    if (dataAtual.getTime() - resultado.dataEntradaProd.getTime() < resultado.durabilidadeTotal) {
                        diferenca = dataAtual.getTime() - resultado.dataEntradaProd.getTime()
                    }

                    resultado.durabilidadeTotal =
                        milissegundosParaTempoLegivel(diferenca > 0 ? resultado.durabilidadeTotal - diferenca : 0)
                });
            }

            var content = {
                produtos: []
            }

            if (results && results.length > 0) content.produtos = results
            res.render('estoque', content)
        })
})

/**
 * Rota que cadastra uma nova TAG
 */
app.get('/auditoria', (req, res) => {
    database.collection(collectionProdutos).find({}).sort({ 'dataEntradaTimestamp': 1 }).toArray((err, results) => {
        var content = {
            produtos: [],
            tags: []
        }

        if (results && results.length > 0) {
            content.produtos = results
            results.forEach(function (resultado) {
                if (content.tags.indexOf(resultado.tagProduto) == -1) {
                    content.tags.push(resultado.tagProduto)
                }
            });
        }
        res.render('auditoria', content)
    })
})

/**
 * Roda para listagem dos produtos cadastrados no sistema
 */
app.get('/vencimentos', (req, res) => {
    database.collection(collectionDurabilidade).find().toArray((err, result) => {
        var content = {
            durabilidades: []
        }

        if (result && result.length > 0) {

            result.forEach(function (durabilidade) {
                content.durabilidades.push({
                    nomeProduto: durabilidade.nomeProduto,
                    total: milissegundosParaTempoLegivel(durabilidade.total),
                    unidade: milissegundosParaTempoLegivel(durabilidade.unidade)
                })
            });
        }

        res.render('vencimentos', content)
    })
})

/**
 * persiste a durabilidade no banco de dados
 */
function persistirDurabilidade(durabilidade, atualizar) {
    database.collection(collectionDurabilidade).findOne({ 'tagProduto': durabilidade.tagProduto }, (err, resultDurabilidade) => {
        if (err) return console.log('Erro de comunicação com banco ' + err)

        if (!resultDurabilidade) {

            database.collection(collectionDurabilidade).save(durabilidade, (err, result) => {
                if (err) return false
                else true
            })

        } else if (atualizar) {

            resultDurabilidade.total = durabilidade.total
            resultDurabilidade.unidade = durabilidade.unidade

            // atualizando a durabilidade
            database.collection(collectionProdutos).update(
                { tagProduto: produto.tagProduto, dataEntradaTimestamp: produto.dataEntradaTimestamp }, // procurarei pelo produto específico
                {
                    "$set": {
                        "dataSaida": produto.dataSaida,
                        "dataSaidaTimestamp": produto.dataSaidaTimestamp,
                        "durabilidade": produto.durabilidade
                    }
                },
                { "multi": false }, // como quero atualizar apenas um documento
                (err, result, status) => {
                    if (err) {
                        console.log(err)
                        res.json({ success: false })
                        return
                    }

                    console.log('Saída do produto ' + produto.tagProduto + ' realizada com sucesso.')
                    res.json({ success: true })
                })

        }
    })
}

/**
 * recalcula a durabilidade de um produto pela sua tag
 * considerando que uma nova inserção foi realizada
 */
function recalcularDurabilidadeEntrada(produto) {
    // se o produto existir e tiver durabilidade significa que podemos calcular
    // a data que este produto acabará no estoque
    if (produto && produto.durabilidade && produto.durabilidade != 0) {
        database.collection(collectionDurabilidade).findOne({ 'tagProduto': produto.tagProduto }, (err, durabilidade) => {
            // se conseguir encontrar o documento no banco aumenta sua quantidade e salva
            if (!err) {
                if (durabilidade) {
                    // carrega a durabilidade de um produto e recalcula a durabilidade para todos
                    produto.durabilidade = durabilidade.unidade
                    durabilidade.total = durabilidade.total + durabilidade.unidade
                    persistirDurabilidade(durabilidade, false)
                    persistirProduto(produto)
                    return durabilidade.unidade
                } else {
                    console.log('Não consegui encontrar a durabilidade do produto ' + tagProduto)
                    return null
                }
            }
        })
    }

    // todo: se não encontrar a durabilidade, persiste uma nova para este produto
    var durabilidade = {
        tagProduto: produto.tagProduto,
        total: Number(0),
        unidade: Number(0)
    }

    persistirDurabilidade(durabilidade, false)
    return durabilidade.unidade
}

/**
 * Persiste um novo produto no banco de dados
 */
function persistirProduto(produto) {
    database.collection(collectionProdutos).save(produto, (err, result) => {
        if (err) {
            console.log(err)
            return false
        } else {
            return true
        }
    })
}

/**
 * Rota que registra a entrada de um produto
 */
app.get('/entrada', (req, res) => {

    const tagProduto = req.query.tagProduto
    const dataEntradaTimestamp = new Date();

    console.log('Procurando produtos com tag: ' + tagProduto)

    database.collection(collectionProdutos).find({ 'tagProduto': tagProduto }).toArray((err, produtos) => {
        // se conseguir encontrar o documento no banco aumenta sua quantidade e salva
        var isProdutoPersistido = false
        if (!err) {
            // criando os dados do novo produto se o mesmo não existir ainda

            var novoProduto = {}
            novoProduto.tagProduto = tagProduto
            novoProduto.dataEntrada = formatarData(dataEntradaTimestamp)
            novoProduto.dataEntradaTimestamp = dataEntradaTimestamp
            novoProduto.dataSaida = null
            novoProduto.dataSaidaTimestamp = null

            if (produtos && produtos.length > 0) {

                var produto = {
                    dataSaida: null
                }

                var existeProdutoSemSaida = false

                produtos.forEach(function (prod) {
                    novoProduto.nomeProduto = prod.nomeProduto
                    if (prod.dataSaida == null) {
                        produto = prod
                        existeProdutoSemSaida = true
                    }
                })

                database.collection(collectionDurabilidade).findOne({ 'nomeProduto': novoProduto.nomeProduto }, (err, durabilidade) => {
                    novoProduto.durabilidade = 0
                    if (err) console.log(err)
                    if (durabilidade) {
                        novoProduto.durabilidade = durabilidade.unidade
                    }
                    console.log('Durabilidade calculada: ' + novoProduto.durabilidade)

                    if (!existeProdutoSemSaida || produto.dataSaida != null) {
                        isProdutoPersistido = persistirProduto(novoProduto)
                    }

                    res.json({ success: isProdutoPersistido })
                })

            } else {

                novoProduto.nomeProduto = ''
                novoProduto.durabilidade = 0
                isProdutoPersistido = persistirProduto(novoProduto)
                res.json({ success: isProdutoPersistido })

            }
        } else {
            console.log('Erro ao criar entrada: ' + err)
        }

    })
})

/**
 * Rota que registra a saída de um produto
 */
app.get('/saida', (req, res) => {

    const tagProduto = req.query.tagProduto
    const dataSaidaTimestamp = new Date();

    database.collection(collectionProdutos).findOne({ 'tagProduto': tagProduto, 'dataSaida': null }, (err, produto) => {
        // se conseguir encontrar o documento no banco realiza a saída do mesmo e pronto
        if (err) return console.log('Erro ao procurar arquivo de saída ' + err)
        else if (produto) {
            produto.dataSaida = formatarData(dataSaidaTimestamp)
            produto.dataSaidaTimestamp = dataSaidaTimestamp
            produto.durabilidade = Math.abs(produto.dataSaidaTimestamp - produto.dataEntradaTimestamp)
            atualizarProduto(produto)

            res.json({ success: true })
        }
    })
})

function atualizarProduto(produto) {
    database.collection(collectionProdutos).update(
        { 'tagProduto': produto.tagProduto, 'dataEntradaTimestamp': produto.dataEntradaTimestamp }, // procurarei pelo produto específico
        {
            "$set": {
                "dataSaida": produto.dataSaida,
                "dataSaidaTimestamp": produto.dataSaidaTimestamp,
                "durabilidade": produto.durabilidade
            }
        },
        { 'multi': false }, // como quero atualizar apenas um produto
        (err, result, status) => {
            if (err || result <= 0) {
                console.log(err)
                return
            }

            recalcularDurabilidadeSaida(produto)
            console.log('Saída do produto ' + produto.tagProduto + ' realizada com sucesso com nova durabiliade de ' + milissegundosParaTempoLegivel(produto.durabilidade))
        })
}

function recalcularDurabilidadeSaida(produto) {

    var produtosLength = 1

    database.collection(collectionProdutos).find({ 'nomeProduto': produto.nomeProduto }).toArray(function (err, produtos) {
        if (!err) produtosLength = produtos.length

        var durabilidade = {
            nomeProduto: produto.nomeProduto,
            total: produto.durabilidade
        }

        database.collection(collectionDurabilidade).findOne({ 'nomeProduto': produto.nomeProduto }, (err, durabilidadeBanco) => {
            if (durabilidadeBanco) {
                durabilidade = durabilidadeBanco
                durabilidade.total += produto.durabilidade
            }

            durabilidade.unidade = durabilidade.total / produtosLength
            atualizarDurabilidade(durabilidade)
            console.log('Durabilidade ' + durabilidade.nomeProduto + ' atualizada')
        })
    })

}

function atualizarDurabilidade(durabilidade) {
    database.collection(collectionDurabilidade).update(
        { 'nomeProduto': durabilidade.nomeProduto }, // procurarei pela durabilidade específica
        {
            "$set": {
                "total": durabilidade.total,
                "unidade": durabilidade.unidade
            }
        },
        { 'multi': false, 'upsert': true }, // como quero atualizar apenas uma durabilidade
        (err, result, status) => {
            if (err || result <= 0) {
                console.log(err)
                return
            }

            console.log('Durabilidade ' + durabilidade.nomeProduto + ' alterada com sucesso.')
        })
}

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

    database.collection(collectionProdutos).update(
        { tagProduto: produto.tagProduto }, // procurarei por todos os objetos que tiverem essa query
        { "$set": { "nomeProduto": produto.nomeProduto } }, // vou atualizar apenas o nome dos produtos
        { "multi": true }, // como quero atualizar mais de um documento
        (err, result, status) => {
            if (err || result <= 0) {
                console.log(err)
                res.json({ success: false })
                return
            }

            console.log('Produtos alterados: ' + result)
            res.json({ success: true })
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
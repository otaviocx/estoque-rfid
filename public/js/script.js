// arquivo de script próprio
function limparBanco() {
    if (confirm('Tem certeza que quer apagar todos os dados?')) {
        $.ajax({
            url: 'http://' + window.location.host + '/limparBanco',
            type: "GET",
            //data: 'your form data',
            success: function (response) {
                alert('Banco esvaziado com sucesso!');
            }
        });
    }
}

// salva o nome de um produto no banco
function salvarNome() {
    const tag = document.getElementById('selectTag').value
    const nome = document.getElementById('txtNomeProduto').value

    if (!nome || nome === '') {
        alert('Você precisa selecionar um nome para o produto!')
        return
    }

    const produto = {
        tagProduto: tag,
        nomeProduto: nome
    }

    $.ajax({
        url: 'http://' + window.location.host + '/salvarNome',
        type: "POST",
        data: produto,
        success: function (response) {
            location.reload(true)
        }
    });
}
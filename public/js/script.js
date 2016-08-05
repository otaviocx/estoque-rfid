// arquivo de script próprio
function limparBanco() {
    $.ajax({
        url: 'http://' + window.location.host + '/limparBanco',
        type: "GET",
        //data: 'your form data',
        success: function (response) {
            alert('Banco esvaziado com sucesso!');
        }
    });
}
//Damit zurück Button funktioniert
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.page) {
        loadPage(event.state.page);
    } else {
        loadPage('')
    }
});


function loadPage(page) {
    fetch(`${page}`)
        .then(response => response.text())
        .then(data => {
            document.getElementById("content").innerHTML = data;
            history.pushState({ page: page }, '', `/${page}`);
        })
        .catch(error => console.error("Fehler beim Laden der Seite: ", error))
}

function CheckNameExists(name) {
    fetch("/check_name", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name})
    })
    .then(response => response.json())
    .then(data => {
        if(data == true) {
            ShowErrorAlert("Fehler", `Username ${data.name} existiert bereits. Bitte wähle einen anderen.`);
        } else {
            window.location.href = "/lobby";
        }
    })
}
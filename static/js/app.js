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
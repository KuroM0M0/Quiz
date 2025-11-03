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


//Vue funktioniert normal mit {{ }}, da das aber von Flask verwendet wird,
//muss es mit v-text="" gemacht werden. Beispiel: <td v-text="player.points"></td>
const { createApp } = Vue;

const app = createApp({
    delimiters: ['[[', ']]'],
    data() {
    return {
        players: {}
    };
    },
    mounted() {
    socket.on('playerList', data => {
        console.log("Empfangen:", data);
        this.players = data.players;
    });
    }
});

//Vue fängt da an wo id=app gesetzt ist
app.mount('#app');
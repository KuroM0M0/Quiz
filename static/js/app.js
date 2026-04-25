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

function CheckNameExists(event, name) {
    event.preventDefault();
    fetch(`/name_exists?name=${encodeURIComponent(name)}`)
    .then(response => response.json())
    .then(data => {
        if(data === true) {
            ShowErrorAlert("Fehler", `Username ${name} existiert bereits. Bitte wähle einen anderen.`);
        } else {
            document.getElementById("loginForm").submit();
        }
    })
    .catch(error => {
        console.error("Fehler bei CheckNameExists:", error);
        document.getElementById("loginForm").submit();
    });
}


function playBuzzerSound() {
    var sound = document.getElementById("buzzerKurz");
    //var sound = new Audio("/sounds/BuzzerKurz.mp3");
    sound.play().catch(function(error) {
        console.error("Error playing sound:", error);
    });
}


//Vue funktioniert normal mit {{ }}, da das aber von Flask verwendet wird,
//muss es mit v-text="" gemacht werden. Beispiel: <td v-text="player.points"></td>
const { createApp } = Vue;

const app = createApp({
    delimiters: ['[[', ']]'],
    data() {
        return {
            players: {},
            sortDescending: true // Standardmäßig: Höchste Punkte oben
        };
    },
    computed: {
        // Diese Funktion wandelt das Objekt in eine sortierte Liste um
        sortedPlayersList() {
            // 1. Objekt in ein Array umwandeln: [{name: 'Max', points: 10}, ...]
            const playerArray = Object.entries(this.players).map(([key, value]) => {
                return {
                    name: key,
                    points: value.points // Hier nehmen wir an, dass player.points existiert
                };
            });

            // 2. Sortieren basierend auf der Richtung
            return playerArray.sort((a, b) => {
                if (this.sortDescending) {
                    return b.points - a.points; // Viel zu Wenig (Absteigend)
                } else {
                    return a.points - b.points; // Wenig zu Viel (Aufsteigend)
                }
            });
        }
    },
    methods: {
        // Diese Funktion rufen wir auf, wenn man auf "Punkte" klickt
        toggleSort() {
            this.sortDescending = !this.sortDescending;
        }
    },
    mounted() {
        socket.on('playerList', data => {
            console.log("Empfangen:", data);
            this.players = data.players;
        });
    }
});

app.mount('#app');
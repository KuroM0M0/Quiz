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
            document.getElementById("loginForm").submit(); //Das hier löschen
            //ShowErrorAlert("Fehler", `Username ${name} existiert bereits. Bitte wähle einen anderen.`); //Das hier reinmachen
        } else {
            document.getElementById("loginForm").submit();
        }
    })
    .catch(error => {
        console.error("Fehler bei CheckNameExists:", error);
        document.getElementById("loginForm").submit();
    });
}


function toggleCode() {
    const roomCodeElement = document.querySelector('.roomCode');
    if (roomCodeElement) {
        if(roomCodeElement.style.filter === 'blur(8px)') {
            roomCodeElement.style.filter = 'none';
        } else {
            
            roomCodeElement.style.filter = 'blur(8px)';
        }
    }
}

function openModal(modalID) {
    document.getElementById(modalID).classList.add("is-active");
}

function closeModal(modalID) {
    document.getElementById(modalID).classList.remove("is-active");
}


socket.on("kicked", function(data) {
    // Prüfen, ob man selbst der gekickte Spieler ist
    if(username === data.username) {
        window.location.href = "/lobby";
        ShowErrorAlert("Du wurdest gekickt", data.message);
    }
});


//Vue funktioniert normal mit {{ }}, da das aber von Flask verwendet wird,
//muss es mit v-text="" gemacht werden. Beispiel: <td v-text="player.points"></td>
const { createApp } = Vue;

const app = createApp({
    delimiters: ['[[', ']]'],
    data() {
        return {
            players: {},
            sortDescending: true, // Standardmäßig: Höchste Punkte oben
            buzzedPlayers: {},    // { [username]: true }
            submittedPlayers: {}  // { [username]: true }
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
        },
        getPlayerClass(playerName) {
            if (this.buzzedPlayers && this.buzzedPlayers[playerName]) {
                return 'green';
            }
            if (this.submittedPlayers && this.submittedPlayers[playerName]) {
                return 'brown';
            }
            return '';
        }
    },
    mounted() {
        socket.on('playerList', data => {
            if (data && data.players) {
                this.players = data.players;
            }
        });

        // Wenn ein Spieler buzzert: in Spielerliste grün markieren
        socket.on('buzzer', data => {
            if (data && data.username) {
                this.buzzedPlayers = { ...this.buzzedPlayers, [data.username]: true };
            }
        });

        // Wenn Buzzer zurückgesetzt wird: grün entfernen
        socket.on('buzzerReset', data => {
            if (data && (data.lockBuzzer === true || data.lockBuzzer === false)) {
                return;
            }
            this.buzzedPlayers = {};
        });

        // Wenn Teilnehmer Antwort abgeben: in Spielerliste braun markieren
        socket.on('submitAnswer', data => {
            if (data && data.username) {
                this.submittedPlayers = { ...this.submittedPlayers, [data.username]: true };
            }
        });

        // Wenn Host Antwort-Eingabe sperrt/deaktiviert: braun entfernen
        socket.on('answerInputToggle', data => {
            if (data && data.answerInput === false) {
                this.submittedPlayers = {};
            }
        });

        // Wenn Texte gelöscht werden (z. B. Clear Text Button): Markierungen entfernen
        socket.on('clearText', () => {
            this.submittedPlayers = {};
            this.buzzedPlayers = {};
        });

        // Auch beim Absenden einer neuen Frage zurücksetzen
        socket.on('sendQuestion', () => {
            this.buzzedPlayers = {};
            this.submittedPlayers = {};
        });

        // Wenn ein Spieler entfernt / gekickt wird
        socket.on('playerRemoved', data => {
            if (data && data.username) {
                const newBuzzed = { ...this.buzzedPlayers };
                delete newBuzzed[data.username];
                this.buzzedPlayers = newBuzzed;

                const newSubmitted = { ...this.submittedPlayers };
                delete newSubmitted[data.username];
                this.submittedPlayers = newSubmitted;
            }
        });
    }
});

if (document.getElementById('app')) {
    app.mount('#app');
}
let countdown;

function startTimer() {
    ShowTimerAlert("Wie lang soll der Timer dauern?", "Zeit in Sekunden angeben").then((result) => {
        if (result.isConfirmed) {
            lockTextButton = document.getElementById("lockTextButton");
            const input = result.value
            let seconds = input;

            if (isNaN(seconds) || seconds <= 0) {
                ShowErrorAlert("Ungültige Nummer!", "Bitte gib eine Zahl ein, die größer als 0 ist.");
                return;
            }

            socket.emit('timer', {timer: input, room: roomID});
        }
    })
}

//Damit nicht nur beim Host die Zeit angezeigt wird
socket.on("timer", function(data) {
    const display = document.getElementById('timerDisplay');
    const lockTextButton = document.getElementById("lockTextButton");
    
    const clientNow = Date.now();
    const serverOffset = data.serverTime - clientNow;
    const durationInMs = parseInt(data.duration) * 1000;
    const endTime = clientNow + durationInMs + serverOffset;

    clearInterval(countdown);
    
    countdown = setInterval(() => {
        const now = Date.now() + serverOffset; 
        const timeLeft = endTime - now;

        // 1. Prüfen, ob der Timer abgelaufen ist
        if(timeLeft <= 0) {
            clearInterval(countdown); // Intervall stoppen
            display.innerText = "00:00"; // Kurz 0 anzeigen

            // Die Sperr-Logik ausführen
            if(lockTextButton) {
                // Hier das Signal an den Server senden
                socket.emit("lockText", {roomID: roomID, lockText: true});
                
                // Falls du eine lokale Funktion zum Button-Styling hast:
                if (typeof buttonActiveToggle === "function") {
                    buttonActiveToggle(lockTextButton);
                }
            }

            // Nach einer halben Sekunde den Timer ganz ausblenden
            //setTimeout(() => {
            //    display.innerText = "";
            //}, 500);

            return; // WICHTIG: Hier abbrechen, damit der Code unten nicht mehr läuft
        }

        // 2. Wenn noch Zeit da ist: Anzeige berechnen
        let totalSeconds = Math.max(0, Math.floor(timeLeft / 1000));
        let mins = Math.floor(totalSeconds / 60);
        let secs = totalSeconds % 60;

        display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 200);
});
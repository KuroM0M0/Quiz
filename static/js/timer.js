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
    const endTime = data.endTime;

    clearInterval(countdown);
    countdown = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime - now; // Differenz in Millisekunden

        // Umrechnung in Sekunden für die Anzeige
        let totalSeconds = Math.floor(timeLeft / 1000);
        let mins = Math.floor(totalSeconds / 60);
        let secs = totalSeconds % 60;

        display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if(timeLeft <= 0) {
            clearInterval(countdown);
            display.innerText = "";
            if(lockTextButton) {
                socket.emit("lockText", {roomID: roomID, lockText: true});
                buttonActiveToggle(lockTextButton);
            }
        }
    }, 200);
});
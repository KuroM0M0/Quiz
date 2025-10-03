const roomID = "{{ session['roomID'] }}";

function onBuzzerClick() {
    const buzzer = document.getElementById("buzzer");
    buzzer.setAttribute("disabled", true);
    fetch('/buzz', { method: "POST" })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                console.log(`${data.buzzed_by} hat gebuzzert!`);
            } else {
                console.log(`Schon gebuzzert von ${data.buzzed_by}`);
                ShowErrorAlert("Zu Langsam!", `${data.buzzed_by} war wohl schneller als du.`)
            }
        });
}


// Verbindung aufbauen
const source = new EventSource(`/stream/${roomID}`);

// Wenn der Server neue Daten sendet:
source.onmessage = (e) => {
    const room = JSON.parse(e.data);
    console.log("Update:", room);

    document.getElementById("status").innerText =
        room.buzzed_by ? `${room.buzzed_by} hat gedrückt!` : "Noch niemand";

    // Button sperren, wenn Buzzer aus
    document.getElementById("buzzer").disabled = !room.buzzer_active;
};
//Wird ausgeführt wenn Buzzer gedrückt wird
function onBuzzerClick() {
    //const buzzer = document.getElementById("buzzer");
    //buzzer.setAttribute("disabled", true);
    const roomID = document.getElementById("roomCode").textContent.split("Room Code:")[1].trim();
    console.log("Hier krasse roomID im buzzer.js: " + roomID + " von " + username);
    
    socket.emit("buzzer", {"username": username, "room": roomID});
}

//Wird ausgeführt wenn Buzzer gedrückt wird
socket.on("buzzer", function(data) {
    const buzzer = document.getElementById("buzzer");
    const whoBuzzed = document.getElementById("whoBuzzed");
    const username = data.username;
    whoBuzzed.innerHTML = username + " hat gedrückt";
    console.log(buzzer + whoBuzzed + username);
    buzzer.setAttribute("disabled", true);
})

function onBuzzerReset() {
    console.log(roomID);
    console.log("Buzzerrrrreset");
    socket.emit("buzzerReset", {"roomID": roomID});
}

socket.on("buzzerReset", function() {
    const buzzer = document.getElementById("buzzer");
    const whoBuzzed = document.getElementById("whoBuzzed");
    buzzer.removeAttribute("disabled");
    whoBuzzed.innerHTML = "";
})



//Wird ausgeführt wenn der User die Seite geladen hat, um den Status des Buzzers abzufragen
socket.on("playLoaded", function(data) {
    const buzzer = document.getElementById("buzzer");

    //Prüft ob Buzzer im Raum an oder aus ist
    if(data.buzzerStatus == true) {
        buzzer.removeAttribute("disabled");
    } else {
        buzzer.setAttribute("disabled", true);

        //Prüft wer gebuzzert hat
        const whoBuzzed = document.getElementById("whoBuzzed");
        const username = data.buzzed_by;
        whoBuzzed.innerHTML = username + " hat gedrückt";
    }
})
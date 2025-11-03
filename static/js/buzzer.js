//Wird ausgeführt wenn Buzzer gedrückt wird
function onBuzzerClick() {
    //const buzzer = document.getElementById("buzzer");
    //buzzer.setAttribute("disabled", true);
    const roomID = document.getElementById("roomCode").textContent.split("Room Code:")[1].trim();   
    socket.emit("buzzer", {"username": username, "room": roomID});
}

//Wird ausgeführt wenn Buzzer gedrückt wird
socket.on("buzzer", function(data) {
    const buzzer = document.getElementById("buzzer");
    const whoBuzzed = document.getElementById("whoBuzzed");
    const username = data.username;
    const players = Object.keys(data.players);
    console.log(players);

    const hostBuzzerOrder = document.getElementById(username + "BuzzerOrder");
    const hostCard = document.getElementById(username + "Card");
    if(hostCard != null) {
        hostCard.classList.add("green");
    }

    if(buzzer != null) {
        whoBuzzed.innerHTML = username + " hat gedrückt";
        buzzer.setAttribute("disabled", true);
    }
    
    if(players != null) {
        for(let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerBuzzerOrder = document.getElementById(player + "BuzzerOrder");
            if(playerBuzzerOrder != null) {
                playerBuzzerOrder.innerHTML = "";
            }
        }
    }

    if(hostBuzzerOrder != null) {
        console.log(data.buzzerOrder);
        hostBuzzerOrder.innerHTML = data.buzzerOrder + ". ";
    }
})

function onBuzzerReset() {
    console.log(roomID);
    console.log("Buzzerrrrreset");
    socket.emit("buzzerReset", {"roomID": roomID});
}

socket.on("buzzerReset", function(data) {
    const buzzer = document.getElementById("buzzer");
    const whoBuzzed = document.getElementById("whoBuzzed");
    const players = Object.keys(data.players);
    console.log("buzzerReset");

    if(buzzer != null && whoBuzzed != null) {
        buzzer.removeAttribute("disabled");
        whoBuzzed.innerHTML = "";
    }

    if(players != null) {
        for(let i = 0; i < players.length; i++) {
            const player = players[i];
            const hostCard = document.getElementById(player + "Card");
            if(hostCard != null) {
                hostCard.classList.remove("green");
            }
            const playerBuzzerOrder = document.getElementById(player + "BuzzerOrder");
            if(playerBuzzerOrder != null) {
                playerBuzzerOrder.innerHTML = "";
            }
        }
    }
})



//Wird ausgeführt wenn der User die Seite geladen hat, um den Status des Buzzers abzufragen
socket.on("playLoaded", function(data) {
    const buzzer = document.getElementById("buzzer");

    //Verhindert fehlermeldung für den Host
    if(buzzer != null) {
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
    }
})
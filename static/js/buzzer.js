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
        hostBuzzerOrder.innerHTML = data.buzzerOrder + ". ";
    }
    playBuzzerSound();
})

function onBuzzerReset() {
    socket.emit("buzzerReset", {"roomID": roomID});
}

socket.on("buzzerReset", function(data) {
    if(data.lockBuzzer == true) {
        const resetBuzzer = document.getElementById("resetBuzzer")
        resetBuzzer.setAttribute("disabled", true);
    } else if(data.lockBuzzer == false) {
        const resetBuzzer = document.getElementById("resetBuzzer")
        resetBuzzer.removeAttribute("disabled");


    } else {
        const buzzer = document.getElementById("buzzer");
        const whoBuzzed = document.getElementById("whoBuzzed");
        const players = Object.keys(data.players);

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
    }
})



//Wird ausgeführt wenn der User die Seite geladen hat, um den Status des Buzzers abzufragen
socket.on("playLoaded", function(data) {
    const buzzer = document.getElementById("buzzer");
    const inputField = document.getElementsByName("InputField")[0];

    //Verhindert fehlermeldung für den Host
    if(buzzer != null) {
        //Prüft ob Buzzer im Raum an oder aus ist
        if(data.buzzerStatus == true) {
            buzzer.removeAttribute("disabled");
        } else {
            buzzer.setAttribute("disabled", true);

            //Prüft wer gebuzzert hat
            if (data.buzzed_by) {
                const whoBuzzed = document.getElementById("whoBuzzed");
                const username = data.buzzed_by;
                whoBuzzed.innerHTML = username + " hat gedrückt";
            }
        }
    }

    if(inputField != null) {
        if(data.textLocked == true) {
            inputField.setAttribute("disabled", true);
        } else {
            inputField.removeAttribute("disabled");
        }
    }
    if(data.answerButton == true) {
        const answerButton = document.getElementById("submitAnswer");
        answerButton.classList.remove("unsichtbar");
    }
})


socket.on("lockBuzzer", function(data) {
    const Buzzer = document.getElementById("buzzer");
    if(data.lockBuzzer == true) {
        Buzzer.setAttribute("disabled", true);
    } else {
        Buzzer.removeAttribute("disabled");
    }
})

socket.on("answerInput", function(data) {
    const Button = document.getElementById("lockTextButton");
    if(Button) {
        if(data.answerInput == true) {
            Button.setAttribute("disabled", true);
        } else {
            Button.removeAttribute("disabled");
        }
    }
})
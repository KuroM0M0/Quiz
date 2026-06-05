function buttonActiveToggle(button) {
    button.classList.toggle('is-active');
}

//Wurde entfernt
function onlyFirstBuzz() {
    const firstBuzzButton = document.getElementById('firstBuzz');
    roomID = "{{ session['roomID'] }}";
    if(firstBuzzButton.hasAttribute("class", "is-active")) {
        socket.emit('firstBuzz', {roomID: roomID, firstBuzz: true});
    } else {
        socket.emit('firstBuzz', {roomID: roomID, firstBuzz: false});
    }
    
}

function clearText() {
    const text = "";
    socket.emit('clearText', {text: text, roomID: roomID});
}


function addPoints(button) {
    let player = button.id.split("Add")[0].trim();
    socket.emit('addPoints', {username: player, roomID: roomID});
}


function decreasePoints(button) {
    let player = button.id.split("Decrease")[0].trim();
    socket.emit('decreasePoints', {username: player, roomID: roomID});
}

function editPoints(button) {
    let player = button.id.split("Edit")[0].trim();
    ShowAnswerAlert("Gib die neue Punktzahl für " + player + " ein:", "number", "Punktzahl").then((result) => {
        if(result.isConfirmed) {
            const inputValue = Swal.getInput().value;
            const newPoints = parseInt(inputValue);
            socket.emit('addPoints', {username: player, points: newPoints, roomID: roomID});
        } else if(result.isDenied) {
            const inputValue = Swal.getInput().value;
            const newPoints = parseInt(inputValue);
            socket.emit('editPoints', {username: player, points: newPoints, roomID: roomID});
        } else if(result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
            const inputValue = Swal.getInput().value;
            const newPoints = parseInt(inputValue);
            socket.emit('decreasePoints', {username: player, points: newPoints, roomID: roomID});
        }
    });
}


function lockBuzzer(button) {
    if(button.classList.contains("is-active")) {
        socket.emit('lockBuzzer', {roomID: roomID, lockBuzzer: false});
    } else {
        socket.emit('lockBuzzer', {roomID: roomID, lockBuzzer: true});
    }
    buttonActiveToggle(button);
}


function lockText(button) {
    if(button.classList.contains("is-active")) {
        socket.emit('lockText', {roomID: roomID, lockText: false});
    } else {
        socket.emit('lockText', {roomID: roomID, lockText: true});
    }
    buttonActiveToggle(button);
}


function answerInput(button) {
    buttonActiveToggle(button);
    if(button.classList.contains("is-active")) {
        socket.emit('answerInputToggle', {roomID: roomID, answerInput: true});
    } else {
        socket.emit('answerInputToggle', {roomID: roomID, answerInput: false});
    }
}


function rejoinButton(button) {
    fetch('/rejoin')
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            ShowErrorAlert("Fehler", data.error);
            return;
        }
        if(data.success == "True") {
            window.location.href = "/play";
        } else {
            ShowErrorAlert("Fehler", "Du bist aktuell in keinem Raum dem du rejoinen könntest.");
        }
    })
    .catch(error => console.error('rejoin Button Fehler', error));
}
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
    console.log("clearText IST DAAAAAAAAAAAAAAAAA");
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
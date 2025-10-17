function onTextChange() {
    const inputFeld = document.getElementById("antwortInput");
    const text = inputFeld.value;
    console.log("textChange");
    socket.emit('text_update', {text: text, username: username, room: roomID});
}

function onTextChangeHost(user) {
    const inputFeld = document.getElementById(user + "Input");
    const text = inputFeld.value;
    console.log("textChangeHost");
    socket.emit('text_update', {text: text, username: user, room: roomID});
}
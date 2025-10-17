function onTextChange(user) {
    const inputFeld = document.getElementById(user + "Input");
    const text = inputFeld.value;
    console.log("textChange");
    socket.emit('text_update', {text: text, username: user, room: roomID});
}
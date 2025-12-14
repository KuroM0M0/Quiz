function onTextChange(user) {
    const inputFeld = document.getElementById(user + "Input");
    const text = inputFeld.value;
    console.log("textChange");
    socket.emit('text_update', {text: text, username: user, room: roomID});
}

socket.on("lockText", function(data) {
    inputField = document.getElementsByName("InputField")[0];
    if(inputField) {
        if(data.lockText == true) {
            inputField.setAttribute("disabled", true);
        } else {
            inputField.removeAttribute("disabled");
        }
    }
});
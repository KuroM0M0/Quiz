function onTextChange(user) {
    const inputFeld = document.getElementById(user + "Input");
    const text = inputFeld.value;
    socket.emit('text_update', {text: text, username: user, room: roomID});
}

function lockSubmitAnswer(username, button) {
    answerInput = document.getElementById(username + "Input");
    answerInput.setAttribute("disabled", true);
    button.setAttribute("disabled", true);
    socket.emit("submitAnswer", {username: username, room: roomID});
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

socket.on("answerInputToggle", function(data) {
    answerButton = document.getElementById("submitAnswer");
    if(answerButton) {
        if(data.answerInput == true) {
            answerButton.classList.remove("unsichtbar");
            answerButton.removeAttribute("disabled");
        } else {
            answerButton.classList.add("unsichtbar");
        }
    }
})

socket.on("clearText", function(data) {
    inputField = document.getElementsByName("InputField")[0];
    const textareas = document.getElementsByClassName("textarea");

    for (let i = 0; i < textareas.length; i++) {
        textareas[i].value = "";
    }
    
    if(inputField) {
        inputField.value = "";
    }
})
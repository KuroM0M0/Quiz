function onBuzzerClick() {
    //const buzzer = document.getElementById("buzzer");
    //buzzer.setAttribute("disabled", true);
    const roomID = document.getElementById("roomCode").textContent.split("Room Code:")[1].trim();
    console.log("Hier krasse roomID im buzzer.js: " + roomID + " von " + username);
    
    socket.emit("buzzer", {"username": username, "room": roomID});
}

socket.on("buzzer", function(data) {
    const buzzer = document.getElementById("buzzer");
    const whoBuzzed = document.getElementById("whoBuzzed");
    const username = data.username;
    whoBuzzed.innerHTML = username + " hat gedrückt";
    console.log(buzzer + whoBuzzed + username);
    buzzer.setAttribute("disabled", true);
})
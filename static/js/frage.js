function sendQuestion() {
    ShowAnswerAlert3("Welche Frage möchtest du stellen?", "textarea", "Wie viele Einwohner hat Deutschland?").then((result) => {
        if(result.isConfirmed) {
            //roomID = document.getElementById("roomID").value;
            socket.emit("sendQuestion", { room: roomID, question: result.value });
        }
    })
}


socket.on('sendQuestion', function(data) {
    const card = document.getElementById('qCard');
    if(card != null) {
        card.classList.remove('unsichtbar');
        const text = document.getElementById('qText');
        text.textContent = data.question;
        card.classList.remove('qcard-slide');
        card.style.opacity = '0';
        void card.offsetWidth; // Reflow erzwingen, damit die Animation auch bei gleicher Frage erneut läuft
        card.classList.add('qcard-slide');
    }
});
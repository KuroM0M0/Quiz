socket.on("cards_update", function(data) {
    //const roomID = data.roomID;
    const username = data.username;
    const userCard = username + "Card";
    const cards = document.getElementById('card');
    const cardExists = document.getElementById(userCard);

    if(cardExists == null && cards != null) {
        const card = document.createElement('div');
        card.classList.add('abstandOben');
        card.classList.add('column', 'is-narrow');
        card.innerHTML = `
            <div name="card" class="card cardDash" id="${userCard}">
                <header class="card-header">
                    <p class="zentriert card-header-title"><span id="${username}BuzzerOrder"></span> ${username}</p>
                </header>
                <div class="card-content">
                    <div class="content">
                        <textarea class="textarea hostAnswerInput has-fixed-size" placeholder="Textfeld" id="${username}Input" oninput="onTextChange('${username}')"></textarea>
                    </div>
                </div>
                <footer class="card-footer">
                    <p class="card-footer-item">
                        <span title="Füge einen Punkt hinzu"><button class="button is-success is-small abstand" onclick="addPoints(this)" id="${username}Add"><i class="fas fa-plus"></i></button></span>
                        <span title="Setze eine beliebige Punktzahl"><button class="button is-info is-small abstand" onclick="editPoints(this)" id="${username}Edit"><i class="fas fa-edit"></i></button></span>
                        <span title="Reduziere die Punkte um 1"><button class="button is-danger is-small abstand" onclick="decreasePoints(this)" id="${username}Decrease"><i class="fas fa-minus"></i></button></span>
                    </p>
                </footer>
            </div>
        `
        cards.appendChild(card);
    }
});

socket.on('text_update', function(data) {
    const updateField = document.getElementById(data.username + "Input");
    updateField.value = data.text;
});


/*//Spielerliste nur bei Spielern nicht bei Host
socket.on('playerList', function(data) {
    const playerList = document.getElementById('playerList');
    
    //Verhindert Fehlermeldung beim Host
    if(playerList != null) {
        const newRow = document.createElement('tr');
        newRow.insertCell().innerHTML = data.player;
        newRow.insertCell().innerHTML = 0;
        playerList.appendChild(newRow);
    }
});*/

socket.on("submitAnswer", function(data) {
    const card = document.getElementById(data.username + "Card");
    if(card != null) {
        card.classList.add("brown");
    }
})

socket.on("answerInputToggle", function(data) {
    const card = document.getElementsByName("card");
    const inputField = document.getElementsByName("InputField")[0];
    if(card != null) {
        if(data.answerInput == false) {
            for(let i = 0; i < card.length; i++) {
                card[i].classList.remove("brown");
            }
        }
    }
    if(inputField != null) {
        if(data.answerInput == false) {
            inputField.removeAttribute("disabled");
        }
    }
})

socket.on("playerRemoved", function(data) {
    const username = data.username;
    const userCard = document.getElementById(username + "Card");
    
    if (userCard != null) {
        // .parentElement.remove() löscht auch das äußere column-div,
        // damit kein leerer Platzhalter im Grid zurückbleibt.
        userCard.parentElement.remove();
        console.log("Karte von " + username + " erfolgreich entfernt.");
    }
});
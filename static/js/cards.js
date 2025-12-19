socket.on("cards_update", function(data) {
    //const roomID = data.roomID;
    console.log(data.username);
    console.log(data);
    const username = data.username;
    const userCard = username + "Card";
    const cards = document.getElementById('card');
    const cardExists = document.getElementById(userCard);

    if(cardExists == null && cards != null) {
        const card = document.createElement('div');
        card.classList.add('abstandOben');
        card.classList.add('column');
        card.innerHTML = `
            <div class="card cardDash" id="${userCard}">
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
                        
                        <button class="button is-success is-small abstand" onclick="addPoints(this)" id="${username}Add"><i class="fas fa-plus"></i></button>
                        <button class="button is-danger is-small abstand" onclick="decreasePoints(this)" id="${username}Decrease"><i class="fas fa-minus"></i></button>    
                    </p>
                </footer>
            </div>
        `
        cards.appendChild(card);
    }
});

socket.on('text_update', function(data) {
    const updateField = document.getElementById(data.username + "Input");
    console.log(data);
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
    const card = document.getElementById(data.username + "Card");
    const inputField = document.getElementsByName("InputField")[0];
    if(card != null) {
        if(data.answerInput == false) {
            card.classList.remove("brown");
        }
    } else if(inputField != null) {
        if(data.answerInput == false) {
            inputField.removeAttribute("disabled");
        }
    }
})
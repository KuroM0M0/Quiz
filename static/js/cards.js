socket.on("cards_update", function(data) {
    //const roomID = data.roomID;
    console.log(data.username);
    console.log(data);
    const username = data.username;
    const userCard = username + "Card";
    const cards = document.getElementById('card');
    const cardExists = document.getElementById(userCard);

    if(cardExists == null) {
        const card = document.createElement('div');
        card.classList.add('column');
        card.setAttribute('id', userCard);
        card.innerHTML = `
            <div class="card">
                <header class="card-header">
                    <p class="zentriert card-header-title" id="${username}BuzzerOrder"></p>
                </header>
                <div class="card-content">
                    <div class="content">
                        <input class="input" type="text" placeholder="Textfeld" id="${username}Input" oninput="onTextChange('${username}')">
                    </div>
                </div>
            <footer class="card-footer">
                    <p class="card-footer-item">
                        
                        <button class="button is-success is-small abstand"><i class="fas fa-plus"></i></button>
                        <button class="button is-danger is-small abstand"><i class="fas fa-minus"></i></button>    
                    </p>
                </footer>
            </div>
        `
        cards.appendChild(card);
        const BuzzerOrder = document.getElementById(`${username}BuzzerOrder`);
        BuzzerOrder.innerHTML = `${username}`;
        //TODO Buzzernummer hier zuweisen
    }
});

socket.on('text_update', function(data) {
    const updateField = document.getElementById(data.username + "Input");
    console.log(data);
    updateField.value = data.text;
});


//Spielerliste nur bei Spielern nicht bei Host
socket.on('playerList', function(data) {
    const playerList = document.getElementById('playerList');
    
    //Verhindert Fehlermeldung beim Host
    if(playerList != null) {
        const newRow = document.createElement('tr');
        newRow.insertCell().innerHTML = data.player;
        newRow.insertCell().innerHTML = 0;
        playerList.appendChild(newRow);
    }
    
});
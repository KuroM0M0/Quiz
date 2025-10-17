socket.on("cards_update", function(data) {
    //const roomID = data.roomID;
    console.log(data.username);
    console.log(data);
    const username = data.username;
    const userCard = username + "Card";
    const cards = document.getElementById('card');
    const card = document.createElement('div');
            card.classList.add('column');
            card.setAttribute('id', userCard);
            card.innerHTML = `
                <div class="card">
                    <header class="card-header">
                        <p class="zentriert card-header-title"><span title="Username">${username}</span></p>
                    </header>
                    <div class="card-content">
                        <div class="content">
                            <input class="input" type="text" placeholder="Textfeld" id="${username}Input" oninput="onTextChange('${username}')">
                        </div>
                    </div>
                <footer class="card-footer">
                        <p class="card-footer-item">
                            <button class="button is-success is-small abstandMedium"><i class="fas fa-plus"></i></button>
                            <button class="button is-danger is-small abstandSmall"><i class="fas fa-minus"></i></button>    
                        </p>
                    </footer>
                </div>
            `
            cards.appendChild(card);
});

socket.on('text_update', function(data) {
    const updateField = document.getElementById(data.username + "Input");
    console.log(data);
    updateField.value = data.text;
});
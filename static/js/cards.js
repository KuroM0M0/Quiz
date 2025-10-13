socket.on("cards_update", function(data) {
    //const roomID = data.roomID;
    console.log(data.username);
    console.log(data);
    const username = data.username;
    const cards = document.getElementById('card');
    const card = document.createElement('div');
            card.classList.add('column');
            card.innerHTML = `
                <div class="card">
                    <header class="card-header">
                        <p class="zentriert card-header-title"><span title="SlotID">${username}</span> | ${username}</p>
                    </header>
                    <div class="card-content">
                        <div class="content">
                            <span title="Raum">🚪</span> ${username} <br>
                            <span title="Regal">📥</span> ${username} <br>
                            <span title="Fach">📦</span> ${username} <br>
                            <span title="Typ">${username}</span>
                        </div>
                    </div>
                <footer class="card-footer">
                
                        <p class="card-footer-item">
                            <span title="Menge">${username}</span>
                            <button class="button is-success is-small abstandMedium" onclick="addCount(${username})"><i class="fas fa-plus"></i></button>
                            <button class="button is-danger is-small abstandSmall" onclick="decreaseCount(${username}, ${username})"><i class="fas fa-minus"></i></button>    
                        </p>
                    </footer>
                </div>
            `
            cards.appendChild(card);
})
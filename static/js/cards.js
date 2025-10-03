function createCard() {
    const cards = document.getElementById('card');
    const roomID = sessionStorage.getItem('roomID')
    rooms = fetch('/get_rooms')
        .then(response => response.json())
        .then(rooms => {
            cards.innerHTML = '';
            rooms[roomID].players.forEach(player => {
                const card = document.createElement('div');
                card.classList.add('column');
                card.innerHTML = `
                    <div class="card">
                        <header class="card-header">
                            <p class="zentriert card-header-title"><span title="SlotID">${player}</span> | ${player}</p>
                        </header>
                        <div class="card-content">
                            <div class="content">
                                <span title="Raum">🚪</span> ${player} <br>
                                <span title="Regal">📥</span> ${player} <br>
                                <span title="Fach">📦</span> ${player} <br>
                                <span title="Typ">${player}</span>
                            </div>
                        </div>
                    <footer class="card-footer">
                    
                            <p class="card-footer-item">
                                <span title="Menge">${player}</span>
                                <button class="button is-success is-small abstandMedium" onclick="addCount(${player})"><i class="fas fa-plus"></i></button>
                                <button class="button is-danger is-small abstandSmall" onclick="decreaseCount(${player}, ${player})"><i class="fas fa-minus"></i></button>    
                            </p>
                        </footer>
                    </div>
                `
                cards.appendChild(card);
            });
        })
    
}
window.onload = createCard();
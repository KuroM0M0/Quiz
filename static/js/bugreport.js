function submitReport() {
    if(document.getElementById("bugReport").value === "") {
        ShowErrorAlert("Fehler", "Bitte gib einen Bug oder einen Vorschlag ein.");
        return;
    }
    addCard();
}

async function addCard() {
    let name = document.getElementById("nameReport").value;
    const text = document.getElementById("bugReport").value;

    if(name === "") {
        name = "Anonym";
    }

    const response = await fetch('/saveCard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, text: text })
    });

    if (response.ok) {
        ShowSuccesAlert("Bug/Vorschlag erfolgreich eingereicht!");
        document.getElementById('nameReport').value = '';
        document.getElementById('bugReport').value = '';
    }
}


async function deleteCard(buttonElement, name, text) {
    if (!confirm("Wirklich löschen?")) return;

    try {
        const response = await fetch('/deleteCard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, text: text })
        });

        if (response.ok) {
            // Wir suchen das oberste Container-Element der Karte und entfernen es
            const cardColumn = buttonElement.closest('.column');
            cardColumn.remove();
            
            if (typeof ShowSuccesAlert === "function") {
                ShowSuccesAlert("Karte entfernt!");
            }
        }
    } catch (error) {
        console.error("Fehler:", error);
    }
}
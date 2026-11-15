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


async function deleteBugReportCard(buttonElement, name, text) {
    const doDelete = async () => {
        try {
            const response = await fetch('/deleteCard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, text: text })
            });

            if (response.ok) {
                // Wir suchen das oberste Container-Element der Karte und entfernen es
                const cardColumn = buttonElement.closest('.column');
                if (cardColumn) cardColumn.remove();
                
                if (typeof ShowSuccesAlert === "function") {
                    ShowSuccesAlert("Karte entfernt!");
                }
            }
        } catch (error) {
            console.error("Fehler:", error);
        }
    };

    if (typeof ShowQuestionAlert === "function") {
        ShowQuestionAlert("Löschen bestätigen", "Möchtest du diese Meldung wirklich löschen?").then((result) => {
            if (result && result.isConfirmed) {
                doDelete();
            }
        });
    } else if (typeof Swal !== "undefined") {
        Swal.fire({
            title: "Löschen bestätigen",
            text: "Möchtest du diese Meldung wirklich löschen?",
            icon: "question",
            confirmButtonText: "Löschen",
            cancelButtonText: "Abbrechen",
            showCancelButton: true,
            theme: "dark"
        }).then((result) => {
            if (result && result.isConfirmed) {
                doDelete();
            }
        });
    }
}
const roomID = "{{ session['roomID'] }}";

function onBuzzerClick() {
    const buzzer = document.getElementById("buzzer");
    buzzer.setAttribute("disabled", true);
    fetch('/buzz', { method: "POST" })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                console.log(`${data.buzzed_by} hat gebuzzert!`);
            } else {
                console.log(`Schon gebuzzert von ${data.buzzed_by}`);
                ShowErrorAlert("Zu Langsam!", `${data.buzzed_by} war wohl schneller als du.`)
            }
        });
}
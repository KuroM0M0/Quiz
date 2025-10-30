function buttonActiveToggle(button) {
    button.classList.toggle('is-active');
}

function onlyFirstBuzz() {
    const firstBuzzButton = document.getElementById('firstBuzz');
    roomID = "{{ session['roomID'] }}";
    if(firstBuzzButton.hasAttribute("class", "is-active")) {
        socket.emit('firstBuzz', {roomID: roomID, firstBuzz: true});
    } else {
        socket.emit('firstBuzz', {roomID: roomID, firstBuzz: false});
    }
    
}
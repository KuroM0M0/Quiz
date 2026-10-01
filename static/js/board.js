const board = {
  name: "",
  version: 1,
  categories: []
} //Version hier ändern, falls sich Struktur ändert 

function addCard(categorieName, cardName, cardIcon) {
  let category = board.categories.find(c => c.name === categoryName);

  if (!category) {
    category = {
            name: categoryName,
            cards: []
        };
        board.categories.push(category);
  }
    category.cards.push(card);
}

function downloadBoard() {

    const json = JSON.stringify(board, null, 4);

    const blob = new Blob([json], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `${board.name}.json`;

    a.click();

    URL.revokeObjectURL(url);

}

const cats=[
  {n:"Zeitreise",   i:"ti-clock-hour-4"},
  {n:"Mathe",       i:"ti-calculator"},
  {n:"Game Dev",    i:"ti-device-gamepad"},
  {n:"Herr der Ringe",i:"ti-diamond"},
  {n:"Pokémon",     i:"ti-pokeball"},
  {n:"Landwirtschaft",   i:"ti-plant"},
  {n:"Sonstiges",   i:"ti-help-circle"}
];

const rows=[
  [
    {i:"ti-mail-fast",  l:"Nachricht"},
    {i:"ti-number-1",   l:"Punkte"},
    {i:"ti-heart",      l:"Herz"},
    {i:"ti-flower",     l:"Garten"},
    {i:"ti-sparkles",   l:"Staub"},
    {i:"ti-gift",       l:"Verpackung"},
    {i:"ti-crown",      l:"Treu"}
  ],
  [
    {i:"ti-repeat",     l:"Schlaufe"},
    {i:"ti-number",     l:"Smart"},
    {i:"ti-coffee",     l:"Kaffee"},
    {i:"ti-cloud",      l:"Rauch"},
    {i:"ti-file",       l:"Blatt"},
    {i:"ti-thermometer",l:"Schweiß"},
    {i:"ti-layout",     l:"Rand"}
  ],
  [
    {i:"ti-phone",      l:"Telefon"},
    {i:"ti-wave-sine",  l:"Strand"},
    {i:"ti-zoom-in",    l:"Lupe"},
    {i:"ti-compass",    l:"Kompass"},
    {i:"ti-shopping-bag",l:"Mode"},
    {i:"ti-shovel",     l:"Boden"},
    {i:"ti-key",        l:"Schlüssel"}
  ],
  [
    {i:"ti-sunrise",    l:"Morgen"},
    {i:"ti-circle",     l:"Leer"},
    {i:"ti-layout-grid",l:"Rohbau"},
    {i:"ti-fish",       l:"Fisch"},
    {i:"ti-yin-yang",   l:"Gegensatz"},
    {i:"ti-bulb",       l:"Leuchten"},
    {i:"ti-bolt",       l:"Blitz"}
  ],
  [
    {i:"ti-leaf",       l:"Schale"},
    {i:"ti-brain",      l:"Auswendig"},
    {i:"ti-grid-dots",  l:"Haut"},
    {i:"ti-barbell",    l:"Last"},
    {i:"ti-ear",        l:"Ohr"},
    {i:"ti-hourglass",  l:"Geduld"},
    {i:"ti-books",      l:"Regal"}
  ]
];

let used=rows.map(r=>r.map(()=>false));

function resetBoard(){
  used=rows.map(r=>r.map(()=>false));
  render();
}

function toggle(r,c){
  used[r][c]=!used[r][c];
  render();
}

function render(){
  const b=document.getElementById('qboard');
  let h='<div class="grid">';
  cats.forEach(c=>{
    h+=`<div class="cat-header"><i class="ti ${c.i}" aria-hidden="true"></i><span>${c.n}</span></div>`;
  });
  h+='</div>';

  rows.forEach((row,ri)=>{
    h+='<div class="grid">';
    row.forEach((card,ci)=>{
      const done=used[ri][ci];
      h+=`<div class="card${done?' done':''}" onclick="toggle(${ri},${ci})">
        <i class="ti ${done?'ti-check':card.i}" aria-hidden="true"></i>
        ${!done?`<span>${card.l}</span>`:''}
      </div>`;
    });
    h+='</div>';
  });

  b.innerHTML=h;
}

render();


function addCategory() {
    ShowAnswerAlert("Neue Kategorie hinzufügen", "text", "Name der Kategorie").then((result) => {
        if (result.isConfirmed) {
            result.value
        }
    })
}


function removeCategory() {
    ShowAnswerAlert("Kategorie entfernen", "text", "Name der Kategorie").then((result) => {
        if (result.isConfirmed) {
            socket.emit("removeCategory", {name: result.value});
        }
    })
}

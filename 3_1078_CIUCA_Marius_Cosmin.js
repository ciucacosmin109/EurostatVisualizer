// Set de date
let dataSet = {
  allowedCountries: [], // formatul din countries.json : tara, nume
  indicatorsExtSources: [], // formatul din indicators.json : indicator, nume, sursa

  jsonData: [], // formatul din eurostat.json : tara, an, indicator, valoare
  currentSource: "Demo", // Daca se intampla o eroare la aducerea datelor de pe eurostat, se vor folosi datele din eurostat.json
};
let lineGraph = {
  currentCountry: "BE", // Tara care este afisata la momentul actual in grafic
  currentIndicator: "PIB", // Indicatorul care este afisat la momentul actual in grafic
  currentData: [], // formatul din eurostat.json : tara(*), an, indicator(*), valoare => e filtrat dupa (*)
};
let indicatorsTable = {
  currentYear: 0, // Anul care este afisat in tabel
  allowedYears: [], // o lista cu anii pentru tabel
};

// Populeaza un dropdown cu date selectate (folosita la incarcarea indicatorilor/tarilor)
// jsonResponse - lista cu obiecte din care se selecteaza atributele 'valueName' si 'optionName'
function update_options(jsonResponse, elementId, valueName, optionName) {
  // Preiau elementul si sterg toti copii (taguri <option>)
  let selectTag = document.getElementById(elementId);
  selectTag.innerHTML = ""; // sterg toate optiunile deja existente

  // Pentru fiecare obiect din fisierul json populez cu taguri <option>
  for (let i = 0; i < jsonResponse.length; i++) {
    let obj = jsonResponse[i];

    // daca valueName sau option name sunt null atunci atribuie direct obiectul care poate fi si numar sau string
    let val = valueName != null ? obj[valueName] : obj;
    let opt = optionName != null ? `(${val}) ` + obj[optionName] : obj;

    // Creez elementul si il adaug la lista de copii
    let el = document.createElement("option");
    el.textContent = opt; // textul afisat utilizatorului
    el.value = val; // valoarea tagului option
    selectTag.appendChild(el);
  }
}

// Functie care returneaza anul maxim comun pentru toti indicatorii
function get_max_common_year(data){
  // Gaseste indicatorii din setul de date
  let indicators = data.map(x => x.indicator);
  indicators = indicators.filter((val, idx, arr) => { 
    return arr.indexOf(val) === idx;
    // daca indexul elementului cautat cu indexOf = indexul elem curent
    // => este primul element de acest tip
    // => returneaza true
  });
 
  // Afla max pt fiecare indicator
  let max = []
  for(let i = 0; i < indicators.length; i++){
    let indData = data.filter(x => x.indicator === indicators[i]); 
    max.push(Math.max(...indData.map( x => x.an )));
  }
  return Math.min(...max);
} 
// Functie care preia tarile/indicatorii din json si face request la eurostat
function load_data() { 
  // Preia tarile si indicatorii din fisierele de pe serverul local
  let promiseC = fetch("media/countries.json").then(res => res.json());
  let promiseI = fetch("media/indicators.json").then(res => res.json());
  Promise.all([promiseC, promiseI]).then(res => {
    countries = res[0];
    indicators = res[1];

    // Salveaza tarile si repopuleaza dropdown-ul cu tari
    dataSet.allowedCountries = countries;
    update_options(countries, "selectCountry", "tara", "nume");

    // Seteaza ca tara initiala valoarea selectata initial din dropdown
    lineGraph.currentCountry = dataSet.allowedCountries[0].tara;

    // Salveaza sursele externe si repopuleaza dropdown-ul cu indicatori
    dataSet.indicatorsExtSources = indicators;
    update_options(indicators, "selectIndicator", "indicator", "nume");

    // Seteaza ca indicator initial valoarea selectata initial din dropdown
    lineGraph.currentIndicator = dataSet.indicatorsExtSources[0].indicator;

    //throw new Error("Demo");

    // 1. Preia datele de la eurostat - face cate un promise pentru fiecare indicator din indicators.json
    let promises = [];
    for (let i = 0; i < indicators.length; i++) {
      promises.push(
        fetch(indicators[i].sursa)
          .then((x) => x.json())
          .then((x) => convert_data(x, indicators[i].indicator))
      );
    }

    // Asteapta sa se rezolve toate promise-urile generate de request-uri
    return Promise.all(promises);
  })
  .then((res) => {
    // Combina listele returnate de Promise.all pentru a avea toti indicatorii in acelasi obiect
    return res.reduce((total, cVal) => {
      // cVal este o lista aferenta indicatorului curent
      return total.concat(cVal);
    }, []); // [] e valoarea initiala
  })
  .then((res) => {
    // Filtreaza rezultatele
    // Elimina tarile care nu sunt relevante - nu se afla printre tarile din cerinta (vezi fisierul countries.json)
    res = res.filter(
      (x) => dataSet.allowedCountries.find((y) => y.tara === x.tara) != null
    ); 

    // Elimina anii redundanti
    let minYear = get_max_common_year(res) - 15;
    res = res.filter( val => val.an > minYear);

    return res;
  })
  .then((res) => {
    // Salveaza datele si actualizeaza interfata
    dataSet.jsonData = res;
    dataSet.currentSource = "Eurostat"; 
    document.getElementById("dataSource").textContent = dataSet.currentSource;

    // Gaseste anii si populeaza dropdown-ul
    indicatorsTable.allowedYears = get_all_years(dataSet.jsonData);
    indicatorsTable.allowedYears = indicatorsTable.allowedYears.filter((val, idx, arr) => idx >= arr.length-15);
    update_options(indicatorsTable.allowedYears, "selectYear", null, null); // Pentru fiecare an adaug un copil la 'selectYear'
    indicatorsTable.currentYear = indicatorsTable.allowedYears[0];

    // Actualizeaza graficul si tabelul cu date initiale
    update_lineGraph();
    update_indicatorsTable(); // Actualizeaza tabelul
  })
  .catch((err) => {
    // daca a esuat ceva, incarca datele demo
    console.log(err);

    // Incarca datele demo
    fetch("media/eurostat.json")
    .then((response) => response.json())
    .then((data) => {
      dataSet.jsonData = data;
      dataSet.jsonData = dataSet.jsonData.filter(
        (x) =>
          dataSet.allowedCountries.find((y) => y.tara === x.tara) != null
      ); // elimina tarile care nu sunt relevante

      dataSet.currentSource = "Demo"; // Adauga 'Demo' la sursa de date
      document.getElementById("dataSource").textContent =
        dataSet.currentSource;

      // Gaseste anii si populeaza dropdown-ul
      indicatorsTable.allowedYears = get_all_years(dataSet.jsonData);
      update_options(indicatorsTable.allowedYears, "selectYear", null, null); // Pentru fiecare an adaug un copil la 'selectYear'
      indicatorsTable.currentYear = indicatorsTable.allowedYears[0];

      // Actualizeaza graficul si tabelul cu date initiale
      update_lineGraph();
      update_indicatorsTable(); // Actualizeaza tabelul
    });
  });
}
// Apelez functia chiar daca pagina nu s-a incarcat
load_data();
// 1. Functie care converteste datele de pe eurostat in formatul din cerinta
function convert_data(esData, indicator) {
  let convertedData = [];

  // Preia numarul de tari si dde ani din setul de date
  let nCountries = esData.size[esData.id.indexOf("geo")];
  let nYears = esData.size[esData.id.indexOf("time")];

  // Datele sunt reprezentate de un tabel cu:
  // nCountries linii si nYears coloane
  for (let i = 0; i < nCountries * nYears; i++) {
    let lineIdx = Math.floor(i / nYears);
    let columnIdx = i % nYears;

    // Gaseste tara cu indexul lineIdx
    let tara = find_county_or_year(
      esData.dimension.geo.category.index,
      lineIdx
    );
    // Gaseste anul cu indexul columnIdx
    let an = find_county_or_year(
      esData.dimension.time.category.index,
      columnIdx
    );
    // Preia valoarea din tabel
    let valoare = esData.value[i];

    let convertedObj = {
      tara: tara,
      an: an,
      indicator: indicator,
      valoare: valoare,
    };

    convertedData = [...convertedData, convertedObj];
  }

  return convertedData;
}
// Transforma din id de linie/col in nume de tara/an conform tabelului eurostat
function find_county_or_year(countryIdxObj, id) {
  let keys = Object.keys(countryIdxObj);

  let j = 0,
  found = false;
  while (j < keys.length && !found) {
    let key = keys[j];
    if (countryIdxObj[key] === id) {
      found = true;
    } else {
      j++;
    }
  }
  return keys[j];
}

// Functii pentru actualizarea graficului
function prepare_data_15(country, indicator, dataList) {
  // Filtreaza datele dupa tara si indicator
  let list = dataList.filter(
    (x) => x.tara === country && x.indicator === indicator
  );
  // Sorteaza dupa an
  list.sort((a, b) => (a.an > b.an ? 1 : -1));
  // Preia ultimele 15 var
  list = list.slice(-15, list.length);

  // Returneaza o lista care are doar tara, indicatorul cautat si doar date pt 15 ani
  // Lista e sortata dupa ani
  return list;
}
function adapt_axes_15_7(dataList) {
  // Gaseste min si max din setul de date
  let valueListOx = dataList.map((x) => x.an);
  let maxOx = Math.max(...valueListOx);
  let minOx = Math.min(...valueListOx);

  // Gaseste min si max din setul de date
  let valueListOy = dataList.map((x) => x.valoare);
  let maxOy = Math.max(...valueListOy);
  let minOy = Math.min(...valueListOy);

  // Adapteaza axele graficului (oy pe 7 niveluri)
  let levels = document.querySelector(".y-labels").children;
  let dif = (maxOy - minOy) / 6; // diferenta care e intre niveluri
  for (let i = 0; i < 7; i++) {
    levels[i].textContent = (maxOy - i * dif).toFixed(dif < 1 ? 1 : 0);
  }
  let years = document.querySelector(".x-labels").children;
  for (let i = 0; i < 15; i++) {
    years[14 - i].textContent = maxOx - i;
  }
}
function plot_data_15(dataList) {
  // Gaseste min si max din setul de date
  let valueListOy = dataList.map((x) => x.valoare);
  let maxOy = Math.max(...valueListOy);
  let minOy = Math.min(...valueListOy);

  // Deseneaza datele
  let values = document.querySelector(".data-points");
  let line = document.querySelector(".data-line");
  let lineZone = document.querySelector(".data-line-zone");
  // acunde linia
  line.style.opacity = "0%";
  // Deseneaza
  console.log(dataList);
  for (let i = 0; i < 15; i++) { 
    let newY =
      500 -
      ((dataList[dataList.length - 15 + i].valoare - minOy) / (maxOy - minOy)) *
        (500 - 50);
    
    values.children[i].setAttributeNS(null, "cy", newY); 
    line.points[i].y = newY;
    lineZone.points[i].y = newY;
  }

  values.style.opacity = "100%";
  setTimeout(() => (line.style.opacity = "100%"), 800);
}
function update(country, indicator, dataList) {
  // Validari
  // Data lista de date e goala, nu mai fa update
  if (dataList == null || dataList.length === 0) {
    return;
  }
  // Data lista de date nu contine indicatorul, nu mai fa update
  if (!dataList.map((x) => x.indicator).includes(indicator)) {
    return;
  }
  // Data lista de date nu contine tara, nu mai fa update
  if (!dataList.map((x) => x.tara).includes(country)) {
    return;
  }
  // Actualizeaza graficul cu functiile definite mai sus
  lineGraph.currentData = prepare_data_15(country, indicator, dataList);
  adapt_axes_15_7(lineGraph.currentData);
  plot_data_15(lineGraph.currentData);
}
function update_lineGraph() {
  update(
    lineGraph.currentCountry,
    lineGraph.currentIndicator,
    dataSet.jsonData
  );
}

// Functii pentru actualizarea tabelului
function get_all_years(dataList) {
  // dataList - formatul din eurostat.json
  // Functia sterge anii duplicati

  // Extrag anii stergand duplicatele
  return dataList
    .map((x) => x.an)
    .filter((val, idx, arr) => {
      return arr.indexOf(val) === idx;
      // daca indexul elementului cautat cu indexOf = indexul elem curent
      // => este primul element de acest tip
      // => returneaza true
    })
    .sort();
}
function get_indicator_value(dataList, country, indicator, year) {
  let res = dataList.find(
    (x) => x.tara === country && x.indicator === indicator && x.an === year
  );

  return res != null && res.valoare != null ? res.valoare : "-";
}
function get_indicator_average(dataList, indicator, year) {
  // Returneaza o lista de obiecte cu media si diferenta maxima de la medie

  // Filtreaza dupa an si indicator
  let list = dataList
    .filter(
      (x) => x.an === year && x.indicator === indicator && x.valoare != null
    )
    .map((x) => x.valoare);

  //validare
  if (list == null || list.length == 0) {
    return 0;
  }

  // returneaza obiectul
  let avg = list.reduce((total, cVal) => total + cVal) / list.length;
  let min = Math.min(...list);
  let max = Math.max(...list);

  let maxDiff = 0;
  if (avg - min > max - avg) {
    maxDiff = avg - min;
  } else {
    maxDiff = max - avg;
  }

  return {
    avg: avg, // media
    maxDiff: maxDiff, // diferenta maxima fata de medie a unui indicator
  };
}
function update_table(dataList, year) {
  // Filtreaza datele dupa an
  let list = dataList.filter((x) => x.an == year);

  // pentru fiecare indicator, gaseste mediile si returneaza-mi o lista cu ele in aceeasi ordine ca indicatorii
  let indicatorsAvg = []; // indicatorsAvg[i].avg ...maxDiff
  for (let i = 0; i < dataSet.indicatorsExtSources.length; i++) {
    let ind = dataSet.indicatorsExtSources[i].indicator;

    indicatorsAvg.push(get_indicator_average(list, ind, year));
  }

  // Sterge continutul tabelului
  let header = document.querySelector("#indicatorsTable thead tr");
  header.innerHTML = "";
  let body = document.querySelector("#indicatorsTable tbody");
  body.innerHTML = "";

  // Construieste header-ul
  let th = document.createElement("th");
  th.textContent = "Tara";
  header.appendChild(th);
  for (let i = 0; i < dataSet.indicatorsExtSources.length; i++) {
    // Adauga toti indicatorii in header-ul tabelului
    th = document.createElement("th");
    th.textContent = dataSet.indicatorsExtSources[i].indicator;
    header.appendChild(th);
  }

  // Pentru fiecare tara, afiseaza afiseaza cate un rand cu valorile
  for (let i = 0; i < dataSet.allowedCountries.length; i++) {
    let country = dataSet.allowedCountries[i]; // country are: tara si nume(*)

    let tr = document.createElement("tr"); // creaza randul

    // creaza td pentru numele tarii
    let td = document.createElement("td");
    td.textContent = country.nume;
    tr.appendChild(td);

    // pentru fiecare indicator creeaza un td
    for (let i = 0; i < dataSet.indicatorsExtSources.length; i++) {
      let ind = dataSet.indicatorsExtSources[i].indicator;

      let value = get_indicator_value(list, country.tara, ind, year);
      td = document.createElement("td");
      td.textContent = value;

      // calculeaza hue din reprezentarea HSL in functie de medie
      let diff = Math.abs(value - indicatorsAvg[i].avg);
      let hue = (diff / indicatorsAvg[i].maxDiff) * 120; // 120 = val max = verde
      hue = 120 - hue; // inversez hue ca sa am culoarea verde pentru valorile apropiate de medie si rosu pentru cele departate de medie

      td.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
      tr.appendChild(td);
    }

    // ataseaza randul la tabel
    body.appendChild(tr);
  }
}
function update_indicatorsTable() {
  // actualizeaza tabelul
  update_table(dataSet.jsonData, indicatorsTable.currentYear);
}

// Dupa ce s-a incarcat pagina ...
window.onload = () => {
  document.getElementById("selectCountry").addEventListener("change", (e) => {
    lineGraph.currentCountry = e.target.value;
    update_lineGraph();
  });
  document.getElementById("selectIndicator").addEventListener("change", (e) => {
    lineGraph.currentIndicator = e.target.value;
    update_lineGraph();
  });
  document.getElementById("selectYear").addEventListener("change", (e) => {
    indicatorsTable.currentYear = e.target.value;
    update_indicatorsTable();
  });

  let toolTip = document.getElementById("lineGraphToolTip");

  // Seteaza tooltip ul pentru coordonatele cursorului
  let svg = document.getElementById("lineGraphSvg");
  let points = document.getElementById("lineGraphPoints").children;
  let lineZone = document.querySelector(".data-line-zone");

  lineZone.addEventListener("mousemove", (e) => {
    // Calculeaza pozitia cursorului in svg
    let svgRect = svg.getBoundingClientRect();
    let xInSvg = e.clientX - svgRect.x;
    let yInSvg = e.clientY - svgRect.y;

    // Transforma xInSvg si yInSvg relativ la atributul viewBox din svg
    let x = (xInSvg / svgRect.width) * svg.viewBox.animVal.width;
    let y = (yInSvg / svgRect.height) * svg.viewBox.animVal.height;

    toolTip.setAttributeNS(null, "x", x);
    toolTip.setAttributeNS(null, "y", y);

    // calculeaza valoarea
    let point = Math.round((x - 190) / 40); // 190 este coordonata primului element iar 40 diferentea intre elemente
    toolTip.textContent = lineGraph.currentData[point].valoare;

    // evidentiaza punctul
    for (let i = 0; i < points.length; i++) {
      if (i != point) {
        points[i].setAttributeNS(null, "r", 6);
      }
    }
    points[point].setAttributeNS(null, "r", 10);
  });
  lineZone.addEventListener(
    "mouseenter",
    (e) => (toolTip.style.opacity = "100%")
  );
  lineZone.addEventListener("mouseleave", (e) => {
    toolTip.style.opacity = "0%";

    // reseteaza dimensiunea punctelor
    for (let i = 0; i < points.length; i++) {
      points[i].setAttributeNS(null, "r", 6);
    }
  });
};

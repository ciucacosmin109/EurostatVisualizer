// Hmm
let dataSet = {
    allowedCountries: [], // formatul din indicators.json : indicator, nume, sursa 
    indicatorsExtSources: [], // formatul din indicators.json : indicator, nume, sursa 
    
    jsonData: [], // formatul din eurostat.json : tara, an, indicator, valoare 
    currentSource: "DEMO",
}
let lineGraph = {     
    currentCountry: "BE",
    currentIndicator: "PIB",   
    currentData: [], // formatul din eurostat.json : tara(*), an, indicator(*), valoare => e filtrat dupa (*) 
}

// Populeaza un dropdown cu date selectate (folosita la incarcarea indicatorilor)
// jsonResponse - formatul din indicators.json
function update_options(jsonResponse, elementId, valueName, optionName){ 
    // Preiau elementul si sterg toti copii (taguri <option>)
    let selectTag = document.getElementById(elementId);
    selectTag.innerHTML = "";

    // Pentru fiecare obiect din fisierul json populez cu taguri <option>
    for(let i = 0; i < jsonResponse.length; i++) {
        let val = jsonResponse[i][valueName];
        let opt = `(${val}) ` + jsonResponse[i][optionName];

        let el = document.createElement("option");
        el.textContent = opt;
        el.value = val;
        selectTag.appendChild(el);
    }
} 

// Preia tarile din countries.json 
fetch('media/countries.json').then(response => response.json()).then(countries => {
    // Salveaza tarile si repopuleaza dropdown-ul cu tari
    dataSet.allowedCountries = countries;
    update_options(countries, "selectCountry", "tara", "nume");
});

// Preia sursele externe pentru indicatori
fetch('media/indicators.json').then(response => response.json()).then(indicators => { 
    // Salveaza sursele externe si repopuleaza dropdown-ul cu indicatori
    dataSet.indicatorsExtSources = indicators;
    update_options(indicators, "selectIndicator", "indicator", "nume"); 

    // 1. Preia datele de la eurostat
    let promises = []
    for (let i = 0; i < indicators.length; i++) { 
        promises.push(
            fetch(indicators[i].sursa)
                .then(x => x.json())
                .then(x => convert_data(x, indicators[i].indicator))
        );
    }
    return Promise.all(promises);

}).then(res => { // Face merge la listele returnate de Promise.all
    dataSet.jsonData = res.reduce((total, cVal) => { // cVal este o lista
        return total.concat(cVal);
    }, []); // [] e valoarea initiala 
    dataSet.currentSource = "Eurostat";
    document.getElementById("dataSource").textContent = dataSet.currentSource;

    update_lineGraph(); // Actualizeaza graficul
    update_year_dropdown(dataSet.jsonData);
    update_table(dataSet.jsonData, 1960)
}).catch(err => { // daca reqest ul esueaza , incarca datele demo 
    // Incarca datele demo
    fetch('media/eurostat.json').then(response => response.json()).then(data => { 
        dataSet.jsonData = data;  
        dataSet.currentSource = "Demo"; // Adauga 'Demo' la sursa de date 
        document.getElementById("dataSource").textContent = dataSet.currentSource;
        
        update_lineGraph(); // Actualizeaza graficul
        update_year_dropdown(dataSet.jsonData);
    }); 
});
// 1. Functie care converteste datele de pe eurostat in formatul din cerinta
function convert_data(esData, indicator){
    let convertedData = [];

    // Preia numarul de tari si dde ani din setul de date
    let nCountries = esData.size[esData.id.indexOf("geo")];
    let nYears = esData.size[esData.id.indexOf("time")];

    // Datele sunt reprezentate de un tabel cu:
    // nCountries linii si nYears coloane
    for(let i = 0; i < nCountries*nYears; i++){
        let lineIdx = Math.floor(i / nYears);
        let columnIdx = i % nYears;

        // Gaseste tara cu indexul lineIdx
        let tara = find_county_or_year(esData.dimension.geo.category.index, lineIdx);
        // Gaseste anul cu indexul columnIdx
        let an = find_county_or_year(esData.dimension.time.category.index, columnIdx);
        // Preia valoarea din tabel
        let valoare = esData.value[i];

        let convertedObj = {
            tara: tara,
            an: an,
            indicator: indicator,
            valoare: valoare
        };
 
        convertedData = [...convertedData, convertedObj]
    }

    return convertedData;
}
// Transforma din id de linie/col in nume de tara/an conform tabelului eurostat
function find_county_or_year(countryIdxObj, id){ 
    let keys = Object.keys(countryIdxObj);
    
    let j = 0, found = false;
    while(j < keys.length && !found){
        let key = keys[j];
        if(countryIdxObj[key] === id){
            found = true;
        }else{
            j++;
        }
    }
    return keys[j]; 
} 



// Functii pentru actualizarea graficului
function prepare_data_15(country, indicator, dataList){ 
    // Filtreaza datele dupa tara si indicator
    let list = dataList.filter(x => x.tara === country && x.indicator === indicator); 
    // Sorteaza dupa an
    list.sort((a, b) => (a.an > b.an) ? 1 : -1);
    // Preia ultimele 15 var
    list = list.slice(-15, list.length); 
    
    // Returneaza o lista care are doar tara, indicatorul cautat si doar date pt 15 ani
    // Lista e sortata dupa ani
    return list;
}
function adapt_axes_15_7(dataList){ 
    // Gaseste min si max din setul de date
    let valueListOx = dataList.map(x => x.an);
    let maxOx = Math.max(...valueListOx);
    let minOx = Math.min(...valueListOx);
    
    // Gaseste min si max din setul de date
    let valueListOy = dataList.map(x => x.valoare);
    let maxOy = Math.max(...valueListOy);
    let minOy = Math.min(...valueListOy);
    
    // Adapteaza axele graficului (oy pe 7 niveluri cum min pe niv 2)
    let levels = document.querySelector(".y-labels").children;   
    let dif = (maxOy - minOy) / 6; // diferenta care e intre niveluri
    for(let i = 0; i < 7; i++) {  
        levels[i].textContent = (maxOy - i * dif).toFixed(dif < 1 ? 1 : 0);
    }
    let years = document.querySelector(".x-labels").children;   
    for(let i = 0; i < 15; i++) {  
        years[14 - i].textContent = maxOx - i;
    }
}
function plot_data_15(dataList){   
    // Gaseste min si max din setul de date
    let valueListOy = dataList.map(x => x.valoare);
    let maxOy = Math.max(...valueListOy);
    let minOy = Math.min(...valueListOy);

    // Deseneaza datele
    let values = document.querySelector(".data-points");  
    let line = document.querySelector(".data-line");  
    let lineZone = document.querySelector(".data-line-zone");  
    // acunde linia 
    line.style.opacity = "0%"; 
    // Deseneaza
    for(let i = 0; i < 15; i++) {  
        let newY = 500 - (dataList[dataList.length - 15 + i].valoare - minOy) / (maxOy-minOy) * (500 - 50);
        values.children[i].cy.baseVal.value = newY;
        line.points[i].y = newY; 
        lineZone.points[i].y = newY; 
    } 
      
    values.style.opacity = "100%"; 
    setTimeout(() => line.style.opacity = "100%", 800);
}
function update(country, indicator, dataList){ 
    // Validari
    // Data lista de date e goala, nu mai fa update 
    if(dataList == null || dataList.length === 0){
        return;
    } 
    // Data lista de date nu contine indicatorul, nu mai fa update 
    if(!dataList.map(x=>x.indicator).includes(indicator)){
        return;
    }
    // Data lista de date nu contine tara, nu mai fa update 
    if(!dataList.map(x=>x.tara).includes(country)){
        return;
    }
    // Actualizeaza graficul cu functiile definite mai sus
    lineGraph.currentData = prepare_data_15(country, indicator, dataList);
    adapt_axes_15_7(lineGraph.currentData);
    plot_data_15(lineGraph.currentData);
}  
function update_lineGraph(){ 
    update(
        lineGraph.currentCountry, 
        lineGraph.currentIndicator, 
        dataSet.jsonData
    );
}



// Functii pentru actualizarea tabelului
function update_year_dropdown(dataList){
    // dataList - formatul din eurostat.json

    // Extrag anii stergand duplicatele
    let uniqueYears = dataList.map(x => x.an).filter((val, idx, arr) => {
        return arr.indexOf(val) === idx;
    }).sort(); 

    // Pentru fiecare an adaug un copil la 'selectYear'
    let years = document.getElementById("selectYear");
    for (let i = 0; i < uniqueYears.length; i++) {
        let y = document.createElement("option");
        y.value = uniqueYears[i];
        y.textContent = uniqueYears[i];
        years.appendChild(y);
    }
}
function update_table(dataList, year){ 
    // Filtreaza datele dupa an
    let list = dataList.filter(x => x.year === year); 
    
    let countries = dataList.map(x => x.tara).filter((val, idx, arr) => {
        return arr.indexOf(val) === idx;
    }).sort();
    console.log(countries);
}



// Dupa ce s-a incarcat pagina ...
window.onload = () => { 

    document.getElementById("selectCountry").addEventListener("change", e => {
        lineGraph.currentCountry = e.target.value;
        update_lineGraph();
    });
    document.getElementById("selectIndicator").addEventListener("change", e => {
        lineGraph.currentIndicator = e.target.value;   
        update_lineGraph();
    });

    let toolTip = document.getElementById("lineGraphToolTip");
 
    // Seteaza tooltip ul pentru coordonatele cursorului
    let svg = document.getElementById("lineGraphSvg");
    let points = document.getElementById("lineGraphPoints").children;
    let lineZone = document.querySelector(".data-line-zone"); 

    lineZone.addEventListener("mousemove", e => { 
        // Calculeaza pozitia cursorului in svg 
        let svgRect = svg.getBoundingClientRect();
        let xInSvg = e.clientX - svgRect.x;
        let yInSvg = e.clientY - svgRect.y; 

        // Transforma xInSvg si yInSvg relativ la atributul viewBox din svg 
        let x = xInSvg / svgRect.width * svg.viewBox.animVal.width;
        let y = yInSvg / svgRect.height * svg.viewBox.animVal.height;

        toolTip.setAttribute("x", x);
        toolTip.setAttribute("y", y); 

        // calculeaza valoarea
        let point = Math.round( (x - 190) / 40 ); // 190 este coordonata primului element iar 40 diferentea intre elemente
        toolTip.textContent = lineGraph.currentData[point].valoare; 

        // evidentiaza punctul
        for (let i = 0; i < points.length; i++) {
            if(i != point){
                points[i].setAttribute("r", 6);
            } 
        }
        points[point].setAttribute("r", 10); 
    }); 
    lineZone.addEventListener("mouseenter", e => toolTip.style.opacity = "100%" );
    lineZone.addEventListener("mouseleave", e => { 
        toolTip.style.opacity = "0%";

        // reseteaza dimensiunea punctelor
        for (let i = 0; i < points.length; i++) { 
            points[i].setAttribute("r", 6); 
        }
    });
}





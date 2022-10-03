import { read, /* writeFileXLSX, utils */ } from "https://cdn.sheetjs.com/xlsx-0.18.7/package/xlsx.mjs";


const mapElement = document.getElementById("map");

let clients = {};   // object containing all clients, with their name in lowercase as the key
let map;   // google map object
let distanceMatrixService;  // object for calculating travel time/distance between waypoints



async function parseSpreadsheet(file) {
    try {       
        // retrieve binary data from excel file
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject('error : cannot read the file');
            reader.readAsBinaryString(file);
        });

        // object containing workbook properties
        const workbook = read(data, {type: 'binary'});

        // object containing sheet properties
        const sheet = workbook.Sheets.Sheet1;

        // the range of cells used in the sheet, should span A-E columns n + 1 rows where n is the number of clients
        const range = sheet['!ref'];

        // clear contents of clients object
        clients = {};

        // fill clients object from sheet object
        for (let i = 2; i <= parseInt(range[range.length - 1]); i++) {
            clients[sheet["A"+i].w.toLowerCase()] = {
                name: sheet["A"+i].w, address: sheet["B"+i].w, birthday: sheet["C"+i].w, cycle: sheet["D"+i].w, notes: sheet["E"+i].w,

                getBirthMonth() {
                    return parseInt(this.birthday.slice(0, 2));
                }
            };
        }

        createMarkers();

    } catch (err) {
        console.log(err);
    }
}

async function getMarkerPositions() {
    const geocoder = new google.maps.Geocoder();
    const latLngBounds = new google.maps.LatLngBounds();
    
    // array of [client, clientPosition]
    var clientPositions = [];
    
    for (let client of Object.values(clients)) {
        var position;
        
        // localStorage address key
        const key = client.address.toLowerCase();

        // if addresss is already cached, retrive the json position object
        if (key in localStorage) {
            position = JSON.parse(localStorage.getItem(key));
        }
        // otherwise, fetch position from geocoder, then cache
        else {
            await geocoder.geocode( { 'address' : client.address }, function( results, status ) {
                if (status != google.maps.GeocoderStatus.OK) {
                    return alert(`The address of ${client.name} could not be identified by Google Maps`);
                }
                position = results[0].geometry.location;
            });
            
            localStorage.setItem(key, JSON.stringify(position));
        }
        
        latLngBounds.extend(position);
        clientPositions.push([client, position]);
    }
    
    // fit map to marker positions
    map.fitBounds(latLngBounds);
    map.setZoom(map.getZoom() - 1);
    
    return clientPositions;
}


function createMarkers() {
    const hoverInfoWindow = new google.maps.InfoWindow();
    const clickInfoWindow = new google.maps.InfoWindow();

    getMarkerPositions().then(
        clientPositions => {
            for (let [client, position] of clientPositions) {
                setTimeout(() => {
                    var marker = new google.maps.Marker( {
                        map: map,
                        position: position,
                        animation: google.maps.Animation.DROP
                    });
                    setMarkerIcon(marker, 'red');
                    
                    google.maps.event.addListener(marker, "mouseover", event => {
                        hoverInfoWindow.setContent('<div class="info-window info-window--hover">' + client.name + '</div>');
                        if (clickInfoWindow.anchor != marker) hoverInfoWindow.open({anchor: marker, map: map, shouldFocus: false});
                    });
            
                    google.maps.event.addListener(marker, "mouseout", event => {
                        hoverInfoWindow.close();
                    });
            
                    google.maps.event.addListener(marker, "click", event => {
                        hoverInfoWindow.close();
                        clickInfoWindow.setContent('<div class="info-window info-window--click">' + client.notes + '</div>');
                        clickInfoWindow.open({anchor: marker, map: map, shouldFocus: false});
                    });
            
                    client.marker = marker;
                }, 500);
            }
        }
    )
}


function setMarkerIcon(marker, color, opacity=0.75, strokeWeight=1, strokeColor="black", filled=false, scale=1.5) {
    var pinSVGHole = "M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z";
    var pinSVGFilled = "M 12,2 C 8.1340068,2 5,5.1340068 5,9 c 0,5.25 7,13 7,13 0,0 7,-7.75 7,-13 0,-3.8659932 -3.134007,-7 -7,-7 z";

    marker.setIcon({
        path: (filled) ? pinSVGFilled : pinSVGHole,
        anchor: new google.maps.Point(12,20),
        fillOpacity: opacity,
        fillColor: color,
        strokeWeight: strokeWeight,
        strokeColor: strokeColor,
        scale: scale
    });
}


function initMap() {
    map = new google.maps.Map(mapElement, {
        center: { lat: 0, lng: 0 },
        zoom: 2
    });
    
    // distanceMatrixService = new google.maps.DistanceMatrixService();

    // distanceMatrixService.getDistanceMatrix(
    //     {
    //       origins: ["apex, nc"],
    //       destinations: ["raleigh, nc"],
    //       travelMode: 'DRIVING',
    //       unitSystem: google.maps.UnitSystem.IMPERIAL
    //     }, (result, status) => {
    //         console.log(result.rows[0].elements[0].duration);
    //     }
    // );

    // add map overlay element to map element
    const mapFileOverlay = document.createElement("div");
    mapFileOverlay.id = "map-file-overlay";
    mapFileOverlay.setAttribute("visible", "true");

    const filePlaceBox = document.createElement("div");
    filePlaceBox.id = "file-place-box";
    filePlaceBox.innerHTML = `
        <img src='images/download.png' alt='file upload icon'>
        <div> 
            <p class='message'>Drag Excel File onto Map <i>or</i> Click Here</p>
            <p class='info'>.xlsx files supported</p>
        </div>
    `;

    const fileInputElement = document.createElement("input");
    fileInputElement.type = "file";
    fileInputElement.onchange = (event) => fileInputHandler(fileInputElement.files[0]);

    filePlaceBox.addEventListener("click", event => {
        fileInputElement.click();
    });

    filePlaceBox.addEventListener("mouseenter", event => {
        filePlaceBox.querySelector(".message").innerHTML = "Drag Excel File onto Map <i>or</i> <strong style='color: white'>Click Here<strong>"
    });

    filePlaceBox.addEventListener("mouseleave", event => {
        filePlaceBox.querySelector(".message").innerHTML = "Drag Excel File onto Map <i>or</i> Click Here"
    });
    mapFileOverlay.appendChild(filePlaceBox);

    mapElement.appendChild(mapFileOverlay);


    mapElement.addEventListener("dragenter", event => {       
        mapElement.setAttribute("fileover", "true");
        filePlaceBox.querySelector(".message").innerHTML = "<strong style='color: white'>Drop Excel File onto Map</strong> <i>or</i> Click Here";

        mapFileOverlay.setAttribute("visible", "true");
    });
    
    mapFileOverlay.addEventListener("dragleave", event => {
        mapElement.setAttribute("fileover", "false");
        filePlaceBox.querySelector(".message").innerHTML = "Drag Excel File onto Map <i>or</i> Click Here";

        if (Object.keys(clients).length > 0) mapFileOverlay.setAttribute("visible", "false");
    });

    mapFileOverlay.addEventListener("drop", event => {
        mapElement.setAttribute("fileover", "false");
        filePlaceBox.querySelector(".message").innerHTML = "Drag Excel File onto Map <i>or</i> Click Here";
    });
}



function fileDragOverHandler(event) {
    event.preventDefault();
}

function fileDropHandler(event) {
    event.preventDefault();
    
    // const file = (event.dataTransfer.items) ? event.dataTransfer.items[0].getItemAsFile() : event.dataTransfer.files[0];
    const file = event.dataTransfer.files[0];
    fileInputHandler(file);
}

function fileInputHandler(file) {
    const mapFileOverlay = document.getElementById("map-file-overlay");
    const filePlaceBox = document.getElementById("file-place-box");
    const infoText = filePlaceBox.querySelector(".info");

    if (file.type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        infoText.innerHTML = "<strong>Success!</strong> Loading waypoints...";
        infoText.classList.add("success");
        mapFileOverlay.style.pointerEvents = "none";

        setTimeout(() => {
            mapFileOverlay.setAttribute("visible", "false");
            infoText.innerHTML = ".xlsx files supported"
            infoText.classList.remove("success");
            mapFileOverlay.style.pointerEvents = "auto";
            parseSpreadsheet(file);
        }, 1000);
    } else {
        infoText.innerHTML = "<strong>Failure</strong> (Invalid File Type)";
        infoText.style.setProperty("color", "darkred");
    }
}



window.initMap = initMap;
mapElement.ondragover = fileDragOverHandler;
mapElement.ondrop = fileDropHandler;

document.getElementById("file-button").addEventListener("click", event => {
    const mapFileOverlay = document.getElementById("map-file-overlay");
    mapFileOverlay.setAttribute("visible", (mapFileOverlay.getAttribute("visible") == "true") ? (Object.keys(clients).length > 0) ? "false" : "true" : "true");
});

document.querySelector("#side-panel-container .handle").addEventListener("click", event => {
    const sidePanel = document.getElementById("side-panel");
    if (sidePanel.classList.contains('hidden')) sidePanel.classList.remove('hidden');
    else sidePanel.classList.add('hidden');
});

document.addEventListener("dragover", event => event.preventDefault());
document.addEventListener("drop", event => event.preventDefault());

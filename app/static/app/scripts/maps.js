/* eslint @typescript-eslint/no-unused-vars: "off" */
let KEYS = JSON.parse(document.getElementById("api-keys").textContent);

let mapsResolve = null;
let mapsPromise = new Promise(resolve => mapsResolve = resolve);

function promiseMapsAPI() {
  let srcElem = document.getElementById("maps-api");
  if (!srcElem) {
    srcElem = document.createElement("script");
    srcElem.setAttribute("id", "maps-api");
    srcElem.setAttribute("type", "text/javascript");
    srcElem.setAttribute("src", `https://maps.googleapis.com/maps/api/js?key=${KEYS.MAPS}&callback=mapsAPICallback`);
    document.head.appendChild(srcElem);
  }
  return mapsPromise;
}

function mapsAPICallback() {
  mapsResolve();
}

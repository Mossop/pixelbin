/* global cast */
window.__onGCastApiAvailable = function (isAvailable) {
  if (isAvailable) {
    cast.framework.CastContext.getInstance().setOptions({
      receiverApplicationId: "C0F164FC",
    });

    castState = true;

    document.dispatchEvent(new CustomEvent("cast-available"));
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var castState = false;

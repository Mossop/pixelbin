/* global cast, chrome */
window.__onGCastApiAvailable = function (isAvailable) {
  if (isAvailable) {
    let receiverApplicationId =
      document.location.hostname == "localhost"
        ? chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
        : "C0F164FC";

    cast.framework.CastContext.getInstance().setOptions({
      receiverApplicationId,
    });

    castState = true;

    document.dispatchEvent(new CustomEvent("cast-available"));
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var castState = false;

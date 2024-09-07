import type { Map } from "leaflet";

import { useCallback, useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

export default function MapComponent({
  longitude = null,
  latitude = null,
  altitude = null,
}: {
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
}) {
  let [map, setMap] = useState<Map | null>(null);
  let [ready, setReady] = useState(false);

  let isReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (map && ready) {
      map.invalidateSize();
    }
  }, [map, ready]);

  if (longitude === null || latitude === null) {
    return null;
  }

  let latlng = { lat: latitude, lng: longitude, alt: altitude ?? undefined };

  return (
    // eslint-disable-next-line jsx-a11y/control-has-associated-label
    <a
      target="_blank"
      href={`https://www.openstreetmap.org/#map=15/${latitude}/${longitude}`}
      rel="noreferrer"
    >
      <MapContainer
        center={latlng}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
        ref={setMap}
        whenReady={isReady}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={latlng} />
      </MapContainer>
    </a>
  );
}

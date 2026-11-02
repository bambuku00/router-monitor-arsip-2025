"use client";

import { coorJakartaArr } from "@/lib/utils";
import { Feature, Map, MapBrowserEvent, View } from "ol";
import SearchPhoton from "ol-ext/control/SearchPhoton";
import "ol-ext/dist/ol-ext.css";
import { Coordinate } from "ol/coordinate";
import { Point } from "ol/geom";
import { Vector as VectorLayer } from "ol/layer";
import TileLayer from "ol/layer/Tile";
import "ol/ol.css";
import { fromLonLat, toLonLat } from "ol/proj";
import { Vector as VectorSource } from "ol/source";
import OSM from "ol/source/OSM";
import { Icon, Style } from "ol/style";
import { useEffect, useRef } from "react";
import ReactDOMServer from "react-dom/server";
import { FaMapMarkerAlt } from "react-icons/fa";

type MapsProps = {
  zoom?: number;
  initCenter?: [number, number] | Coordinate;
  onClickMap?: (longlat: [number, number]) => void | Promise<void>;
  markerCoordinates?: [number, number] | null;
};
export default function Maps({
  zoom,
  initCenter,
  onClickMap,
  markerCoordinates,
}: MapsProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const mapInstanceRef = useRef<Map | null>(null);

  useEffect(() => {
    const map = new Map({
      target: mapRef.current as HTMLDivElement,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: vectorSourceRef.current,
        }),
      ],
      view: new View({
        center: fromLonLat(initCenter || coorJakartaArr),
        zoom: zoom || 11,
      }),
    });
    const search = new SearchPhoton({
      //target: $(".options").get(0),
      lang: "en", // Force preferred language
      reverse: true,
      position: true, // Search, with priority to geo position
    });
    map.addControl(search);

    mapInstanceRef.current = map;

    search.on("select", function (e) {
      // console.log(e);
      map.getView().animate({
        center: e.coordinate,
        zoom: Math.max(map.getView().getZoom()!, 16),
      });
    });
    map.on("click", (event: MapBrowserEvent<UIEvent>) => {
      const coordinates = event.coordinate;
      addMarker(coordinates);

      const parsedCoordinates = toLonLat(event.coordinate) as [number, number];
      onClickMap && onClickMap(parsedCoordinates);
    });

    return () => map.setTarget(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once; initCenter/zoom/onClickMap applied via refs or second effect
  }, []);

  useEffect(() => {
    if (markerCoordinates) {
      const coordinates = fromLonLat(markerCoordinates);
      mapInstanceRef.current?.getView().setCenter(coordinates);
      addMarker(coordinates);
    } else {
      vectorSourceRef.current.clear();
    }
  }, [markerCoordinates]);

  const addMarker = (coordinates: Coordinate) => {
    vectorSourceRef.current.clear();
    const marker = new Feature({
      geometry: new Point(coordinates),
    });

    const iconHtml = ReactDOMServer.renderToString(
      <FaMapMarkerAlt
        style={{ color: "rgb(239 68 68)", fontSize: "36px" }}
        className="text-red"
      />
    );
    const svgElement = new Blob([iconHtml], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgElement);

    const img = new Image();
    img.onload = () => {
      marker.setStyle(
        new Style({
          image: new Icon({
            img: img,
            scale: 1,
            anchor: [0.5, 1],
          }),
        })
      );
      vectorSourceRef.current.addFeature(marker);
    };
    img.src = url;
  };

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        overflow: "hidden",
      }}
    />
  );
}

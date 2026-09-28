import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import {
  MaplibreTerradrawControl,
} from "@watergis/maplibre-gl-terradraw";
import * as d3 from "d3";

import "maplibre-gl/dist/maplibre-gl.css";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

const BASE =
  "https://raw.githubusercontent.com/ntouati/webmapping/main/data/";

const DATASETS = [
  {
    id: "stations-meteo-en-place",
    label: "Stations météo en place",
    url: BASE + "stations-meteo-en-place.geojson",
    color: "#0d9488",
    opacity: 0.35,
    width: 0.8,
  },
  {
    id: "LCZ_cerema",
    label: "LCZ Cerema",
    url: BASE + "LCZ_cerema.geojson",
    color: "#4f46e5",
    opacity: 0.2,
    width: 2,
  },
];

function drawStationChart(data) {
  const container = d3.select("#station-chart");

  container.selectAll("*").remove();

  if (data.length === 0) {
    container
      .append("p")
      .text("Aucune donnée disponible.");

    return;
  }

  const grouped = d3.rollup(
    data,
    (values) => values.length,
    (d) => d.lcz,
    (d) => d.type_stati
  );

  const lczs = Array.from(grouped.keys())
    .sort((a, b) => a - b)
    .map(String);

  const stationTypes = Array.from(
    new Set(data.map((d) => d.type_stati))
  ).sort();

  const rows = lczs.flatMap((lcz) => {
    const lczNumber = Number(lcz);

    return stationTypes.map((type) => ({
      lcz,
      type,
      count:
        grouped
          .get(lczNumber)
          ?.get(type) ?? 0,
    }));
  });

  const width = 380;
  const height = 280;

  const margin = {
    top: 20,
    right: 20,
    bottom: 50,
    left: 45,
  };

  const innerWidth =
    width - margin.left - margin.right;

  const innerHeight =
    height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      "Nombre de stations par LCZ et type de station"
    );

  const chart = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left},${margin.top})`
    );

  const x0 = d3
    .scaleBand()
    .domain(lczs)
    .range([0, innerWidth])
    .padding(0.2);

  const x1 = d3
    .scaleBand()
    .domain(stationTypes)
    .range([0, x0.bandwidth()])
    .padding(0.05);

  const maxCount =
    d3.max(rows, (d) => d.count) ?? 1;

  const y = d3
    .scaleLinear()
    .domain([0, maxCount])
    .nice()
    .range([innerHeight, 0]);

  const color = d3
    .scaleOrdinal()
    .domain(stationTypes)
    .range(d3.schemeTableau10);

  chart
    .append("g")
    .attr(
      "transform",
      `translate(0,${innerHeight})`
    )
    .call(d3.axisBottom(x0))
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", 40)
    .attr("fill", "currentColor")
    .attr("text-anchor", "middle")
    .text("LCZ");

  chart
    .append("g")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d3.format("d"))
    );

  chart
    .selectAll(".station-bar")
    .data(rows.filter((d) => d.count > 0))
    .join("rect")
    .attr("class", "station-bar")
    .attr(
      "x",
      (d) =>
        (x0(d.lcz) ?? 0) +
        (x1(d.type) ?? 0)
    )
    .attr("y", (d) => y(d.count))
    .attr("width", x1.bandwidth())
    .attr(
      "height",
      (d) => innerHeight - y(d.count)
    )
    .attr("fill", (d) => color(d.type))
    .append("title")
    .text(
      (d) =>
        `LCZ ${d.lcz} — ${d.type} : ${d.count} station(s)`
    );

  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left},${height - 15})`
    );

  stationTypes.forEach((type, index) => {
    const item = legend
      .append("g")
      .attr(
        "transform",
        `translate(${index * 100},0)`
      );

    item
      .append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", color(type));

    item
      .append("text")
      .attr("x", 15)
      .attr("y", 10)
      .attr("font-size", 10)
      .text(type);
  });
}

function App() {
  const mapContainer = useRef(null);

  useEffect(() => {
    const dashboard = document.getElementById(
      "dashboard-content"
    );

    const layersPanel =
      document.getElementById("layers");

    if (!dashboard || !layersPanel) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [1.43, 43.60],
      zoom: 11,
    });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 150,
        unit: "metric",
      }),
      "bottom-left"
    );

    const draw =
      new MaplibreTerradrawControl({
        modes: [
          "render",
          "point",
          "linestring",
          "polygon",
          "rectangle",
          "circle",
          "freehand",
          "delete",
        ],
        open: false,
      });

    map.addControl(draw, "top-right");

    async function addDataset(dataset) {
      const response = await fetch(dataset.url);

      if (!response.ok) {
        throw new Error(
          `Impossible de charger ${dataset.url}`
        );
      }

      const geojson = await response.json();
    
      console.log("GeoJSON chargé :", dataset.id);
      console.log("Nombre de features :", geojson.features?.length);
      console.log(
        "Géométrie :",
        geojson.features?.[0]?.geometry?.type
      );

      const sourceId = `${dataset.id}-source`;

      map.addSource(sourceId, {
        type: "geojson",
        data: geojson,
      });

      const firstGeometry =
        geojson.features?.[0]?.geometry?.type;

      let layerIds = [];

      if (
        firstGeometry === "Polygon" ||
        firstGeometry === "MultiPolygon"
      ) {
        const fillId = `${dataset.id}-fill`;
        const lineId = `${dataset.id}-line`;

        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": dataset.color,
            "fill-opacity": dataset.opacity,
          },
        });

        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": dataset.color,
            "line-opacity": 1,
            "line-width": dataset.width,
          },
        });

        layerIds = [fillId, lineId];
      }

      if (
        firstGeometry === "LineString" ||
        firstGeometry === "MultiLineString"
      ) {
        const lineId = `${dataset.id}-line`;

        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": dataset.color,
            "line-opacity": dataset.opacity,
            "line-width": dataset.width,
          },
        });

        layerIds = [lineId];
      }

      if (
        firstGeometry === "Point" ||
        firstGeometry === "MultiPoint"
      ) {
        const pointId = `${dataset.id}-points`;

        map.addLayer({
          id: pointId,
          type: "circle",
          source: sourceId,
          paint: {
           "circle-color": "#ff0000",
           "circle-opacity": 1,
           "circle-radius": 8,
           "circle-stroke-color": "#ffffff",
           "circle-stroke-width": 1,
          },
        });

        layerIds = [pointId];
        console.log(
          "Couche de points créée :",
          pointId
        );

        map.on("click", pointId, (e) => {
          const feature = e.features?.[0];

          if (!feature) {
            return;
          }

          const properties =
            feature.properties;

          if (!properties) {
            return;
          }

          dashboard.innerHTML = `
            <h2>${dataset.label}</h2>

            ${Object.entries(properties)
              .filter(
                ([, value]) =>
                  value !== null &&
                  value !== undefined &&
                  value !== ""
              )
              .map(
                ([key, value]) => `
                  <div class="dashboard-property">
                    <strong>${key}</strong> :
                    ${value}
                  </div>
                `
              )
              .join("")}
          `;

          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="station-popup">
                <h3>${dataset.label}</h3>

                <p>
                  <strong>
                    ${properties.id_nom ?? ""}
                  </strong>
                </p>
              </div>
            `)
            .addTo(map);
        });

        map.on("mouseenter", pointId, () => {
          map.getCanvas().style.cursor =
            "pointer";
        });

        map.on("mouseleave", pointId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      const layerControl =
        document.createElement("div");

      layerControl.className =
        "layer-control";

      layerControl.innerHTML = `
        <label>
          <input
            type="checkbox"
            checked
            class="layer-visibility"
          />
          ${dataset.label}
        </label>

        <label>
          Couleur
          <input
            type="color"
            value="${dataset.color}"
            class="layer-color"
          />
        </label>

        <label>
          Opacité
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value="${dataset.opacity}"
            class="layer-opacity"
          />
        </label>
      `;

      layersPanel.appendChild(layerControl);

      const visibilityInput =
        layerControl.querySelector(
          ".layer-visibility"
        );

      const colorInput =
        layerControl.querySelector(
          ".layer-color"
        );

      const opacityInput =
        layerControl.querySelector(
          ".layer-opacity"
        );

      visibilityInput.addEventListener(
        "change",
        () => {
          const visibility =
            visibilityInput.checked
              ? "visible"
              : "none";

          layerIds.forEach((layerId) => {
            map.setLayoutProperty(
              layerId,
              "visibility",
              visibility
            );
          });
        }
      );

      colorInput.addEventListener(
        "input",
        () => {
          const color = colorInput.value;

          layerIds.forEach((layerId) => {
            const layer =
              map.getLayer(layerId);

            if (!layer) {
              return;
            }

            if (layer.type === "fill") {
              map.setPaintProperty(
                layerId,
                "fill-color",
                color
              );
            }

            if (layer.type === "line") {
              map.setPaintProperty(
                layerId,
                "line-color",
                color
              );
            }

            if (layer.type === "circle") {
              map.setPaintProperty(
                layerId,
                "circle-color",
                color
              );
            }
          });
        }
      );

      opacityInput.addEventListener(
        "input",
        () => {
          const opacity =
            Number(opacityInput.value);

          layerIds.forEach((layerId) => {
            const layer =
              map.getLayer(layerId);

            if (!layer) {
              return;
            }

            if (layer.type === "fill") {
              map.setPaintProperty(
                layerId,
                "fill-opacity",
                opacity
              );
            }

            if (layer.type === "line") {
              map.setPaintProperty(
                layerId,
                "line-opacity",
                opacity
              );
            }

            if (layer.type === "circle") {
              map.setPaintProperty(
                layerId,
                "circle-opacity",
                opacity
              );
            }
          });
        }
      );

      if (
        dataset.id ===
        "stations-meteo-en-place"
      ) {
        const stations = geojson.features
          .map((feature) => ({
            type_stati: String(
              feature.properties
                ?.type_stati ?? "Inconnu"
            ),
            lcz: Number(
              feature.properties?.lcz
            ),
          }))
          .filter((station) =>
            Number.isFinite(station.lcz)
          );

        drawStationChart(stations);
      }
    }

    map.on("load", async () => {
      try {
        for (const dataset of DATASETS) {
          await addDataset(dataset);
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des données :",
          error
        );
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <>
      <div
        id="map"
        ref={mapContainer}
      />

      <aside id="panel">
        <h2>Couches</h2>
        <div id="layers" />
      </aside>

      <aside id="dashboard">
        <h2>Stations météo</h2>

        <div id="dashboard-content">
          Cliquez sur une station pour afficher
          ses informations.
        </div>

        <div id="station-chart" />
      </aside>
    </>
  );
}

export default App;

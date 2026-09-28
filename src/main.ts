import * as maplibregl from "maplibre-gl";
import {
  MaplibreTerradrawControl,
} from "@watergis/maplibre-gl-terradraw";
import * as d3 from "d3";

import "maplibre-gl/dist/maplibre-gl.css";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";
import "./style.css";

interface DatasetConfig {
  id: string;
  label: string;
  url: string;
  color: string;
  opacity: number;
  width: number;
}

interface StationChartData {
  type_stati: string;
  lcz: number;
}

const BASE =
  "https://raw.githubusercontent.com/ntouati/webmapping/main/data/";

const DATASETS: DatasetConfig[] = [
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

/* ============================================================
   MAP
   ============================================================ */

const map = new maplibregl.Map({
  container: "map",

  style: {
    version: 8,

    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
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

/* ============================================================
   CONTROLES MAPLIBRE
   ============================================================ */

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

/* ============================================================
   TERRADRAW
   ============================================================ */

const draw = new MaplibreTerradrawControl({
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

/* ============================================================
   PANELS
   ============================================================ */

const layersPanel =
  document.getElementById("layers");

if (!layersPanel) {
  throw new Error(
    "Élément #layers introuvable dans index.html"
  );
}

const dashboard =
  document.getElementById("dashboard-content");

if (!dashboard) {
  throw new Error(
    "Élément #dashboard-content introuvable dans index.html"
  );
}

/* ============================================================
   GRAPHIQUE D3
   ============================================================ */

function drawStationChart(
  data: StationChartData[]
) {
  const container =
    d3.select("#station-chart");

  container.selectAll("*").remove();

  if (data.length === 0) {
    container
      .append("p")
      .text("Aucune donnée disponible.");

    return;
  }

  /*
   * Regroupement :
   *
   * LCZ
   *   └── type de station
   *          └── nombre de stations
   */
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
    new Set(
      data.map((d) => d.type_stati)
    )
  ).sort();

  /*
   * Transformation en lignes utilisables
   * par D3.
   */
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

  /* Dimensions */

  const width = 380;
  const height = 280;

  const margin = {
    top: 20,
    right: 20,
    bottom: 50,
    left: 45,
  };

  const innerWidth =
    width -
    margin.left -
    margin.right;

  const innerHeight =
    height -
    margin.top -
    margin.bottom;

  /* SVG */

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

  /* Échelle X : LCZ */

  const x0 = d3
    .scaleBand<string>()
    .domain(lczs)
    .range([0, innerWidth])
    .padding(0.2);

  /* Échelle X secondaire : type de station */

  const x1 = d3
    .scaleBand<string>()
    .domain(stationTypes)
    .range([0, x0.bandwidth()])
    .padding(0.05);

  /* Échelle Y */

  const maxCount =
    d3.max(rows, (d) => d.count) ?? 1;

  const y = d3
    .scaleLinear()
    .domain([0, maxCount])
    .nice()
    .range([innerHeight, 0]);

  /* Couleurs des types */

  const color = d3
    .scaleOrdinal<string>()
    .domain(stationTypes)
    .range(d3.schemeTableau10);

  /* Axe X */

  chart
    .append("g")
    .attr(
      "transform",
      `translate(0,${innerHeight})`
    )
    .call(
      d3.axisBottom(x0)
    )
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", 40)
    .attr("fill", "currentColor")
    .attr("text-anchor", "middle")
    .text("LCZ");

  /* Axe Y */

  chart
    .append("g")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d3.format("d"))
    );

  /*
   * Barres
   */

  chart
    .selectAll(".station-bar")
    .data(
      rows.filter(
        (d) => d.count > 0
      )
    )
    .join("rect")
    .attr("class", "station-bar")
    .attr(
      "x",
      (d) =>
        (x0(d.lcz) ?? 0) +
        (x1(d.type) ?? 0)
    )
    .attr(
      "y",
      (d) => y(d.count)
    )
    .attr(
      "width",
      x1.bandwidth()
    )
    .attr(
      "height",
      (d) =>
        innerHeight - y(d.count)
    )
    .attr(
      "fill",
      (d) => color(d.type)
    )
    .append("title")
    .text(
      (d) =>
        `LCZ ${d.lcz} — ${d.type} : ${d.count} station(s)`
    );

  /*
   * Légende
   */

  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left},${height - 15})`
    );

  stationTypes.forEach(
    (type, index) => {
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
        .attr(
          "fill",
          color(type)
        );

      item
        .append("text")
        .attr("x", 15)
        .attr("y", 10)
        .attr("font-size", 10)
        .text(type);
    }
  );
}

/* ============================================================
   CHARGEMENT DES COUCHES
   ============================================================ */

async function addDataset(
  dataset: DatasetConfig
) {
  try {
    const response = await fetch(
      dataset.url
    );

    if (!response.ok) {
      throw new Error(
        `Impossible de charger ${dataset.url} (${response.status})`
      );
    }

    const geojson = await response.json();

    console.log(
      `Données chargées : ${dataset.label}`,
      geojson
    );

    const sourceId =
      `${dataset.id}-source`;

    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });

    const geometryType =
      geojson.features?.[0]?.geometry?.type;

    console.log(
      `${dataset.label} → géométrie :`,
      geometryType
    );

    const fillId =
      `${dataset.id}-fill`;

    const lineId =
      `${dataset.id}-line`;

    const pointId =
      `${dataset.id}-point`;

    /* ========================================================
       POLYGONES
       ======================================================== */

    if (
      geometryType === "Polygon" ||
      geometryType === "MultiPolygon"
    ) {
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,

        paint: {
          "fill-color":
            dataset.color,

          "fill-opacity":
            dataset.opacity,
        },
      });

      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,

        paint: {
          "line-color":
            dataset.color,

          "line-width":
            dataset.width,

          "line-opacity": 1,
        },
      });
    }

    /* ========================================================
       LIGNES
       ======================================================== */

    else if (
      geometryType === "LineString" ||
      geometryType === "MultiLineString"
    ) {
      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,

        paint: {
          "line-color":
            dataset.color,

          "line-width":
            dataset.width,

          "line-opacity": 1,
        },
      });
    }

    /* ========================================================
       POINTS — STATIONS MÉTÉO
       ======================================================== */

    else if (
      geometryType === "Point" ||
      geometryType === "MultiPoint"
    ) {
      /*
       * Les stations restent visibles comme
       * des points sur la carte.
       */
      map.addLayer({
        id: pointId,
        type: "circle",
        source: sourceId,

        paint: {
          "circle-color":
            dataset.color,

          "circle-opacity": 0.8,

          "circle-radius": 6,

          "circle-stroke-color":
            "#ffffff",

          "circle-stroke-width": 1,
        },
      });

      /*
       * Clic sur une station.
       */
      map.on(
        "click",
        pointId,
        (e) => {
          const feature =
            e.features?.[0];

          if (!feature) {
            return;
          }

          const properties =
            feature.properties;

          if (!properties) {
            return;
          }

          /*
           * Mise à jour du dashboard.
           */
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

          /*
           * Popup sur la carte.
           */
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
        }
      );

      /*
       * Curseur au survol.
       */
      map.on(
        "mouseenter",
        pointId,
        () => {
          map.getCanvas()
            .style.cursor =
            "pointer";
        }
      );

      map.on(
        "mouseleave",
        pointId,
        () => {
          map.getCanvas()
            .style.cursor = "";
        }
      );

      /*
       * ======================================================
       * DONNÉES POUR LE GRAPHIQUE
       * ======================================================
       *
       * On utilise :
       * - type_stati = type de station
       * - lcz = classe LCZ
       */
      if (
        dataset.id ===
        "stations-meteo-en-place"
      ) {
        const stations: StationChartData[] =
          geojson.features
            .map(
              (feature: any) => ({
                type_stati: String(
                  feature.properties
                    ?.type_stati ??
                    "Inconnu"
                ),

                lcz: Number(
                  feature.properties?.lcz
                ),
              })
            )
            .filter(
              (
                station: StationChartData
              ) =>
                Number.isFinite(
                  station.lcz
                )
            );

        console.log(
          "Données stations pour D3 :",
          stations
        );

        drawStationChart(
          stations
        );
      }
    }

    /* ========================================================
       CONTRÔLE DE COUCHE
       ======================================================== */

    const item =
      document.createElement("div");

    item.className =
      "layer-item";

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      dataset.label;

    /* Visibilité */

    const visibility =
      document.createElement(
        "input"
      );

    visibility.type =
      "checkbox";

    visibility.checked =
      true;

    visibility.onchange =
      () => {
        const value =
          visibility.checked
            ? "visible"
            : "none";

        if (
          map.getLayer(fillId)
        ) {
          map.setLayoutProperty(
            fillId,
            "visibility",
            value
          );
        }

        if (
          map.getLayer(lineId)
        ) {
          map.setLayoutProperty(
            lineId,
            "visibility",
            value
          );
        }

        if (
          map.getLayer(pointId)
        ) {
          map.setLayoutProperty(
            pointId,
            "visibility",
            value
          );
        }
      };

    /* Couleur */

    const color =
      document.createElement(
        "input"
      );

    color.type =
      "color";

    color.value =
      dataset.color;

    color.oninput =
      () => {
        const value =
          color.value;

        if (
          map.getLayer(fillId)
        ) {
          map.setPaintProperty(
            fillId,
            "fill-color",
            value
          );
        }

        if (
          map.getLayer(lineId)
        ) {
          map.setPaintProperty(
            lineId,
            "line-color",
            value
          );
        }

        if (
          map.getLayer(pointId)
        ) {
          map.setPaintProperty(
            pointId,
            "circle-color",
            value
          );
        }
      };

    /* Opacité */

    const opacity =
      document.createElement(
        "input"
      );

    opacity.type =
      "range";

    opacity.min =
      "0";

    opacity.max =
      "1";

    opacity.step =
      "0.05";

    opacity.value =
      String(
        dataset.opacity
      );

    opacity.oninput =
      () => {
        const value =
          Number(
            opacity.value
          );

        if (
          map.getLayer(fillId)
        ) {
          map.setPaintProperty(
            fillId,
            "fill-opacity",
            value
          );
        }

        if (
          map.getLayer(lineId)
        ) {
          map.setPaintProperty(
            lineId,
            "line-opacity",
            value
          );
        }

        if (
          map.getLayer(pointId)
        ) {
          map.setPaintProperty(
            pointId,
            "circle-opacity",
            value
          );
        }
      };

    item.appendChild(
      title
    );

    item.appendChild(
      visibility
    );

    item.appendChild(
      color
    );

    item.appendChild(
      opacity
    );

    layersPanel.appendChild(
      item
    );
  } catch (error) {
    console.error(
      `Erreur lors du chargement de ${dataset.label}:`,
      error
    );
  }
}

/* ============================================================
   CHARGEMENT INITIAL
   ============================================================ */

map.on(
  "load",
  async () => {
    for (
      const dataset of DATASETS
    ) {
      await addDataset(
        dataset
      );
    }
  }
);
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import * as d3 from "d3";

import "maplibre-gl/dist/maplibre-gl.css";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

const BASE =
  "https://raw.githubusercontent.com/ntouati/webmapping/main/data/";

const DATASETS = [
  {
    id: "stations-meteo-en-place",
    name: "Stations météo",
    url: `${BASE}stations-meteo-en-place.geojson`,
    color: "#0d9488",
    opacity: 0.35,
    width: 0.8,
  },
  {
    id: "LCZ_cerema",
    name: "LCZ",
    url: `${BASE}LCZ_cerema.geojson`,
    color: "#4f46e5",
    opacity: 0.2,
    width: 2,
  },
];

const PALETTES = {
  viridis: ["#440154", "#31688e", "#35b779", "#fde725"],
  plasma: ["#0d0887", "#9c179e", "#ed7953", "#f0f921"],
  inferno: ["#000004", "#781c6d", "#ed6925", "#fcffa4"],
  magma: ["#000004", "#721f81", "#f1605d", "#fcfdbf"],
  turbo: ["#30123b", "#2c7bb6", "#a6d96a", "#d7191c"],
};

function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const chartRef = useRef(null);

  const [station, setStation] = useState(null);
  const [variable, setVariable] = useState("temperature");
  const [palette, setPalette] = useState("viridis");

  const [visibility, setVisibility] = useState({
    "stations-meteo-en-place": true,
    LCZ_cerema: true,
  });

  const [opacity, setOpacity] = useState({
    "stations-meteo-en-place": 0.8,
    LCZ_cerema: 0.2,
  });

  useEffect(() => {
    if (!mapContainer.current) return;

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

    mapRef.current = map;

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

    map.addControl(draw, "top-left");

    map.on("load", async () => {
      for (const dataset of DATASETS) {
        try {
          const response = await fetch(dataset.url);

          if (!response.ok) {
            throw new Error(
              `Erreur HTTP ${response.status}`
            );
          }

          const geojson = await response.json();

          console.log(
            "GeoJSON chargé :",
            dataset.id,
            geojson.features?.length
          );

          const sourceId = `${dataset.id}-source`;

          map.addSource(sourceId, {
            type: "geojson",
            data: geojson,
          });

          const geometry =
            geojson.features?.[0]?.geometry?.type;

          if (
            geometry === "Polygon" ||
            geometry === "MultiPolygon"
          ) {
            map.addLayer({
              id: `${dataset.id}-fill`,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": dataset.color,
                "fill-opacity": dataset.opacity,
              },
            });

            map.addLayer({
              id: `${dataset.id}-line`,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": dataset.color,
                "line-width": dataset.width,
              },
            });
          }

          if (
            geometry === "LineString" ||
            geometry === "MultiLineString"
          ) {
            map.addLayer({
              id: `${dataset.id}-line`,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": dataset.color,
                "line-width": dataset.width,
                "line-opacity": dataset.opacity,
              },
            });
          }

          if (
            geometry === "Point" ||
            geometry === "MultiPoint"
          ) {
            const pointId = `${dataset.id}-points`;

            map.addLayer({
              id: pointId,
              type: "circle",
              source: sourceId,
              paint: {
                "circle-color": dataset.color,
                "circle-opacity": 0.9,
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
              },
            });

            map.on("click", pointId, (event) => {
              const feature = event.features?.[0];

              if (!feature) return;

              setStation(feature.properties);

              const coordinates =
                feature.geometry.coordinates.slice();

              new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                  <strong>
                    ${feature.properties?.id_nom || "Station météo"}
                  </strong>
                  <br>
                  Ville :
                  ${feature.properties?.ville || "—"}
                  <br>
                  Altitude :
                  ${feature.properties?.altitude ?? "—"} m
                `)
                .addTo(map);
            });

            map.on("mouseenter", pointId, () => {
              map.getCanvas().style.cursor = "pointer";
            });

            map.on("mouseleave", pointId, () => {
              map.getCanvas().style.cursor = "";
            });
          }
        } catch (error) {
          console.error(
            "Erreur de chargement :",
            dataset.id,
            error
          );
        }
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  function updateVisibility(datasetId, checked) {
    const map = mapRef.current;

    setVisibility((old) => ({
      ...old,
      [datasetId]: checked,
    }));

    if (!map) return;

    const possibleLayers = [
      `${datasetId}-fill`,
      `${datasetId}-line`,
      `${datasetId}-points`,
    ];

    possibleLayers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          "visibility",
          checked ? "visible" : "none"
        );
      }
    });
  }

  function updateOpacity(datasetId, value) {
    const map = mapRef.current;
    const valueNumber = Number(value);

    setOpacity((old) => ({
      ...old,
      [datasetId]: valueNumber,
    }));

    if (!map) return;

    const layers = [
      `${datasetId}-fill`,
      `${datasetId}-line`,
      `${datasetId}-points`,
    ];

    layers.forEach((layerId) => {
      if (!map.getLayer(layerId)) return;

      const layer = map.getLayer(layerId);

      if (layer.type === "fill") {
        map.setPaintProperty(
          layerId,
          "fill-opacity",
          valueNumber
        );
      }

      if (layer.type === "line") {
        map.setPaintProperty(
          layerId,
          "line-opacity",
          valueNumber
        );
      }

      if (layer.type === "circle") {
        map.setPaintProperty(
          layerId,
          "circle-opacity",
          valueNumber
        );
      }
    });
  }

useEffect(() => {
  if (!station || !chartRef.current) return;

  const stationDataset = DATASETS.find(
    (d) => d.id === "stations-meteo-en-place"
  );

  if (!stationDataset) return;

  fetch(stationDataset.url)
    .then((response) => response.json())
    .then((geojson) => {
      const rows = geojson.features.map((feature) => {
        const props = feature.properties || {};

        return {
          lcz: props.lcz ?? "NC",
          type: props.type_stati ?? "NC",
        };
      });

      // Comptage : LCZ × type de station
      const grouped = d3.rollup(
        rows,
        (values) => values.length,
        (d) => d.lcz,
        (d) => d.type
      );

      const data = [];

      grouped.forEach((typeMap, lcz) => {
        typeMap.forEach((count, type) => {
          data.push({
            lcz,
            type,
            count,
          });
        });
      });

      const container = d3.select(chartRef.current);
      container.selectAll("*").remove();

      if (data.length === 0) return;

      const lczs = [...new Set(data.map((d) => d.lcz))];
      const types = [...new Set(data.map((d) => d.type))];

      const width = 360;
      const height = 280;

      const margin = {
        top: 30,
        right: 20,
        bottom: 80,
        left: 45,
      };

      const svg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", height);

      // AXE X = LCZ
      const x = d3
        .scaleBand()
        .domain(lczs)
        .range([margin.left, width - margin.right])
        .padding(0.2);

      // AXE Y = nombre de stations
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.count) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

      // COULEUR = type de station
      const color = d3
        .scaleOrdinal()
        .domain(types)
        .range(PALETTES[palette]);

      // Axe X
      svg
        .append("g")
        .attr(
          "transform",
          `translate(0,${height - margin.bottom})`
        )
        .call(d3.axisBottom(x));

      // Axe Y
      svg
        .append("g")
        .attr(
          "transform",
          `translate(${margin.left},0)`
        )
        .call(d3.axisLeft(y).ticks(5));

      // Barres groupées
      const groupWidth = x.bandwidth() / types.length;

      svg
        .selectAll(".bar")
        .data(
          lczs.flatMap((lcz) =>
            types.map((type) => {
              const found = data.find(
                (d) =>
                  d.lcz === lcz &&
                  d.type === type
              );

              return {
                lcz,
                type,
                count: found ? found.count : 0,
              };
            })
          )
        )
        .join("rect")
        .attr(
          "x",
          (d) =>
            x(d.lcz) +
            types.indexOf(d.type) * groupWidth
        )
        .attr("y", (d) => y(d.count))
        .attr("width", groupWidth - 2)
        .attr(
          "height",
          (d) => y(0) - y(d.count)
        )
        .attr("fill", (d) => color(d.type));

      // Légende
      const legend = svg
        .append("g")
        .attr(
          "transform",
          `translate(${margin.left},${height - 35})`
        );

      types.forEach((type, i) => {
        const xPosition = i * 75;

        legend
          .append("rect")
          .attr("x", xPosition)
          .attr("y", 0)
          .attr("width", 10)
          .attr("height", 10)
          .attr("fill", color(type));

        legend
          .append("text")
          .attr("x", xPosition + 13)
          .attr("y", 10)
          .style("font-size", "10px")
          .text(type);
      });
    })
    .catch((error) => {
      console.error("Erreur graphique :", error);
    });
}, [station, palette]);

  return (
    <>
      <div id="panel">
        <h2>Couches</h2>

        <div className="panel-section">
          <h3>Variable</h3>

          <select
            value={variable}
            onChange={(event) =>
              setVariable(event.target.value)
            }
          >
            <option value="temperature">
              Température
            </option>
            <option value="altitude">
              Altitude
            </option>
            <option value="lcz">
              LCZ
            </option>
            <option value="bati">
              Bâti
            </option>
            <option value="veg_haute">
              Végétation haute
            </option>
          </select>
        </div>

        <div className="panel-section">
          <h3>Palette</h3>

          <select
            value={palette}
            onChange={(event) =>
              setPalette(event.target.value)
            }
          >
            <option value="viridis">
              Viridis
            </option>
            <option value="plasma">
              Plasma
            </option>
            <option value="inferno">
              Inferno
            </option>
            <option value="magma">
              Magma
            </option>
            <option value="turbo">
              Turbo
            </option>
          </select>

          <div
            className="palette-preview"
            style={{
              background:
                `linear-gradient(to right, ` +
                PALETTES[palette].join(", ") +
                ")",
            }}
          />
        </div>

        <div className="panel-section">
          <h3>Opacité</h3>

          {DATASETS.map((dataset) => (
            <div
              className="opacity-control"
              key={dataset.id}
            >
              <div className="opacity-label">
                <span>{dataset.name}</span>

                <span>
                  {Math.round(
                    opacity[dataset.id] * 100
                  )}
                  %
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity[dataset.id]}
                onChange={(event) =>
                  updateOpacity(
                    dataset.id,
                    event.target.value
                  )
                }
              />
            </div>
          ))}
        </div>

        <div className="panel-section">
          <h3>Afficher</h3>

          {DATASETS.map((dataset) => (
            <label
              className="checkbox-label"
              key={dataset.id}
            >
              <input
                type="checkbox"
                checked={visibility[dataset.id]}
                onChange={(event) =>
                  updateVisibility(
                    dataset.id,
                    event.target.checked
                  )
                }
              />

              {dataset.name}
            </label>
          ))}
        </div>
      </div>

      <div
        id="map"
        ref={mapContainer}
      />

      <div id="dashboard">
        <h2>Station météo</h2>

        {!station ? (
          <div id="dashboard-content">
            Cliquez sur une station météo.
          </div>
        ) : (
          <>
            <div id="dashboard-content">
              {Object.entries(station).map(
                ([key, value]) => (
                  <div
                    className="dashboard-property"
                    key={key}
                  >
                    <strong>{key} :</strong>{" "}
                    {value ?? "—"}
                  </div>
                )
              )}
            </div>

            <div
              id="station-chart"
              ref={chartRef}
            />
          </>
        )}
      </div>
    </>
  );
}

export default App;
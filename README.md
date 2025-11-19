# finanzresilienz

This repository now contains a lightweight Flask application that exposes randomized real-estate data **and** serves the accompanying front-end pages. The endpoints are mocked for quick prototyping and are integrated into the existing mortgage calculator.

## Getting started

1. Create a virtual environment and install the dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the Flask server (which now serves both the API and the static pages):

```bash
python app.py
```

The service listens on `http://localhost:8000` by default. The main entry points are:

| URL | Beschreibung |
| --- | --- |
| `/` | ETF-Vermögensrechner |
| `/immobilienrechner` | Immobilienrechner inkl. durchschnittlichem Kaufpreis & Beispielobjekte (nutzt die API) |
| `/wohnungssuche` | Formular, um eine Immobiliensuche bei Immobilienscout24 zu starten |

Der Immobilienrechner ruft nach einer Berechnung automatisch `/average-price` und `/properties` auf, um Durchschnittspreise und fünf zufällige Beispielangebote für die angegebene PLZ zu zeigen.

## Available endpoints

### `GET /properties`

Query parameters (all optional):

| parameter   | description                                 | default |
|-------------|---------------------------------------------|---------|
| `min_price` | Minimum purchase price in EUR               | `0`     |
| `max_price` | Maximum purchase price in EUR               | `2000000` |
| `min_size`  | Minimum living space in square meters       | `0`     |
| `max_size`  | Maximum living space in square meters       | `1000`  |
| `min_rooms` | Minimum number of rooms                     | `1`     |
| `max_rooms` | Maximum number of rooms                     | `10`    |
| `latitude`  | Center latitude for generated coordinates   | `52.52` |
| `longitude` | Center longitude for generated coordinates  | `13.405`|
| `radius`    | Search radius in kilometres                 | `5`     |

The endpoint returns a JSON payload containing a filtered list of randomized properties and the total count of entries.

### `GET /average-price`

Returns the mocked average purchase price per square meter for the supplied coordinates and radius. Accepts `latitude`, `longitude` and `radius` as optional query parameters.

### `GET /average-rent`

Returns the mocked average rent price per square meter for the supplied coordinates and radius. Accepts `latitude`, `longitude` and `radius` as optional query parameters.

All endpoints respond with JSON documents and can be safely extended or replaced with real data sources in the future.

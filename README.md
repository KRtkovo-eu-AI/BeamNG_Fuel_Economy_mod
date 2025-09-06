# BeamNG Fuel Economy UI App

[![Node.js CI](https://github.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/actions/workflows/node.js.yml/badge.svg)](https://github.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/actions/workflows/node.js.yml) [![Release](https://img.shields.io/github/v/tag/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod?sort=semver&label=version)](https://github.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/tags)

![Fuel Economy](https://raw.githubusercontent.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/refs/heads/main/okFuelEconomy/ui/modules/apps/okFuelEconomy/app.png "Fuel Economy")

This repository contains a UI mod for BeamNG.drive that displays fuel economy information. The app is written in JavaScript using Angular.

## Features

![Fuel Economy screenshot](https://raw.githubusercontent.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/refs/heads/main/img/preview.png "Fuel Economy screenshot")

- Tracked distance using a custom calculation and ECU values.
- Fuel consumed, remaining and total capacity.
- Average and instant fuel consumption.
- Configurable units for fuel economy including km/L, L/100 km, MPG (US or UK) and kWh/100 km.
- Estimated range based on current and long-term consumption.
- Long-term consumption overview with reset option.
- Trip statistics showing average consumption, distance and range, with reset control.
- Efficiency history graphs for instant, average and trip consumption with toggleable visibility and custom style support.
- Hide or show heading and individual data points through an in-app settings dialog that remembers user choices.
- Switch between the default BeamNG style and a custom neon-themed look.
- Optional fuel cost calculator showing average, trip average and total costs (both overall and trip) driven by prices set in `fuelPrice.json`.

Data are gathered via `StreamsManager` from the *electrics* and *engineInfo* channels. All calculations are performed client-side using helper functions like `calculateFuelFlow`, `calculateInstantConsumption`, `calculateRange` and `trimQueue`.

## Fuel price configuration

Fuel cost calculations use values stored in `AppData/Local/BeamNG.drive/{version}/settings/krtektm_fuelEconomy/fuelPrice.json`. You can change them in two ways:

1. Use the in-game fuel price dialog to set the values directly. This UI writes to the same `fuelPrice.json` file.
2. Manually edit `fuelPrice.json` yourself (for example `C:/Users/<your user>/AppData/Local/BeamNG.drive/<version>/settings/krtektm_fuelEconomy/fuelPrice.json` on Windows) and set the values inside the `prices` object (such as `Gasoline` and `Electricity`), optionally adding a `currency` label (e.g. `$`, `€`).

The controller loads these prices at runtime and computes average cost per distance, trip average cost per distance, total fuel cost and trip total fuel cost when the relevant fields are enabled in settings.
Trip costs accumulate only while their respective unit mode is active: liquid costs grow when using metric or imperial units, whereas electric costs grow when using the electric unit mode.
Any edits to the file—whether done manually or via the dialog—while the game is running are picked up automatically so prices can be changed without restarting.
If the file is missing, the widget falls back to a price of `0` and a currency label of `money` so the calculator still operates.

## Tests

Automated Node.js tests cover:

- utility helpers for fuel flow, instant consumption, queue trimming and range
- cumulative fuel usage and distance tracking
- extended drive simulations across varied environments, vehicle resets and trip counter behaviour
- stress scenarios repeating environment cycles plus a 30‑second random run with periodic resets
- UI template styling, placeholders, controller integration, update throttling and saved visibility settings

Run them with:

```
npm test
```

We recommend running tests after every change. Our GitHub repo is configured to run tests automatically with PRs.

## Structure

```
  okFuelEconomy/
    ui/modules/apps/okFuelEconomy/app.html  – UI template
    ui/modules/apps/okFuelEconomy/app.js    – app logic
    tests/                                 – automated tests for calculations, simulations, stress and UI
```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) license.


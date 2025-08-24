# BeamNG Fuel Economy UI App

This repository contains a UI mod for BeamNG.drive that displays fuel economy information. The app is written in JavaScript using Angular.

## Features

- Tracked distance using a custom calculation and ECU values.
- Fuel consumed, remaining and total capacity.
- Average and instant fuel consumption.
- Estimated range based on current and long-term consumption.
- Long-term consumption overview with reset option.

Data are gathered via `StreamsManager` from the *electrics* and *engineInfo* channels. All calculations are performed client-side using helper functions like `calculateFuelFlow`, `calculateInstantConsumption`, `calculateRange` and `trimQueue`.

## Tests

The project includes Node.js tests that verify these helper functions and cumulative calculations. Run them with:

```
npm test
```

We recommend running tests after every change.

## Structure

```
okFuelEconomy/
  ui/modules/apps/okFuelEconomy/app.html  – UI template
  ui/modules/apps/okFuelEconomy/app.js    – app logic
  tests/                                 – unit tests for calculation functions
```

## License

This project is licensed under the [MIT](LICENSE) license.


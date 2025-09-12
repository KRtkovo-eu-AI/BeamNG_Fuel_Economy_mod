![Fuel Economy App](https://raw.githubusercontent.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/refs/heads/main/okFuelEconomy/ui/modules/apps/okFuelEconomy/app.png)

Track your fuel efficiency in real time!  
Perfect for anyone who wants to bring realistic fuel economy monitoring into BeamNG.drive!

This mod adds a custom UI app for BeamNG.drive that lets you monitor fuel consumption, distance traveled, and driving range with precision. Whether you’re role-playing realistic long hauls, testing vehicles, or just curious about your driving habits, this dashboard gives you the insights you need.

![Preview](https://raw.githubusercontent.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/refs/heads/main/img/preview.png)

## ✨ Features

- **Distance Tracking** – Calculates traveled distance using both in-game ECU data and custom logic.  
- **Fuel Metrics** – Shows consumed fuel, remaining fuel, and total tank capacity.  
- **Consumption Rates** – Displays both instantaneous and average fuel consumption.  
- **Configurable Units** – Choose your preferred units (MPG, km/L, L/100 km, kWh, etc.).  
- **Range Estimation** – Predicts driving range based on both current and long-term consumption.  
- **Trip Statistics** – Tracks average consumption, trip distance, and range, with reset support.  
- **Long-Term Overview** – Provides extended consumption history with a reset option.  
- **Efficiency History Graphs** – Visualize instant, average, and trip consumption trends, with toggleable visibility and custom styling.  
- **Fuel Cost Calculator** – Optional feature that calculates:  
  - Average and trip average cost per distance  
  - Total fuel cost and trip total fuel cost  
- **Customizable UI** – Show or hide headings and individual data points through an in-app settings dialog that remembers your choices.  
- **Theming Options** – Switch between the default BeamNG style and a vibrant neon-themed look.  
- **Emissions Tracking** – Monitors CO₂ and NOₓ emissions, with trip totals, averages, and EU compliance grading.  
- **Multiple Fuel Types** – Supports gasoline, diesel, hydrogen, etc. with dedicated consumption and cost metrics.  
- **Editable Fuel Prices In-Game** – Adjust prices through unit-aware fields and add/remove fuel types directly.  
- **Local Web Endpoint** – Enable the localhost endpoint in settings to start a lightweight server that mirrors the widget’s data.  
  - Visit [http://127.0.0.1:23512](http://127.0.0.1:23512) → Receive a live JSON snapshot of all stats.  
  - Visit [http://127.0.0.1:23512/ui.html](http://127.0.0.1:23512/ui.html) → View a browser-based dashboard mirroring the in-game widget.  
  Perfect for logging data externally or integrating with third-party tools.  

---

## ⛽ Fuel Price Configuration

To enable cost calculations:

- Use the in-game **Fuel Price Editor** dialog to set the values directly.  
- Set the Electricity, Gasoline or other fuel type values to the prices of fuel per volume unit you use (L or gal for liquid, kWh for electricity).  
- Optionally set a custom currency label (e.g. `$`, `€`).  

![Fuel Price Editor](https://www.beamng.com/attachments/1254682/)

---

## 🐞 Did you find any error or bug?

Feel free to report it through **[GitHub Issues](https://github.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/issues)**.

---

## ⚙️ Technical Details

![Tests](https://github.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod/actions/workflows/node.js.yml/badge.svg) ![Version](https://img.shields.io/github/v/tag/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod?sort=semver&label=released) ![Pass Status](https://camo.githubusercontent.com/0ba47a86c4eb3ee5b7f754687e417c0cc0330edd11ed62b60d38746609ad5e35/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f74657374732d3338382532307061737365642d73756363657373)

### Tests

Automated Node.js test suite ensures stability and accuracy across all components:

- **Utility Helpers** – Fuel flow, instant consumption, queue trimming, range calculations.  
- **Usage Tracking** – Cumulative fuel usage and distance monitoring.  
- **Drive Simulations** – Extended tests across varied environments, vehicle resets, and trip counter behaviors.  
- **Stress Scenarios** – Repeated environment cycles and 30-second randomized runs with resets.  
- **UI Validation** – Template styling, placeholders, controller integration, update throttling, and persistence of visibility settings.  

---

## 📂 Installation

- Subscribe to the mod on this site.  
**or**  
- Download the mod zip file and place it into your `mods` folder.  

Then:  
1. Launch BeamNG.drive.  
2. Add the **Fuel Economy App** to your UI layout through the in-game app editor.  
3. Start driving and watch your fuel stats update in real time!  

---

## 📜 License

This project is open-source and distributed under the **GNU GPL v3.0** license.  

🔗 Source code available here: [GitHub Repository](https://github.com/KRtkovo-eu-AI/BeamNG_Fuel_Economy_mod)  

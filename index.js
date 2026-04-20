const express = require("express");
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// === Speicher ===
let clients = {};
let history = [];

// === Konfiguration ===
const TIMEOUT_MS = 10 * 60 * 1000; // 10 Minuten gültig
const SMOOTHING_WINDOW = 5;

// bekannte Teilnehmer (optional manuell pflegen)
let knownParticipants = new Set();

// === POST Daten ===
app.post("/data", (req, res) => {
    const { id, pv_power, load_power, battery_soc } = req.body;

    if (!id || pv_power === undefined || load_power === undefined) {
        return res.status(400).send("Missing data");
    }

    clients[id] = {
        pv_power,
        load_power,
        battery_soc: battery_soc || 0,
        timestamp: Date.now()
    };

    knownParticipants.add(id);

    res.send({ status: "ok" });
});

// === Signalberechnung ===
function calculateSignal() {
    const now = Date.now();

    let total = 0;
    let totalSOC = 0;
    let active = 0;

    // === nur frische Daten verwenden ===
    for (let id in clients) {
        const c = clients[id];

        if (now - c.timestamp > TIMEOUT_MS) continue;

        const netto = c.pv_power - c.load_power;

        total += netto;
        totalSOC += c.battery_soc;
        active++;
    }

    // === Mindestanzahl dynamisch ===
    const minRequired = Math.max(5, Math.floor(knownParticipants.size * 0.2));

    if (active < minRequired) {
        return {
            status: "unknown",
            power: 0,
            participants: active,
            required: minRequired,
            confidence: "low"
        };
    }

    const avgSOC = totalSOC / active;

    // === Glättung ===
    history.push(total);
    if (history.length > SMOOTHING_WINDOW) history.shift();

    const smoothPower =
        history.reduce((a, b) => a + b, 0) / history.length;

    // === Ampellogik ===
    let status = "yellow";

    if (smoothPower > 3000) status = "green";
    else if (smoothPower < -1000) status = "red";

    // Batterie-Bonus
    if (smoothPower > 500 && avgSOC > 60) status = "green";

    // === Confidence bestimmen ===
    let confidence = "medium";

    if (active >= knownParticipants.size * 0.6) {
        confidence = "high";
    } else if (active < minRequired) {
        confidence = "low";
    }

    return {
        status,
        power: Math.round(smoothPower),
        participants: active,
        totalParticipants: knownParticipants.size,
        avgSOC: Math.round(avgSOC),
        confidence
    };
}

// === API ===
app.get("/signal", (req, res) => {
    res.json(calculateSignal());
});

app.get("/debug", (req, res) => {
    res.json({
        clients,
        knownParticipants: Array.from(knownParticipants),
        signal: calculateSignal()
    });
});

app.get("/", (req, res) => {
    res.send("EEG Server läuft 🚀");
});

// === Start ===
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});

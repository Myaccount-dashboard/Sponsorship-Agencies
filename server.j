const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

app.use(cors());
app.use(bodyParser.json());

// TEST ROUTE
app.get("/", (req, res) => {
    res.send("Travel System API is running");
});

// CREATE APPLICATION (client submits travel request)
app.post("/apply", (req, res) => {
    const application = req.body;

    console.log("New Application:", application);

    res.json({
        message: "Application received",
        status: "pending review",
        data: application
    });
});

// START SERVER
const PORT = 5000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});

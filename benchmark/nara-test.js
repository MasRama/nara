const express = require('ultimate-express');
const app = express();

app.get('*', (req, res) => {
    res.send("OK")
});

app.listen(3006, () => {
    console.log('ultimate-express benchmark server running on port 3006');
});

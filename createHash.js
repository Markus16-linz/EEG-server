const bcrypt = require('bcrypt');

async function run() {
    const hash = await bcrypt.hash(
        'A7XK-92QP-LM4T',
        10
    );

    console.log(hash);
}

run();
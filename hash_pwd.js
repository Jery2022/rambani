const bcrypt = require('bcrypt');
bcrypt.hash('Keva2010#', 10).then(hash => console.log(hash));

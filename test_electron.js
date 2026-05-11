const { app } = require('electron');
console.log('app type:', typeof app);
console.log('app:', app);
if (app) {
    app.on('ready', () => {
        console.log('App is ready!');
        app.quit();
    });
} else {
    console.log('app is undefined - Electron module issue');
    process.exit(1);
}

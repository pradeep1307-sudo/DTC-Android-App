# Denver Tamil Church Mobile

Android app generated from the public website at `C:\Users\HP\.vscode\DTC App`.

## Included

- all nine public website pages
- English/Tamil language switching
- ministries, missions, events/calendar, gallery, live stream, giving, and contact flows
- website chatbot and daily Bible verses
- all public images, posters, manifests, scripts, and styling
- native handling for web, map, giving, phone, and email links
- custom Denver Tamil Church icons and splash screens

The app uses bundled web content, so core pages remain available without a connection. Network content such as YouTube, Google Maps, ChurchTrac giving, Google Fonts, calls, and email still requires the corresponding network/app service.

## Development

```powershell
npm install
npm run sync
```

Open the `android` folder in Android Studio, or run `npm run android`. See `PUBLISHING.md` for release steps and required signing variables.

Do not edit generated copies under `www` or `android/app/src/main/assets/public`. Edit the source website, then run `npm run sync`.

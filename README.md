# Pedal Melbourne

A Vue 3 demonstration application for discovering cycling routes and community events around Melbourne.

## Project structure

- `src/views` contains the Home, Routes and Events pages.
- `src/components` contains reusable route and event cards.
- `src/data` contains the original sample data used by the Firestore seed script.
- `src/firebase` contains the Firebase application and Firestore configuration.
- `src/services/firestoreData.js` loads routes and events from Firestore.
- `src/assets/main.css` contains shared and responsive styles.
- `src/router/index.js` defines the application's routes.

## Run locally

```sh
npm install
npm run dev
```

## Firebase setup

Copy `.env.example` to `.env` and replace the placeholders with the Firebase web
app configuration. The repository is linked to the `fit5032-arohan` Firebase
project. Its Firestore rules allow public reads for routes and events and deny
client-side writes.

To seed another authorised Firebase project using Application Default Credentials:

```sh
FIREBASE_PROJECT_ID=your-project-id npm run seed:firestore
```

## Check the application

```sh
npm run lint
npm run build
```

The event registration is for demonstration only. It validates user input locally and does not send or store registrations.

New accounts are created with Firebase Authentication. A matching profile document
is stored in the Firestore `users` collection with the default `user` role.

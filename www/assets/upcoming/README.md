# Upcoming event slides

The recommended workflow is the local Media Manager at `http://localhost:8000/admin/`. Use its **Event Posters** tab to add, reorder, feature, or remove `.png`, `.jpg`, `.jpeg`, and `.webp` slides.

For manual management, add event slides to this folder and update `manifest.json` in the order they should appear.

When the local service is running, the homepage automatically discovers every image in this folder and rotates through them in the Upcoming Events carousel. For static hosting, list image paths in `manifest.json` (for example: `[
  "assets/upcoming/summer-events.png"
]`).

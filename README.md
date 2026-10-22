Coco Pendejo - Shop App Prototype (v0.1)

A phone-first, lightweight mobile web application designed for custom automotive shops, built around simple time-management rules, glanceable statuses, and real-world shop environments.

Overview

This repository houses the prototype interface for Coco Pendejo, customized for tracking active car projects, production states, and parts ETAs. It is built with a focus on big touch targets, minimal typing, and instant visibility for mechanics on the shop floor.

Key Features (v0.1 Prototype)

Glanceable Project Status: View active cars and their current production states (e.g., In Progress, Waiting on Parts, Done) at a glance.

Hybrid Offline Mode: Built for shop dead zones. Features a real-time connection monitor that displays a prominent "LOST SYNC" banner when offline, allowing cached reads to load instantly.

Phone-First UI: Optimized with high-contrast elements, responsive layout, and large touch targets to ensure usability one-handed while wrenching.

Local State Persistence: Retains user inputs and status changes locally via browser storage for quick prototyping tests.

File Structure

index.html — The core single-page mobile interface and offline event listeners.

manifest.json — Progressive Web App (PWA) configuration file allowing home-screen installation without app store downloads.

How to Deploy & Test

Deploy to GitHub Pages:

Push index.html and manifest.json along with this README.md to the root directory of your GitHub repository.

Navigate to repository Settings > Pages.

Under Build and deployment, set the Source branch to main (root) and save.

Launch on Mobile:

Open the generated GitHub Pages URL on a mobile device (Safari on iOS or Chrome on Android).

Tap Share (iPhone) or the menu icon (Android) and select "Add to Home Screen".

Test Offline Behavior:

Toggle the mobile device into Airplane Mode to simulate shop dead zones and observe the hybrid offline sync warning banner.

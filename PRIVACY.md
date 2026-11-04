# Privacy Policy

**Last Updated: November 4, 2026**

## Overview

Sahibinden CSV/Excel Exporter ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use our Chrome extension.

## Information We Do NOT Collect

### Personal Data

- We do **not** collect any personally identifiable information
- We do **not** track your browsing history
- We do **not** store your search queries
- We do **not** access your personal files or data

### Usage Analytics

- We do **not** use analytics services
- We do **not** track extension usage patterns
- We do **not** collect crash reports or error logs
- We do **not** monitor user behavior

### Cookies and Storage

- We do **not** set cookies
- We do **not** maintain user profiles
- Listings you add to the basket, your column choices and download progress are saved in the browser's local extension storage, on your device only
- You can delete basket contents at any time from the Sepet tab

## How the Extension Works

### Local Processing Only

- All data extraction happens **locally** in your browser
- No data is sent to external servers
- No data is uploaded or transmitted anywhere
- Files are created and downloaded directly on your device

### Data Flow

1. **Input**: You visit a Sahibinden.com results or listing page
2. **Processing**: Extension reads the page content, including photo and map data the page already holds
3. **Output**: Creates a CSV or JSON file locally
4. **Download**: File is saved to your download folder
5. **Retention**: Only what you add to the basket is kept, until you remove it

Seller names and the phone field the site keeps encrypted are not read. Listing descriptions are copied as written, and phone numbers the seller typed into a description are also exported in their own column. If you export or share these numbers, you are responsible for handling them lawfully, including under KVKK.

### Optional Features

Every optional feature is off until you turn it on in the Ayarlar tab.

- **Live exchange rates:** when on, the extension requests rates from `finans.truncgil.com`, with `api.frankfurter.dev` and `api.gold-api.com` as fallbacks. These requests carry no cookies, listing data or browsing data, but those services can see your IP address, as with any web request.
- **Extra-request tools:** when you start one, the extension requests up to 10 listings or 5 result pages per run from Sahibinden.com through your open tab and your session. The saved search check does the same every 6 hours for up to 3 searches, only if a Sahibinden.com tab is open. These requests go only to Sahibinden.com.
- **Browsing capture:** when on, the extension reads each Sahibinden.com listing or results page you open and saves it to the basket on your device.
- **TKGM shortcut:** when you click its button, the extension looks up the province, district and neighbourhood in TKGM's public lists at `cbsapi.tkgm.gov.tr`, then opens that parcel on `parselsorgu.tkgm.gov.tr`. TKGM can see which province and district were looked up, the parcel you open, and your IP address. No listing text, price or account data is sent. Nothing happens until you click.

## Permissions Explained

The extension requests minimal permissions necessary for functionality:

### `activeTab`

- **Purpose**: Access the current tab when you open the extension
- **Scope**: Only the active tab, only when extension is used
- **Data Access**: Listing data on Sahibinden.com; image addresses when you scan images on another site

### `scripting`

- **Purpose**: Execute scripts to extract data from the page
- **Scope**: The active tab, on demand
- **Function**: Read HTML content for export, without changing the page

### `downloads`

- **Purpose**: Save generated CSV/JSON files and images
- **Scope**: Create files in your default download folder
- **Data**: Only the exported file data

### `storage`

- **Purpose**: Keep the basket and your column choices
- **Scope**: Local to your browser

### `host_permissions`

- **Scope**: `*://*.sahibinden.com/*`
- **Purpose**: Access Sahibinden.com pages
- **Limitation**: Other websites are reachable only through `activeTab`, when you open the extension on them

### `sidePanel`

- **Purpose**: The extension's main screen opens in the browser's side panel
- **Scope**: While the panel is open, it reads the Sahibinden.com page in the active tab whenever that page changes. This stays on your device and sends the site no extra requests

### `alarms`, `notifications`

- **Purpose**: The saved search check
- **Scope**: Declared up front so that switching the feature on takes effect at once. They stay unused until you turn it on
- **Other addresses**: The extension holds no host permission for the rate services or TKGM. It calls their public addresses without cookies

## Third-Party Services

- Without the optional features, the extension contacts no third-party service
- Live exchange rates and the TKGM shortcut, when you use them, contact the services listed under Optional Features
- No advertising networks
- No social media tracking
- No marketing platforms

## Data Security

### Local Processing

- All operations performed in your browser's secure environment
- No server-side processing or storage
- Exported data stays on your device

### Minimal Attack Surface

- Extension has no backend infrastructure
- No remote databases
- No user accounts or authentication

## Your Control

### Data Control

- You control what data is exported
- Only the page you open is processed, unless you start the experimental reader
- You choose when to run the extension
- Downloaded files are managed by you

### Uninstallation

- Removing the extension deletes all associated data
- No residual data remains on your system
- No account deletion needed (no accounts exist)

## Compliance

### GDPR Compliance

- No personal data processing occurs
- No consent mechanisms needed (no data collected)
- No data subject rights apply (no data stored)
- No data controller/processor relationships

### Regional Laws

- Extension complies with data protection laws
- No cross-border data transfers occur
- All processing happens on user's device

## Children's Privacy

- Extension does not knowingly collect data from children
- No age verification required (no data collected)
- Safe for users of all ages

## Changes to Privacy Policy

### Notification

- Material changes will be reflected in this document
- Users will be notified through extension updates
- Continued use implies acceptance of changes

### Version Control

- Each version will be dated and archived
- Change history will be maintained
- Users can review previous versions

## Contact Information

If you have questions about this Privacy Policy:

- **GitHub Issues**: [Repository URL]/issues
- **Email**: [Your contact email]
- **Response Time**: We aim to respond within 48 hours

## Legal Framework

This Privacy Policy is governed by:

- European Union General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Turkish Personal Data Protection Law (KVKK)
- Applicable local privacy laws

## Transparency Report

### Data Requests

- We have never received government data requests
- We have no data to provide if requested
- We do not maintain any user information databases

### Security Incidents

- No security breaches have occurred
- No unauthorized access to user data (none exists)
- No data loss incidents (no data stored)

---

**Summary**: We collect no data and track no users. Everything is processed and kept locally on your device.

**Questions?** Contact us if you need clarification on any aspect of our privacy practices.

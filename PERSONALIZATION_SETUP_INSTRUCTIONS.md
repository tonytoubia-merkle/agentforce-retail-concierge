# Salesforce Personalization (Data Cloud) Setup Instructions

This document outlines the steps needed to implement Salesforce Personalization in your project.

## Prerequisites

Before implementing Salesforce Personalization, you need:
1. A Salesforce org with Data Cloud enabled
2. Proper permissions to create connectors and configure Data Cloud
3. Access to the Salesforce Personalization SDK

## Step-by-Step Implementation

### 1. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Salesforce Personalization (Data Cloud) Configuration
VITE_SFP_BEACON_URL=https://cdn.c360a.salesforce.com/beacon/c360a/YOUR_CONNECTOR_ID/scripts/c360a.min.js
VITE_SFP_DATASET=YOUR_DATASET_NAME
```

### 2. Update index.html to Include SDK Script

Add the Salesforce Personalization SDK script to your `index.html` file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <title>Beauty Advisor</title>
    
    <!-- Salesforce Personalization SDK -->
    <script src="https://cdn.c360a.salesforce.com/beacon/c360a/YOUR_CONNECTOR_ID/scripts/c360a.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 3. Create Connector in Salesforce

1. Navigate to **Data Cloud** → **Connectors** in your Salesforce org
2. Click **New Connector**
3. Fill in the details:
   - **Connector Name**: Beauty Commerce
   - **Connector Type**: Website
   - **Schema Required**: Yes
4. Upload your schema file (JSON format) that describes your data structure
5. Upload your sitemap to define data collection rules
6. Save and activate the connector

### 4. Configure Data Collection

After creating the connector, Salesforce will provide you with:
- A unique **Connector ID** that goes into your `VITE_SFP_BEACON_URL`
- A **Dataset Name** that goes into your `VITE_SFP_DATASET`

### 5. Verify Integration

Once configured, verify that:
- The SDK loads correctly in your browser console
- Personalization events are being sent to Data Cloud
- Campaign decisions can be fetched from the personalization engine

## Required Configuration Values

Based on the Salesforce setup wizard information you shared:

1. **Connector Name**: Beauty Commerce
2. **Connector Type**: Website
3. **Beacon URL**: `https://cdn.c360a.salesforce.com/beacon/c360a/YOUR_CONNECTOR_ID/scripts/c360a.min.js`
4. **Dataset Name**: To be determined after connector creation

## Testing Your Setup

1. Open your browser's developer console
2. Check that the SalesforceInteractions SDK is available on the window object
3. Verify that personalization events are being logged to the console
4. Test campaign decision fetching functionality

## Troubleshooting

If you encounter issues:
1. Check that the SDK script loads without errors
2. Verify that `window.SalesforceInteractions` is defined
3. Confirm that your environment variables are correctly set
4. Ensure your connector is active in Salesforce Data Cloud

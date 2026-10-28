# PharmaQL Multi-Tenant Production Deployment Guide

This guide details the complete deployment process for the **Devfinity PharmaQL Platform**, covering:
1. **Your Domain Setup (Dev Portal & Platform Infrastructure)**
2. **Client Domain Setup (White-Label Custom Domains & Routing)**
3. **Client On-Premise API Server Setup (ERP Bridge)**
4. **DNS, SSL & Troubleshooting Checklist**

---

## Architecture Overview

```
                                      +------------------------------------+
                                      |            Vercel Cloud            |
                                      |  (Single Next.js App Deployment)   |
                                      +-----------------+------------------+
                                                        |
                     +----------------------------------+----------------------------------+
                     |                                                                     |
                     v                                                                     v
        [ Devfinity Dev Portal ]                                              [ Client White-Label Portal ]
   Domain: pharmaql.devfinity.net                                             Domain: portal.asmeepharma.com
   - Master Control Center (/admin/tenants)                                   - Client ERP Dashboard & Reports
   - Notice Board & System Audit                                              - MR Access & Order Management
   - Global Tenant Management                                                 - Client Brand Colors & Logo
                     |                                                                     |
                     v                                                                     v
        +-------------------------+                                           +-------------------------+
        |  Neon Serverless SQL    | <---- Edge Middleware Host Lookup ------- |  Client On-Prem Server  |
        |  (Control Plane DB)     |       (Zero-Downtime Tenant Routing)      |  (Windows API Server)   |
        +-------------------------+                                           +-------------------------+
```

---

## Part 1: Your Domain Setup (Devfinity Master Platform)

Your master domain hosts the **Devfinity Cloud Control Center** where you manage tenants, configure licenses, and monitor platform health.

### 1.1 Vercel Project Setup

1. Push your repository branch (e.g. `main` or `localdb`) to GitHub.
2. In the [Vercel Dashboard](https://vercel.com):
   - Click **Add New** > **Project** and import your `pharmaql` repository.
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `pnpm build` (or leave default `next build`)
   - **Install Command**: `pnpm install`

### 1.2 Environment Variables (Vercel Project Settings)

Add the following production environment variables under **Settings** > **Environment Variables**:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `CONTROL_PLANE_DATABASE_URL` | Neon Serverless Postgres Connection String | `postgresql://user:pass@ep-cool-fog-1234.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `CONTROL_PLANE_ENCRYPTION_KEY` | 64-character hexadecimal key for AES-256-GCM encryption of client API keys | *Generated via terminal (see below)* |
| `DEV_PORTAL_DOMAIN` | Your master control center hostname | `pharmaql.devfinity.net` |
| `DEV_EMAIL` | Master developer portal login email | `dev@devfinity.net` |
| `DEV_PASSWORD` | Master developer portal login password | `YourSecureDevPassword123!` |
| `ADMIN_EMAIL` | Default platform administrator email | `admin@devfinity.net` |
| `ADMIN_PASSWORD` | Default platform administrator password | `YourSecureAdminPassword123!` |
| `DEV_SMTP_HOST` | SMTP server for developer platform notifications (e.g. Zoho, SendGrid) | `smtp.zoho.in` |
| `DEV_SMTP_PORT` | SMTP port (SSL) | `465` |
| `DEV_SMTP_USER` | Developer alert email address | `developer@devfinity.net` |
| `DEV_SMTP_PASS` | SMTP app password | `app_specific_password` |
| `GMAIL_USER` | Standard notification mailer (MR OTPs) | `notifications@devfinity.net` |
| `GMAIL_PASS` | Gmail App Password (16 characters) | `abcd efgh ijkl mnop` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key | *Generated via web-push* |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key | *Generated via web-push* |

> [!TIP]
> **Generate a secure 64-character encryption key:**
> Run this command in any terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 1.3 DNS Configuration on Your Domain (Registrar / Cloudflare)

Go to your DNS manager (e.g., Cloudflare, GoDaddy, Namecheap) for `devfinity.net`:

#### Option A: Dedicated Subdomain (Recommended)
Add a CNAME record for `pharmaql.devfinity.net`:

| Type | Name / Host | Target / Value | Proxy Status | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `pharmaql` | `cname.vercel-dns.com` | **DNS Only** (or Cloudflare Full Strict) | Auto / 1 min |

#### Option B: Wildcard Subdomain (For Instant `<client>.devfinity.net` Access)
To automatically support client subdomains (e.g., `asmee.devfinity.net` or `asmee.pharmaql.devfinity.net`):

| Type | Name / Host | Target / Value | Proxy Status | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `*.pharmaql` | `cname.vercel-dns.com` | **DNS Only** | Auto / 1 min |

### 1.4 Add Your Domain to Vercel
1. Go to **Vercel Dashboard** > Your Project > **Settings** > **Domains**.
2. Enter `pharmaql.devfinity.net` and click **Add**.
3. Vercel will verify the DNS record and automatically issue a free Let's Encrypt SSL certificate within 1–2 minutes.

---

## Part 2: Client Domain Configuration (White-Labeling)

When onboarding a new pharmaceutical client (e.g., **Asmee Pharma Pvt. Ltd.** with custom domain `portal.asmeepharma.com`):

### Step 2.1: Client DNS Setup (Instruct Client's IT / Webmaster)

Ask the client's domain administrator to add a DNS record at their domain registrar (e.g. GoDaddy, Cloudflare, Hostinger, AWS Route53):

#### For Subdomain (e.g. `portal.asmeepharma.com`):
| Type | Name / Host | Target / Value | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `portal` | `cname.vercel-dns.com` | Auto (300s) |

#### For Apex / Root Domain (e.g. `asmeeportal.com`):
| Type | Name / Host | Target / Value | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `76.76.21.21` | Auto (300s) |

> [!IMPORTANT]
> **If Client uses Cloudflare:**
> Instruct them to set the Cloudflare Proxy status to **DNS Only** (Gray Cloud icon) during setup so Vercel can verify ownership and issue the SSL certificate. Alternatively, if Orange Cloud (Proxied) is required, their Cloudflare SSL/TLS encryption mode **must be set to Full (Strict)**.

---

### Step 2.2: Add Client Domain to Vercel Project

1. Open your **Vercel Dashboard** > Your `pharmaql` project.
2. Go to **Settings** > **Domains**.
3. In the input box, type the client's full domain: `portal.asmeepharma.com`.
4. Click **Add**.
5. Vercel checks the CNAME record. Once DNS propagates, Vercel shows a green checkmark `Valid Configuration` and provisions an SSL certificate.

---

### Step 2.3: Register Tenant in Devfinity Control Center

1. Log into your Dev Portal at `https://pharmaql.devfinity.net` (or `http://localhost:3000`).
2. Navigate to **Tenant Control Center** (`/admin/tenants`).
3. Click **Register New Tenant**.
4. Fill in the client parameters:

#### Section A: Identity & Branding
- **Tenant Slug**: `asmee` (Unique lowercase identifier, alphanumeric + hyphens).
- **Custom Domain**: `portal.asmeepharma.com` *(Do NOT include `https://` or trailing slashes)*.
- **Display Name**: `Asmee Pharma Pvt. Ltd.`
- **Short Name**: `Asmee Pharma`
- **Primary Color**: `#0B2545` (Header & sidebar accent).
- **Accent Color**: `#134074` (Button hover & active indicators).
- **Logo URL**: `/logo.png` (or link to uploaded high-res SVG/PNG).

#### Section B: Client Details & Overdue Rules
- **Registered Address**: `Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002`
- **Contact Phone**: `+91 98765 43210`
- **Official Email**: `info@asmeepharma.com`
- **Support Email**: `asmeepharma2022@gmail.com`
- **User Email Domain**: `@asmeepharma.com`
- **GSTIN**: `24AAAAA0000A1Z5`
- **Direct Overdue Lock Threshold**: `90` days (Blocks orders if unpaid invoices exceed this age).
- **Division Overdue Lock Threshold**: `95` days.

#### Section C: On-Premise ERP Connection
- **ERP Software Type**: `Technomax` (or `Custom`).
- **Database / Engine**: `MySQL / FoxPro Bridge`.
- **API Server Base URL**: The public URL where the client's API server is reachable (e.g., `https://api.asmeepharma.com:9443` or Cloudflare Tunnel URL `https://erp-bridge.asmeepharma.com`).
- **API Secret Key**: 64-character hexadecimal key shared between your app and the client's local API server.
- **Legacy Database Name**: `pdyasvmaster`
- **Company Number (`comp_no`)**: `11`
- **Location Number (`loc_no`)**: `11`

5. Click **Test API Connection**:
   - The platform sends an authenticated health check probe to the client's API server.
   - If green (`Connected - Technomax ERP online`), proceed.
6. Click **Save Tenant**.

---

## Part 3: Client On-Premise API Server Deployment

The client's local ERP data (e.g. Technomax FoxPro / MySQL databases `pdyasvmaster` and `pdyasvtrans`) resides on their local Windows server or local office PC. The `api-server` acts as the secure bridge.

### 3.1 Prerequisites on Client Server
- Windows 10/11 or Windows Server 2016+
- Node.js LTS (v20 or v22) installed
- Local MySQL service running (standard port `2903` or `3306`)

### 3.2 Installation Steps on Client Server

1. Copy the `api-server/` folder to the client machine (e.g. `C:\PharmaQL\api-server`).
2. Open PowerShell as Administrator:
   ```powershell
   cd C:\PharmaQL\api-server
   npm install --production
   ```
3. Configure `C:\PharmaQL\api-server\.env`:
   ```env
   PORT=9443
   API_SECRET_KEY=94b7e98d1a3c7f8a9e0f6b5c4d3e2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f
   
   # Allowed Origins (Comma-separated, no trailing slashes)
   ALLOWED_ORIGINS=https://portal.asmeepharma.com,https://pharmaql.devfinity.net
   STRICT_CORS=true
   
   # Local ERP Database Connection
   CLIENT_MYSQL_HOST=127.0.0.1
   CLIENT_MYSQL_PORT=2903
   CLIENT_MYSQL_USER=root
   CLIENT_MYSQL_PASSWORD=YourLocalDbPassword
   CLIENT_MYSQL_DATABASE=pdyasvtrans
   ```

### 3.3 Exposing the API Server to the Cloud

You have two secure options:

#### Method 1: Cloudflare Tunnel (Zero Port-Forwarding, Most Secure & Recommended)
1. Install `cloudflared` on the client Windows machine.
2. Create a tunnel:
   ```powershell
   cloudflared tunnel create pharmaql-bridge
   ```
3. Route traffic to local API server:
   ```yaml
   # config.yml
   tunnel: <TUNNEL-UUID>
   credentials-file: C:\Users\<User>\.cloudflared\<TUNNEL-UUID>.json
   
   ingress:
     - hostname: api.asmeepharma.com
       service: http://127.0.0.1:9443
     - service: http_status:404
   ```
4. Run tunnel as a Windows Service:
   ```powershell
   cloudflared service install
   ```
   *No router ports need to be opened, and Cloudflare provides automatic SSL termination.*

#### Method 2: Router Port Forwarding & SSL
1. Set a static IP on the client server (e.g. `192.168.1.100`).
2. In the office router, forward external TCP port `9443` to `192.168.1.100:9443`.
3. Use dynamic DNS (DDNS) or static public IP.

### 3.4 Running API Server 24/7 as a Windows Service
Install PM2 or NSSM:
```powershell
npm install -g pm2
pm2 start dist/server.js --name "pharmaql-api-bridge"
pm2 save
npm install -g pm2-windows-startup
pm2-startup install
```

---

## Part 4: Verification & Smoke Test Matrix

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **1. Dev Portal Access** | Browse to `https://pharmaql.devfinity.net` | Redirects to `/admin/tenants`. Shows Devfinity branding, Cloud Control Center title, and copyright © 2026 Devfinity Pvt. Ltd. |
| **2. Client White-Label Portal** | Browse to `https://portal.asmeepharma.com` | Renders Asmee Pharma branding, logo, MR Portal / Admin login, and ERP navigation options. |
| **3. Client Isolation** | On `https://portal.asmeepharma.com`, try navigating to `/admin/tenants` | Access blocked. Rewrites to 404 / Tenant Not Found to maintain absolute isolation. |
| **4. Unknown Domain** | Browse to an unmapped CNAME (e.g. `random.com`) | Displays branded "Domain Not Configured" screen powered by Devfinity Cloud Platform. |
| **5. Live ERP Data Flow** | Log into MR portal on client domain and query stock/orders | Next.js server proxies queries to client on-prem API server using the stored AES-256 decrypted key. |

---

## Part 5: Common Issues & Troubleshooting

### 1. "Domain Not Configured" Screen Appears on Client Domain
- **Cause**: The incoming `host` header does not match any active tenant record in Neon Postgres.
- **Fix**:
  1. Open Dev Portal > **Tenant Control Center**.
  2. Verify the **Custom Domain** field matches exactly (e.g., `portal.asmeepharma.com`, without `https://`).
  3. Ensure **Active Status** toggle is switched ON.

### 2. Vercel Shows "Invalid Configuration" for Domain
- **Cause**: DNS propagation delay or conflicting DNS records (e.g., existing A record conflicting with CNAME).
- **Fix**: Check `nslookup -type=CNAME portal.asmeepharma.com`. Ensure it resolves exclusively to `cname.vercel-dns.com`. If using Cloudflare on the client side, toggle proxy from Orange to Gray (DNS Only).

### 3. API Connection Test Fails in Control Center
- **Cause**: Client on-prem server is unreachable, port is closed, or API secret key does not match.
- **Fix**:
  1. Open the API Server URL in a browser: `https://api.asmeepharma.com:9443/api/health`. Should return `{"status":"ok"}`.
  2. Confirm `API_SECRET_KEY` in `api-server/.env` exactly matches the secret key entered in the Tenant Control Center.
  3. Check `ALLOWED_ORIGINS` in `api-server/.env` includes `https://portal.asmeepharma.com` and `https://pharmaql.devfinity.net`.

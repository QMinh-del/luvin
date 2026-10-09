# Local avatar moderation proof of concept

This is a free, CPU-only local experiment for development. It listens only on
`127.0.0.1:8090`, has no connection to the Luvin API, and never makes an avatar
public. It must not be used as the production moderation decision.

Start it from this directory:

```powershell
docker compose up --build -d
```

Check readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:8090/healthz
```

Submit a JPEG, PNG, or WebP image (maximum 5 MB):

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8090/classify -ContentType image/png -InFile .\avatar.png
```

`PASS` and `REVIEW` are test-only results. Production still requires the
Google Cloud Vision SafeSearch policy specified by the project contract.

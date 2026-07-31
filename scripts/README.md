# Deploy scripts

`deploy.sh` builds a `linux/amd64` image, pushes it to GHCR, and triggers a
Coolify redeploy of this app.

## One-time setup

```bash
cp scripts/config.example.sh scripts/config.sh
# edit scripts/config.sh with your GHCR + Coolify values
```

`scripts/config.sh` holds secrets and is gitignored — never commit it.

You need:

- A GitHub PAT with `write:packages` (`GHCR_PAT`) and your GitHub username (`GHCR_USER`).
- Your Coolify base URL, an API token (`COOLIFY_TOKEN`), and this app's resource
  UUID (`COOLIFY_APP_UUID`, from the resource's page in Coolify).

## Deploy

```bash
./scripts/deploy.sh          # tags with the short git SHA + latest
./scripts/deploy.sh v1.2.3   # or pass an explicit tag
```

The script logs in to GHCR, runs `docker buildx build --platform linux/amd64
--push`, then `POST`s to `${COOLIFY_BASE_URL}/api/v1/deploy?uuid=...`.

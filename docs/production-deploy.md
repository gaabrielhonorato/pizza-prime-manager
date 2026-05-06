# Production Deploy

Production for `https://app.pizzapremiada.com.br/` is served by the Hostinger VPS.

Pushes to `main` trigger `.github/workflows/deploy-production.yml`, which builds the Vite app and publishes `dist/` to the VPS over SSH.

## Required GitHub Secrets

Configure these in GitHub under `Settings -> Secrets and variables -> Actions`:

- `HOSTINGER_HOST`: VPS host, for example `187.77.36.82`
- `HOSTINGER_USER`: SSH user, for example `root`
- `HOSTINGER_SSH_KEY`: private SSH key authorized on the VPS, preferred
- `HOSTINGER_PASSWORD`: temporary fallback if SSH key access is not ready
- `HOSTINGER_APP_PATH`: nginx document root for `app.pizzapremiada.com.br`
- `VITE_SUPABASE_URL`: production Supabase URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: production Supabase publishable key

Do not commit `.env` files, SSH keys, or passwords. If `HOSTINGER_PASSWORD` is used temporarily, replace it with `HOSTINGER_SSH_KEY` and rotate the root password after setup.

## VPS Expectations

The nginx server block for `app.pizzapremiada.com.br` must point `root` to `HOSTINGER_APP_PATH` and use SPA routing:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

The workflow creates backups in `/var/backups/pizza-prime-manager` before replacing the current files.

After SSH key access is configured, rotate any temporary root password previously shared for setup.

# Fix: HtmlWebpackPlugin loader resolution error

## Symptom
During `npm run build` (or `npm start`) you may see:

- `Html Webpack Plugin: Child compilation failed`
- `Module not found: Error: Can't resolve .../node_modules/html-webpack-plugin/lib/loader.js`

## Root cause
This almost always indicates an **incomplete or corrupted `node_modules`** install (for example, only a cache directory exists, but the real dependencies like `react-scripts` and its transitive deps did not actually install).

In Create React App (`react-scripts@5`), `html-webpack-plugin` is a **transitive dependency** pulled in via webpack config, so if installs are incomplete you will hit missing file errors like `lib/loader.js`.

## Fix
From `notes_frontend/`:

```bash
npm ci
# then
CI=true npm run build
```

`npm ci` installs exactly what is in `package-lock.json` and is the most reliable way to restore a correct dependency tree in CI environments.

## Notes
- If you used `npm install` previously and issues persist, delete `node_modules/` and then run `npm ci` again.
- CRA uses webpack internally; you should *not* add webpack/html-webpack-plugin as direct dependencies unless you are ejecting or customizing webpack.

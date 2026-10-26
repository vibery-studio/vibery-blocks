import { launch, login, openEditor, census, measure, WP } from './lib.mjs';
const { browser, ctx } = await launch();
await login(ctx);
const pg = await openEditor(ctx, +process.argv[2]);
console.log(JSON.stringify(await census(pg)), pg.__logs.slice(0, 5));
const m = await measure(ctx, WP + '/' + (process.argv[3] || 's1-index/'));
console.log(JSON.stringify(m[1440].bands.slice(0, 3)));
await browser.close();

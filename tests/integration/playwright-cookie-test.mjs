import { chromium } from 'playwright';
(async ()=>{
  const browser = await chromium.launch();
  const context = await browser.newContext();
  try{
    await context.addCookies([{ name: 'test', value: '1', url: 'http://localhost:3000', path: '/' }]);
    console.log('addCookies succeeded');
  }catch(e){
    console.error('addCookies failed', e);
    process.exit(2);
  } finally{ await browser.close(); }
})();

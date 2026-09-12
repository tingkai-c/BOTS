import { test,expect } from '@playwright/test';
test('search, inspect, save, negotiate, approve, restore and mobile',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await expect(page.getByRole('heading',{name:'What are you looking for?'})).toBeVisible();await page.screenshot({path:'test-results/landing-desktop.png',fullPage:true,caret:'initial'});
 await page.getByRole('button',{name:/UNDER \$250 Sony/}).click();
 await expect(page.locator('.listing-card').first()).toBeVisible();expect(await page.locator('.listing-card').count()).toBeLessThan(8);
 await expect(page.getByText('Your shortlist is ready',{exact:true}).first()).toBeVisible({timeout:30000});
 await expect(page.locator('.listing-card')).toHaveCount(6);await page.screenshot({path:'test-results/results-desktop.png',fullPage:true});
 await page.getByLabel('Sort listings').selectOption('price');await expect(page.locator('.listing-card').first().locator('.price-row strong')).toHaveText('$165');
 await page.locator('.listing-card').first().getByRole('button',{name:'Save listing',exact:true}).click();
 await page.getByRole('button',{name:'Saved 1',exact:true}).click();await expect(page.locator('.listing-card')).toHaveCount(1);await page.getByRole('button',{name:'Discover 1',exact:true}).click();
 await page.locator('.listing-card').first().getByRole('button',{name:'Details',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Inspect with agent'}).click();await expect(page.getByText('Demo inspection',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/detail.png'});await page.keyboard.press('Escape');
 await page.locator('.listing-card').first().getByRole('button',{name:'Negotiate',exact:true}).click();await expect(page.getByRole('button',{name:'Approve & Send'})).toHaveCount(0);await page.getByRole('button',{name:'Draft an offer'}).click();await expect(page.getByRole('button',{name:'Approve & Send'})).toBeEnabled();await page.getByLabel('Proposed message').fill('Hi! Would you consider $140 for the headphones? Thanks!');await page.screenshot({path:'test-results/approval.png'});await page.getByRole('button',{name:'Approve & Send'}).click();await expect(page.getByText('Demo offer approved',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 const url=page.url();await page.reload();await expect(page.locator('.listing-card')).toHaveCount(6);expect(page.url()).toBe(url);
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.agent-panel')).not.toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/results-mobile.png',fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'Live agent',exact:true}).click();await expect(page.locator('.agent-panel')).toBeVisible();await page.screenshot({path:'test-results/agent-mobile.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});
test('image upload, identification, connection, empty filters and invalid upload',async({page})=>{
 await page.goto('/');const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VbIAAAAASUVORK5CYII=','base64');
 await page.getByLabel('Product image file').setInputFiles({name:'headphones.png',mimeType:'image/png',buffer:png});await expect(page.getByText('headphones.png',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Find it',exact:true}).click();await expect(page.locator('.identification')).toContainText('Sony WH-1000XM5');await expect(page.getByText('Your shortlist is ready',{exact:true}).first()).toBeVisible();
 await page.getByLabel('Maximum price').fill('1');await expect(page.getByText('No matches just yet.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Broaden filters'}).click();await expect(page.locator('.listing-card')).toHaveCount(8);
 await page.getByRole('button',{name:/Connect Facebook/}).click();await page.getByRole('button',{name:'Try demo connection'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:/Demo · Connected/})).toBeVisible();
 await page.getByLabel('Product image file').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')});await expect(page.locator('.error-state')).toContainText('Choose a JPG');
});

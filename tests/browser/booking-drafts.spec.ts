import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('SO saves and reopens the printed booking section without creating an approval', async ({ page, browser }) => {
  const marker=randomUUID().slice(0,8);
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill('so2@example.test');
  await page.getByLabel('Password',{exact:true}).fill('Local-demo-only-2026!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome, Demo SO 2.'})).toBeVisible();
  await page.goto('/bookings/new');
  await expect(page.getByRole('heading',{name:'New booking file',exact:true})).toBeVisible();
  for(const [label,value] of [['Customer code',`C-${marker}`],['Booking number',`OBF-${marker}`],['Enquiry number',`E-${marker}`],['Date','2026-11-10'],['TL name on file','Synthetic Team Leader'],['Booking customer name',`Booking customer ${marker}`],['Communication address','Synthetic test address'],['Contact person','Synthetic contact'],['PIN','000000'],['Model','Innova HyCross'],['Suffix 1','Preference A'],['Suffix 2','Preference B'],['Colour 1','White'],['Colour 2','Silver'],['Interior colour','Black'],['Special request','Synthetic preference only']]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('GST billing',{exact:true}).selectOption('yes');
  await page.getByLabel('Registration type',{exact:true}).selectOption('permanent');
  await page.getByLabel('This file is for an existing confirmed booking.',{exact:true}).check();
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:850});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const outside=await page.locator('form input,form select,form textarea').evaluateAll(elements=>elements.filter(e=>{const r=e.getBoundingClientRect();return r.width && (r.left<0 || r.right>innerWidth+1);}).map(e=>e.getAttribute('name')));
    expect(outside).toEqual([]);
  }
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  const detail=page.url().split('?')[0];
  await expect(page.getByLabel('Suffix 2',{exact:true})).toHaveValue('Preference B');
  await expect(page.getByLabel('Colour 2',{exact:true})).toHaveValue('Silver');
  await expect(page.getByLabel('Booking customer name',{exact:true})).toHaveValue(`Booking customer ${marker}`);
  await expect(page.getByRole('button',{name:/Submit|Approve|Send to BO/})).toHaveCount(0);
  const tabs=await page.context().newPage();
  await tabs.goto(detail);
  await page.bringToFront();
  await page.getByLabel('Special request',{exact:true}).fill('Saved revised preference');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByText('Draft · v2',{exact:true})).toBeVisible();
  await tabs.bringToFront();
  await tabs.getByLabel('Special request',{exact:true}).fill('Stale change must not save');
  await tabs.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(tabs.locator('form').getByRole('alert')).toContainText('record changed');
  await tabs.reload();
  await expect(tabs.getByLabel('Special request',{exact:true})).toHaveValue('Saved revised preference');
  await tabs.close();
  await page.goto('/bookings');
  await page.getByLabel('Search customer name',{exact:true}).fill(marker);
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('link',{name:`Open booking OBF-${marker} for Booking customer ${marker}`})).toBeVisible();
  const context=await browser.newContext();
  try {
    const tl=await context.newPage();
    await tl.goto('http://127.0.0.1:3000/login');
    await tl.getByLabel('Email',{exact:true}).fill('tl3@example.test');
    await tl.getByLabel('Password',{exact:true}).fill('Local-demo-only-2026!');
    await tl.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(tl.getByRole('heading',{name:'Welcome, Demo TL 3.'})).toBeVisible();
    await tl.goto(detail);
    await expect(tl.getByLabel('Booking customer name',{exact:true})).toHaveValue(`Booking customer ${marker}`);
    await expect(tl.getByLabel('Booking customer name',{exact:true})).toHaveAttribute('readonly','');
    await expect(tl.getByRole('button',{name:'Save changes',exact:true})).toHaveCount(0);
  } finally {await context.close();}
});

test('non-sales users cannot enter booking routes', async ({ page })=>{
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill('admin1@example.test');
  await page.getByLabel('Password',{exact:true}).fill('Local-demo-only-2026!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome, Demo Admin 1.'})).toBeVisible();
  await page.goto('/bookings/new');
  await expect(page).toHaveURL(/\/workspace$/);
  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/workspace$/);
});

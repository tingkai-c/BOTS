import type { Page } from 'playwright-core';
import type { Listing } from '@/lib/schemas';
import { inspectListing, requireLoginCheck } from '../shared';
export async function openSellerConversation(page:Page,listing:Listing){await inspectListing(page,listing);await requireLoginCheck(page,'kijiji');const opener=page.getByRole('button',{name:/^Reply to Ad|Message seller$/i}).first();if(await opener.count())await opener.click({timeout:8000});const box=page.locator('textarea, [contenteditable="true"][role="textbox"]').last();await box.waitFor({timeout:10000});return box;}
export async function sendSellerMessage(page:Page,listing:Listing,message:string){const box=await openSellerConversation(page,listing);await box.fill(message);await page.getByRole('button',{name:/^Send( Message)?$/i}).last().click({timeout:8000});await page.getByText(/message (has been )?sent|reply sent/i).first().waitFor({timeout:10000});}

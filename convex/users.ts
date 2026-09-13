import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { authorizeServer } from './access';

const normalizePhone=(raw:string)=>{const digits=raw.replace(/[^\d+]/g,'');if(!/^\+?[1-9]\d{7,14}$/.test(digits))throw new Error('Enter a valid phone number, e.g. +14155551234.');return digits.startsWith('+')?digits:`+1${digits}`;};

export const setPhone=mutation({args:{phone:v.string()},handler:async(ctx,a)=>{
 const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');
 const phone=normalizePhone(a.phone);
 const old=await ctx.db.query('users').withIndex('by_user',q=>q.eq('userId',user.subject)).unique();
 if(old)await ctx.db.patch(old._id,{phone});else await ctx.db.insert('users',{userId:user.subject,phone});
}});

export const me=query({args:{},handler:async(ctx)=>{
 const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');
 const row=await ctx.db.query('users').withIndex('by_user',q=>q.eq('userId',user.subject)).unique();
 return {phone:row?.phone??null};
}});

export const phoneFor=query({args:{secret:v.string(),userId:v.string()},handler:async(ctx,a)=>{
 authorizeServer(a.secret);
 const row=await ctx.db.query('users').withIndex('by_user',q=>q.eq('userId',a.userId)).unique();
 return row?.phone??null;
}});

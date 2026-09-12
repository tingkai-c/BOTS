import { ShoppingApp } from '@/components/shopping-app';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ShoppingApp demo={!process.env.STEEL_API_KEY} initialId={id}/>;}

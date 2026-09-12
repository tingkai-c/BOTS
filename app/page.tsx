import { ShoppingApp } from '@/components/shopping-app';
export default function Page(){return <ShoppingApp demo={!process.env.STEEL_API_KEY}/>;}

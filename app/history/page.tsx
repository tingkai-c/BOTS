import { HistoryPage } from '@/components/history-page';
export default function Page() { return <HistoryPage demo={!process.env.STEEL_API_KEY}/>; }

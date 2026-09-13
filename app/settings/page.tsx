import { SettingsPage } from '@/components/settings-page';
export default function Page() { return <SettingsPage demo={!process.env.STEEL_API_KEY}/>; }

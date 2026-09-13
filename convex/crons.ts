import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';
const crons=cronJobs();
crons.interval('workspace dispatcher',{minutes:1},internal.dispatcher.tick,{});
export default crons;

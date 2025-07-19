import { startPDFEmailCron } from './cron-service';

// Initialize cron job only on server side
if (typeof window === 'undefined') {
  // This will only run on the server side
  console.log('Initializing PDF email cron job...');
  startPDFEmailCron();
} 
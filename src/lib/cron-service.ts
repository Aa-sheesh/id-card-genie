import cron from 'node-cron';
import { checkAndSendPDFs } from './email-service';

// Schedule the PDF check and email sending every 7 days
export const startPDFEmailCron = (): void => {
  // Run every 7 days at 9:00 AM
  // Cron format: 0 9 */7 * * (every 7 days at 9 AM)
  // For testing: '0 */1 * * *' (every hour)
  
  const cronSchedule = process.env.NODE_ENV === 'development' 
    ? '0 */1 * * *' // Every hour in development
    : '0 9 */7 * *'; // Every 7 days at 9 AM in production
  
  console.log(`Starting PDF email cron job with schedule: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, async () => {
    console.log('Running scheduled PDF email check...');
    try {
      await checkAndSendPDFs();
    } catch (error) {
      console.error('Error in scheduled PDF email check:', error);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log('PDF email cron job started successfully');
};

// Manual trigger function for testing
export const triggerPDFEmailCheck = async (): Promise<void> => {
  console.log('Manually triggering PDF email check...');
  await checkAndSendPDFs();
};

// Stop the cron job (useful for cleanup)
export const stopPDFEmailCron = (): void => {
  console.log('Stopping PDF email cron job...');
  // Note: node-cron doesn't provide a direct way to stop all jobs
  // This would need to be implemented with job references if needed
}; 
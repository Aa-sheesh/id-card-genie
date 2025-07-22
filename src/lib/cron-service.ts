import cron from 'node-cron';
import { checkAndSendImages } from './email-service';

// Schedule the image check and email sending every 7 days
export const startImageEmailCron = (): void => {
  // Run every 7 days at 9:00 AM
  // Cron format: 0 9 */7 * * (every 7 days at 9 AM)
  // For testing: '0 */1 * * *' (every hour)
  
  const cronSchedule = process.env.NODE_ENV === 'development' 
    ? '0 */1 * * *' // Every hour in development
    : '0 9 */7 * *'; // Every 7 days at 9 AM in production
  
  console.log(`Starting image email cron job with schedule: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, async () => {
    console.log('Running scheduled image email check...');
    try {
      await checkAndSendImages();
    } catch (error) {
      console.error('Error in scheduled image email check:', error);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log('Image email cron job started successfully');
};

// Manual trigger function for testing (optionally for a specific school)
export const triggerImageEmailCheck = async (schoolId?: string): Promise<void> => {
  console.log('Manually triggering image email check...');
  await checkAndSendImages(schoolId);
};

// Stop the cron job (useful for cleanup)
export const stopImageEmailCron = (): void => {
  console.log('Stopping image email cron job...');
  // Note: node-cron doesn't provide a direct way to stop all jobs
  // This would need to be implemented with job references if needed
}; 
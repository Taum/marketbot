import { GenericIndexer, IdentifiedRequest } from './generic-indexer.js';
import { delay } from '../common/utils/promise.js';

// Example of a fetch function that gets data from a server
async function fetchData(request: IdentifiedRequest): Promise<any> {
  console.log(`Fetching data for request: ${request.id}`);
  
  // Simulate API call with random delay between 500ms and 2000ms
  const responseTime = Math.floor(Math.random() * 1500) + 500;
  await delay(responseTime);
  
  console.log(`Completed request: ${request.id} in ${responseTime}ms`);
  return {
    id: request.id,
    data: request.data,
    result: `Result for ${request.id}`,
    timestamp: new Date().toISOString()
  };
}

// Example of a persist function that stores data
async function persistData(data: any): Promise<void> {
  console.log(`Persisting data for ${data.id}`);
  // In a real application, this would save to a database
}

async function main() {
  // Create a new crawler with our fetch function
  // Configure it to process 2 requests concurrently and max 30 requests per minute
  const crawler = new GenericIndexer(fetchData, persistData, {
    concurrency: 2,
    maxRequestsPerMinute: 30
  });
  
  // Add some requests to the queue
  crawler.addRequest({ id: 'request-1', data: { priority: 'normal' } });
  crawler.addRequest({ id: 'request-2', data: { priority: 'normal' } });
  crawler.addRequest({ id: 'request-3', data: { priority: 'normal' } });
  
  // Add a high priority request to the front of the queue
  crawler.addRequest({ id: 'high-priority', data: { priority: 'high' } }, true);
  
  // Add batch of requests
  crawler.addRequests([
    { id: 'batch-1', data: { batch: 1 } },
    { id: 'batch-2', data: { batch: 1 } },
    { id: 'batch-3', data: { batch: 1 } }
  ]);
  
  // Wait for a bit to let some requests process
  await delay(5000);
  
  // Add more requests while processing is happening
  console.log(`Queue size: ${crawler.queueSize}`);
  crawler.addRequest({ id: 'request-late', data: { addedLater: true } });
  
  // Pause the crawler after some time
  await delay(3000);
  console.log('Pausing the crawler');
  crawler.pause();
  
  // Add a request while paused (it won't process until we start again)
  crawler.addRequest({ id: 'request-while-paused', data: { addedWhilePaused: true } });
  console.log(`Queue size while paused: ${crawler.queueSize}`);
  
  // Start again after a delay
  await delay(2000);
  console.log('Starting the crawler again');
  crawler.start();
  
  // Let all requests complete
  await delay(10000);
  
  // Stop the crawler
  console.log('Stopping the crawler');
  crawler.stop();
}

// Run the example
main()
  .then(() => console.log('Example completed'))
  .catch(err => console.error('Error in example:', err)); 
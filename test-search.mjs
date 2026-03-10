import { getSearchScraper } from './server/services/searchScraper.ts';

async function test() {
  try {
    console.log('Initializing scraper...');
    const scraper = await getSearchScraper();
    console.log('Scraper initialized');
    
    console.log('Testing Google scrape...');
    const results = await scraper.scrapeGoogle('test query', 2, 2);
    console.log('Results:', results.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();

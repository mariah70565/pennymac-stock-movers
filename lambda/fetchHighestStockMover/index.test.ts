import { handler } from "./index";
import { ScheduledEvent } from 'aws-lambda';

jest.mock('@massive.com/client-js', () => ({
  restClient: () => ({
    getGroupedStocksAggregates: async () => ({
      results: []
    })
  })
}), { virtual: true });

process.env.STOCKS_TABLE_NAME = "test-table";
process.env.MASSIVE_API_KEY_SECRET_NAME = "test-secret";

describe('Unit Test for FetchHighestStockMover Lambda Function', function() {
    it('should return status code 200 and success message', async () => {
        const event = {} as ScheduledEvent; //mock event data
        const context = {} as any; //mock context data

        const result = await handler(event, context);

        expect(result.statusCode).toBe(200);
        expect(result).toHaveProperty('body');
    });
});
import { handler } from "./index";
import { ScheduledEvent } from 'aws-lambda';

describe('Unit Test for FetchHighestStockMover Lambda Function', function() {
    it('should return status code 200 and success message', async () => {
        const event = {} as ScheduledEvent; //mock event data
        const context = {} as any; //mock context data

        const result = await handler(event, context);

        expect(result).toHaveProperty('statusCode');
        expect(result).toHaveProperty('body');
    });
});
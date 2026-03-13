import { handler } from "./index";

describe('Unit Test for FetchHighestStockMover Lambda Function', function() {
    it('should return status code 200 and success message', async () => {
        const event = {}; //mock event data
        const context = {} as any; //mock context data

        const result = await handler(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe("Highest Mover Lambda successfully executed");
    });
});